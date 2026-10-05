"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  assets,
  defFor,
  money,
  priceOf,
  type CityState,
  type PriceMap,
} from "../lib/city";
import type { MarketFeed } from "../lib/market";
import { portfolioLandscape } from "../lib/agent-hall";
import type { HallAnalysis } from "../lib/advisor";
import type { RebalancePlan } from "../lib/rebalance";
import type { RebalanceExecution } from "../lib/rebalance-execution";
import AgentRebalance from "./agent-rebalance";
import styles from "./agent-hall.module.css";

type Props = {
  city: CityState;
  prices: PriceMap;
  feed: MarketFeed;
  walletConnected: boolean;
  walletAddress: string | null;
  execution: RebalanceExecution | null;
  onExecute: (plan: RebalancePlan) => Promise<void>;
  onConnectWallet: () => Promise<void>;
  onWatchCity: () => void;
  onClearExecution: () => void;
  onClose: () => void;
  onMarket: (ticker: string) => void;
};
const colors = [
  "#657b4a",
  "#c1974b",
  "#638d8b",
  "#b8775c",
  "#8d80a3",
  "#a6ae79",
];
export default function AgentHall({
  city,
  prices,
  feed,
  walletConnected,
  walletAddress,
  execution,
  onExecute,
  onConnectWallet,
  onWatchCity,
  onClearExecution,
  onClose,
  onMarket,
}: Props) {
  const [tab, setTab] = useState("Rebalance");
  const [selected, setSelected] = useState<string | null>(null);
  const [goal, setGoal] = useState(
    "Review my concentration and explain one practical next step.",
  );
  const [report, setReport] = useState<{
    text: string;
    context: string;
    key: string;
    time: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingContext, setPendingContext] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement;
    dialog.current?.focus();
    return () => {
      mounted.current = false;
      request.current?.abort();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [tab]);
  const { holdings, total, basis, sectors, concentration } = useMemo(() => {
    const positions = city.buildings.flatMap((b) => {
      const ticker = defFor(b.kind).ticker;
      if (!ticker) return [];
      return [
        {
          ticker,
          units: b.quantity,
          basis: b.quantity * b.entry,
          price: priceOf(ticker, prices),
          sector: assets.find((a) => a.ticker === ticker)?.sector ?? "Other",
          locked: b.locked,
        },
      ];
    });
    for (const p of city.paper ?? [])
      positions.push({
        ticker: p.ticker,
        units: p.quantity,
        basis: p.cost,
        price: priceOf(p.ticker, prices),
        sector: assets.find((a) => a.ticker === p.ticker)?.sector ?? "Other",
        locked: false,
      });
    return portfolioLandscape(positions);
  }, [city, prices]);
  const focus = holdings.find((h) => h.ticker === selected);
  const analysis: HallAnalysis = { mode: "overview" };
  const analysisKey = JSON.stringify([tab, goal]);
  const contextLabel = "Portfolio overview";
  let cursor = 0;
  const segments = holdings
    .map((h, i) => {
      const start = cursor;
      cursor += total ? (h.value / total) * 100 : 0;
      return `${colors[i % colors.length]} ${start}% ${cursor}%`;
    })
    .join(",");
  async function analyze() {
    if (busy || !goal.trim()) return;
    setBusy(true);
    setPendingContext(contextLabel);
    setError("");
    setReport(null);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: goal.trim(),
          hallAnalysis: analysis,
          snapshot: {
            cash: city.cash,
            totalValue: total,
            walletConnected,
            holdings: holdings.map((h) => ({
              ...h,
              price: priceOf(h.ticker, prices),
              entry: h.units ? h.basis / h.units : 0,
              returnPct: h.basis ? (h.value / h.basis - 1) * 100 : 0,
            })),
            marketNote:
              "Local city holdings, not verified wallet balances. Quotes may include illustrative fallbacks. No trades executed.",
          },
        }),
      });
      const result = await response.json();
      if (!mounted.current) return;
      if (
        !response.ok ||
        typeof result.reply !== "string" ||
        !result.reply.trim()
      )
        throw new Error(
          "Cokoo is unavailable right now. Your calculations still work; try the review again.",
        );
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setReport({
        text: result.reply,
        context: contextLabel,
        key: analysisKey,
        time,
      });
      setEvents((e) =>
        [`${time} · ${contextLabel} review completed`, ...e].slice(0, 5),
      );
    } catch (e) {
      if (!mounted.current) return;
      setError(
        controller.signal.aborted
          ? "The review timed out. Please try again."
          : "Cokoo couldn’t finish this review. Check your connection and try again; your calculations still work.",
      );
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className={styles.hall}
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-hall-title"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = Array.from(
              dialog.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
              ) ?? [],
            ).filter((node) => node.getClientRects().length > 0);
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === dialog.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (
              !e.shiftKey &&
              (document.activeElement === last ||
                document.activeElement === dialog.current)
            ) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className={styles.header}>
          <div className={styles.identity}>
            <img
              src="/assets/ai_logo.png"
              alt="Cokoo, your city advisor"
              width={64}
              height={64}
            />
            <div>
              <span className={styles.eyebrow}>COKOO’S COMMAND CENTER</span>
              <h2 id="agent-hall-title">Agent Hall</h2>
            </div>
          </div>
          <div className={styles.headerEnd}>
            <span className={styles.badge}>
              {execution?.status === "running"
                ? "Agent at work"
                : "Plan · Sign · Build"}
            </span>
            <button
              className={styles.icon}
              onClick={onClose}
              aria-label="Close Agent Hall"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <nav className={styles.tabs} aria-label="Agent Hall sections">
          {["Rebalance", "Overview"].map((t) => (
            <button
              key={t}
              aria-current={tab === t ? "page" : undefined}
              onClick={() => setTab(t)}
            >
              {t === "Rebalance" ? (
                <SlidersHorizontal size={16} aria-hidden="true" />
              ) : (
                <Activity size={16} aria-hidden="true" />
              )}
              {t}
            </button>
          ))}
        </nav>
        <div className={styles.body} ref={body}>
          <div hidden={tab !== "Rebalance"}>
            <AgentRebalance
              city={city}
              prices={prices}
              feed={feed}
              walletConnected={walletConnected}
              walletAddress={walletAddress}
              execution={execution}
              onExecute={onExecute}
              onConnectWallet={onConnectWallet}
              onWatchCity={onWatchCity}
              onClearExecution={onClearExecution}
            />
          </div>
          {tab !== "Rebalance" && (
            <>
              <section className={styles.intro}>
                <div>
                  <span className={styles.eyebrow}>
                    YOUR CITY. A LITTLE MORE INTENTION.
                  </span>
                  <h3>See the bigger picture.</h3>
                  <p>
                    Explore your holdings, spot concentration, and let Cokoo connect the dots.
                  </p>
                </div>
                <img src="/assets/sprites/functional/agent_hall.png" alt="" />
              </section>
              <div className={styles.stats}>
                <div>
                  <span>Invested in your city</span>
                  <strong>{money(total)}</strong>
                  <small>Local portfolio valuation</small>
                </div>
                <div>
                  <span>Unrealized return</span>
                  <strong
                    className={total >= basis ? styles.gain : styles.loss}
                  >
                    {money(total - basis)}
                  </strong>
                  <small>Against {money(basis)} cost basis</small>
                </div>
                <div>
                  <span>Available treasury</span>
                  <strong>{money(city.cash)}</strong>
                  <small>
                    {holdings.length} assets · {sectors.length} sectors
                  </small>
                </div>
              </div>
              <div className={styles.grid}>
                <section className={styles.card}>
                  <div className={styles.sectionTitle}>
                    <h4>Portfolio landscape</h4>
                    <span>Click to explore</span>
                  </div>
                      <div className={styles.landscape}>
                        <div
                          className={styles.ring}
                          style={{
                            background: total
                              ? `conic-gradient(${segments})`
                              : "#e5dac1",
                          }}
                          role="img"
                          aria-label={`${holdings.length} assets; largest holding ${concentration.toFixed(1)} percent`}
                        >
                          <div>
                            <span>{focus ? focus.ticker : "Stock value"}</span>
                            <strong>{money(focus?.value ?? total)}</strong>
                            <small>
                              {focus && total
                                ? `${((focus.value / total) * 100).toFixed(1)}% allocation`
                                : `${sectors.length} sectors`}
                            </small>
                          </div>
                        </div>
                        <div className={styles.legend}>
                          {holdings.length ? (
                            holdings.map((h, i) => (
                              <button
                                key={h.ticker}
                                aria-pressed={selected === h.ticker}
                                onClick={() =>
                                  setSelected(
                                    selected === h.ticker ? null : h.ticker,
                                  )
                                }
                              >
                                <i
                                  style={{
                                    background: colors[i % colors.length],
                                  }}
                                />
                                <b>{h.ticker}</b>
                                <span>{h.allocation.toFixed(1)}%</span>
                              </button>
                            ))
                          ) : (
                            <p>
                              Your city has no funded positions yet. Place a
                              company or buy a position at the Stock Exchange.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={styles.callout}>
                        <ShieldCheck size={20} aria-hidden="true" />
                        <p>
                          {!total
                            ? "Your portfolio insights will grow with your city."
                            : `${holdings[0].ticker} represents ${concentration.toFixed(1)}% of your holdings. ${concentration > 35 ? "A large single position can drive your city’s performance." : "Review sector overlap as well as individual position sizes."}`}
                        </p>
                      </div>
                </section>
                <section className={`${styles.card} ${styles.cokoo}`}>
                  <div className={styles.sectionTitle}>
                    <h4>Cokoo’s workbench</h4>
                    <Sparkles size={18} aria-hidden="true" />
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void analyze();
                    }}
                  >
                    <div className={styles.buddy}>
                      <img
                        src="/assets/ai_logo.png"
                        alt=""
                        width={68}
                        height={68}
                      />
                      <p>
                        “Let’s turn the numbers into something you can use.”
                      </p>
                    </div>
                    <label className={styles.label}>
                      What should I investigate?
                      <textarea
                        autoComplete="off"
                        value={goal}
                        maxLength={350}
                        onChange={(e) => setGoal(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <button
                      className={styles.primary}
                      type="submit"
                      aria-busy={busy}
                      disabled={busy || !goal.trim()}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      {busy ? "Cokoo is reviewing your city…" : "Run AI review"}
                    </button>
                  </form>
                  <div aria-live="polite">
                    {busy && (
                      <div className={styles.reviewLoading}>
                        <p className={styles.muted}>
                          Reviewing {pendingContext.toLowerCase()}… This can
                          take up to a minute.
                        </p>
                        <i />
                        <i />
                        <i />
                      </div>
                    )}
                    {error && (
                      <p role="alert" className={styles.error}>
                        {error}
                      </p>
                    )}
                    {report && (
                      <div className={styles.report}>
                        <span className={styles.eyebrow}>
                          COKOO’S ASSESSMENT
                        </span>
                        <p className={styles.reportMeta}>
                          {report.context} · Snapshot at {report.time}
                        </p>
                        {report.key !== analysisKey && (
                          <p className={styles.changed}>
                            Inputs changed. Run a new review for this setup.
                          </p>
                        )}
                        {report.text.split(/\n\s*\n/).map((paragraph, i) => (
                          <p key={i}>
                            {paragraph
                              .split(/(\*\*[^*]+\*\*)/g)
                              .map((part, j) =>
                                part.startsWith("**") && part.endsWith("**") ? (
                                  <strong key={j}>{part.slice(2, -2)}</strong>
                                ) : (
                                  part
                                ),
                              )}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className={styles.muted}>
                    Sends your local city holdings to the configured AI service.
                    Reviews are educational snapshots, not financial advice,
                    autonomous monitoring, or executed trades.
                  </p>
                </section>
              </div>
              <section className={styles.footer}>
                <div>
                  <Activity size={16} aria-hidden="true" />
                  <span>
                    {
                      Object.values(feed.quotes).filter(
                        (q) => q.status === "live",
                      ).length
                    }
                    /{assets.length} live quotes · Remaining prices may be stale
                    or illustrative
                  </span>
                </div>
                {events.map((event, i) => (
                  <p key={`${event}-${i}`}>{event}</p>
                ))}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
