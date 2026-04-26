"""
Descobre endpoints de API em portais de vagas.

Para cada URL fornecida:
  1. Faz GET na página principal e escaneia o HTML em busca de URLs de API
  2. Testa padrões comuns de endpoint (Greenhouse, Lever, Ashby, etc.)
  3. Classifica respostas: JSON ✓ / HTML / auth required / 404
  4. Salva HTML em discovery_cache/{slug}.html

Uso:
  python scripts/discover_apis.py https://mlabs.gupy.io https://carreiras.99app.com/vagas/busca
"""

import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests

CACHE_DIR = Path(__file__).parent / 'discovery_cache'
CACHE_DIR.mkdir(exist_ok=True)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
}

RATE_LIMIT = 1.0  # seconds between requests

# Patterns to scan in HTML source
API_URL_PATTERN = re.compile(
    r'["\']('
    r'https?://[^\s"\'<>]+(?:api|jobs|careers|vagas|search|openings)[^\s"\'<>]*'
    r')["\']',
    re.IGNORECASE,
)

# Known endpoint templates to probe
COMMON_PATTERNS = [
    # Greenhouse
    'https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true',
    # Lever
    'https://api.lever.co/v0/postings/{board}?mode=json',
    # Ashby
    'https://jobs.ashbyhq.com/api/non-user-graphql',
    # Workday (varies too much, skip)
    # BambooHR
    'https://{board}.bamboohr.com/careers/list',
    # Eightfold (for MELI)
    'https://meli.eightfold.ai/api/apply/v2/jobs?domain=mercadolibre.com&limit=10',
    'https://meli.eightfold.ai/careers/api/jobs?count=10',
    # Gupy public portal
    'https://employability-portal.gupy.io/api/v1/jobs?companyId={company_id}&limit=10',
    # Gupy board
    '{base}/api/v1/jobs?limit=10',
]


def get_slug(url: str) -> str:
    parsed = urlparse(url)
    host = parsed.hostname or ''
    return host.replace('.', '_').replace('-', '_')


def fetch(url: str, *, timeout: int = 15, json_only: bool = False) -> tuple[int, str, bool]:
    """Return (status_code, text, is_json)."""
    hdrs = dict(HEADERS)
    if json_only:
        hdrs['Accept'] = 'application/json'
    try:
        resp = requests.get(url, headers=hdrs, timeout=timeout, allow_redirects=True)
        is_json = 'json' in resp.headers.get('content-type', '')
        return resp.status_code, resp.text, is_json
    except Exception as exc:
        return -1, str(exc), False


def classify(status: int, text: str, is_json: bool) -> str:
    if status == -1:
        return f'ERROR: {text[:80]}'
    if status == 401 or status == 403:
        return 'AUTH REQUIRED'
    if status == 404:
        return '404 NOT FOUND'
    if status != 200:
        return f'HTTP {status}'
    if is_json or (text.lstrip().startswith('{') or text.lstrip().startswith('[')):
        try:
            data = json.loads(text)
            if isinstance(data, list):
                return f'JSON array — {len(data)} items'
            if isinstance(data, dict):
                keys = list(data.keys())[:5]
                return f'JSON object — keys: {keys}'
        except Exception:
            pass
    if '<html' in text[:200].lower():
        return 'HTML page'
    return f'UNKNOWN ({status}) — {text[:60]}'


def scan_html_for_apis(html: str) -> list[str]:
    found = API_URL_PATTERN.findall(html)
    # Also look for window.__INITIAL_STATE__ or similar JSON blobs
    state_match = re.search(r'window\.__[A-Z_]+\s*=\s*(\{.{200,})', html)
    if state_match:
        blob = state_match.group(1)[:2000]
        extra = API_URL_PATTERN.findall(blob)
        found.extend(extra)
    seen: set[str] = set()
    unique = []
    for u in found:
        if u not in seen and len(u) < 200:
            seen.add(u)
            unique.append(u)
    return unique


def probe_greenhouse(board: str) -> tuple[str, str]:
    url = f'https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true'
    status, text, is_json = fetch(url, json_only=True)
    time.sleep(RATE_LIMIT)
    return url, classify(status, text, is_json)


def probe_lever(board: str) -> tuple[str, str]:
    url = f'https://api.lever.co/v0/postings/{board}?mode=json'
    status, text, is_json = fetch(url, json_only=True)
    time.sleep(RATE_LIMIT)
    return url, classify(status, text, is_json)


def probe_gupy_board(base_url: str) -> tuple[str, str]:
    parsed = urlparse(base_url)
    api_base = f'{parsed.scheme}://{parsed.netloc}'
    url = f'{api_base}/api/v1/jobs?limit=10'
    status, text, is_json = fetch(url, json_only=True)
    time.sleep(RATE_LIMIT)
    return url, classify(status, text, is_json)


def probe_eightfold() -> list[tuple[str, str]]:
    results = []
    for url in [
        'https://meli.eightfold.ai/api/apply/v2/jobs?domain=mercadolibre.com&limit=10',
        'https://meli.eightfold.ai/careers/api/jobs?count=10',
    ]:
        status, text, is_json = fetch(url, json_only=True)
        results.append((url, classify(status, text, is_json)))
        time.sleep(RATE_LIMIT)
    return results


def sample_json(text: str, max_chars: int = 400) -> str:
    try:
        data = json.loads(text)
        pretty = json.dumps(data, ensure_ascii=False, indent=2)
        return pretty[:max_chars] + ('...' if len(pretty) > max_chars else '')
    except Exception:
        return text[:max_chars]


def discover(url: str) -> None:
    slug = get_slug(url)
    print(f'\n{"=" * 70}')
    print(f'TARGET: {url}')
    print(f'{"=" * 70}')

    # 1. Fetch main page
    print(f'\n[1] Fetching main page...')
    status, html, is_json = fetch(url)
    time.sleep(RATE_LIMIT)

    cache_path = CACHE_DIR / f'{slug}.html'
    cache_path.write_text(html, encoding='utf-8', errors='replace')
    print(f'    → HTTP {status} | {len(html)} chars | cached to {cache_path.name}')

    if status == 200:
        # 2. Scan HTML for API URLs
        api_urls = scan_html_for_apis(html)
        if api_urls:
            print(f'\n[2] API URLs found in page source ({len(api_urls)}):')
            for u in api_urls[:15]:
                print(f'    {u}')
        else:
            print(f'\n[2] No API URLs found in page source')

        # Extract companyId if present (Gupy)
        cid_match = re.search(r'"companyId":(\d+)', html)
        if cid_match:
            cid = cid_match.group(1)
            print(f'\n    [Gupy] companyId detected: {cid}')
            portal_url = f'https://employability-portal.gupy.io/api/v1/jobs?companyId={cid}&limit=10'
            st2, txt2, ij2 = fetch(portal_url, json_only=True)
            time.sleep(RATE_LIMIT)
            result = classify(st2, txt2, ij2)
            print(f'    Portal check → {result}')
            if 'JSON' in result:
                print(f'    Sample:\n{sample_json(txt2, 300)}')

    # 3. Probe common patterns based on domain
    host = urlparse(url).hostname or ''
    print(f'\n[3] Probing known API patterns...')

    if 'gupy.io' in host:
        api_url, result = probe_gupy_board(url)
        print(f'    Gupy board API: {api_url}\n    → {result}')
        if 'JSON' in result:
            st2, txt2, ij2 = fetch(api_url, json_only=True)
            print(f'    Sample:\n{sample_json(txt2, 400)}')

    if 'mercadolibre' in host or 'mercadolivre' in host or 'meli' in host:
        print(f'\n    Eightfold AI probes (Mercado Livre):')
        for u, r in probe_eightfold():
            print(f'    {u}\n    → {r}')

    # 4. Probe Greenhouse / Lever using slug from domain
    # Extract potential board ID from hostname
    board_candidates = []
    parts = host.split('.')
    if parts[0] not in ('www', 'careers', 'jobs', 'carreiras', 'work', 'api'):
        board_candidates.append(parts[0])
    # Also try path segment
    path = urlparse(url).path.strip('/')
    if path:
        board_candidates.append(path.split('/')[0])

    for board in board_candidates[:2]:
        if board and len(board) > 2:
            gh_url, gh_result = probe_greenhouse(board)
            lv_url, lv_result = probe_lever(board)
            print(f'\n    Greenhouse ({board}): {gh_result}')
            if 'JSON' in gh_result:
                st2, txt2, ij2 = fetch(gh_url, json_only=True)
                print(f'    Sample:\n{sample_json(txt2, 400)}')
            print(f'    Lever ({board}): {lv_result}')
            if 'JSON' in lv_result:
                st2, txt2, ij2 = fetch(lv_url, json_only=True)
                print(f'    Sample:\n{sample_json(txt2, 400)}')

    print()


def main(urls: list[str]) -> None:
    for url in urls:
        discover(url)
    print(f'\n{"=" * 70}')
    print('Discovery complete. HTMLs cached in:', CACHE_DIR)


if __name__ == '__main__':
    targets = sys.argv[1:] or [
        'https://mlabs.gupy.io',
        'https://carreiras.magazineluiza.com.br',
        'https://atracaodetalentos.totvs.app/vempratotvs',
        'https://careers-meli.mercadolibre.com/pt',
        'https://carreiras.99app.com/vagas/busca',
    ]
    main(targets)
