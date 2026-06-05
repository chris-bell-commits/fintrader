"""Tests for the SQLite database layer."""

import pytest

from app import db


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    """Point the database at a temporary file for each test."""
    path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(path))
    return path


async def test_schema_creates_all_tables(db_path):
    await db.init_db()
    async with db.get_db() as conn:
        async with conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ) as cur:
            tables = {row["name"] for row in await cur.fetchall()}
    expected = {
        "users_profile",
        "watchlist",
        "positions",
        "trades",
        "portfolio_snapshots",
        "chat_messages",
    }
    assert expected <= tables


async def test_seed_inserts_default_user_and_watchlist(db_path):
    await db.init_db()
    async with db.get_db() as conn:
        async with conn.execute(
            "SELECT cash_balance FROM users_profile WHERE id = ?", (db.DEFAULT_USER_ID,)
        ) as cur:
            user = await cur.fetchone()
        async with conn.execute("SELECT ticker FROM watchlist") as cur:
            tickers = {row["ticker"] for row in await cur.fetchall()}

    assert user is not None
    assert user["cash_balance"] == db.DEFAULT_CASH_BALANCE
    assert tickers == set(db.SEED_TICKERS)


async def test_init_db_is_idempotent(db_path):
    await db.init_db()
    await db.init_db()
    async with db.get_db() as conn:
        async with conn.execute("SELECT COUNT(*) AS n FROM users_profile") as cur:
            users = (await cur.fetchone())["n"]
        async with conn.execute("SELECT COUNT(*) AS n FROM watchlist") as cur:
            watch = (await cur.fetchone())["n"]

    assert users == 1
    assert watch == len(db.SEED_TICKERS)
