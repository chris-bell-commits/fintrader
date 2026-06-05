"use client";

import { useEffect, useRef, useState } from "react";
import Sparkline from "./Sparkline";
import { percent, price } from "@/lib/format";
import { SECTOR_ORDER, sectorFor, type Sector } from "@/lib/sectors";
import type { PriceMap } from "@/lib/types";

interface WatchlistProps {
  tickers: string[];
  prices: PriceMap;
  history: Record<string, number[]>;
  baseline: Record<string, number>;
  selected: string | null;
  onSelect: (ticker: string) => void;
  onAdd: (ticker: string) => void;
  onRemove: (ticker: string) => void;
}

export default function Watchlist({
  tickers,
  prices,
  history,
  baseline,
  selected,
  onSelect,
  onAdd,
  onRemove,
}: WatchlistProps) {
  const [input, setInput] = useState("");

  const grouped: Record<Sector, string[]> = { TECH: [], HEALTHCARE: [], FINANCE: [] };
  for (const t of tickers) grouped[sectorFor(t)].push(t);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (t) {
      onAdd(t);
      setInput("");
    }
  };

  return (
    <div className="flex h-full flex-col panel">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-terminal-border">
        <span className="panel-title">Watchlist</span>
        <form onSubmit={submit} className="flex items-center gap-1 px-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ticker"
            className="w-16 rounded border border-gray-300 bg-transparent px-2 py-0.5 text-xs uppercase outline-none focus:border-primary dark:border-terminal-border"
          />
          <button
            type="submit"
            className="rounded bg-primary px-2 py-0.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Add
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {SECTOR_ORDER.map((sector) =>
          grouped[sector].length === 0 ? null : (
            <div key={sector}>
              <div className="sticky top-0 bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:bg-terminal-raised dark:text-terminal-muted">
                {sector}
              </div>
              {grouped[sector].map((ticker) => (
                <Row
                  key={ticker}
                  ticker={ticker}
                  price={prices[ticker]?.price ?? null}
                  baselinePrice={baseline[ticker]}
                  series={history[ticker] ?? []}
                  selected={selected === ticker}
                  onSelect={() => onSelect(ticker)}
                  onRemove={() => onRemove(ticker)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

interface RowProps {
  ticker: string;
  price: number | null;
  baselinePrice?: number;
  series: number[];
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function Row({ ticker, price: current, baselinePrice, series, selected, onSelect, onRemove }: RowProps) {
  const flashRef = useRef<HTMLDivElement>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    if (current === null) return;
    const prev = prevPrice.current;
    if (prev !== null && current !== prev && flashRef.current) {
      const cls = current > prev ? "flash-up" : "flash-down";
      const el = flashRef.current;
      el.classList.remove("flash-up", "flash-down");
      void el.offsetWidth;
      el.classList.add(cls);
    }
    prevPrice.current = current;
  }, [current]);

  const dayChange =
    current !== null && baselinePrice ? ((current - baselinePrice) / baselinePrice) * 100 : 0;
  const isUp = dayChange >= 0;
  const lineColor = isUp ? "#16c784" : "#ea3943";

  return (
    <div
      ref={flashRef}
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-terminal-raised ${
        selected ? "border-l-2 border-accent bg-gray-100 dark:bg-terminal-raised" : "border-l-2 border-transparent"
      }`}
    >
      <span className="w-14 font-semibold">{ticker}</span>
      <span className="w-20 text-right tabular-nums">{current !== null ? price(current) : "—"}</span>
      <span className={`w-16 text-right text-xs tabular-nums ${isUp ? "text-up" : "text-down"}`}>
        {current !== null ? percent(dayChange) : ""}
      </span>
      <div className="ml-auto">
        <Sparkline data={series} color={lineColor} />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="ml-1 text-xs text-gray-400 opacity-0 hover:text-down group-hover:opacity-100"
        title={`Remove ${ticker}`}
      >
        x
      </button>
    </div>
  );
}
