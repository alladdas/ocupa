"""
Greenhouse auto-apply.

Primary path  : POST multipart via Greenhouse Boards API.
Fallback (401): Visual agent — Claude Vision + Playwright headless.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
from typing import Optional

import requests

from gpt_answerer import GPTAnswerer
from models import ApplyResult, UserProfile

logger = logging.getLogger(__name__)

BOARDS_API = 'https://boards-api.greenhouse.io/v1/boards'

# ── Prompts ───────────────────────────────────────────────────────────────────

_USER_CONTEXT = """\
Candidato: {first_name} {last_name}
Email: {email}
Telefone: {phone}
Cidade: {city}
País: Brasil
LinkedIn: {linkedin}
Brasileiro, latino (Hispanic/Latino = Yes)
Não tem autorização para trabalhar nos EUA sem visto
"""

_ACTION_PROMPT = """\
Você é um agente que preenche formulários de candidatura de emprego.

{user_context}
Currículo: arquivo PDF disponível em {resume_path}

Analise o screenshot e retorne UMA ação em JSON:
{{"action": "click", "selector": "css_selector_aqui"}}
{{"action": "type", "selector": "css_selector_aqui", "text": "texto_aqui"}}
{{"action": "select", "selector": "css_selector_aqui", "value": "opcao_aqui"}}
{{"action": "upload", "selector": "input[type=file]", "path": "{resume_path}"}}
{{"action": "scroll", "direction": "down"}}
{{"action": "done", "status": "success"}}
{{"action": "done", "status": "failed", "reason": "motivo"}}

Regras:
- Preencha todos os campos obrigatórios (marcados com *)
- Para dropdowns React Select: clique em div.select__control para abrir, depois clique em div.select__option
- Após preencher tudo, clique em Submit
- Se vir confirmação (thank you / obrigado / submitted), retorne done/success
- Se não conseguir avançar após 3 tentativas no mesmo estado, retorne done/failed
- Responda APENAS com o JSON, sem explicações

Estado atual — passo {step}/{max_steps} | URL: {url}
"""


# ── URL parser ────────────────────────────────────────────────────────────────

def _parse_url(url: str) -> tuple[str, str]:
    """Extract (board_token, numeric_job_id) from a Greenhouse job URL."""
    m = re.search(r'greenhouse\.io/([^/?#]+)/jobs/(\d+)', url or '')
    if not m:
        raise ValueError(f'Cannot parse Greenhouse URL: {url!r}')
    return m.group(1), m.group(2)


# ── API path ──────────────────────────────────────────────────────────────────

def _try_greenhouse_api(
    job: dict,
    user: UserProfile,
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    """Submit via Greenhouse Boards API. Returns HTTP 401 in error_message on auth failure."""
    job_id = str(job.get('id', ''))
    url = job.get('url', '')
    description = job.get('description', '')

    try:
        board_token, gh_job_id = _parse_url(url)
    except ValueError as exc:
        return ApplyResult(job_id=job_id, user_id=user_id, status='failed',
                           source='greenhouse', error_message=str(exc))

    questions_url = f'{BOARDS_API}/{board_token}/jobs/{gh_job_id}'
    try:
        resp = requests.get(questions_url, params={'questions': 'true'}, timeout=15)
        if resp.status_code != 200:
            return ApplyResult(job_id=job_id, user_id=user_id, status='failed',
                               source='greenhouse',
                               error_message=f'Questions endpoint HTTP {resp.status_code}')
        questions: list[dict] = resp.json().get('questions', [])
    except Exception as exc:
        return ApplyResult(job_id=job_id, user_id=user_id, status='failed',
                           source='greenhouse', error_message=f'Questions fetch error: {exc}')

    logger.info(f'[greenhouse] {board_token}/{gh_job_id} — {len(questions)} questions')

    gpt = GPTAnswerer(gemini_api_key, user, description)
    form_data: dict[str, object] = {}
    include_resume = False

    for question in questions:
        label: str = question.get('label', '')
        for field in question.get('fields', []):
            name: str = field.get('name', '')
            ftype: str = field.get('type', '')
            if not name:
                continue
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
                pass
            elif ftype in ('input_text', 'textarea'):
                form_data[name] = gpt.answer_text(label)
                logger.debug(f'[greenhouse] text "{label}" → "{str(form_data[name])[:60]}"')
            elif ftype in ('multi_value_single_select', 'multi_value_multi_select'):
                values: list[dict] = field.get('values', [])
                if not values:
                    continue
                option_labels = [v.get('label', '') for v in values]
                chosen_label = gpt.answer_options(label, option_labels)
                chosen_value = next(
                    (v['value'] for v in values if v.get('label') == chosen_label),
                    values[0]['value'],
                )
                form_data[name] = chosen_value

    submit_url = f'{BOARDS_API}/{board_token}/jobs/{gh_job_id}'
    try:
        files: dict = {}
        if include_resume and user.resume_pdf_bytes:
            safe_name = f'{user.first_name}_{user.last_name}_CV.pdf'.replace(' ', '_')
            files['resume'] = (safe_name, user.resume_pdf_bytes, 'application/pdf')

        resp = requests.post(submit_url, data=form_data,
                             files=files if files else None, timeout=30)
        logger.info(f'[greenhouse] POST {board_token}/{gh_job_id} → HTTP {resp.status_code}')

        if resp.status_code in (200, 201):
            return ApplyResult(job_id=job_id, user_id=user_id, status='success',
                               source='greenhouse')
        return ApplyResult(job_id=job_id, user_id=user_id, status='failed',
                           source='greenhouse',
                           error_message=f'HTTP {resp.status_code}: {resp.text[:300]}')
    except Exception as exc:
        return ApplyResult(job_id=job_id, user_id=user_id, status='failed',
                           source='greenhouse', error_message=str(exc))


# ── Visual agent ──────────────────────────────────────────────────────────────

def _run_visual_agent(
    job: dict,
    user: UserProfile,
    user_id: str = '',
) -> ApplyResult:
    """Claude Vision + Playwright headless agent."""
    try:
        import anthropic
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return ApplyResult(
            job_id=str(job.get('id', '')), user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Agent dependencies unavailable: {exc}',
        )

    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    if not api_key:
        return ApplyResult(
            job_id=str(job.get('id', '')), user_id=user_id, status='failed',
            source='greenhouse', error_message='ANTHROPIC_API_KEY not set',
        )

    job_id = str(job.get('id', ''))
    url = job.get('url', '')

    user_context = _USER_CONTEXT.format(
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone or '+55 11 99999-9999',
        city=user.city or 'São Paulo',
        linkedin=user.linkedin_url or '',
    )

    resume_path: Optional[str] = None
    try:
        if user.resume_pdf_bytes:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            tmp.write(user.resume_pdf_bytes)
            tmp.close()
            resume_path = tmp.name
    except Exception as exc:
        logger.warning(f'[agent] resume temp file error: {exc}')

    client = anthropic.Anthropic(api_key=api_key)
    max_steps = 20

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.goto(url)
            page.wait_for_load_state('networkidle')

            for step in range(1, max_steps + 1):
                screenshot_b64 = base64.b64encode(
                    page.screenshot(full_page=False)
                ).decode()

                prompt_text = _ACTION_PROMPT.format(
                    user_context=user_context,
                    resume_path=resume_path or '',
                    step=step,
                    max_steps=max_steps,
                    url=page.url,
                )

                response = client.messages.create(
                    model='claude-sonnet-4-5',
                    max_tokens=1024,
                    messages=[{
                        'role': 'user',
                        'content': [
                            {
                                'type': 'image',
                                'source': {
                                    'type': 'base64',
                                    'media_type': 'image/png',
                                    'data': screenshot_b64,
                                },
                            },
                            {'type': 'text', 'text': prompt_text},
                        ],
                    }],
                )

                action_text = response.content[0].text.strip()
                logger.info(f'[agent] step {step} response: {action_text[:200]}')

                json_match = re.search(r'\{.*\}', action_text, re.DOTALL)
                if not json_match:
                    logger.warning(f'[agent] step {step}: no JSON in response')
                    continue

                try:
                    action = json.loads(json_match.group())
                except json.JSONDecodeError as exc:
                    logger.warning(f'[agent] step {step}: JSON parse error: {exc}')
                    continue

                logger.info(f'[agent] step {step}: {action}')
                act = action.get('action', '')

                if act == 'done':
                    browser.close()
                    status = 'success' if action.get('status') == 'success' else 'failed'
                    return ApplyResult(
                        job_id=job_id, user_id=user_id, status=status, source='greenhouse',
                        error_message=action.get('reason') if status == 'failed' else None,
                    )

                elif act == 'click':
                    try:
                        page.click(action['selector'], timeout=5000)
                        page.wait_for_timeout(500)
                    except Exception as exc:
                        logger.warning(f'[agent] click failed: {exc}')

                elif act == 'type':
                    try:
                        page.fill(action['selector'], action['text'])
                    except Exception as exc:
                        logger.warning(f'[agent] type failed: {exc}')

                elif act == 'select':
                    try:
                        page.select_option(action['selector'], action['value'])
                    except Exception as exc:
                        logger.warning(f'[agent] select failed: {exc}')

                elif act == 'upload':
                    try:
                        path = action.get('path') or resume_path or ''
                        page.set_input_files(action['selector'], path)
                    except Exception as exc:
                        logger.warning(f'[agent] upload failed: {exc}')

                elif act == 'scroll':
                    page.evaluate('window.scrollBy(0, 500)')
                    page.wait_for_timeout(500)

            browser.close()
            return ApplyResult(
                job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
                error_message='Max steps reached without completion',
            )

    except Exception as exc:
        logger.exception(f'[agent] unhandled error: {exc}')
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Agent error: {exc}',
        )
    finally:
        if resume_path:
            try:
                os.unlink(resume_path)
            except Exception:
                pass


# ── Public entry point ────────────────────────────────────────────────────────

def apply_with_agent(
    job: dict,
    user: UserProfile,
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    """Try Greenhouse API; fall back to Claude Vision agent on 401."""
    result = _try_greenhouse_api(job, user, gemini_api_key, user_id)
    if result.status == 'success':
        return result

    if '401' in (result.error_message or ''):
        logger.warning(f'[greenhouse] API 401 — launching visual agent')
        return _run_visual_agent(job, user, user_id)

    return result
