"""
Central application configuration.

All configuration is read from environment variables (via a local .env file
in development). Nothing here is hardcoded — see .env.example for the list
of variables this app expects.
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- App ---
    app_name: str = "Sellsy AI API"
    environment: str = "development"
    log_level: str = "INFO"

    # --- Database ---
    database_url: str

    # --- CORS ---
    # Comma-separated list of allowed origins, e.g. "http://localhost:3000,https://myapp.vercel.app"
    frontend_origins: str = "http://localhost:3000"

    # --- AI provider ---
    ai_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # --- Razorpay ---
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # --- Guardrail / policy engine ---
    # Safety ceiling for a single transaction, in rupees; proposals above
    # this are rejected outright. Prevents a hallucinated or manipulated
    # cart from becoming a large real charge.
    max_transaction_amount_inr: float = 200000.0

    # --- Revenue recovery engine ---
    recovery_max_attempts: int = 3
    recovery_cooldown_hours: int = 24
    recovery_stale_proposal_minutes: int = 30

    # B2B invoices are issued directly by the merchant, not built from an
    # AI-suggested cart, so they don't carry the "hallucinated cart" risk
    # max_transaction_amount_inr guards against — but a very large invoice
    # still shouldn't get an automated chaser without a human looking at it.
    recovery_receivable_max_amount_inr: float = 1000000.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so we parse the environment only once."""
    return Settings()


settings = get_settings()
