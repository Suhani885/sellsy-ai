from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.care_plan import CarePlan


class CarePlanRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        customer_name: str,
        customer_contact: str | None,
        plan_name: str,
        covers: str,
        amount_per_cycle: float,
        billing_interval_days: int,
    ) -> CarePlan:
        now = datetime.now(timezone.utc)
        plan = CarePlan(
            customer_name=customer_name,
            customer_contact=customer_contact,
            plan_name=plan_name,
            covers=covers,
            amount_per_cycle=amount_per_cycle,
            billing_interval_days=billing_interval_days,
            status="active",
            next_billing_at=now + timedelta(days=billing_interval_days),
        )
        self.db.add(plan)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def get_by_id(self, plan_id: int) -> CarePlan | None:
        return self.db.get(CarePlan, plan_id)

    def get_all(self) -> list[CarePlan]:
        stmt = select(CarePlan).order_by(CarePlan.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_due_active(self, now: datetime) -> list[CarePlan]:
        stmt = select(CarePlan).where(CarePlan.status == "active", CarePlan.next_billing_at < now)
        return list(self.db.execute(stmt).scalars().all())

    def renew(self, plan: CarePlan) -> CarePlan:
        """Simulates a successful mandate execution — advances the plan to
        its next billing cycle rather than marking it 'paid' once, since a
        subscription keeps billing indefinitely."""
        plan.next_billing_at = datetime.now(timezone.utc) + timedelta(
            days=plan.billing_interval_days
        )
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def cancel(self, plan: CarePlan) -> CarePlan:
        plan.status = "cancelled"
        self.db.commit()
        self.db.refresh(plan)
        return plan
