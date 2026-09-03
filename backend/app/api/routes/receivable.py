from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.receivable import InvoiceCreate, InvoiceOut
from app.services.receivable_service import ReceivableService

router = APIRouter(prefix="/api/receivables", tags=["receivables"])


@router.post("", response_model=InvoiceOut, status_code=201)
def issue_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    service = ReceivableService(db)
    return service.issue_invoice(
        customer_name=payload.customer_name,
        customer_contact=payload.customer_contact,
        description=payload.description,
        amount_due=payload.amount_due,
        payment_terms_days=payload.payment_terms_days,
    )


@router.get("", response_model=list[InvoiceOut])
def list_invoices(db: Session = Depends(get_db)):
    service = ReceivableService(db)
    return service.list_invoices()


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceOut)
def mark_invoice_paid(invoice_id: int, db: Session = Depends(get_db)):
    service = ReceivableService(db)
    return service.mark_paid(invoice_id)
