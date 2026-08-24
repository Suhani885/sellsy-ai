from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.cart import CartCreate, CartOut
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
