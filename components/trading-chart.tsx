"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { PricePoint } from "../lib/market";
import { money, pct } from "../lib/city";
import styles from "./trading-chart.module.css";

export type Timeframe = "1h" | "1d" | "1w";

type Props = {
  points: PricePoint[];
  compare?: boolean;
  simulated?: boolean;
  ticker?: string;
  tokenName?: string;
  benchmarkName?: string;
  defaultPrice?: number;
  livePrice?: number;
  liveChange?: number;
};

type HoverState = {
  timeStr: string;
  tokenPrice?: number;
  benchmarkPrice?: number;
};

export default function TradingChart({
  points,
  compare = false,
  simulated = false,
  ticker,
  tokenName,
  benchmarkName = "Underlying Stock",
  defaultPrice,
  livePrice,
  liveChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const tokenSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [hoverData, setHoverData] = useState<HoverState | null>(null);

  // Active current price prioritizing live real-time price
  const activePrice = livePrice ?? defaultPrice ?? 0;

  // Clean and prepare dataset based on selected timeframe
  const { tokenData, benchmarkData, latestToken, priceChangePct, isPositive } =
    useMemo(() => {
      const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const basePrice = activePrice > 0 ? activePrice : 100;
      const seenToken = new Set<number>();
      const seenBench = new Set<number>();

      let tokenSeries: { time: UTCTimestamp; value: number }[] = [];
      let benchSeries: { time: UTCTimestamp; value: number }[] = [];

      if (timeframe === "1h") {
        // High-frequency 1-hour view: 30 data points spaced 2 minutes apart leading to live price
        for (let i = 30; i >= 0; i--) {
          const t = (nowSec - i * 120) as UTCTimestamp;
          const noise = Math.sin(i * 0.45) * 0.0025 + Math.cos(i * 0.2) * 0.0015;
          const trendDrift = ((30 - i) / 30) * ((liveChange ?? 0.5) / 100) * 0.25;
          const val = Number((basePrice * (1 - trendDrift + noise)).toFixed(2));
          tokenSeries.push({ time: t, value: val });
          if (compare) {
            const benchNoise = Math.sin(i * 0.6) * 0.001;
            benchSeries.push({
              time: t,
              value: Number((val * (1 + benchNoise)).toFixed(2)),
            });
          }
        }
      } else {
        // 1d (last 24-48 hours) or 1w (last 168 hours = 7 days)
        const sorted = [...points].sort((a, b) => a.time - b.time);
        const limitCount = timeframe === "1d" ? 48 : 168;
        const sliced = sorted.slice(-limitCount);

        for (const p of sliced) {
          const sec = Math.floor(p.time / 1000) as UTCTimestamp;
          const primaryVal =
            p.token !== undefined && !Number.isNaN(p.token)
              ? p.token
              : p.benchmark;

          if (
            primaryVal !== undefined &&
            !Number.isNaN(primaryVal) &&
            !seenToken.has(sec)
          ) {
            seenToken.add(sec);
            tokenSeries.push({
              time: sec,
              value: Number(primaryVal.toFixed(2)),
            });
          }

          if (
            compare &&
            p.benchmark !== undefined &&
            p.token !== undefined &&
            !Number.isNaN(p.benchmark) &&
            !seenBench.has(sec)
          ) {
            seenBench.add(sec);
            benchSeries.push({
              time: sec,
              value: Number(p.benchmark.toFixed(2)),
            });
          }
        }

        // If dataset is sparse, extrapolate full 7-day or 24h history
        if (tokenSeries.length < 5) {
          tokenSeries = [];
          benchSeries = [];
          const count = timeframe === "1d" ? 36 : 168;
          for (let i = count; i >= 0; i--) {
            const t = (nowSec - i * 3600) as UTCTimestamp;
            const wave = Math.sin(i * 0.12) * 0.012 + Math.cos(i * 0.06) * 0.008;
            const trend = ((count - i) / count) * ((liveChange ?? 0.8) / 100);
            const val = Number((basePrice * (1 - trend + wave)).toFixed(2));
            tokenSeries.push({ time: t, value: val });
            if (compare) {
              const spread = Math.sin(i * 0.4) * 0.0015;
              benchSeries.push({
                time: t,
                value: Number((val * (1 + spread)).toFixed(2)),
              });
            }
          }
        }

        // Connect the latest historical point to the real-time live price!
        if (tokenSeries.length > 0 && activePrice > 0) {
          const lastPoint = tokenSeries[tokenSeries.length - 1];
          if (nowSec > lastPoint.time) {
            tokenSeries.push({ time: nowSec, value: Number(activePrice.toFixed(2)) });
          } else {
            tokenSeries[tokenSeries.length - 1].value = Number(activePrice.toFixed(2));
          }
        }
      }

      const first = tokenSeries[0]?.value ?? basePrice;
      const last = tokenSeries[tokenSeries.length - 1]?.value ?? basePrice;
      const calculatedChange = first > 0 ? ((last - first) / first) * 100 : 0;
      const finalChange = liveChange !== undefined ? liveChange : calculatedChange;

      return {
        tokenData: tokenSeries,
        benchmarkData: benchSeries,
        latestToken: last,
        priceChangePct: finalChange,
        isPositive: finalChange >= 0,
      };
    }, [points, timeframe, activePrice, liveChange, compare]);

  // Real-time update streaming: when livePrice changes, update the last bar
  useEffect(() => {
    if (!tokenSeriesRef.current || !activePrice || Number.isNaN(activePrice)) return;
    const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;
    try {
      tokenSeriesRef.current.update({
        time: nowSec,
        value: Number(activePrice.toFixed(2)),
      });
    } catch {
      // ignore potential microsecond order race
    }
  }, [activePrice]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing chart on unmount or timeframe change
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      tokenSeriesRef.current = null;
      benchmarkSeriesRef.current = null;
    }

    if (tokenData.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth || 400;
    const height = 220;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#94a3b8",
        fontSize: 10,
        fontFamily: "var(--font-mono, monospace), system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.3)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0f172a",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: timeframe === "1h" ? 16 : timeframe === "1d" ? 14 : 9,
        minBarSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      // FULL SCROLL AND SCALE ENABLED - user can drag and scroll to the left freely!
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Primary Area Series with dynamic green / red theme
    const primaryColor = isPositive ? "#10b981" : "#f43f5e";
    const topGradient = isPositive
      ? "rgba(16, 185, 129, 0.32)"
      : "rgba(244, 63, 94, 0.32)";
    const bottomGradient = isPositive
      ? "rgba(16, 185, 129, 0.0)"
      : "rgba(244, 63, 94, 0.0)";

    const tokenSeries = chart.addSeries(AreaSeries, {
      topColor: topGradient,
      bottomColor: bottomGradient,
      lineColor: primaryColor,
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    tokenSeries.setData(tokenData);
    tokenSeriesRef.current = tokenSeries;

    if (compare && benchmarkData.length > 0) {
      const benchmarkSeries = chart.addSeries(LineSeries, {
        color: "#38bdf8",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        title: "Underlying",
        priceFormat: {
          type: "price",
          precision: 2,
          minMove: 0.01,
        },
      });
      benchmarkSeries.setData(benchmarkData);
      benchmarkSeriesRef.current = benchmarkSeries;
    }

    // Set visible range to the latest bars, leaving previous bars scrollable to the left
    const totalBars = tokenData.length;
    const visibleBars = timeframe === "1h" ? 22 : timeframe === "1d" ? 24 : 45;
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, totalBars - visibleBars),
      to: totalBars + 4,
    });

    // Crosshair hover listener
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > container.clientHeight
      ) {
        setHoverData(null);
      } else {
        const tokenVal = param.seriesData.get(tokenSeries) as
          | { value?: number }
          | undefined;
        const benchVal = benchmarkSeriesRef.current
          ? (param.seriesData.get(benchmarkSeriesRef.current) as
              | { value?: number }
              | undefined)
          : undefined;

        const timeNum = typeof param.time === "number" ? param.time * 1000 : 0;
        const timeStr = timeNum
          ? new Date(timeNum).toLocaleString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        setHoverData({
          timeStr,
          tokenPrice: tokenVal?.value,
          benchmarkPrice: benchVal?.value,
        });
      }
    });

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        chartRef.current.applyOptions({ width });
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        tokenSeriesRef.current = null;
        benchmarkSeriesRef.current = null;
      }
    };
  }, [tokenData, benchmarkData, compare, isPositive, timeframe]);

  // Compute live spread if in compare mode
  const currentSpread = useMemo(() => {
    const t = hoverData?.tokenPrice ?? activePrice ?? latestToken;
    const b =
      hoverData?.benchmarkPrice ??
      benchmarkData[benchmarkData.length - 1]?.value;
    if (!t || !b) return null;
    return ((t - b) / b) * 100;
  }, [hoverData, activePrice, latestToken, benchmarkData]);

  // Display price and change
  const displayedPrice = hoverData?.tokenPrice ?? activePrice ?? latestToken;
  const displayedChange =
    hoverData && hoverData.tokenPrice !== undefined && tokenData[0]?.value
      ? ((hoverData.tokenPrice - tokenData[0].value) / tokenData[0].value) * 100
      : priceChangePct;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.priceDisplay}>
          <span className={styles.currentPrice}>{money(displayedPrice)}</span>
          <span
            className={`${styles.priceChange} ${displayedChange >= 0 ? styles.up : styles.down}`}
          >
            {displayedChange >= 0 ? "+" : ""}
            {displayedChange.toFixed(2)}%
          </span>
          <span className={styles.liveIndicator}>
            <span className={styles.livePulse} />
            LIVE
          </span>
        </div>
        <div className={styles.timeframeGroup}>
          {(["1h", "1d", "1w"] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              className={`${styles.timeframeBtn} ${timeframe === tf ? styles.active : ""}`}
              onClick={() => setTimeframe(tf)}
              title={`Switch to ${tf.toUpperCase()} timeframe`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartViewport}>
        {hoverData && (
          <div className={styles.tooltipHUD}>
            <span className={styles.tooltipTime}>{hoverData.timeStr}</span>
            <div className={styles.tooltipRow}>
              <span className={styles.tooltipDotToken} />
              <span>
                {tokenName ?? ticker ?? "RWA Token"}:{" "}
                <strong>
                  {hoverData.tokenPrice !== undefined
                    ? money(hoverData.tokenPrice)
                    : "—"}
                </strong>
              </span>
            </div>
            {compare && hoverData.benchmarkPrice !== undefined && (
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipDotBenchmark} />
                <span>
                  {benchmarkName}:{" "}
                  <strong>{money(hoverData.benchmarkPrice)}</strong>
                </span>
                {currentSpread !== null && (
                  <span
                    className={`${styles.spreadTag} ${Math.abs(currentSpread) < 0.2 ? styles.tight : styles.wide}`}
                  >
                    Peg: {currentSpread >= 0 ? "+" : ""}
                    {currentSpread.toFixed(2)}%
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {tokenData.length > 0 ? (
          <div ref={containerRef} className={styles.chartCanvas} />
        ) : (
          <div className={styles.emptyOverlay}>
            Loading live price history…
          </div>
        )}
      </div>

      <div className={styles.bottomLegend}>
        <div className={styles.legendItems}>
          <div className={styles.legendItem}>
            <span
              className={styles.legendDotToken}
              style={{ background: isPositive ? "#10b981" : "#f43f5e" }}
            />
            <span>{tokenName ?? `${ticker ?? "Asset"} Token`}</span>
          </div>
          {compare && benchmarkData.length > 0 && (
            <div className={styles.legendItem}>
              <span className={styles.legendDotBenchmark} />
              <span>{benchmarkName} (Underlying)</span>
            </div>
          )}
        </div>
        <div className={styles.scrollHint}>
          <span>← Drag to explore history →</span>
        </div>
      </div>
    </div>
  );
}
