"""
PaymentService orchestrates the full payment lifecycle:

  1. propose_payment: run guardrails against a server-computed cart total,
     freeze a snapshot, create a PaymentProposal.
  2. approve: record the human's approval decision, then create a real
     Razorpay order for the proposal's total. If Razorpay order creation
     fails, that failure is recorded and returned cleanly — never
     retried automatically, never silently swallowed.
  3. verify_payment: after the user completes Razorpay Checkout, verify
     the payment signature server-side before marking anything as
     actually paid. The frontend's own "success" callback is never
     trusted on its own.
  4. reject: record a cancellation.

Every amount that reaches Razorpay comes from proposal.total_amount, which
was itself computed server-side from the database back in CartService —
never from anything the client sends at this stage.
"""
from sqlalchemy.orm import Session

from app.policies.guardrail_engine import build_reasoning, run_guardrails
from app.repositories.payment_repository import PaymentRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.payment import ApprovalResult, PaymentProposalOut, TransactionOut
from app.services.cart_service import CartService
from app.services.razorpay_service import RazorpayError, RazorpayService
from app.config.settings import settings
from app.utils.exceptions import ConflictError, NotFoundError, PaymentVerificationError


class PaymentService:
    def __init__(self, db: Session, razorpay_service: RazorpayService | None = None):
        self.repo = PaymentRepository(db)
        self.transaction_repo = TransactionRepository(db)
        self.cart_service = CartService(db)
        self.razorpay_service = razorpay_service or RazorpayService()

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
        return self._proposal_to_out(proposal)

    def get_proposal(self, proposal_id: int) -> PaymentProposalOut:
        proposal = self._get_proposal_or_404(proposal_id)
        return self._proposal_to_out(proposal)

    def approve(self, proposal_id: int) -> ApprovalResult:
        proposal = self._get_proposal_or_404(proposal_id)
        self._ensure_pending(proposal)

        approved = self.repo.update_status(proposal, "approved")
        amount = float(approved.total_amount)

        try:
            order = self.razorpay_service.create_order(
                amount_rupees=amount, receipt=f"proposal-{approved.id}"
            )
        except RazorpayError as exc:
            # Explicit failure path: record it, do not retry, do not create
            # another order. The user can start a fresh proposal if they
            # want to try again.
            failed_payment = self.transaction_repo.create_failed(
                proposal_id=approved.id, amount=amount, failure_reason=str(exc)
            )
            return ApprovalResult(
                proposal=self._proposal_to_out(approved),
                payment=self._transaction_to_out(failed_payment),
                razorpay_key_id=None,
            )

        payment = self.transaction_repo.create_with_order(
            proposal_id=approved.id,
            razorpay_order_id=order["id"],
            amount=amount,
            currency=order.get("currency", "INR"),
        )

        return ApprovalResult(
            proposal=self._proposal_to_out(approved),
            payment=self._transaction_to_out(payment),
            razorpay_key_id=settings.razorpay_key_id or None,
        )

    def reject(self, proposal_id: int) -> PaymentProposalOut:
        proposal = self._get_proposal_or_404(proposal_id)
        self._ensure_pending(proposal)
        updated = self.repo.update_status(proposal, "rejected")
        return self._proposal_to_out(updated)

    def verify_payment(
        self,
        proposal_id: int,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> TransactionOut:
        proposal = self._get_proposal_or_404(proposal_id)

        payment = self.transaction_repo.get_by_order_id(razorpay_order_id)
        if payment is None or payment.proposal_id != proposal.id:
            raise NotFoundError(
                "No matching payment attempt was found for this proposal and order."
            )

        if payment.status == "success":
            return self._transaction_to_out(payment)  # idempotent — already verified

        is_valid = self.razorpay_service.verify_payment_signature(
            razorpay_order_id, razorpay_payment_id, razorpay_signature
        )

        if not is_valid:
            failed = self.transaction_repo.mark_failed(
                payment, "Payment signature verification failed."
            )
            self._transaction_to_out(failed)  # build for consistency, but we raise
            raise PaymentVerificationError(
                "Payment could not be verified. No charge has been confirmed."
            )

        updated = self.transaction_repo.mark_success(payment, razorpay_payment_id)
        return self._transaction_to_out(updated)

    def _get_proposal_or_404(self, proposal_id: int):
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

    def _proposal_to_out(self, proposal) -> PaymentProposalOut:
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

    def _transaction_to_out(self, payment) -> TransactionOut:
        return TransactionOut(
            id=payment.id,
            proposal_id=payment.proposal_id,
            razorpay_order_id=payment.razorpay_order_id,
            razorpay_payment_id=payment.razorpay_payment_id,
            amount=float(payment.amount),
            currency=payment.currency,
            status=payment.status,
            failure_reason=payment.failure_reason,
            created_at=payment.created_at,
            verified_at=payment.verified_at,
        )
