from datetime import datetime

from pydantic import BaseModel


class AuditEventOut(BaseModel):
    event_type: str
    actor: str  # "user" | "agent" | "system"
    summary: str
    payload: dict | None = None
    created_at: datetime


class AuditTrailOut(BaseModel):
    session_id: str
    events: list[AuditEventOut]
