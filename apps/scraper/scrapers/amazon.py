"""
Amazon Jobs scraper — uses the public search.json API (no auth required).
Fetches all Brazil-based jobs, paginating by 100 until exhausted.
Runs once per day (see scheduler.py).
"""

import os
import logging
import requests
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BASE_URL = 'https://www.amazon.jobs/en/search.json'
PAGE_SIZE = 100


def _parse_date(raw: str) -> str | None:
    """'April 22, 2026' → ISO string, or None on failure."""
    try:
        return datetime.strptime(raw.strip(), '%B %d, %Y').isoformat()
    except (ValueError, AttributeError):
        return None


def _work_model(location: str) -> str:
    loc = (location or '').lower()
    if 'virtual' in loc or 'remot' in loc:
        return 'remoto'
    if 'híbrid' in loc or 'hybrid' in loc:
        return 'híbrido'
    return 'presencial'


def scrape_amazon() -> int:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    new_count = 0
    offset = 0

    while True:
        try:
            resp = requests.get(
                BASE_URL,
                params={
                    'base_query': '',
                    'loc_query': 'Brazil',
                    'job_count': PAGE_SIZE,
                    'result_limit': PAGE_SIZE,
                    'country': 'BRA',
                    'offset': offset,
                },
                timeout=30,
            )
            if resp.status_code != 200:
                logger.warning(f'[amazon] HTTP {resp.status_code} at offset {offset}')
                break
            data = resp.json()
        except Exception as exc:
            logger.warning(f'[amazon] fetch error at offset {offset}: {exc}')
            break

        jobs = data.get('jobs', [])
        if not jobs:
            break

        logger.debug(f'[amazon] offset={offset} → {len(jobs)} vagas')

        for job in jobs:
            job_id = str(job.get('id', '')).strip()
            if not job_id:
                continue

            try:
                existing = supabase.table('scraped_jobs').select('id').eq('id', job_id).execute()
                if existing.data:
                    continue

                job_path = job.get('job_path', '')
                city = job.get('city') or ''
                state = job.get('state') or ''
                location = f'{city}, {state}, Brasil'.strip(', ') if city else f'{state}, Brasil'.strip(', ')

                record = {
                    'id': job_id,
                    'title': (job.get('title') or '').strip(),
                    'company': 'amazon',
                    'location': location,
                    'url': f'https://www.amazon.jobs{job_path}' if job_path else '',
                    'employment_type': _work_model(job.get('normalized_location', '')),
                    'salary_min': None,
                    'salary_max': None,
                    'posted_at': _parse_date(job.get('posted_date', '')),
                    'description': '',
                    'source': 'amazon',
                    'tier': 'free',
                }

                supabase.table('scraped_jobs').insert(record).execute()
                new_count += 1

            except Exception as exc:
                logger.warning(f'[amazon] supabase error (#{job_id}): {exc}')

        if len(jobs) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    logger.info(f'[amazon] total → {new_count} new jobs')
    return new_count
