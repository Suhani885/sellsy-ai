from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.recovery import RecoveryAction, RecoveryCase

OPEN_STATUSES = ("detected", "attempting")


class RecoveryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_case(
        self,
        source_type: str,
        payment_id: int | None,
        proposal_id: int | None,
        cart_id: int | None,
        session_id: str | None,
        amount_at_risk: float,
        invoice_id: int | None = None,
    ) -> RecoveryCase:
        case = RecoveryCase(
            source_type=source_type,
            payment_id=payment_id,
            proposal_id=proposal_id,
            invoice_id=invoice_id,
            cart_id=cart_id,
            session_id=session_id,
            amount_at_risk=amount_at_risk,
            status="detected",
        )
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def get_by_id(self, case_id: int) -> RecoveryCase | None:
        return self.db.get(RecoveryCase, case_id)

    def get_all(self) -> list[RecoveryCase]:
        stmt = select(RecoveryCase).order_by(RecoveryCase.created_at.desc())
        return list(self.db.execute(stmt).scalars().all())

    def get_open_cases(self) -> list[RecoveryCase]:
        stmt = select(RecoveryCase).where(RecoveryCase.status.in_(OPEN_STATUSES))
        return list(self.db.execute(stmt).scalars().all())

    def has_open_case_for_payment(self, payment_id: int) -> bool:
        stmt = select(RecoveryCase).where(
            RecoveryCase.payment_id == payment_id,
            RecoveryCase.status.in_(OPEN_STATUSES),
        )
        return self.db.execute(stmt).scalars().first() is not None

    def has_open_case_for_proposal(self, proposal_id: int) -> bool:
        stmt = select(RecoveryCase).where(
            RecoveryCase.proposal_id == proposal_id,
            RecoveryCase.status.in_(OPEN_STATUSES),
        )
        return self.db.execute(stmt).scalars().first() is not None

    def has_open_case_for_invoice(self, invoice_id: int) -> bool:
        stmt = select(RecoveryCase).where(
            RecoveryCase.invoice_id == invoice_id,
            RecoveryCase.status.in_(OPEN_STATUSES),
        )
        return self.db.execute(stmt).scalars().first() is not None

    def get_actions_for_case(self, case_id: int) -> list[RecoveryAction]:
        stmt = (
            select(RecoveryAction)
            .where(RecoveryAction.case_id == case_id)
            .order_by(RecoveryAction.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def set_root_cause(self, case: RecoveryCase, root_cause: str) -> RecoveryCase:
        case.root_cause = root_cause
        self.db.commit()
        self.db.refresh(case)
        return case

    def record_attempt(
        self, case: RecoveryCase, action_type: str, tone: str, message: str
    ) -> RecoveryCase:
        case.attempts += 1
        case.status = "attempting"
        case.last_action_at = datetime.now(timezone.utc)
        self.db.add(
            RecoveryAction(case_id=case.id, action_type=action_type, tone=tone, message=message)
        )
        self.db.commit()
        self.db.refresh(case)
        return case

    def set_promise(self, case: RecoveryCase, promised_retry_at: datetime) -> RecoveryCase:
        case.promised_retry_at = promised_retry_at
        self.db.add(
            RecoveryAction(
                case_id=case.id,
                action_type="promise_to_pay",
                tone=None,
                message=f"Customer asked to be reminded on {promised_retry_at.date().isoformat()}.",
            )
        )
        self.db.commit()
        self.db.refresh(case)
        return case

    def stop_case(self, case: RecoveryCase, reason: str, opted_out: bool = False) -> RecoveryCase:
        case.status = "stopped"
        case.opted_out = opted_out
        case.resolved_at = datetime.now(timezone.utc)
        self.db.add(
            RecoveryAction(case_id=case.id, action_type="stopped", tone=None, message=reason)
        )
        self.db.commit()
        self.db.refresh(case)
        return case

    def expire_case(self, case: RecoveryCase, reason: str) -> RecoveryCase:
        case.status = "expired"
        case.resolved_at = datetime.now(timezone.utc)
        self.db.add(
            RecoveryAction(case_id=case.id, action_type="expired", tone=None, message=reason)
        )
        self.db.commit()
        self.db.refresh(case)
        return case

    def mark_open_cases_recovered_for_session(
        self, session_id: str | None, recovered_amount: float
    ) -> None:
        """Closes the promise-to-pay / recovery loop: called from
        PaymentService.verify_payment once a payment actually succeeds, so a
        recovered case is measured, not just contacted."""
        if not session_id:
            return

        stmt = select(RecoveryCase).where(
            RecoveryCase.session_id == session_id,
            RecoveryCase.status.in_(OPEN_STATUSES),
        )
        cases = self.db.execute(stmt).scalars().all()
        if not cases:
            return

        now = datetime.now(timezone.utc)
        for case in cases:
            case.status = "recovered"
            case.recovered_amount = recovered_amount
            case.resolved_at = now
            self.db.add(
                RecoveryAction(
                    case_id=case.id,
                    action_type="recovered",
                    tone=None,
                    message=f"Payment completed — ₹{recovered_amount:,.2f} recovered.",
                )
            )
        self.db.commit()

    def mark_open_case_recovered_for_invoice(self, invoice_id: int, recovered_amount: float) -> None:
        """Same idea as mark_open_cases_recovered_for_session, keyed by
        invoice instead of session — called when a B2B invoice is marked
        paid, so the receivables chaser's loop closes too."""
        stmt = select(RecoveryCase).where(
            RecoveryCase.invoice_id == invoice_id,
            RecoveryCase.status.in_(OPEN_STATUSES),
        )
        case = self.db.execute(stmt).scalars().first()
        if case is None:
            return

        case.status = "recovered"
        case.recovered_amount = recovered_amount
        case.resolved_at = datetime.now(timezone.utc)
        self.db.add(
            RecoveryAction(
                case_id=case.id,
                action_type="recovered",
                tone=None,
                message=f"Invoice paid — ₹{recovered_amount:,.2f} recovered.",
            )
        )
        self.db.commit()
