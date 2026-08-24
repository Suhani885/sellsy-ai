from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.product import Product


class ProductRepository:
    """Pure data-access layer for Product. No business logic lives here —
    that belongs in ProductService."""

    def __init__(self, db: Session):
        self.db = db

    def get_all(
        self,
        category: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Product]:
        stmt = select(Product)

        if category:
            stmt = stmt.where(Product.category == category)

        if search:
            like_pattern = f"%{search.lower()}%"
            stmt = stmt.where(Product.name.ilike(like_pattern))

        stmt = stmt.order_by(Product.id).offset(offset).limit(limit)
        return list(self.db.execute(stmt).scalars().all())

    def get_by_id(self, product_id: int) -> Product | None:
        return self.db.get(Product, product_id)

    def exists(self, product_id: int) -> bool:
        return self.get_by_id(product_id) is not None
