"""
Debug script: inspeciona o que o AlterLab retorna para cada empresa.
Uso: python debug_alterlab.py [slug]   # slug opcional para testar só uma empresa
"""

import os, sys, json, requests
from dotenv import load_dotenv

load_dotenv()

ALTERLAB_URL = 'https://api.alterlab.io/api/v1/scrape'
API_KEY = os.environ.get('ALTERLAB_API_KEY', '')

COMPANIES = {
    'ifood':      {'url': 'https://carreiras.ifood.com.br',                   'formats': ['html']},
    'stone':      {'url': 'https://stone.gupy.io',                            'formats': ['json', 'text']},
    'creditas':   {'url': 'https://creditas.gupy.io',                         'formats': ['json', 'text']},
    'hotmart':    {'url': 'https://hotmart.com/en/jobs',                      'formats': ['json', 'text']},
    'hotmart_br': {'url': 'https://hotmart.com/pt-br/trabalhe-conosco/vagas', 'formats': ['html']},
    'dtidigital': {'url': 'https://www.dtidigital.com.br/carreiras',          'formats': ['html']},
    'loggi':      {'url': 'https://loggi.gupy.io',                            'formats': ['json', 'text']},
}


def scrape(url: str, formats: list[str] | None = None) -> dict:
    resp = requests.post(
        ALTERLAB_URL,
        headers={'X-API-Key': API_KEY, 'Content-Type': 'application/json'},
        json={
            'url': url,
            'render_js': True,
            'cost_controls': {'prefer_cost': True, 'max_tier': '3'},
            'formats': formats or ['json', 'text'],
        },
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def print_section(title: str, content: str, limit: int = 800) -> None:
    print(f'\n{"─"*60}')
    print(f'  {title}')
    print('─'*60)
    if limit == 0:
        print(content or '(vazio)')
    else:
        snippet = (content or '')[:limit]
        print(snippet if snippet else '(vazio)')
        if len(content or '') > limit:
            print(f'  ... [{len(content) - limit} chars restantes]')


def inspect(slug: str, url: str, formats: list[str] | None = None, limit: int = 800) -> None:
    print(f'\n{"═"*60}')
    print(f'  EMPRESA: {slug.upper()}  →  {url}')
    print('═'*60)

    try:
        raw = scrape(url, formats=formats)
    except Exception as e:
        print(f'  ERRO na requisição: {e}')
        return

    # Dump full response keys
    print(f'\n  Chaves do response: {list(raw.keys())}')

    # Try to find the content container
    for path in ('data', 'result', 'content', ''):
        container = raw.get(path, raw) if path else raw
        if not isinstance(container, dict):
            continue
        json_val = container.get('json')
        text_val = container.get('text', '')
        md_val   = container.get('markdown', '')

        html_val = raw.get('raw_html', '') or container.get('html', '')
        if json_val is not None or text_val or md_val or html_val:
            print(f'  Conteúdo encontrado em: envelope="{path or "(raiz)"}"')
            print(f'  Tipo do campo json: {type(json_val).__name__}')

            # Show raw_html preview (for formats: ['html'] requests)
            if html_val:
                print_section(f'RAW_HTML ({limit or "full"})', html_val, limit=limit)

            # Show text preview
            if text_val:
                print_section(f'TEXT ({limit or "full"})', text_val, limit=limit)

            # Show markdown preview
            if md_val:
                print_section(f'MARKDOWN ({limit or "full"})', md_val, limit=limit)

            # Show JSON summary
            if json_val is not None:
                json_str = json.dumps(json_val, ensure_ascii=False)
                print_section(f'JSON ({limit or "full"})', json_str, limit=limit)

                # Look for API URL hints in the JSON
                url_hits = [w for w in json_str.split('"') if w.startswith('http') and ('api' in w.lower() or 'job' in w.lower())]
                if url_hits:
                    print(f'\n  URLs com "api" ou "job" encontradas no JSON:')
                    for u in sorted(set(url_hits))[:10]:
                        print(f'    {u}')

            # Search text for API URL hints
            if text_val:
                import re
                api_urls = re.findall(r'https?://[^\s"\'<>]+(?:api|job|career|vaga)[^\s"\'<>]*', text_val, re.I)
                if api_urls:
                    print(f'\n  URLs com "api/job/career/vaga" no texto:')
                    for u in sorted(set(api_urls))[:10]:
                        print(f'    {u}')

            break
    else:
        print('\n  Nenhum campo de conteúdo encontrado. Response completo:')
        print(json.dumps(raw, ensure_ascii=False, indent=2)[:1500])


if __name__ == '__main__':
    if not API_KEY:
        print('ERRO: ALTERLAB_API_KEY não definido no .env')
        sys.exit(1)

    args = sys.argv[1:]
    full_mode = '--full' in args
    target = next((a for a in args if not a.startswith('--')), None)

    for slug, cfg in COMPANIES.items():
        if target and slug != target:
            continue
        url = cfg['url'] if isinstance(cfg, dict) else cfg
        fmts = cfg.get('formats') if isinstance(cfg, dict) else None
        inspect(slug, url, formats=fmts, limit=0 if full_mode else 1000)

    print('\n\nDone.')
