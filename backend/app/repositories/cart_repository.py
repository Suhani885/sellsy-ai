from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart


class CartRepository:
    """Pure data-access layer for Cart. No business logic lives here —
    that belongs in CartService."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, session_id: str | None) -> Cart:
        cart = Cart(session_id=session_id)
        self.db.add(cart)
        self.db.commit()
        self.db.refresh(cart)
        return cart

    def get_by_id(self, cart_id: int) -> Cart | None:
        return (
            self.db.query(Cart)
            .options(selectinload(Cart.items))
            .filter(Cart.id == cart_id)
            .first()
        )
