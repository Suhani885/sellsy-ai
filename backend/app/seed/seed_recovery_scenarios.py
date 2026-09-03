"""
Seed synthetic failed-payment and abandoned-checkout scenarios for the
revenue recovery demo.

Usage (from backend/, with venv activated, after seed_catalog has run):

    python -m app.seed.seed_recovery_scenarios

This creates carts, payment proposals, and (for the failed-payment
scenarios) failed Payment rows directly — the same shapes CartService and
PaymentService produce, just backdated so they immediately qualify as
at-risk under the recovery policy's staleness window. It does not create
RecoveryCase rows itself: run POST /api/recovery/scan (or /run-batch) to
detect them, so the detection step is demonstrated live rather than faked.
"""
import argparse
import logging
import random
from datetime import datetime, timedelta, timezone

from app.models.base import SessionLocal
from app.models.cart import Cart
from app.models.payment import PaymentProposal
from app.models.product import Product
from app.repositories.transaction_repository import TransactionRepository
from app.services.cart_service import CartService

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

FAILED_PAYMENT_SCENARIOS = [
    "Card declined by issuing bank (reason: insufficient funds).",
    "Card declined by issuing bank (reason: do not honor).",
    "Gateway timeout — no response from bank within the allotted time.",
    "Payment signature verification failed.",
]

ABANDONED_CHECKOUT_COUNT = 2


def _make_proposal(
    db, cart_service: CartService, session_id: str, product_ids: list[int], created_at: datetime
) -> PaymentProposal:
    cart_row = Cart(session_id=session_id)
    db.add(cart_row)
    db.flush()

    for product_id in product_ids:
        cart_service.add_item(cart_row.id, product_id=product_id, quantity=1, added_reason="user_selected")

    cart_out = cart_service.get_cart(cart_row.id)
    snapshot = [item.model_dump(mode="json") for item in cart_out.items]

    proposal = PaymentProposal(
        cart_id=cart_row.id,
        session_id=session_id,
        cart_snapshot=snapshot,
        total_amount=cart_out.total,
        reasoning=f"Synthetic recovery-demo proposal for {session_id}.",
        status="proposed",
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    proposal.created_at = created_at
    db.commit()
    db.refresh(proposal)
    return proposal


def seed(db):
    cart_service = CartService(db)
    transaction_repo = TransactionRepository(db)

    products = db.query(Product).order_by(Product.id).limit(12).all()
    if len(products) < 6:
        logger.error(
            "Not enough products in the catalog — run `python -m app.seed.seed_catalog` first."
        )
        return

    now = datetime.now(timezone.utc)

    logger.info("Creating %d failed-payment scenarios...", len(FAILED_PAYMENT_SCENARIOS))
    for i, failure_reason in enumerate(FAILED_PAYMENT_SCENARIOS):
        session_id = f"demo-recovery-failed-{i}"
        product = products[i % len(products)]
        proposal = _make_proposal(
            db, cart_service, session_id, [product.id], now - timedelta(hours=random.randint(1, 6))
        )
        transaction_repo.create_failed(
            proposal_id=proposal.id,
            amount=float(proposal.total_amount),
            failure_reason=failure_reason,
        )

    logger.info("Creating %d abandoned-checkout scenarios...", ABANDONED_CHECKOUT_COUNT)
    for i in range(ABANDONED_CHECKOUT_COUNT):
        session_id = f"demo-recovery-abandoned-{i}"
        first = products[(i * 2) % len(products)].id
        second = products[(i * 2 + 1) % len(products)].id
        _make_proposal(
            db, cart_service, session_id, [first, second], now - timedelta(hours=random.randint(2, 10))
        )

    logger.info(
        "Recovery demo scenarios created. Call POST /api/recovery/scan (or /run-batch) to detect them."
    )


def main():
    parser = argparse.ArgumentParser(
        description="Seed synthetic failed-payment and abandoned-checkout scenarios."
    )
    parser.parse_args()

    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
