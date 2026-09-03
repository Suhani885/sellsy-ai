"""
Aggregates existing data into merchant-facing metrics. Nothing here is
tracked separately — every number is derived from conversation_messages,
payment_proposals, and payments rows that already exist for their own
purposes.

Aggregation happens in Python rather than SQL for the JSON-derived counts
(recommendations, upsells), since those live inside the structured_output
JSON column.
"""
from sqlalchemy.orm import Session

from app.repositories.conversation_repository import ConversationRepository
from app.repositories.payment_repository import PaymentRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.analytics import AnalyticsOut


class AnalyticsService:
    def __init__(self, db: Session):
        self.conversation_repo = ConversationRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.transaction_repo = TransactionRepository(db)

    def get_analytics(self) -> AnalyticsOut:
        total_conversations = self.conversation_repo.count_distinct_sessions()

        products_recommended = 0
        upsells_proposed = 0
        for message in self.conversation_repo.get_all_agent_messages():
            output = message.structured_output or {}
            products_recommended += len(output.get("recommended_products") or [])
            if output.get("upsell"):
                upsells_proposed += 1

        upsells_accepted = 0
        estimated_additional_revenue = 0.0
        payments = self.transaction_repo.get_all()
        successful_payment_proposal_ids = {
            p.proposal_id for p in payments if p.status == "success"
        }

        for proposal in self.payment_repo.get_all():
            for item in proposal.cart_snapshot or []:
                if item.get("added_reason") == "upsell_accepted":
                    upsells_accepted += 1
                    if proposal.id in successful_payment_proposal_ids:
                        estimated_additional_revenue += float(item.get("line_total") or 0)

        payments_initiated = len(payments)
        successful_payments = sum(1 for p in payments if p.status == "success")
        failed_payments = sum(1 for p in payments if p.status == "failed")

        conversion_rate = (
            round(successful_payments / total_conversations, 4)
            if total_conversations > 0
            else 0.0
        )

        return AnalyticsOut(
            total_conversations=total_conversations,
            products_recommended=products_recommended,
            upsells_proposed=upsells_proposed,
            upsells_accepted=upsells_accepted,
            estimated_additional_revenue=round(estimated_additional_revenue, 2),
            payments_initiated=payments_initiated,
            successful_payments=successful_payments,
            failed_payments=failed_payments,
            conversion_rate=conversion_rate,
        )
