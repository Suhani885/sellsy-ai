from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductOut


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1, max_length=2000)


# --- What the LLM is instructed to return. This is parsed straight from the
# model's JSON output and MUST be treated as untrusted input: every ID in
# here gets re-validated against the real catalog before it's ever shown to
# a user or used for anything financial. ---
class AgentRawOutput(BaseModel):
    intent: Literal["recommend_product", "propose_upsell", "answer", "clarify"]
    message_to_user: str
    recommended_product_ids: list[int] = Field(default_factory=list)
    upsell_product_id: int | None = None
    reasoning: str = ""


class UpsellProposal(BaseModel):
    product: ProductOut
    reasoning: str


class ChatResponse(BaseModel):
    session_id: str
    intent: str
    message_to_user: str
    recommended_products: list[ProductOut] = Field(default_factory=list)
    upsell: UpsellProposal | None = None
    reasoning: str = ""


class ConversationMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    structured_output: dict | None = None
    created_at: datetime
