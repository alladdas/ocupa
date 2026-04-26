"""
Gupy scraper — usa o portal público:
  https://employability-portal.gupy.io/api/v1/jobs?companyId={id}&limit=100

O endpoint antigo {slug}.gupy.io/api/job foi descontinuado pela Gupy.
Apenas empresas que publicam no portal público têm companyId acessível.
"""

import os
import logging
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

BASE_URL = 'https://employability-portal.gupy.io/api/v1/jobs'

# Empresas confirmadas no portal público do Gupy (companyId → nome de exibição)
# Para descobrir companyId de novos slugs: python scripts/discover_company_ids.py {slug}
COMPANIES: dict[int, str] = {
    119:  'ambev',
    246:  'renner',
    295:  'boticario',
    316:  'vivo',
    487:  'dasa',
    2022: 'itau',
}

WORKPLACE_MAP = {
    'remote':      'remoto',
    'hybrid':      'híbrido',
    'on-site':     'presencial',
    'presential':  'presencial',
}


def _parse_work_model(job: dict) -> str:
    val = (job.get('workplaceType') or '').lower()
    for key, label in WORKPLACE_MAP.items():
        if key in val:
            return label
    if job.get('isRemoteWork'):
        return 'remoto'
    return 'presencial'


def _fetch_jobs(company_id: int) -> list[dict]:
    """Fetch all jobs for a companyId, handling pagination."""
    jobs: list[dict] = []
    offset = 0
    limit = 100

    while True:
        try:
            resp = requests.get(
                BASE_URL,
                params={'companyId': company_id, 'limit': limit, 'offset': offset},
                timeout=15,
            )
            if resp.status_code != 200:
                logger.debug(f'[gupy] companyId={company_id} offset={offset} → HTTP {resp.status_code}')
                break

            payload = resp.json()
            batch = payload.get('data', [])
            jobs.extend(batch)

            total = payload.get('pagination', {}).get('total', 0)
            offset += limit
            if offset >= total or not batch:
                break

        except Exception as exc:
            logger.warning(f'[gupy] fetch error companyId={company_id}: {exc}')
            break

    return jobs


def scrape_gupy() -> int:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    new_count = 0

    for company_id, company_slug in COMPANIES.items():
        # ── 1. Fetch from Gupy portal (public, no auth needed) ───────────────
        jobs = _fetch_jobs(company_id)
        logger.debug(f'[gupy] {company_slug} (id={company_id}) → {len(jobs)} vagas encontradas')

        # ── 2. Insert new jobs into Supabase ─────────────────────────────────
        for job in jobs:
            job_id = str(job.get('id', '')).strip()
            if not job_id:
                continue

            try:
                existing = supabase.table('scraped_jobs').select('id').eq('id', job_id).execute()
                if existing.data:
                    continue

                location_parts = list(filter(None, [job.get('city'), job.get('state')]))

                record = {
                    'id': job_id,
                    'title': (job.get('name') or job.get('title') or '').strip(),
                    'company': company_slug,
                    'location': ', '.join(location_parts) or '',
                    'url': job.get('jobUrl') or f'https://portal.gupy.io/job/{job_id}',
                    'employment_type': _parse_work_model(job),
                    'salary_min': None,
                    'salary_max': None,
                    'posted_at': job.get('publishedDate') or job.get('applicationDeadline'),
                    'description': job.get('description') or '',
                    'source': 'gupy',
                    'tier': 'free',
                }

                supabase.table('scraped_jobs').insert(record).execute()
                new_count += 1
                logger.debug(f'[gupy] inserido: {company_slug} — {record["title"]}')

            except Exception as exc:
                logger.warning(f'[gupy] supabase error ({company_slug} #{job_id}): {exc}')

    return new_count
