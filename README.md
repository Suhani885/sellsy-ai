# Sellsy AI

An AI shopping assistant for an electronics merchant, extended with a
revenue-recovery engine. Ask for what you need in plain language, get
real in-stock recommendations, and approve a Razorpay (test mode)
payment yourself — nothing is charged automatically. When a payment
fails, a checkout is abandoned, a B2B invoice goes overdue, or a
subscription's auto-renewal lapses, a separate, bounded recovery
pipeline detects it, diagnoses why, and sends a tracked follow-up to
win the revenue back.


**Live demo:** [sellsy-ai.vercel.app](https://sellsy-ai.vercel.app)

## What it does

1. **Ask, or just browse** — "a laptop for college under ₹50,000" in
   `/chat`, or search and filter the same catalog directly on `/catalog`
   if you'd rather not describe what you want. The assistant remembers
   the conversation and explains why it picked each option, not just
   what it picked.
2. **Get grounded recommendations** — every product, price, and stock
   count is re-validated against Postgres. The AI can suggest; it can't
   invent a product or a price.
3. **Add to cart, review, approve** — a deterministic guardrail engine
   (no AI) checks stock and spending limits before you ever see an
   approve button.
4. **Pay via Razorpay (test mode)** — the signature is verified
   server-side before anything is marked paid, and the cart clears
   automatically on success.


## Revenue recovery

Four leak points, one pipeline: a failed payment, an abandoned checkout,
an overdue B2B invoice, and a lapsed subscription renewal all become a
tracked `RecoveryCase`, not a silent loss.

1. **Detect** — a plain DB scan (no LLM) for failed payments, stale
   proposals, overdue invoices, and Care Plans (device protection
   subscriptions) past their renewal date.
2. **Diagnose** — root cause is set deterministically wherever it's
   already knowable (abandoned = no failure; overdue/lapsed = overdue by
   definition); only a messy gateway error string goes to the LLM, and
   only to classify into a fixed enum.
3. **Intervene** — the LLM drafts one message, grounded only in real
   facts, in **Standard**, **Hinglish**, or **Hinglish voice** (a spoken
   script, playable in-browser via the Web Speech API — no real call is
   placed). A consumer nudge, a B2B chaser, and a subscription-renewal
   message are each framed differently at the same tone.
4. **Escalate or stop** — `recovery_policy.py`, deterministic, no LLM.
   Consumer/B2B cases follow a fixed ladder with cooldowns and a
   source-aware amount ceiling. Subscriptions instead run a **mandate
   retry sequencer** — a front-loaded day-0/day-2/day-5 smart-retry
   schedule — and exhausting it doesn't just close the case, it cancels
   the actual Care Plan (`CarePlanRepository.cancel`).
5. **Promise-to-pay** — "remind me in N days" pauses the ladder, and
   the **Promise tracker** measures what actually happened:
   pending / overdue / kept / kept late / broken.
6. **Close the loop** — a real payment success, a marked-paid invoice,
   or a renewed Care Plan flips the case to `recovered` with the real
   amount — never bypassing the guardrail → approve → verify chain.

Every **Run recovery batch** click surfaces a **batch run report**:
cases nudged vs. escalated vs. stopped/expired, the ₹ amount actioned
this run (broken down by revenue motion), and a per-case list — not
just a silent database update, but the measured, audit-ready result of
one batch.

**Try it** (after the catalog is seeded):
```bash
python -m app.seed.seed_recovery_scenarios   # demo failed/abandoned cases
python -m app.seed.seed_receivables          # demo B2B invoices, some overdue
python -m app.seed.seed_care_plans           # demo Care Plans, some lapsed
```
Then open **Recovery** in the nav and scan / run a batch.

## Stack

Next.js (App Router) + Tailwind v4 + shadcn/ui + lucide-react · FastAPI
(service-oriented) · PostgreSQL + SQLAlchemy + Alembic · Groq (JSON-mode)
· Razorpay (test mode)

---

## Setup

**Prerequisites**: Node 18+, Python 3.11+, PostgreSQL 14+ (or free
[Neon](https://neon.tech)/[Supabase](https://supabase.com)), a free
[Groq key](https://console.groq.com/keys), Razorpay test-mode keys
([dashboard](https://dashboard.razorpay.com), Test Mode → API Keys).

### 1. Database
```bash
brew install postgresql@16 && brew services start postgresql@16   # macOS
psql postgres -c "CREATE USER sellsy WITH PASSWORD 'sellsy_dev_pw';"
psql postgres -c "CREATE DATABASE sellsy_db OWNER sellsy;"
```
Or skip this and use a hosted Postgres connection string directly.

### 2. Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, GROQ_API_KEY, RAZORPAY_KEY_ID/SECRET
python -m alembic upgrade head
python -m app.seed.seed_catalog --reset   # 41 products, 7 categories
python -m uvicorn app.main:app --reload   # http://localhost:8000
```
Always use `python -m alembic` / `python -m uvicorn`, not the bare
commands — some shells resolve those to a different Python install.

### 3. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev   # http://localhost:3000
```

**Verify**: `curl http://localhost:8000/health` should return
`{"status":"ok",...}`.

## Trying the full flow

Open `/chat` → ask for something → **Add to cart** → **Cart** →
**Review & pay** → **Approve payment** → **Pay** (Razorpay test
checkout: use **Netbanking**, click **Success** — UPI isn't simulatable
in test mode) → redirected to the receipt, cart now empty. Check
**Dashboard** and **Audit trail** to see it all recorded.

## How the safety model works

The AI never touches money or the database directly — every fact it
states is re-validated against Postgres before you see it, and a
separate deterministic guardrail engine (`guardrail_engine.py`, zero
LLM) decides whether a payment can proceed: cart not empty, under
`MAX_TRANSACTION_AMOUNT_INR`, stock re-checked at proposal time.
Payments are verified twice (order creation + signature check, both
server-side); failures are recorded with a reason, never silently
retried. The recovery engine follows the identical split — see
`CLAUDE.md` for the full architectural rules.

---

## Environment variables

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FRONTEND_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `GROQ_API_KEY` | Yes | Groq API key |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-120b` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Yes | Razorpay test-mode credentials |
| `MAX_TRANSACTION_AMOUNT_INR` | No | Guardrail ceiling, defaults to 200000 |
| `RECOVERY_MAX_ATTEMPTS` | No | Defaults to 3 |
| `RECOVERY_COOLDOWN_HOURS` | No | Defaults to 24 |
| `RECOVERY_STALE_PROPOSAL_MINUTES` | No | Defaults to 30 |
| `RECOVERY_RECEIVABLE_MAX_AMOUNT_INR` | No | B2B ceiling, defaults to 1000000 |
| `ENVIRONMENT`, `LOG_LEVEL` | No | `development`/`production`, log level |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the FastAPI backend |

`.env`/`.env.local` are gitignored; only the `.example` templates are committed.
