"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";
import { money } from "../lib/city";
import { movingAverage, observedSeries } from "../lib/asset-research";
import type { HistoryFeed } from "../lib/market";
import { stamp } from "../lib/civic";
import styles from "./civic-panel.module.css";

export default function ObservedChart({
  history,
  compare = false,
  onSourceChange,
}: {
  history: HistoryFeed;
  compare?: boolean;
  onSourceChange?: (source: "token" | "benchmark") => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<"day" | "all">("all");
  const [source, setSource] = useState<"token" | "benchmark">("token");
  const [average, setAverage] = useState(false);
  const [hover, setHover] = useState("");
  const token = useMemo(
    () => (history.simulated ? [] : observedSeries(history.points, "token")),
    [history],
  );
  const benchmark = useMemo(
    () =>
      history.simulated ? [] : observedSeries(history.points, "benchmark"),
    [history],
  );
  const useToken =
    token.length > 0 && (source === "token" || !benchmark.length);
  const primary = useToken ? token : benchmark;
  const actualSource = useToken ? "Token" : "Underlying";
  useEffect(() => {
    onSourceChange?.(actualSource === "Token" ? "token" : "benchmark");
  }, [actualSource, onSourceChange]);
  const last = Math.max(token.at(-1)?.time ?? 0, benchmark.at(-1)?.time ?? 0);
  const cutoff = range === "day" ? last - 86400000 : 0;
  const primaryView = useMemo(
    () => primary.filter((point) => point.time >= cutoff),
    [primary, cutoff],
  );
  useEffect(() => {
    setHover("");
    if (!element.current || !primaryView.length) return;
    const chart = createChart(element.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#fffaf0" },
        textColor: "#716649",
        fontSize: 12,
        fontFamily: "Arial, sans-serif",
      },
      grid: { vertLines: { visible: false }, horzLines: { color: "#e8dbc1" } },
      rightPriceScale: { borderColor: "#ddccaa" },
      timeScale: { borderColor: "#ddccaa", timeVisible: true },
      crosshair: {
        vertLine: { color: "#b59e74", labelBackgroundColor: "#52683a" },
        horzLine: { color: "#b59e74", labelBackgroundColor: "#52683a" },
      },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: false,
        pinch: true,
        axisPressedMouseMove: true,
      },
    });
    const line = chart.addSeries(LineSeries, {
      color: "#52683a",
      lineWidth: 2,
      priceLineVisible: false,
      title: actualSource,
    });
    const data = (points: { time: number; value: number }[]) =>
      points.map((point) => ({
        time: Math.floor(point.time / 1000) as UTCTimestamp,
        value: point.value,
      }));
    line.setData(data(primaryView));
    if (compare && token.length && benchmark.length) {
      const reference = chart.addSeries(LineSeries, {
        color: "#82642d",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        title: "Underlying",
      });
      reference.setData(
        data(benchmark.filter((point) => point.time >= cutoff)),
      );
    }
    if (average && !compare) {
      const ma = chart.addSeries(LineSeries, {
        color: "#8c7354",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ma.setData(
        data(
          movingAverage(primary, 20).filter((point) => point.time >= cutoff),
        ),
      );
    }
    chart.subscribeCrosshairMove((event) => {
      const point = event.seriesData.get(line);
      setHover(
        point && "value" in point && typeof event.time === "number"
          ? `${actualSource} ${money(point.value)} · ${stamp(new Date(event.time * 1000).toISOString())}`
          : "",
      );
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [
    primaryView,
    primary,
    token,
    benchmark,
    compare,
    average,
    cutoff,
    actualSource,
  ]);
  return (
    <>
      <div className={styles.chartHeader}>
        <h4>
          {compare ? "Token vs. underlying" : `${actualSource} · hourly closes`}
        </h4>
        <div className={styles.chartControls}>
          {!compare && token.length > 0 && benchmark.length > 0 && (
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
          <button
            aria-pressed={range === "day"}
            onClick={() => setRange("day")}
          >
            Latest 24h
          </button>
          <button
            aria-pressed={range === "all"}
            onClick={() => setRange("all")}
          >
            All data
          </button>
          {!compare && (
            <button
              aria-pressed={average}
              onClick={() => setAverage((value) => !value)}
            >
              SMA 20
            </button>
          )}
        </div>
      </div>
      <p className={styles.chartReadout}>
        {hover ||
          `${primaryView.length} observed closes · ${primaryView.length ? `${stamp(new Date(primaryView[0].time).toISOString())} — ${stamp(new Date(primaryView.at(-1)!.time).toISOString())}` : "No closes in this range"}`}
      </p>
      {primaryView.length ? (
        <div
          ref={element}
          className={styles.chart}
          role="img"
          aria-label={`${actualSource} hourly price chart. Exact observations are available in the table below.`}
        />
      ) : (
        <div className={styles.empty}>
          <h4>No observed chart data.</h4>
          <p>Refresh or choose another asset. No synthetic chart is shown.</p>
        </div>
      )}
      <div className={styles.legend}>
        <span>
          <i />
          {actualSource === "Token"
            ? history.tokenSource
            : history.benchmarkSource}
        </span>
        {compare && token.length > 0 && benchmark.length > 0 && (
          <span>
            <i className={styles.reference} />
            {history.benchmarkSource}
          </span>
        )}
        {average && !compare && (
          <span>
            <i className={styles.average} />
            20-close simple average
          </span>
        )}
      </div>
      {compare && (!token.length || !benchmark.length) && (
        <p className={styles.notice}>
          Only one observed series is available. The missing series is not
          generated or substituted.
        </p>
      )}
      {!compare && !token.length && benchmark.length > 0 && (
        <p className={styles.caption}>
          Token history unavailable. This chart shows the actual underlying
          stock reference, not a token price.
        </p>
      )}
      <details className={styles.details}>
        <summary>
          <span>Recent price observations</span>
          <span>{Math.min(10, primary.length)} closes</span>
        </summary>
        <div className={styles.detailsBody}>
          {primary
            .slice(-10)
            .reverse()
            .map((point) => (
              <div className={styles.simpleRow} key={point.time}>
                <span>{stamp(new Date(point.time).toISOString())}</span>
                <strong>{money(point.value)}</strong>
              </div>
            ))}
        </div>
      </details>
      <p className={styles.caption}>
        Drag to explore, pinch to zoom. Range controls filter returned
        observations; missing hours are not filled. Charts by{" "}
        <a
          className={styles.textLink}
          href="https://www.tradingview.com/lightweight-charts/"
          target="_blank"
          rel="noreferrer"
        >
          TradingView
        </a>
        .
      </p>
    </>
  );
}
