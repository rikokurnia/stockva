"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Crosshair,
  Layers,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import {
  assets,
  catalogue,
  defFor,
  isHeroTicker,
  money,
  priceOf,
  sprite,
} from "../lib/city";
import { validateBundle } from "../lib/civic";
import type { CivicProps } from "./civic-panel";
import CivicResearch from "./civic-research";
import StockLogo from "./stock-logo";
import styles from "./civic-panel.module.css";

export default function CivicMarket(
  props: CivicProps & { onResetScroll: () => void },
) {
  const [view, setView] = useState<"research" | "bundle">("research");
  const [ticker, setTicker] = useState(
    assets.some((asset) => asset.ticker === props.initialTicker)
      ? props.initialTicker!
      : "NVDA",
  );
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("");
  const [revision, setRevision] = useState(0);
  const [bundleTickers, setBundleTickers] = useState<string[]>([]);
  const [bundleAmounts, setBundleAmounts] = useState<Record<string, string>>(
    {},
  );
  const research = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const change = () => setCompact(media.matches);
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    props.onResetScroll();
  }, [view, props.onResetScroll]);
  useEffect(() => {
    if (
      props.initialTicker &&
      assets.some((asset) => asset.ticker === props.initialTicker)
    ) {
      setTicker(props.initialTicker);
      setView("research");
    }
  }, [props.initialTicker]);
  const available = assets.filter(
    (asset) =>
      isHeroTicker(asset.ticker) &&
      !props.city.buildings.some(
        (building) => defFor(building.kind).ticker === asset.ticker,
      ),
  );
  function addToBundle(symbol: string) {
    if (!available.some((asset) => asset.ticker === symbol)) return;
    setBundleTickers((previous) => [...new Set([...previous, symbol])]);
    setBundleAmounts((previous) => ({
      ...previous,
      [symbol]: previous[symbol] ?? "500",
    }));
    setView("bundle");
  }
  const inspection = props.mode === "data";
  const shown = assets.filter(
    (asset) =>
      (!sector || asset.sector === sector) &&
      `${asset.ticker} ${asset.name} ${asset.sector}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <>
      {!inspection && (
        <nav className={styles.navigation} aria-label="Stock Exchange views">
          <button
            aria-pressed={view === "research"}
            onClick={() => setView("research")}
          >
            <Search size={16} /> Asset research
          </button>
          <button
            aria-pressed={view === "bundle"}
            onClick={() => setView("bundle")}
          >
            <Layers size={16} /> Bundle builder
            {bundleTickers.length ? ` (${bundleTickers.length})` : ""}
          </button>
        </nav>
      )}
      {inspection && (
        <div className={styles.intro}>
          <div>
            <h3>Know what backs the ticker.</h3>
            <p>
              Check issuer identity, deployment addresses, reserve reports and
              price provenance. Missing evidence stays visible.
            </p>
          </div>
          <button className={styles.secondary} onClick={props.onScan}>
            <Crosshair size={16} /> Inspect on island
          </button>
        </div>
      )}
      {!inspection && view === "bundle" ? (
        <BundleBuilder
          {...props}
          selected={bundleTickers}
          amounts={bundleAmounts}
          setSelected={setBundleTickers}
          setAmounts={setBundleAmounts}
          available={available.map((asset) => asset.ticker)}
        />
      ) : (
        <>
          <div className={styles.marketLayout}>
            <aside className={styles.catalogue} aria-label="Asset catalogue">
              <div className={styles.catalogueHead}>
                <h4>
                  {inspection ? "Asset inspection" : "Research catalogue"}
                </h4>
                <span>{shown.length} assets</span>
              </div>
              <details
                className={styles.cataloguePicker}
                open={!compact || pickerOpen}
                onToggle={(event) => {
                  if (compact) setPickerOpen(event.currentTarget.open);
                }}
              >
                <summary>
                  <span>{ticker} · Change asset</span>
                  <ChevronDown size={16} />
                </summary>
                <div>
                  <label className={styles.search}>
                    <span className={styles.srOnly}>
                      Search by ticker, company or sector
                    </span>
                    <Search size={16} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="AAPL, NVIDIA…"
                    />
                  </label>
                  <label className={styles.field}>
                    Sector
                    <select
                      value={sector}
                      onChange={(event) => setSector(event.target.value)}
                    >
                      <option value="">All sectors</option>
                      {[...new Set(assets.map((asset) => asset.sector))]
                        .sort()
                        .map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                    </select>
                  </label>
                  <div className={styles.catalogueList}>
                    {shown.map((asset) => (
                      <button
                        key={asset.ticker}
                        className={styles.assetOption}
                        aria-pressed={ticker === asset.ticker}
                        onClick={() => {
                          setTicker(asset.ticker);
                          if (compact) {
                            setPickerOpen(false);
                            requestAnimationFrame(() =>
                              research.current?.scrollIntoView({
                                block: "start",
                                behavior: "instant",
                              }),
                            );
                          }
                        }}
                      >
                        <StockLogo
                          ticker={asset.ticker}
                          name={asset.name}
                          size={30}
                        />
                        <span>
                          <strong>{asset.ticker}</strong>
                          <small>{asset.name}</small>
                        </span>
                        <div>
                          {money(priceOf(asset.ticker, props.prices))}
                          <small>
                            {props.feed.quotes[asset.ticker]?.status === "live"
                              ? "Observed"
                              : props.feed.quotes[asset.ticker]?.status ===
                                  "stale"
                                ? "Stale"
                                : "Illustrative"}
                          </small>
                        </div>
                      </button>
                    ))}
                    {!shown.length && (
                      <div className={styles.empty}>
                        <h4>No matching assets.</h4>
                        <p>Try a ticker, company or another sector.</p>
                        <button
                          className={styles.textButton}
                          onClick={() => {
                            setSearch("");
                            setSector("");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                  <p className={styles.caption}>
                    {inspection
                      ? "Each asset is checked against issuer metadata. A research listing alone does not confirm that a token exists."
                      : "Research is read-only. Individual purchases live in the left-side building menu."}
                  </p>
                  <button
                    className={styles.textButton}
                    disabled={props.loading}
                    onClick={() => {
                      props.onRetry();
                      setRevision((value) => value + 1);
                    }}
                  >
                    <RefreshCw size={14} />
                    {props.loading ? "Refreshing quotes…" : "Refresh data"}
                  </button>
                </div>
              </details>
            </aside>
            <div ref={research} className={styles.research}>
              <CivicResearch
                key={`${ticker}:${inspection}`}
                ticker={ticker}
                {...props}
                revision={revision}
                onAddToBundle={() => addToBundle(ticker)}
                bundleAvailable={available.some(
                  (asset) => asset.ticker === ticker,
                )}
              />
            </div>
          </div>
          {props.feed.error && (
            <p className={styles.warning} role="status">
              {props.feed.error}
            </p>
          )}
        </>
      )}
    </>
  );
}
type BundleProps = CivicProps & {
  selected: string[];
  amounts: Record<string, string>;
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  setAmounts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  available: string[];
};
function BundleBuilder({
  city,
  prices,
  feed,
  onBuyBundle,
  selected,
  amounts,
  setSelected,
  setAmounts,
  available,
}: BundleProps) {
  const [search, setSearch] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const review = useRef<HTMLElement>(null);
  const chooser = useRef<HTMLElement>(null);
  const validation = validateBundle(selected, amounts, available, city.cash);
  const options = assets.filter(
    (asset) =>
      isHeroTicker(asset.ticker) &&
      `${asset.name} ${asset.ticker} ${asset.sector}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  function preset(tickers: string[]) {
    const eligible = tickers.filter((ticker) => available.includes(ticker));
    setSelected(eligible);
    setMessage("");
    setAmounts((previous) => ({
      ...previous,
      ...Object.fromEntries(
        eligible.map((ticker) => [ticker, previous[ticker] ?? "500"]),
      ),
    }));
  }
  function toggle(ticker: string) {
    setSelected((previous) =>
      previous.includes(ticker)
        ? previous.filter((item) => item !== ticker)
        : [...previous, ticker],
    );
    setAmounts((previous) => ({
      ...previous,
      [ticker]: previous[ticker] ?? "500",
    }));
    setMessage("");
  }
  return (
    <>
      <div className={styles.intro}>
        <div>
          <h3>A bundle built for your city.</h3>
          <p>
            Choose companies and set each allocation. Next, place the buildings
            on your island and confirm them together on BNB testnet.
          </p>
        </div>
        <span className={styles.statusBadge}>{money(city.cash)} city cash</span>
      </div>
      <form
        className={styles.bundleLayout}
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(
            Object.fromEntries(selected.map((ticker) => [ticker, true])),
          );
          if (!validation.valid) {
            setMessage(validation.error);
            return;
          }
          const items = validation.tickers.map((ticker) => ({
            kind: catalogue.find((definition) => definition.ticker === ticker)!
              .kind,
            amount: Number(amounts[ticker]),
          }));
          const result = onBuyBundle(items);
          if (result) setMessage(result);
        }}
      >
        <section ref={chooser}>
          <div className={styles.sectionHeading}>
            <h4>Choose your companies</h4>
            <span>{available.length} available</span>
          </div>
          <p className={styles.caption}>
            One building per company. Presets are selection shortcuts, not
            investment recommendations.
          </p>
          <div className={styles.bundlePresets}>
            <button
              className={styles.chip}
              type="button"
              onClick={() => preset(["NVDA", "AAPL", "MSFT", "GOOGL"])}
            >
              Large-cap tech
            </button>
            <button
              className={styles.chip}
              type="button"
              onClick={() =>
                preset(
                  [
                    ...new Set(
                      assets
                        .filter((asset) => available.includes(asset.ticker))
                        .map((asset) => asset.sector),
                    ),
                  ]
                    .slice(0, 6)
                    .flatMap(
                      (sector) =>
                        assets.find(
                          (asset) =>
                            asset.sector === sector &&
                            available.includes(asset.ticker),
                        )?.ticker ?? [],
                    ),
                )
              }
            >
              Sector mix
            </button>
            <button
              className={styles.textButton}
              type="button"
              onClick={() => {
                setSelected([]);
                setMessage("");
              }}
            >
              Clear selection
            </button>
          </div>
          <label className={styles.search}>
            <span className={styles.srOnly}>Search bundle companies</span>
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a company…"
            />
          </label>
          <div className={styles.selectionBar}>
            <span>{selected.length} companies selected</span>
            <button
              className={styles.textButton}
              type="button"
              disabled={!selected.length}
              onClick={() => review.current?.scrollIntoView({ block: "start" })}
            >
              Review allocations <ChevronDown size={14} />
            </button>
          </div>
          <div className={styles.bundleGrid}>
            {options.map((asset) => {
              const definition = catalogue.find(
                (item) => item.ticker === asset.ticker,
              )!;
              return (
                <button
                  key={asset.ticker}
                  type="button"
                  className={styles.bundleOption}
                  aria-pressed={selected.includes(asset.ticker)}
                  disabled={!available.includes(asset.ticker)}
                  onClick={() => toggle(asset.ticker)}
                >
                  <Image
                    src={sprite(definition.image)}
                    alt=""
                    width={48}
                    height={48}
                    sizes="48px"
                    quality={85}
                  />
                  {selected.includes(asset.ticker) && <Check size={18} />}
                  <strong>{asset.ticker}</strong>
                  <small>
                    {available.includes(asset.ticker)
                      ? asset.sector
                      : "Already on your island"}
                  </small>
                </button>
              );
            })}
          </div>
          {!options.length && (
            <p className={styles.notice}>
              No companies match that search. Try a ticker or clear the search.
            </p>
          )}
        </section>
        <aside ref={review} className={styles.bundleReview}>
          <div className={styles.sectionHeading}>
            <h4>Your bundle</h4>
            <button
              className={styles.textButton}
              type="button"
              onClick={() =>
                chooser.current?.scrollIntoView({ block: "start" })
              }
            >
              Edit companies
            </button>
          </div>
          <p className={styles.caption}>
            {selected.length
              ? `${selected.length} companies selected. Set an amount for every company.`
              : "Pick companies to start your bundle."}
          </p>
          {selected.length > 0 && (
            <>
              <label className={styles.field}>
                Quick allocation
                <select
                  value=""
                  onChange={(event) =>
                    setAmounts((previous) => ({
                      ...previous,
                      ...Object.fromEntries(
                        selected.map((ticker) => [ticker, event.target.value]),
                      ),
                    }))
                  }
                >
                  <option value="" disabled>
                    Set the same amount for all
                  </option>
                  {[100, 500, 1000].map((amount) => (
                    <option key={amount} value={amount}>
                      {money(amount)} per company
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.bundleAmounts}>
                {selected.map((ticker) => (
                  <div className={styles.field} key={ticker}>
                    <span className={styles.bundleAmountLabel}>
                      <label htmlFor={`bundle-${ticker}`}>{ticker} · USD</label>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label={`Remove ${ticker} from bundle`}
                        onClick={() => toggle(ticker)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                    <input
                      id={`bundle-${ticker}`}
                      type="text"
                      inputMode="decimal"
                      value={amounts[ticker] ?? ""}
                      aria-invalid={Boolean(
                        touched[ticker] && validation.errors[ticker],
                      )}
                      aria-describedby={`bundle-${ticker}-hint`}
                      onBlur={() =>
                        setTouched((previous) => ({
                          ...previous,
                          [ticker]: true,
                        }))
                      }
                      onChange={(event) => {
                        setAmounts((previous) => ({
                          ...previous,
                          [ticker]: event.target.value,
                        }));
                        setMessage("");
                      }}
                    />
                    <small
                      id={`bundle-${ticker}-hint`}
                      className={
                        touched[ticker] && validation.errors[ticker]
                          ? styles.loss
                          : ""
                      }
                    >
                      {touched[ticker] && validation.errors[ticker]
                        ? validation.errors[ticker]
                        : Number.isFinite(Number(amounts[ticker]))
                          ? `≈ ${(Number(amounts[ticker] || 0) / priceOf(ticker, prices)).toLocaleString(undefined, { maximumFractionDigits: 4 })} estimated units`
                          : "Enter a valid USD amount"}
                    </small>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={styles.bundleTotal}>
            <span>Bundle total</span>
            <strong>{money(validation.total)}</strong>
          </div>
          <p className={styles.caption}>
            {money(Math.max(0, city.cash - validation.total))} city cash after
            placement.
          </p>
          {selected.some(
            (ticker) => feed.quotes[ticker]?.status !== "live",
          ) && (
            <p className={styles.warning}>
              Some estimates use stale or illustrative city quotes. Refresh
              market data before continuing.
            </p>
          )}
          <button
            className={styles.primary}
            type="submit"
            disabled={!validation.valid}
          >
            Place bundle on island <ArrowUpRight size={16} />
          </button>
          {validation.error && (
            <p className={styles.caption}>{validation.error}</p>
          )}
          {message && (
            <p className={styles.warning} role="alert">
              {message}
            </p>
          )}
          <p className={styles.caption}>
            No transaction is sent here. The confirmation step uses one batch
            transaction; allowance approval may require an extra signature.
          </p>
        </aside>
      </form>
      <ol className={styles.bundleSteps}>
        <li>Choose companies and amounts.</li>
        <li>Place each draft on the island.</li>
        <li>Confirm the batch in City Hall or on the canvas.</li>
      </ol>
    </>
  );
}
