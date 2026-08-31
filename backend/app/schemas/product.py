from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProductOut(BaseModel):
    """Product representation returned by the API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    category: str
    price: float
    inventory: int
    features: list
    tags: list
    compatible_products: list
    upsell_products: list
    cross_sell_products: list
    created_at: datetime