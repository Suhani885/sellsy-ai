"""
Seed the database with the synthetic Sellsy AI merchant catalog.

Usage (from backend/, with venv activated):

    python -m app.seed.seed_catalog            # seed (skips if products already exist)
    python -m app.seed.seed_catalog --reset     # wipe existing products/carts first, then seed

Products reference each other by a temporary `sku` string in catalog_data.py
(compatible_products / upsell_products / cross_sell_products). This script:
  1. Inserts every product with those relation fields empty.
  2. Builds a sku -> real database id map.
  3. Goes back and fills in the relation fields with real integer IDs.

This two-pass approach means catalog_data.py never has to hardcode database
IDs, which would silently break the moment seeding order changes.
"""
import argparse
import logging

from sqlalchemy import text

from app.models.base import SessionLocal
from app.models.cart import Cart, CartItem
from app.models.product import Product
from app.seed.catalog_data import CATALOG

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def reset_tables(db):
    logger.info("Resetting: deleting all cart_items, carts, and products...")
    db.execute(text("DELETE FROM cart_items"))
    db.execute(text("DELETE FROM carts"))
    db.execute(text("DELETE FROM products"))
    db.commit()


def seed(db, reset: bool = False):
    if reset:
        reset_tables(db)

    existing_count = db.query(Product).count()
    if existing_count > 0 and not reset:
        logger.info(
            "Products table already has %d rows — skipping seed. "
            "Run with --reset to wipe and reseed.",
            existing_count,
        )
        return

    logger.info("Inserting %d products...", len(CATALOG))

    sku_to_id: dict[str, int] = {}
    sku_to_relations: dict[str, dict] = {}

    # Pass 1: insert every product with relation fields empty for now.
    for item in CATALOG:
        product = Product(
            name=item["name"],
            description=item["description"],
            category=item["category"],
            price=item["price"],
            inventory=item["inventory"],
            features=item["features"],
            tags=item["tags"],
            compatible_products=[],
            upsell_products=[],
            cross_sell_products=[],
        )
        db.add(product)
        db.flush()  # assigns product.id without committing yet

        sku_to_id[item["sku"]] = product.id
        sku_to_relations[item["sku"]] = {
            "compatible_products": item["compatible_products"],
            "upsell_products": item["upsell_products"],
            "cross_sell_products": item["cross_sell_products"],
        }

    db.commit()
    logger.info("Inserted %d products. Resolving cross-references...", len(sku_to_id))

    # Pass 2: resolve sku references to real integer IDs and update each row.
    unresolved = set()
    for sku, product_id in sku_to_id.items():
        relations = sku_to_relations[sku]
        resolved = {}
        for field, sku_list in relations.items():
            ids = []
            for related_sku in sku_list:
                related_id = sku_to_id.get(related_sku)
                if related_id is None:
                    unresolved.add(related_sku)
                    continue
                ids.append(related_id)
            resolved[field] = ids

        product = db.get(Product, product_id)
        product.compatible_products = resolved["compatible_products"]
        product.upsell_products = resolved["upsell_products"]
        product.cross_sell_products = resolved["cross_sell_products"]

    db.commit()

    if unresolved:
        logger.warning(
            "Some SKUs referenced in catalog_data.py were never defined as products: %s",
            sorted(unresolved),
        )

    logger.info("Seed complete. %d products in database.", db.query(Product).count())


def main():
    parser = argparse.ArgumentParser(description="Seed the Sellsy AI product catalog.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing carts/cart_items/products before seeding.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seed(db, reset=args.reset)
    finally:
        db.close()


if __name__ == "__main__":
    main()
