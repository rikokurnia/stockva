"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  LineStyle,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { money } from "../lib/city";
import { movingAverage, observedSeries } from "../lib/asset-research";
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
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const [range, setRange] = useState<"1d" | "1w" | "1m" | "1y" | "all">("all");
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

  const last = Math.max(
    token.at(-1)?.time ?? 0,
    benchmark.at(-1)?.time ?? 0,
    Date.now(),
  );

  const cutoff = useMemo(() => {
    if (range === "1d") return last - 86400000;
    if (range === "1w") return last - 7 * 86400000;
    if (range === "1m") return last - 30 * 86400000;
    if (range === "1y") return last - 365 * 86400000;
    return 0; // "all"
  }, [range, last]);

  const primaryView = useMemo(() => {
    const list = primary.filter((point) => point.time >= cutoff);
    if (
      livePrice &&
      Number.isFinite(livePrice) &&
      livePrice > 0 &&
      (range === "1d" || range === "all")
    ) {
      const now = Date.now();
      const lastPoint = list.at(-1);
      if (!lastPoint || now - lastPoint.time > 1000) {
        return [...list, { time: now, value: livePrice }];
      }
    }
    return list;
  }, [primary, cutoff, livePrice, range]);

  useEffect(() => {
    setHover("");
    if (!element.current || !primaryView.length) return;

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
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#233b4b",
        timeVisible: true,
        secondsVisible: false,
        minBarSpacing: 0.5,
        fixLeftEdge: false,
        fixRightEdge: false,
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

    const line = chart.addSeries(LineSeries, {
      color: actualSource === "Token" ? "#38bdf8" : "#10b981",
      lineWidth: 2,
      priceLineVisible: true,
      title: actualSource,
    });
    lineRef.current = line;

    const data = (points: { time: number; value: number }[]) => {
      const map = new Map<number, number>();
      for (const p of points) {
        const sec = Math.floor(p.time / 1000);
        map.set(sec, p.value);
      }
      return [...map.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([time, value]) => ({
          time: time as UTCTimestamp,
          value,
        }));
    };

    line.setData(data(primaryView));

    if (compare && token.length && benchmark.length) {
      const reference = chart.addSeries(LineSeries, {
        color: "#f0b90b",
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
        color: "#a78bfa",
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

    return () => {
      lineRef.current = null;
      chart.remove();
    };
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

  // Realtime update when live price tick arrives
  useEffect(() => {
    if (
      !lineRef.current ||
      !livePrice ||
      livePrice <= 0 ||
      !Number.isFinite(livePrice)
    )
      return;
    try {
      const sec = Math.floor(Date.now() / 1000) as UTCTimestamp;
      lineRef.current.update({
        time: sec,
        value: livePrice,
      });
    } catch {
      // Ignore if historical timestamps exceed current client clock
    }
  }, [livePrice]);

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
            aria-pressed={range === "1d"}
            onClick={() => setRange("1d")}
            title="Last 24 Hours"
          >
            1D
          </button>
          <button
            aria-pressed={range === "1w"}
            onClick={() => setRange("1w")}
            title="Last 7 Days"
          >
            1W
          </button>
          <button
            aria-pressed={range === "1m"}
            onClick={() => setRange("1m")}
            title="Last 30 Days"
          >
            1M
          </button>
          <button
            aria-pressed={range === "1y"}
            onClick={() => setRange("1y")}
            title="Last 1 Year"
          >
            1Y
          </button>
          <button
            aria-pressed={range === "all"}
            onClick={() => setRange("all")}
            title="All Historical Data (Pan & Zoom available)"
          >
            ALL
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
          `${primaryView.length} price points · Drag/scroll to pan & zoom history`}
      </p>
      {primaryView.length ? (
        <div
          ref={element}
          className={styles.chart}
          role="img"
          aria-label={`${actualSource} price history chart. Exact observations are available in the table below.`}
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
              background: actualSource === "Token" ? "#38bdf8" : "#10b981",
            }}
          />
          {actualSource === "Token"
            ? history.tokenSource
            : history.benchmarkSource}
        </span>
        {compare && token.length > 0 && benchmark.length > 0 && (
          <span>
            <i className={styles.reference} style={{ background: "#f0b90b" }} />
            {history.benchmarkSource}
          </span>
        )}
        {average && !compare && (
          <span>
            <i className={styles.average} style={{ background: "#a78bfa" }} />
            20-close moving average
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
    </>
  );
}
