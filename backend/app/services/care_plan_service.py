from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.repositories.care_plan_repository import CarePlanRepository
from app.repositories.recovery_repository import RecoveryRepository
from app.schemas.care_plan import CarePlanOut
from app.utils.exceptions import NotFoundError, ValidationAppError


class CarePlanService:
    def __init__(self, db: Session):
        self.repo = CarePlanRepository(db)
        self.recovery_repo = RecoveryRepository(db)

    def issue_plan(
        self,
        customer_name: str,
        customer_contact: str | None,
        plan_name: str,
        covers: str,
        amount_per_cycle: float,
        billing_interval_days: int,
    ) -> CarePlanOut:
        plan = self.repo.create(
            customer_name=customer_name,
            customer_contact=customer_contact,
            plan_name=plan_name,
            covers=covers,
            amount_per_cycle=amount_per_cycle,
            billing_interval_days=billing_interval_days,
        )
        return self._to_out(plan)

    def list_plans(self) -> list[CarePlanOut]:
        return [self._to_out(p) for p in self.repo.get_all()]

    def renew_plan(self, plan_id: int) -> CarePlanOut:
        plan = self.repo.get_by_id(plan_id)
        if plan is None:
            raise NotFoundError(f"Care plan {plan_id} was not found.")
        if plan.status != "active":
            raise ValidationAppError(f"Care plan {plan_id} is '{plan.status}', not active.")

        updated = self.repo.renew(plan)
        self.recovery_repo.mark_open_case_recovered_for_plan(
            updated.id, float(updated.amount_per_cycle)
        )
        return self._to_out(updated)

    def _to_out(self, plan) -> CarePlanOut:
        now = datetime.now(timezone.utc)
        return CarePlanOut(
            id=plan.id,
            customer_name=plan.customer_name,
            customer_contact=plan.customer_contact,
            plan_name=plan.plan_name,
            covers=plan.covers,
            amount_per_cycle=float(plan.amount_per_cycle),
            billing_interval_days=plan.billing_interval_days,
            mandate_id=plan.mandate_id,
            status=plan.status,
            is_renewal_due=plan.status == "active" and plan.next_billing_at < now,
            next_billing_at=plan.next_billing_at,
            created_at=plan.created_at,
        )
