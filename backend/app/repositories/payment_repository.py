from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payment import PaymentProposal


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        cart_id: int,
        session_id: str | None,
        cart_snapshot: list,
        total_amount: float,
        reasoning: str,
    ) -> PaymentProposal:
        proposal = PaymentProposal(
            cart_id=cart_id,
            session_id=session_id,
            cart_snapshot=cart_snapshot,
            total_amount=total_amount,
            reasoning=reasoning,
            status="proposed",
        )
        self.db.add(proposal)
        self.db.commit()
        self.db.refresh(proposal)
        return proposal

    def get_by_id(self, proposal_id: int) -> PaymentProposal | None:
        return self.db.get(PaymentProposal, proposal_id)

    def get_all_by_session(self, session_id: str) -> list[PaymentProposal]:
        stmt = (
            select(PaymentProposal)
            .where(PaymentProposal.session_id == session_id)
            .order_by(PaymentProposal.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_all(self) -> list[PaymentProposal]:
        """Every proposal, regardless of session — used for analytics."""
        return list(self.db.execute(select(PaymentProposal)).scalars().all())

    def get_stale_proposed(self, older_than: datetime) -> list[PaymentProposal]:
        """Proposals still 'proposed' (never approved or rejected) since
        before older_than — candidates for checkout-abandonment recovery."""
        stmt = select(PaymentProposal).where(
            PaymentProposal.status == "proposed",
            PaymentProposal.created_at < older_than,
        )
        return list(self.db.execute(stmt).scalars().all())

    def update_status(self, proposal: PaymentProposal, status: str) -> PaymentProposal:
        proposal.status = status
        proposal.decided_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(proposal)
        return proposal
