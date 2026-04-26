"""
Descobre o companyId de um slug do Gupy.

Abordagem: GET https://{slug}.gupy.io/ e extrai "companyId" do HTML.
Depois verifica no portal público se há vagas abertas para esse ID.

Uso:
  python scripts/discover_company_ids.py vemproitau mlabs totvs
"""

import re
import sys
import requests

PORTAL_BASE = 'https://employability-portal.gupy.io/api/v1/jobs'


def get_company_id(slug: str) -> int | None:
    """Fetch {slug}.gupy.io and extract companyId from embedded JSON."""
    url = f'https://{slug}.gupy.io/'
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return None
        m = re.search(r'"companyId":(\d+)', resp.text)
        return int(m.group(1)) if m else None
    except Exception:
        return None


def portal_count(company_id: int) -> int:
    """Return total jobs on public Gupy portal for this companyId."""
    try:
        resp = requests.get(PORTAL_BASE, params={'companyId': company_id, 'limit': 1}, timeout=10)
        if resp.status_code != 200:
            return -1
        return resp.json().get('pagination', {}).get('total', 0)
    except Exception:
        return -1


def main(slugs: list[str]) -> None:
    print(f'{"slug":<25} {"companyId":<12} {"portal_jobs":<12} {"status"}')
    print('-' * 65)
    for slug in slugs:
        cid = get_company_id(slug)
        if cid is None:
            print(f'{slug:<25} {"—":<12} {"—":<12} NOT FOUND (page 404 or no companyId)')
            continue
        count = portal_count(cid)
        if count == 0:
            status = 'private board (not on public portal)'
        elif count == -1:
            status = 'portal API error'
        else:
            status = f'OK — {count} vagas no portal'
        print(f'{slug:<25} {cid:<12} {count if count >= 0 else "—":<12} {status}')


if __name__ == '__main__':
    slugs = sys.argv[1:] or ['vemproitau', 'mlabs', 'totvs']
    main(slugs)
