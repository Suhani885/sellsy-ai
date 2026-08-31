"""
Import every model module here so that Base.metadata knows about all tables
before Alembic (or create_all) inspects it.
"""
from app.models.base import Base  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.cart import Cart, CartItem  # noqa: F401
from app.models.conversation import ConversationMessage  # noqa: F401
