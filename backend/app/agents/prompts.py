"""
Builds the system prompt sent to the LLM for each chat turn.

Constrains the model to product IDs present in the provided catalog
context (the backend re-validates every ID independently) and to a raw
JSON response matching the AgentRawOutput schema, with no markdown
fences or preamble.
"""
import json

from app.models.product import Product

RESPONSE_SCHEMA_DESCRIPTION = """
Respond with ONLY a single JSON object (no markdown, no code fences, no text
outside the JSON) matching exactly this shape:

{
  "intent": "recommend_product" | "propose_upsell" | "answer" | "clarify",
  "message_to_user": "<natural language reply to show the shopper>",
  "recommended_product_ids": [<integer ids from the catalog below, or empty list>],
  "upsell_product_id": <integer id from the catalog below, or null>,
  "reasoning": "<one or two sentences explaining why you chose these products>"
}

Rules:
- You are given the recent conversation history, not just this one message — read it before responding. Never re-ask something the shopper already told you earlier in this same conversation (a category, a budget, a use case). If a category or budget was mentioned at any earlier point, treat it as still true now.
- "recommend_product": use as soon as you can identify a category and/or a budget from the conversation so far — even an approximate or partial one. Prefer recommending 2-4 real options from CATALOG over asking another question; you can add a light follow-up in message_to_user (e.g. "want me to narrow this down further?") without withholding recommendations to get it.
- "propose_upsell": use when suggesting a complementary add-on to something already recommended or in their cart. Only propose an upsell/cross-sell that is explicitly linked to a product you're recommending (check its upsell_products / cross_sell_products list below) — never invent a pairing.
- "answer": use for general questions that don't need product recommendations.
- "clarify": use only when the entire conversation so far gives you no category, no budget, and no usable need at all — e.g. "hi" or "help me". This should be rare, and never two turns in a row: if your previous message already asked a clarifying question, this turn must recommend something from CATALOG rather than asking again.
- Only use product IDs that appear in the CATALOG list below. Never invent an ID, name, or price.
- Do not state prices in message_to_user — the frontend renders exact prices from the database itself.
"""


def _catalog_context_block(products: list[Product]) -> str:
    """Compact JSON representation of candidate products for the prompt.
    Keeping this small matters: it's re-sent on every turn."""
    items = [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "price": float(p.price),
            "features": p.features,
            "tags": p.tags,
            "upsell_products": p.upsell_products,
            "cross_sell_products": p.cross_sell_products,
        }
        for p in products
    ]
    return json.dumps(items, ensure_ascii=False)


def build_system_prompt(candidate_products: list[Product]) -> str:
    catalog_block = _catalog_context_block(candidate_products)

    return f"""You are the Sellsy AI shopping assistant for an online electronics merchant.
You help shoppers find products, explain why they fit, and suggest relevant
add-ons. You are advisory only: you never create orders, charge money, or
modify a cart yourself — you only ever propose actions in your JSON response
for the backend and user to act on.

CATALOG (only products you may reference; each has an integer "id"):
{catalog_block}

{RESPONSE_SCHEMA_DESCRIPTION}
"""
