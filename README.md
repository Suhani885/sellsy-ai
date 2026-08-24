# Sellsy AI

AI-powered merchant commerce agent — conversational shopping, recommendations,
upsell/cross-sell, and Razorpay test-mode checkout, with a deterministic
guardrail layer gating every money action behind explicit user approval.

Built for Razorpay Track 01: AI Growth & Agentic Commerce.

**This phase is the project foundation only** — clean architecture, database,
and basic catalog/cart endpoints. No AI agent and no Razorpay integration yet;
those come in later phases.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS v4 + shadcn/ui |
| Backend | FastAPI (service-oriented architecture) |
| Database | PostgreSQL + SQLAlchemy + Alembic migrations |
| AI (future phase) | Groq API |
| Payments (future phase) | Razorpay Test Mode |

## Project structure

```
sellsy/
├── frontend/                # Next.js app
│   ├── app/                 # Pages (App Router)
│   ├── components/ui/       # shadcn/ui components
│   └── lib/                 # API client, utils
│
├── backend/
│   └── app/
│       ├── api/             # Route handlers + shared deps (get_db)
│       │   └── routes/      # health.py, products.py, cart.py
│       ├── models/          # SQLAlchemy models (Product, Cart, CartItem)
│       ├── schemas/         # Pydantic request/response schemas
│       ├── services/        # Business logic (validates, orchestrates)
│       ├── repositories/    # Pure DB access, no business logic
│       ├── policies/        # (future) guardrail/policy engine
│       ├── agents/          # (future) AI agent orchestration
│       ├── config/          # Environment-driven settings
│       └── utils/           # Logging, exception handling
│   └── alembic/             # Database migrations
```

**Why service-oriented:** routers only handle HTTP concerns, services hold
business logic and raise typed exceptions, repositories only touch the
database. This keeps the AI agent (added later) firmly in an *advisory* role —
it will never directly touch payments or the database.

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **PostgreSQL** 14+ (installed locally, or a free hosted instance like
  [Neon](https://neon.tech) or [Supabase](https://supabase.com))

---

## 1. Start PostgreSQL

### Option A — Local Postgres (macOS/Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16

# Create the database and a dedicated user
psql postgres -c "CREATE USER sellsy WITH PASSWORD 'sellsy_dev_pw';"
psql postgres -c "CREATE DATABASE sellsy_db OWNER sellsy;"
```

---

## 2. Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

### Set environment variables

```bash
cp .env.example .env
```

Then edit `backend/.env`:

```env
DATABASE_URL=postgresql://sellsy:sellsy_dev_pw@localhost:5432/sellsy_db
FRONTEND_ORIGINS=http://localhost:3000
```

Leave the `GROQ_*` and `RAZORPAY_*` variables as placeholders for now — they
aren't used until later phases. **Never commit your real `.env` file** — it's
already in `.gitignore`.

### Run database migrations

```bash
alembic upgrade head
```

This creates the `products`, `carts`, and `cart_items` tables.

### (Optional) Seed a couple of test products

```bash
psql "$DATABASE_URL" -c "
INSERT INTO products (name, description, category, price, inventory, features, tags, compatible_products, upsell_products, cross_sell_products, created_at)
VALUES
('Acer Aspire 3 Laptop', 'Budget laptop for college students', 'laptops', 47999.00, 12, '[\"8GB RAM\",\"512GB SSD\"]', '[\"budget\",\"student\"]', '[]', '[2]', '[]', now()),
('Wireless Mouse', 'Ergonomic wireless mouse', 'accessories', 799.00, 100, '[\"2.4GHz\",\"Silent click\"]', '[\"budget\"]', '[]', '[]', '[]', now());
"
```

### Start the backend

```bash
uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**. Interactive API docs are
auto-generated at **http://localhost:8000/docs**.

### Verify it works

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"sellsy-backend","database":"ok"}

curl http://localhost:8000/api/products
```

---

## 3. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
```

### Set environment variables

```bash
cp .env.local.example .env.local
```

`frontend/.env.local` only needs one variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

This is safe to expose to the browser — it's a URL, not a secret. No API
keys or credentials ever live in the frontend.

### Start the frontend

```bash
npm run dev
```

Frontend runs at **http://localhost:3000**. Open it in a browser — you
should see a "Foundation Check" page showing:
- A "Connected" badge with the backend's health response
- The list of seeded products (if you ran the seed step above)

If the backend isn't running or reachable, the page will clearly show
"Unreachable" instead of silently failing.

---

## API endpoints (this phase)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + DB connectivity check |
| GET | `/api/products` | List products (supports `?category=`, `?search=`, `?limit=`, `?offset=`) |
| GET | `/api/products/{product_id}` | Get a single product |
| POST | `/api/cart` | Create a new cart (optional `session_id` in body) |
| GET | `/api/cart/{cart_id}` | Get a cart and its items |

All errors return a consistent JSON shape:
```json
{ "error": { "code": "NOT_FOUND", "message": "Product 999 was not found." } }
```

---

## Database migrations (Alembic)

To make a schema change:

1. Edit/add a model in `backend/app/models/`.
2. Import it in `backend/app/models/__init__.py` if it's a new file.
3. Generate a migration:
   ```bash
   cd backend
   alembic revision --autogenerate -m "describe your change"
   ```
4. Review the generated file in `backend/alembic/versions/`.
5. Apply it:
   ```bash
   alembic upgrade head
   ```

To roll back the last migration:
```bash
alembic downgrade -1
```

---

## Environment variables reference

### Backend (`backend/.env`)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FRONTEND_ORIGINS` | Yes | Comma-separated allowed CORS origins |
| `ENVIRONMENT` | No | `development` / `production` |
| `LOG_LEVEL` | No | Python logging level |
| `AI_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL` | No (yet) | Used in a later phase |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | No (yet) | Used in a later phase |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the FastAPI backend |

**No secrets are hardcoded anywhere in this repo.** `.env` and `.env.local`
are both gitignored — only `.env.example` / `.env.local.example` templates
are committed.

---

## Roadmap (next phases, not yet implemented)

- Conversational AI agent (Groq, structured JSON output)
- Cart item add/remove endpoints, upsell/cross-sell logic
- Guardrail/policy engine for payment proposals
- Razorpay test-mode order creation + checkout + webhook verification
- Audit trail logging across every agent/payment action
- Merchant analytics dashboard
