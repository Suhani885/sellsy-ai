"""
CartService owns all cart business logic, most importantly: every price
shown to the user is computed here, from the product's current price in
the database — never trusted from the client, never cached on the cart
item itself. This matters because it's the same principle a later payment
step must follow: the amount charged always comes from a fresh DB read,
never from anything the frontend sends.
"""
from sqlalchemy.orm import Session

from app.models.cart import Cart
from app.repositories.cart_repository import CartRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.cart import CartItemOut, CartOut
from app.schemas.product import ProductOut
from app.utils.exceptions import NotFoundError, ValidationAppError


class CartService:
    def __init__(self, db: Session):
        self.repo = CartRepository(db)
        self.product_repo = ProductRepository(db)

    def create_cart(self, session_id: str | None) -> CartOut:
        cart = self.repo.create(session_id=session_id)
        return self._build_cart_out(cart)

    def get_cart(self, cart_id: int) -> CartOut:
        cart = self._get_cart_or_404(cart_id)
        return self._build_cart_out(cart)

    def add_item(
        self, cart_id: int, product_id: int, quantity: int, added_reason: str
    ) -> CartOut:
        self._get_cart_or_404(cart_id)  # raises NotFoundError if missing

        product = self.product_repo.get_by_id(product_id)
        if product is None:
            raise NotFoundError(f"Product {product_id} was not found.")

        if quantity > product.inventory:
            raise ValidationAppError(
                f"Only {product.inventory} unit(s) of '{product.name}' are in stock."
            )

        self.repo.add_item(
            cart_id=cart_id,
            product_id=product_id,
            quantity=quantity,
            added_reason=added_reason,
        )

        cart = self._get_cart_or_404(cart_id)
        return self._build_cart_out(cart)

    def remove_item(self, cart_id: int, item_id: int) -> CartOut:
        self._get_cart_or_404(cart_id)

        item = self.repo.get_item(cart_id, item_id)
        if item is None:
            raise NotFoundError(f"Cart item {item_id} was not found in cart {cart_id}.")

        self.repo.remove_item(item)

        cart = self._get_cart_or_404(cart_id)
        return self._build_cart_out(cart)

    def clear_cart(self, cart_id: int) -> None:
        """Empties a cart's items — called after a successful payment so a
        paid-for order doesn't linger and get shown (or re-orderable) as
        if it were still an active cart. The Cart row itself is kept and
        reused for whatever the person adds next."""
        self._get_cart_or_404(cart_id)
        self.repo.clear_items(cart_id)

    def _get_cart_or_404(self, cart_id: int) -> Cart:
        cart = self.repo.get_by_id(cart_id)
        if cart is None:
            raise NotFoundError(f"Cart {cart_id} was not found.")
        return cart

    def _build_cart_out(self, cart: Cart) -> CartOut:
        """Builds the response with prices computed fresh from each item's
        product, right now — not from anything stored on the cart item."""
        item_outs: list[CartItemOut] = []
        total = 0.0

        for item in cart.items:
            product = self.product_repo.get_by_id(item.product_id)
            if product is None:
                # Product was deleted after being added to a cart. Skip it
                # rather than crash — a real merchant catalog can change
                # under an open cart.
                continue

            unit_price = float(product.price)
            line_total = round(unit_price * item.quantity, 2)
            total += line_total

            item_outs.append(
                CartItemOut(
                    id=item.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    added_reason=item.added_reason,
                    product=ProductOut.model_validate(product),
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )

        return CartOut(
            id=cart.id,
            session_id=cart.session_id,
            created_at=cart.created_at,
            items=item_outs,
            total=round(total, 2),
        )
