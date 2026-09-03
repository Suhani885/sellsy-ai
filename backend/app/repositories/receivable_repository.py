from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.receivable import Invoice


class ReceivableRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        customer_name: str,
        customer_contact: str | None,
        description: str,
        amount_due: float,
        payment_terms_days: int,
    ) -> Invoice:
        now = datetime.now(timezone.utc)
        invoice = Invoice(
            customer_name=customer_name,
            customer_contact=customer_contact,
            description=description,
            amount_due=amount_due,
            payment_terms_days=payment_terms_days,
            status="open",
            issued_at=now,
            due_at=now + timedelta(days=payment_terms_days),
        )
        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

    def get_by_id(self, invoice_id: int) -> Invoice | None:
        return self.db.get(Invoice, invoice_id)

    def get_all(self) -> list[Invoice]:
        stmt = select(Invoice).order_by(Invoice.issued_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_overdue_open(self, now: datetime) -> list[Invoice]:
        stmt = select(Invoice).where(Invoice.status == "open", Invoice.due_at < now)
        return list(self.db.execute(stmt).scalars().all())

    def mark_paid(self, invoice: Invoice) -> Invoice:
        invoice.status = "paid"
        invoice.paid_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice
