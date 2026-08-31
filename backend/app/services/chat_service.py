"""
ChatService orchestrates a single chat turn:

  1. Retrieve a relevant candidate set of products from the DB (retrieval.py).
  2. Build a system prompt grounded in those real products (prompts.py).
  3. Call the LLM provider and get back raw JSON text.
  4. Parse + validate that JSON against the AgentRawOutput schema.
  5. Re-validate every product ID against the database — anything the LLM
     mentions that doesn't correspond to a real product is silently
     dropped (and logged), never shown to the user.
  6. Build the final ChatResponse using DB data (names, prices) as the
     source of truth — never the LLM's own text for those fields.
  7. Persist both the user's message and the agent's structured output.

The LLM is advisory only. Nothing here writes to a cart or touches money.
"""
import json
import logging

from sqlalchemy.orm import Session

from app.agents.llm_provider import LLMProvider, get_llm_provider
from app.agents.prompts import build_system_prompt
from app.agents.retrieval import retrieve_candidate_products
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.chat import AgentRawOutput, ChatResponse, UpsellProposal
from app.schemas.product import ProductOut
from app.utils.exceptions import ValidationAppError

logger = logging.getLogger(__name__)

MAX_HISTORY_MESSAGES = 6


class ChatService:
    def __init__(self, db: Session, llm_provider: LLMProvider | None = None):
        self.db = db
        self.product_repo = ProductRepository(db)
        self.conversation_repo = ConversationRepository(db)
        self.llm_provider = llm_provider or get_llm_provider()

    async def handle_message(self, session_id: str, user_message: str) -> ChatResponse:
        # Persist the user's message immediately, regardless of what happens next.
        self.conversation_repo.add_message(session_id, role="user", content=user_message)

        candidates = retrieve_candidate_products(self.db, user_message)
        system_prompt = build_system_prompt(candidates)

        raw_json = await self.llm_provider.complete_json(system_prompt, user_message)
        agent_output = self._parse_agent_output(raw_json)

        validated_product_ids = self._validate_product_ids(agent_output.recommended_product_ids)
        recommended_products = [
            ProductOut.model_validate(self.product_repo.get_by_id(pid))
            for pid in validated_product_ids
        ]

        upsell = self._build_validated_upsell(agent_output.upsell_product_id)

        response = ChatResponse(
            session_id=session_id,
            intent=agent_output.intent,
            message_to_user=agent_output.message_to_user,
            recommended_products=recommended_products,
            upsell=upsell,
            reasoning=agent_output.reasoning,
        )

        # Persist the agent's turn, including the full structured output for
        # explainability/audit purposes.
        self.conversation_repo.add_message(
            session_id,
            role="agent",
            content=agent_output.message_to_user,
            structured_output=response.model_dump(mode="json"),
        )

        return response

    def _parse_agent_output(self, raw_json: str) -> AgentRawOutput:
        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            logger.warning("Agent returned non-JSON output: %s", raw_json[:500])
            raise ValidationAppError(
                "The AI assistant returned an unexpected response. Please try again."
            ) from exc

        try:
            return AgentRawOutput.model_validate(data)
        except Exception as exc:  # pydantic ValidationError
            logger.warning("Agent JSON failed schema validation: %s | raw=%s", exc, raw_json[:500])
            raise ValidationAppError(
                "The AI assistant returned a response in an unexpected format. Please try again."
            ) from exc

    def _validate_product_ids(self, product_ids: list[int]) -> list[int]:
        """Keep only IDs that correspond to real products. Never trust the
        LLM's list at face value — it may hallucinate or reference stale
        context."""
        valid_ids = []
        for pid in product_ids:
            if self.product_repo.exists(pid):
                valid_ids.append(pid)
            else:
                logger.warning("Agent referenced nonexistent product_id=%s — dropped.", pid)
        return valid_ids

    def _build_validated_upsell(self, upsell_product_id: int | None) -> UpsellProposal | None:
        if upsell_product_id is None:
            return None

        product = self.product_repo.get_by_id(upsell_product_id)
        if product is None:
            logger.warning(
                "Agent proposed upsell for nonexistent product_id=%s — dropped.",
                upsell_product_id,
            )
            return None

        return UpsellProposal(
            product=ProductOut.model_validate(product),
            reasoning=f"Recommended as a complementary add-on: {product.name}.",
        )
