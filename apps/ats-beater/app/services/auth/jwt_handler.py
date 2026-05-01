from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.config import get_settings
from app.exceptions import AuthenticationError


def create_access_token(user_id: str, email: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise AuthenticationError("token_invalid")


def decode_expired_token(token: str) -> dict[str, Any]:
    """Decode without verifying expiry — used only for token refresh."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
    except jwt.PyJWTError:
        raise AuthenticationError("token_invalid")
