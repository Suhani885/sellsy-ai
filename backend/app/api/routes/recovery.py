from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.recovery import (
    PromiseToPayRequest,
    RecoveryBatchResult,
    RecoveryCaseDetailOut,
    RecoveryCaseOut,
    RecoverySummaryOut,
    RunBatchRequest,
)
from app.services.recovery_service import RecoveryService

router = APIRouter(prefix="/api/recovery", tags=["recovery"])


@router.post("/scan", response_model=dict)
def scan_for_at_risk_revenue(db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.scan()


@router.post("/run-batch", response_model=RecoveryBatchResult)
async def run_recovery_batch(payload: RunBatchRequest, db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return await service.run_batch(tone=payload.tone)


@router.get("/summary", response_model=RecoverySummaryOut)
def get_recovery_summary(db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.get_summary()


@router.get("", response_model=list[RecoveryCaseOut])
def list_recovery_cases(db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.list_cases()


@router.get("/{case_id}", response_model=RecoveryCaseDetailOut)
def get_recovery_case(case_id: int, db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.get_case(case_id)


@router.post("/{case_id}/promise", response_model=RecoveryCaseOut)
def promise_to_pay(case_id: int, payload: PromiseToPayRequest, db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.promise_to_pay(case_id, payload.promised_retry_at)


@router.post("/{case_id}/stop", response_model=RecoveryCaseOut)
def stop_recovery_case(case_id: int, db: Session = Depends(get_db)):
    service = RecoveryService(db)
    return service.stop_case(case_id)
