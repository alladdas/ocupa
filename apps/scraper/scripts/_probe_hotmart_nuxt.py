"""
Find the Hotmart jobs API endpoint by inspecting window.__NUXT__ and JS bundles.
"""
import re
import json
import requests
from bs4 import BeautifulSoup

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0 Safari/537.36',
    'Accept': 'text/html,*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9',
}

print('=== Fetching Hotmart PT-BR careers page ===')
r = requests.get('https://hotmart.com/pt-br/trabalhe-conosco/vagas', headers=HEADERS, timeout=20)
soup = BeautifulSoup(r.text, 'html.parser')

# Extract window.__NUXT__ inline script
nuxt_script = None
for script in soup.find_all('script', src=False):
    text = script.get_text()
    if 'window.__NUXT__' in text:
        nuxt_script = text
        break

if nuxt_script:
    print(f'window.__NUXT__ script: {len(nuxt_script)} chars')
    # Search for job-like data patterns
    job_ids = re.findall(r'"id":\s*(\d{8,12})', nuxt_script)
    print(f'Potential job IDs in __NUXT__: {len(job_ids)}')
    for jid in job_ids[:10]:
        print(f'  {jid}')

    # Search for API URL patterns
    api_urls = re.findall(r'"(https?://[^"]{20,120}(?:api|job|career|vaga)[^"]{0,60})"', nuxt_script, re.I)
    print(f'\nAPI-like URLs in __NUXT__:')
    for u in sorted(set(api_urls))[:20]:
        print(f'  {u}')

    # Search for job title patterns
    titles = re.findall(r'"title"\s*:\s*"([^"]{5,80})"', nuxt_script)
    print(f'\nTitle fields: {len(titles)}')
    for t in titles[:10]:
        print(f'  {t}')

    # Look for array of job objects
    job_arr = re.findall(r'\[(\{"id":\d+.{0,300})\]', nuxt_script, re.S)
    print(f'\nPotential job arrays: {len(job_arr)}')
    for a in job_arr[:2]:
        print(f'  {a[:200]}')
else:
    print('No window.__NUXT__ script found')

print()
print('=== Checking JS bundles for API endpoint ===')
# Fetch one of the main JS bundles
js_url = 'https://hotmart.com/static/app-hotmart-jobs/f8379b8.js'
rjs = requests.get(js_url, headers={'User-Agent': HEADERS['User-Agent']}, timeout=15)
print(f'JS bundle: HTTP {rjs.status_code} | {len(rjs.text)} chars')

# Look for API base URL patterns
api_patterns = re.findall(r'["\`](/[a-z-]+/api/[^"\`\s]{5,60})["\`]', rjs.text, re.I)
base_urls = re.findall(r'["\`](https?://[^"\`\s]{10,80}[/.]api[/.]?[^"\`\s]{0,60})["\`]', rjs.text, re.I)
fetch_calls = re.findall(r'(?:fetch|axios\.get)\([`"](\/[^`"]+)[`"]', rjs.text)

print(f'  /api/ paths: {len(api_patterns)}')
for u in sorted(set(api_patterns))[:10]:
    print(f'    {u}')
print(f'  External API URLs: {len(base_urls)}')
for u in sorted(set(base_urls))[:10]:
    print(f'    {u}')
print(f'  fetch() calls: {len(fetch_calls)}')
for u in fetch_calls[:5]:
    print(f'    {u}')
