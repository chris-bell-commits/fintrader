"use client";

import { useEffect, useState } from "react";
import type { TradeSide } from "@/lib/types";

interface TradeBarProps {
  selectedTicker: string | null;
  onTrade: (ticker: string, quantity: number, side: TradeSide) => Promise<void>;
}

export default function TradeBar({ selectedTicker, onTrade }: TradeBarProps) {
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTicker) setTicker(selectedTicker);
  }, [selectedTicker]);

  const submit = async (side: TradeSide) => {
    setError(null);
    const t = ticker.trim().toUpperCase();
    const q = Number(quantity);
    if (!t || !Number.isFinite(q) || q <= 0) {
      setError("Enter a ticker and positive quantity");
      return;
    }
    setBusy(true);
    try {
      await onTrade(t, q, side);
      setQuantity("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel flex items-center gap-2 px-3 py-2">
      <span className="panel-title px-0">Trade</span>
      <input
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        placeholder="Ticker"
        className="w-24 rounded border border-gray-300 bg-transparent px-2 py-1 text-sm uppercase outline-none focus:border-primary dark:border-terminal-border"
      />
      <input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Qty"
        type="number"
        min="0"
        step="any"
        className="w-24 rounded border border-gray-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-terminal-border"
      />
      <button
        disabled={busy}
        onClick={() => submit("buy")}
        className="rounded bg-up px-4 py-1 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Buy
      </button>
      <button
        disabled={busy}
        onClick={() => submit("sell")}
        className="rounded bg-down px-4 py-1 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        Sell
      </button>
      {error && <span className="text-xs text-down">{error}</span>}
    </div>
  );
}
