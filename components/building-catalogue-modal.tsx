import React, { useState, useEffect } from "react";
import {
  X,
  ChevronRight,
  ArrowLeft,
  ArrowUpRight,
  Search,
  Landmark,
  Layers,
  Coins,
  Check,
} from "lucide-react";
import {
  catalogue,
  defFor,
  sprite,
  money,
  wholeMoney,
  priceOf,
  type Category,
  type BuildingKind,
  type BuildingDef,
  type SectorBuildingKind,
  SECTOR_DEFINITIONS,
  defForSector,
} from "../lib/city";
import StockLogo from "./stock-logo";
import { OrderPreflight } from "./order-preflight";
import styles from "./building-catalogue-modal.module.css";

interface BuildingCatalogueModalProps {
  open: boolean;
  category: Category | null;
  onSelectCategory: (cat: Category) => void;
  onClose: () => void;
  hasExchange: boolean;
  cityCash: number;
  prices: Record<string, number>;
  walletAddress?: `0x${string}` | null | undefined;
  initialKind?: BuildingKind | null;
  builtKinds?: Set<BuildingKind>;
  onStartDrawRoad: () => void;
  onPayAndPlace: (kind: BuildingKind, amount: number) => void;
  onClaimFaucet?: () => void;
}

export function BuildingCatalogueModal({
  open,
  category,
  onSelectCategory,
  onClose,
  hasExchange,
  cityCash,
  prices,
  walletAddress,
  initialKind = null,
  builtKinds,
  onStartDrawRoad,
  onPayAndPlace,
  onClaimFaucet,
}: BuildingCatalogueModalProps) {
  const [selectedKind, setSelectedKind] = useState<BuildingKind | null>(null);
  const [selectedSectorKey, setSelectedSectorKey] =
    useState<SectorBuildingKind | null>(null);
  const [selectedSectorStock, setSelectedSectorStock] = useState<string | null>(
    null,
  );
  const [amount, setAmount] = useState<number>(500);
  const [search, setSearch] = useState("");
  const [sectorSearch, setSectorSearch] = useState("");

  // Sync initialKind if provided when opened
  useEffect(() => {
    if (open) {
      if (initialKind) {
        const def = defFor(initialKind);
        if (def?.category === "sectors") {
          const secKey =
            def.sectorKey ??
            (def.kind.startsWith("sector_")
              ? (def.kind as SectorBuildingKind)
              : null);
          if (secKey) {
            setSelectedSectorKey(secKey);
            setSelectedSectorStock(def.ticker ?? null);
            setSelectedKind(null);
          } else {
            setSelectedKind(initialKind);
          }
        } else {
          setSelectedKind(initialKind);
          setSelectedSectorKey(null);
          setSelectedSectorStock(null);
        }
        setAmount(def?.ticker ? 500 : (def?.cost ?? 500));
      } else {
        setSelectedKind(null);
        setSelectedSectorKey(null);
        setSelectedSectorStock(null);
      }
      setSearch("");
      setSectorSearch("");
    }
  }, [open, initialKind]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSectorStock) {
          setSelectedSectorStock(null);
        } else if (selectedSectorKey) {
          setSelectedSectorKey(null);
        } else if (selectedKind) {
          setSelectedKind(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedKind, selectedSectorKey, selectedSectorStock, onClose]);

  if (!open || !category) return null;

  const currentCategory = category;
  const selectedDef = selectedKind ? defFor(selectedKind) : null;
  const stockPrice = selectedDef?.ticker
    ? priceOf(selectedDef.ticker, prices)
    : 0;
  const calculatedShares =
    stockPrice > 0 && Number.isFinite(amount) ? amount / stockPrice : 0;
  const validAmount =
    Number.isFinite(amount) && amount >= 1 && amount <= cityCash;

  const filteredBuildings: BuildingDef[] = (catalogue as BuildingDef[])
    .filter((d: BuildingDef) => d.category === currentCategory)
    .filter((d: BuildingDef) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        Boolean(d.ticker && d.ticker.toLowerCase().includes(q))
      );
    });

  const handleSelectBuilding = (b: BuildingDef) => {
    setSelectedKind(b.kind);
    setAmount(b.ticker ? 500 : b.cost);
  };

  const handlePresetClick = (preset: number) => {
    setAmount(preset);
  };

  const handleMaxClick = () => {
    setAmount(Math.max(1, Math.floor(cityCash)));
  };

  // Active sector definition for Special Sector Form
  const activeSector = selectedSectorKey
    ? defForSector(selectedSectorKey)
    : null;

  // Stocks in active sector
  const activeSectorStocks: BuildingDef[] = activeSector
    ? activeSector.stocks
        .map((t) => catalogue.find((d) => d.ticker === t))
        .filter((d): d is BuildingDef => Boolean(d))
        .filter((d) => {
          if (!sectorSearch.trim()) return true;
          const q = sectorSearch.toLowerCase();
          return (
            d.name.toLowerCase().includes(q) ||
            Boolean(d.ticker && d.ticker.toLowerCase().includes(q))
          );
        })
    : [];

  const chosenStockDef = selectedSectorStock
    ? catalogue.find((d) => d.ticker === selectedSectorStock)
    : null;
  const chosenStockPrice = chosenStockDef?.ticker
    ? priceOf(chosenStockDef.ticker, prices)
    : 0;
  const chosenStockShares =
    chosenStockPrice > 0 && Number.isFinite(amount)
      ? amount / chosenStockPrice
      : 0;
  const isStockAlreadyBuilt = Boolean(
    chosenStockDef && builtKinds?.has(chosenStockDef.kind),
  );

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.titleBadge}>CONSTRUCTION CATALOGUE</span>
            <div className={styles.categoryTabs} role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={currentCategory === "roads"}
                className={`${styles.catTab} ${
                  currentCategory === "roads" ? styles.catTabActive : ""
                }`}
                onClick={() => {
                  setSelectedKind(null);
                  setSelectedSectorKey(null);
                  setSelectedSectorStock(null);
                  onSelectCategory("roads");
                }}
              >
                <span>Roads</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currentCategory === "companies"}
                className={`${styles.catTab} ${
                  currentCategory === "companies" ? styles.catTabActive : ""
                }`}
                onClick={() => {
                  setSelectedKind(null);
                  setSelectedSectorKey(null);
                  setSelectedSectorStock(null);
                  onSelectCategory("companies");
                }}
              >
                <span>Companies{!hasExchange ? " · Locked" : ""}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currentCategory === "sectors"}
                className={`${styles.catTab} ${
                  currentCategory === "sectors" ? styles.catTabActive : ""
                }`}
                onClick={() => {
                  setSelectedKind(null);
                  setSelectedSectorKey(null);
                  setSelectedSectorStock(null);
                  onSelectCategory("sectors");
                }}
              >
                <span>Sectors{!hasExchange ? " · Locked" : ""}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currentCategory === "services"}
                className={`${styles.catTab} ${
                  currentCategory === "services" ? styles.catTabActive : ""
                }`}
                onClick={() => {
                  setSelectedKind(null);
                  setSelectedSectorKey(null);
                  setSelectedSectorStock(null);
                  onSelectCategory("services");
                }}
              >
                <span>Services</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close catalogue"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content Body */}
        <div className={styles.body}>
          {(currentCategory === "companies" || currentCategory === "sectors") &&
          !hasExchange ? (
            <div className={styles.companiesLocked}>
              <div className={styles.lockIconBox}>
                <Landmark size={32} />
              </div>
              <div className={styles.lockText}>
                <h3>Open the Market First</h3>
                <p>
                  Build the Stock Exchange service building to unlock tokenized
                  company buildings, sector towers, and 24/7 trading.
                </p>
              </div>
              <button
                type="button"
                className={styles.primaryActionBtn}
                onClick={() => onSelectCategory("services")}
              >
                Build Services
                <ChevronRight size={16} />
              </button>
            </div>
          ) : currentCategory === "roads" ? (
            <div className={styles.roadsView}>
              <div className={styles.roadCardLarge}>
                <div className={styles.roadImgBox}>
                  <img
                    src={sprite("roads/straight_ul_lr")}
                    alt="Two-lane road"
                  />
                </div>
                <div className={styles.roadDetails}>
                  <h3>Two-Lane Asphalt Road</h3>
                  <span className={styles.roadCost}>
                    {wholeMoney(10)} / tile
                  </span>
                  <p>
                    Connects company buildings to the power grid, civic
                    services, and transit network. Vehicles navigate connected
                    routes automatically.
                  </p>
                  <button
                    type="button"
                    className={styles.primaryActionBtn}
                    onClick={() => {
                      onClose();
                      onStartDrawRoad();
                    }}
                  >
                    <span>Start Drawing Roads ($10/tile)</span>
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ) : currentCategory === "sectors" ? (
            /* ========================================================
               SECTORS TAB: SPECIAL SECTOR FORM OR 10 SECTOR CARDS
               ======================================================== */
            selectedSectorKey && activeSector ? (
              /* SPECIAL SECTOR FORM: Select Sector first, then pick Company */
              <div className={styles.orderFormView}>
                <div className={styles.sectorFormHeader}>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => {
                      setSelectedSectorKey(null);
                      setSelectedSectorStock(null);
                    }}
                  >
                    <ArrowLeft size={15} />
                    <span>Back to all Sectors</span>
                  </button>
                  <div className={styles.treasuryChip}>
                    <span>Treasury Funds:</span>
                    <strong>{money(cityCash)}</strong>
                  </div>
                </div>

                {/* Horizontal Quick Switcher for all 10 Sectors */}
                <div
                  className={styles.sectorSwitcherBar}
                  role="tablist"
                  aria-label="Switch sector"
                >
                  {SECTOR_DEFINITIONS.map((sec) => (
                    <button
                      key={sec.key}
                      type="button"
                      className={`${styles.sectorSwitcherPill} ${
                        sec.key === selectedSectorKey
                          ? styles.sectorSwitcherPillActive
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedSectorKey(sec.key);
                        setSelectedSectorStock(null);
                        setSectorSearch("");
                      }}
                    >
                      {sec.badge} ·{" "}
                      {sec.name.replace(
                        / Tower| Complex| Hub| Pavilion| Works| Foundry| Plaza| Exchange| Conglomerate/g,
                        "",
                      )}
                    </button>
                  ))}
                </div>

                <div className={styles.orderFormLayout}>
                  {/* Left Column: Sector Showcase & Selected Company Representation */}
                  <div className={styles.buildingShowcase}>
                    <div className={styles.spritePodium}>
                      <img
                        src={sprite(activeSector.image)}
                        alt={activeSector.name}
                        className={styles.largeBuildingSprite}
                      />
                    </div>
                    <div className={styles.showcaseMeta}>
                      <div className={styles.showcaseTitleRow}>
                        <span
                          className={styles.sectorBadgeTag}
                          style={{
                            background: `${activeSector.color}22`,
                            color: activeSector.color,
                            border: `1px solid ${activeSector.color}44`,
                          }}
                        >
                          {activeSector.badge}
                        </span>
                        <div>
                          <h4>{activeSector.name}</h4>
                          <small className={styles.subMeta}>
                            {activeSector.sectorName} · 2×2 Footprint · Sector
                            Tower
                          </small>
                        </div>
                      </div>
                      <p className={styles.buildingDesc}>
                        {activeSector.description}
                      </p>

                      {chosenStockDef ? (
                        <div
                          style={{
                            marginTop: 6,
                            padding: "8px 10px",
                            background: "#081219",
                            border: "1px solid #1a2d39",
                            borderRadius: 6,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <StockLogo
                            ticker={chosenStockDef.ticker!}
                            name={chosenStockDef.name}
                            size={28}
                            shape="circle"
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <strong
                                style={{ fontSize: "12px", color: "#edf2f3" }}
                              >
                                {chosenStockDef.name}
                              </strong>
                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "#2bd88a",
                                  fontFamily: "ui-monospace, monospace",
                                }}
                              >
                                {money(chosenStockPrice)}
                              </span>
                            </div>
                            <small
                              style={{ fontSize: "10px", color: "#8da4b0" }}
                            >
                              Assigned company ticker: ${chosenStockDef.ticker}
                            </small>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={styles.buildingDesc}
                          style={{
                            padding: "8px 10px",
                            background: "#09151d",
                            borderRadius: 6,
                            border: "1px dashed #233b4b",
                            color: "#78bddb",
                          }}
                        >
                          👉 <strong>Step 1:</strong> Pick an S&P 100 stock from
                          the grid on the right to assign to this tower.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Company Selector & Order Placement */}
                  <div className={styles.orderFormInputs}>
                    {/* Step 1: Pick Company */}
                    <div className={styles.sectorStockPickerBox}>
                      <div className={styles.sectorStockPickerHeader}>
                        <span className={styles.sectorStockPickerTitle}>
                          1. Select Company in {activeSector.badge}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Search size={12} color="#8da4b0" />
                          <input
                            type="text"
                            placeholder="Filter stocks..."
                            value={sectorSearch}
                            onChange={(e) => setSectorSearch(e.target.value)}
                            style={{
                              background: "transparent",
                              border: 0,
                              borderBottom: "1px solid #233b4b",
                              color: "#edf2f3",
                              fontSize: "10.5px",
                              outline: "none",
                              width: "90px",
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.sectorStockGrid}>
                        {activeSectorStocks.map((sDef) => {
                          const sPrice = priceOf(sDef.ticker!, prices);
                          const isBuilt = Boolean(builtKinds?.has(sDef.kind));
                          const isSelected =
                            selectedSectorStock === sDef.ticker;
                          return (
                            <button
                              key={sDef.ticker}
                              type="button"
                              className={`${styles.sectorStockBtn} ${
                                isSelected ? styles.sectorStockBtnActive : ""
                              } ${isBuilt ? styles.sectorStockBtnBuilt : ""}`}
                              onClick={() => {
                                if (!isBuilt) {
                                  setSelectedSectorStock(sDef.ticker!);
                                  setAmount(500);
                                }
                              }}
                              disabled={isBuilt}
                              title={
                                isBuilt
                                  ? `${sDef.name} is already built on your island (1 max per company)`
                                  : `Select ${sDef.name} (${sDef.ticker})`
                              }
                            >
                              <StockLogo
                                ticker={sDef.ticker!}
                                name={sDef.name}
                                size={20}
                                shape="circle"
                              />
                              <div className={styles.sectorStockMeta}>
                                <span className={styles.sectorStockTicker}>
                                  {sDef.ticker}
                                </span>
                                <span className={styles.sectorStockName}>
                                  {sDef.name}
                                </span>
                                {isBuilt ? (
                                  <span className={styles.sectorStockBuiltPill}>
                                    ✓ Built
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      color: "#2bd88a",
                                      fontFamily: "ui-monospace, monospace",
                                    }}
                                  >
                                    {money(sPrice)}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Order Amount & Preflight */}
                    {chosenStockDef ? (
                      <>
                        <div className={styles.formGroup}>
                          <div className={styles.formLabelRow}>
                            <label htmlFor="sector-investment-nominal">
                              2. Investment Nominal Amount
                            </label>
                            <span className={styles.unitsBadge}>
                              ≈ {chosenStockShares.toFixed(4)} shares
                            </span>
                          </div>

                          <div className={styles.presetChips}>
                            {[100, 500, 1000].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className={`${styles.presetBtn} ${
                                  amount === preset
                                    ? styles.presetBtnActive
                                    : ""
                                }`}
                                onClick={() => handlePresetClick(preset)}
                              >
                                ${preset}
                              </button>
                            ))}
                            <button
                              type="button"
                              className={`${styles.presetBtn} ${
                                amount === Math.floor(cityCash)
                                  ? styles.presetBtnActive
                                  : ""
                              }`}
                              onClick={handleMaxClick}
                              title={`Max funds: ${money(cityCash)}`}
                            >
                              Max ({wholeMoney(cityCash)})
                            </button>
                          </div>

                          <div className={styles.nominalInputWrap}>
                            <span className={styles.currencyPrefix}>$</span>
                            <input
                              id="sector-investment-nominal"
                              type="number"
                              min="1"
                              step="10"
                              placeholder="Enter amount"
                              value={Number.isNaN(amount) ? "" : amount}
                              onChange={(e) =>
                                setAmount(
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                                )
                              }
                              className={styles.nominalInput}
                            />
                            <span className={styles.currencySuffix}>USD</span>
                          </div>
                        </div>

                        {/* Real-time Pre-flight Checks */}
                        <OrderPreflight
                          amount={validAmount ? amount : 0}
                          itemCount={1}
                          walletAddress={walletAddress}
                          onFaucetClaimed={onClaimFaucet}
                        />

                        {isStockAlreadyBuilt ? (
                          <>
                            <button
                              type="button"
                              className={styles.commitBtn}
                              disabled
                              style={{
                                opacity: 0.55,
                                cursor: "not-allowed",
                                background: "#1e3646",
                                color: "#8fa6b4",
                              }}
                            >
                              <span>Already Built on Island (Max 1)</span>
                            </button>
                            <p className={styles.alreadyBuiltNotice}>
                              {chosenStockDef.name} is already placed on your
                              island. Select another company to deploy a new{" "}
                              {activeSector.name}.
                            </p>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={styles.commitBtn}
                              disabled={!validAmount}
                              onClick={() => {
                                onPayAndPlace(chosenStockDef.kind, amount);
                                onClose();
                              }}
                            >
                              <span>
                                Pay{" "}
                                {money(Number.isFinite(amount) ? amount : 0)} &
                                Place {chosenStockDef.ticker} Tower
                              </span>
                              <ArrowUpRight size={18} />
                            </button>
                            <small className={styles.signatureNote}>
                              ⚡ Direct on-chain placement: multiple towers of{" "}
                              {activeSector.name} can be deployed on the island
                              by selecting different companies.
                            </small>
                          </>
                        )}
                      </>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          background: "#0d1b24",
                          borderRadius: 8,
                          border: "1px dashed #1a2d39",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            color: "#8da4b0",
                          }}
                        >
                          Select any S&P 100 company above to configure
                          investment amount and place this tower on the island.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Overview of 10 Sector Cards */
              <div className={styles.catalogueView}>
                <div className={styles.searchBarRow}>
                  <div className={styles.searchBox}>
                    <Search size={15} className={styles.searchIcon} />
                    <input
                      type="text"
                      placeholder="Search sectors or stocks (e.g. Healthcare, JNJ, Energy)..."
                      value={sectorSearch}
                      onChange={(e) => setSectorSearch(e.target.value)}
                      className={styles.searchInput}
                    />
                    {sectorSearch && (
                      <button
                        type="button"
                        className={styles.clearSearchBtn}
                        onClick={() => setSectorSearch("")}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div className={styles.catalogueStats}>
                    <span>Showing 10 S&P 100 Core Sectors (70 Companies)</span>
                  </div>
                </div>

                <div className={styles.sectorGrid}>
                  {SECTOR_DEFINITIONS.filter((sec) => {
                    if (!sectorSearch.trim()) return true;
                    const q = sectorSearch.toLowerCase();
                    return (
                      sec.name.toLowerCase().includes(q) ||
                      sec.sectorName.toLowerCase().includes(q) ||
                      sec.stocks.some((t) => t.toLowerCase().includes(q))
                    );
                  }).map((sec) => {
                    const builtCount = sec.stocks.filter((t) => {
                      const def = catalogue.find((d) => d.ticker === t);
                      return def && builtKinds?.has(def.kind);
                    }).length;
                    return (
                      <button
                        key={sec.key}
                        type="button"
                        className={styles.sectorCard}
                        onClick={() => {
                          setSelectedSectorKey(sec.key);
                          const matchedStock = sec.stocks.find(
                            (t) =>
                              t.toLowerCase() ===
                              sectorSearch.trim().toLowerCase(),
                          );
                          if (matchedStock) {
                            setSelectedSectorStock(matchedStock);
                          } else {
                            setSelectedSectorStock(null);
                          }
                        }}
                      >
                        <div className={styles.sectorCardSpriteBox}>
                          <img
                            src={sprite(sec.image)}
                            alt={sec.name}
                            className={styles.sectorCardSprite}
                          />
                        </div>
                        <div className={styles.sectorCardContent}>
                          <div className={styles.sectorCardTop}>
                            <span
                              className={styles.sectorBadgeTag}
                              style={{
                                background: `${sec.color}22`,
                                color: sec.color,
                                border: `1px solid ${sec.color}44`,
                              }}
                            >
                              {sec.badge}
                            </span>
                            <span className={styles.sectorDeployCount}>
                              {builtCount > 0
                                ? `${builtCount} / ${sec.stocks.length} Deployed`
                                : `${sec.stocks.length} Stocks`}
                            </span>
                          </div>
                          <strong className={styles.sectorCardTitle}>
                            {sec.name}
                          </strong>
                          <p className={styles.sectorCardDesc}>
                            {sec.description}
                          </p>
                          <div className={styles.sectorStockListSummary}>
                            <span>
                              {sec.stocks.slice(0, 4).join(", ")} +
                              {sec.stocks.length - 4} more
                            </span>
                            <ChevronRight size={13} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          ) : selectedKind && selectedDef ? (
            /* REVAMPED ORDER FORM VIEW (Single Mode for Companies & Services) */
            <div className={styles.orderFormView}>
              <div className={styles.orderFormHeader}>
                <button
                  type="button"
                  className={styles.backBtn}
                  onClick={() => setSelectedKind(null)}
                >
                  <ArrowLeft size={15} />
                  <span>Back to all {currentCategory}</span>
                </button>
                <div className={styles.treasuryChip}>
                  <span>Treasury Funds:</span>
                  <strong>{money(cityCash)}</strong>
                </div>
              </div>

              <div className={styles.orderFormLayout}>
                {/* Left Column: Building Showcase */}
                <div className={styles.buildingShowcase}>
                  <div className={styles.spritePodium}>
                    <img
                      src={sprite(selectedDef.image)}
                      alt={selectedDef.name}
                      className={styles.largeBuildingSprite}
                    />
                  </div>
                  <div className={styles.showcaseMeta}>
                    <div className={styles.showcaseTitleRow}>
                      {selectedDef.ticker ? (
                        <StockLogo
                          ticker={selectedDef.ticker}
                          name={selectedDef.name}
                          size={32}
                        />
                      ) : (
                        <div className={styles.serviceIconPill}>
                          <Layers size={18} />
                        </div>
                      )}
                      <div>
                        <h4>{selectedDef.name}</h4>
                        <small className={styles.subMeta}>
                          {selectedDef.ticker
                            ? `${selectedDef.ticker} · 2×2 Footprint · Tokenized Stock`
                            : "City Service · 2×2 Footprint"}
                        </small>
                      </div>
                    </div>
                    {selectedDef.ticker && (
                      <div className={styles.priceRow}>
                        <span className={styles.priceLabel}>
                          Current Share Price
                        </span>
                        <span className={styles.priceValue}>
                          {money(stockPrice)}
                        </span>
                      </div>
                    )}
                    <p className={styles.buildingDesc}>
                      {selectedDef.description}
                    </p>
                  </div>
                </div>

                {/* Right Column: Order Form & Pre-flight Checks */}
                <div className={styles.orderFormInputs}>
                  {selectedDef.ticker ? (
                    <>
                      {/* Quick-fill preset chips ($100, $500, $1,000, Max) */}
                      <div className={styles.formGroup}>
                        <div className={styles.formLabelRow}>
                          <label htmlFor="investment-nominal">
                            Investment Nominal Amount
                          </label>
                          <span className={styles.unitsBadge}>
                            ≈ {calculatedShares.toFixed(4)} shares
                          </span>
                        </div>

                        {/* Quick-fill preset chips */}
                        <div className={styles.presetChips}>
                          {[100, 500, 1000].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className={`${styles.presetBtn} ${
                                amount === preset ? styles.presetBtnActive : ""
                              }`}
                              onClick={() => handlePresetClick(preset)}
                            >
                              ${preset}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`${styles.presetBtn} ${
                              amount === Math.floor(cityCash)
                                ? styles.presetBtnActive
                                : ""
                            }`}
                            onClick={handleMaxClick}
                            title={`Max funds: ${money(cityCash)}`}
                          >
                            Max ({wholeMoney(cityCash)})
                          </button>
                        </div>

                        {/* Custom nominal input */}
                        <div className={styles.nominalInputWrap}>
                          <span className={styles.currencyPrefix}>$</span>
                          <input
                            id="investment-nominal"
                            type="number"
                            min="1"
                            step="10"
                            placeholder="Enter amount"
                            value={Number.isNaN(amount) ? "" : amount}
                            onChange={(e) =>
                              setAmount(
                                e.target.value === ""
                                  ? NaN
                                  : Number(e.target.value),
                              )
                            }
                            className={styles.nominalInput}
                          />
                          <span className={styles.currencySuffix}>USD</span>
                        </div>
                      </div>

                      {/* Real-time Pre-flight Checks */}
                      <OrderPreflight
                        amount={validAmount ? amount : 0}
                        itemCount={1}
                        walletAddress={walletAddress}
                        onFaucetClaimed={onClaimFaucet}
                      />

                      {/* Commit button */}
                      {Boolean(
                        selectedDef && builtKinds?.has(selectedDef.kind),
                      ) ? (
                        <>
                          <button
                            type="button"
                            className={styles.commitBtn}
                            disabled
                            style={{
                              opacity: 0.55,
                              cursor: "not-allowed",
                              background: "#1e3646",
                              color: "#8fa6b4",
                            }}
                          >
                            <span>Already Built on Island (Max 1)</span>
                          </button>
                          <p className={styles.alreadyBuiltNotice}>
                            {selectedDef.name} is already placed on your island.
                            Each stock building can only be built once.
                          </p>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.commitBtn}
                            disabled={!validAmount}
                            onClick={() => {
                              onPayAndPlace(selectedDef.kind, amount);
                              onClose();
                            }}
                          >
                            <span>
                              Pay {money(Number.isFinite(amount) ? amount : 0)}{" "}
                              & Place on Island
                            </span>
                            <ArrowUpRight size={18} />
                          </button>
                          <small className={styles.signatureNote}>
                            ⚡ Direct on-chain placement: prompts wallet
                            signature immediately upon placing on the grid.
                          </small>
                        </>
                      )}
                    </>
                  ) : (
                    /* Service Building Form */
                    <>
                      <div className={styles.servicePriceBox}>
                        <span className={styles.priceLabel}>
                          Construction Cost
                        </span>
                        <div className={styles.serviceCostBig}>
                          {wholeMoney(selectedDef.cost)}
                        </div>
                        <small className={styles.subMeta}>
                          One-time municipal expenditure funded from city
                          treasury.
                        </small>
                      </div>

                      {/* Real-time Pre-flight Checks for service */}
                      <OrderPreflight
                        amount={selectedDef.cost}
                        itemCount={1}
                        walletAddress={walletAddress}
                        compact
                        onFaucetClaimed={onClaimFaucet}
                      />

                      {Boolean(
                        selectedDef && builtKinds?.has(selectedDef.kind),
                      ) ? (
                        <>
                          <button
                            type="button"
                            className={styles.commitBtn}
                            disabled
                            style={{
                              opacity: 0.55,
                              cursor: "not-allowed",
                              background: "#1e3646",
                              color: "#8fa6b4",
                            }}
                          >
                            <span>Already Built on Island (Max 1)</span>
                          </button>
                          <p className={styles.alreadyBuiltNotice}>
                            {selectedDef.name} is already placed on your island.
                            Each civic service building can only be built once.
                          </p>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.commitBtn}
                          disabled={cityCash < selectedDef.cost}
                          onClick={() => {
                            onPayAndPlace(selectedDef.kind, selectedDef.cost);
                            onClose();
                          }}
                        >
                          <span>
                            Pay {wholeMoney(selectedDef.cost)} & Place on Island
                          </span>
                          <ArrowUpRight size={18} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* BUILDINGS CATALOGUE VERTICAL GRID (Companies & Services) */
            <div className={styles.catalogueView}>
              <div className={styles.searchBarRow}>
                <div className={styles.searchBox}>
                  <Search size={15} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder={`Search ${currentCategory}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={styles.searchInput}
                  />
                  {search && (
                    <button
                      type="button"
                      className={styles.clearSearchBtn}
                      onClick={() => setSearch("")}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className={styles.catalogueStats}>
                  <span>
                    Showing {filteredBuildings.length} {currentCategory}
                  </span>
                </div>
              </div>

              {/* Vertical Grid */}
              <div className={styles.verticalGrid}>
                {filteredBuildings.map((def: BuildingDef) => {
                  const p = def.ticker ? priceOf(def.ticker, prices) : def.cost;
                  const canAfford = cityCash >= (def.ticker ? 1 : def.cost);
                  const isAlreadyBuilt = Boolean(builtKinds?.has(def.kind));
                  return (
                    <button
                      key={def.kind}
                      type="button"
                      className={`${styles.buildingCard} ${
                        isAlreadyBuilt
                          ? styles.buildingCardBuilt
                          : !canAfford
                            ? styles.buildingCardDisabled
                            : ""
                      }`}
                      onClick={() => {
                        if (!isAlreadyBuilt) handleSelectBuilding(def);
                      }}
                      disabled={isAlreadyBuilt || !canAfford}
                      title={
                        isAlreadyBuilt
                          ? `${def.name} is already built on your island (Max 1 allowed)`
                          : undefined
                      }
                    >
                      {isAlreadyBuilt && (
                        <span className={styles.cardBuiltBadge}>
                          <Check size={9} /> Built
                        </span>
                      )}
                      <div className={styles.cardSpriteBox}>
                        <img
                          src={sprite(def.image)}
                          alt={def.name}
                          className={styles.cardSprite}
                        />
                        {def.ticker && (
                          <div className={styles.cardLogoFloating}>
                            <StockLogo
                              ticker={def.ticker}
                              name={def.name}
                              size={18}
                            />
                          </div>
                        )}
                      </div>
                      <div className={styles.cardInfo}>
                        <strong className={styles.cardName}>{def.name}</strong>
                        <div className={styles.cardPriceRow}>
                          <span className={styles.cardPrice}>
                            {def.ticker ? money(p) : wholeMoney(p)}
                          </span>
                          {def.ticker && (
                            <span className={styles.cardTickerBadge}>
                              {def.ticker}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
