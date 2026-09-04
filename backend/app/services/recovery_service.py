import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.agents.llm_provider import AIProviderError, LLMProvider, get_llm_provider
from app.agents.recovery_prompts import build_case_context_message, build_diagnosis_prompt
from app.config.settings import settings
from app.policies.recovery_policy import ROOT_CAUSES, decide_next_action
from app.repositories.care_plan_repository import CarePlanRepository
from app.repositories.payment_repository import PaymentRepository
from app.repositories.receivable_repository import ReceivableRepository
from app.repositories.recovery_repository import RecoveryRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.recovery import (
    RecoveryActionOut,
    RecoveryBatchCaseResult,
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
        self.receivable_repo = ReceivableRepository(db)
        self.care_plan_repo = CarePlanRepository(db)
        self.llm_provider = llm_provider or get_llm_provider()

    def scan(self) -> dict:
        """Detection pass: turns failed payments, stale (never approved or
        rejected) proposals, overdue B2B invoices, and lapsed care-plan
        renewals into RecoveryCases. Deterministic — no LLM involved in
        deciding what counts as at-risk revenue."""
        detected = 0
        now = datetime.now(timezone.utc)

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

        threshold = now - timedelta(minutes=settings.recovery_stale_proposal_minutes)
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

        for invoice in self.receivable_repo.get_overdue_open(now):
            if self.repo.has_open_case_for_invoice(invoice.id):
                continue
            self.repo.create_case(
                source_type="overdue_invoice",
                payment_id=None,
                proposal_id=None,
                cart_id=None,
                session_id=None,
                amount_at_risk=float(invoice.amount_due),
                invoice_id=invoice.id,
            )
            detected += 1

        for plan in self.care_plan_repo.get_due_active(now):
            if self.repo.has_open_case_for_plan(plan.id):
                continue
            self.repo.create_case(
                source_type="subscription_renewal_failed",
                payment_id=None,
                proposal_id=None,
                cart_id=None,
                session_id=None,
                amount_at_risk=float(plan.amount_per_cycle),
                plan_id=plan.id,
            )
            detected += 1

        return {"cases_detected": detected}

    async def run_batch(self, tone: str = "standard") -> RecoveryBatchResult:
        scan_result = self.scan()
        now = datetime.now(timezone.utc)
        nudged = 0
        escalated = 0
        expired = 0
        stopped = 0
        amount_actioned = 0.0
        amount_by_source: dict[str, float] = {}
        case_results: list[RecoveryBatchCaseResult] = []

        for case in self.repo.get_open_cases():
            decision = decide_next_action(case, now)

            if decision.new_status == "expired":
                self.repo.expire_case(case, decision.reason)
                if case.source_type == "subscription_renewal_failed" and case.plan_id:
                    plan = self.care_plan_repo.get_by_id(case.plan_id)
                    if plan and plan.status == "active":
                        self.care_plan_repo.cancel(plan)
                expired += 1
                case_results.append(self._batch_case_result(case, "expired", decision.reason))
                continue
            if decision.new_status == "stopped":
                self.repo.stop_case(case, decision.reason)
                stopped += 1
                case_results.append(self._batch_case_result(case, "stopped", decision.reason))
                continue
            if decision.action is None:
                continue  # waiting on cooldown or a promised retry date

            diagnosis = await self._diagnose_and_draft(case, tone)
            if case.root_cause is None:
                self.repo.set_root_cause(case, diagnosis.root_cause)
            self.repo.record_attempt(
                case, action_type=decision.action, tone=tone, message=diagnosis.message
            )
            if decision.action == "final_notice":
                escalated += 1
            else:
                nudged += 1
            amount = float(case.amount_at_risk)
            amount_actioned += amount
            amount_by_source[case.source_type] = amount_by_source.get(case.source_type, 0.0) + amount
            case_results.append(self._batch_case_result(case, decision.action, None))

        return RecoveryBatchResult(
            cases_detected=scan_result["cases_detected"],
            cases_actioned=nudged + escalated,
            cases_stopped=stopped,
            cases_nudged=nudged,
            cases_escalated=escalated,
            cases_expired=expired,
            amount_actioned=round(amount_actioned, 2),
            amount_at_risk_by_source={k: round(v, 2) for k, v in amount_by_source.items()},
            cases=case_results,
        )

    def _batch_case_result(self, case, action: str, reason: str | None) -> RecoveryBatchCaseResult:
        return RecoveryBatchCaseResult(
            case_id=case.id,
            source_type=case.source_type,
            label=self._case_label(case),
            action=action,
            amount_at_risk=float(case.amount_at_risk),
            reason=reason,
        )

    def _case_label(self, case) -> str:
        """A human-readable name for the batch report — reuses the same
        invoice/plan lookups the diagnosis and fallback-message paths
        already do, since there's no customer name on RecoveryCase itself
        for consumer-side cases."""
        if case.source_type == "overdue_invoice":
            invoice = self.receivable_repo.get_by_id(case.invoice_id) if case.invoice_id else None
            return invoice.customer_name if invoice else f"Invoice #{case.invoice_id}"
        if case.source_type == "subscription_renewal_failed":
            plan = self.care_plan_repo.get_by_id(case.plan_id) if case.plan_id else None
            return plan.customer_name if plan else f"Care Plan #{case.plan_id}"
        return f"Checkout #{case.proposal_id}" if case.proposal_id else f"Case #{case.id}"

    async def _diagnose_and_draft(self, case, tone: str) -> RecoveryDiagnosisRaw:
        known_cause = self._deterministic_root_cause(case)

        try:
            system_prompt = build_diagnosis_prompt(tone, known_cause)
            user_message = build_case_context_message(self._build_case_context(case))
            raw_json = await self.llm_provider.complete_json(
                system_prompt, [{"role": "user", "content": user_message}]
            )
            diagnosis = self._parse_diagnosis(raw_json, case)
        except AIProviderError as exc:
            logger.warning(
                "Recovery diagnosis LLM call failed for case %s: %s — using fallback copy.",
                case.id,
                exc,
            )
            diagnosis = RecoveryDiagnosisRaw(
                root_cause=known_cause or DEFAULT_ROOT_CAUSE,
                message=self._fallback_message(case),
            )

        if known_cause:
            diagnosis.root_cause = known_cause  # a known fact overrides the model's own guess
        return diagnosis

    def _fallback_message(self, case) -> str:
        """Used only when the LLM call itself fails — has to stay accurate
        without any model-generated framing, so it's split by source_type
        rather than reusing consumer checkout language for a B2B invoice."""
        if case.source_type == "overdue_invoice":
            invoice = self.receivable_repo.get_by_id(case.invoice_id) if case.invoice_id else None
            reference = f"INV-{invoice.id:04d}" if invoice else "your invoice"
            return (
                f"This is a reminder that {reference} for "
                f"₹{float(case.amount_at_risk):,.2f} is now overdue. Please "
                "arrange payment or contact our accounts team."
            )
        if case.source_type == "subscription_renewal_failed":
            plan = self.care_plan_repo.get_by_id(case.plan_id) if case.plan_id else None
            plan_name = plan.plan_name if plan else "your Care Plan"
            return (
                f"We couldn't renew {plan_name} (₹{float(case.amount_at_risk):,.2f}). "
                "Please update your payment method to keep your plan active."
            )
        return (
            f"Your order for ₹{float(case.amount_at_risk):,.2f} is still "
            "waiting — you can finish checkout anytime from your cart."
        )

    def _deterministic_root_cause(self, case) -> str | None:
        """Cases where the cause doesn't need an LLM to classify: an
        abandoned checkout has no failure at all, an overdue invoice is
        overdue by definition, and this app's own signature-verification
        failure message is always worded the same way."""
        if case.source_type == "abandoned_checkout":
            return "checkout_abandoned"
        if case.source_type == "overdue_invoice":
            return "invoice_overdue"
        if case.source_type == "subscription_renewal_failed":
            return "renewal_failed"
        if case.payment_id:
            payment = self.transaction_repo.get_by_id(case.payment_id)
            if payment and payment.failure_reason and "signature" in payment.failure_reason.lower():
                return "signature_mismatch"
        return None

    def _build_case_context(self, case) -> dict:
        if case.source_type == "overdue_invoice":
            return self._build_invoice_context(case)
        if case.source_type == "subscription_renewal_failed":
            return self._build_subscription_context(case)

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

    def _build_invoice_context(self, case) -> dict:
        invoice = self.receivable_repo.get_by_id(case.invoice_id) if case.invoice_id else None
        if invoice is None:
            return {
                "amount_at_risk_inr": float(case.amount_at_risk),
                "source_type": case.source_type,
                "attempts_so_far": case.attempts,
            }

        now = datetime.now(timezone.utc)
        days_overdue = max((now - invoice.due_at).days, 0)
        return {
            "amount_at_risk_inr": float(invoice.amount_due),
            "invoice_number": f"INV-{invoice.id:04d}",
            "customer_name": invoice.customer_name,
            "description": invoice.description,
            "due_date": invoice.due_at.date().isoformat(),
            "days_overdue": days_overdue,
            "source_type": case.source_type,
            "attempts_so_far": case.attempts,
        }

    def _build_subscription_context(self, case) -> dict:
        plan = self.care_plan_repo.get_by_id(case.plan_id) if case.plan_id else None
        if plan is None:
            return {
                "amount_at_risk_inr": float(case.amount_at_risk),
                "source_type": case.source_type,
                "attempts_so_far": case.attempts,
            }

        now = datetime.now(timezone.utc)
        days_since_due = max((now - plan.next_billing_at).days, 0)
        return {
            "amount_at_risk_inr": float(plan.amount_per_cycle),
            "plan_name": plan.plan_name,
            "covers": plan.covers,
            "customer_name": plan.customer_name,
            "days_since_renewal_due": days_since_due,
            "retry_attempt_of": f"{case.attempts + 1} of 3",
            "source_type": case.source_type,
            "attempts_so_far": case.attempts,
        }

    def _parse_diagnosis(self, raw_json: str, case) -> RecoveryDiagnosisRaw:
        try:
            data = json.loads(raw_json)
            diagnosis = RecoveryDiagnosisRaw.model_validate(data)
        except Exception as exc:
            logger.warning(
                "Recovery diagnosis output failed to parse: %s | raw=%s", exc, raw_json[:500]
            )
            return RecoveryDiagnosisRaw(
                root_cause=DEFAULT_ROOT_CAUSE,
                message=self._fallback_message(case),
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

        amount_at_risk_by_source: dict[str, float] = {}
        for c in open_cases:
            amount_at_risk_by_source[c.source_type] = (
                amount_at_risk_by_source.get(c.source_type, 0.0) + float(c.amount_at_risk)
            )
        recovered_amount_by_source: dict[str, float] = {}
        for c in recovered:
            recovered_amount_by_source[c.source_type] = (
                recovered_amount_by_source.get(c.source_type, 0.0) + float(c.recovered_amount or 0)
            )

        now = datetime.now(timezone.utc)
        promised = [c for c in cases if c.promised_retry_at is not None]
        statuses = [self._promise_status(c, now) for c in promised]
        pending = statuses.count("pending")
        overdue = statuses.count("overdue")
        kept = statuses.count("kept")
        kept_late = statuses.count("kept_late")
        broken = statuses.count("broken")
        decided = kept + kept_late + broken
        promise_keep_rate = round(kept / decided, 4) if decided else 0.0

        return RecoverySummaryOut(
            total_cases=len(cases),
            open_cases=len(open_cases),
            amount_at_risk=round(amount_at_risk, 2),
            recovered_cases=len(recovered),
            recovered_amount=round(recovered_amount, 2),
            recovery_rate=recovery_rate,
            amount_at_risk_by_source={k: round(v, 2) for k, v in amount_at_risk_by_source.items()},
            recovered_amount_by_source={
                k: round(v, 2) for k, v in recovered_amount_by_source.items()
            },
            promises_made=len(promised),
            promises_pending=pending,
            promises_overdue=overdue,
            promises_kept=kept,
            promises_kept_late=kept_late,
            promises_broken=broken,
            promise_keep_rate=promise_keep_rate,
        )

    def _promise_status(self, case, now: datetime) -> str | None:
        """Derived, not stored — a promise's fate is fully determined by
        fields the case already has (status, resolved_at vs
        promised_retry_at), so there's nothing to keep in sync."""
        if case.promised_retry_at is None:
            return None
        if case.status == "recovered":
            if case.resolved_at and case.resolved_at <= case.promised_retry_at:
                return "kept"
            return "kept_late"
        if case.status in ("expired", "stopped"):
            return "broken"
        return "pending" if case.promised_retry_at > now else "overdue"

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
            invoice_id=case.invoice_id,
            plan_id=case.plan_id,
            cart_id=case.cart_id,
            session_id=case.session_id,
            amount_at_risk=float(case.amount_at_risk),
            root_cause=case.root_cause,
            status=case.status,
            attempts=case.attempts,
            opted_out=case.opted_out,
            promised_retry_at=case.promised_retry_at,
            promise_status=self._promise_status(case, datetime.now(timezone.utc)),
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
