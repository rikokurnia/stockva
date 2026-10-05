"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { money } from "../lib/city";
import type { EquityPoint } from "../lib/equity-history";
import styles from "./civic-panel.module.css";

type Range = "1W" | "1M" | "3M" | "All";
const RANGE_MS: Record<Range, number | null> = {
  "1W": 7 * 86400000,
  "1M": 30 * 86400000,
  "3M": 90 * 86400000,
  All: null,
};

/** Total-equity curve from recorded snapshots (lightweight-charts area). */
export default function EquityChart({ points }: { points: EquityPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<Range>("All");
  const shown = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.t - b.t);
    const window = RANGE_MS[range];
    if (!window) return sorted;
    const cutoff = Date.now() - window;
    const filtered = sorted.filter((p) => p.t >= cutoff);
    return filtered.length >= 2 ? filtered : sorted;
  }, [points, range]);
  const positive =
    shown.length < 2 || shown[shown.length - 1].equity >= shown[0].equity;
  useEffect(() => {
    if (!containerRef.current || shown.length < 2) return;
    chartRef.current?.remove();
    chartRef.current = null;
    const container = containerRef.current;
    const color = positive ? "#10b981" : "#f43f5e";
    const chart = createChart(container, {
      width: container.clientWidth || 400,
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8fa6b4",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      timeScale: { borderColor: "rgba(255, 255, 255, 0.08)", rightOffset: 4 },
    });
    chartRef.current = chart;
    const series = chart.addSeries(AreaSeries, {
      lineColor: color,
      topColor: positive
        ? "rgba(16, 185, 129, 0.32)"
        : "rgba(244, 63, 94, 0.32)",
      bottomColor: "rgba(0, 0, 0, 0)",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 0, minMove: 1 },
    });
    const seen = new Set<number>();
    series.setData(
      shown
        .map((p) => ({
          time: Math.floor(p.t / 1000) as UTCTimestamp,
          value: Math.round(p.equity * 100) / 100,
        }))
        .filter((d) => {
          if (seen.has(d.time)) return false;
          seen.add(d.time);
          return true;
        }),
    );
    chart.timeScale().fitContent();
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [shown, positive]);
  if (shown.length < 2) return null;
  const first = shown[0].equity;
  const last = shown[shown.length - 1].equity;
  return (
    <div>
      <div className={styles.chartHeader}>
        <div>
          <small style={{ color: "var(--subtle)" }}>Total equity</small>
          <strong
            style={{
              display: "block",
              fontSize: "24px",
              color: positive ? "var(--positive)" : "var(--negative)",
            }}
          >
            {money(last)}
          </strong>
          <small style={{ color: "var(--subtle)" }}>
            {last >= first ? "+" : ""}
            {money(last - first)} since{" "}
            {new Date(shown[0].t).toLocaleDateString()}
          </small>
        </div>
        <div className={styles.chartControls}>
          {(Object.keys(RANGE_MS) as Range[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={range === key}
              onClick={() => setRange(key)}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.chart} ref={containerRef} style={{ height: 220 }} />
    </div>
  );
}
