from dataclasses import dataclass
from datetime import datetime, timedelta

from app.config.settings import settings

ROOT_CAUSES = {
    "card_declined",
    "insufficient_funds",
    "gateway_error",
    "signature_mismatch",
    "checkout_abandoned",
    "invoice_overdue",
    "unknown",
}

OPEN_STATUSES = ("detected", "attempting")


@dataclass
class RecoveryDecision:
    action: str | None = None  # "nudge" | "final_notice"
    new_status: str | None = None  # "expired" | "stopped", when the case should close
    reason: str | None = None


def decide_next_action(case, now: datetime) -> RecoveryDecision:
    """Deterministic escalation ladder and stopping rules. No LLM involved —
    every recovery case that gets contacted, and every case that gets
    stopped, is decided by a plain condition here, auditable independent of
    whatever the diagnosis agent said."""

    if case.status not in OPEN_STATUSES:
        return RecoveryDecision()

    if case.opted_out:
        return RecoveryDecision(
            new_status="stopped", reason="Customer opted out of recovery contact."
        )

    ceiling = (
        settings.recovery_receivable_max_amount_inr
        if case.source_type == "overdue_invoice"
        else settings.max_transaction_amount_inr
    )
    if float(case.amount_at_risk) > ceiling:
        return RecoveryDecision(
            new_status="stopped",
            reason=(
                f"Amount at risk exceeds the automated recovery ceiling "
                f"(₹{ceiling:,.2f}) — requires human review, not automated contact."
            ),
        )

    if case.attempts >= settings.recovery_max_attempts:
        return RecoveryDecision(
            new_status="expired",
            reason="Maximum recovery attempts reached with no resolution.",
        )

    if case.promised_retry_at and case.promised_retry_at > now:
        return RecoveryDecision()  # waiting on the customer's own promised date

    if case.last_action_at:
        cooldown = timedelta(hours=settings.recovery_cooldown_hours)
        if now - case.last_action_at < cooldown:
            return RecoveryDecision()  # still inside the cooldown window

    is_final = case.attempts == settings.recovery_max_attempts - 1
    return RecoveryDecision(action="final_notice" if is_final else "nudge")
