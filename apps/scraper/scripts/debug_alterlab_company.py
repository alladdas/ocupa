"""
Debug runner: runs the AlterLab scraper for a single company without inserting
into Supabase. Prints extracted jobs and the raw AlterLab response.

Usage:
  python scripts/debug_alterlab_company.py mercadolivre
  python scripts/debug_alterlab_company.py creditas --show-raw
"""
import sys
import json
import logging
import argparse
from pathlib import Path

# Make scrapers importable from project root
sys.path.insert(0, str(Path(__file__).parent.parent))

from scrapers.alterlab import COMPANIES, _scrape, _extract_jobs

logging.basicConfig(level=logging.DEBUG, format='%(levelname)s %(message)s')

OUTPUT_DIR = Path(__file__).parent / 'discovery_cache'
OUTPUT_DIR.mkdir(exist_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('company', help='Company slug (must be in COMPANIES dict)')
    parser.add_argument('--show-raw', action='store_true', help='Print raw AlterLab response')
    args = parser.parse_args()

    slug = args.company
    if slug not in COMPANIES:
        print(f'ERROR: "{slug}" not in COMPANIES. Available: {list(COMPANIES.keys())}')
        sys.exit(1)

    config = COMPANIES[slug]
    url = config['url']
    render_js = config.get('render_js', False)
    formats = config.get('formats')
    company_type = config['type']

    print(f'\n{"=" * 60}')
    print(f'Company : {slug}')
    print(f'URL     : {url}')
    print(f'Type    : {company_type}')
    print(f'JS      : {render_js}  |  Formats: {formats}')
    print(f'{"=" * 60}\n')

    print('Calling AlterLab API...')
    response = _scrape(url, render_js=render_js, formats=formats)

    if response is None:
        print('ERROR: AlterLab returned None (check ALTERLAB_API_KEY and logs)')
        sys.exit(1)

    # Save raw response
    raw_path = OUTPUT_DIR / f'{slug}_alterlab_raw.json'
    with open(raw_path, 'w', encoding='utf-8') as f:
        json.dump(response, f, ensure_ascii=False, indent=2)
    print(f'Raw response saved to {raw_path.name}')

    if args.show_raw:
        print('\n--- RAW RESPONSE (first 2000 chars) ---')
        print(json.dumps(response, ensure_ascii=False)[:2000])

    # Show response keys and content type
    print('\n--- RESPONSE KEYS ---')
    for k, v in response.items():
        if isinstance(v, dict):
            print(f'  {k}: dict with keys {list(v.keys())}')
        elif isinstance(v, list):
            print(f'  {k}: list ({len(v)} items)')
        elif isinstance(v, str):
            print(f'  {k}: str ({len(v)} chars) — {repr(v[:80])}')
        else:
            print(f'  {k}: {type(v).__name__} = {repr(v)[:80]}')

    # Extract jobs using the existing logic
    print('\n--- EXTRACTING JOBS ---')
    jobs = _extract_jobs(slug, company_type, url, response)

    print(f'\nExtracted: {len(jobs)} jobs\n')

    # Display samples
    for i, j in enumerate(jobs[:20]):
        print(f'  [{i+1:02d}] {j["title"][:70]:<70} | {j["location"][:25]:<25} | {j["url"][:60]}')

    if len(jobs) > 20:
        print(f'  ... and {len(jobs) - 20} more')

    # Save output
    output_path = OUTPUT_DIR / f'{slug}_alterlab_output.txt'
    lines = [f'Company: {slug}', f'URL: {url}', f'Total jobs: {len(jobs)}', '']
    for i, j in enumerate(jobs):
        lines.append(f'[{i+1:03d}] {j["title"]} | {j["location"]} | {j["url"]}')
    output_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f'\nFull output saved to {output_path.name}')


if __name__ == '__main__':
    main()
