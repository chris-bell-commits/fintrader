"""LLM chat service: portfolio-aware assistant that can execute trades.

Loads portfolio context and recent history, calls the Cerebras-hosted model via
LiteLLM with structured output, then auto-executes any trades or watchlist
changes the model returns. The user message and assistant response (with the
actions taken) are persisted to the chat_messages table.
"""

from __future__ import annotations

import json
import os
import uuid

import aiosqlite
from litellm import completion
from pydantic import BaseModel

from app.db import DEFAULT_USER_ID, _now, get_db
from app.portfolio import TradeError, build_portfolio, execute_trade
from app.state import market_source, price_cache

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
HISTORY_LIMIT = 20

SYSTEM_PROMPT = (
    "You are FinTrader, an AI trading assistant. Analyze portfolios, suggest and "
    "execute trades, manage watchlists. Be concise and data-driven. Always respond "
    "with valid JSON."
)


class Trade(BaseModel):
    ticker: str
    side: str
    quantity: float


class WatchlistChange(BaseModel):
    ticker: str
    action: str


class ChatResponse(BaseModel):
    message: str
    trades: list[Trade] = []
    watchlist_changes: list[WatchlistChange] = []


async def chat(user_message: str, db_conn: aiosqlite.Connection) -> dict:
    """Handle one chat turn: call the LLM, execute actions, persist, return result.

    Returns a dict with the assistant message plus the executed actions and any
    errors encountered while applying them.
    """
    portfolio = await build_portfolio(db_conn)
    history = await _load_history(db_conn)
    messages = _build_messages(portfolio, history, user_message)

    parsed = _call_llm(messages)

    executed_trades, trade_errors = await _apply_trades(parsed.trades)
    watchlist_results = await _apply_watchlist_changes(parsed.watchlist_changes)

    actions = {
        "trades": executed_trades,
        "trade_errors": trade_errors,
        "watchlist_changes": watchlist_results,
    }

    await _store_message(db_conn, "user", user_message, None)
    await _store_message(db_conn, "assistant", parsed.message, actions)
    await db_conn.commit()

    return {"message": parsed.message, **actions}


def _call_llm(messages: list[dict]) -> ChatResponse:
    """Call the model (or return a mock) and parse the structured response."""
    if os.getenv("LLM_MOCK") == "true":
        return ChatResponse(message="Mock response", trades=[], watchlist_changes=[])

    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatResponse,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return ChatResponse.model_validate_json(response.choices[0].message.content)


def _build_messages(portfolio: dict, history: list[dict], user_message: str) -> list[dict]:
    """Assemble the message list: system prompt, context, history, new message."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"Current portfolio context:\n{json.dumps(portfolio)}"},
    ]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})
    return messages


async def _load_history(conn: aiosqlite.Connection) -> list[dict]:
    """Load the last HISTORY_LIMIT chat messages in chronological order."""
    async with conn.execute(
        "SELECT role, content FROM chat_messages WHERE user_id = ? "
        "ORDER BY created_at DESC LIMIT ?",
        (DEFAULT_USER_ID, HISTORY_LIMIT),
    ) as cur:
        rows = await cur.fetchall()
    return [{"role": row["role"], "content": row["content"]} for row in reversed(rows)]


async def _apply_trades(trades: list[Trade]) -> tuple[list[dict], list[str]]:
    """Execute each requested trade, collecting fills and validation errors."""
    executed: list[dict] = []
    errors: list[str] = []
    for trade in trades:
        try:
            fill = await execute_trade(trade.ticker, trade.quantity, trade.side)
            executed.append(fill)
        except TradeError as exc:
            errors.append(str(exc))
    return executed, errors


async def _apply_watchlist_changes(changes: list[WatchlistChange]) -> list[dict]:
    """Apply watchlist add/remove actions, recording the outcome of each."""
    results: list[dict] = []
    for change in changes:
        ticker = change.ticker.strip().upper()
        action = change.action.strip().lower()
        if action == "add":
            results.append(await _add_ticker(ticker))
        elif action == "remove":
            results.append(await _remove_ticker(ticker))
        else:
            results.append({"ticker": ticker, "action": action, "status": "invalid action"})
    return results


async def _add_ticker(ticker: str) -> dict:
    """Insert a watchlist row if absent and start tracking the ticker."""
    async with get_db() as conn:
        async with conn.execute(
            "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        ) as cur:
            if await cur.fetchone():
                return {"ticker": ticker, "action": "add", "status": "already present"}
        await conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), DEFAULT_USER_ID, ticker, _now()),
        )
        await conn.commit()
    await market_source.add_ticker(ticker)
    return {"ticker": ticker, "action": "add", "status": "added"}


async def _remove_ticker(ticker: str) -> dict:
    """Delete a watchlist row if present and stop tracking the ticker."""
    async with get_db() as conn:
        cur = await conn.execute(
            "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?",
            (DEFAULT_USER_ID, ticker),
        )
        await conn.commit()
        if cur.rowcount == 0:
            return {"ticker": ticker, "action": "remove", "status": "not present"}
    await market_source.remove_ticker(ticker)
    price_cache.remove(ticker)
    return {"ticker": ticker, "action": "remove", "status": "removed"}


async def _store_message(
    conn: aiosqlite.Connection, role: str, content: str, actions: dict | None
) -> None:
    """Append a chat message row. Caller commits."""
    await conn.execute(
        "INSERT INTO chat_messages (id, user_id, role, content, actions, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            str(uuid.uuid4()),
            DEFAULT_USER_ID,
            role,
            content,
            json.dumps(actions) if actions is not None else None,
            _now(),
        ),
    )
