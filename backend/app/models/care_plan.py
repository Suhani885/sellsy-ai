import secrets
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _generate_mandate_id() -> str:
    return f"mandate_{secrets.token_hex(6)}"


class CarePlan(Base):
    __tablename__ = "care_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_contact: Mapped[str | None] = mapped_column(String(200), nullable=True)
    plan_name: Mapped[str] = mapped_column(String(200), nullable=False)
    covers: Mapped[str] = mapped_column(String(300), nullable=False)

    amount_per_cycle: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    billing_interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)

    # A stand-in for a real Razorpay e-mandate/UPI Autopay token — this repo
    # never calls a live mandate API, it only simulates the billing cycle.
    mandate_id: Mapped[str] = mapped_column(String(40), nullable=False, default=_generate_mandate_id)

    # active -> cancelled. "Due" is derived (active AND next_billing_at <
    # now), never stored, same reasoning as Invoice.status.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    next_billing_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
