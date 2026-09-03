"""
Keyword-based catalog retrieval for grounding the agent's prompt.
"""
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.product import Product

_STOPWORDS = {
    "the", "a", "an", "for", "and", "with", "under", "over", "need", "want",
    "looking", "show", "me", "some", "please", "can", "you", "i", "im", "is",
    "of", "to", "in", "on", "my", "best", "good", "cheap", "budget", "college",
}

MAX_CANDIDATES = 15


def _extract_keywords(message: str) -> list[str]:
    words = [w.strip(".,!?₹") for w in message.lower().split()]
    return [w for w in words if len(w) >= 3 and w not in _STOPWORDS]


def retrieve_candidate_products(db: Session, message: str) -> list[Product]:
    keywords = _extract_keywords(message)

    matched: list[Product] = []
    if keywords:
        conditions = []
        for kw in keywords:
            like = f"%{kw}%"
            conditions.append(Product.name.ilike(like))
            conditions.append(Product.category.ilike(like))
            conditions.append(Product.description.ilike(like))

        stmt = select(Product).where(or_(*conditions)).limit(MAX_CANDIDATES)
        matched = list(db.execute(stmt).scalars().all())

    if len(matched) >= 5:
        return matched[:MAX_CANDIDATES]

    # Fallback for too few keyword matches: one representative product per
    # category instead of the whole catalog.
    fallback_stmt = select(Product).order_by(Product.category, Product.price)
    all_products = list(db.execute(fallback_stmt).scalars().all())

    seen_categories = set()
    representatives = []
    for product in all_products:
        if product.category not in seen_categories:
            representatives.append(product)
            seen_categories.add(product.category)

    combined = matched + [p for p in representatives if p not in matched]
    return combined[:MAX_CANDIDATES]
