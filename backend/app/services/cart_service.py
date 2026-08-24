from sqlalchemy.orm import Session

from app.models.cart import Cart
from app.repositories.cart_repository import CartRepository
from app.utils.exceptions import NotFoundError


class CartService:
    def __init__(self, db: Session):
        self.repo = CartRepository(db)

    def create_cart(self, session_id: str | None) -> Cart:
        return self.repo.create(session_id=session_id)

    def get_cart(self, cart_id: int) -> Cart:
        cart = self.repo.get_by_id(cart_id)
        if cart is None:
            raise NotFoundError(f"Cart {cart_id} was not found.")
        return cart
