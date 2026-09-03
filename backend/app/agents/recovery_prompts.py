import json

RESPONSE_SCHEMA_DESCRIPTION = """
Respond with ONLY a single JSON object (no markdown, no code fences, no text
outside the JSON) matching exactly this shape:

{
  "root_cause": "<one of: card_declined, insufficient_funds, gateway_error, signature_mismatch, checkout_abandoned, unknown>",
  "message": "<the recovery nudge to send the customer, under 320 characters>"
}

Rules:
- Only use the facts given to you below (amount, item names, failure reason). Never invent a discount, a new price, or a reason that wasn't stated.
- Never promise anything the system hasn't already approved — no discounts, no guarantees, no legal or financial commitments.
- Keep "message" short enough for a single chat/SMS-style nudge, with one clear call to action: resume checkout.
"""


def build_diagnosis_prompt(tone: str, known_root_cause: str | None) -> str:
    if tone == "hinglish":
        tone_instruction = (
            "Write the nudge message in warm, casual Hinglish (Hindi-English "
            "code-mixed, Latin script) — the way a helpful support agent "
            "would text an Indian customer. Stay respectful and clear about "
            "the amount and next step; don't overdo slang."
        )
    else:
        tone_instruction = (
            "Write the nudge message in plain, professional English — "
            "brief and helpful, not pushy."
        )

    if known_root_cause:
        cause_instruction = (
            f'The root cause is already known to be "{known_root_cause}" — set '
            f'"root_cause" to exactly that value. Focus your effort on the message.'
        )
    else:
        cause_instruction = (
            "Classify the root cause from the failure reason given below into "
            "one of the fixed categories."
        )

    return f"""You are a revenue-recovery assistant for Sellsy AI, an online
electronics merchant. A payment or checkout stalled and you are drafting a
short outreach message to help the customer complete it. You are advisory
only — you never charge anything, change a price, or contact the customer
directly; the backend decides whether and when to send whatever "message"
you draft, after validating it.

{cause_instruction}

{tone_instruction}

{RESPONSE_SCHEMA_DESCRIPTION}
"""


def build_case_context_message(context: dict) -> str:
    return json.dumps(context, ensure_ascii=False)
