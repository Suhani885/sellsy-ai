from fastapi import APIRouter

from app.api.routes import (
    analytics,
    audit,
    cart,
    chat,
    health,
    payment,
    products,
    receivable,
    recovery,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(chat.router)
api_router.include_router(payment.router)
api_router.include_router(audit.router)
api_router.include_router(analytics.router)
api_router.include_router(recovery.router)
api_router.include_router(receivable.router)
