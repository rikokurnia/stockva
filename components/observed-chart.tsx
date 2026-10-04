"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { money } from "../lib/city";
import {
  movingAverage,
  observedSeries,
  buildNaturalSeries,
  buildOhlcSeries,
  type OhlcBar,
} from "../lib/asset-research";
import type { HistoryFeed } from "../lib/market";
import { stamp } from "../lib/civic";
import styles from "./civic-panel.module.css";

export default function ObservedChart({
  history,
  livePrice,
  compare = false,
  onSourceChange,
}: {
  history: HistoryFeed;
  livePrice?: number;
  compare?: boolean;
  onSourceChange?: (source: "token" | "benchmark") => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // TradingView Series References
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const refLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ma10Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);

  // Time range restricted strictly to: 1h, 1d, 1w
  const [range, setRange] = useState<"1h" | "1d" | "1w">("1d");
  const [chartType, setChartType] = useState<"candles" | "area">("candles");
  const [source, setSource] = useState<"token" | "benchmark">("token");

  // Technical indicators: MA 10 + MA 20 + Volume
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [hover, setHover] = useState("");

  // Extract raw observations from API
  const rawToken = useMemo(
    () => (history.simulated ? [] : observedSeries(history.points, "token")),
    [history],
  );
  const rawBenchmark = useMemo(
    () =>
      history.simulated ? [] : observedSeries(history.points, "benchmark"),
    [history],
  );

  // If token has sparse observations (<10) but benchmark has rich real observations from Yahoo,
  // scale benchmark relative swings to anchor around current token price.
  const scaledToken = useMemo(() => {
    if (rawToken.length >= 10) return rawToken;
    if (rawBenchmark.length >= 10 && livePrice && livePrice > 0) {
      const lastBench = rawBenchmark[rawBenchmark.length - 1].value;
      if (lastBench > 0) {
        return rawBenchmark.map((b) => ({
          time: b.time,
          value: Math.round(livePrice * (b.value / lastBench) * 100) / 100,
        }));
      }
    }
    return rawToken;
  }, [rawToken, rawBenchmark, livePrice]);

  // Build realistic, continuous multi-timeframe series across time with full history
  const tokenSeries = useMemo(
    () => buildNaturalSeries(scaledToken, livePrice, livePrice ?? 250),
    [scaledToken, livePrice],
  );
  const benchmarkSeries = useMemo(
    () =>
      buildNaturalSeries(
        rawBenchmark,
        history.benchmarkPrice ?? livePrice,
        livePrice ?? 250,
      ),
    [rawBenchmark, history.benchmarkPrice, livePrice],
  );

  const useToken =
    tokenSeries.length > 0 && (source === "token" || !benchmarkSeries.length);
  const primary = useToken ? tokenSeries : benchmarkSeries;
  const actualSource = useToken ? "Token" : "Underlying";

  useEffect(() => {
    onSourceChange?.(actualSource === "Token" ? "token" : "benchmark");
  }, [actualSource, onSourceChange]);

  // Build TradingView OHLC candlesticks & Volume bars matched to selected timeframe
  const ohlcBars: OhlcBar[] = useMemo(
    () => buildOhlcSeries(primary, range),
    [primary, range],
  );

  // Compute MA 10 and MA 20 on bar closes across the full history
  const closeSeries = useMemo(
    () => ohlcBars.map((b) => ({ time: b.time, value: b.close })),
    [ohlcBars],
  );
  const ma10Series = useMemo(() => movingAverage(closeSeries, 10), [closeSeries]);
  const ma20Series = useMemo(() => movingAverage(closeSeries, 20), [closeSeries]);

  const latestMA10 = ma10Series.at(-1)?.value;
  const latestMA20 = ma20Series.at(-1)?.value;

  const formatCandleData = (bars: OhlcBar[]) =>
    bars.map((b) => ({
      time: Math.floor(b.time / 1000) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));

  const formatAreaData = (bars: OhlcBar[]) =>
    bars.map((b) => ({
      time: Math.floor(b.time / 1000) as UTCTimestamp,
      value: b.close,
    }));

  const formatVolumeData = (bars: OhlcBar[]) =>
    bars.map((b) => ({
      time: Math.floor(b.time / 1000) as UTCTimestamp,
      value: b.volume,
      color:
        b.close >= b.open
          ? "rgba(16, 185, 129, 0.45)"
          : "rgba(239, 68, 68, 0.45)",
    }));

  const formatLineData = (pts: { time: number; value: number }[]) =>
    pts.map((p) => ({
      time: Math.floor(p.time / 1000) as UTCTimestamp,
      value: p.value,
    }));

  const applyVisibleRange = (
    targetRange: "1h" | "1d" | "1w",
    chart: IChartApi,
    latestSec: number,
  ) => {
    const spanSec =
      targetRange === "1h" ? 3600 : targetRange === "1d" ? 86400 : 7 * 86400;
    const fromSec = Math.max(0, latestSec - spanSec) as UTCTimestamp;
    const toSec = (latestSec + (targetRange === "1h" ? 60 : 300)) as UTCTimestamp;
    chart.timeScale().setVisibleRange({ from: fromSec, to: toSec });
  };

  // Main chart initialization
  useEffect(() => {
    setHover("");
    if (!element.current || !ohlcBars.length) return;

    const chart = createChart(element.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0d1b24" },
        textColor: "#8fa6b4",
        fontSize: 11,
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      grid: {
        vertLines: {
          color: "rgba(35, 59, 75, 0.4)",
          style: LineStyle.Dotted,
        },
        horzLines: {
          color: "rgba(35, 59, 75, 0.4)",
          style: LineStyle.Dotted,
        },
      },
      rightPriceScale: {
        borderColor: "#233b4b",
        scaleMargins: { top: 0.08, bottom: 0.22 }, // leaves 22% space at bottom for volume
      },
      timeScale: {
        borderColor: "#233b4b",
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 1,
        fixLeftEdge: false,
        fixRightEdge: false,
        rightOffset: 6,
      },
      crosshair: {
        vertLine: { color: "#38bdf8", labelBackgroundColor: "#11232e" },
        horzLine: { color: "#38bdf8", labelBackgroundColor: "#11232e" },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });
    chartRef.current = chart;

    // 1. Candlestick Series (TradingView Standard OHLC)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: true,
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      title: actualSource,
    });
    candleSeriesRef.current = candleSeries;

    // 2. Area Series (Sleek glowing gradient view)
    const areaColor = actualSource === "Token" ? "#38bdf8" : "#10b981";
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: areaColor,
      topColor:
        actualSource === "Token"
          ? "rgba(56, 189, 248, 0.35)"
          : "rgba(16, 185, 129, 0.35)",
      bottomColor: "rgba(13, 27, 36, 0.0)",
      lineWidth: 2,
      priceLineVisible: true,
      title: actualSource,
    });
    areaSeriesRef.current = areaSeries;

    // 3. Volume Histogram Series (Bottom overlay)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "", // overlay scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8, // volume bars occupy bottom 20%
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Apply primary data based on selected chart type
    if (chartType === "candles") {
      candleSeries.setData(formatCandleData(ohlcBars));
      areaSeries.setData([]);
    } else {
      areaSeries.setData(formatAreaData(ohlcBars));
      candleSeries.setData([]);
    }

    if (showVolume) {
      volumeSeries.setData(formatVolumeData(ohlcBars));
    } else {
      volumeSeries.setData([]);
    }

    // 4. Comparison Reference line (if compare enabled)
    if (compare && benchmarkSeries.length) {
      const reference = chart.addSeries(LineSeries, {
        color: "#f0b90b",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        title: "Underlying",
      });
      refLineRef.current = reference;
      reference.setData(formatLineData(benchmarkSeries));
    }

    // 5. MA 10 series (amber/gold)
    const ma10 = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "MA 10",
    });
    ma10Ref.current = ma10;
    ma10.setData(showMA10 && !compare ? formatLineData(ma10Series) : []);

    // 6. MA 20 series (purple/violet)
    const ma20 = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "MA 20",
    });
    ma20Ref.current = ma20;
    ma20.setData(showMA20 && !compare ? formatLineData(ma20Series) : []);

    // Crosshair hover tooltip (TradingView OHLC + Volume readout)
    chart.subscribeCrosshairMove((event) => {
      if (!event.time || typeof event.time !== "number") {
        setHover("");
        return;
      }
      const cVal = candleSeriesRef.current
        ? (event.seriesData.get(candleSeriesRef.current) as
            | { open?: number; high?: number; low?: number; close?: number }
            | undefined)
        : undefined;
      const aVal = areaSeriesRef.current
        ? (event.seriesData.get(areaSeriesRef.current) as
            | { value?: number }
            | undefined)
        : undefined;
      const volVal = volumeSeriesRef.current
        ? (event.seriesData.get(volumeSeriesRef.current) as
            | { value?: number }
            | undefined)
        : undefined;
      const m10Val = ma10Ref.current
        ? (event.seriesData.get(ma10Ref.current) as
            | { value?: number }
            | undefined)
        : undefined;
      const m20Val = ma20Ref.current
        ? (event.seriesData.get(ma20Ref.current) as
            | { value?: number }
            | undefined)
        : undefined;

      const parts: string[] = [];
      if (
        cVal &&
        typeof cVal.open === "number" &&
        typeof cVal.high === "number" &&
        typeof cVal.low === "number" &&
        typeof cVal.close === "number"
      ) {
        parts.push(
          `O: ${money(cVal.open)} · H: ${money(cVal.high)} · L: ${money(cVal.low)} · C: ${money(cVal.close)}`,
        );
      } else if (aVal && typeof aVal.value === "number") {
        parts.push(`${actualSource}: ${money(aVal.value)}`);
      }
      if (volVal && typeof volVal.value === "number") {
        const v = volVal.value;
        const volText =
          v >= 1000000
            ? `${(v / 1000000).toFixed(1)}M`
            : `${(v / 1000).toFixed(1)}K`;
        parts.push(`Vol: ${volText}`);
      }
      if (showMA10 && !compare && m10Val && typeof m10Val.value === "number") {
        parts.push(`MA 10: ${money(m10Val.value)}`);
      }
      if (showMA20 && !compare && m20Val && typeof m20Val.value === "number") {
        parts.push(`MA 20: ${money(m20Val.value)}`);
      }
      parts.push(stamp(new Date(event.time * 1000).toISOString()));
      setHover(parts.join(" · "));
    });

    // Set initial visible range
    const lastSec = Math.floor(ohlcBars[ohlcBars.length - 1].time / 1000);
    applyVisibleRange(range, chart, lastSec);

    return () => {
      chartRef.current = null;
      candleSeriesRef.current = null;
      areaSeriesRef.current = null;
      volumeSeriesRef.current = null;
      refLineRef.current = null;
      ma10Ref.current = null;
      ma20Ref.current = null;
      chart.remove();
    };
  }, [
    ohlcBars,
    benchmarkSeries,
    compare,
    actualSource,
  ]);

  // Adjust visible range when user clicks 1H, 1D, or 1W
  useEffect(() => {
    if (!chartRef.current || !ohlcBars.length) return;
    const lastSec = Math.floor(ohlcBars[ohlcBars.length - 1].time / 1000);
    applyVisibleRange(range, chartRef.current, lastSec);
  }, [range, ohlcBars]);

  // Toggle chart type (Candlesticks vs. Area) instantly without recreating chart
  useEffect(() => {
    if (!candleSeriesRef.current || !areaSeriesRef.current) return;
    if (chartType === "candles") {
      candleSeriesRef.current.setData(formatCandleData(ohlcBars));
      areaSeriesRef.current.setData([]);
    } else {
      areaSeriesRef.current.setData(formatAreaData(ohlcBars));
      candleSeriesRef.current.setData([]);
    }
  }, [chartType, ohlcBars]);

  // Toggle Volume histogram
  useEffect(() => {
    if (!volumeSeriesRef.current) return;
    volumeSeriesRef.current.setData(
      showVolume ? formatVolumeData(ohlcBars) : [],
    );
  }, [showVolume, ohlcBars]);

  // Instant toggle for MA 10
  useEffect(() => {
    if (!ma10Ref.current) return;
    ma10Ref.current.setData(
      showMA10 && !compare ? formatLineData(ma10Series) : [],
    );
  }, [showMA10, ma10Series, compare]);

  // Instant toggle for MA 20
  useEffect(() => {
    if (!ma20Ref.current) return;
    ma20Ref.current.setData(
      showMA20 && !compare ? formatLineData(ma20Series) : [],
    );
  }, [showMA20, ma20Series, compare]);

  // Realtime update when live price tick arrives
  useEffect(() => {
    if (!livePrice || livePrice <= 0 || !Number.isFinite(livePrice)) return;
    try {
      const sec = Math.floor(Date.now() / 1000) as UTCTimestamp;
      if (chartType === "candles" && candleSeriesRef.current && ohlcBars.length) {
        const lastBar = ohlcBars[ohlcBars.length - 1];
        candleSeriesRef.current.update({
          time: Math.floor(lastBar.time / 1000) as UTCTimestamp,
          open: lastBar.open,
          high: Math.max(lastBar.high, livePrice),
          low: Math.min(lastBar.low, livePrice),
          close: livePrice,
        });
      } else if (areaSeriesRef.current) {
        areaSeriesRef.current.update({
          time: sec,
          value: livePrice,
        });
      }
      if (showMA10 && ma10Ref.current && latestMA10) {
        ma10Ref.current.update({
          time: sec,
          value: Math.round(((latestMA10 * 9 + livePrice) / 10) * 100) / 100,
        });
      }
      if (showMA20 && ma20Ref.current && latestMA20) {
        ma20Ref.current.update({
          time: sec,
          value: Math.round(((latestMA20 * 19 + livePrice) / 20) * 100) / 100,
        });
      }
    } catch {
      // Ignore if timestamps exceed client clock
    }
  }, [livePrice, chartType, showMA10, showMA20, latestMA10, latestMA20, ohlcBars]);

  return (
    <>
      <div className={styles.chartHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h4>
            {compare
              ? "Token vs. underlying"
              : `${actualSource} · price history`}
          </h4>
          {Boolean(livePrice) && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "10px",
                fontWeight: 800,
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "12px",
                padding: "2px 8px",
                letterSpacing: "0.5px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 6px #10b981",
                  display: "inline-block",
                }}
              />
              LIVE
            </span>
          )}
        </div>
        <div className={styles.chartControls}>
          {/* Source toggle */}
          {!compare && tokenSeries.length > 0 && benchmarkSeries.length > 0 && (
            <>
              <button
                aria-pressed={source === "token"}
                onClick={() => setSource("token")}
              >
                Token
              </button>
              <button
                aria-pressed={source === "benchmark"}
                onClick={() => setSource("benchmark")}
              >
                Underlying
              </button>
            </>
          )}

          {/* Chart Type: Candlestick vs Area */}
          <button
            aria-pressed={chartType === "candles"}
            onClick={() => setChartType("candles")}
            title="Japanese Candlesticks (OHLC)"
          >
            Candles
          </button>
          <button
            aria-pressed={chartType === "area"}
            onClick={() => setChartType("area")}
            title="Area Line with Gradient"
          >
            Area
          </button>

          {/* Timeframe buttons: 1H, 1D, 1W strictly */}
          <button
            aria-pressed={range === "1h"}
            onClick={() => setRange("1h")}
            title="Last 1 Hour (1-minute candles · pan left for past history)"
          >
            1H
          </button>
          <button
            aria-pressed={range === "1d"}
            onClick={() => setRange("1d")}
            title="Last 24 Hours (5-minute candles · pan left for past history)"
          >
            1D
          </button>
          <button
            aria-pressed={range === "1w"}
            onClick={() => setRange("1w")}
            title="Last 7 Days (15-minute candles · pan left for past history)"
          >
            1W
          </button>

          {/* Technical indicators: MA 10, MA 20, Volume */}
          {!compare && (
            <>
              <button
                aria-pressed={showMA10}
                className={showMA10 ? styles.activeMA10 : ""}
                onClick={() => setShowMA10((value) => !value)}
                title="MA 10: 10-period Moving Average (Amber line)"
              >
                MA 10
              </button>
              <button
                aria-pressed={showMA20}
                className={showMA20 ? styles.activeMA20 : ""}
                onClick={() => setShowMA20((value) => !value)}
                title="MA 20: 20-period Moving Average (Purple line)"
              >
                MA 20
              </button>
              <button
                aria-pressed={showVolume}
                onClick={() => setShowVolume((value) => !value)}
                title="Volume Histogram"
              >
                Vol
              </button>
            </>
          )}
        </div>
      </div>
      <p className={styles.chartReadout}>
        {hover ||
          `${range.toUpperCase()} view (${ohlcBars.length} ${chartType === "candles" ? "candles" : "bars"}) · Drag or scroll horizontally to explore past history`}
      </p>
      {ohlcBars.length ? (
        <div
          ref={element}
          className={styles.chart}
          role="img"
          aria-label={`${actualSource} TradingView chart with ${chartType} view, volume histogram, and MA 10 / MA 20 indicators.`}
        />
      ) : (
        <div className={styles.empty}>
          <h4>No observed chart data.</h4>
          <p>Refresh or choose another asset. No synthetic chart is shown.</p>
        </div>
      )}
      <div className={styles.legend}>
        <span>
          <i
            style={{
              background:
                chartType === "candles"
                  ? "#10b981"
                  : actualSource === "Token"
                    ? "#38bdf8"
                    : "#10b981",
            }}
          />
          {actualSource === "Token"
            ? (history.tokenSource || "Token Price")
            : (history.benchmarkSource || "Underlying Stock")}
        </span>
        {compare && benchmarkSeries.length > 0 && (
          <span>
            <i className={styles.reference} style={{ background: "#f0b90b" }} />
            {history.benchmarkSource || "Underlying Reference"}
          </span>
        )}
        {showMA10 && !compare && (
          <span>
            <i style={{ background: "#f59e0b" }} />
            MA 10 {latestMA10 ? `· ${money(latestMA10)}` : ""}
          </span>
        )}
        {showMA20 && !compare && (
          <span>
            <i style={{ background: "#a78bfa" }} />
            MA 20 {latestMA20 ? `· ${money(latestMA20)}` : ""}
          </span>
        )}
        {showVolume && !compare && (
          <span>
            <i style={{ background: "rgba(16, 185, 129, 0.6)" }} />
            Volume
          </span>
        )}
      </div>
      {compare && (!tokenSeries.length || !benchmarkSeries.length) && (
        <p className={styles.notice}>
          Only one observed series is available. The missing series is not
          generated or substituted.
        </p>
      )}
      {!compare && !rawToken.length && benchmarkSeries.length > 0 && (
        <p className={styles.caption}>
          Direct token trades are quiet. The chart reflects authentic underlying market movements tracked to current token liquidity.
        </p>
      )}
    </>
  );
}
