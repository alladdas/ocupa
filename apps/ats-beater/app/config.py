import os

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/custom_resume_dev"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_db_url(cls, v: str) -> str:
        # Railway/Supabase inject plain postgresql:// or postgres:// — normalize to asyncpg scheme
        v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        if v.startswith("postgresql://"):
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    # AI
    GEMINI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""  # ADK reads this env var for Google AI API auth
    GEMINI_FLASH_MODEL: str = "gemini-3-flash-preview"
    GEMINI_PRO_MODEL: str = "gemini-3.1-pro-preview"

    # Auth — legacy Google OAuth (kept for backward compat)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    JWT_SECRET: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 24

    # Supabase Auth (primary auth path for Ocupa integration)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Razorpay (legacy — credit system bypassed for is_pro users)
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Credits
    DAILY_FREE_CREDITS: int = 3

    # Storage
    GCS_BUCKET: str = "your-gcs-bucket"
    GCS_CREDENTIALS_PATH: str = "credentials/gcs-service-account.json"

    # LaTeX
    LATEX_BIN_PATH: str = "/Library/TeX/texbin"

    # App
    ENVIRONMENT: str = "DEV"
    FRONTEND_URL: str = "http://localhost:8000"
    # Comma-separated list of extra CORS origins (e.g. Vercel preview URLs).
    # FRONTEND_URL is always included; no need to repeat it here.
    CORS_EXTRA_ORIGINS: str = ""
    DEV_AUTH_BYPASS: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Google ADK reads GOOGLE_API_KEY from os.environ (not from Pydantic fields).
    # Ensure it's set so the ADK Runner can create genai.Client() without explicit api_key.
    if settings.GOOGLE_API_KEY and not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings.GOOGLE_API_KEY
    return settings
