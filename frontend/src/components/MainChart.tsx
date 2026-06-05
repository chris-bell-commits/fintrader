"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { price } from "@/lib/format";

interface MainChartProps {
  ticker: string | null;
  series: number[];
  currentPrice: number | null;
  isDark: boolean;
}

export default function MainChart({ ticker, series, currentPrice, isDark }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#8b949e" : "#6b7280",
      },
      grid: {
        vertLines: { color: isDark ? "#2a3038" : "#e5e7eb" },
        horzLines: { color: isDark ? "#2a3038" : "#e5e7eb" },
      },
      rightPriceScale: { borderColor: isDark ? "#2a3038" : "#e5e7eb" },
      timeScale: { borderColor: isDark ? "#2a3038" : "#e5e7eb", timeVisible: true },
      autoSize: true,
    });

    const area = chart.addSeries(AreaSeries, {
      lineColor: "#209dd7",
      topColor: "rgba(32, 157, 215, 0.4)",
      bottomColor: "rgba(32, 157, 215, 0.0)",
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = area;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isDark]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    const start = now - series.length;
    const data = series.map((value, i) => ({ time: (start + i) as Time, value }));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [series, ticker]);

  return (
    <div className="flex h-full flex-col panel">
      <div className="flex items-baseline justify-between border-b border-gray-200 px-3 py-2 dark:border-terminal-border">
        <span className="text-sm font-bold">{ticker ?? "Select a ticker"}</span>
        {currentPrice !== null && (
          <span className="text-lg font-semibold tabular-nums text-primary">{price(currentPrice)}</span>
        )}
      </div>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
