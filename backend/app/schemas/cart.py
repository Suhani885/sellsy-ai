from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductOut


class CartCreate(BaseModel):
    """Body for POST /api/cart. Everything is optional — a cart can be
    created empty and items added afterwards."""

    session_id: str | None = Field(default=None, max_length=255)


class CartItemCreate(BaseModel):
    """Body for POST /api/cart/{cart_id}/items."""

    product_id: int
    quantity: int = Field(default=1, ge=1, le=99)
    added_reason: str = Field(default="user_selected", max_length=100)


class CartItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    added_reason: str
    product: ProductOut

    # Computed server-side from the product's current price — never trust
    # a price coming from the client or from cached data. This is always
    # freshly calculated at read time in CartService.
    unit_price: float
    line_total: float


class CartOut(BaseModel):
    id: int
    session_id: str | None
    created_at: datetime
    items: list[CartItemOut] = []

    # Sum of every item's line_total, calculated server-side. This is the
    # number a future payment step must use — never a total sent by the
    # frontend.
    total: float
