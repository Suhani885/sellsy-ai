from datetime import datetime

from pydantic import BaseModel, Field


class ProposePaymentRequest(BaseModel):
    cart_id: int


class PaymentProposalOut(BaseModel):
    id: int
    cart_id: int
    session_id: str | None
    cart_snapshot: list
    total_amount: float
    reasoning: str
    status: str
    created_at: datetime
    decided_at: datetime | None = None


class PaymentDecisionRequest(BaseModel):
    """Body for reject — currently empty, but kept as a real model so a
    reason/note field can be added later without breaking the route
    signature."""

    note: str | None = Field(default=None, max_length=500)


class TransactionOut(BaseModel):
    """A single Razorpay order/payment attempt against a proposal."""

    id: int
    proposal_id: int
    razorpay_order_id: str | None
    razorpay_payment_id: str | None
    amount: float
    currency: str
    status: str
    failure_reason: str | None = None
    created_at: datetime
    verified_at: datetime | None = None


class ApprovalResult(BaseModel):
    """Response for POST /api/payment/{id}/approve. Includes everything
    the frontend needs to open Razorpay Checkout — or to show a clean
    failure message if order creation itself failed."""

    proposal: PaymentProposalOut
    payment: TransactionOut
    razorpay_key_id: str | None = None  # public key, safe to expose to the browser


class VerifyPaymentRequest(BaseModel):
    """Body for POST /api/payment/{id}/verify — exactly what Razorpay
    Checkout's success handler callback provides."""

    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
