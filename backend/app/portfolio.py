"""Portfolio valuation and trade execution logic.

Shared by the portfolio routes and the snapshot background task. All prices
come from the live PriceCache; positions, cash, and trades live in SQLite.
"""

from __future__ import annotations

import uuid

import aiosqlite

from app.db import DEFAULT_USER_ID, _now, get_db
from app.state import price_cache


async def get_cash_balance(conn: aiosqlite.Connection) -> float:
    """Return the user's current cash balance."""
    async with conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
    ) as cur:
        row = await cur.fetchone()
    return row["cash_balance"] if row else 0.0


async def _fetch_positions(conn: aiosqlite.Connection) -> list[aiosqlite.Row]:
    async with conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ? AND quantity > 0",
        (DEFAULT_USER_ID,),
    ) as cur:
        return await cur.fetchall()


def _value_position(row: aiosqlite.Row) -> dict:
    """Build a position dict valued at the latest cached price."""
    ticker = row["ticker"]
    quantity = row["quantity"]
    avg_cost = row["avg_cost"]
    current_price = price_cache.get_price(ticker) or avg_cost
    market_value = quantity * current_price
    cost_basis = quantity * avg_cost
    unrealized_pnl = market_value - cost_basis
    pct_change = (unrealized_pnl / cost_basis * 100) if cost_basis else 0.0
    return {
        "ticker": ticker,
        "quantity": quantity,
        "avg_cost": round(avg_cost, 4),
        "current_price": round(current_price, 2),
        "market_value": round(market_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "pnl_percent": round(pct_change, 2),
    }


async def build_portfolio(conn: aiosqlite.Connection) -> dict:
    """Assemble the full portfolio snapshot: cash, positions, totals."""
    cash = await get_cash_balance(conn)
    rows = await _fetch_positions(conn)
    positions = [_value_position(row) for row in rows]
    positions_value = sum(p["market_value"] for p in positions)
    total_value = cash + positions_value
    total_pnl = sum(p["unrealized_pnl"] for p in positions)
    return {
        "cash_balance": round(cash, 2),
        "positions": positions,
        "positions_value": round(positions_value, 2),
        "total_value": round(total_value, 2),
        "unrealized_pnl": round(total_pnl, 2),
    }


async def total_portfolio_value(conn: aiosqlite.Connection) -> float:
    """Compute total portfolio value (cash + positions at market)."""
    portfolio = await build_portfolio(conn)
    return portfolio["total_value"]


async def record_snapshot(conn: aiosqlite.Connection) -> None:
    """Insert a portfolio value snapshot row. Caller commits."""
    value = await total_portfolio_value(conn)
    await conn.execute(
        "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
        "VALUES (?, ?, ?, ?)",
        (str(uuid.uuid4()), DEFAULT_USER_ID, value, _now()),
    )


class TradeError(Exception):
    """Raised when a trade fails validation (insufficient cash or shares)."""


async def execute_trade(ticker: str, quantity: float, side: str) -> dict:
    """Execute a market order at the current cached price.

    Validates funds (buy) or holdings (sell), updates positions and cash,
    appends to the trades log, and records a portfolio snapshot. Returns the
    executed trade details. Raises TradeError on validation failure.
    """
    ticker = ticker.strip().upper()
    side = side.strip().lower()
    if side not in ("buy", "sell"):
        raise TradeError(f"invalid side: {side}")
    if quantity <= 0:
        raise TradeError("quantity must be positive")

    price = price_cache.get_price(ticker)
    if price is None:
        raise TradeError(f"no market price available for {ticker}")

    async with get_db() as conn:
        cash = await get_cash_balance(conn)
        async with conn.execute(
            "SELECT quantity, avg_cost FROM positions WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        ) as cur:
            pos = await cur.fetchone()
        held_qty = pos["quantity"] if pos else 0.0
        held_cost = pos["avg_cost"] if pos else 0.0

        cost = quantity * price

        if side == "buy":
            if cost > cash:
                raise TradeError(
                    f"insufficient cash: need {cost:.2f}, have {cash:.2f}"
                )
            new_cash = cash - cost
            new_qty = held_qty + quantity
            new_avg_cost = (held_qty * held_cost + cost) / new_qty
        else:  # sell
            if quantity > held_qty:
                raise TradeError(
                    f"insufficient shares: trying to sell {quantity}, hold {held_qty}"
                )
            new_cash = cash + cost
            new_qty = held_qty - quantity
            new_avg_cost = held_cost  # avg cost unchanged on sell

        await conn.execute(
            "UPDATE users_profile SET cash_balance = ? WHERE id = ?",
            (new_cash, DEFAULT_USER_ID),
        )
        await _upsert_position(conn, ticker, new_qty, new_avg_cost, existed=pos is not None)

        await conn.execute(
            "INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, side, quantity, price, _now()),
        )
        await record_snapshot(conn)
        await conn.commit()

    return {
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": round(price, 2),
        "total": round(quantity * price, 2),
    }


async def _upsert_position(
    conn: aiosqlite.Connection,
    ticker: str,
    quantity: float,
    avg_cost: float,
    existed: bool,
) -> None:
    """Insert, update, or delete a position row depending on resulting quantity."""
    if quantity <= 0:
        await conn.execute(
            "DELETE FROM positions WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        )
        return

    if existed:
        await conn.execute(
            "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? "
            "WHERE user_id = ? AND ticker = ?",
            (quantity, avg_cost, _now(), DEFAULT_USER_ID, ticker),
        )
    else:
        await conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, quantity, avg_cost, _now()),
        )
