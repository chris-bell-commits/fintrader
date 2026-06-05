# FinTrader — Build Overview

## What Was Built

FinTrader is a full-stack AI-powered trading workstation delivered as a single Docker container. It streams live simulated market data, supports a virtual portfolio with buy/sell trading, and includes an LLM-powered chat assistant that can analyse positions and execute trades through natural language.

---

## How It Was Built

The project was completed in a single session using a six-agent team, each specialist working in parallel where dependencies allowed. A team lead (orchestrator) coordinated handoffs and resolved integration issues.

### Agent Team

| Agent | Responsibility |
|---|---|
| **Database Engineer** | SQLite schema, lazy initialisation, seed data |
| **Backend API Engineer** | FastAPI application, all REST routes, SSE wiring |
| **LLM Engineer** | AI chat integration via LiteLLM and OpenRouter |
| **Frontend Engineer** | Next.js trading terminal UI |
| **DevOps Engineer** | Dockerfile, docker-compose, launch scripts |
| **Integration Tester** | Playwright E2E test suite |

---

## Components

### Database (`backend/app/db.py`)
SQLite database with lazy initialisation — tables are created and seeded automatically on first run. Six tables cover user state, watchlist, positions, trades, portfolio snapshots, and chat history. Default seed: £10,000 cash and 20 watched tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX, and others).

### Market Data (`backend/app/market/`)
Pre-existing at project start. Provides a price simulator using geometric Brownian motion, an optional real-data client (Massive/Polygon.io API), a shared in-memory price cache, and an SSE streaming router. Selected at startup via the `MASSIVE_API_KEY` environment variable.

### Backend API (`backend/app/`)
FastAPI application serving all endpoints on port 8000:
- **SSE stream** — pushes live price updates for all watched tickers every 500ms
- **Watchlist** — add, remove, and list tickers; changes are reflected immediately in the price stream
- **Portfolio** — current positions valued at live prices, cash balance, unrealised P&L, and trade history
- **Trades** — market orders with instant fill, cash/shares validation, and average-cost tracking
- **Chat** — delegates to the LLM service and returns structured responses including auto-executed actions

A background task records portfolio value snapshots every 30 seconds for the P&L chart.

### LLM Integration (`backend/app/llm.py`)
Uses LiteLLM to call `openrouter/openai/gpt-oss-120b` via OpenRouter with Cerebras as the inference provider. Structured output (Pydantic schema) returns a message, optional trades, and optional watchlist changes. Trades and watchlist changes are auto-executed before the response is returned to the frontend. Conversation history (last 20 messages) is included for context, along with a live portfolio snapshot. A `LLM_MOCK=true` environment variable returns deterministic responses for testing.

The assistant is prompted to be friendly and professional: it greets users, acknowledges each request before acting, and summarises executed actions with specific figures.

### Frontend (`frontend/`)
Next.js 14 TypeScript application built as a static export and served directly by FastAPI. Key UI panels:
- **Watchlist** — 20 tickers grouped by sector (TECH, HEALTHCARE, FINANCE) with live prices, flash animations on price change, and sparkline mini-charts accumulated from the SSE stream since page load
- **Main Chart** — larger Lightweight Charts price chart for the selected ticker
- **Portfolio Heatmap** — treemap of positions sized by weight and coloured by P&L
- **P&L Chart** — line chart of total portfolio value over time from snapshot data
- **Positions Table** — ticker, quantity, average cost, current price, unrealised P&L
- **Trade Bar** — ticker and quantity inputs with buy/sell buttons
- **AI Chat Panel** — collapsible sidebar with message history and loading state
- **Header** — live total portfolio value, cash balance, and SSE connection status indicator

Dark theme by default (Bloomberg-inspired); light mode toggle persisted in localStorage.

### Docker & Scripts (`Dockerfile`, `scripts/`)
Multi-stage Dockerfile: Node 20 builds the frontend static export, Python 3.12 runs the backend and serves the built frontend from a `static/` directory. A named Docker volume persists the SQLite database across container restarts. Shell and PowerShell start/stop scripts wrap the Docker commands and are idempotent.

### E2E Tests (`test/`)
Playwright test suite covering eight scenarios: fresh start state, watchlist add/remove, buying shares, selling shares, portfolio heatmap rendering, P&L chart data, and AI chat (using mock mode). A separate `docker-compose.test.yml` spins up the app with `LLM_MOCK=true` for fast, deterministic test runs. All 8 tests pass.

---

## Test Coverage

| Layer | Tests | Result |
|---|---|---|
| Database | 3 pytest tests | Pass |
| Backend routes | 11 pytest tests (94 total) | Pass |
| LLM service | 7 pytest tests | Pass |
| E2E (Playwright) | 8 tests | Pass |

---

## Known Setup Requirement

The `.env` file at the project root must contain the `OPENROUTER_API_KEY` **without** surrounding quotes. Docker's `--env-file` passes values literally, so a quoted value (e.g. `KEY='sk-...'`) causes a 401 authentication error at runtime. The correct format is:

```
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## Post-Build Changes

### AI Chat Assistant — Improved System Prompt (`backend/app/llm.py`)
The LLM system prompt was updated to make the assistant friendlier and more informative. It now:
- Greets users and asks how it can help when first interacting
- Acknowledges each request before acting (e.g. "Sure, I can help you buy some Apple shares")
- Summarises completed actions with specific figures (e.g. price paid, remaining cash balance)
- Offers follow-up suggestions where appropriate

### Massive API Fix (`backend/app/market/massive_client.py`)
The original `MassiveDataSource` used the `get_snapshot_all` endpoint which returns 403 on the free Massive API tier, causing prices to never appear when `MASSIVE_API_KEY` was set. Rewritten to:
- Fetch real previous-close prices via `get_previous_close_agg` (available on all tiers) for each ticker at startup
- Update the GBM simulator's seed prices with those real values
- Delegate all live streaming to the simulator, which ticks every 500ms from the real base prices
- Space API calls 1 second apart to stay within the free-tier rate limit (5 req/min); tickers that fail fall back to hardcoded defaults

All 20 tickers stream live prices regardless of how many real close prices were successfully fetched.

### Fly.io Deployment Fixes
Two issues prevented successful deployment to Fly.io:

1. **Missing `frontend/src/lib/` files** — the root `.gitignore` contained a blanket `lib/` rule (standard Python template) that unintentionally excluded `frontend/src/lib/` from git. Fixed by adding `!frontend/src/lib/` as a negation rule. The six missing files (`api.ts`, `format.ts`, `sectors.ts`, `types.ts`, `usePriceStream.ts`, `useTheme.ts`) are now tracked.

2. **Port mismatch in `fly.toml`** — `internal_port` was set to `8080` but the app listens on port `8000`. Fixed and `fly.toml` added to the repository.
