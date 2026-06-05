"""FastAPI application entry point for FinTrader.

Wires together the database, the market data background task, the SSE stream,
the REST routes, and serves the static frontend export. A background task
records portfolio value snapshots every 30 seconds for the P&L chart.
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import DEFAULT_USER_ID, get_db, init_db
from app.market import create_stream_router
from app.portfolio import record_snapshot
from app.routes import chat, health, portfolio, watchlist
from app.state import market_source, price_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SNAPSHOT_INTERVAL = 30.0
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"


async def _load_watchlist_tickers() -> list[str]:
    """Read the current watchlist tickers from the database."""
    async with get_db() as conn:
        async with conn.execute(
            "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (DEFAULT_USER_ID,),
        ) as cur:
            rows = await cur.fetchall()
    return [row["ticker"] for row in rows]


async def _snapshot_loop() -> None:
    """Record a portfolio value snapshot every SNAPSHOT_INTERVAL seconds."""
    while True:
        await asyncio.sleep(SNAPSHOT_INTERVAL)
        try:
            async with get_db() as conn:
                await record_snapshot(conn)
                await conn.commit()
        except Exception:
            logger.exception("Snapshot task failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the DB, start the market source and snapshot task on startup."""
    await init_db()
    tickers = await _load_watchlist_tickers()
    await market_source.start(tickers)
    snapshot_task = asyncio.create_task(_snapshot_loop(), name="snapshot-loop")
    logger.info("FinTrader started with %d watchlist tickers", len(tickers))
    try:
        yield
    finally:
        snapshot_task.cancel()
        try:
            await snapshot_task
        except asyncio.CancelledError:
            pass
        await market_source.stop()


app = FastAPI(title="FinTrader", lifespan=lifespan)

app.include_router(health.router)
app.include_router(watchlist.router)
app.include_router(portfolio.router)
app.include_router(chat.router)
app.include_router(create_stream_router(price_cache))

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
