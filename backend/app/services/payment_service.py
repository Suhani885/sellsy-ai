"""
PaymentService orchestrates the payment *proposal* lifecycle. It does not
talk to Razorpay yet — that's the next phase. What it does do:

  1. Fetch the cart's server-computed total via CartService (never trusts
     a client-supplied amount).
  2. Run it through the guardrail engine — deterministic checks, no LLM.
  3. If it passes, freeze a snapshot of the cart and create a
     PaymentProposal record with a plain-language reasoning string.
  4. Expose approve/reject to record a human decision on that proposal.

Approving a proposal right now only changes its status — it does not move
money. That's intentional: the whole point of this phase is that the
proposal + approval step exists and is auditable *before* any payment
gateway is wired in.
"""
from sqlalchemy.orm import Session

from app.policies.guardrail_engine import build_reasoning, run_guardrails
from app.repositories.payment_repository import PaymentRepository
from app.schemas.payment import PaymentProposalOut
from app.services.cart_service import CartService
from app.utils.exceptions import ConflictError, NotFoundError


class PaymentService:
    def __init__(self, db: Session):
        self.repo = PaymentRepository(db)
        self.cart_service = CartService(db)

    def propose_payment(self, cart_id: int) -> PaymentProposalOut:
        cart = self.cart_service.get_cart(cart_id)  # raises NotFoundError if missing

        run_guardrails(cart)  # raises PolicyViolationError on any violation

        reasoning = build_reasoning(cart)
        snapshot = [item.model_dump(mode="json") for item in cart.items]

        proposal = self.repo.create(
            cart_id=cart.id,
            session_id=cart.session_id,
            cart_snapshot=snapshot,
            total_amount=cart.total,
            reasoning=reasoning,
        )
        return self._to_out(proposal)

    def get_proposal(self, proposal_id: int) -> PaymentProposalOut:
        proposal = self._get_or_404(proposal_id)
        return self._to_out(proposal)

    def approve(self, proposal_id: int) -> PaymentProposalOut:
        proposal = self._get_or_404(proposal_id)
        self._ensure_pending(proposal)
        updated = self.repo.update_status(proposal, "approved")
        return self._to_out(updated)

    def reject(self, proposal_id: int) -> PaymentProposalOut:
        proposal = self._get_or_404(proposal_id)
        self._ensure_pending(proposal)
        updated = self.repo.update_status(proposal, "rejected")
        return self._to_out(updated)

    def _get_or_404(self, proposal_id: int):
        proposal = self.repo.get_by_id(proposal_id)
        if proposal is None:
            raise NotFoundError(f"Payment proposal {proposal_id} was not found.")
        return proposal

    def _ensure_pending(self, proposal) -> None:
        if proposal.status != "proposed":
            raise ConflictError(
                f"Payment proposal {proposal.id} is already '{proposal.status}' "
                "and cannot be decided on again."
            )

    def _to_out(self, proposal) -> PaymentProposalOut:
        return PaymentProposalOut(
            id=proposal.id,
            cart_id=proposal.cart_id,
            session_id=proposal.session_id,
            cart_snapshot=proposal.cart_snapshot,
            total_amount=float(proposal.total_amount),
            reasoning=proposal.reasoning,
            status=proposal.status,
            created_at=proposal.created_at,
            decided_at=proposal.decided_at,
        )
