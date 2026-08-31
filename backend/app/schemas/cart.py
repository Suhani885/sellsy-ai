from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductOut


class CartCreate(BaseModel):
    """Body for POST /api/cart. Everything is optional — a cart can be
    created empty and items added in a later phase."""

    session_id: str | None = Field(default=None, max_length=255)


class CartItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: int
    added_reason: str
    product: ProductOut | None = None


class CartOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str | None
    created_at: datetime
    items: list[CartItemOut] = []