"""
LLM provider abstraction.

The rest of the app (ChatService) only ever talks to the LLMProvider
interface, never to Groq directly. This keeps the provider swappable and,
just as importantly, makes ChatService trivially testable by substituting a
fake provider that returns canned JSON — no real API key or network call
required.
"""
from abc import ABC, abstractmethod

import httpx

from app.config.settings import settings
from app.utils.exceptions import AppException
from fastapi import status


class AIProviderError(AppException):
    """Raised when the LLM provider fails to respond or returns something
    unusable. Mapped to 502 — this is an upstream failure, not a client
    error and not our server's fault."""

    status_code = status.HTTP_502_BAD_GATEWAY
    error_code = "AI_PROVIDER_ERROR"


class LLMProvider(ABC):
    @abstractmethod
    async def complete_json(self, system_prompt: str, user_message: str) -> str:
        """Return the raw JSON string produced by the model. Callers are
        responsible for parsing/validating it — this method's only job is
        talking to the provider and getting text back."""
        raise NotImplementedError


class GroqProvider(LLMProvider):
    """Groq's API is OpenAI-compatible, so this is a standard chat
    completions call with response_format json_object to force structured
    output."""

    API_URL = "https://api.groq.com/openai/v1/chat/completions"
    TIMEOUT_SECONDS = 20.0

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.groq_api_key
        self.model = model or settings.groq_model

    async def complete_json(self, system_prompt: str, user_message: str) -> str:
        if not self.api_key or self.api_key == "placeholder":
            raise AIProviderError(
                "Groq API key is not configured. Set GROQ_API_KEY in backend/.env."
            )

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.3,
            "max_tokens": 2048,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.TIMEOUT_SECONDS) as client:
                response = await client.post(self.API_URL, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise AIProviderError(f"Could not reach Groq API: {exc}") from exc

        if response.status_code != 200:
            raise AIProviderError(
                f"Groq API returned status {response.status_code}: {response.text[:300]}"
            )

        try:
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as exc:
            raise AIProviderError(f"Unexpected Groq API response shape: {exc}") from exc


def get_llm_provider() -> LLMProvider:
    """Factory — swap providers here based on settings.ai_provider if more
    are added later."""
    if settings.ai_provider == "groq":
        return GroqProvider()
    raise AIProviderError(f"Unknown AI provider configured: {settings.ai_provider}")