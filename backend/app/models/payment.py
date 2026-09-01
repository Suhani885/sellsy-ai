from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PaymentProposal(Base):
    """A proposed payment, frozen at the moment it was created.

    cart_snapshot captures exactly what was in the cart (item names,
    quantities, prices) at proposal time, so the record stays meaningful
    even if the cart or catalog changes afterward. total_amount is the
    single number a future Razorpay order must be created for — it is
    never recalculated from a live cart after this point, and it was
    itself computed server-side from the database, never from the client.
    """

    __tablename__ = "payment_proposals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id"), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    cart_snapshot: Mapped[list] = mapped_column(JSON, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reasoning: Mapped[str] = mapped_column(Text, nullable=False)

    # proposed -> approved | rejected | expired
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="proposed")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
