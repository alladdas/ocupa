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
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

ALTERLAB_URL = 'https://api.alterlab.io/api/v1/scrape'

# slug → { url, type }
# type drives which parser is attempted first
COMPANIES: dict[str, dict] = {
    # All are SPAs with no public API — require JS rendering
    'ifood':    {'url': 'https://carreiras.ifood.com.br', 'type': 'custom', 'render_js': True},
    # stone moved to greenhouse.py (boards-api.greenhouse.io/v1/boards/stone → 459 jobs)
    'creditas': {'url': 'https://creditas.gupy.io',       'type': 'custom', 'render_js': True},
    'hotmart':  {'url': 'https://hotmart.com/en/jobs',    'type': 'custom', 'render_js': True},
    'loggi':    {'url': 'https://loggi.gupy.io',          'type': 'custom', 'render_js': True},
}


# ─── Work-model helper ────────────────────────────────────────────────────────

def _work_model(text: str) -> str:
    t = (text or '').lower()
    if 'remot' in t:
        return 'remoto'
    if 'híbrid' in t or 'hybrid' in t:
        return 'híbrido'
    return 'presencial'


# ─── AlterLab request ─────────────────────────────────────────────────────────

def _scrape(url: str, render_js: bool = False) -> dict | None:
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
                'formats': ['json', 'text'],
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

    # iFood has a known text format — try it first before generic parsers
    if slug == 'ifood' and text:
        jobs = _parse_ifood_text(text)
        if jobs:
            logger.debug(f'[alterlab] ifood text parser → {len(jobs)} vagas')
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
        url = config['url']
        company_type = config['type']

        render_js = config.get('render_js', False)
        logger.debug(f'[alterlab] Scraping {slug} ({url}) render_js={render_js}')
        response = _scrape(url, render_js=render_js)
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

    return total_new
