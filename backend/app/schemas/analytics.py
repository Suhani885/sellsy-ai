from pydantic import BaseModel


class AnalyticsOut(BaseModel):
    total_conversations: int
    products_recommended: int
    upsells_proposed: int
    upsells_accepted: int
    estimated_additional_revenue: float
    payments_initiated: int
    successful_payments: int
    failed_payments: int
    conversion_rate: float  # successful_payments / total_conversations
