import type {
  ChatResponse,
  HistoryPoint,
  Portfolio,
  TradeRequest,
  WatchlistItem,
} from "./types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getWatchlist(): Promise<WatchlistItem[]> {
  return json(await fetch("/api/watchlist"));
}

export async function addWatchlist(ticker: string): Promise<void> {
  await json(
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    })
  );
}

export async function removeWatchlist(ticker: string): Promise<void> {
  const res = await fetch(`/api/watchlist/${encodeURIComponent(ticker)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to remove ${ticker}`);
}

export async function getPortfolio(): Promise<Portfolio> {
  return json(await fetch("/api/portfolio"));
}

export async function getHistory(): Promise<HistoryPoint[]> {
  return json(await fetch("/api/portfolio/history"));
}

export async function executeTrade(req: TradeRequest): Promise<unknown> {
  return json(
    await fetch("/api/portfolio/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    })
  );
}

export async function sendChat(message: string): Promise<ChatResponse> {
  return json(
    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    })
  );
}
