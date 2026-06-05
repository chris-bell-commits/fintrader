"use client";

import { money, percent, price, qty } from "@/lib/format";
import type { Position } from "@/lib/types";

interface PositionsTableProps {
  positions: Position[];
  onSelect: (ticker: string) => void;
}

export default function PositionsTable({ positions, onSelect }: PositionsTableProps) {
  return (
    <div className="flex h-full flex-col panel">
      <span className="panel-title border-b border-gray-200 dark:border-terminal-border">Positions</span>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="sticky top-0 bg-gray-100 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-terminal-raised dark:text-terminal-muted">
            <tr>
              <Th className="text-left">Ticker</Th>
              <Th>Qty</Th>
              <Th>Avg Cost</Th>
              <Th>Price</Th>
              <Th>P&amp;L</Th>
              <Th>%</Th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-gray-400 dark:text-terminal-muted">
                  No open positions
                </td>
              </tr>
            ) : (
              positions.map((p) => {
                const up = p.unrealized_pnl >= 0;
                return (
                  <tr
                    key={p.ticker}
                    onClick={() => onSelect(p.ticker)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-100 dark:border-terminal-border/50 dark:hover:bg-terminal-raised"
                  >
                    <td className="px-2 py-1.5 text-left font-semibold">{p.ticker}</td>
                    <Td>{qty(p.quantity)}</Td>
                    <Td>{price(p.avg_cost)}</Td>
                    <Td>{price(p.current_price)}</Td>
                    <td className={`px-2 py-1.5 text-right ${up ? "text-up" : "text-down"}`}>
                      {money(p.unrealized_pnl)}
                    </td>
                    <td className={`px-2 py-1.5 text-right ${up ? "text-up" : "text-down"}`}>
                      {percent(p.pnl_percent)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "text-right" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-1.5 font-semibold ${className}`}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-right">{children}</td>;
}
