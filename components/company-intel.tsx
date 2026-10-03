"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  ExternalLink,
  MapPin,
  Move,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  assetFor,
  buildingImage,
  defFor,
  money,
  pct,
  priceOf,
  returnOf,
  sprite,
  tier,
  tierName,
  type Building,
  type PriceMap,
  type TierThresholds,
} from "../lib/city";
import { companyProfiles, type CompanyNews } from "../lib/company-intel";
import type { Quote } from "../lib/market";
import StockLogo from "./stock-logo";
import styles from "./company-intel.module.css";

type Props = {
  mode?: "live" | "simulation";
  building: Building;
  prices: PriceMap;
  quote?: Quote;
  thresholds: TierThresholds;
  simulatedReturn?: number;
  running: boolean;
  hasExchange: boolean;
  hasData: boolean;
  onClose: () => void;
  onTrade: () => void;
  onPassport: () => void;
  onMove: () => void;
};
export default function CompanyIntel(p: Props) {
  const def = defFor(p.building.kind),
    asset = assetFor(def.ticker!),
    profile = companyProfiles[asset.ticker];
  const [news, setNews] = useState<CompanyNews | null>(null),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null),
    id = useId();
  const gain = p.simulatedReturn ?? returnOf(p.building, p.prices),
    level = tier(gain, p.thresholds);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNews(null);
    fetch(`/api/company-news?ticker=${encodeURIComponent(asset.ticker)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data: CompanyNews) => {
        if (!Array.isArray(data.articles)) throw Error();
        setNews(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setNews({
            ticker: asset.ticker,
            articles: [],
            fetchedAt: new Date().toISOString(),
            error:
              "News connection unavailable. Retry to retrieve the latest reports.",
          });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [asset.ticker, retry]);
  return (
    <div
      className={styles.backdrop}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        ref={root}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") p.onClose();
          if (e.key === "Tab") {
            const elements = root.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href], input, select",
            );
            if (!elements?.length) return;
            const first = elements[0],
              last = elements[elements.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header className={styles.masthead}>
          <div>
            <span className={styles.sectionLabel}>
              STOCKCITY · COMPANY INTELLIGENCE
            </span>
            <p>The Company Ledger</p>
          </div>
          <button
            className={styles.close}
            aria-label="Close company intelligence"
            onClick={p.onClose}
          >
            <X size={21} />
          </button>
        </header>
        <div className={styles.modalBody}>
          <section className={styles.hero}>
            <div>
              <div className={styles.identity}>
                <StockLogo ticker={asset.ticker} name={asset.name} size={42} />
                <span>
                  {asset.ticker}
                  <small>{asset.sector} · U.S. equity</small>
                </span>
              </div>
              <h2 id={id}>{asset.name}</h2>
              <p className={styles.description}>
                {profile?.business ??
                  `${asset.name} is tracked in your ${asset.sector.toLowerCase()} district. Open its RWA passport to inspect the underlying asset and token issuer.`}
              </p>
              {profile && (
                <span className={styles.location}>
                  <MapPin size={12} />
                  {profile.headquarters}
                </span>
              )}
            </div>
            <div className={styles.buildingArt}>
              <span className={styles.levelStamp}>{tierName(level)}</span>
              <img
                src={sprite(
                  buildingImage(
                    p.building,
                    p.prices,
                    p.thresholds,
                    p.simulatedReturn,
                  ),
                )}
                alt={`${asset.name} ${tierName(level)} building`}
              />
              <strong className={gain >= 0 ? styles.gain : styles.loss}>
                {pct(gain)}
              </strong>
              <small>
                {p.simulatedReturn !== undefined ? (
                  <span className={styles.simBadge}>
                    PREVIEW · {p.running ? "RUNNING" : "PAUSED"}
                  </span>
                ) : (
                  <span className={styles.liveBadge}>
                    <span
                      className={styles.livePulseDot}
                      style={{ width: 5, height: 5 }}
                    />
                    24/7 LIVE RWA MARKET
                  </span>
                )}
              </small>
            </div>
          </section>
          <div className={styles.quoteStrip}>
            <div>
              <span>24/7 RWA Quote · {p.quote?.status ?? "fallback"}</span>
              <strong>{money(priceOf(asset.ticker, p.prices))}</strong>
            </div>
            <div>
              <span>Units owned</span>
              <strong>{p.building.quantity.toFixed(4)}</strong>
            </div>
            <div>
              <span>Average entry</span>
              <strong>{money(p.building.entry)}</strong>
            </div>
          </div>
          {p.simulatedReturn !== undefined && (
            <p className={styles.simNotice}>
              Building tier and returns reflect current visual performance. The
              on-chain token quote above remains the latest 24/7 price.
            </p>
          )}
          {profile && (
            <div className={styles.brief}>
              <div>
                <h3>On the desk</h3>
                <p>{profile.focus}</p>
              </div>
              <div>
                <h3>Risk to watch</h3>
                <p>{profile.risk}</p>
              </div>
            </div>
          )}
          <section className={styles.newsSection} aria-busy={loading}>
            <div className={styles.newsHeading}>
              <div>
                <span className={styles.sectionLabel}>THE NEWS WIRE</span>
                <h3>Latest dispatches</h3>
              </div>
              <button
                aria-label="Refresh company news"
                title="Refresh company news"
                className={styles.close}
                disabled={loading}
                onClick={() => setRetry((n) => n + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {loading ? (
              <div className={styles.skeleton} role="status">
                Retrieving recent company reports…
                {[0, 1, 2].map((n) => (
                  <div key={n} />
                ))}
              </div>
            ) : news?.articles.length ? (
              <ol className={styles.headlines}>
                {news.articles.map((article, i) => (
                  <li key={article.url}>
                    <span className={styles.articleNumber}>0{i + 1}</span>
                    <div>
                      <div className={styles.byline}>
                        {article.source}
                        <span>·</span>
                        <time dateTime={article.publishedAt}>
                          {new Date(article.publishedAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </time>
                      </div>
                      <a href={article.url} target="_blank" rel="noreferrer">
                        {article.title}
                        <ArrowUpRight size={17} />
                      </a>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyNews}>
                <h4>The wire is unavailable.</h4>
                <p>
                  {news?.error ??
                    "No recent reports were returned for this company."}
                </p>
                <button
                  className={styles.paperButton}
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {news?.stale && <p className={styles.error}>{news.error}</p>}
            <div className={styles.newsFoot}>
              <span>
                {news?.articles.length
                  ? `Via Google News · checked ${new Date(news.fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                  : "Publisher attribution and dates appear with each report."}
              </span>
              <a
                href={`https://news.google.com/search?q=${encodeURIComponent(profile?.query ?? `${asset.name} stock`)}`}
                target="_blank"
                rel="noreferrer"
              >
                More coverage <ExternalLink size={11} />
              </a>
            </div>
          </section>
        </div>
        <footer className={styles.modalFooter}>
          <button className={styles.paperButton} onClick={p.onMove}>
            <Move size={14} />
            Move building
          </button>
          <button
            className={styles.paperButton}
            disabled={!p.hasData}
            title={
              p.hasData
                ? "Inspect asset evidence"
                : "Build the Data Center first"
            }
            onClick={p.onPassport}
          >
            <ShieldCheck size={14} />
            RWA passport
          </button>
          <button
            className={styles.tradeButton}
            disabled={!p.hasExchange}
            title={
              p.hasExchange
                ? "Open trading desk"
                : "Build the Stock Exchange first"
            }
            onClick={p.onTrade}
          >
            Trade position <ArrowUpRight size={15} />
          </button>
        </footer>
      </div>
    </div>
  );
}
