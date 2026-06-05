"""Massive (Polygon.io) API client for real market data.

Fetches real previous-close prices for each ticker on startup, seeds the GBM
simulator with those prices, then delegates live streaming to the simulator.
This works on all Massive plan tiers including the free plan.
"""

from __future__ import annotations

import asyncio
import logging

from massive import RESTClient

from .cache import PriceCache
from .interface import MarketDataSource
from .seed_prices import SEED_PRICES
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)


class MassiveDataSource(MarketDataSource):
    """Seeds the GBM simulator with real Massive previous-close prices.

    On startup, fetches the most recent closing price for each ticker via
    get_previous_close_agg and uses those as simulator seed prices. The GBM
    simulator then provides live tick-by-tick streaming from those real bases.

    Works on all Massive plan tiers including the free tier.
    """

    def __init__(self, api_key: str, price_cache: PriceCache) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._simulator: SimulatorDataSource | None = None

    async def start(self, tickers: list[str]) -> None:
        client = RESTClient(api_key=self._api_key)

        logger.info("Fetching real close prices for %d tickers...", len(tickers))
        real_prices = await asyncio.to_thread(_fetch_prev_close_prices, client, tickers)

        if real_prices:
            SEED_PRICES.update(real_prices)
            logger.info("Seeded %d/%d tickers with real close prices", len(real_prices), len(tickers))
        else:
            logger.warning("No real prices fetched — simulator will use default seed prices")

        self._simulator = SimulatorDataSource(price_cache=self._cache)
        await self._simulator.start(tickers)
        logger.info("MassiveDataSource ready: real-price-seeded GBM simulator running")

    async def stop(self) -> None:
        if self._simulator:
            await self._simulator.stop()
            self._simulator = None

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        client = RESTClient(api_key=self._api_key)
        real_prices = await asyncio.to_thread(_fetch_prev_close_prices, client, [ticker])
        if real_prices:
            SEED_PRICES.update(real_prices)
        if self._simulator:
            await self._simulator.add_ticker(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        if self._simulator:
            await self._simulator.remove_ticker(ticker)

    def get_tickers(self) -> list[str]:
        if self._simulator:
            return self._simulator.get_tickers()
        return []


def _fetch_prev_close_prices(client: RESTClient, tickers: list[str]) -> dict[str, float]:
    """Fetch previous-close prices for a list of tickers. Synchronous; runs in a thread.

    Spaces calls 1s apart to stay within the free-tier rate limit (5 req/min).
    Tickers that fail (e.g. due to rate limiting) keep their default seed price.
    """
    import time

    prices: dict[str, float] = {}
    for i, ticker in enumerate(tickers):
        if i > 0:
            time.sleep(1.0)
        try:
            result = client.get_previous_close_agg(ticker)
            if result:
                prices[ticker] = float(result[0].close)
        except Exception as exc:
            logger.warning("Could not fetch close price for %s: %s", ticker, exc)
    return prices
