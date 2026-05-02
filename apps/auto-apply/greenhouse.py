"""
Greenhouse auto-apply — uses the public Greenhouse Boards API.

POST https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
as multipart/form-data.  Most public boards accept unauthenticated submissions;
if the company enabled Application Form Token enforcement, the call returns 401
and a Selenium browser fallback is attempted automatically.
"""

from __future__ import annotations

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

_FIXED_FIELDS = {
    'first_name', 'last_name', 'email', 'phone',
    'resume', 'cover_letter',
    'resume_text', 'cover_letter_content',
}


def _parse_url(url: str) -> tuple[str, str]:
    """Extract (board_token, numeric_job_id) from a Greenhouse job URL."""
    m = re.search(r'greenhouse\.io/([^/?#]+)/jobs/(\d+)', url or '')
    if not m:
        raise ValueError(f'Cannot parse Greenhouse URL: {url!r}')
    return m.group(1), m.group(2)


def _get_label_for(driver, element) -> str:
    """Find the <label> text associated with a form element."""
    from selenium.webdriver.common.by import By
    try:
        el_id = element.get_attribute('id')
        if el_id:
            labels = driver.find_elements(By.CSS_SELECTOR, f'label[for="{el_id}"]')
            if labels:
                return labels[0].text.strip()
        parent = element.find_element(By.XPATH, 'ancestor::label[1]')
        return parent.text.strip()
    except Exception:
        return ''


def apply_greenhouse_browser(
    job: dict,
    user: UserProfile,
    gemini_api_key: str,
    user_id: str = '',
) -> ApplyResult:
    """Browser-based fallback for Greenhouse when the API returns 401."""
    try:
        import undetected_chromedriver as uc
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.support.ui import Select, WebDriverWait
    except ImportError as exc:
        return ApplyResult(
            job_id=str(job.get('id', '')), user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Browser fallback unavailable: {exc}',
        )

    job_id = str(job.get('id', ''))
    url = job.get('url', '')
    description = job.get('description', '')
    gpt = GPTAnswerer(gemini_api_key, user, description)

    resume_path: Optional[str] = None
    driver = None
    try:
        # Write resume to a temp file so Selenium can upload it
        if user.resume_pdf_bytes:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.pdf')
            tmp.write(user.resume_pdf_bytes)
            tmp.close()
            resume_path = tmp.name

        from webdriver_manager.chrome import ChromeDriverManager
        from selenium.webdriver.chrome.service import Service

        options = uc.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        service = Service(ChromeDriverManager().install())
        driver = uc.Chrome(options=options, driver_executable_path=service.path)
        wait = WebDriverWait(driver, 20)

        driver.get(url)
        time.sleep(3)

        # ── Scroll to the application form ────────────────────────────────────
        try:
            form = driver.find_element(
                By.XPATH,
                "//h2[contains(text(),'Apply for this job')] | //div[contains(@class,'application')]",
            )
            driver.execute_script("arguments[0].scrollIntoView();", form)
            time.sleep(1)
        except Exception:
            pass

        # ── Fill by placeholder ───────────────────────────────────────────────
        def fill_by_placeholder(placeholder: str, value: str) -> None:
            if not value:
                return
            try:
                el = driver.find_element(
                    By.XPATH,
                    f"//input[@placeholder='{placeholder}'] | //textarea[@placeholder='{placeholder}']",
                )
                el.clear()
                el.send_keys(value)
                logger.info(f"[greenhouse] filled {placeholder!r} = {value[:30]!r}")
            except Exception:
                pass

        fill_by_placeholder('First Name *', user.first_name)
        fill_by_placeholder('Last Name *', user.last_name)
        fill_by_placeholder('Email *', user.email)
        fill_by_placeholder('Phone', user.phone or '')
        fill_by_placeholder('Location (City) *', user.city or '')

        # ── Resume upload ─────────────────────────────────────────────────────
        if resume_path:
            try:
                file_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
                for fi in file_inputs:
                    try:
                        driver.execute_script(
                            "arguments[0].style.display='block';"
                            "arguments[0].style.visibility='visible';",
                            fi,
                        )
                        fi.send_keys(resume_path)
                        time.sleep(1)
                        logger.info('[greenhouse] resume uploaded')
                        break
                    except Exception:
                        pass
            except Exception:
                pass

        # ── Select dropdowns ──────────────────────────────────────────────────
        for sel_el in driver.find_elements(By.CSS_SELECTOR, 'select'):
            label_text = _get_label_for(driver, sel_el) or sel_el.get_attribute('name') or ''
            sel = Select(sel_el)
            option_texts = [o.text for o in sel.options if o.get_attribute('value')]
            if not option_texts:
                continue
            chosen = gpt.answer_options(label_text, option_texts)
            try:
                sel.select_by_visible_text(chosen)
                logger.info(f"[greenhouse] select {label_text!r} = {chosen!r}")
            except Exception:
                try:
                    sel.select_by_index(1)
                except Exception:
                    pass

        # ── Custom text/textarea fields (questions) ───────────────────────────
        known_placeholders = {
            'First Name *', 'Last Name *', 'Email *', 'Phone', 'Location (City) *',
        }
        for field in driver.find_elements(By.CSS_SELECTOR, 'input[type="text"], textarea'):
            placeholder = field.get_attribute('placeholder') or ''
            if placeholder in known_placeholders:
                continue
            if (field.get_attribute('value') or '').strip():
                continue  # already filled
            label_text = placeholder or _get_label_for(driver, field) or ''
            if not label_text:
                continue
            answer = gpt.answer_text(label_text)
            try:
                field.clear()
                field.send_keys(answer)
                logger.info(f"[greenhouse] custom field {label_text!r} = {answer[:30]!r}")
            except Exception:
                pass

        # ── Guard: required fields must be filled ─────────────────────────────
        missing = []
        for placeholder, label in (
            ('First Name *', 'first_name'),
            ('Email *', 'email'),
        ):
            try:
                el = driver.find_element(
                    By.XPATH, f"//input[@placeholder='{placeholder}']"
                )
                val = (el.get_attribute('value') or '').strip()
                logger.info(f'[greenhouse] {label} value: {val!r}')
                if not val:
                    missing.append(label)
            except Exception:
                pass
        if missing:
            return ApplyResult(
                job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
                error_message=f'Form fields not filled: {", ".join(missing)}',
            )

        # ── Submit ────────────────────────────────────────────────────────────
        try:
            try:
                submit_btn = driver.find_element(
                    By.XPATH, "//button[contains(., 'Submit application')]"
                )
            except Exception:
                try:
                    submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
                except Exception:
                    submit_btn = driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", submit_btn)
            time.sleep(1)
            driver.execute_script("arguments[0].click();", submit_btn)
            time.sleep(5)
        except Exception as exc:
            return ApplyResult(
                job_id=job_id, user_id=user_id, status='failed',
                source='greenhouse', error_message=f'Submit click failed: {exc}',
            )

        # ── Post-submit debug + confirmation ──────────────────────────────────
        driver.save_screenshot('debug_submit.png')
        logger.info(f'[greenhouse] post-submit URL: {driver.current_url}')
        logger.info(f'[greenhouse] post-submit page: {driver.page_source[:1000]}')

        page = driver.page_source.lower()
        confirmed = any(kw in page for kw in (
            'thank', 'obrigado', 'submitted', 'received', 'confirmation',
        ))
        logger.info(f'[greenhouse] browser submit confirmed={confirmed}')

        if confirmed:
            return ApplyResult(job_id=job_id, user_id=user_id, status='success', source='greenhouse')
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed', source='greenhouse',
            error_message='No confirmation message found after browser submit',
        )

    except Exception as exc:
        logger.exception(f'[greenhouse] browser fallback error: {exc}')
        return ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source='greenhouse', error_message=f'Browser error: {exc}',
        )
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        if resume_path:
            try:
                os.unlink(resume_path)
            except Exception:
                pass


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
                pass  # skip — not generated here

            elif ftype in ('input_text', 'textarea'):
                form_data[name] = gpt.answer_text(label)
                logger.debug(f'[greenhouse] text "{label}" → "{form_data[name][:60]}"')

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

        # ── 401 → browser fallback ─────────────────────────────────────────
        if resp.status_code == 401:
            logger.warning(f'[greenhouse] 401 on {board_token}/{gh_job_id} — trying browser fallback')
            return apply_greenhouse_browser(job, user, gemini_api_key, user_id)

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
