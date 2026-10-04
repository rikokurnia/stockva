"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { assets, defFor, money, pct, priceOf } from "../lib/city";
import { companyProfiles, type CompanyNews } from "../lib/company-intel";
import {
  movingAverage,
  observedSeries,
  relativeStrength,
  type AssetResearch,
  type FinancialMetric,
} from "../lib/asset-research";
import type { HistoryFeed, Passport } from "../lib/market";
import type { CivicProps } from "./civic-panel";
import { stamp } from "../lib/civic";
import StockLogo from "./stock-logo";
import ObservedChart from "./observed-chart";
import styles from "./civic-panel.module.css";

function useResource<T>(
  url: string | null,
  interval: number,
  revision: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      try {
        const response = await fetch(url!, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        });
        if (!response.ok) throw new Error("Request failed");
        const result = (await response.json()) as T;
        if (active) {
          setData(result);
          setError("");
        }
      } catch (caught) {
        if (
          active &&
          !(caught instanceof DOMException && caught.name === "AbortError")
        )
          setError(
            "This source could not be refreshed. Retry shortly; any previously loaded values may be stale.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, interval);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [url, interval, revision]);
  return { data, loading, error };
}
type Props = CivicProps & {
  ticker: string;
  revision: number;
  onAddToBundle: () => void;
  bundleAvailable: boolean;
};
export default function CivicResearch(props: Props) {
  const { ticker, prices, feed, mode, revision } = props;
  const asset = assets.find((item) => item.ticker === ticker)!;
  const quote = feed.quotes[ticker];
  const inspection = mode === "data";
  const [tab, setTab] = useState("technical");
  const [localRevision, setLocalRevision] = useState(0);
  const [indicatorSource, setIndicatorSource] = useState<"token" | "benchmark">(
    "token",
  );
  const update = revision + localRevision;
  const history = useResource<HistoryFeed>(
    `/api/history?ticker=${encodeURIComponent(ticker)}${quote?.pair ? `&pair=${encodeURIComponent(quote.pair)}` : ""}`,
    60000,
    update,
  );
  const research = useResource<AssetResearch>(
    inspection ? null : `/api/research?ticker=${encodeURIComponent(ticker)}`,
    300000,
    update,
  );
  const news = useResource<CompanyNews>(
    !inspection && tab === "news"
      ? `/api/company-news?ticker=${encodeURIComponent(ticker)}`
      : null,
    600000,
    update,
  );
  const passport = useResource<Passport>(
    inspection ? `/api/passport?ticker=${encodeURIComponent(ticker)}` : null,
    300000,
    update,
  );
  const tokenCloses = history.data?.simulated
    ? []
    : observedSeries(history.data?.points ?? [], "token");
  const underlyingCloses = history.data?.simulated
    ? []
    : observedSeries(history.data?.points ?? [], "benchmark");
  const closes =
    indicatorSource === "token" && tokenCloses.length
      ? tokenCloses
      : underlyingCloses;
  const indicators = {
    sma20: movingAverage(closes, 20).at(-1)?.value,
    sma50: movingAverage(closes, 50).at(-1)?.value,
    rsi: relativeStrength(closes),
  };
  const profile = companyProfiles[ticker];
  const held =
    props.city.buildings
      .filter(
        (building) =>
          !building.locked && defFor(building.kind).ticker === ticker,
      )
      .reduce((sum, building) => sum + building.quantity, 0) +
    (props.city.paper ?? [])
      .filter((holding) => holding.ticker === ticker)
      .reduce((sum, holding) => sum + holding.quantity, 0);
  const quoteLabel =
    quote?.status === "fallback" || !quote
      ? "Illustrative city price"
      : quote.status === "stale"
        ? "Stale quote"
        : quote.pair
          ? "Token · last trade"
          : quote.tokenName
            ? "Token · indicative"
            : "Underlying reference";
  const changeAvailable = Boolean(
    quote && (quote.pair || !quote.tokenName) && quote.status !== "fallback",
  );
  return (
    <>
      <div className={styles.assetHeader}>
        <div className={styles.assetIdentity}>
          <StockLogo ticker={ticker} name={asset.name} size={44} />
          <div>
            <h3>{asset.name}</h3>
            <p>
              {ticker} · {asset.sector}
              {research.data?.exchange ? ` · ${research.data.exchange}` : ""}
            </p>
          </div>
        </div>
        <div className={styles.assetPrice}>
          <strong>{money(priceOf(ticker, prices))}</strong>
          <small>
            {quoteLabel}
            {changeAvailable ? ` · ${pct(quote!.change)}` : ""}
          </small>
        </div>
      </div>
      <div className={styles.quoteMeta}>
        <span>
          {quote?.source ?? "City fallback"} · fetched {stamp(quote?.fetchedAt)}
        </span>
        <span>Quotes refresh about every 60s</span>
      </div>
      {!inspection && (
        <>
          <nav
            className={styles.researchNav}
            aria-label={`${ticker} research sections`}
          >
            {[
              ["technical", "Technical"],
              ["fundamentals", "Fundamentals"],
              ["news", "Company news"],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "technical" && (
            <>
              {history.loading && !history.data ? (
                <Loading label="Loading observed market history…" />
              ) : history.data ? (
                <ObservedChart
                  history={history.data}
                  onSourceChange={setIndicatorSource}
                />
              ) : (
                <p className={styles.notice}>
                  No historical prices have been returned.
                </p>
              )}
              <div className={styles.technicalStats}>
                <Indicator
                  label="SMA 20 · hourly closes"
                  value={
                    indicators.sma20 == null ? "—" : money(indicators.sma20)
                  }
                />
                <Indicator
                  label="SMA 50 · hourly closes"
                  value={
                    indicators.sma50 == null ? "—" : money(indicators.sma50)
                  }
                />
                <Indicator
                  label="RSI 14 · Wilder"
                  value={
                    indicators.rsi == null ? "—" : indicators.rsi.toFixed(1)
                  }
                />
              </div>
              <p className={styles.caption}>
                Indicators use{" "}
                {indicatorSource === "token" && tokenCloses.length
                  ? "token"
                  : "underlying"}{" "}
                observed hourly closes. A dash means there are too few
                observations. These are measurements, not buy or sell
                recommendations.
              </p>
            </>
          )}
          {tab === "fundamentals" && (
            <>
              <div className={styles.profile}>
                <h4>Business & financials</h4>
                <p>
                  {profile?.business ??
                    `${asset.name} belongs to the ${asset.sector} research category. The reported financials below come from the underlying company, not the token issuer.`}
                </p>
                {profile && (
                  <p className={styles.caption}>
                    Business description is editorial context, not a live
                    company filing.
                  </p>
                )}
              </div>
              {research.loading && !research.data ? (
                <Loading label="Retrieving company filings and market statistics…" />
              ) : (
                <>
                  <div className={styles.sectionHeading}>
                    <h4>Reported company financials</h4>
                    <span>
                      {research.data?.stale
                        ? "Previous retrieval · stale"
                        : "Annual / latest balance sheet"}
                    </span>
                  </div>
                  {research.data?.financials.length ? (
                    <div className={styles.financials}>
                      {research.data.financials.map((metric) => (
                        <div className={styles.financial} key={metric.label}>
                          <span>{metric.label}</span>
                          <strong>{formatFinancial(metric)}</strong>
                          <small>
                            Period ended {metric.period ?? "Not supplied"}
                          </small>
                          <small>Filed {metric.filed ?? "Not supplied"}</small>
                          {metric.url && (
                            <a
                              href={metric.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Source filing <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.notice}>
                      {research.data?.financialError ??
                        "Company fundamentals have not been returned."}
                    </p>
                  )}
                  {research.data?.financials.length ? (
                    <p className={styles.caption}>
                      {research.data.financialSource} · fetched{" "}
                      {stamp(
                        research.data.financialFetchedAt ??
                          research.data.fetchedAt,
                      )}
                      . Annual values are not trailing-twelve-month or real-time
                      values. Each metric keeps its own reporting period.
                    </p>
                  ) : null}
                  {research.data?.stale && research.data.financialError && (
                    <p className={styles.warning}>
                      {research.data.financialError} Showing previously
                      retrieved filings.
                    </p>
                  )}
                  <div
                    className={styles.sectionHeading}
                    style={{ marginTop: 28 }}
                  >
                    <h4>Underlying market statistics</h4>
                    <span>{research.data?.currency ?? "USD"}</span>
                  </div>
                  <dl className={styles.facts}>
                    <Fact label="Session range">
                      {range(research.data?.dayLow, research.data?.dayHigh)}
                    </Fact>
                    <Fact label="52-week range">
                      {range(research.data?.yearLow, research.data?.yearHigh)}
                    </Fact>
                    <Fact label="Reported session volume">
                      {research.data?.volume == null
                        ? "Unavailable"
                        : research.data.volume.toLocaleString()}
                    </Fact>
                    <Fact label="Instrument">
                      {research.data?.instrument ?? "Unavailable"}
                    </Fact>
                    <Fact label="Reference trade time">
                      {stamp(research.data?.benchmarkAt)}
                    </Fact>
                  </dl>
                  <p className={styles.caption}>
                    Yahoo Finance · delayed underlying reference, not token
                    trading volume. Financials are checked periodically and
                    refresh with new filings.
                  </p>
                  {research.data?.marketError && (
                    <p className={styles.warning}>
                      {research.data.marketError}
                    </p>
                  )}
                  {profile?.risk && (
                    <details className={styles.details}>
                      <summary>
                        <span>Business considerations</span>
                        <span>
                          <ChevronDown size={16} />
                        </span>
                      </summary>
                      <div className={styles.detailsBody}>
                        <p>{profile.risk}</p>
                        <p className={styles.caption}>
                          Editorial context. Review current company filings and
                          token product terms separately.
                        </p>
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
          {tab === "news" && (
            <>
              <div className={styles.sectionHeading}>
                <h4>Recent company reports</h4>
                <span>External sources</span>
              </div>
              {news.loading && !news.data ? (
                <Loading label="Finding recent company headlines…" />
              ) : news.data?.articles.length ? (
                news.data.articles.map((article) => (
                  <a
                    key={article.url}
                    className={styles.headline}
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>
                      {article.title}
                      <ArrowUpRight size={16} />
                    </strong>
                    <small>
                      {article.source} · {stamp(article.publishedAt)}
                    </small>
                  </a>
                ))
              ) : (
                <p className={styles.notice}>
                  {news.data?.error ??
                    "No recent company reports returned. Try refreshing or choose another asset."}
                </p>
              )}
              {news.data?.articles.length ? (
                <p className={styles.caption}>
                  Google News RSS · fetched {stamp(news.data.fetchedAt)}
                  {news.data.stale
                    ? " · cached reports; refresh unavailable"
                    : ""}
                  . Headlines link to source reports; they are not investment
                  signals.
                </p>
              ) : null}
            </>
          )}
          <div className={styles.actions}>
            {props.bundleAvailable && (
              <button
                className={styles.secondary}
                onClick={props.onAddToBundle}
              >
                Add {ticker} to bundle <ArrowUpRight size={16} />
              </button>
            )}
            <button
              className={styles.textButton}
              disabled={history.loading || research.loading}
              onClick={() => {
                props.onRetry();
                setLocalRevision((value) => value + 1);
              }}
            >
              <RefreshCw size={14} />
              {history.loading || research.loading
                ? "Refreshing…"
                : "Refresh research"}
            </button>
          </div>
          <p className={styles.caption}>
            {held > 0
              ? `Your city holds ${held.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${ticker} units. Manage holdings in City Hall. `
              : ""}
            Individual buying is in the left-side building menu. This service
            focuses on research and bundle placement.
          </p>
        </>
      )}
      {inspection && (
        <TokenInspection
          ticker={ticker}
          passport={passport.data}
          loading={passport.loading}
          history={history.data}
          historyLoading={history.loading}
          quoteIsToken={Boolean(quote?.tokenName || quote?.pair)}
          tokenPrice={
            quote?.status === "live" && (quote.tokenName || quote.pair)
              ? quote.price
              : undefined
          }
          tokenFetchedAt={quote?.fetchedAt}
          onRetry={() => setLocalRevision((value) => value + 1)}
        />
      )}
      {[history.error, research.error, news.error, passport.error]
        .filter(Boolean)
        .map((error, index) => (
          <p key={index} className={styles.warning} role="status">
            {error}{" "}
            <button
              className={styles.textButton}
              onClick={() => setLocalRevision((value) => value + 1)}
            >
              Retry source
            </button>
          </p>
        ))}
    </>
  );
}
function TokenInspection({
  ticker,
  passport,
  loading,
  history,
  historyLoading,
  tokenPrice,
  tokenFetchedAt,
  onRetry,
}: {
  ticker: string;
  passport: Passport | null;
  loading: boolean;
  history: HistoryFeed | null;
  historyLoading: boolean;
  quoteIsToken: boolean;
  tokenPrice?: number;
  tokenFetchedAt?: string | null;
  onRetry: () => void;
}) {
  const [network, setNetwork] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const deployment = passport?.deployments[network];
  const reserve = passport?.reserve;
  const staleReserve = reserve
    ? Date.now() - Date.parse(reserve.timestamp) > 86400000
    : false;
  useEffect(() => {
    setCopied(false);
    setCopyError("");
  }, [deployment?.address]);
  const asset = assets.find((item) => item.ticker === ticker)!;
  return (
    <>
      <div className={styles.inspectionStats}>
        <div>
          <strong>Issuer identity</strong>
          <span className={passport?.symbol ? styles.gain : ""}>
            {passport?.symbol
              ? "Matched to underlying"
              : loading
                ? "Checking…"
                : "Not confirmed"}
          </span>
        </div>
        <div>
          <strong>Deployments</strong>
          <span>
            {passport?.deployments.length
              ? `${passport.deployments.length} issuer-listed networks`
              : loading
                ? "Checking…"
                : "Not returned"}
          </span>
        </div>
        <div>
          <strong>Reserve report</strong>
          <span className={staleReserve ? styles.loss : ""}>
            {reserve
              ? staleReserve
                ? "Older than 24 hours"
                : "Recent issuer report"
              : loading
                ? "Checking…"
                : "Unavailable"}
          </span>
        </div>
      </div>
      {loading && !passport ? (
        <Loading label="Checking issuer metadata, contracts and reserves…" />
      ) : (
        <>
          <div className={styles.passportGrid}>
            <section>
              <h4>Token identity</h4>
              <div className={styles.assetIdentity}>
                <StockLogo
                  ticker={ticker}
                  name={passport?.name ?? `${ticker}x`}
                  type="rwa"
                  size={40}
                />
                <div>
                  <strong>
                    {passport?.name ?? "Issuer identity unavailable"}
                  </strong>
                  <small>
                    {passport?.symbol ?? "No verified symbol returned"}
                  </small>
                </div>
              </div>
              <dl className={styles.facts}>
                <Fact label="Underlying">
                  {asset.name} · {ticker}
                </Fact>
                <Fact label="Issuer">
                  {passport?.symbol
                    ? "Backed Assets (JE) Limited"
                    : "Not confirmed"}
                </Fact>
                <Fact label="ISIN">{passport?.isin ?? "Unavailable"}</Fact>
                <Fact label="Underlying exchange">
                  {passport?.exchange ?? history?.exchange ?? "Unavailable"}
                </Fact>
                <Fact label="Issuer trading status">
                  {passport?.symbol
                    ? passport.halted
                      ? "Halted by issuer"
                      : (passport.period ?? "No period returned")
                    : "Unconfirmed"}
                </Fact>
              </dl>
              <p className={styles.caption}>
                Issuer-listed does not mean independently audited. Trading can
                be halted; a token price does not guarantee venue availability.
              </p>
            </section>
            <section>
              <h4>Network & contract</h4>
              {passport?.deployments.length ? (
                <>
                  <label className={styles.field}>
                    Issuer-listed network
                    <select
                      value={network}
                      onChange={(event) =>
                        setNetwork(Number(event.target.value))
                      }
                    >
                      {passport.deployments.map((item, index) => (
                        <option
                          key={`${item.network}:${item.address}`}
                          value={index}
                        >
                          {item.network === "BinanceSmartChain"
                            ? "BNB Smart Chain"
                            : item.network}
                        </option>
                      ))}
                    </select>
                  </label>
                  <code className={styles.contract}>{deployment?.address}</code>
                  <div className={styles.actions}>
                    <button
                      className={styles.secondary}
                      onClick={async () => {
                        try {
                          if (deployment) {
                            await navigator.clipboard.writeText(
                              deployment.address,
                            );
                            setCopied(true);
                          }
                        } catch {
                          setCopyError(
                            "Clipboard unavailable. Select and copy the address above.",
                          );
                        }
                      }}
                    >
                      <Copy size={14} />
                      {copied ? "Address copied" : "Copy address"}
                    </button>
                    {deployment?.explorer && (
                      <a
                        className={styles.textLink}
                        href={deployment.explorer}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open token explorer <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  {copyError && (
                    <p className={styles.warning} role="status">
                      {copyError}
                    </p>
                  )}
                  <p className={styles.caption}>
                    These are the real issuer token deployments. City Hall’s BNB
                    testnet vault is a different contract.
                  </p>
                </>
              ) : (
                <p className={styles.notice}>
                  No deployment address returned. An address is never guessed
                  from a ticker.
                </p>
              )}
            </section>
          </div>
          <section className={styles.legal}>
            <div className={styles.sectionHeading}>
              <h4>Reserve evidence</h4>
              <span>{reserve ? "Issuer-reported" : "Not returned"}</span>
            </div>
            {reserve ? (
              <>
                <dl className={styles.facts}>
                  <Fact label="Reported shares held">
                    {reserve.sharesHeld.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </Fact>
                  <Fact label="Circulating token supply">
                    {reserve.circulatingSupply.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}
                  </Fact>
                  <Fact label="Custody providers">
                    {reserve.providers.join(", ") || "Not supplied"}
                  </Fact>
                  <Fact label="Report timestamp">
                    {stamp(reserve.timestamp)}
                  </Fact>
                </dl>
                <p className={styles.caption}>
                  Issuer-reported holdings, not an independent audit.
                  Multipliers, dividends and pending issuance can change the
                  relation between shares and token supply; no backing ratio is
                  inferred.
                </p>
                {staleReserve && (
                  <p className={styles.warning}>
                    This report is older than 24 hours. Check the source for a
                    newer report before relying on it.
                  </p>
                )}
                <div className={styles.sourceLinks}>
                  <a
                    href={`https://api.xstocks.fi/api/v2/public/proof-of-reserves/${encodeURIComponent(passport?.symbol ?? `${ticker}x`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open reserve source <ExternalLink size={14} />
                  </a>
                </div>
              </>
            ) : (
              <p className={styles.notice}>
                No reserve report returned for this asset. Missing reserve
                evidence is not treated as zero backing—or proof of backing.
              </p>
            )}
          </section>
        </>
      )}
      <section className={styles.legal}>
        <h4>Price provenance & comparison</h4>
        <div className={styles.comparison}>
          <div>
            <small>Observed token quote</small>
            <strong>
              {tokenPrice == null ? "Unavailable" : money(tokenPrice)}
            </strong>
            <small>Retrieved {stamp(tokenFetchedAt)}</small>
          </div>
          <div>
            <small>Underlying reference</small>
            <strong>
              {history?.benchmarkPrice == null
                ? "Unavailable"
                : money(history.benchmarkPrice)}
            </strong>
            <small>Last trade {stamp(history?.benchmarkAt)}</small>
          </div>
        </div>
        <p className={styles.caption}>
          Independent timestamps are not synchronized. No arbitrage or
          executable spread is implied. The underlying reference may be delayed
          or from a closed market session.
        </p>
        {historyLoading && !history ? (
          <Loading label="Retrieving independent price histories…" />
        ) : history ? (
          <ObservedChart history={history} compare />
        ) : (
          <p className={styles.notice}>Price history is unavailable.</p>
        )}
      </section>
      <section className={styles.legal}>
        <h4>Rights & risks</h4>
        <p>
          {passport?.symbol
            ? "A tracker certificate gives economic exposure, not direct stock ownership or shareholder voting rights. Redemption eligibility, geographic restrictions and fees follow the product prospectus. Issuer, custody, liquidity and price-deviation risks remain."
            : "Token rights are unconfirmed until issuer metadata is available. Check the official product terms before relying on this listing."}
        </p>
        <div className={styles.sourceLinks}>
          <a
            href="https://assets.backed.fi/legal-documentation"
            target="_blank"
            rel="noreferrer"
          >
            Prospectus & product terms <ExternalLink size={14} />
          </a>
          <a
            href="https://docs.xstocks.fi/docs/product-legal-overview"
            target="_blank"
            rel="noreferrer"
          >
            Issuer legal overview <ExternalLink size={14} />
          </a>
        </div>
      </section>
      {passport?.error && <p className={styles.warning}>{passport.error}</p>}
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={loading || historyLoading}
          onClick={onRetry}
        >
          <RefreshCw size={15} />
          {loading || historyLoading ? "Checking sources…" : "Recheck evidence"}
        </button>
        <span className={styles.caption}>
          Issuer data checked {stamp(passport?.fetchedAt)}
        </span>
      </div>
    </>
  );
}
function Loading({ label }: { label: string }) {
  return (
    <div className={styles.skeleton} aria-busy="true" role="status">
      <span />
      <span />
      <p>{label}</p>
    </div>
  );
}
function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function range(low?: number, high?: number) {
  return low == null || high == null
    ? "Unavailable"
    : `${money(low)} – ${money(high)}`;
}
function formatFinancial(metric: FinancialMetric) {
  if (metric.unit === "percent") return `${metric.value.toFixed(1)}%`;
  if (metric.unit === "ratio") return metric.value.toFixed(2);
  if (metric.unit === "USD/share") return money(metric.value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(metric.value);
}
