from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Numeric, String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Numeric, never float — this is the single source of truth for pricing.
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    inventory: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    features: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Lists of related product IDs, used by the recommendation engine.
    compatible_products: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    upsell_products: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    cross_sell_products: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )