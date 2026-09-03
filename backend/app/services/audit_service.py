"""
Reconstructs an audit trail for a session from data already recorded
elsewhere — conversation turns and payment proposal/transaction history.
There's no separate audit_log table: every event is derived from a row
written for its own functional reason, so the trail can't drift out of
sync with what actually happened.

PRODUCT_SEARCH and POLICY_VALIDATION events are synthesized rather than
read from a dedicated log row, since the retrieval step and guardrail
checks necessarily ran before the recommendation or proposal could exist.
"""
from sqlalchemy.orm import Session

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.payment_repository import PaymentRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.audit import AuditEventOut, AuditTrailOut


class AuditService:
    def __init__(self, db: Session):
        self.conversation_repo = ConversationRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.transaction_repo = TransactionRepository(db)

    def get_trail(self, session_id: str) -> AuditTrailOut:
        events: list[AuditEventOut] = []

        events.extend(self._events_from_conversation(session_id))
        events.extend(self._events_from_payments(session_id))

        # Stable sort: for equal timestamps, the append order above
        # (search before recommendation, validation before proposal) is
        # preserved.
        events.sort(key=lambda e: e.created_at)

        return AuditTrailOut(session_id=session_id, events=events)

    def _events_from_conversation(self, session_id: str) -> list[AuditEventOut]:
        events: list[AuditEventOut] = []
        messages = self.conversation_repo.get_all(session_id)

        for message in messages:
            if message.role == "user":
                events.append(
                    AuditEventOut(
                        event_type="USER_REQUEST",
                        actor="user",
                        summary=message.content,
                        created_at=message.created_at,
                    )
                )
                continue

            output = message.structured_output or {}
            recommended = output.get("recommended_products") or []
            upsell = output.get("upsell")

            if recommended:
                events.append(
                    AuditEventOut(
                        event_type="PRODUCT_SEARCH",
                        actor="agent",
                        summary="Searched the catalog for relevant products.",
                        created_at=message.created_at,
                    )
                )
                names = ", ".join(p["name"] for p in recommended)
                events.append(
                    AuditEventOut(
                        event_type="PRODUCT_RECOMMENDATION",
                        actor="agent",
                        summary=f"Recommended: {names}",
                        payload={"product_ids": [p["id"] for p in recommended]},
                        created_at=message.created_at,
                    )
                )
            else:
                events.append(
                    AuditEventOut(
                        event_type="AGENT_RESPONSE",
                        actor="agent",
                        summary=message.content,
                        created_at=message.created_at,
                    )
                )

            if upsell:
                events.append(
                    AuditEventOut(
                        event_type="UPSELL_PROPOSED",
                        actor="agent",
                        summary=f"Proposed add-on: {upsell['product']['name']}",
                        payload={"reasoning": upsell.get("reasoning")},
                        created_at=message.created_at,
                    )
                )

        return events

    def _events_from_payments(self, session_id: str) -> list[AuditEventOut]:
        events: list[AuditEventOut] = []
        proposals = self.payment_repo.get_all_by_session(session_id)

        for proposal in proposals:
            events.append(
                AuditEventOut(
                    event_type="POLICY_VALIDATION",
                    actor="system",
                    summary="Guardrail checks passed (stock levels, transaction limit).",
                    created_at=proposal.created_at,
                )
            )
            events.append(
                AuditEventOut(
                    event_type="PAYMENT_PROPOSAL",
                    actor="system",
                    summary=f"Proposed payment of ₹{proposal.total_amount:,.2f}.",
                    payload={"total_amount": float(proposal.total_amount)},
                    created_at=proposal.created_at,
                )
            )

            if proposal.status == "approved" and proposal.decided_at:
                events.append(
                    AuditEventOut(
                        event_type="USER_APPROVAL",
                        actor="user",
                        summary="Approved the payment.",
                        created_at=proposal.decided_at,
                    )
                )
            elif proposal.status == "rejected" and proposal.decided_at:
                events.append(
                    AuditEventOut(
                        event_type="USER_REJECTION",
                        actor="user",
                        summary="Cancelled the payment.",
                        created_at=proposal.decided_at,
                    )
                )

            for payment in self.transaction_repo.get_all_for_proposal(proposal.id):
                if payment.razorpay_order_id:
                    events.append(
                        AuditEventOut(
                            event_type="RAZORPAY_ORDER_CREATED",
                            actor="system",
                            summary=f"Created Razorpay order {payment.razorpay_order_id}.",
                            created_at=payment.created_at,
                        )
                    )
                elif payment.status == "failed":
                    events.append(
                        AuditEventOut(
                            event_type="PAYMENT_FAILED",
                            actor="system",
                            summary=payment.failure_reason or "Payment could not be created.",
                            created_at=payment.created_at,
                        )
                    )

                if payment.verified_at:
                    if payment.status == "success":
                        events.append(
                            AuditEventOut(
                                event_type="PAYMENT_SUCCESS",
                                actor="system",
                                summary=f"Payment verified: {payment.razorpay_payment_id}.",
                                created_at=payment.verified_at,
                            )
                        )
                    elif payment.status == "failed":
                        events.append(
                            AuditEventOut(
                                event_type="PAYMENT_FAILED",
                                actor="system",
                                summary=payment.failure_reason or "Payment verification failed.",
                                created_at=payment.verified_at,
                            )
                        )

        return events
