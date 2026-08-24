import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config.settings import settings
from app.utils.exceptions import register_exception_handlers
from app.utils.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.app_name,
    description="AI-powered merchant commerce agent — service-oriented FastAPI backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(api_router)


@app.on_event("startup")
async def on_startup():
    logger.info("Sellsy AI backend starting up (environment=%s)", settings.environment)
    logger.info("Allowed CORS origins: %s", settings.cors_origins)


@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Sellsy AI backend shutting down")
