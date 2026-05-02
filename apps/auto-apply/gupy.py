"""
Gupy auto-apply — uses the Gupy public portal API.

Questions: GET  https://employability-portal.gupy.io/api/v1/jobs/{id}
           (same endpoint the scraper uses; applicationQuestions nested under applicationForm)

Submit:    POST https://portal.api.gupy.io/api/v1/jobs/{id}/apply
           Content-Type: application/json

If Gupy starts requiring authentication the submit call returns 401 and
status='failed' is propagated to the caller.
"""

from __future__ import annotations

import base64
import logging
import re

import requests

from gpt_answerer import GPTAnswerer
from models import ApplyResult, UserProfile

logger = logging.getLogger(__name__)

PORTAL_API = 'https://employability-portal.gupy.io/api/v1'
APPLY_API  = 'https://portal.api.gupy.io/api/v1'

# Gupy question types that map to each answerer method
_TEXT_TYPES   = {'text', 'textarea', 'string'}
_NUMBER_TYPES = {'number', 'integer', 'numeric'}
_CHOICE_TYPES = {'radio', 'select', 'dropdown', 'checkbox', 'boolean'}
_FILE_TYPES   = {'file', 'upload'}


def _extract_job_id(url: str, db_id: str) -> str:
    """
    Prefer numeric ID from URL path; fall back to whatever is stored in DB.

    Handles:
      https://{company}.gupy.io/jobs/{id}
      https://portal.gupy.io/job-offer/{id}
    """
    m = re.search(r'/jobs?(?:-offer)?/(\d+)', url or '')
    if m:
        return m.group(1)
    # db_id might be a plain numeric string already
    if re.fullmatch(r'\d+', db_id):
        return db_id
    return db_id


def apply_gupy(
    job: dict,
    user: UserProfile,
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    db_job_id = str(job.get('id', ''))
    url = job.get('url', '')
    description = job.get('description', '')
    gupy_id = _extract_job_id(url, db_job_id)

    # ── 1. Fetch job + application questions ──────────────────────────────
    try:
        resp = requests.get(f'{PORTAL_API}/jobs/{gupy_id}', timeout=15)
        if resp.status_code != 200:
            return ApplyResult(
                job_id=db_job_id, user_id=user_id, status='failed', source='gupy',
                error_message=f'Job fetch HTTP {resp.status_code}',
            )
        job_data = resp.json()
    except Exception as exc:
        return ApplyResult(
            job_id=db_job_id, user_id=user_id, status='failed',
            source='gupy', error_message=f'Job fetch error: {exc}',
        )

    # applicationQuestions may live at different nesting levels
    app_form = job_data.get('applicationForm') or {}
    questions: list[dict] = (
        app_form.get('applicationQuestions')
        or job_data.get('applicationQuestions')
        or []
    )

    # Use the description from DB if the API returns none
    if not description:
        description = job_data.get('description', '')

    logger.info(f'[gupy] job {gupy_id} — {len(questions)} application questions')

    # ── 2. Generate answers ───────────────────────────────────────────────
    gpt = GPTAnswerer(gemini_api_key, user, description)
    answers: list[dict] = []

    for q in questions:
        q_id = q.get('id') or q.get('questionId')
        q_text: str = q.get('question') or q.get('label') or ''
        q_type: str = (q.get('type') or '').lower()
        options: list[str] = q.get('options') or q.get('choices') or []

        if not q_id or not q_text:
            continue

        if q_type in _TEXT_TYPES or not q_type:
            answer = gpt.answer_text(q_text)
            logger.debug(f'[gupy] text "{q_text[:50]}" → "{answer[:50]}"')

        elif q_type in _NUMBER_TYPES:
            answer = str(gpt.answer_numeric(q_text))
            logger.debug(f'[gupy] numeric "{q_text[:50]}" → {answer}')

        elif q_type in _CHOICE_TYPES:
            if not options:
                answer = gpt.answer_text(q_text)
            else:
                answer = gpt.answer_options(q_text, options)
            logger.debug(f'[gupy] choice "{q_text[:50]}" → "{answer}"')

        elif q_type in _FILE_TYPES:
            continue  # resume handled separately below

        else:
            answer = gpt.answer_text(q_text)
            logger.debug(f'[gupy] fallback type={q_type!r} "{q_text[:50]}" → "{answer[:50]}"')

        answers.append({'questionId': str(q_id), 'answer': answer})

    # ── 3. Submit application ─────────────────────────────────────────────
    body: dict = {
        'candidate': {
            'name': user.full_name,
            'email': user.email,
            'cellPhone': user.phone,
        },
        'answers': answers,
    }

    if user.resume_pdf_bytes:
        body['resumeData'] = {
            'content': base64.b64encode(user.resume_pdf_bytes).decode(),
            'name': f'{user.first_name}_{user.last_name}_CV.pdf'.replace(' ', '_'),
            'type': 'application/pdf',
        }

    try:
        resp = requests.post(
            f'{APPLY_API}/jobs/{gupy_id}/apply',
            json=body,
            timeout=30,
        )
        logger.info(f'[gupy] POST /jobs/{gupy_id}/apply → HTTP {resp.status_code}')

        if resp.status_code in (200, 201):
            return ApplyResult(
                job_id=db_job_id, user_id=user_id, status='success', source='gupy',
            )
        return ApplyResult(
            job_id=db_job_id, user_id=user_id, status='failed', source='gupy',
            error_message=f'HTTP {resp.status_code}: {resp.text[:300]}',
        )

    except Exception as exc:
        logger.exception(f'[gupy] POST error: {exc}')
        return ApplyResult(
            job_id=db_job_id, user_id=user_id, status='failed',
            source='gupy', error_message=str(exc),
        )
