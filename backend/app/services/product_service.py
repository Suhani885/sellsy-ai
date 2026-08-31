from sqlalchemy.orm import Session

from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.utils.exceptions import NotFoundError


class ProductService:
    def __init__(self, db: Session):
        self.repo = ProductRepository(db)

    def list_products(
        self,
        category: str | None = None,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Product]:
        # Guard against unreasonable page sizes.
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        return self.repo.get_all(category=category, search=search, limit=limit, offset=offset)

    def get_product(self, product_id: int) -> Product:
        product = self.repo.get_by_id(product_id)
        if product is None:
            raise NotFoundError(f"Product {product_id} was not found.")
        return product