from fastapi import APIRouter

from app.api.routes import cart, chat, health, products

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(products.router)
api_router.include_router(cart.router)
api_router.include_router(chat.router)
