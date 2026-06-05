"""Portfolio endpoints: state, trade execution, and value history."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.db import DEFAULT_USER_ID, get_db
from app.portfolio import TradeError, build_portfolio, execute_trade

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    quantity: float
    side: str

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("ticker must not be empty")
        return v

    @field_validator("side")
    @classmethod
    def normalize_side(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("buy", "sell"):
            raise ValueError("side must be 'buy' or 'sell'")
        return v


@router.get("")
async def get_portfolio() -> dict:
    """Return positions valued at live prices, cash, and totals."""
    async with get_db() as conn:
        return await build_portfolio(conn)


@router.post("/trade")
async def post_trade(req: TradeRequest) -> dict:
    """Execute a market order. Returns the filled trade and the updated portfolio."""
    try:
        trade = await execute_trade(req.ticker, req.quantity, req.side)
    except TradeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async with get_db() as conn:
        portfolio = await build_portfolio(conn)
    return {"trade": trade, "portfolio": portfolio}


@router.get("/history")
async def get_history() -> list[dict]:
    """Return portfolio value snapshots over time for the P&L chart."""
    async with get_db() as conn:
        async with conn.execute(
            "SELECT total_value, recorded_at FROM portfolio_snapshots "
            "WHERE user_id = ? ORDER BY recorded_at",
            (DEFAULT_USER_ID,),
        ) as cur:
            rows = await cur.fetchall()
    return [
        {"total_value": row["total_value"], "recorded_at": row["recorded_at"]}
        for row in rows
    ]
