from datetime import datetime

from pydantic import BaseModel, Field


class CarePlanCreate(BaseModel):
    customer_name: str = Field(max_length=200)
    customer_contact: str | None = Field(default=None, max_length=200)
    plan_name: str = Field(max_length=200)
    covers: str = Field(max_length=300)
    amount_per_cycle: float = Field(gt=0)
    billing_interval_days: int = Field(default=30, ge=7, le=365)


class CarePlanOut(BaseModel):
    id: int
    customer_name: str
    customer_contact: str | None
    plan_name: str
    covers: str
    amount_per_cycle: float
    billing_interval_days: int
    mandate_id: str
    status: str
    is_renewal_due: bool
    next_billing_at: datetime
    created_at: datetime
