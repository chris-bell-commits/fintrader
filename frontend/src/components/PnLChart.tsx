"use client";

import { useEffect, useRef } from "react";
import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { HistoryPoint } from "@/lib/types";

interface PnLChartProps {
  history: HistoryPoint[];
  isDark: boolean;
}

export default function PnLChart({ history, isDark }: PnLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: isDark ? "#8b949e" : "#6b7280" },
      grid: {
        vertLines: { color: isDark ? "#2a3038" : "#e5e7eb" },
        horzLines: { color: isDark ? "#2a3038" : "#e5e7eb" },
      },
      rightPriceScale: { borderColor: isDark ? "#2a3038" : "#e5e7eb" },
      timeScale: { borderColor: isDark ? "#2a3038" : "#e5e7eb", timeVisible: true },
      autoSize: true,
    });
    const area = chart.addSeries(AreaSeries, {
      lineColor: "#ecad0a",
      topColor: "rgba(236, 173, 10, 0.35)",
      bottomColor: "rgba(236, 173, 10, 0.0)",
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
    const data = history
      .map((p) => ({
        time: Math.floor(new Date(p.recorded_at).getTime() / 1000) as Time,
        value: p.total_value,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [history]);

  return (
    <div className="flex h-full flex-col panel">
      <span className="panel-title border-b border-gray-200 dark:border-terminal-border">
        Portfolio Value
      </span>
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}
