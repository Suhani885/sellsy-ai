from datetime import datetime, timezone

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

    def update_status(self, proposal: PaymentProposal, status: str) -> PaymentProposal:
        proposal.status = status
        proposal.decided_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(proposal)
        return proposal
