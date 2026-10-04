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
}: BuildingCatalogueModalProps) {
  const [selectedKind, setSelectedKind] = useState<BuildingKind | null>(null);
  const [amount, setAmount] = useState<number>(500);
  const [search, setSearch] = useState("");

  // Sync initialKind if provided when opened
  useEffect(() => {
    if (open) {
      if (initialKind) {
        setSelectedKind(initialKind);
        const def = defFor(initialKind);
        setAmount(def.ticker ? 500 : def.cost);
      } else {
        setSelectedKind(null);
      }
      setSearch("");
    }
  }, [open, initialKind]);

  // Handle escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedKind) {
          setSelectedKind(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, selectedKind, onClose]);

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

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
      >
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
                  onSelectCategory("companies");
                }}
              >
                <span>Companies{!hasExchange ? " · Locked" : ""}</span>
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
          {currentCategory === "companies" && !hasExchange ? (
            <div className={styles.companiesLocked}>
              <div className={styles.lockIconBox}>
                <Landmark size={32} />
              </div>
              <div className={styles.lockText}>
                <h3>Open the Market First</h3>
                <p>
                  Build the Stock Exchange service building to unlock tokenized
                  company buildings and 24/7 trading.
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
                    services, and transit network. Vehicles navigate connected routes automatically.
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
          ) : selectedKind && selectedDef ? (
            /* REVAMPED ORDER FORM VIEW (Single Mode) */
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
                        <span className={styles.priceLabel}>Current Share Price</span>
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
                      />

                      {/* Commit button */}
                      {Boolean(selectedDef && builtKinds?.has(selectedDef.kind)) ? (
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
                            {selectedDef.name} is already placed on your island. Each stock building can only be built once.
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
                              Pay {money(Number.isFinite(amount) ? amount : 0)} &
                              Place on Island
                            </span>
                            <ArrowUpRight size={18} />
                          </button>
                          <small className={styles.signatureNote}>
                            ⚡ Direct on-chain placement: prompts wallet signature
                            immediately upon placing on the grid.
                          </small>
                        </>
                      )}
                    </>
                  ) : (
                    /* Service Building Form */
                    <>
                      <div className={styles.servicePriceBox}>
                        <span className={styles.priceLabel}>Construction Cost</span>
                        <div className={styles.serviceCostBig}>
                          {wholeMoney(selectedDef.cost)}
                        </div>
                        <small className={styles.subMeta}>
                          One-time municipal expenditure funded from city treasury.
                        </small>
                      </div>

                      {/* Real-time Pre-flight Checks for service */}
                      <OrderPreflight
                        amount={selectedDef.cost}
                        itemCount={1}
                        walletAddress={walletAddress}
                        compact
                      />

                      {Boolean(selectedDef && builtKinds?.has(selectedDef.kind)) ? (
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
                            {selectedDef.name} is already placed on your island. Each civic service building can only be built once.
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
            /* BUILDINGS CATALOGUE VERTICAL GRID (Up to Down, Scroll Down) */
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

              {/* Vertical Grid: Flows up to down, scrolls down */}
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
