from datetime import datetime

from pydantic import BaseModel, Field


class InvoiceCreate(BaseModel):
    customer_name: str = Field(max_length=200)
    customer_contact: str | None = Field(default=None, max_length=200)
    description: str = Field(max_length=1000)
    amount_due: float = Field(gt=0)
    payment_terms_days: int = Field(default=15, ge=1, le=90)


class InvoiceOut(BaseModel):
    id: int
    customer_name: str
    customer_contact: str | None
    description: str
    amount_due: float
    payment_terms_days: int
    status: str
    is_overdue: bool
    issued_at: datetime
    due_at: datetime
    paid_at: datetime | None
