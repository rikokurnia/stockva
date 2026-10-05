"use client";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { money, pct, priceOf, type CityState, type PriceMap } from "../lib/city";
import { bscTxLink } from "../lib/contracts";
import type { MarketFeed } from "../lib/market";
import type { portfolioLandscape } from "../lib/agent-hall";
import {
  dailyDeltas,
  type EquityPoint,
} from "../lib/equity-history";
import EquityChart from "./equity-chart";
import styles from "./civic-panel.module.css";

type Landscape = ReturnType<typeof portfolioLandscape>;

type Props = {
  city: CityState;
  prices: PriceMap;
  feed: MarketFeed;
  landscape: Landscape;
  localPnl: number;
  equityHistory: EquityPoint[];
  onSellRow: (ticker: string) => void;
};

/** Full-portfolio performance: equity curve, daily P&L, realized + holdings. */
export default function CivicPerformance({
  city,
  prices,
  landscape,
  localPnl,
  equityHistory,
  onSellRow,
}: Props) {
  const realized = city.realizedPnl ?? 0;
  const deltas = dailyDeltas(equityHistory).slice(-30).reverse();
  const sales = [...(city.saleHistory ?? [])].reverse();
  return (
    <>
      <div className={styles.summaryStrip}>
        <div>
          <span>Total equity</span>
          <strong>{money(landscape.total + city.cash)}</strong>
          <small>Invested + city cash</small>
        </div>
        <div>
          <span>Unrealized P/L</span>
          <strong className={localPnl < 0 ? styles.loss : styles.gain}>
            {localPnl >= 0 ? "+" : ""}
            {money(localPnl)}
          </strong>
          <small>
            {landscape.basis
              ? `${pct((localPnl / landscape.basis) * 100)} on ${money(landscape.basis)} invested`
              : "No invested positions yet"}
          </small>
        </div>
        <div>
          <span>Realized P/L</span>
          <strong className={realized < 0 ? styles.loss : styles.gain}>
            {realized >= 0 ? "+" : ""}
            {money(realized)}
          </strong>
          <small>All-time, all closed sales</small>
        </div>
      </div>
      <section className={styles.section} aria-label="Sale history">
        <div className={styles.sectionHeading}>
          <h4>Sale history</h4>
          <span>
            {sales.length} {sales.length === 1 ? "sale" : "sales"} · feeds
            realized P/L
          </span>
        </div>
        {sales.length ? (
          <div className={styles.perfTableWrap}>
            <table className={styles.perfTable}>
              <thead>
                <tr>
                  <th>Token</th>
                  <th className={styles.num}>Qty</th>
                  <th className={styles.num}>Proceeds</th>
                  <th className={styles.num}>Realized</th>
                  <th>Date</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 30).map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <strong>{sale.ticker}</strong>{" "}
                      <small style={{ color: "var(--subtle)" }}>
                        {sale.source === "onchain" ? "on-chain" : "local"}
                      </small>
                    </td>
                    <td className={styles.num}>
                      {sale.quantity.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className={styles.num}>{money(sale.proceeds)}</td>
                    <td
                      className={`${styles.num} ${sale.realized < 0 ? styles.loss : styles.gain}`}
                    >
                      {sale.realized >= 0 ? "+" : ""}
                      {money(sale.realized)}
                    </td>
                    <td>
                      {new Date(sale.at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    <td>
                      {sale.hash ? (
                        <a
                          href={bscTxLink(sale.hash)}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.textLink}
                        >
                          <Image
                            src="/bnb-logo.png"
                            alt="BNB"
                            width={14}
                            height={14}
                            style={{ flexShrink: 0 }}
                          />
                          <code>
                            {sale.hash.slice(0, 6)}…
                            {sale.hash.slice(-4)}
                          </code>
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span style={{ color: "var(--subtle)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.caption}>
            No sales yet. Close a position and it lands here with its receipt.
          </p>
        )}
      </section>
      <section className={styles.section} aria-label="Equity curve">
        <div className={styles.sectionHeading}>
          <h4>Total Equity Return</h4>
          <span>Recorded while you play</span>
        </div>        {equityHistory.length >= 2 ? (
          <EquityChart points={equityHistory} />
        ) : (
          <div className={styles.empty}>
            <h4>Your equity curve starts here.</h4>
            <p>
              Snapshots are recorded as your city runs — no backfill is ever
              invented. Play on and this chart fills in.
            </p>
          </div>
        )}
      </section>
      <section className={styles.section} aria-label="Holding performance">
        <div className={styles.sectionHeading}>
          <h4>Holding performance</h4>
          <span>Unrealized P/L per asset</span>
        </div>
        {landscape.holdings.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[...landscape.holdings]
              .map((holding) => ({
                ticker: holding.ticker,
                pnl: holding.value - holding.basis,
              }))
              .sort((a, b) => b.pnl - a.pnl)
              .map((row) => {
                const max = Math.max(
                  ...landscape.holdings.map((h) =>
                    Math.abs(h.value - h.basis),
                  ),
                  1,
                );
                const gain = row.pnl >= 0;
                return (
                  <div
                    key={row.ticker}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "64px 1fr auto",
                      gap: "10px",
                      alignItems: "center",
                      fontSize: "12px",
                    }}
                  >
                    <strong>{row.ticker}</strong>
                    <div
                      style={{
                        height: "10px",
                        borderRadius: "5px",
                        background: "rgba(8, 16, 22, 0.6)",
                        border: "1px solid var(--line-subtle)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(2, (Math.abs(row.pnl) / max) * 100)}%`,
                          background: gain ? "#10b981" : "#f43f5e",
                          borderRadius: "inherit",
                        }}
                      />
                    </div>
                    <span
                      className={gain ? styles.gain : styles.loss}
                      style={{
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        minWidth: "90px",
                        textAlign: "right",
                      }}
                    >
                      {gain ? "+" : ""}
                      {money(row.pnl)}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className={styles.caption}>
            Bars appear once you hold invested positions.
          </p>
        )}
      </section>
      <section className={styles.section} aria-label="Daily profit and loss">
        <div className={styles.sectionHeading}>
          <h4>Daily P&L</h4>
          <span>Day-over-day equity</span>
        </div>
        {deltas.length ? (
          <div className={styles.perfTableWrap}>
            <table className={styles.perfTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th className={styles.num}>Equity</th>
                  <th className={styles.num}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {deltas.map((row) => (
                  <tr key={row.date + row.equity}>
                    <td>{row.date}</td>
                    <td className={styles.num}>
                      {Math.round(row.equity).toLocaleString()}
                    </td>
                    <td
                      className={`${styles.num} ${row.pnl < 0 ? styles.loss : styles.gain}`}
                    >
                      {row.pnl >= 0 ? "+" : ""}
                      {Math.round(row.pnl).toLocaleString()} (
                      {row.pnl >= 0 ? "+" : ""}
                      {row.pct.toFixed(2)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.caption}>
            Daily rows appear once two or more days are recorded.
          </p>
        )}
      </section>
      <section className={styles.section} aria-label="All positions">
        <div className={styles.sectionHeading}>
          <h4>All positions</h4>
          <span>
            {landscape.holdings.length}{" "}
            {landscape.holdings.length === 1 ? "asset" : "assets"}
          </span>
        </div>
        {landscape.holdings.length ? (
          <div className={styles.perfTableWrap}>
            <table className={styles.perfTable}>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className={styles.num}>Units</th>
                  <th className={styles.num}>Avg price</th>
                  <th className={styles.num}>Current</th>
                  <th className={styles.num}>Invested</th>
                  <th className={styles.num}>Market value</th>
                  <th className={styles.num}>Potential P/L</th>
                  <th className={styles.num}>%</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {landscape.holdings.map((holding) => {
                  const pnl = holding.value - holding.basis;
                  const live = priceOf(holding.ticker, prices);
                  const avg =
                    holding.units > 0 ? holding.basis / holding.units : 0;
                  return (
                    <tr key={holding.ticker}>
                      <td>
                        <strong>{holding.ticker}</strong>
                      </td>
                      <td className={styles.num}>
                        {holding.units.toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td className={styles.num}>{money(avg)}</td>
                      <td className={styles.num}>{money(live)}</td>
                      <td className={styles.num}>{money(holding.basis)}</td>
                      <td className={styles.num}>{money(holding.value)}</td>
                      <td
                        className={`${styles.num} ${pnl < 0 ? styles.loss : styles.gain}`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {money(pnl)}
                      </td>
                      <td
                        className={`${styles.num} ${pnl < 0 ? styles.loss : styles.gain}`}
                      >
                        {holding.basis > 0
                          ? `${pnl >= 0 ? "+" : ""}${((pnl / holding.basis) * 100).toFixed(2)}%`
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.miniBtn}
                          onClick={() => onSellRow(holding.ticker)}
                        >
                          Sell
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.caption}>
            No invested positions yet. Confirmed buildings will appear here.
          </p>
        )}
        <p className={styles.caption}>
          Selling opens the holding&apos;s sale form. On-chain positions sell
          through Agent Hall; local positions settle to city cash with realized
          P/L tracked above.
        </p>
      </section>
    </>
  );
}
