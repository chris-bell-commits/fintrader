"use client";

import { money } from "@/lib/format";
import type { ConnectionStatus } from "@/lib/types";
import type { Theme } from "@/lib/useTheme";

interface HeaderProps {
  totalValue: number;
  cash: number;
  status: ConnectionStatus;
  theme: Theme;
  onToggleTheme: () => void;
}

const STATUS_META: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: "#16c784", label: "Live" },
  reconnecting: { color: "#ecad0a", label: "Reconnecting" },
  disconnected: { color: "#ea3943", label: "Disconnected" },
};

export default function Header({ totalValue, cash, status, theme, onToggleTheme }: HeaderProps) {
  const meta = STATUS_META[status];

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-terminal-border">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight text-accent">FinTrader</span>
        <span className="text-xs text-gray-500 dark:text-terminal-muted">AI Trading Workstation</span>
      </div>

      <div className="flex items-center gap-6">
        <Metric label="Portfolio" value={money(totalValue)} highlight />
        <Metric label="Cash" value={money(cash)} />

        <div className="flex items-center gap-2" title={meta.label}>
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
          />
          <span className="text-xs text-gray-500 dark:text-terminal-muted">{meta.label}</span>
        </div>

        <button
          onClick={onToggleTheme}
          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:border-primary hover:text-primary dark:border-terminal-border dark:text-terminal-muted"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-terminal-muted">
        {label}
      </div>
      <div className={`text-sm font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
