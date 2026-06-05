"""Route-level tests using FastAPI TestClient against a temporary database.

The TestClient context manager runs the app lifespan, which initializes a
fresh seeded DB (pointed at a temp file via DB_PATH) and starts the simulator
so live prices are available for trade tests.
"""

from __future__ import annotations

import os
import tempfile

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DB_PATH"] = tmp.name
    os.environ.pop("MASSIVE_API_KEY", None)  # force simulator

    from app.main import app

    with TestClient(app) as c:
        yield c

    os.unlink(tmp.name)
    os.environ.pop("DB_PATH", None)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_watchlist_seeded(client):
    from app.db import SEED_TICKERS

    resp = client.get("/api/watchlist")
    assert resp.status_code == 200
    data = resp.json()
    tickers = {row["ticker"] for row in data}
    assert "AAPL" in tickers
    assert len(data) == len(SEED_TICKERS)
    for row in data:
        assert "ticker" in row
        assert "added_at" in row
        assert "price" in row


def test_watchlist_add_and_remove(client):
    resp = client.post("/api/watchlist", json={"ticker": "pypl"})
    assert resp.status_code == 200
    assert resp.json()["ticker"] == "PYPL"

    tickers = {row["ticker"] for row in client.get("/api/watchlist").json()}
    assert "PYPL" in tickers

    dup = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert dup.status_code == 409

    rm = client.delete("/api/watchlist/PYPL")
    assert rm.status_code == 200
    tickers = {row["ticker"] for row in client.get("/api/watchlist").json()}
    assert "PYPL" not in tickers


def test_watchlist_remove_missing(client):
    resp = client.delete("/api/watchlist/ZZZZ")
    assert resp.status_code == 404


def test_portfolio_initial_state(client):
    resp = client.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert data["cash_balance"] == 10000.0
    assert data["positions"] == []
    assert data["total_value"] == 10000.0
    assert data["unrealized_pnl"] == 0.0


def test_buy_then_sell(client):
    buy = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5, "side": "buy"}
    )
    assert buy.status_code == 200
    body = buy.json()
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["side"] == "buy"
    assert body["portfolio"]["cash_balance"] < 10000.0

    positions = {p["ticker"]: p for p in body["portfolio"]["positions"]}
    assert positions["AAPL"]["quantity"] == 5

    sell = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 5, "side": "sell"}
    )
    assert sell.status_code == 200
    tickers = {p["ticker"] for p in sell.json()["portfolio"]["positions"]}
    assert "AAPL" not in tickers


def test_buy_insufficient_cash(client):
    resp = client.post(
        "/api/portfolio/trade",
        json={"ticker": "AAPL", "quantity": 1000000, "side": "buy"},
    )
    assert resp.status_code == 400
    assert "insufficient cash" in resp.json()["detail"]


def test_sell_insufficient_shares(client):
    resp = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 10, "side": "sell"}
    )
    assert resp.status_code == 400
    assert "insufficient shares" in resp.json()["detail"]


def test_trade_invalid_side(client):
    resp = client.post(
        "/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "hold"}
    )
    assert resp.status_code == 422


def test_fractional_shares(client):
    resp = client.post(
        "/api/portfolio/trade", json={"ticker": "MSFT", "quantity": 0.5, "side": "buy"}
    )
    assert resp.status_code == 200
    positions = {p["ticker"]: p for p in resp.json()["portfolio"]["positions"]}
    assert positions["MSFT"]["quantity"] == 0.5


def test_portfolio_history_grows_after_trade(client):
    before = client.get("/api/portfolio/history").json()
    client.post(
        "/api/portfolio/trade", json={"ticker": "NVDA", "quantity": 1, "side": "buy"}
    )
    after = client.get("/api/portfolio/history").json()
    assert len(after) == len(before) + 1
    assert "total_value" in after[-1]
    assert "recorded_at" in after[-1]
