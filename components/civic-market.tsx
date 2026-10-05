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
  SECTOR_DEFINITIONS,
  defForSector,
  type SectorBuildingKind,
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
            <Layers size={16} /> Baskets & Bundles
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
                      : "Select an asset to inspect details, buy directly, or add to a sector basket."}
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
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [splitBudget, setSplitBudget] = useState("3000");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const review = useRef<HTMLElement>(null);
  const chooser = useRef<HTMLElement>(null);

  const validation = validateBundle(selected, amounts, available, city.cash);

  const filteredOptions = assets.filter((asset) => {
    if (selectedSector === "hero") {
      if (!isHeroTicker(asset.ticker)) return false;
    } else if (selectedSector !== "all") {
      const secDef = defForSector(selectedSector);
      if (!secDef || !secDef.stocks.includes(asset.ticker)) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matches =
        asset.name.toLowerCase().includes(q) ||
        asset.ticker.toLowerCase().includes(q) ||
        asset.sector.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

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

  function toggleSectorBasket(secKey: SectorBuildingKind) {
    const secDef = defForSector(secKey);
    if (!secDef) return;
    const unbuilt = secDef.stocks.filter((ticker) =>
      available.includes(ticker),
    );
    if (!unbuilt.length) {
      setMessage(
        `All stocks in ${secDef.name} are already built on your island.`,
      );
      return;
    }
    const allSelected = unbuilt.every((ticker) => selected.includes(ticker));
    if (allSelected) {
      setSelected((prev) => prev.filter((t) => !unbuilt.includes(t)));
      setMessage(`Removed ${secDef.name} stocks from basket.`);
    } else {
      setSelected((prev) => [...new Set([...prev, ...unbuilt])]);
      setAmounts((prev) => ({
        ...prev,
        ...Object.fromEntries(unbuilt.map((t) => [t, prev[t] ?? "500"])),
      }));
      setMessage(
        `Added ${unbuilt.length} stocks from ${secDef.name} to basket.`,
      );
    }
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

  function handleSplitBudget() {
    const total = parseFloat(splitBudget);
    if (!Number.isFinite(total) || total <= 0) {
      setMessage("Enter a valid total budget to distribute.");
      return;
    }
    if (!selected.length) {
      setMessage("Select at least one company first.");
      return;
    }
    const perStock = Math.max(1, Math.floor(total / selected.length));
    setAmounts((prev) => ({
      ...prev,
      ...Object.fromEntries(selected.map((t) => [t, String(perStock)])),
    }));
    setMessage(
      `Distributed ${money(total)} evenly (${money(perStock)} per company).`,
    );
  }

  const activeSectorDef =
    selectedSector !== "all" && selectedSector !== "hero"
      ? defForSector(selectedSector)
      : null;

  const unbuiltInActiveSector = activeSectorDef
    ? activeSectorDef.stocks.filter((t) => available.includes(t))
    : selectedSector === "hero"
      ? assets
          .filter((a) => isHeroTicker(a.ticker) && available.includes(a.ticker))
          .map((a) => a.ticker)
      : [];

  const allActiveSectorSelected =
    unbuiltInActiveSector.length > 0 &&
    unbuiltInActiveSector.every((t) => selected.includes(t));

  return (
    <>
      <div className={styles.intro}>
        <div>
          <h3>City Baskets & Sector Bundles</h3>
          <p>
            Assemble multi-stock baskets by sector or hand-pick individual
            companies. Place your building drafts on the island, then confirm
            together in one transaction on BNB Smart Chain.
          </p>
        </div>
        <span className={styles.statusBadge}>{money(city.cash)} city cash</span>
      </div>

      {/* 1-Click Sector Baskets Carousel */}
      <section
        className={styles.sectorBasketsSection}
        aria-label="1-Click Sector Baskets"
      >
        <div className={styles.sectionHeading}>
          <h4>1-Click Sector Baskets</h4>
          <span>10 industry sectors</span>
        </div>
        <div className={styles.sectorPresetsRow}>
          {SECTOR_DEFINITIONS.map((sec) => {
            const unbuiltCount = sec.stocks.filter((t) =>
              available.includes(t),
            ).length;
            const selectedCount = sec.stocks.filter((t) =>
              selected.includes(t),
            ).length;
            const isAllSelected =
              unbuiltCount > 0 &&
              sec.stocks
                .filter((t) => available.includes(t))
                .every((t) => selected.includes(t));
            return (
              <button
                key={sec.key}
                type="button"
                className={styles.sectorPresetBtn}
                aria-pressed={isAllSelected}
                onClick={() => toggleSectorBasket(sec.key)}
                title={`Toggle ${sec.name} basket`}
              >
                <div className={styles.sectorPresetHeader}>
                  <span
                    className={styles.sectorPill}
                    style={{
                      backgroundColor: `${sec.color}22`,
                      color: sec.color,
                      border: `1px solid ${sec.color}55`,
                    }}
                  >
                    {sec.badge}
                  </span>
                  {isAllSelected && (
                    <Check size={14} style={{ color: "var(--accent)" }} />
                  )}
                </div>
                <span className={styles.sectorPresetName}>
                  {sec.name.replace(
                    / Tower| Complex| Plaza| Grid & Terminal| Works| Network Hub| Pavilion| Conglomerate| Foundry| Exchange/,
                    "",
                  )}
                </span>
                <span className={styles.sectorPresetCount}>
                  {selectedCount > 0
                    ? `${selectedCount}/${sec.stocks.length} selected`
                    : `${unbuiltCount}/${sec.stocks.length} available`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

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
            <span>{available.length} of 100 available</span>
          </div>
          <p className={styles.caption}>
            Pick companies one by one or filter by sector. One building per
            company.
          </p>

          {/* Quick Thematic Presets */}
          <div className={styles.bundlePresets}>
            <button
              className={styles.chip}
              type="button"
              onClick={() => preset(["NVDA", "AAPL", "MSFT", "GOOGL", "AMZN"])}
            >
              Mega-cap tech
            </button>
            <button
              className={styles.chip}
              type="button"
              onClick={() => preset(["SPY", "QQQ", "IWM", "VTI", "VOO"])}
            >
              Broad index ETFs
            </button>
            <button
              className={styles.chip}
              type="button"
              onClick={() =>
                preset(
                  SECTOR_DEFINITIONS.map(
                    (sec) =>
                      sec.stocks.find((t) => available.includes(t)) ?? "",
                  ).filter(Boolean),
                )
              }
            >
              10-Sector mix
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

          {/* Sector Filter Tabs */}
          <div
            className={styles.sectorFilterTabs}
            role="tablist"
            aria-label="Filter stocks by sector"
          >
            <button
              type="button"
              className={`${styles.sectorFilterTab} ${selectedSector === "all" ? styles.sectorFilterTabActive : ""}`}
              onClick={() => setSelectedSector("all")}
            >
              All Stocks (100)
            </button>
            <button
              type="button"
              className={`${styles.sectorFilterTab} ${selectedSector === "hero" ? styles.sectorFilterTabActive : ""}`}
              onClick={() => setSelectedSector("hero")}
            >
              Hero Bespoke (30)
            </button>
            {SECTOR_DEFINITIONS.map((sec) => (
              <button
                key={sec.key}
                type="button"
                className={`${styles.sectorFilterTab} ${selectedSector === sec.key ? styles.sectorFilterTabActive : ""}`}
                onClick={() => setSelectedSector(sec.key)}
              >
                {sec.badge} ({sec.stocks.length})
              </button>
            ))}
          </div>

          {/* Active Sector Banner (if a sector or hero tab is active) */}
          {(activeSectorDef || selectedSector === "hero") && (
            <div className={styles.sectorBanner}>
              <div className={styles.sectorBannerInfo}>
                <div className={styles.sectorBannerTitle}>
                  <span
                    className={styles.sectorPill}
                    style={{
                      backgroundColor: `${activeSectorDef?.color ?? "#f0b90b"}22`,
                      color: activeSectorDef?.color ?? "#f0b90b",
                      border: `1px solid ${activeSectorDef?.color ?? "#f0b90b"}55`,
                    }}
                  >
                    {activeSectorDef?.badge ?? "HERO"}
                  </span>
                  <span>
                    {activeSectorDef?.name ?? "Bespoke Corporate Headquarters"}
                  </span>
                </div>
                <p className={styles.sectorBannerDesc}>
                  {activeSectorDef?.description ??
                    "30 flagship global corporations with dedicated 4-tier architectural models."}
                </p>
              </div>
              {unbuiltInActiveSector.length > 0 && (
                <button
                  type="button"
                  className={styles.sectorBannerBtn}
                  onClick={() => {
                    if (allActiveSectorSelected) {
                      setSelected((prev) =>
                        prev.filter((t) => !unbuiltInActiveSector.includes(t)),
                      );
                    } else {
                      setSelected((prev) => [
                        ...new Set([...prev, ...unbuiltInActiveSector]),
                      ]);
                      setAmounts((prev) => ({
                        ...prev,
                        ...Object.fromEntries(
                          unbuiltInActiveSector.map((t) => [
                            t,
                            prev[t] ?? "500",
                          ]),
                        ),
                      }));
                    }
                  }}
                >
                  {allActiveSectorSelected
                    ? `Deselect ${unbuiltInActiveSector.length} stocks`
                    : `+ Add all ${unbuiltInActiveSector.length} available`}
                </button>
              )}
            </div>
          )}

          {/* Search bar */}
          <label className={styles.search}>
            <span className={styles.srOnly}>Search bundle companies</span>
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search 100 stocks by ticker, company, or sector…"
            />
          </label>

          <div className={styles.selectionBar}>
            <span>{selected.length} companies selected in basket</span>
            <button
              className={styles.textButton}
              type="button"
              disabled={!selected.length}
              onClick={() => review.current?.scrollIntoView({ block: "start" })}
            >
              Review allocations <ChevronDown size={14} />
            </button>
          </div>

          {/* Stock Grid */}
          <div className={styles.bundleGrid}>
            {filteredOptions.map((asset) => {
              const definition = catalogue.find(
                (item) => item.ticker === asset.ticker,
              );
              if (!definition) return null;
              const isAvailable = available.includes(asset.ticker);
              const isSelected = selected.includes(asset.ticker);
              const price = priceOf(asset.ticker, prices);
              const secDef = definition.sectorKey
                ? defForSector(definition.sectorKey)
                : null;
              const badgeColor =
                secDef?.color ??
                (isHeroTicker(asset.ticker) ? "#f0b90b" : "#38bdf8");
              const badgeText =
                secDef?.badge ??
                (isHeroTicker(asset.ticker)
                  ? "HERO"
                  : asset.sector.slice(0, 4).toUpperCase());

              return (
                <button
                  key={asset.ticker}
                  type="button"
                  className={styles.bundleOption}
                  aria-pressed={isSelected}
                  disabled={!isAvailable}
                  onClick={() => toggle(asset.ticker)}
                >
                  <div className={styles.bundleCardTop}>
                    <StockLogo
                      ticker={asset.ticker}
                      name={asset.name}
                      size={36}
                      shape="rounded"
                    />
                    <span
                      className={styles.sectorPill}
                      style={{
                        backgroundColor: `${badgeColor}22`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}55`,
                      }}
                    >
                      {badgeText}
                    </span>
                  </div>
                  {isSelected && (
                    <Check size={18} style={{ color: "var(--accent)" }} />
                  )}
                  <strong>{asset.ticker}</strong>
                  <small>
                    {isAvailable ? asset.name : "Already on island"}
                  </small>
                  <div className={styles.bundleCardPrice}>
                    <span>Price</span>
                    <strong>{money(price)}</strong>
                  </div>
                </button>
              );
            })}
          </div>

          {!filteredOptions.length && (
            <p className={styles.notice}>
              No companies match your filters. Try clearing the search or
              choosing another sector tab.
            </p>
          )}
        </section>

        {/* Review Sidebar */}
        <aside ref={review} className={styles.bundleReview}>
          <div className={styles.sectionHeading}>
            <h4>Your basket</h4>
            <button
              className={styles.textButton}
              type="button"
              onClick={() =>
                chooser.current?.scrollIntoView({ block: "start" })
              }
            >
              Pick more
            </button>
          </div>
          <p className={styles.caption}>
            {selected.length
              ? `${selected.length} ${selected.length === 1 ? "company" : "companies"} selected. Set allocation per company.`
              : "Pick companies or choose a sector basket above."}
          </p>

          {selected.length > 0 && (
            <>
              {/* Quick Allocation dropdown */}
              <label className={styles.field}>
                Uniform allocation
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
                    Set same amount for all
                  </option>
                  {[100, 250, 500, 1000, 2500].map((amount) => (
                    <option key={amount} value={amount}>
                      {money(amount)} per company
                    </option>
                  ))}
                </select>
              </label>

              {/* Even Budget Splitter */}
              <div className={styles.field}>
                <span style={{ fontSize: "12px", color: "var(--subtle)" }}>
                  Distribute total budget evenly
                </span>
                <div className={styles.evenSplitBox}>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.evenSplitInput}
                    value={splitBudget}
                    onChange={(e) => setSplitBudget(e.target.value)}
                    placeholder="Total e.g. 3000"
                    aria-label="Total budget to distribute evenly"
                  />
                  <button
                    type="button"
                    className={styles.evenSplitBtn}
                    onClick={handleSplitBudget}
                  >
                    Distribute
                  </button>
                </div>
              </div>

              {/* Selected List */}
              <div className={styles.bundleAmounts}>
                {selected.map((ticker) => {
                  return (
                    <div className={styles.field} key={ticker}>
                      <span className={styles.bundleAmountLabel}>
                        <label
                          htmlFor={`bundle-${ticker}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <StockLogo ticker={ticker} size={18} shape="circle" />
                          <strong>{ticker}</strong>
                          <span
                            style={{ fontSize: "11px", color: "var(--subtle)" }}
                          >
                            · USD
                          </span>
                        </label>
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
                            ? `≈ ${(Number(amounts[ticker] || 0) / priceOf(ticker, prices)).toLocaleString(undefined, { maximumFractionDigits: 4 })} units @ ${money(priceOf(ticker, prices))}`
                            : "Enter a valid USD amount"}
                      </small>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className={styles.bundleTotal}>
            <span>Basket total</span>
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
            {selected.length === 1
              ? `Place ${selected[0]} on island · ${money(validation.total)}`
              : `Place basket on island (${selected.length} companies) · ${money(validation.total)}`}{" "}
            <ArrowUpRight size={16} />
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
            No transaction is sent here. Place buildings on your island, then
            confirm together in 1 transaction on BNB Smart Chain.
          </p>
        </aside>
      </form>

      <ol className={styles.bundleSteps}>
        <li>Pick a sector basket or choose individual companies.</li>
        <li>Place each building draft on the island.</li>
        <li>Confirm all positions in 1 signature on BSC Testnet.</li>
      </ol>
    </>
  );
}
