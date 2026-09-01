from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.payment import (
    PaymentDecisionRequest,
    PaymentProposalOut,
    ProposePaymentRequest,
)
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/api/payment", tags=["payment"])


@router.post("/propose", response_model=PaymentProposalOut, status_code=201)
def propose_payment(payload: ProposePaymentRequest, db: Session = Depends(get_db)):
    service = PaymentService(db)
    return service.propose_payment(payload.cart_id)


@router.get("/{proposal_id}", response_model=PaymentProposalOut)
def get_proposal(proposal_id: int, db: Session = Depends(get_db)):
    service = PaymentService(db)
    return service.get_proposal(proposal_id)


@router.post("/{proposal_id}/approve", response_model=PaymentProposalOut)
def approve_proposal(
    proposal_id: int,
    payload: PaymentDecisionRequest | None = None,
    db: Session = Depends(get_db),
):
    service = PaymentService(db)
    return service.approve(proposal_id)


@router.post("/{proposal_id}/reject", response_model=PaymentProposalOut)
def reject_proposal(
    proposal_id: int,
    payload: PaymentDecisionRequest | None = None,
    db: Session = Depends(get_db),
):
    service = PaymentService(db)
    return service.reject(proposal_id)
