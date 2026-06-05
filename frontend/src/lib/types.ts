export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
}

export type PriceMap = Record<string, PriceUpdate>;

export interface WatchlistItem {
  ticker: string;
  price: number | null;
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  pnl_percent: number;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions_value: number;
  unrealized_pnl: number;
  positions: Position[];
}

export interface HistoryPoint {
  total_value: number;
  recorded_at: string;
}

export type TradeSide = "buy" | "sell";

export interface TradeRequest {
  ticker: string;
  quantity: number;
  side: TradeSide;
}

export interface ChatTrade {
  ticker: string;
  side: TradeSide;
  quantity: number;
}

export interface ChatWatchlistChange {
  ticker: string;
  action: "add" | "remove";
}

export interface ChatResponse {
  message: string;
  trades?: ChatTrade[];
  watchlist_changes?: ChatWatchlistChange[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  trades?: ChatTrade[];
  watchlist_changes?: ChatWatchlistChange[];
}

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
