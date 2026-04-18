"""
Backfill descriptions for scraped jobs that have no description.

Usage:
    python backfill_descriptions.py [--dry-run] [--limit N]
"""

import os
import sys
import time
import logging
import argparse
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)


# ─── Fetchers ─────────────────────────────────────────────────────────────────

def fetch_greenhouse(company: str, job_id: str) -> str | None:
    """Fetch job description from Greenhouse public API."""
    url = f'https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}'
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            return resp.json().get('content') or None
        logger.debug(f'[greenhouse] {company}/{job_id} → HTTP {resp.status_code}')
    except Exception as exc:
        logger.warning(f'[greenhouse] {company}/{job_id} fetch error: {exc}')
    return None


def fetch_gupy(job_id: str) -> str | None:
    """Fetch job description from Gupy employability portal."""
    url = f'https://employability-portal.gupy.io/api/v1/jobs/{job_id}'
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            # API may return a list or a single object
            if isinstance(data, list):
                data = data[0] if data else {}
            return data.get('description') or None
        logger.debug(f'[gupy] job {job_id} → HTTP {resp.status_code}')
    except Exception as exc:
        logger.warning(f'[gupy] job {job_id} fetch error: {exc}')
    return None


def fetch_description(row: dict) -> str | None:
    source = (row.get('source') or '').lower()
    job_id = str(row['id'])
    company = (row.get('company') or '').lower().replace(' ', '')

    if source == 'greenhouse':
        return fetch_greenhouse(company, job_id)
    if source == 'gupy':
        return fetch_gupy(job_id)

    logger.debug(f'Unknown source "{source}" for job {job_id} — skipping')
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False, limit: int = 0) -> None:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

    # Fetch all jobs missing a description
    query = (
        supabase.table('scraped_jobs')
        .select('id, title, company, source')
        .or_('description.is.null,description.eq.')
        .order('posted_at', desc=True)
    )
    if limit > 0:
        query = query.limit(limit)

    result = query.execute()
    rows = result.data or []

    total = len(rows)
    logger.info(f'Found {total} jobs without description')

    if total == 0:
        logger.info('Nothing to backfill.')
        return

    updated = 0
    failed = 0

    for i, row in enumerate(rows, start=1):
        job_id = str(row['id'])
        label = f'{row["company"]} #{job_id} ({row["source"]})'

        description = fetch_description(row)

        if not description:
            logger.debug(f'[{i}/{total}] No description found for {label}')
            failed += 1
        elif dry_run:
            snippet = description[:80].replace('\n', ' ')
            logger.info(f'[{i}/{total}] DRY RUN — would update {label}: "{snippet}…"')
            updated += 1
        else:
            try:
                supabase.table('scraped_jobs').update({'description': description}).eq('id', job_id).execute()
                updated += 1
            except Exception as exc:
                logger.warning(f'[{i}/{total}] Supabase update failed for {label}: {exc}')
                failed += 1

        if i % 10 == 0 or i == total:
            logger.info(f'Progress: {i}/{total} — updated={updated} failed/skipped={failed}')

        # Polite rate limiting
        time.sleep(0.25)

    logger.info(f'Done. updated={updated} failed/skipped={failed} total={total}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Backfill job descriptions from ATS APIs')
    parser.add_argument('--dry-run', action='store_true', help='Fetch but do not write to Supabase')
    parser.add_argument('--limit', type=int, default=0, help='Max jobs to process (0 = all)')
    args = parser.parse_args()

    try:
        main(dry_run=args.dry_run, limit=args.limit)
    except KeyboardInterrupt:
        logger.info('Interrupted.')
        sys.exit(0)
