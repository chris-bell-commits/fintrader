"use client";

import { useCallback, useEffect, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import Header from "@/components/Header";
import MainChart from "@/components/MainChart";
import PnLChart from "@/components/PnLChart";
import PortfolioHeatmap from "@/components/PortfolioHeatmap";
import PositionsTable from "@/components/PositionsTable";
import TradeBar from "@/components/TradeBar";
import Watchlist from "@/components/Watchlist";
import * as api from "@/lib/api";
import { usePriceStream } from "@/lib/usePriceStream";
import { useTheme } from "@/lib/useTheme";
import type { ChatMessage, HistoryPoint, Portfolio, TradeSide } from "@/lib/types";

const EMPTY_PORTFOLIO: Portfolio = {
  cash_balance: 0,
  total_value: 0,
  positions_value: 0,
  unrealized_pnl: 0,
  positions: [],
};

export default function Page() {
  const { theme, toggle } = useTheme();
  const { prices, history, baseline, status } = usePriceStream();

  const [tickers, setTickers] = useState<string[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY_PORTFOLIO);
  const [pnlHistory, setPnlHistory] = useState<HistoryPoint[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const refreshWatchlist = useCallback(async () => {
    const items = await api.getWatchlist();
    setTickers(items.map((i) => i.ticker));
    setSelected((cur) => cur ?? items[0]?.ticker ?? null);
  }, []);

  const refreshPortfolio = useCallback(async () => {
    setPortfolio(await api.getPortfolio());
  }, []);

  const refreshHistory = useCallback(async () => {
    setPnlHistory(await api.getHistory());
  }, []);

  useEffect(() => {
    refreshWatchlist();
    refreshPortfolio();
    refreshHistory();
  }, [refreshWatchlist, refreshPortfolio, refreshHistory]);

  useEffect(() => {
    const id = setInterval(() => {
      refreshPortfolio();
      refreshHistory();
    }, 15000);
    return () => clearInterval(id);
  }, [refreshPortfolio, refreshHistory]);

  const handleTrade = useCallback(
    async (ticker: string, quantity: number, side: TradeSide) => {
      await api.executeTrade({ ticker, quantity, side });
      await Promise.all([refreshPortfolio(), refreshHistory()]);
    },
    [refreshPortfolio, refreshHistory]
  );

  const handleAdd = useCallback(
    async (ticker: string) => {
      await api.addWatchlist(ticker);
      await refreshWatchlist();
    },
    [refreshWatchlist]
  );

  const handleRemove = useCallback(
    async (ticker: string) => {
      await api.removeWatchlist(ticker);
      await refreshWatchlist();
    },
    [refreshWatchlist]
  );

  const handleChat = useCallback(
    async (message: string) => {
      setMessages((m) => [...m, { role: "user", content: message }]);
      setChatLoading(true);
      try {
        const res = await api.sendChat(message);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.message,
            trades: res.trades,
            watchlist_changes: res.watchlist_changes,
          },
        ]);
        await Promise.all([refreshPortfolio(), refreshHistory(), refreshWatchlist()]);
      } catch (e) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: e instanceof Error ? e.message : "Request failed" },
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [refreshPortfolio, refreshHistory, refreshWatchlist]
  );

  const isDark = theme === "dark";
  const selectedPrice = selected ? prices[selected]?.price ?? null : null;

  return (
    <div className="flex h-screen flex-col">
      <Header
        totalValue={portfolio.total_value}
        cash={portfolio.cash_balance}
        status={status}
        theme={theme}
        onToggleTheme={toggle}
      />

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 p-2">
        <div className="col-span-3 min-h-0">
          <Watchlist
            tickers={tickers}
            prices={prices}
            history={history}
            baseline={baseline}
            selected={selected}
            onSelect={setSelected}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>

        <div className="col-span-6 flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-[3]">
            <MainChart
              ticker={selected}
              series={selected ? history[selected] ?? [] : []}
              currentPrice={selectedPrice}
              isDark={isDark}
            />
          </div>
          <TradeBar selectedTicker={selected} onTrade={handleTrade} />
          <div className="grid min-h-0 flex-[3] grid-cols-2 gap-2">
            <PortfolioHeatmap positions={portfolio.positions} />
            <PnLChart history={pnlHistory} isDark={isDark} />
          </div>
          <div className="min-h-0 flex-[2]">
            <PositionsTable positions={portfolio.positions} onSelect={setSelected} />
          </div>
        </div>

        <div className="col-span-3 min-h-0">
          <ChatPanel messages={messages} loading={chatLoading} onSend={handleChat} />
        </div>
      </div>
    </div>
  );
}
