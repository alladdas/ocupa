from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    city: str
    linkedin_url: Optional[str] = None
    resume_text: str        # plain text extracted from PDF, for LLM context
    resume_pdf_bytes: bytes  # raw PDF bytes for file-upload fields
    experience_years: int = 0
    seniority: str = 'pleno'              # junior / pleno / senior
    work_model_preference: str = 'remoto' # remoto / hibrido / presencial
    legal_work_auth: bool = True
    gender: str = 'Prefiro não informar'
    race: str = 'Prefiro não informar'
    current_salary: str = 'Prefiro não informar'
    desired_salary: str = 'A combinar'
    availability: str = 'Imediata'

    @property
    def full_name(self) -> str:
        return f'{self.first_name} {self.last_name}'

    model_config = {'arbitrary_types_allowed': True}


class ApplyResult(BaseModel):
    job_id: str
    user_id: str
    status: str  # success / failed / skipped
    source: Optional[str] = None
    error_message: Optional[str] = None
    fields_filled: Optional[list] = None
    applied_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
