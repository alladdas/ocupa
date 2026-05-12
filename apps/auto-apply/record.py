"""
Template recorder for auto-apply.

Usage:
  python record.py --company c6bank \
    --url "https://job-boards.greenhouse.io/c6bank/jobs/4688188005"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# Injected into the page to capture all user interactions
_RECORDER_JS = r"""
(function () {
    if (window._recorder && window._recorder.recording) return;

    window._recorder = { steps: [], recording: true };

    function getLabel(el) {
        if (el.id) {
            const lbl = document.querySelector('label[for="' + el.id + '"]');
            if (lbl) return lbl.textContent.trim();
        }
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
        if (aria) return aria;
        const ancestor = el.closest('label');
        if (ancestor) return ancestor.textContent.trim();
        let prev = el.previousElementSibling;
        while (prev) {
            if (prev.tagName === 'LABEL') return prev.textContent.trim();
            prev = prev.previousElementSibling;
        }
        return '';
    }

    function getSelector(el) {
        if (el.id) return '#' + CSS.escape(el.id);
        if (el.name) return '[name="' + el.name + '"]';
        // Fallback: nth-of-type path up to body
        const parts = [];
        let node = el;
        while (node && node !== document.body && node.tagName) {
            let idx = 1;
            let sib = node.previousElementSibling;
            while (sib) {
                if (sib.tagName === node.tagName) idx++;
                sib = sib.previousElementSibling;
            }
            parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + idx + ')');
            node = node.parentElement;
        }
        return parts.join(' > ');
    }

    function guessFieldName(el) {
        const id   = (el.id || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const ph   = (el.placeholder || '').toLowerCase();
        const lbl  = getLabel(el).toLowerCase();
        const all  = id + ' ' + name + ' ' + ph + ' ' + lbl;

        if (/first[_\s]?name|primeiro[_\s]?nome|firstname/.test(all))  return 'first_name';
        if (/last[_\s]?name|sobrenome|lastname/.test(all))              return 'last_name';
        if (/email/.test(all))                                           return 'email';
        if (/phone|telefone|celular|mobile/.test(all))                   return 'phone';
        if (/linkedin/.test(all))                                        return 'linkedin_url';
        if (/city|cidade|location|localiza/.test(all))                   return 'city';
        if (/ra[cç]a|cor|etnia/.test(all))                              return 'race';
        if (/g[eê]nero|gender/.test(all))                               return 'gender';
        if (/defici[eê]ncia|pcd/.test(all))                             return 'is_pcd';
        if (/seniority|senioridade|n[ií]vel/.test(all))                 return 'seniority';
        if (/work[_\s]?model|modelo[_\s]?de[_\s]?trabalho/.test(all))  return 'work_model';
        return 'custom_' + (el.id || el.name || 'field').replace(/[^a-zA-Z0-9_]/g, '_');
    }

    // text / textarea — fires on every keystroke; deduped at collection time
    document.addEventListener('input', function (e) {
        if (!window._recorder.recording) return;
        const el = e.target;
        if (!el || !el.tagName) return;
        const tag = el.tagName.toUpperCase();
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
        if (el.type === 'file') return;

        const fn = guessFieldName(el);
        window._recorder.steps.push({
            action:     'type',
            selector:   getSelector(el),
            label:      getLabel(el),
            value:      '{{' + fn + '}}',
            example:    el.value,
            field_name: fn,
        });
    }, true);

    // select + checkbox/radio + file upload
    document.addEventListener('change', function (e) {
        if (!window._recorder.recording) return;
        const el = e.target;
        if (!el || !el.tagName) return;
        const tag = el.tagName.toUpperCase();

        if (tag === 'SELECT') {
            const fn = guessFieldName(el);
            window._recorder.steps.push({
                action:     'select',
                selector:   getSelector(el),
                label:      getLabel(el),
                value:      el.value,
                example:    el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value,
                field_name: fn,
            });
            return;
        }

        if (tag === 'INPUT' && el.type === 'file') {
            window._recorder.steps.push({
                action:   'upload',
                selector: getSelector(el),
                label:    getLabel(el),
                value:    '{{resume_pdf_path}}',
                example:  el.files && el.files[0] ? el.files[0].name : '',
            });
            return;
        }

        if (tag === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
            window._recorder.steps.push({
                action:   'click',
                selector: getSelector(el),
                label:    getLabel(el),
                value:    null,
            });
        }
    }, true);

    // clicks on buttons, custom components, etc. (not inputs / selects / textareas)
    document.addEventListener('click', function (e) {
        if (!window._recorder.recording) return;
        const el = e.target;
        if (!el || !el.tagName) return;
        const tag = el.tagName.toUpperCase();

        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const text = (el.textContent || '').trim().substring(0, 80);
        if (!text && !el.id && !el.getAttribute('data-qa') && !el.className) return;

        window._recorder.steps.push({
            action:   'click',
            selector: getSelector(el),
            label:    text,
            value:    null,
        });
    }, true);

    console.log('[recorder] Recording started — interact with the form now.');
})();
"""


def detect_ats(url: str) -> str:
    if 'greenhouse.io' in url:
        return 'greenhouse'
    if 'gupy.io' in url or 'gupy.com' in url:
        return 'gupy'
    if 'lever.co' in url:
        return 'lever'
    if 'workday' in url:
        return 'workday'
    return 'unknown'


def extract_pattern(url: str) -> str:
    url = re.sub(r'/jobs/\d+', '/jobs/*', url)
    url = re.sub(r'/processo-seletivo/[^/?#]+/', '/processo-seletivo/*/', url)
    return url


def dedup_steps(steps: list[dict]) -> list[dict]:
    """Keep the last recorded value for each (selector, action) pair."""
    seen: dict[str, dict] = {}
    for step in steps:
        key = step.get('action', '') + '|' + step.get('selector', '')
        seen[key] = step
    return list(seen.values())


def main() -> None:
    parser = argparse.ArgumentParser(description='Record form-filling template for auto-apply')
    parser.add_argument('--company', required=True, help='Company slug, e.g. c6bank')
    parser.add_argument('--url',     required=True, help='Job application URL')
    parser.add_argument('--no-save', action='store_true', help='Skip Supabase save prompt')
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('ERROR: playwright not installed. Run:')
        print('  pip install playwright && playwright install chromium')
        sys.exit(1)

    print()
    print('=' * 60)
    print(f'  GRAVADOR DE TEMPLATE — {args.company.upper()}')
    print('=' * 60)
    print(f'  URL: {args.url}')
    print()
    print('  Instruções:')
    print('  1. O Chrome vai abrir com o formulário de candidatura')
    print('  2. Preencha todos os campos normalmente')
    print('  3. NÃO submeta o formulário')
    print('  4. Volte aqui e pressione ENTER quando terminar')
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=['--start-maximized'])
        context = browser.new_context(no_viewport=True)

        # Inject recorder on every new page/frame (SPA-safe)
        context.add_init_script(_RECORDER_JS)
        page = context.new_page()

        page.goto(args.url)
        page.wait_for_load_state('domcontentloaded')

        # Also inject immediately in case the page is already loaded
        try:
            page.evaluate(_RECORDER_JS)
        except Exception:
            pass

        print('🔴 GRAVANDO — preencha o formulário normalmente no Chrome')
        print('   Pressione ENTER aqui quando terminar...')
        input()

        raw_steps: list[dict] = []
        try:
            raw_steps = page.evaluate('window._recorder ? window._recorder.steps : []') or []
        except Exception as exc:
            print(f'AVISO: Não foi possível coletar steps: {exc}')

        browser.close()

    print(f'\n📋 {len(raw_steps)} eventos capturados — deduplicando...')
    steps = dedup_steps(raw_steps)
    print(f'   {len(steps)} steps únicos após deduplicação\n')

    template = {
        'company':      args.company,
        'ats':          detect_ats(args.url),
        'url_pattern':  extract_pattern(args.url),
        'recorded_at':  datetime.now().isoformat(),
        'steps':        steps,
    }

    print(json.dumps(template, indent=2, ensure_ascii=False))
    print()

    if args.no_save:
        return

    save = input('Salvar no Supabase? (s/n): ').strip().lower()
    if save != 's':
        print('Template não salvo.')
        return

    supabase_url = os.environ.get('SUPABASE_URL', '')
    supabase_key = os.environ.get('SUPABASE_KEY', '')
    if not supabase_url or not supabase_key:
        print('ERRO: SUPABASE_URL e SUPABASE_KEY precisam estar definidos no .env')
        sys.exit(1)

    try:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)
        client.table('apply_templates').upsert({
            'company':    args.company,
            'ats':        template['ats'],
            'template':   template,
            'updated_at': datetime.now().isoformat(),
        }).execute()
        print('✅ Template salvo no Supabase!')
    except Exception as exc:
        print(f'ERRO ao salvar no Supabase: {exc}')
        sys.exit(1)


if __name__ == '__main__':
    main()
