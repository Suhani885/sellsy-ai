from datetime import datetime

from pydantic import BaseModel, Field


class ProposePaymentRequest(BaseModel):
    cart_id: int


class PaymentProposalOut(BaseModel):
    id: int
    cart_id: int
    session_id: str | None
    cart_snapshot: list
    total_amount: float
    reasoning: str
    status: str
    created_at: datetime
    decided_at: datetime | None = None


class PaymentDecisionRequest(BaseModel):
    """Body for approve/reject — currently empty, but kept as a real model
    so a reason/note field can be added later without breaking the route
    signature."""

    note: str | None = Field(default=None, max_length=500)
