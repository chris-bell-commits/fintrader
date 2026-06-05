"""Shared application singletons: the price cache and market data source.

Routes read live prices from the cache and mutate the market source's active
ticker set (watchlist add/remove). The lifespan handler in main.py owns the
lifecycle (start/stop) of the market source.
"""

from __future__ import annotations

from app.market import PriceCache, create_market_data_source

price_cache = PriceCache()
market_source = create_market_data_source(price_cache)
