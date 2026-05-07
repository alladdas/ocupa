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

IMPORTANTE: O formulário de candidatura já está visível na página abaixo da descrição \
da vaga. NÃO procure um botão Apply para clicar. Role a página para baixo até ver \
"Apply for this job" e comece a preencher os campos diretamente.

Campos a preencher em ordem:
1. First Name → {first_name}
2. Last Name → {last_name}
3. Email → {email}
4. Phone → {phone}
5. Country → Brazil (dropdown)
6. Location (City) → {city} (autocomplete — clique na primeira sugestão)
7. Resume → fazer upload do arquivo PDF em {resume_path}
8. Todos os outros campos obrigatórios marcados com (*)
9. Clicar em "Submit application"

Para dropdowns: use action "click" no elemento para abrir, depois "click" na opção desejada.
Para upload: use action "upload" com o path do PDF.

Para o campo Country (React Select com id #country):
1. Use "click" em #country para abrir o dropdown
2. Use "type" em #country com texto "Brazil" para filtrar
3. Use "key" com key "Enter" para confirmar a seleção
Exemplo: {{"action": "key", "key": "Enter"}}

{user_context}

Analise o screenshot e retorne UMA ação em JSON:
{{"action": "click", "selector": "css_selector_aqui"}}
{{"action": "type", "selector": "css_selector_aqui", "text": "texto_aqui"}}
{{"action": "select", "selector": "css_selector_aqui", "value": "opcao_aqui"}}
{{"action": "upload", "selector": "input[type=file]", "path": "{resume_path}"}}
{{"action": "scroll", "direction": "down"}}
{{"action": "key", "key": "Enter"}}
{{"action": "done", "status": "success"}}
{{"action": "done", "status": "failed", "reason": "motivo"}}

IMPORTANTE: Assim que você tiver preenchido os campos obrigatórios (marcados com *), \
submeta o formulário imediatamente clicando em "Submit application". \
NÃO espere preencher campos opcionais. \
Se um campo não obrigatório falhar, ignore e continue para o submit. \
Use: {{"action": "click", "selector": "button[type=submit]"}} ou \
{{"action": "click", "selector": "text=Submit application"}}

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

def _convert_selector(selector: str) -> str:
    """Convert :has-text() pseudo-class to Playwright text= selector."""
    m = re.search(r":has-text\('([^']+)'\)", selector)
    if m:
        return f"text={m.group(1)}"
    m = re.search(r':has-text\("([^"]+)"\)', selector)
    if m:
        return f"text={m.group(1)}"
    return selector


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
    max_steps = 80
    action_history: list[str] = []
    consecutive_scrolls = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False, slow_mo=500)
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.goto(url)
            page.wait_for_load_state('networkidle')

            for step in range(1, max_steps + 1):
                screenshot_b64 = base64.b64encode(
                    page.screenshot(full_page=False)
                ).decode()

                try:
                    inputs_html = page.evaluate("""() => {
                        const els = document.querySelectorAll(
                            'input, select, textarea, button[type="submit"]');
                        return Array.from(els).slice(0, 30).map(el => ({
                            tag: el.tagName,
                            type: el.type || '',
                            name: el.name || '',
                            id: el.id || '',
                            placeholder: el.placeholder || '',
                            cls: el.className.substring(0, 50)
                        }));
                    }""")
                except Exception:
                    inputs_html = []

                prompt_text = _ACTION_PROMPT.format(
                    first_name=user.first_name,
                    last_name=user.last_name,
                    email=user.email,
                    phone=user.phone or '11999999999',
                    city=user.city or 'São Paulo',
                    user_context=user_context,
                    resume_path=resume_path or '',
                    step=step,
                    max_steps=max_steps,
                    url=page.url,
                )
                prompt_text += f'\n\nELEMENTOS DISPONÍVEIS NA PÁGINA:\n{json.dumps(inputs_html, indent=2)}'
                if action_history:
                    prompt_text += '\n\nHISTÓRICO DAS ÚLTIMAS AÇÕES:\n' + '\n'.join(action_history[-5:])

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
                sel = _convert_selector(action.get('selector', ''))

                if act == 'done':
                    if action.get('status') == 'success':
                        page_text = page.content().lower()
                        confirmed = any(kw in page_text for kw in (
                            'thank', 'obrigado', 'submitted', 'received', 'application',
                        ))
                        if confirmed:
                            browser.close()
                            return ApplyResult(
                                job_id=job_id, user_id=user_id, status='success',
                                source='greenhouse',
                            )
                        else:
                            logger.warning('[agent] done/success declared but no confirmation found')
                            action_history.append(
                                '✗ done/success rejeitado — nenhuma confirmação na página'
                            )
                            continue
                    browser.close()
                    return ApplyResult(
                        job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
                        error_message=action.get('reason') or 'Agent declared failure',
                    )

                elif act == 'click':
                    try:
                        page.click(sel, timeout=5000)
                        page.wait_for_timeout(500)
                        action_history.append(f'✓ click {sel}')
                    except Exception as exc:
                        action_history.append(f'✗ click {sel} FALHOU: {str(exc)[:80]}')
                        logger.warning(f'[agent] click failed: {exc}')

                elif act == 'type':
                    text = action.get('text', '')
                    success = False
                    try:
                        page.fill(sel, text, timeout=5000)
                        success = True
                    except Exception:
                        try:
                            page.locator(sel).fill(text, timeout=5000)
                            success = True
                        except Exception as exc:
                            logger.warning(f'[agent] type failed: {exc}')
                    action_history.append(
                        f"✓ type {sel} = {text[:30]!r}" if success
                        else f'✗ type {sel} FALHOU'
                    )

                elif act == 'select':
                    try:
                        page.select_option(sel, action['value'])
                        action_history.append(f"✓ select {sel} = {action['value']!r}")
                    except Exception as exc:
                        action_history.append(f'✗ select {sel} FALHOU')
                        logger.warning(f'[agent] select failed: {exc}')

                elif act == 'upload':
                    try:
                        path = action.get('path') or resume_path or ''
                        page.set_input_files(sel, path)
                        action_history.append(f'✓ upload {sel}')
                    except Exception as exc:
                        action_history.append(f'✗ upload {sel} FALHOU')
                        logger.warning(f'[agent] upload failed: {exc}')

                elif act == 'key':
                    key = action.get('key', 'Enter')
                    page.keyboard.press(key)
                    page.wait_for_timeout(300)
                    action_history.append(f'✓ key {key}')
                    consecutive_scrolls = 0

                elif act == 'scroll':
                    page.evaluate('window.scrollBy(0, 500)')
                    page.wait_for_timeout(500)
                    action_history.append('✓ scroll down')
                    consecutive_scrolls += 1
                    if consecutive_scrolls >= 5:
                        action_history.append(
                            'ATENÇÃO: Você está em loop de scroll. '
                            'Pare de rolar e tente preencher um campo específico ou submeter o formulário.'
                        )
                        consecutive_scrolls = 0
                    continue

                if act != 'scroll':
                    consecutive_scrolls = 0

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
