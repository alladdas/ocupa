"""
Backfill descriptions for scraped jobs that have no description.

Sources handled:
  greenhouse — GET boards-api.greenhouse.io/v1/boards/{company}/jobs/{id}?questions=true
  gupy       — GET employability-portal.gupy.io/api/v1/jobs/{id}
  amazon     — Re-crawl search.json for Brazil, match by UUID
  alterlab   — creditas via free Gupy API; ifood/dtidigital via AlterLab per-job fetch

Usage:
    python backfill_descriptions.py [--dry-run] [--limit N] [--source SOURCE] [--company COMPANY]
"""

import os
import sys
import time
import logging
import argparse
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

AMAZON_SEARCH_URL = 'https://www.amazon.jobs/en/search.json'
ALTERLAB_URL = 'https://api.alterlab.io/api/v1/scrape'


# ─── Supabase helpers ─────────────────────────────────────────────────────────

def fetch_all_missing(supabase: Client, source_filter: str | None = None, company_filter: str | None = None) -> list[dict]:
    """Paginate through all scraped_jobs rows that have no description."""
    rows: list[dict] = []
    offset = 0
    page = 1000

    while True:
        query = (
            supabase.table('scraped_jobs')
            .select('id, company, source, url')
            .or_('description.is.null,description.eq.')
            .order('source')
            .range(offset, offset + page - 1)
        )
        if source_filter:
            query = query.eq('source', source_filter)
        if company_filter:
            query = query.eq('company', company_filter)

        batch = query.execute().data or []
        rows.extend(batch)
        logger.debug(f'Fetched page offset={offset}: {len(batch)} rows')

        if len(batch) < page:
            break
        offset += page

    return rows


# ─── Amazon bulk pre-fetch ────────────────────────────────────────────────────

def prefetch_amazon_descriptions(missing_ids: set[str]) -> dict[str, str]:
    """Re-crawl amazon.jobs search.json and return {id: description} for missing IDs."""
    results: dict[str, str] = {}
    offset = 0

    logger.info(f'[amazon] Pre-fetching from search.json for {len(missing_ids)} missing IDs...')
    while True:
        try:
            resp = requests.get(
                AMAZON_SEARCH_URL,
                params={
                    'base_query': '',
                    'loc_query': 'Brazil',
                    'job_count': 100,
                    'result_limit': 100,
                    'country': 'BRA',
                    'offset': offset,
                },
                timeout=30,
            )
            if resp.status_code != 200:
                logger.warning(f'[amazon] search.json HTTP {resp.status_code} at offset {offset}')
                break
            jobs = resp.json().get('jobs', [])
        except Exception as exc:
            logger.warning(f'[amazon] search.json error at offset {offset}: {exc}')
            break

        if not jobs:
            break

        for job in jobs:
            job_id = str(job.get('id', '')).strip()
            desc = (job.get('description') or '').strip()
            if job_id in missing_ids and desc:
                results[job_id] = desc

        logger.debug(f'[amazon] offset={offset}: {len(jobs)} API jobs, {len(results)} matched so far')

        if len(jobs) < 100:
            break
        offset += 100
        time.sleep(0.3)

    logger.info(f'[amazon] Pre-fetch done: {len(results)}/{len(missing_ids)} descriptions found')
    return results


# ─── AlterLab per-job fetcher ────────────────────────────────────────────────

def fetch_alterlab_page(url: str) -> str | None:
    """Fetch a job detail page via AlterLab and return plain-text description."""
    api_key = os.environ.get('ALTERLAB_API_KEY', '')
    if not api_key:
        logger.error('ALTERLAB_API_KEY not set — cannot fetch AlterLab descriptions')
        return None

    try:
        resp = requests.post(
            ALTERLAB_URL,
            headers={'X-API-Key': api_key, 'Content-Type': 'application/json'},
            json={
                'url': url,
                'render_js': True,
                'cost_controls': {'prefer_cost': True, 'max_tier': '3'},
                'formats': ['html'],
            },
            timeout=120,
        )
        if resp.status_code != 200:
            logger.debug(f'[alterlab] {url} → HTTP {resp.status_code}')
            return None
        data = resp.json()
    except Exception as exc:
        logger.warning(f'[alterlab] fetch error ({url}): {exc}')
        return None

    raw_html: str = (
        data.get('raw_html')
        or data.get('content', {}).get('html')
        or ''
    )
    if raw_html:
        soup = BeautifulSoup(raw_html, 'html.parser')
        for el in soup.find_all(['nav', 'header', 'footer', 'script', 'style', 'noscript']):
            el.decompose()
        text = soup.get_text(separator=' ', strip=True)
        return text[:12000] if text else None

    text: str = data.get('content', {}).get('text') or data.get('text') or ''
    return text[:12000] if text else None


# ─── Per-source fetchers ──────────────────────────────────────────────────────

def fetch_greenhouse(company: str, job_id: str) -> str | None:
    url = f'https://boards-api.greenhouse.io/v1/boards/{company}/jobs/{job_id}'
    try:
        resp = requests.get(url, params={'questions': 'true'}, timeout=15)
        if resp.status_code == 200:
            return resp.json().get('content') or None
        logger.debug(f'[greenhouse] {company}/{job_id} → HTTP {resp.status_code}')
    except Exception as exc:
        logger.warning(f'[greenhouse] {company}/{job_id} error: {exc}')
    return None


def fetch_gupy(job_id: str) -> str | None:
    url = f'https://employability-portal.gupy.io/api/v1/jobs/{job_id}'
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                data = data[0] if data else {}
            return data.get('description') or None
        logger.debug(f'[gupy] job {job_id} → HTTP {resp.status_code}')
    except Exception as exc:
        logger.warning(f'[gupy] job {job_id} error: {exc}')
    return None


def fetch_alterlab_description(row: dict) -> str | None:
    """
    Dispatch per-company AlterLab backfill strategy:
      creditas  → free Gupy API (numeric ID embedded in row ID)
      ifood     → AlterLab per-job page (URL stored in DB)
      dtidigital → AlterLab per-job page (URL stored in DB)
    """
    company = (row.get('company') or '').lower()
    row_id = str(row['id'])
    url = row.get('url') or ''

    if company == 'creditas':
        # ID format: alterlab-creditas-{gupy_numeric_id}
        parts = row_id.split('-')
        gupy_id = parts[-1] if parts else ''
        if gupy_id.isdigit():
            return fetch_gupy(gupy_id)
        logger.debug(f'[alterlab/creditas] cannot extract Gupy ID from row id: {row_id}')
        return None

    if company in ('ifood', 'dtidigital'):
        if not url:
            logger.debug(f'[alterlab/{company}] no URL for row {row_id}')
            return None
        return fetch_alterlab_page(url)

    logger.debug(f'[alterlab] no backfill strategy for company={company}')
    return None


def fetch_description(row: dict) -> str | None:
    source = (row.get('source') or '').lower()
    job_id = str(row['id'])
    company = (row.get('company') or '').lower().replace(' ', '')

    if source == 'greenhouse':
        return fetch_greenhouse(company, job_id)
    if source == 'gupy':
        return fetch_gupy(job_id)
    if source == 'alterlab':
        return fetch_alterlab_description(row)

    logger.debug(f'No fetcher for source="{source}" job {job_id}')
    return None


# ─── Main ─────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False, limit: int = 0, source_filter: str | None = None, company_filter: str | None = None) -> None:
    supabase: Client = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])

    rows = fetch_all_missing(supabase, source_filter, company_filter)
    if limit > 0:
        rows = rows[:limit]

    total = len(rows)
    label_parts = []
    if source_filter:
        label_parts.append(f'source={source_filter}')
    if company_filter:
        label_parts.append(f'company={company_filter}')
    label = f' ({", ".join(label_parts)})' if label_parts else ''
    logger.info(f'Found {total} jobs without description{label}')
    if total == 0:
        logger.info('Nothing to backfill.')
        return

    # Pre-fetch Amazon descriptions in bulk
    amazon_cache: dict[str, str] = {}
    amazon_rows = [r for r in rows if r.get('source') == 'amazon']
    if amazon_rows:
        missing_amazon_ids = {str(r['id']) for r in amazon_rows}
        amazon_cache = prefetch_amazon_descriptions(missing_amazon_ids)

    updated = skipped = failed = 0

    for i, row in enumerate(rows, start=1):
        job_id = str(row['id'])
        source = (row.get('source') or '').lower()
        company = (row.get('company') or '').lower().replace(' ', '')
        label = f'{company} #{job_id} ({source})'

        description: str | None = None

        if source == 'greenhouse':
            description = fetch_greenhouse(company, job_id)
            time.sleep(0.3)
        elif source == 'gupy':
            description = fetch_gupy(job_id)
            time.sleep(0.3)
        elif source == 'amazon':
            description = amazon_cache.get(job_id)
        elif source == 'alterlab':
            description = fetch_alterlab_description(row)
            time.sleep(0.5)
        else:
            logger.debug(f'Skipping source="{source}" for {label}')
            skipped += 1

        if description is None and source != 'alterlab':
            failed += 1
        elif description is None:
            failed += 1
        elif dry_run:
            snippet = description[:80].replace('\n', ' ')
            logger.info(f'[{i}/{total}] DRY RUN — {label}: "{snippet}…"')
            updated += 1
        else:
            try:
                supabase.table('scraped_jobs').update({'description': description}).eq('id', job_id).execute()
                updated += 1
            except Exception as exc:
                logger.warning(f'[{i}/{total}] Supabase error for {label}: {exc}')
                failed += 1

        if i % 50 == 0 or i == total:
            logger.info(f'Progress: {i}/{total} — updated={updated} skipped={skipped} failed={failed}')

    logger.info(f'Done. updated={updated} skipped={skipped} failed={failed} total={total}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Backfill job descriptions')
    parser.add_argument('--dry-run', action='store_true', help='Fetch but do not write to Supabase')
    parser.add_argument('--limit', type=int, default=0, help='Max jobs to process (0 = all)')
    parser.add_argument('--source', default=None, help='Filter by source (greenhouse, gupy, amazon, alterlab)')
    parser.add_argument('--company', default=None, help='Filter by company slug')
    args = parser.parse_args()

    try:
        main(dry_run=args.dry_run, limit=args.limit, source_filter=args.source, company_filter=args.company)
    except KeyboardInterrupt:
        logger.info('Interrupted.')
        sys.exit(0)
