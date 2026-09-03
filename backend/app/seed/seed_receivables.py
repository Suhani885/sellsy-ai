"""
Seed synthetic B2B invoices for the receivables-chaser demo.

Usage (from backend/, with venv activated):

    python -m app.seed.seed_receivables

Creates a few invoices already past their due date (immediately picked up
by POST /api/recovery/scan as overdue_invoice cases) and one not yet due,
so the demo shows both states at a glance.
"""
import argparse
import logging
from datetime import datetime, timedelta, timezone

from app.models.base import SessionLocal
from app.models.receivable import Invoice

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SCENARIOS = [
    {
        "customer_name": "Bright Future Public School",
        "customer_contact": "accounts@brightfutureschool.example",
        "description": "Bulk order: 25x keyboards, 25x mice for the computer lab",
        "amount_due": 87500.0,
        "payment_terms_days": 15,
        "issued_days_ago": 22,
    },
    {
        "customer_name": "Nexora Consulting Pvt Ltd",
        "customer_contact": "finance@nexoraconsulting.example",
        "description": "12x monitors, 12x docking stations for the new office",
        "amount_due": 216000.0,
        "payment_terms_days": 30,
        "issued_days_ago": 40,
    },
    {
        "customer_name": "Kiran Retail Traders",
        "customer_contact": "kiran.traders@example.com",
        "description": "Reseller stock top-up: 8x laptops",
        "amount_due": 344000.0,
        "payment_terms_days": 15,
        "issued_days_ago": 4,
    },
]


def seed(db):
    now = datetime.now(timezone.utc)

    for scenario in SCENARIOS:
        issued_at = now - timedelta(days=scenario["issued_days_ago"])
        due_at = issued_at + timedelta(days=scenario["payment_terms_days"])
        invoice = Invoice(
            customer_name=scenario["customer_name"],
            customer_contact=scenario["customer_contact"],
            description=scenario["description"],
            amount_due=scenario["amount_due"],
            payment_terms_days=scenario["payment_terms_days"],
            status="open",
            issued_at=issued_at,
            due_at=due_at,
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        overdue = "overdue" if due_at < now else "not yet due"
        logger.info(
            "Invoice #%d for %s — ₹%.2f, due %s (%s)",
            invoice.id,
            invoice.customer_name,
            invoice.amount_due,
            due_at.date().isoformat(),
            overdue,
        )

    logger.info(
        "Receivables demo data created. Call POST /api/recovery/scan (or /run-batch) to detect overdue ones."
    )


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic B2B invoices for the receivables demo.")
    parser.parse_args()

    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
