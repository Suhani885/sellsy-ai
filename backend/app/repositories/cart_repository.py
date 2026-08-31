from sqlalchemy.orm import Session, selectinload

from app.models.cart import Cart, CartItem


class CartRepository:
    """Pure data-access layer for Cart and CartItem. No business logic
    lives here — that belongs in CartService."""

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

    def add_item(
        self, cart_id: int, product_id: int, quantity: int, added_reason: str
    ) -> CartItem:
        item = CartItem(
            cart_id=cart_id,
            product_id=product_id,
            quantity=quantity,
            added_reason=added_reason,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def get_item(self, cart_id: int, item_id: int) -> CartItem | None:
        return (
            self.db.query(CartItem)
            .filter(CartItem.id == item_id, CartItem.cart_id == cart_id)
            .first()
        )

    def remove_item(self, item: CartItem) -> None:
        self.db.delete(item)
        self.db.commit()
