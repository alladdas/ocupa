import os
import logging
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

COMPANIES = [
    'nubank', 'wildlifestudios', 'cloudwalk', 'neon', 'caju',
    'flash', 'alice', 'dock', 'unico', 'ciandt',
    # Confirmed working via boards-api.greenhouse.io (HTTP 200)
    'xpinc', 'c6bank', 'picpay', 'quintoandar', 'vtex', 'inter', 'stone',
]


def _parse_work_model(location_name: str) -> str:
    loc = location_name.lower()
    if 'remot' in loc:
        return 'remoto'
    if 'híbrid' in loc or 'hybrid' in loc:
        return 'híbrido'
    return 'presencial'


def scrape_greenhouse() -> int:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    new_count = 0

    for slug in COMPANIES:
        # ── 1. Fetch from Greenhouse (public API, no auth needed) ─────────────
        api_url = f'https://boards-api.greenhouse.io/v1/boards/{slug}/jobs'
        try:
            resp = requests.get(api_url, timeout=15)
            if resp.status_code != 200:
                logger.debug(f'[greenhouse] {slug} → HTTP {resp.status_code}')
                continue
            jobs = resp.json().get('jobs', [])
        except Exception as exc:
            logger.warning(f'[greenhouse] {slug} fetch error: {exc}')
            continue

        logger.debug(f'[greenhouse] {slug} → {len(jobs)} vagas encontradas')

        # ── 2. Insert new jobs into Supabase ─────────────────────────────────
        for job in jobs:
            job_id = str(job.get('id', '')).strip()
            if not job_id:
                continue

            try:
                existing = supabase.table('scraped_jobs').select('id').eq('id', job_id).execute()
                if existing.data:
                    continue

                location_field = job.get('location', {})
                location_name = (
                    location_field.get('name', '') if isinstance(location_field, dict)
                    else str(location_field)
                )

                record = {
                    'id': job_id,
                    'title': (job.get('title') or '').strip(),
                    'company': slug,
                    'location': location_name,
                    'url': job.get('absolute_url') or '',
                    'employment_type': _parse_work_model(location_name),
                    'salary_min': None,
                    'salary_max': None,
                    'posted_at': job.get('updated_at'),
                    'description': job.get('content') or '',
                    'source': 'greenhouse',
                    'tier': 'free',
                }

                supabase.table('scraped_jobs').insert(record).execute()
                new_count += 1
                logger.debug(f'[greenhouse] inserido: {slug} — {record["title"]}')

            except Exception as exc:
                logger.warning(f'[greenhouse] supabase error ({slug} #{job_id}): {exc}')

    return new_count
