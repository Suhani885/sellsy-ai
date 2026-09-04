from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RecoveryCase(Base):
    __tablename__ = "recovery_cases"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # "failed_payment" | "abandoned_checkout" | "overdue_invoice" | "subscription_renewal_failed"
    source_type: Mapped[str] = mapped_column(String(30), nullable=False)
    payment_id: Mapped[int | None] = mapped_column(ForeignKey("payments.id"), nullable=True)
    proposal_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_proposals.id"), nullable=True
    )
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("care_plans.id"), nullable=True)
    cart_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    amount_at_risk: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    root_cause: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # detected -> attempting -> recovered | expired | stopped
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="detected", index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    opted_out: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Set when a nudge offers "remind me later" and it's accepted — the
    # escalation ladder pauses until this date instead of sending the next nudge.
    promised_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    recovered_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    last_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RecoveryAction(Base):
    __tablename__ = "recovery_actions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    case_id: Mapped[int] = mapped_column(
        ForeignKey("recovery_cases.id", ondelete="CASCADE"), nullable=False
    )

    # "nudge" | "final_notice" | "promise_to_pay" | "recovered" | "expired" | "stopped"
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    tone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
