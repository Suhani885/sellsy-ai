from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.cart import CartCreate, CartItemCreate, CartOut
from app.services.cart_service import CartService

router = APIRouter(prefix="/api/cart", tags=["cart"])


@router.post("", response_model=CartOut, status_code=201)
def create_cart(payload: CartCreate, db: Session = Depends(get_db)):
    service = CartService(db)
    return service.create_cart(session_id=payload.session_id)


@router.get("/{cart_id}", response_model=CartOut)
def get_cart(cart_id: int, db: Session = Depends(get_db)):
    service = CartService(db)
    return service.get_cart(cart_id)


@router.post("/{cart_id}/items", response_model=CartOut, status_code=201)
def add_item(cart_id: int, payload: CartItemCreate, db: Session = Depends(get_db)):
    service = CartService(db)
    return service.add_item(
        cart_id=cart_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        added_reason=payload.added_reason,
    )


@router.delete("/{cart_id}/items/{item_id}", response_model=CartOut)
def remove_item(cart_id: int, item_id: int, db: Session = Depends(get_db)):
    service = CartService(db)
    return service.remove_item(cart_id, item_id)
