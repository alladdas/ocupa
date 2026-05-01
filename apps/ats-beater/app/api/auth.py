from typing import Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.services.auth.jwt_handler import decode_expired_token
from app.dependencies import get_current_user
from app.exceptions import AuthenticationError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/refresh")
async def refresh_token(
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Issue a fresh JWT. Accepts expired tokens (signature must still be valid)."""
    from app.services.auth.jwt_handler import create_access_token
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthenticationError("token_invalid")
    token = authorization[7:]
    payload = decode_expired_token(token)
    user = await db.get(User, payload["sub"])
    if not user:
        raise AuthenticationError("token_invalid")
    new_token = create_access_token(user.id, user.email)
    return {"access_token": new_token}


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant_name = None
    if current_user.tenant_id:
        tenant = await db.get(Tenant, current_user.tenant_id)
        if tenant:
            tenant_name = tenant.name
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "picture_url": current_user.picture_url,
        "consent_accepted": current_user.consent_accepted,
        "is_super_admin": current_user.is_super_admin,
        "tenant_id": current_user.tenant_id,
        "tenant_name": tenant_name,
    }
