"use client";

import { percent } from "@/lib/format";
import type { Position } from "@/lib/types";

interface PortfolioHeatmapProps {
  positions: Position[];
}

interface Tile extends Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap layout over a unit rectangle (percent coordinates). */
function squarify(positions: Position[]): Tile[] {
  const total = positions.reduce((s, p) => s + Math.max(p.market_value, 0), 0);
  if (total <= 0) return [];

  const items = positions
    .filter((p) => p.market_value > 0)
    .map((p) => ({ pos: p, area: (p.market_value / total) * 100 * 100 }))
    .sort((a, b) => b.area - a.area);

  const tiles: Tile[] = [];
  let x = 0;
  let y = 0;
  let w = 100;
  let h = 100;
  let i = 0;

  while (i < items.length) {
    const horizontal = w >= h;
    const side = horizontal ? h : w;
    const remaining = items.slice(i);

    let row: typeof items = [];
    let worst = Infinity;
    for (const item of remaining) {
      const trial = [...row, item];
      const sum = trial.reduce((s, t) => s + t.area, 0);
      const thick = sum / side;
      const ratios = trial.map((t) => {
        const len = t.area / thick;
        return Math.max(thick / len, len / thick);
      });
      const trialWorst = Math.max(...ratios);
      if (trialWorst > worst) break;
      row = trial;
      worst = trialWorst;
    }

    const rowSum = row.reduce((s, t) => s + t.area, 0);
    const thick = rowSum / side;
    let offset = 0;
    for (const item of row) {
      const len = item.area / thick;
      if (horizontal) {
        tiles.push({ ...item.pos, x, y: y + offset, w: thick, h: len });
      } else {
        tiles.push({ ...item.pos, x: x + offset, y, w: len, h: thick });
      }
      offset += len;
    }

    if (horizontal) {
      x += thick;
      w -= thick;
    } else {
      y += thick;
      h -= thick;
    }
    i += row.length;
  }

  return tiles;
}

function tileColor(pnlPercent: number): string {
  const clamped = Math.max(-10, Math.min(10, pnlPercent));
  const intensity = Math.min(0.85, 0.2 + Math.abs(clamped) / 10);
  return clamped >= 0
    ? `rgba(22, 199, 132, ${intensity})`
    : `rgba(234, 57, 67, ${intensity})`;
}

export default function PortfolioHeatmap({ positions }: PortfolioHeatmapProps) {
  const tiles = squarify(positions);

  return (
    <div className="flex h-full flex-col panel">
      <span className="panel-title border-b border-gray-200 dark:border-terminal-border">
        Allocation Heatmap
      </span>
      <div className="relative min-h-0 flex-1 p-1">
        {tiles.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-gray-400 dark:text-terminal-muted">
            No positions
          </div>
        ) : (
          tiles.map((t) => (
            <div
              key={t.ticker}
              className="absolute overflow-hidden rounded-sm border border-black/20 p-1"
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: `${t.w}%`,
                height: `${t.h}%`,
                backgroundColor: tileColor(t.pnl_percent),
              }}
              title={`${t.ticker} ${percent(t.pnl_percent)}`}
            >
              <div className="text-xs font-bold text-white drop-shadow">{t.ticker}</div>
              <div className="text-[10px] text-white/90 drop-shadow">{percent(t.pnl_percent)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
