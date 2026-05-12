"""
Auto-apply entrypoint.

apply_for_user(job_id, user_id, supabase_url, supabase_key, gemini_api_key)

1. Fetch job row from scraped_jobs
2. Fetch user profile (profiles + primary resume)
3. Download PDF from Supabase Storage
4. Extract plain text from PDF with pdfminer
5. Build UserProfile
6. Dispatch to the right source handler
7. Save ApplyResult to apply_results table
"""

from __future__ import annotations

import io
import logging
import os
from typing import Optional

from dotenv import load_dotenv
from pdfminer.high_level import extract_text as pdf_extract_text
from supabase import create_client, Client

from greenhouse import apply_with_agent
from gupy import apply_gupy
from models import ApplyResult, UserProfile

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

_SENIORITY_YEARS = {'junior': 1, 'pleno': 3, 'senior': 6}


# ── PDF helpers ───────────────────────────────────────────────────────────────

def _pdf_bytes_to_text(pdf_bytes: bytes) -> str:
    try:
        return pdf_extract_text(io.BytesIO(pdf_bytes)).strip()
    except Exception as exc:
        logger.warning(f'pdfminer extraction failed: {exc}')
        return ''


# ── Supabase queries ──────────────────────────────────────────────────────────

def _fetch_job(supabase: Client, job_id: str) -> Optional[dict]:
    row = supabase.table('scraped_jobs').select('*').eq('id', job_id).single().execute()
    return row.data if row.data else None


def _fetch_profile(supabase: Client, user_id: str) -> Optional[dict]:
    row = (
        supabase.table('profiles')
        .select('first_name, last_name, phone, city, linkedin_url, seniority, work_model, gender, race, ats_profile_id')
        .eq('id', user_id)
        .single()
        .execute()
    )
    return row.data if row.data else None


def _fetch_primary_resume(supabase: Client, user_id: str) -> Optional[dict]:
    row = (
        supabase.table('resumes')
        .select('file_url, file_name')
        .eq('user_id', user_id)
        .eq('is_primary', True)
        .single()
        .execute()
    )
    return row.data if row.data else None


def _fetch_user_email(supabase: Client, user_id: str) -> str:
    """Fetch email from auth.users via service-role API."""
    try:
        user = supabase.auth.admin.get_user_by_id(user_id)
        return user.user.email or ''
    except Exception as exc:
        logger.warning(f'Could not fetch user email for {user_id}: {exc}')
        return ''


def _download_pdf(supabase: Client, storage_path: str) -> Optional[bytes]:
    try:
        return supabase.storage.from_('resumes').download(storage_path)
    except Exception as exc:
        logger.warning(f'Storage download failed ({storage_path}): {exc}')
        return None


def _save_result(supabase: Client, result: ApplyResult) -> None:
    try:
        supabase.table('apply_results').insert({
            'job_id': result.job_id,
            'user_id': result.user_id,
            'status': result.status,
            'source': result.source,
            'error_message': result.error_message,
            'applied_at': result.applied_at.isoformat(),
        }).execute()
    except Exception as exc:
        logger.warning(f'Could not save apply_result: {exc}')


# ── Main entry point ──────────────────────────────────────────────────────────

def apply_for_user(
    job_id: str,
    user_id: str,
    supabase_url: str,
    supabase_key: str,
    gemini_api_key: str,
) -> ApplyResult:
    supabase = create_client(supabase_url, supabase_key)

    # 1. Fetch job
    job = _fetch_job(supabase, job_id)
    if not job:
        result = ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            error_message=f'Job {job_id} not found in scraped_jobs',
        )
        _save_result(supabase, result)
        return result

    source: str = (job.get('source') or '').lower()

    if source not in ('greenhouse', 'gupy'):
        result = ApplyResult(
            job_id=job_id, user_id=user_id, status='skipped',
            source=source, error_message=f'Auto-apply not supported for source={source!r}',
        )
        _save_result(supabase, result)
        return result

    # 2. Fetch profile
    profile = _fetch_profile(supabase, user_id)
    if not profile:
        result = ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source=source, error_message=f'Profile not found for user {user_id}',
        )
        _save_result(supabase, result)
        return result

    # 3. Fetch primary resume
    resume_row = _fetch_primary_resume(supabase, user_id)
    if not resume_row:
        result = ApplyResult(
            job_id=job_id, user_id=user_id, status='failed',
            source=source, error_message='No primary resume found — user must upload a CV first',
        )
        _save_result(supabase, result)
        return result

    # 4. Download PDF from Storage
    pdf_bytes = _download_pdf(supabase, resume_row['file_url'])
    if not pdf_bytes:
        result = ApplyResult(
            job_id=job_id, user_id=user_id, status='failed', source=source,
            error_message=f'Could not download resume from storage: {resume_row["file_url"]}',
        )
        _save_result(supabase, result)
        return result

    # 5. Extract text from PDF
    resume_text = _pdf_bytes_to_text(pdf_bytes)

    # 6. Fetch email from auth.users
    email = _fetch_user_email(supabase, user_id)

    # 7. Build UserProfile
    seniority = (profile.get('seniority') or 'pleno').lower()
    user = UserProfile(
        first_name=profile.get('first_name') or '',
        last_name=profile.get('last_name') or '',
        email=email,
        phone=profile.get('phone') or '',
        city=profile.get('city') or '',
        linkedin_url=profile.get('linkedin_url'),
        resume_text=resume_text,
        resume_pdf_bytes=pdf_bytes,
        experience_years=_SENIORITY_YEARS.get(seniority, 3),
        seniority=seniority,
        work_model_preference=(profile.get('work_model') or 'remoto').lower(),
        legal_work_auth=True,
        gender=profile.get('gender') or 'Prefiro não informar',
        race=profile.get('race') or 'Prefiro não informar',
    )

    logger.info(f'[main] applying for user {user_id} → job {job_id} ({source})')

    # 8. Dispatch by source
    if source == 'greenhouse':
        result = apply_with_agent(job, user, gemini_api_key, user_id=user_id, supabase=supabase)
    elif source == 'gupy':
        result = apply_gupy(job, user, gemini_api_key, user_id=user_id)
    else:
        result = ApplyResult(job_id=job_id, user_id=user_id, status='skipped', source=source)

    logger.info(f'[main] result: status={result.status} error={result.error_message!r}')

    # 9. Persist result
    _save_result(supabase, result)
    return result


if __name__ == '__main__':
    import sys

    if len(sys.argv) < 3:
        print('Usage: python main.py <job_id> <user_id>')
        sys.exit(1)

    result = apply_for_user(
        job_id=sys.argv[1],
        user_id=sys.argv[2],
        supabase_url=os.environ['SUPABASE_URL'],
        supabase_key=os.environ['SUPABASE_KEY'],
        gemini_api_key=os.environ['GEMINI_API_KEY'],
    )
    print(result.model_dump_json(indent=2))
