from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.transaction import Payment


class TransactionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_pending(self, proposal_id: int, amount: float, currency: str) -> Payment:
        payment = Payment(
            proposal_id=proposal_id,
            amount=amount,
            currency=currency,
            status="created",
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def create_with_order(
        self, proposal_id: int, razorpay_order_id: str, amount: float, currency: str
    ) -> Payment:
        payment = Payment(
            proposal_id=proposal_id,
            razorpay_order_id=razorpay_order_id,
            amount=amount,
            currency=currency,
            status="created",
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def create_failed(self, proposal_id: int, amount: float, failure_reason: str) -> Payment:
        payment = Payment(
            proposal_id=proposal_id,
            amount=amount,
            currency="INR",
            status="failed",
            failure_reason=failure_reason,
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def get_by_order_id(self, razorpay_order_id: str) -> Payment | None:
        return (
            self.db.query(Payment)
            .filter(Payment.razorpay_order_id == razorpay_order_id)
            .first()
        )

    def get_latest_for_proposal(self, proposal_id: int) -> Payment | None:
        return (
            self.db.query(Payment)
            .filter(Payment.proposal_id == proposal_id)
            .order_by(Payment.created_at.desc())
            .first()
        )

    def mark_success(self, payment: Payment, razorpay_payment_id: str) -> Payment:
        payment.status = "success"
        payment.razorpay_payment_id = razorpay_payment_id
        payment.verified_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def mark_failed(self, payment: Payment, reason: str) -> Payment:
        payment.status = "failed"
        payment.failure_reason = reason
        payment.verified_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(payment)
        return payment
