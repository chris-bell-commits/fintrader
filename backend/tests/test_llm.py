"""Tests for the LLM chat service: mock mode, response parsing, trade flow.

Uses a temporary seeded database (via DB_PATH) and the in-memory price cache.
The LLM call itself is either mocked via LLM_MOCK or monkeypatched so tests are
fast, deterministic, and make no network calls.
"""

from __future__ import annotations

import os
import tempfile

import pytest

from app.db import init_db
from app.state import price_cache


@pytest.fixture
async def conn():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DB_PATH"] = tmp.name
    os.environ.pop("MASSIVE_API_KEY", None)

    await init_db()

    from app.db import get_db

    async with get_db() as c:
        yield c

    os.unlink(tmp.name)
    os.environ.pop("DB_PATH", None)


def test_response_parsing():
    """Structured output JSON parses into the ChatResponse schema."""
    from app.llm import ChatResponse

    raw = (
        '{"message": "Buying Apple", '
        '"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 2}], '
        '"watchlist_changes": [{"ticker": "PYPL", "action": "add"}]}'
    )
    parsed = ChatResponse.model_validate_json(raw)
    assert parsed.message == "Buying Apple"
    assert parsed.trades[0].ticker == "AAPL"
    assert parsed.trades[0].quantity == 2
    assert parsed.watchlist_changes[0].action == "add"


def test_response_parsing_defaults():
    """Trades and watchlist_changes default to empty lists when omitted."""
    from app.llm import ChatResponse

    parsed = ChatResponse.model_validate_json('{"message": "Hello"}')
    assert parsed.trades == []
    assert parsed.watchlist_changes == []


async def test_mock_mode(conn, monkeypatch):
    """LLM_MOCK=true returns the deterministic mock response with no actions."""
    monkeypatch.setenv("LLM_MOCK", "true")
    from app.llm import chat

    result = await chat("What should I buy?", conn)
    assert result["message"] == "Mock response"
    assert result["trades"] == []
    assert result["watchlist_changes"] == []


async def test_mock_mode_persists_history(conn, monkeypatch):
    """A chat turn stores both the user and assistant messages."""
    monkeypatch.setenv("LLM_MOCK", "true")
    from app.llm import chat

    await chat("hello", conn)
    async with conn.execute(
        "SELECT role, content FROM chat_messages ORDER BY created_at"
    ) as cur:
        rows = await cur.fetchall()
    roles = [r["role"] for r in rows]
    assert roles == ["user", "assistant"]


async def test_chat_executes_valid_trade(conn, monkeypatch):
    """A trade returned by the LLM is auto-executed and reflected in the result."""
    from app import llm
    from app.llm import ChatResponse, Trade, chat

    price_cache.update("AAPL", 190.0)

    def fake_call(messages):
        return ChatResponse(
            message="Bought it",
            trades=[Trade(ticker="AAPL", side="buy", quantity=1)],
        )

    monkeypatch.setattr(llm, "_call_llm", fake_call)

    result = await chat("buy one apple", conn)
    assert len(result["trades"]) == 1
    assert result["trades"][0]["ticker"] == "AAPL"
    assert result["trade_errors"] == []


async def test_chat_reports_trade_validation_error(conn, monkeypatch):
    """A trade that fails validation surfaces an error, not an exception."""
    from app import llm
    from app.llm import ChatResponse, Trade, chat

    price_cache.update("AAPL", 190.0)

    def fake_call(messages):
        return ChatResponse(
            message="Trying to sell",
            trades=[Trade(ticker="AAPL", side="sell", quantity=999)],
        )

    monkeypatch.setattr(llm, "_call_llm", fake_call)

    result = await chat("sell apple", conn)
    assert result["trades"] == []
    assert len(result["trade_errors"]) == 1
    assert "insufficient shares" in result["trade_errors"][0]


async def test_chat_applies_watchlist_change(conn, monkeypatch):
    """A watchlist add returned by the LLM is applied to the database."""
    from app import llm
    from app.llm import ChatResponse, WatchlistChange, chat

    def fake_call(messages):
        return ChatResponse(
            message="Added PYPL",
            watchlist_changes=[WatchlistChange(ticker="pypl", action="add")],
        )

    monkeypatch.setattr(llm, "_call_llm", fake_call)

    result = await chat("watch paypal", conn)
    assert result["watchlist_changes"][0]["status"] == "added"

    from app.db import DEFAULT_USER_ID

    async with conn.execute(
        "SELECT 1 FROM watchlist WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, "PYPL"),
    ) as cur:
        assert await cur.fetchone() is not None
