"""Watchlist endpoints: list, add, and remove tracked tickers."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.db import DEFAULT_USER_ID, _now, get_db
from app.state import market_source, price_cache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistAdd(BaseModel):
    ticker: str

    @field_validator("ticker")
    @classmethod
    def normalize(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("ticker must not be empty")
        return v


@router.get("")
async def get_watchlist() -> list[dict]:
    """Return watchlist tickers with their latest cached price snapshot."""
    async with get_db() as conn:
        async with conn.execute(
            "SELECT ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at",
            (DEFAULT_USER_ID,),
        ) as cur:
            rows = await cur.fetchall()

    result = []
    for row in rows:
        update = price_cache.get(row["ticker"])
        result.append(
            {
                "ticker": row["ticker"],
                "added_at": row["added_at"],
                "price": update.to_dict() if update else None,
            }
        )
    return result


@router.post("")
async def add_to_watchlist(payload: WatchlistAdd) -> dict:
    """Add a ticker to the watchlist and start tracking it in the market source."""
    ticker = payload.ticker
    async with get_db() as conn:
        async with conn.execute(
            "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        ) as cur:
            if await cur.fetchone():
                raise HTTPException(status_code=409, detail=f"{ticker} already in watchlist")

        await conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, _now()),
        )
        await conn.commit()

    await market_source.add_ticker(ticker)
    return {"ticker": ticker, "status": "added"}


@router.delete("/{ticker}")
async def remove_from_watchlist(ticker: str) -> dict:
    """Remove a ticker from the watchlist and stop tracking it."""
    ticker = ticker.strip().upper()
    async with get_db() as conn:
        cur = await conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        )
        await conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"{ticker} not in watchlist")

    await market_source.remove_ticker(ticker)
    return {"ticker": ticker, "status": "removed"}
