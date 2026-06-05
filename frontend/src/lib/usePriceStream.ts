"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, PriceMap, PriceUpdate } from "./types";

const MAX_SPARK_POINTS = 120;

export interface PriceStreamState {
  prices: PriceMap;
  history: Record<string, number[]>;
  baseline: Record<string, number>;
  status: ConnectionStatus;
}

/**
 * Subscribes to /api/stream/prices via EventSource. Accumulates a rolling
 * sparkline history per ticker and records the first-seen price as the
 * session baseline for daily-change display.
 */
export function usePriceStream(): PriceStreamState {
  const [prices, setPrices] = useState<PriceMap>({});
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const historyRef = useRef<Record<string, number[]>>({});
  const baselineRef = useRef<Record<string, number>>({});
  const [, forceTick] = useState(0);

  useEffect(() => {
    const source = new EventSource("/api/stream/prices");

    source.onopen = () => setStatus("connected");

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as PriceMap;
      const history = historyRef.current;
      const baseline = baselineRef.current;

      for (const [ticker, update] of Object.entries(data)) {
        const u = update as PriceUpdate;
        if (baseline[ticker] === undefined) baseline[ticker] = u.price;
        const series = history[ticker] ?? [];
        series.push(u.price);
        if (series.length > MAX_SPARK_POINTS) series.shift();
        history[ticker] = series;
      }

      setStatus("connected");
      setPrices(data);
      forceTick((n) => n + 1);
    };

    source.onerror = () => {
      setStatus(source.readyState === EventSource.CLOSED ? "disconnected" : "reconnecting");
    };

    return () => source.close();
  }, []);

  return {
    prices,
    history: historyRef.current,
    baseline: baselineRef.current,
    status,
  };
}
