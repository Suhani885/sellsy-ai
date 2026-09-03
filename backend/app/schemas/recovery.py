from datetime import datetime

from pydantic import BaseModel, Field


class RecoveryActionOut(BaseModel):
    id: int
    case_id: int
    action_type: str
    tone: str | None
    message: str | None
    created_at: datetime


class RecoveryCaseOut(BaseModel):
    id: int
    source_type: str
    payment_id: int | None
    proposal_id: int | None
    cart_id: int
    session_id: str | None
    amount_at_risk: float
    root_cause: str | None
    status: str
    attempts: int
    opted_out: bool
    promised_retry_at: datetime | None
    recovered_amount: float | None
    created_at: datetime
    last_action_at: datetime | None
    resolved_at: datetime | None


class RecoveryCaseDetailOut(RecoveryCaseOut):
    actions: list[RecoveryActionOut] = []


class RunBatchRequest(BaseModel):
    tone: str = Field(default="standard", pattern="^(standard|hinglish|voice_hinglish)$")


class RecoveryBatchResult(BaseModel):
    cases_detected: int
    cases_actioned: int
    cases_stopped: int


class PromiseToPayRequest(BaseModel):
    promised_retry_at: datetime


class RecoverySummaryOut(BaseModel):
    total_cases: int
    open_cases: int
    amount_at_risk: float
    recovered_cases: int
    recovered_amount: float
    recovery_rate: float


class RecoveryDiagnosisRaw(BaseModel):
    root_cause: str
    message: str
