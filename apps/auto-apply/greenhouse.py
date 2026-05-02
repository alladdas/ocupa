"""
Greenhouse auto-apply — uses the public Greenhouse Boards API.

POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
as multipart/form-data.  Most public boards accept unauthenticated submissions;
if the company enabled Application Form Token enforcement, the call returns 401
and status='failed' is returned so the caller can surface the error.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import requests

from gpt_answerer import GPTAnswerer
from models import ApplyResult, UserProfile

logger = logging.getLogger(__name__)

BOARDS_API = 'https://boards-api.greenhouse.io/v1/boards'

# Field names Greenhouse uses for standard profile data — answer directly from profile
_FIXED_FIELDS = {
    'first_name', 'last_name', 'email', 'phone',
    'resume', 'cover_letter',              # file fields — handled separately
    'resume_text', 'cover_letter_content', # text aliases seen on some boards
}


def _parse_url(url: str) -> tuple[str, str]:
    """Extract (board_token, numeric_job_id) from a Greenhouse job URL.

    Handles both:
      https://boards.greenhouse.io/{token}/jobs/{id}
      https://job-boards.greenhouse.io/{token}/jobs/{id}
    """
    m = re.search(r'greenhouse\.io/([^/?#]+)/jobs/(\d+)', url or '')
    if not m:
        raise ValueError(f'Cannot parse Greenhouse URL: {url!r}')
    return m.group(1), m.group(2)


def apply_greenhouse(
    job: dict,
    user: UserProfile,
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    job_id = str(job.get('id', ''))
    url = job.get('url', '')
    description = job.get('description', '')

    # ── 1. Parse board token + numeric job id from URL ────────────────────
    try:
        board_token, gh_job_id = _parse_url(url)
    except ValueError as exc:
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source='greenhouse', error_message=str(exc),
        )

    # ── 2. Fetch questions ─────────────────────────────────────────────────
    questions_url = f'{BOARDS_API}/{board_token}/jobs/{gh_job_id}'
    try:
        resp = requests.get(questions_url, params={'questions': 'true'}, timeout=15)
        if resp.status_code != 200:
            return ApplyResult(
                job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
                error_message=f'Questions endpoint HTTP {resp.status_code}',
            )
        questions: list[dict] = resp.json().get('questions', [])
    except Exception as exc:
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Questions fetch error: {exc}',
        )

    logger.info(f'[greenhouse] {board_token}/{gh_job_id} — {len(questions)} questions')

    # ── 3. Build form payload ─────────────────────────────────────────────
    gpt = GPTAnswerer(gemini_api_key, user, description)
    form_data: dict[str, object] = {}
    include_resume = False
    include_cover_letter = False

    for question in questions:
        label: str = question.get('label', '')
        for field in question.get('fields', []):
            name: str = field.get('name', '')
            ftype: str = field.get('type', '')
            if not name:
                continue

            # Standard identity fields — fill directly from profile
            if name == 'first_name':
                form_data[name] = user.first_name
            elif name == 'last_name':
                form_data[name] = user.last_name
            elif name == 'email':
                form_data[name] = user.email
            elif name == 'phone':
                form_data[name] = user.phone
            elif name == 'resume':
                include_resume = True
            elif name == 'cover_letter':
                include_cover_letter = True  # skip — we don't generate cover letters here

            # Custom question types
            elif ftype in ('input_text', 'textarea'):
                form_data[name] = gpt.answer_text(label)
                logger.debug(f'[greenhouse] text "{label}" → "{form_data[name][:60]}"')

            elif ftype in ('multi_value_single_select', 'multi_value_multi_select'):
                values: list[dict] = field.get('values', [])
                if not values:
                    logger.debug(f'[greenhouse] skip "{label}" — no values list')
                    continue
                option_labels = [v.get('label', '') for v in values]
                chosen_label = gpt.answer_options(label, option_labels)
                # Greenhouse expects the numeric `value` integer, not the label string
                chosen_value = next(
                    (v['value'] for v in values if v.get('label') == chosen_label),
                    values[0]['value'],
                )
                form_data[name] = chosen_value
                logger.debug(f'[greenhouse] select "{label}" → "{chosen_label}" (value={chosen_value})')

            else:
                logger.debug(f'[greenhouse] unhandled type={ftype!r} name={name!r}')

    # ── 4. Submit application as multipart/form-data ───────────────────────
    submit_url = f'{BOARDS_API}/{board_token}/jobs/{gh_job_id}'
    try:
        files: dict = {}
        if include_resume and user.resume_pdf_bytes:
            safe_name = f'{user.first_name}_{user.last_name}_CV.pdf'.replace(' ', '_')
            files['resume'] = (safe_name, user.resume_pdf_bytes, 'application/pdf')

        resp = requests.post(
            submit_url,
            data=form_data,
            files=files if files else None,
            timeout=30,
        )
        logger.info(f'[greenhouse] POST {board_token}/{gh_job_id} → HTTP {resp.status_code}')

        if resp.status_code in (200, 201):
            return ApplyResult(
                job_id=job_id, user_id=user_id, status='success', source='greenhouse',
            )
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
            error_message=f'HTTP {resp.status_code}: {resp.text[:300]}',
        )

    except Exception as exc:
        logger.exception(f'[greenhouse] POST error: {exc}')
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source='greenhouse', error_message=str(exc),
        )
