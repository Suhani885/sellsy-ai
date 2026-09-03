import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.agents.llm_provider import AIProviderError, LLMProvider, get_llm_provider
from app.agents.recovery_prompts import build_case_context_message, build_diagnosis_prompt
from app.config.settings import settings
from app.policies.recovery_policy import ROOT_CAUSES, decide_next_action
from app.repositories.payment_repository import PaymentRepository
from app.repositories.recovery_repository import RecoveryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.recovery import (
    RecoveryActionOut,
    RecoveryBatchResult,
    RecoveryCaseDetailOut,
    RecoveryCaseOut,
    RecoveryDiagnosisRaw,
    RecoverySummaryOut,
)
from app.utils.exceptions import NotFoundError, ValidationAppError

logger = logging.getLogger(__name__)

DEFAULT_ROOT_CAUSE = "unknown"
OPEN_STATUSES = ("detected", "attempting")
RESOLVED_STATUSES = ("recovered", "expired", "stopped")


class RecoveryService:
    def __init__(self, db: Session, llm_provider: LLMProvider | None = None):
        self.db = db
        self.repo = RecoveryRepository(db)
        self.payment_repo = PaymentRepository(db)
        self.transaction_repo = TransactionRepository(db)
        self.llm_provider = llm_provider or get_llm_provider()

    def scan(self) -> dict:
        """Detection pass: turns failed payments and stale (never approved
        or rejected) proposals into RecoveryCases. Deterministic — no LLM
        involved in deciding what counts as at-risk revenue."""
        detected = 0

        for payment in self.transaction_repo.get_failed():
            if self.repo.has_open_case_for_payment(payment.id):
                continue
            proposal = self.payment_repo.get_by_id(payment.proposal_id)
            if proposal is None:
                continue
            self.repo.create_case(
                source_type="failed_payment",
                payment_id=payment.id,
                proposal_id=proposal.id,
                cart_id=proposal.cart_id,
                session_id=proposal.session_id,
                amount_at_risk=float(payment.amount),
            )
            detected += 1

        threshold = datetime.now(timezone.utc) - timedelta(
            minutes=settings.recovery_stale_proposal_minutes
        )
        for proposal in self.payment_repo.get_stale_proposed(threshold):
            if self.repo.has_open_case_for_proposal(proposal.id):
                continue
            self.repo.create_case(
                source_type="abandoned_checkout",
                payment_id=None,
                proposal_id=proposal.id,
                cart_id=proposal.cart_id,
                session_id=proposal.session_id,
                amount_at_risk=float(proposal.total_amount),
            )
            detected += 1

        return {"cases_detected": detected}

    async def run_batch(self, tone: str = "standard") -> RecoveryBatchResult:
        scan_result = self.scan()
        now = datetime.now(timezone.utc)
        actioned = 0
        stopped = 0

        for case in self.repo.get_open_cases():
            decision = decide_next_action(case, now)

            if decision.new_status == "expired":
                self.repo.expire_case(case, decision.reason)
                stopped += 1
                continue
            if decision.new_status == "stopped":
                self.repo.stop_case(case, decision.reason)
                stopped += 1
                continue
            if decision.action is None:
                continue  # waiting on cooldown or a promised retry date

            diagnosis = await self._diagnose_and_draft(case, tone)
            if case.root_cause is None:
                self.repo.set_root_cause(case, diagnosis.root_cause)
            self.repo.record_attempt(
                case, action_type=decision.action, tone=tone, message=diagnosis.message
            )
            actioned += 1

        return RecoveryBatchResult(
            cases_detected=scan_result["cases_detected"],
            cases_actioned=actioned,
            cases_stopped=stopped,
        )

    async def _diagnose_and_draft(self, case, tone: str) -> RecoveryDiagnosisRaw:
        known_cause = self._deterministic_root_cause(case)

        try:
            system_prompt = build_diagnosis_prompt(tone, known_cause)
            user_message = build_case_context_message(self._build_case_context(case))
            raw_json = await self.llm_provider.complete_json(system_prompt, user_message)
            diagnosis = self._parse_diagnosis(raw_json)
        except AIProviderError as exc:
            logger.warning(
                "Recovery diagnosis LLM call failed for case %s: %s — using fallback copy.",
                case.id,
                exc,
            )
            diagnosis = RecoveryDiagnosisRaw(
                root_cause=known_cause or DEFAULT_ROOT_CAUSE,
                message=(
                    f"Your order for ₹{float(case.amount_at_risk):,.2f} is still "
                    "waiting — you can finish checkout anytime from your cart."
                ),
            )

        if known_cause:
            diagnosis.root_cause = known_cause  # a known fact overrides the model's own guess
        return diagnosis

    def _deterministic_root_cause(self, case) -> str | None:
        """Cases where the cause doesn't need an LLM to classify: an
        abandoned checkout has no failure at all, and this app's own
        signature-verification failure message is always worded the same way."""
        if case.source_type == "abandoned_checkout":
            return "checkout_abandoned"
        if case.payment_id:
            payment = self.transaction_repo.get_by_id(case.payment_id)
            if payment and payment.failure_reason and "signature" in payment.failure_reason.lower():
                return "signature_mismatch"
        return None

    def _build_case_context(self, case) -> dict:
        proposal = self.payment_repo.get_by_id(case.proposal_id) if case.proposal_id else None
        items = []
        if proposal and proposal.cart_snapshot:
            items = [
                {
                    "name": (item.get("product") or {}).get("name", "item"),
                    "quantity": item.get("quantity", 1),
                }
                for item in proposal.cart_snapshot
            ]

        failure_reason = None
        if case.payment_id:
            payment = self.transaction_repo.get_by_id(case.payment_id)
            failure_reason = payment.failure_reason if payment else None

        return {
            "amount_at_risk_inr": float(case.amount_at_risk),
            "items": items,
            "source_type": case.source_type,
            "failure_reason": failure_reason,
            "attempts_so_far": case.attempts,
        }

    def _parse_diagnosis(self, raw_json: str) -> RecoveryDiagnosisRaw:
        try:
            data = json.loads(raw_json)
            diagnosis = RecoveryDiagnosisRaw.model_validate(data)
        except Exception as exc:
            logger.warning(
                "Recovery diagnosis output failed to parse: %s | raw=%s", exc, raw_json[:500]
            )
            return RecoveryDiagnosisRaw(
                root_cause=DEFAULT_ROOT_CAUSE,
                message=(
                    "We noticed your order didn't go through — you can pick up "
                    "right where you left off in your cart."
                ),
            )

        if diagnosis.root_cause not in ROOT_CAUSES:
            logger.warning(
                "Recovery diagnosis returned unknown root_cause=%s — dropped.",
                diagnosis.root_cause,
            )
            diagnosis.root_cause = DEFAULT_ROOT_CAUSE

        diagnosis.message = diagnosis.message.strip()[:320]
        return diagnosis

    def promise_to_pay(self, case_id: int, promised_retry_at: datetime) -> RecoveryCaseOut:
        case = self._get_case_or_404(case_id)
        if case.status not in OPEN_STATUSES:
            raise ValidationAppError(
                f"Recovery case {case_id} is already '{case.status}' and can't take a new promise."
            )
        updated = self.repo.set_promise(case, promised_retry_at)
        return self._case_to_out(updated)

    def stop_case(self, case_id: int) -> RecoveryCaseOut:
        case = self._get_case_or_404(case_id)
        if case.status not in OPEN_STATUSES:
            raise ValidationAppError(f"Recovery case {case_id} is already '{case.status}'.")
        updated = self.repo.stop_case(case, "Manually stopped by merchant.", opted_out=True)
        return self._case_to_out(updated)

    def list_cases(self) -> list[RecoveryCaseOut]:
        return [self._case_to_out(c) for c in self.repo.get_all()]

    def get_case(self, case_id: int) -> RecoveryCaseDetailOut:
        case = self._get_case_or_404(case_id)
        actions = self.repo.get_actions_for_case(case_id)
        base = self._case_to_out(case)
        return RecoveryCaseDetailOut(
            **base.model_dump(),
            actions=[self._action_to_out(a) for a in actions],
        )

    def get_summary(self) -> RecoverySummaryOut:
        cases = self.repo.get_all()
        open_cases = [c for c in cases if c.status in OPEN_STATUSES]
        recovered = [c for c in cases if c.status == "recovered"]
        resolved = [c for c in cases if c.status in RESOLVED_STATUSES]

        amount_at_risk = sum(float(c.amount_at_risk) for c in open_cases)
        recovered_amount = sum(float(c.recovered_amount or 0) for c in recovered)
        recovery_rate = round(len(recovered) / len(resolved), 4) if resolved else 0.0

        return RecoverySummaryOut(
            total_cases=len(cases),
            open_cases=len(open_cases),
            amount_at_risk=round(amount_at_risk, 2),
            recovered_cases=len(recovered),
            recovered_amount=round(recovered_amount, 2),
            recovery_rate=recovery_rate,
        )

    def _get_case_or_404(self, case_id: int):
        case = self.repo.get_by_id(case_id)
        if case is None:
            raise NotFoundError(f"Recovery case {case_id} was not found.")
        return case

    def _case_to_out(self, case) -> RecoveryCaseOut:
        return RecoveryCaseOut(
            id=case.id,
            source_type=case.source_type,
            payment_id=case.payment_id,
            proposal_id=case.proposal_id,
            cart_id=case.cart_id,
            session_id=case.session_id,
            amount_at_risk=float(case.amount_at_risk),
            root_cause=case.root_cause,
            status=case.status,
            attempts=case.attempts,
            opted_out=case.opted_out,
            promised_retry_at=case.promised_retry_at,
            recovered_amount=(
                float(case.recovered_amount) if case.recovered_amount is not None else None
            ),
            created_at=case.created_at,
            last_action_at=case.last_action_at,
            resolved_at=case.resolved_at,
        )

    def _action_to_out(self, action) -> RecoveryActionOut:
        return RecoveryActionOut(
            id=action.id,
            case_id=action.case_id,
            action_type=action.action_type,
            tone=action.tone,
            message=action.message,
            created_at=action.created_at,
        )
