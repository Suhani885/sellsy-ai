"""
Guardrail / policy engine. Deterministic — no LLM calls in this module.
Runs after the cart total is computed server-side (CartService) and
before it can become a PaymentProposal.
"""
from app.config.settings import settings
from app.schemas.cart import CartOut
from app.utils.exceptions import AppException
from fastapi import status


class PolicyViolationError(AppException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    error_code = "POLICY_VIOLATION"


def run_guardrails(cart: CartOut) -> None:
    """Raises PolicyViolationError on the first violation found."""

    _check_cart_not_empty(cart)
    _check_max_transaction_amount(cart)
    _check_inventory_still_available(cart)


def _check_cart_not_empty(cart: CartOut) -> None:
    if not cart.items:
        raise PolicyViolationError("Cannot propose a payment for an empty cart.")


def _check_max_transaction_amount(cart: CartOut) -> None:
    if cart.total > settings.max_transaction_amount_inr:
        raise PolicyViolationError(
            f"This order total (₹{cart.total:,.2f}) exceeds the maximum "
            f"allowed transaction amount (₹{settings.max_transaction_amount_inr:,.2f}). "
            "Please remove some items or contact support for a larger order."
        )


def _check_inventory_still_available(cart: CartOut) -> None:
    """Re-check stock at proposal time — the cart may be stale and
    inventory can have changed since items were added."""
    for item in cart.items:
        if item.quantity > item.product.inventory:
            raise PolicyViolationError(
                f"'{item.product.name}' now only has {item.product.inventory} "
                f"unit(s) in stock, but {item.quantity} were requested. "
                "Please update your cart."
            )


def build_reasoning(cart: CartOut) -> str:
    """Plain-language explanation of the proposed order, shown alongside
    the approval UI."""
    lines = [f"This order includes {len(cart.items)} item(s):"]
    for item in cart.items:
        tag = " (suggested add-on)" if item.added_reason == "upsell_accepted" else ""
        lines.append(
            f"  - {item.quantity} x {item.product.name}{tag} — ₹{item.line_total:,.2f}"
        )
    lines.append(f"Total: ₹{cart.total:,.2f}")
    lines.append(
        "This total was calculated directly from current product prices in "
        "the database and passed all policy checks (non-empty cart, within "
        "transaction limit, sufficient stock)."
    )
    return "\n".join(lines)
