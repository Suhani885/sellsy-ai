# Phase 2: Groq Chat Agent — file drop notes

Extract this into your `sellsy-ai/` repo root (it will merge into your
existing `backend/` and `frontend/` folders). All paths below match your
repo exactly.

## New files
- backend/app/models/conversation.py
- backend/app/schemas/chat.py
- backend/app/agents/__init__.py
- backend/app/agents/llm_provider.py       (Groq provider + abstract interface)
- backend/app/agents/prompts.py            (system prompt builder)
- backend/app/agents/retrieval.py          (keyword-based catalog retrieval)
- backend/app/repositories/conversation_repository.py
- backend/app/services/chat_service.py     (orchestration + validation — the core safety logic)
- backend/app/api/routes/chat.py
- backend/alembic/versions/a2b9bb952664_add_conversation_messages_table.py
- frontend/lib/session.js
- frontend/components/ui/input.jsx
- frontend/components/product-card.jsx
- frontend/app/chat/page.js

## Modified files (overwrite your existing copies)
- backend/requirements.txt          (added httpx==0.27.2)
- backend/app/models/__init__.py    (registered ConversationMessage)
- backend/app/api/router.py         (registered chat router)
- frontend/lib/api.js               (added sendChatMessage / getChatHistory)
- frontend/app/page.js              (added "Open chat" link)

## Setup steps after copying files in

```bash
cd backend
python3 -m venv .venv             
source .venv/bin/activate
pip install -r requirements.txt

# Add your real Groq key to backend/.env:
#   GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
#   GROQ_MODEL=llama-3.3-70b-versatile

python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000/chat and try: "I need a laptop for college under 50000"

## What was verified before this was sent to you

Since I don't have a real Groq API key in my sandbox, I could not test an
actual Groq network call. Everything else was tested for real against a
live Postgres + FastAPI stack:

- Full pipeline (retrieval → prompt building → JSON parsing → product ID
  validation → response building → persistence) via a substitute LLM
  provider that returns canned JSON, including one deliberately
  hallucinated product ID — confirmed it gets silently dropped and never
  reaches the response.
- The real `/api/chat` endpoint through FastAPI's routing + Pydantic
  validation + exception handling layers (not just calling the service
  function directly).
- Malformed JSON from the LLM correctly returns `422` with a clean error
  body instead of crashing.
- `/api/chat/{session_id}/history` correctly returns persisted messages
  with full structured output.
- The real endpoint with your current placeholder `GROQ_API_KEY` correctly
  returns `502 AI_PROVIDER_ERROR` with a clear message — so once you drop
  in a real key, the only change needed is that one env var.
- Frontend `/chat` page builds cleanly and renders.

Once you add a real `GROQ_API_KEY`, the only unverified piece is the actual
Groq response — test that first with a simple message and watch the
backend logs (`LOG_LEVEL=INFO`) for the exact prompt and any parsing
warnings.
