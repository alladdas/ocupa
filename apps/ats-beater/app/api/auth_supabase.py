"""Supabase-based auth endpoint — primary auth path for Ocupa integration.

Flow:
  1. Ocupa frontend sends its Supabase access token to POST /auth/supabase
  2. We validate it against the Supabase REST API to get the user's identity
  3. We query the Supabase `profiles` table (service role) to get is_pro status
  4. We find or create a local User row keyed on supabase_id
  5. We issue our own short-lived JWT and return it

Subsequent requests use that JWT in Authorization: Bearer <token>,
exactly the same as the Google OAuth flow.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from pydantic import BaseModel

from app.database.session import get_db
from app.config import get_settings
from app.models.user import User
from app.models.credit import UserCredit
from app.services.auth.jwt_handler import create_access_token
from app.exceptions import AuthenticationError

router = APIRouter(prefix="/auth", tags=["auth"])


class SupabaseAuthRequest(BaseModel):
    supabase_access_token: str


@router.post("/supabase")
async def supabase_auth(
    body: SupabaseAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()

    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        raise AuthenticationError("Supabase auth not configured on this server")

    async with httpx.AsyncClient(timeout=10) as client:
        # 1. Validate token + get user identity
        resp = await client.get(
            f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {body.supabase_access_token}",
                "apikey": settings.SUPABASE_ANON_KEY,
            },
        )

    if resp.status_code != 200:
        raise AuthenticationError("Invalid or expired Supabase token")

    data = resp.json()
    supabase_id: str = data["id"]
    email: str = data.get("email") or ""
    meta = data.get("user_metadata") or {}
    name: str = meta.get("full_name") or meta.get("name") or email.split("@")[0]
    picture_url: str | None = meta.get("avatar_url")

    # 2. Check is_pro from Supabase profiles table (service role bypasses RLS)
    is_pro = False
    if settings.SUPABASE_SERVICE_ROLE_KEY:
        async with httpx.AsyncClient(timeout=5) as client:
            pr = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/profiles",
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                },
                params={"id": f"eq.{supabase_id}", "select": "is_pro"},
            )
        if pr.status_code == 200:
            rows = pr.json()
            if rows:
                is_pro = bool(rows[0].get("is_pro", False))

    # 3. Find or create local user row
    result = await db.execute(select(User).where(User.supabase_id == supabase_id))
    user = result.scalar_one_or_none()

    if not user:
        # Also check by email in case the user previously had a Google account
        result_by_email = await db.execute(select(User).where(User.email == email))
        user = result_by_email.scalar_one_or_none()

    if not user:
        user = User(
            supabase_id=supabase_id,
            email=email,
            name=name,
            picture_url=picture_url,
            is_pro=is_pro,
            consent_accepted=True,
            consent_accepted_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        db.add(UserCredit(
            user_id=user.id,
            balance=0,
            daily_free_used=0,
            daily_free_reset_date=datetime.now(timezone.utc).date(),
        ))
        await db.commit()
    else:
        user.supabase_id = supabase_id
        user.name = name
        user.picture_url = picture_url
        user.is_pro = is_pro
        await db.commit()

    token = create_access_token(user.id, user.email)
    return {"access_token": token, "is_pro": is_pro}
