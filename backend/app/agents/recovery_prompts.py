import json

RESPONSE_SCHEMA_DESCRIPTION = """
Respond with ONLY a single JSON object (no markdown, no code fences, no text
outside the JSON) matching exactly this shape:

{
  "root_cause": "<one of: card_declined, insufficient_funds, gateway_error, signature_mismatch, checkout_abandoned, invoice_overdue, unknown>",
  "message": "<the recovery message, under 320 characters>"
}

Rules:
- Only use the facts given to you below. Never invent a discount, a new price, a late fee, an interest charge, or a legal threat that wasn't stated.
- Never promise anything the system hasn't already approved — no discounts, no guarantees, no commitments.
"""

CONSUMER_TONE_INSTRUCTIONS = {
    "hinglish": (
        "Write the nudge message in warm, casual Hinglish (Hindi-English "
        "code-mixed, Latin script) — the way a helpful support agent would "
        "text an Indian customer. Stay respectful and clear about the "
        "amount and next step; don't overdo slang. This is a written "
        "chat/SMS-style message, one clear call to action: resume checkout."
    ),
    "voice_hinglish": (
        "Write this as a short spoken phone script in warm, casual Hinglish "
        "(Hindi-English code-mixed, Latin script) — what a support agent or "
        "voice bot would actually say out loud on a call, not text on a "
        "screen. Open with a brief greeting, use short simple sentences "
        "that sound natural when read aloud, never include a link or URL "
        "(a listener can't click anything), and close with a clear spoken "
        "next step (e.g. tell them to check the app or website to finish "
        "paying). No emoji, no markdown — this is read aloud verbatim."
    ),
    "standard": (
        "Write the nudge message in plain, professional English — brief "
        "and helpful, not pushy. One clear call to action: resume checkout."
    ),
}

RECEIVABLE_TONE_INSTRUCTIONS = {
    "hinglish": (
        "Write the payment reminder in polite, professional Hinglish "
        "(Hindi-English code-mixed, Latin script) — the way a small "
        "business's accounts team would message another business they "
        "have an ongoing relationship with. Respectful, not casual — this "
        "is a B2B collections message, not a chat with a shopper. One "
        "clear call to action: settle the invoice or contact the accounts "
        "team."
    ),
    "voice_hinglish": (
        "Write this as a short, professional spoken phone script in "
        "Hinglish (Hindi-English code-mixed, Latin script) that an "
        "accounts-receivable caller would read to a business customer's "
        "office. Open with a brief greeting and identify the invoice, use "
        "short natural sentences, never include a link (a listener can't "
        "click anything), stay firm but courteous, and close with a clear "
        "spoken next step. No emoji, no markdown."
    ),
    "standard": (
        "Write the payment reminder in plain, professional English — the "
        "tone of a standard accounts-receivable follow-up email, firm but "
        "courteous, never threatening. One clear call to action: settle "
        "the invoice or contact the accounts team."
    ),
}


def build_diagnosis_prompt(tone: str, known_root_cause: str | None) -> str:
    is_receivable = known_root_cause == "invoice_overdue"
    tone_map = RECEIVABLE_TONE_INSTRUCTIONS if is_receivable else CONSUMER_TONE_INSTRUCTIONS
    tone_instruction = tone_map.get(tone, tone_map["standard"])

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

    if is_receivable:
        role = """You are a B2B receivables assistant for Sellsy AI, an online
electronics merchant that also sells in bulk to business customers on
invoice/credit terms. An invoice has gone past its due date and you are
drafting a payment reminder ("chaser") referencing the invoice amount and
how overdue it is. You are advisory only — you never charge anything,
change an amount, or contact the customer directly; the backend decides
whether and when to send whatever "message" you draft, after validating
it."""
    else:
        role = """You are a revenue-recovery assistant for Sellsy AI, an online
electronics merchant. A payment or checkout stalled and you are drafting a
short outreach message to help the customer complete it. You are advisory
only — you never charge anything, change a price, or contact the customer
directly; the backend decides whether and when to send whatever "message"
you draft, after validating it."""

    return f"""{role}

{cause_instruction}

{tone_instruction}

{RESPONSE_SCHEMA_DESCRIPTION}
"""


def build_case_context_message(context: dict) -> str:
    return json.dumps(context, ensure_ascii=False)
