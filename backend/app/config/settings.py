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

    # --- Future: AI provider (not wired up yet in this phase) ---
    ai_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # --- Future: Razorpay (not wired up yet in this phase) ---
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # --- Guardrail / policy engine ---
    # Safety ceiling for a single transaction, in rupees. Proposals above
    # this are rejected outright rather than shown to the user. Tune this
    # for your demo — it exists so a hallucinated or manipulated cart can
    # never silently become a large real charge.
    max_transaction_amount_inr: float = 200000.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor so we parse the environment only once."""
    return Settings()


settings = get_settings()
