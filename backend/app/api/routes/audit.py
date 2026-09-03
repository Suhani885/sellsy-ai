from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.audit import AuditTrailOut
from app.services.audit_service import AuditService

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/{session_id}", response_model=AuditTrailOut)
def get_audit_trail(session_id: str, db: Session = Depends(get_db)):
    service = AuditService(db)
    return service.get_trail(session_id)
