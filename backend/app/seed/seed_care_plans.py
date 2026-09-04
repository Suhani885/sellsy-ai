"""
Seed synthetic device Care Plans (protection/AMC subscriptions) for the
mandate-retry-sequencer demo.

Usage (from backend/, with venv activated):

    python -m app.seed.seed_care_plans

Creates a few plans already past their renewal date (immediately picked up
by POST /api/recovery/scan as subscription_renewal_failed cases) and one
not yet due, so the demo shows both states at a glance.
"""
import argparse
import logging
from datetime import datetime, timedelta, timezone

from app.models.base import SessionLocal
from app.models.care_plan import CarePlan

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

SCENARIOS = [
    {
        "customer_name": "Ritika Sharma",
        "customer_contact": "ritika.sharma@example.com",
        "plan_name": "Laptop Care+ (2 Year Protection)",
        "covers": "HP Pavilion 14 (i5, 16GB/512GB)",
        "amount_per_cycle": 499.0,
        "billing_interval_days": 30,
        "created_days_ago": 95,
    },
    {
        "customer_name": "Farhan Ali",
        "customer_contact": "farhan.ali@example.com",
        "plan_name": "Phone Care+ (Screen & Battery)",
        "covers": "Smartphone, 1x",
        "amount_per_cycle": 299.0,
        "billing_interval_days": 30,
        "created_days_ago": 40,
    },
    {
        "customer_name": "Meera Iyer",
        "customer_contact": "meera.iyer@example.com",
        "plan_name": "Laptop Care+ (2 Year Protection)",
        "covers": "Dell Inspiron 15 (i5, 8GB/512GB)",
        "amount_per_cycle": 499.0,
        "billing_interval_days": 30,
        "created_days_ago": 3,
    },
]


def seed(db):
    now = datetime.now(timezone.utc)

    for scenario in SCENARIOS:
        created_at = now - timedelta(days=scenario["created_days_ago"])
        # First renewal is one billing cycle after signup, same as the
        # real create() path — some of these land in the past on purpose.
        next_billing_at = created_at + timedelta(days=scenario["billing_interval_days"])
        plan = CarePlan(
            customer_name=scenario["customer_name"],
            customer_contact=scenario["customer_contact"],
            plan_name=scenario["plan_name"],
            covers=scenario["covers"],
            amount_per_cycle=scenario["amount_per_cycle"],
            billing_interval_days=scenario["billing_interval_days"],
            status="active",
            next_billing_at=next_billing_at,
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        due = "renewal due" if next_billing_at < now else "not yet due"
        logger.info(
            "Care plan #%d for %s — ₹%.2f/cycle, next billing %s (%s)",
            plan.id,
            plan.customer_name,
            plan.amount_per_cycle,
            next_billing_at.date().isoformat(),
            due,
        )

    logger.info(
        "Care plan demo data created. Call POST /api/recovery/scan (or /run-batch) to detect lapsed renewals."
    )


def main():
    parser = argparse.ArgumentParser(description="Seed synthetic device Care Plans for the demo.")
    parser.parse_args()

    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
