"""
AlterLab scraper — fetches job listings for premium companies that block
direct API access, using https://api.alterlab.io/api/v1/scrape.

Runs once per day (see scheduler.py).
"""

import os
import re
import json
import logging
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ALTERLAB_URL = 'https://api.alterlab.io/api/v1/scrape'

# slug → { url, type }
# type drives which parser is attempted first
COMPANIES: dict[str, dict] = {
    # All are SPAs with no public API — require JS rendering
    'ifood':      {'url': 'https://carreiras.ifood.com.br',                     'type': 'custom',     'render_js': True, 'formats': ['html']},
    # stone moved to greenhouse.py (boards-api.greenhouse.io/v1/boards/stone → 459 jobs)
    # loggi removed — no open positions
    'creditas':   {'url': 'https://creditas.gupy.io',                           'type': 'gupy_board', 'render_js': True},
    'hotmart':    {'url': 'https://hotmart.com/en/jobs',                        'type': 'custom',     'render_js': True},
    # hotmart_br removed — jobs load async and aren't present in rendered HTML; no public API
    'dtidigital': {'url': 'https://www.dtidigital.com.br/carreiras',            'type': 'custom',     'render_js': True, 'formats': ['html']},
}


# ─── Work-model helper ────────────────────────────────────────────────────────

def _work_model(text: str) -> str:
    t = (text or '').lower()
    if 'remot' in t:
        return 'remoto'
    if 'híbrid' in t or 'hybrid' in t:
        return 'híbrido'
    return 'presencial'


# ─── Title quality helpers ────────────────────────────────────────────────────

# Substrings (lowercase) that identify nav/UI noise, not job titles
_TITLE_BLACKLIST = [
    'skip to main', 'terms of use', 'privacy notice',
    'page not found', '404 error', 'job posting you',
    'early career', 'veja nossas vagas', 'jobs at ',
    'current openings', 'o inter está', 'conheça nossos',
    'saiba mais', 'para saber mais', 'venha transformar',
    'somos milhares', 'diversidade e inclusão', 'careers',
    'picpay careers', 'talent pool', 'feedback badge',
    'login', 'using hotmart', 'the company', 'our impact',
    'follow us', 'ask questions', 'education',
    "gupy's terms", "gupy's privacy", 'cookie',
]

# Strips city/state/contract suffix from Gupy-style titles
# e.g. "Engineering Lead | Plataforma São Paulo - SP and Hybrid…" → "Engineering Lead | Plataforma"
_CITY_SUFFIX_RE = re.compile(
    r'\s+(São Paulo|Rio de Janeiro|Belo Horizonte|Brasília|Curitiba|'
    r'Brasil|Brazil|Remote|Remoto)[\s\-–|].*$',
    re.IGNORECASE,
)

# Strips city/state prefix stuck to iFood titles
# e.g. "Osasco, Analista de Dados" → "Analista de Dados"
_IFOOD_PREFIX_RE = re.compile(
    r'^(Osasco|São Paulo|Rio de Janeiro|Brasil|Brazil|Remoto|Remote|Híbrido)[,\s]+',
    re.IGNORECASE,
)

# Detects location pasted directly at the start with no separator
# e.g. "remotoengenheiro", "Brasilanalista", "São Paulo, SP, Brazilanalista"
_CITY_PREFIX_RE = re.compile(
    r'^(brasil|brazil|remoto|remote|osasco|híbrido|hybrid|'
    r'são paulo|rio de janeiro|belo horizonte|goiânia|'
    r'guarulhos|campinas|curitiba|fortaleza|salvador|'
    r'[a-záéíóú]+,\s*[a-záéíóú\s]+,\s*brazil)',
    re.IGNORECASE,
)


def _is_invalid_title(title: str) -> bool:
    if not title or len(title) < 8 or len(title) > 200:
        return True
    t = title.lower().strip()
    if any(bad in t for bad in _TITLE_BLACKLIST):
        return True
    if _CITY_PREFIX_RE.match(title):
        return True
    return False


# ─── AlterLab request ─────────────────────────────────────────────────────────

def _scrape(url: str, render_js: bool = False, formats: list[str] | None = None) -> dict | None:
    api_key = os.environ.get('ALTERLAB_API_KEY', '')
    if not api_key:
        logger.error('ALTERLAB_API_KEY not set — skipping alterlab scraper')
        return None

    try:
        resp = requests.post(
            ALTERLAB_URL,
            headers={'X-API-Key': api_key, 'Content-Type': 'application/json'},
            json={
                'url': url,
                'render_js': render_js,
                'cost_controls': {'prefer_cost': True, 'max_tier': '3'},
                'formats': formats or ['json', 'text'],
            },
            timeout=120,
        )
        if resp.status_code != 200:
            logger.warning(f'AlterLab → {url} HTTP {resp.status_code}: {resp.text[:300]}')
            return None
        return resp.json()
    except Exception as exc:
        logger.warning(f'AlterLab request failed ({url}): {exc}')
        return None


def _extract_payload(response: dict) -> tuple[dict | list | None, str]:
    """
    Returns (json_payload, text_payload) from the AlterLab response.
    Handles multiple possible response envelopes.
    """
    # Common envelope paths
    for path in ('data', 'result', 'content', ''):
        container = response.get(path, response) if path else response
        if not isinstance(container, dict):
            continue
        json_val = container.get('json')
        text_val = container.get('text', '')
        if json_val is not None:
            return json_val, text_val or ''

    # Last resort: the response itself might be the data
    return None, ''


# ─── Source-specific parsers ─────────────────────────────────────────────────

def _make_record(job_id: str, title: str, location: str, url: str, slug: str) -> dict:
    return {
        'id': job_id,
        'title': (title or '').strip(),
        'company': slug,
        'location': (location or '').strip(),
        'url': url or '',
        'employment_type': _work_model(location),
        'salary_min': None,
        'salary_max': None,
        'posted_at': None,
        'description': '',
        'source': 'alterlab',
        'tier': 'free',
    }


def _parse_greenhouse(payload: dict | list, slug: str) -> list[dict]:
    """Standard Greenhouse board JSON: { jobs: [...] }"""
    if isinstance(payload, list):
        raw = payload
    elif isinstance(payload, dict):
        raw = payload.get('jobs', [])
    else:
        return []

    jobs = []
    for job in raw:
        if not isinstance(job, dict):
            continue
        job_id = str(job.get('id', '')).strip()
        if not job_id:
            continue
        loc_field = job.get('location', {})
        location = loc_field.get('name', '') if isinstance(loc_field, dict) else str(loc_field)
        jobs.append(_make_record(
            job_id=job_id,
            title=job.get('title', ''),
            location=location,
            url=job.get('absolute_url', ''),
            slug=slug,
        ))
    return jobs


def _parse_lever(payload: dict | list, slug: str) -> list[dict]:
    """Lever board JSON: list of posting objects."""
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        items = payload.get('postings', payload.get('jobs', []))
    else:
        return []

    jobs = []
    for job in items:
        if not isinstance(job, dict):
            continue
        job_id = str(job.get('id', '')).strip()
        if not job_id:
            continue
        cats = job.get('categories', {})
        location = cats.get('location', '') or job.get('workplaceType', '')
        jobs.append(_make_record(
            job_id=job_id,
            title=job.get('text', job.get('title', '')),
            location=location,
            url=job.get('hostedUrl', job.get('applyUrl', '')),
            slug=slug,
        ))
    return jobs


def _parse_ifood_text(text: str) -> list[dict]:
    # Remove header e lixo inicial
    text = re.sub(r'^.*?VAGASENIORIDADELOCAL', '', text, flags=re.DOTALL)

    # Regex: captura (titulo)(senioridade)(localização)
    pattern = re.compile(
        r'(.+?)(Júnior|Pleno|Sênior|Estágio|Especialista|Executivo[^\s]*)'
        r'(.*?)(?=.+?(?:Júnior|Pleno|Sênior|Estágio|Especialista|Executivo)|$)',
        re.DOTALL
    )

    jobs = []
    for match in pattern.finditer(text):
        title = match.group(1).strip()
        seniority = match.group(2).strip()
        location_raw = match.group(3).strip()

        loc_match = re.search(
            r'(.+?(?:Brazil|Brasil|Remoto|Remote))',
            location_raw
        )
        location = loc_match.group(1).strip() if loc_match else location_raw[:50]

        # Strip city/state prefix that sometimes gets concatenated to the title
        title = _IFOOD_PREFIX_RE.sub('', title).strip()

        if len(title) < 5:
            continue

        job_id = f'alterlab-ifood-{abs(hash(title + seniority))}'
        jobs.append({
            'id': job_id,
            'title': title,
            'company': 'ifood',
            'location': location,
            'url': 'https://carreiras.ifood.com.br',
            'employment_type': _work_model(location),
            'salary_min': None,
            'salary_max': None,
            'posted_at': None,
            'description': '',
            'source': 'alterlab',
            'tier': 'free',
        })

    return jobs


def _parse_ifood_html(raw_html: str) -> list[dict]:
    """
    Parses iFood careers page HTML returned by AlterLab (formats: ['html']).
    Targets <a href="/job/{id}/"> anchors inside <li> items.
    """
    soup = BeautifulSoup(raw_html, 'html.parser')
    jobs = []
    seen_ids: set[str] = set()

    for a_tag in soup.find_all('a', href=re.compile(r'^/job/\d+/')):
        href = a_tag.get('href', '')
        m = re.search(r'/job/(\d+)/', href)
        if not m:
            continue
        job_id = m.group(1)
        if job_id in seen_ids:
            continue
        seen_ids.add(job_id)

        title = a_tag.get_text(strip=True)
        if not title:
            continue

        li = a_tag.find_parent('li')
        spans = li.find_all('span') if li else []
        location = spans[1].get_text(strip=True) if len(spans) > 1 else ''

        jobs.append({
            'id': f'alterlab-ifood-{job_id}',
            'title': title,
            'company': 'ifood',
            'location': location,
            'url': f'https://carreiras.ifood.com.br/job/{job_id}/',
            'employment_type': _work_model(location),
            'salary_min': None,
            'salary_max': None,
            'posted_at': None,
            'description': '',
            'source': 'alterlab',
            'tier': 'free',
        })

    return jobs


def _parse_hotmart_br(raw_html: str) -> list[dict]:
    """
    Parses Hotmart PT-BR careers page HTML.
    Targets <p class="hot-position-card__job"> for title and
    <a href="/pt-br/trabalhe-conosco/vagas/{id}/{slug}"> for URL.
    """
    soup = BeautifulSoup(raw_html, 'html.parser')
    jobs = []
    seen_ids: set[str] = set()

    for a_tag in soup.find_all('a', href=re.compile(r'/pt-br/trabalhe-conosco/vagas/\d+')):
        href = a_tag.get('href', '')
        m = re.search(r'/vagas/(\d+)', href)
        if not m:
            continue
        job_id = m.group(1)
        if job_id in seen_ids:
            continue
        seen_ids.add(job_id)

        p_tag = a_tag.find('p', class_=re.compile(r'hot-position-card__job'))
        title = p_tag.get_text(strip=True) if p_tag else a_tag.get_text(strip=True)
        if not title:
            continue

        jobs.append({
            'id': f'alterlab-hotmart_br-{job_id}',
            'title': title,
            'company': 'hotmart',
            'location': '',
            'url': f'https://hotmart.com{href}',
            'employment_type': 'presencial',
            'salary_min': None,
            'salary_max': None,
            'posted_at': None,
            'description': '',
            'source': 'alterlab',
            'tier': 'free',
        })

    return jobs


def _parse_dtidigital(raw_html: str) -> list[dict]:
    """
    Parses DTI Digital careers page HTML.
    Structure: <h4>title</h4> <h3>location</h3> <h3>seniority</h3>
    <a href="https://dtidigital.inhire.app/vagas/{uuid}/{slug}">
    The <a> is nested several divs below the card root; walk up until
    we reach a container that also contains the <h4> job title.
    """
    soup = BeautifulSoup(raw_html, 'html.parser')
    jobs = []
    seen_ids: set[str] = set()

    for a_tag in soup.find_all('a', href=re.compile(r'dtidigital\.inhire\.app/vagas/')):
        href = a_tag.get('href', '')
        m = re.search(r'/vagas/([a-f0-9\-]{36})', href)
        if not m:
            continue
        job_id = m.group(1)
        if job_id in seen_ids:
            continue
        seen_ids.add(job_id)

        # Walk up the tree until we find a container that holds the h4 title
        container = a_tag.parent
        for _ in range(8):
            if container is None or container.name in (None, '[document]', 'html', 'body'):
                break
            if container.find('h4'):
                break
            container = container.parent

        if container is None or not container.find('h4'):
            continue

        h4 = container.find('h4')
        h3s = container.find_all('h3')
        title = h4.get_text(strip=True)
        location = h3s[0].get_text(strip=True) if len(h3s) > 0 else ''

        if not title:
            continue

        jobs.append({
            'id': f'alterlab-dtidigital-{job_id}',
            'title': title,
            'company': 'dtidigital',
            'location': location,
            'url': href,
            'employment_type': _work_model(location),
            'salary_min': None,
            'salary_max': None,
            'posted_at': None,
            'description': '',
            'source': 'alterlab',
            'tier': 'free',
        })

    return jobs


def _parse_gupy_board_json(payload: dict | list, slug: str) -> list[dict]:
    """
    Parses AlterLab's CollectionPage JSON from a Gupy board (e.g. creditas.gupy.io).
    Items have titles like "Job Title Location and Hybrid Full-time employee" and
    URLs like "https://{slug}.gupy.io/jobs/{id}?jobBoardSource=gupy_public_page".
    """
    items = payload.get('items', []) if isinstance(payload, dict) else (payload if isinstance(payload, list) else [])
    if not items:
        return []

    job_url_re = re.compile(r'/jobs/(\d+)')
    suffix_re = re.compile(r'\s+and\s+(?:Hybrid|Remote|On-site|On site|Presential)\b.*$', re.IGNORECASE)
    # Greedy match from right: find last " - STATE" (2 uppercase letters at end)
    state_re = re.compile(r'^(.+)\s+-\s+([A-Z]{2})\s*$')

    jobs = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item.get('url', '')
        m = job_url_re.search(url)
        if not m:
            continue  # skip navigation links (Terms of Use, Privacy Notice, etc.)

        job_id = m.group(1)
        raw_title = (item.get('title') or '').strip()

        # Strip " and Hybrid Full-time employee" from end
        title_loc = suffix_re.sub('', raw_title).strip()

        state_m = state_re.match(title_loc)
        if state_m:
            pre_state = state_m.group(1)  # e.g. "Analista de Business Analytics Pleno São Paulo"
            state = state_m.group(2)      # e.g. "SP"
            # rsplit into at most 3 parts to peel off last 2 words as city
            parts = pre_state.rsplit(None, 2)
            if len(parts) == 3 and parts[1][0].isupper():
                title = parts[0].rstrip('|').strip()
                location = f'{parts[1]} {parts[2]} - {state}'
            else:
                title = ' '.join(parts[:-1]).rstrip('|').strip() if len(parts) > 1 else title_loc
                location = f'{parts[-1]} - {state}' if parts else ''
        else:
            title = title_loc
            location = ''

        # Safety-net: strip any remaining city/contract suffix
        title = _CITY_SUFFIX_RE.sub('', title).strip().rstrip('|').strip()

        jobs.append({
            'id': f'alterlab-{slug}-{job_id}',
            'title': title,
            'company': slug,
            'location': location,
            'url': url.split('?')[0],
            'employment_type': _work_model(raw_title),
            'salary_min': None,
            'salary_max': None,
            'posted_at': None,
            'description': '',
            'source': 'alterlab',
            'tier': 'free',
        })

    return jobs


def _parse_text_fallback(text: str, source_url: str, slug: str) -> list[dict]:
    """
    Last-resort text parser: looks for lines that look like job titles
    followed by an optional location on the next line.
    """
    if not text:
        return []

    lines = [l.strip() for l in text.splitlines() if l.strip()]
    jobs = []

    # Heuristic: lines that look like job titles (3-10 words, no trailing punctuation)
    title_re = re.compile(r'^[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ][a-zA-ZÁÉÍÓÚÀÂÊÔÃÕÜÇáéíóúàâêôãõüç\s\-&/.,]{5,80}$')
    loc_keywords = {'remoto', 'híbrido', 'hybrid', 'presencial', 'são paulo', 'rio de janeiro',
                    'belo horizonte', 'brasil', 'brazil', 'remote', 'sp', 'rj'}

    for i, line in enumerate(lines):
        if not title_re.match(line):
            continue
        # Avoid lines that are section headings (ALL CAPS)
        if line.isupper():
            continue
        # Check next line for location hint
        location = ''
        if i + 1 < len(lines):
            nxt = lines[i + 1].lower()
            if any(kw in nxt for kw in loc_keywords):
                location = lines[i + 1]

        job_id = f'alterlab-{slug}-{abs(hash(line)) % 10_000_000}'
        jobs.append(_make_record(
            job_id=job_id,
            title=line,
            location=location,
            url=source_url,
            slug=slug,
        ))

    return jobs


def _parse_generic_json(payload: dict | list, source_url: str, slug: str) -> list[dict]:
    """
    Generic JSON walker: looks for arrays of objects that look like job postings
    (have a title/name/text field and optionally id/url).
    """
    def _is_job_like(obj: dict) -> bool:
        has_title = any(k in obj for k in ('title', 'name', 'text', 'jobTitle'))
        return has_title

    def _walk(node, depth=0) -> list[dict]:
        if depth > 4:
            return []
        if isinstance(node, list) and node and isinstance(node[0], dict) and _is_job_like(node[0]):
            results = []
            for item in node:
                if not isinstance(item, dict):
                    continue
                title = (item.get('title') or item.get('name') or item.get('text') or item.get('jobTitle') or '')
                if not title or len(title) < 4:
                    continue
                job_id = str(item.get('id') or item.get('requisitionId') or abs(hash(title)))
                location = item.get('location', '') or item.get('city', '') or item.get('region', '')
                if isinstance(location, dict):
                    location = location.get('name', '')
                url = item.get('absolute_url') or item.get('hostedUrl') or item.get('url') or item.get('applyUrl') or source_url
                results.append(_make_record(
                    job_id=f'alterlab-{job_id}',
                    title=str(title),
                    location=str(location),
                    url=str(url),
                    slug=slug,
                ))
            if results:
                return results
        if isinstance(node, dict):
            for v in node.values():
                found = _walk(v, depth + 1)
                if found:
                    return found
        return []

    return _walk(payload)


# ─── Per-company extraction ────────────────────────────────────────────────────

def _extract_jobs(slug: str, company_type: str, source_url: str, response: dict) -> list[dict]:
    payload, text = _extract_payload(response)

    # AlterLab returns HTML under response['content']['html'] when formats=['html'].
    # response['raw_html'] exists as a key but is null — use content.html as primary.
    raw_html: str = (
        response.get('raw_html')
        or response.get('content', {}).get('html')
        or ''
    )

    # iFood: try HTML parser first (formats: ['html']), fall back to text
    if slug == 'ifood':
        if raw_html:
            jobs = _parse_ifood_html(raw_html)
            if jobs:
                logger.debug(f'[alterlab] ifood HTML parser → {len(jobs)} vagas')
                return jobs
        if text:
            jobs = _parse_ifood_text(text)
            if jobs:
                logger.debug(f'[alterlab] ifood text parser → {len(jobs)} vagas')
                return jobs

    if slug == 'dtidigital' and raw_html:
        jobs = _parse_dtidigital(raw_html)
        if jobs:
            logger.debug(f'[alterlab] dtidigital HTML parser → {len(jobs)} vagas')
            return jobs

    # 1. Try the typed parser first
    if payload is not None:
        if company_type == 'greenhouse':
            jobs = _parse_greenhouse(payload, slug)
            if jobs:
                return jobs
        elif company_type == 'lever':
            jobs = _parse_lever(payload, slug)
            if jobs:
                return jobs
        elif company_type == 'gupy_board':
            jobs = _parse_gupy_board_json(payload, slug)
            if jobs:
                logger.debug(f'[alterlab] {slug} gupy_board parser → {len(jobs)} vagas')
                return jobs

    # 2. Generic JSON walker
    if payload is not None:
        jobs = _parse_generic_json(payload, source_url, slug)
        if jobs:
            return jobs

    # 3. Check if json payload itself is a string (double-encoded JSON)
    if isinstance(payload, str):
        try:
            decoded = json.loads(payload)
            jobs = _parse_generic_json(decoded, source_url, slug) or _parse_greenhouse(decoded, slug) or _parse_lever(decoded, slug)
            if jobs:
                return jobs
        except (json.JSONDecodeError, ValueError):
            pass

    # 4. Text fallback
    if text:
        return _parse_text_fallback(text, source_url, slug)

    return []


# ─── Main entry point ─────────────────────────────────────────────────────────

def scrape_alterlab() -> int:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    total_new = 0

    for slug, config in COMPANIES.items():
        try:
            url = config['url']
            company_type = config['type']

            render_js = config.get('render_js', False)
            formats = config.get('formats')
            logger.debug(f'[alterlab] Scraping {slug} ({url}) render_js={render_js}')
            response = _scrape(url, render_js=render_js, formats=formats)
            if response is None:
                logger.warning(f'[alterlab] No response for {slug} — skipping')
                continue

            jobs = _extract_jobs(slug, company_type, url, response)
            logger.debug(f'[alterlab] {slug} → {len(jobs)} vagas extraídas')

            new_count = 0
            for job in jobs:
                job_id = job['id']
                if not job_id or not job.get('title'):
                    continue
                if _is_invalid_title(job['title']):
                    logger.debug(f'[alterlab] skipping blacklisted title: {job["title"][:60]}')
                    continue
                try:
                    existing = supabase.table('scraped_jobs').select('id').eq('id', job_id).execute()
                    if existing.data:
                        continue
                    supabase.table('scraped_jobs').insert(job).execute()
                    new_count += 1
                except Exception as exc:
                    logger.warning(f'[alterlab] Supabase error ({slug} #{job_id}): {exc}')

            total_new += new_count
            logger.info(f'[alterlab] {slug} → {new_count} new jobs')

        except Exception as exc:
            logger.exception(f'[alterlab] Unexpected error processing {slug}: {exc}')

    return total_new
