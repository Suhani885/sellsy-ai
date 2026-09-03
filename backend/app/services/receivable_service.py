from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.repositories.receivable_repository import ReceivableRepository
from app.repositories.recovery_repository import RecoveryRepository
from app.schemas.receivable import InvoiceOut
from app.utils.exceptions import NotFoundError, ValidationAppError


class ReceivableService:
    def __init__(self, db: Session):
        self.repo = ReceivableRepository(db)
        self.recovery_repo = RecoveryRepository(db)

    def issue_invoice(
        self,
        customer_name: str,
        customer_contact: str | None,
        description: str,
        amount_due: float,
        payment_terms_days: int,
    ) -> InvoiceOut:
        invoice = self.repo.create(
            customer_name=customer_name,
            customer_contact=customer_contact,
            description=description,
            amount_due=amount_due,
            payment_terms_days=payment_terms_days,
        )
        return self._to_out(invoice)

    def list_invoices(self) -> list[InvoiceOut]:
        return [self._to_out(i) for i in self.repo.get_all()]

    def mark_paid(self, invoice_id: int) -> InvoiceOut:
        invoice = self.repo.get_by_id(invoice_id)
        if invoice is None:
            raise NotFoundError(f"Invoice {invoice_id} was not found.")
        if invoice.status == "paid":
            raise ValidationAppError(f"Invoice {invoice_id} is already marked paid.")

        updated = self.repo.mark_paid(invoice)
        self.recovery_repo.mark_open_case_recovered_for_invoice(
            updated.id, float(updated.amount_due)
        )
        return self._to_out(updated)

    def _to_out(self, invoice) -> InvoiceOut:
        now = datetime.now(timezone.utc)
        return InvoiceOut(
            id=invoice.id,
            customer_name=invoice.customer_name,
            customer_contact=invoice.customer_contact,
            description=invoice.description,
            amount_due=float(invoice.amount_due),
            payment_terms_days=invoice.payment_terms_days,
            status=invoice.status,
            is_overdue=invoice.status == "open" and invoice.due_at < now,
            issued_at=invoice.issued_at,
            due_at=invoice.due_at,
            paid_at=invoice.paid_at,
        )
