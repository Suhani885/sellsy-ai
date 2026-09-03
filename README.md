# Sellsy AI

An AI-powered shopping assistant for an electronics merchant, extended
with a revenue-recovery engine. You describe what you need in plain
language, it recommends real, in-stock products with real prices,
proposes relevant add-ons, and walks you through a payment you approve
before anything is charged — via Razorpay in test mode. When a payment
fails or a checkout gets abandoned instead, a separate, bounded recovery
workflow detects it, diagnoses why, and sends a tracked nudge to win the
revenue back.

Built for Razorpay's **AI Revenue Recovery** track.

## What it does

1. **Ask for something** — "a laptop for college under ₹50,000" — and the
   assistant searches a real product catalog, not a hallucinated one.
2. **Get recommendations grounded in the database** — every product ID,
   price, and stock count shown to you is re-validated against Postgres
   server-side. The AI can suggest what to show; it can never make up a
   product or a price.
3. **See relevant add-ons** — the assistant may propose a complementary
   item (a mouse for a laptop, a case for a phone) only when that pairing
   is explicitly defined in the catalog, never invented.
4. **Add to cart, review, approve** — nothing is charged until you see an
   itemized order and explicitly approve it. A deterministic guardrail
   engine (no AI involved) checks the order against policy limits and
   current stock before you ever see an approve button.
5. **Pay via Razorpay (test mode)** — approving creates a real Razorpay
   test order; payment is confirmed only after the signature is verified
   server-side, never trusted from the browser alone. Once verified, the
   cart is cleared automatically — it won't show the same items again on
   your next visit.

## Screens

Every page shares one persistent navigation bar (`Sellsy` wordmark · Shop
· Cart · Dashboard · Recovery · Audit trail), so there's always a way to
get anywhere in the app — you never need to type a URL by hand.

| Route | What's there |
|---|---|
| `/` | Storefront entry — example prompts, a "Start shopping" button |
| `/chat` | The conversational shopping assistant |
| `/cart` | Itemized order, guardrail-checked payment proposal, Razorpay checkout |
| `/order/[id]` | Order confirmation — itemized receipt + payment status |
| `/dashboard` | Merchant analytics — conversations, recommendations, upsells, revenue, conversion rate |
| `/recovery` | Revenue-recovery console — at-risk/recovered totals, scan + run-batch controls, per-case timelines, promise-to-pay, stop |
| `/audit` | Full chronological event trail for any session |


**Why it's built this way:** the AI agent is advisory only. It can
recommend and explain, but every product ID and price it mentions is
re-validated against the database before being shown to you, and it never
touches carts, payments, or money directly. A separate, deterministic
guardrail engine — plain Python, no LLM — is what actually decides whether
an order is allowed to proceed to payment. See `CLAUDE.md` for the full
list of architectural rules this project depends on.

## Revenue recovery

Two things quietly leak revenue in any self-serve checkout: a payment
that fails and is never retried, and a checkout that's abandoned before
approval. Sellsy AI's recovery engine turns both into tracked, bounded
recovery cases instead of silent losses.

1. **Detect** — `RecoveryService.scan()` looks for failed `Payment` rows
   and `PaymentProposal`s left in `proposed` status past a staleness
   window (30 minutes by default) and opens a `RecoveryCase` for each one
   that isn't already being worked. A plain database scan — no LLM
   involved in deciding what counts as at risk.
2. **Diagnose** — every case gets a root cause. Where it's already known
   from the data (an abandoned checkout has no failure to explain; this
   app's own signature-verification failure is always worded the same
   way), it's set deterministically. Only a messy gateway decline string
   goes to the LLM to classify, into a fixed set of categories
   (`card_declined`, `insufficient_funds`, `gateway_error`,
   `signature_mismatch`, `checkout_abandoned`, `unknown`) — and a known
   cause always overrides whatever the model guesses.
3. **Intervene** — the same LLM call drafts a short nudge message,
   grounded only in the case's real amount and item names (never an
   invented price or discount), in a **Standard** or **Hinglish** tone
   chosen per batch run. If the LLM call itself fails, a templated
   fallback message is used instead of failing the whole batch — a
   diagnosis, never a charge, depends on the model being available.
4. **Escalate, or stop** — `app/policies/recovery_policy.py` is the
   deterministic sibling of the payment guardrail engine: no LLM. It
   enforces a fixed escalation ladder (nudge → nudge → final notice, with
   a 24-hour cooldown between attempts) and stops a case outright if the
   customer opts out, the amount exceeds the same transaction ceiling the
   payment guardrails enforce, or the attempt limit is reached.
5. **Promise-to-pay** — a nudge can be answered with "remind me in N
   days" (`POST /api/recovery/{id}/promise`), which sets
   `RecoveryCase.promised_retry_at`. The escalation ladder checks this
   before sending the next nudge, so a stated promise is actually
   honored, not just logged.
6. **Close the loop** — `PaymentService.verify_payment`, the same method
   that clears the cart on a real success, also checks for an open
   recovery case on that session and marks it `recovered` with the real
   amount paid. Recovery never bypasses the guardrail → proposal →
   approval → verify chain — it only ever points a customer back to a
   normal checkout.

**Try it:**

```bash
# after the product catalog is seeded
python -m app.seed.seed_recovery_scenarios   # creates demo failed/abandoned cases
```

Then open **Recovery** in the nav bar (or call `POST /api/recovery/scan`
and `POST /api/recovery/run-batch` directly) to detect the cases and send
the first round of nudges, and watch the at-risk/recovered totals and
per-case timelines update.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | FastAPI, service-oriented architecture |
| Database | PostgreSQL + SQLAlchemy + Alembic migrations |
| AI | Groq API (`openai/gpt-oss-120b`, JSON-mode structured output) |
| Payments | Razorpay, test mode |

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **PostgreSQL** 14+ (local install, or a free hosted instance like
  [Neon](https://neon.tech) or [Supabase](https://supabase.com))
- A free **Groq API key** — [console.groq.com/keys](https://console.groq.com/keys)
- Free **Razorpay test-mode keys** — [dashboard.razorpay.com](https://dashboard.razorpay.com)
  (Test Mode toggle, top-right → Settings → API Keys)

---

## 1. Start PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
psql postgres -c "CREATE USER sellsy WITH PASSWORD 'sellsy_dev_pw';"
psql postgres -c "CREATE DATABASE sellsy_db OWNER sellsy;"
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER sellsy WITH PASSWORD 'sellsy_dev_pw';"
sudo -u postgres psql -c "CREATE DATABASE sellsy_db OWNER sellsy;"
```

**Or use a free hosted Postgres** (Neon/Supabase) and skip straight to
using its connection string as `DATABASE_URL` below.

---

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       
pip install -r requirements.txt
```

> **Always run `python -m alembic ...` and `python -m uvicorn ...`**
> rather than bare `alembic`/`uvicorn`. On some systems the bare command
> resolves to a different, global Python install even inside an activated
> virtualenv, which leads to confusing "module not found" errors. Using
> `python -m` guarantees it runs in the interpreter you just activated.

### Environment variables

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://sellsy:sellsy_dev_pw@localhost:5432/sellsy_db
FRONTEND_ORIGINS=http://localhost:3000

AI_PROVIDER=groq
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=openai/gpt-oss-120b

RAZORPAY_KEY_ID=rzp_test_your_real_key_here
RAZORPAY_KEY_SECRET=your_real_secret_here

MAX_TRANSACTION_AMOUNT_INR=200000
```

**Never commit your real `.env`** — it's gitignored. Only `.env.example`
(with placeholders) is tracked.

### Run migrations

```bash
python -m alembic upgrade head
```

Creates all tables: `products`, `carts`, `cart_items`,
`conversation_messages`, `payment_proposals`, `payments`,
`recovery_cases`, `recovery_actions`.

### Seed the product catalog

```bash
python -m app.seed.seed_catalog --reset
```

Loads 41 synthetic products across 7 categories (laptops, smartphones,
headphones, keyboards, mice, monitors, accessories), cross-linked with
real upsell/cross-sell/compatible-product relationships. Safe to re-run —
it skips seeding if products already exist, unless you pass `--reset`.

To also seed demo failed-payment/abandoned-checkout data for the
revenue-recovery flow, see **Try it** under [Revenue recovery](#revenue-recovery) below.

### Start the backend

```bash
python -m uvicorn app.main:app --reload
```

Runs at **http://localhost:8000**. Interactive API docs at
**http://localhost:8000/docs**.

### Verify it works

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"sellsy-backend","database":"ok"}

curl http://localhost:8000/api/products | python3 -m json.tool
```

---

## 3. Frontend setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

`frontend/.env.local` needs one variable (safe to expose to the browser —
it's a URL, not a secret):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev
```

Runs at **http://localhost:3000**.

---

## Trying the full flow

1. Open `/` — click one of the example prompts, or the **Shop** link in
   the nav bar
2. Ask for something — e.g. *"I need a laptop for college under ₹50,000"*
3. Click **Add to cart** on a recommendation (and on the suggested add-on,
   if one appears) — the **Cart** link in the nav bar updates live with
   the item count
4. Click **Cart** in the nav, then **Review & pay**
5. Read the order summary, click **Approve payment**
6. Click **Pay ₹X** — Razorpay's test checkout opens

   **Netbanking:** pick any bank, click **Success** on the mock page.
   (UPI test-mode simulation isn't available in Razorpay Checkout
   currently — Netbanking is the most reliable test path.)
7. You're redirected to `/order/[id]` showing the confirmed, stamped
   receipt. Your cart is now empty — go back to **Cart** to confirm.
8. Check **Dashboard** to see the conversation/upsell/payment counters
   update, and **Audit trail** to see the exact event-by-event history of
   everything that just happened, in order.

---

## How the safety model works

**The AI never touches money or the database directly.** Every chat
response is parsed as structured JSON and validated: any product ID the
model mentions that doesn't exist in the catalog is silently dropped and
logged, never shown to you. Prices and names always come from a fresh
database read, never from the model's own text.

**A separate, deterministic guardrail engine decides whether a payment can
proceed** (`backend/app/policies/guardrail_engine.py`) — plain Python, no
LLM involved:
- The cart isn't empty
- The total is within `MAX_TRANSACTION_AMOUNT_INR`
- Every item's quantity still fits current stock (re-checked at proposal
  time, since a cart can sit around while stock changes)

**Payments require explicit approval and are verified twice:** once when
Razorpay creates the order (server-side, using a total computed by
`CartService` from the database — never a number the client sent), and
again after checkout completes, when the payment's cryptographic signature
is independently verified server-side before anything is marked as paid.

**A successful payment clears the cart.** Once a payment is verified, its
items are removed so they don't linger and reappear on your next visit.
The order itself isn't lost — `PaymentProposal.cart_snapshot` freezes
exactly what was ordered, independent of the live cart, which is what
`/order/[id]` and the audit trail read from.

**Failures are explicit, not silent.** If Razorpay order creation fails,
that's recorded with a clear reason, nothing is retried automatically, and
no duplicate order is created from the same proposal.

**Recovery decisions split the same way money-and-database access does.**
Detecting at-risk revenue, deciding when to escalate, and deciding when
to stop are all plain Python in `recovery_policy.py` — the same
deterministic pattern as the payment guardrails, and for the same reason:
those are decisions an auditor needs to be able to read without wondering
what the model would have done differently. The LLM's only role is
classifying an already-unclear failure reason and drafting nudge copy —
both re-validated (a fixed cause enum, a length cap, no invented prices)
before anything is stored or shown.

**Nothing is a dead end.** Every page shares one persistent navigation bar
— there's always a visible way to get to the shop, your cart, the merchant
dashboard, the revenue-recovery console, or the audit trail, without
needing to know or type a URL.

---

## Database migrations (Alembic)

```bash
cd backend
# after changing/adding a model in app/models/:
python -m alembic revision --autogenerate -m "describe your change"
# review the generated file in alembic/versions/, then:
python -m alembic upgrade head
```

Roll back the last migration: `python -m alembic downgrade -1`

---

## Environment variables reference

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FRONTEND_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `GROQ_API_KEY` | Yes (for chat) | Groq API key |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-120b` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes (for payment) | Razorpay test-mode credentials |
| `MAX_TRANSACTION_AMOUNT_INR` | No | Guardrail ceiling, defaults to 200000 |
| `RECOVERY_MAX_ATTEMPTS` | No | Max recovery nudges per case before it expires, defaults to 3 |
| `RECOVERY_COOLDOWN_HOURS` | No | Minimum hours between recovery attempts, defaults to 24 |
| `RECOVERY_STALE_PROPOSAL_MINUTES` | No | How long a proposal sits unapproved before it counts as an abandoned checkout, defaults to 30 |
| `ENVIRONMENT`, `LOG_LEVEL` | No | `development`/`production`, Python log level |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the FastAPI backend |

No secrets are hardcoded anywhere in this repo. `.env` and `.env.local`
are gitignored; only `.env.example` / `.env.local.example` templates are
committed.

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'psycopg2'` despite it being
installed** — you're likely running the global `alembic`/`uvicorn`
instead of your venv's copy. Use `python -m alembic ...` / `python -m
uvicorn ...` instead of the bare commands.

**Groq returns `model_not_found`** — Groq periodically deprecates models.
Check [console.groq.com/docs/models](https://console.groq.com/docs/models)
for the current list and update `GROQ_MODEL` in `.env`.

**Razorpay Checkout says "International cards are not supported"** — use
the documented domestic test card (`4111 1111 1111 1111`), or switch to
**Netbanking** in the checkout modal and click "Success" on the mock bank
page — this sidesteps card-network classification entirely and is the
most reliable way to test the full flow.

**Alembic: `KeyError` on a revision hash / broken migration chain** — make
sure every file in `backend/alembic/versions/` is present; a missing
earlier migration breaks the whole chain even if your database already
has those tables.

---

## Roadmap (not yet built)

- Razorpay webhook handler as a production-grade alternative to the
  current client-checkout + server-verify flow (needs a public URL, so it
  doesn't fit local development)
- Per-session spend caps in the guardrail engine
- Streaming chat responses
- Recovery nudges are drafted and tracked but not actually delivered over
  a real channel yet (email/SMS/WhatsApp) — logging and dashboard
  visibility only, in this phase
- `run-batch` is triggered manually from the dashboard; a production
  deployment would run detection and escalation on a schedule instead
