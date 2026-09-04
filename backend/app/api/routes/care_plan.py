from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.care_plan import CarePlanCreate, CarePlanOut
from app.services.care_plan_service import CarePlanService

router = APIRouter(prefix="/api/care-plans", tags=["care-plans"])


@router.post("", response_model=CarePlanOut, status_code=201)
def issue_care_plan(payload: CarePlanCreate, db: Session = Depends(get_db)):
    service = CarePlanService(db)
    return service.issue_plan(
        customer_name=payload.customer_name,
        customer_contact=payload.customer_contact,
        plan_name=payload.plan_name,
        covers=payload.covers,
        amount_per_cycle=payload.amount_per_cycle,
        billing_interval_days=payload.billing_interval_days,
    )


@router.get("", response_model=list[CarePlanOut])
def list_care_plans(db: Session = Depends(get_db)):
    service = CarePlanService(db)
    return service.list_plans()


@router.post("/{plan_id}/renew", response_model=CarePlanOut)
def renew_care_plan(plan_id: int, db: Session = Depends(get_db)):
    service = CarePlanService(db)
    return service.renew_plan(plan_id)
