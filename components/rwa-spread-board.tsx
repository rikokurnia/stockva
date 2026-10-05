"use client";
import { money } from "../lib/city";
import type { MarketFeed } from "../lib/market";
import styles from "./civic-panel.module.css";

/** On-chain vs reference spread board (Binance RWA Data). Silent when empty. */
export default function RwaSpreadBoard({
  feed,
  tickers,
}: {
  feed: MarketFeed;
  tickers: string[];
}) {
  const rows = tickers
    .map((ticker) => feed.quotes[ticker])
    .filter((q) => q && q.rwa);
  if (!rows.length) return null;
  return (
    <section className={styles.section} aria-label="On-chain spreads">
      <div className={styles.sectionHeading}>
        <h4>On-chain vs reference spreads</h4>
        <span>Binance RWA Data · BSC</span>
      </div>
      {rows.map((quote) => {
        const rwa = quote.rwa!;
        const premium = rwa.spreadBps >= 0;
        return (
          <div
            key={quote.ticker}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "8px 0",
              borderTop: "1px solid var(--line-subtle)",
              fontSize: "12px",
            }}
          >
            <strong>{quote.ticker}</strong>
            <span style={{ color: "var(--subtle)" }}>
              {money(rwa.onchain)} on-chain · {money(rwa.reference)} ref
            </span>
            <span
              className={premium ? styles.gain : styles.loss}
              style={{ fontWeight: 700, whiteSpace: "nowrap" }}
              title={`${rwa.platform} · ${rwa.contract}`}
            >
              {premium ? "+" : ""}
              {(rwa.spreadBps / 100).toFixed(2)}%
            </span>
            <span style={{ color: "var(--subtle)", whiteSpace: "nowrap" }}>
              {rwa.referenceFrozen
                ? "ref frozen"
                : rwa.session === "halted"
                  ? "halted"
                  : "live"}
            </span>
          </div>
        );
      })}
      <p className={styles.caption}>
        Positive = on-chain premium over the per-share reference. When the US
        market is closed the reference is frozen while on-chain keeps trading —
        that gap is the weekend trade, not free money.
      </p>
    </section>
  );
}
