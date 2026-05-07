"""
Greenhouse auto-apply.

Primary path  : POST multipart via Greenhouse Boards API.
Fallback (401): Visual agent — Gemini Vision + Playwright headless.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import time
from typing import Optional

import requests

from gpt_answerer import GPTAnswerer
from models import ApplyResult, UserProfile

logger = logging.getLogger(__name__)

BOARDS_API = 'https://boards-api.greenhouse.io/v1/boards'


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
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    """Gemini Vision + Playwright headless agent."""
    try:
        import io as _io
        import PIL.Image
        from google import genai as _genai
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return ApplyResult(
            job_id=str(job.get('id', '')), user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Agent dependencies unavailable: {exc}',
        )

    if not gemini_api_key:
        return ApplyResult(
            job_id=str(job.get('id', '')), user_id=user_id, status='failed',
            source='greenhouse', error_message='GEMINI_API_KEY not set',
        )

    job_id = str(job.get('id', ''))
    url = job.get('url', '')

    resume_path: Optional[str] = None
    try:
        if user.resume_pdf_bytes:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            tmp.write(user.resume_pdf_bytes)
            tmp.close()
            resume_path = tmp.name
    except Exception as exc:
        logger.warning(f'[agent] resume temp file error: {exc}')

    gemini = _genai.Client(api_key=gemini_api_key)
    max_steps = 80
    action_history: list[str] = []
    consecutive_scrolls = 0
    state: dict = {'fields_filled': [], 'fields_failed': [], 'submitted': False}

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(viewport={'width': 1280, 'height': 900})
            page.goto(url)
            page.wait_for_load_state('domcontentloaded')
            time.sleep(2)

            for step in range(1, max_steps + 1):
                screenshot_bytes = page.screenshot(full_page=False)
                img = PIL.Image.open(_io.BytesIO(screenshot_bytes))

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

                prompt_text = (
                    f'Você é um agente que preenche formulários de candidatura de emprego.\n\n'
                    f'IMPORTANTE: O formulário de candidatura já está visível na página abaixo da descrição '
                    f'da vaga. NÃO procure um botão Apply para clicar. Role a página para baixo até ver '
                    f'"Apply for this job" e comece a preencher os campos diretamente.\n\n'
                    f'PERFIL DO CANDIDATO (use para responder QUALQUER pergunta):\n'
                    f'Nome completo: {user.first_name} {user.last_name}\n'
                    f'Como prefere ser chamado: {user.first_name}\n'
                    f'Email: {user.email}\n'
                    f'Telefone: {user.phone or "11999999999"}\n'
                    f'Cidade: {user.city or "São Paulo"}, Brasil\n'
                    f'LinkedIn: {user.linkedin_url or ""}\n'
                    f'Senioridade: {user.seniority or "Pleno"}\n'
                    f'Modelo preferido: {user.work_model_preference or "Híbrido"}\n'
                    f'Gênero: {user.gender or "Prefiro não informar"}\n'
                    f'Raça/Cor: {user.race or "Prefiro não informar"}\n'
                    f'Nacionalidade: Brasileiro\n'
                    f'É latino/hispânico: Sim\n'
                    f'PCD: Não\n'
                    f'Veterano: Não (não aplicável no Brasil)\n'
                    f'Autorização para trabalhar no Brasil: Sim\n'
                    f'Autorização para trabalhar nos EUA: Não (precisaria de visto)\n'
                    f'Trecho do currículo: {user.resume_text[:1500] if user.resume_text else ""}\n\n'
                    f'Para perguntas como:\n'
                    f'- "Como prefere ser chamado?" → {user.first_name}\n'
                    f'- "Conte sobre você" → use o currículo acima\n'
                    f'- "Por que quer trabalhar aqui?" → mencione crescimento profissional e alinhamento com a empresa\n'
                    f'- "Qual sua pretensão salarial?" → "A combinar"\n'
                    f'- "Disponibilidade para início?" → "Imediata"\n'
                    f'- Campos de texto livre → máximo 2-3 frases, profissional e direto\n\n'
                    f'ESTADO:\n'
                    f'Já preenchido: {state["fields_filled"][-10:]}\n'
                    f'Falharam: {state["fields_failed"]}\n\n'
                    f'Se campo já está em "Já preenchido", PULE-O e vá para o próximo.\n'
                    f'Se todos obrigatórios (*) preenchidos, submeta o formulário.\n\n'
                    f'Campos a preencher em ordem:\n'
                    f'1. First Name → {user.first_name}\n'
                    f'2. Last Name → {user.last_name}\n'
                    f'3. Email → {user.email}\n'
                    f'4. Phone → {user.phone or "11999999999"}\n'
                    f'5. Country → Brazil (dropdown)\n'
                    f'6. Location (City) → {user.city or "São Paulo"} (autocomplete — clique na primeira sugestão)\n'
                    f'7. Resume → fazer upload do arquivo PDF em {resume_path}\n'
                    f'8. Todos os outros campos obrigatórios marcados com (*)\n'
                    f'9. Clicar em "Submit application"\n\n'
                    f'Para dropdowns: use action "click" no elemento para abrir, depois "click" na opção desejada.\n'
                    f'Para upload: use action "upload" com o path do PDF.\n\n'
                    f'Para o campo Country (React Select com id #country):\n'
                    f'1. Use "click" em #country para abrir o dropdown\n'
                    f'2. Use "type" em #country com texto "Brazil" para filtrar\n'
                    f'3. Use "key" com key "Enter" para confirmar a seleção\n\n'
                    f'Analise o screenshot e retorne UMA ação em JSON:\n'
                    f'{{"action": "click", "selector": "css_selector_aqui"}}\n'
                    f'{{"action": "type", "selector": "css_selector_aqui", "text": "texto_aqui"}}\n'
                    f'{{"action": "select", "selector": "css_selector_aqui", "value": "opcao_aqui"}}\n'
                    f'{{"action": "upload", "selector": "input[type=file]", "path": "{resume_path}"}}\n'
                    f'{{"action": "scroll", "direction": "down"}}\n'
                    f'{{"action": "key", "key": "Enter"}}\n'
                    f'{{"action": "done", "status": "success"}}\n'
                    f'{{"action": "done", "status": "failed", "reason": "motivo"}}\n\n'
                    f'IMPORTANTE: Assim que você tiver preenchido os campos obrigatórios (marcados com *), '
                    f'submeta o formulário imediatamente clicando em "Submit application". '
                    f'NÃO espere preencher campos opcionais. '
                    f'Se um campo não obrigatório falhar, ignore e continue para o submit.\n\n'
                    f'Regras:\n'
                    f'- Preencha todos os campos obrigatórios (marcados com *)\n'
                    f'- Para dropdowns React Select: clique em div.select__control para abrir, depois clique em div.select__option\n'
                    f'- Após preencher tudo, clique em Submit\n'
                    f'- Se vir confirmação (thank you / obrigado / submitted), retorne done/success\n'
                    f'- Se não conseguir avançar após 3 tentativas no mesmo estado, retorne done/failed\n'
                    f'- Responda APENAS com o JSON, sem explicações\n\n'
                    f'Estado atual — passo {step}/{max_steps} | URL: {page.url}\n\n'
                    f'ELEMENTOS DISPONÍVEIS NA PÁGINA:\n{json.dumps(inputs_html, indent=2)}'
                )
                if action_history:
                    prompt_text += '\n\nHISTÓRICO DAS ÚLTIMAS AÇÕES:\n' + '\n'.join(action_history[-5:])

                response = gemini.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[img, prompt_text],
                )
                action_text = response.text.strip()
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
                    if success:
                        action_history.append(f'✓ type {sel} = {text[:30]!r}')
                        state['fields_filled'].append(sel)
                    else:
                        action_history.append(f'✗ type {sel} FALHOU')
                        state['fields_failed'].append(sel)

                elif act == 'select':
                    try:
                        page.select_option(sel, action['value'])
                        action_history.append(f"✓ select {sel} = {action['value']!r}")
                        state['fields_filled'].append(sel)
                    except Exception as exc:
                        action_history.append(f'✗ select {sel} FALHOU')
                        state['fields_failed'].append(sel)
                        logger.warning(f'[agent] select failed: {exc}')

                elif act == 'upload':
                    try:
                        path = action.get('path') or resume_path or ''
                        page.set_input_files(sel, path)
                        action_history.append(f'✓ upload {sel}')
                        state['fields_filled'].append(sel)
                    except Exception as exc:
                        action_history.append(f'✗ upload {sel} FALHOU')
                        state['fields_failed'].append(sel)
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
    """Try Greenhouse API; fall back to Gemini Vision agent on 401."""
    result = _try_greenhouse_api(job, user, gemini_api_key, user_id)
    if result.status == 'success':
        return result

    if '401' in (result.error_message or ''):
        logger.warning(f'[greenhouse] API 401 — launching visual agent')
        return _run_visual_agent(job, user, gemini_api_key, user_id)

    return result
