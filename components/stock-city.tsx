"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Grid2X2,
  HelpCircle,
  Landmark,
  Layers,
  Maximize2,
  Menu,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Route,
  Search,
  Settings,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import CityMap from "./city-map";
import portfolioStyles from "./portfolio-view.module.css";
import type {
  BuildingKind,
  Category,
  Cell,
  CityState,
  PriceMap,
  Tool,
} from "../lib/city";
import {
  MARKET_SOURCE,
  PROVIDER_TAG,
  ROAD_COST,
  STORAGE,
  allocationOf,
  assetFor,
  assets,
  buildingImage,
  bulldoze,
  catalogue,
  constructBuilding,
  constructRoad,
  defFor,
  hasRoad,
  healthOf,
  isSavedCity,
  marketClock,
  money,
  newCity,
  pct,
  placementError,
  priceOf,
  quoteDiff,
  returnOf,
  sprite,
  tickMarket,
  basePrices,
  tier,
  valueOf,
  wholeMoney,
} from "../lib/city";
type Panel =
  "portfolio" | "market" | "settings" | "help" | "data" | "assets" | null;
const titles = {
  portfolio: "City finances",
  market: "Stock market",
  settings: "Game settings",
  help: "Controls",
  data: "Data status",
  assets: "Asset library",
};
export default function StockCity() {
  const [city, setCity] = useState<CityState>(newCity),
    [ready, setReady] = useState(false),
    [booted, setBooted] = useState(false),
    [tool, setActiveTool] = useState<Tool>("inspect"),
    [portfolioView, setPortfolioView] = useState(false),
    [category, setCategory] = useState<Category | null>(null),
    [buildExpanded, setBuildExpanded] = useState(false),
    [guideHidden, setGuideHidden] = useState(false),
    [kind, setKind] = useState<BuildingKind | null>(null),
    [amount, setAmount] = useState(500),
    [selected, setSelected] = useState<string | null>(null),
    [moving, setMoving] = useState<string | null>(null),
    [panel, setPanel] = useState<Panel>(null),
    [grid, setGrid] = useState(false),
    [motion, setMotion] = useState(true),
    [paused, setPaused] = useState(false),
    [speed, setSpeed] = useState(1),
    [seconds, setSeconds] = useState(0),
    [zoom, setZoom] = useState(1),
    [cameraReset, setCameraReset] = useState(0),
    [hover, setHover] = useState<Cell | null>(null),
    [notice, setNotice] = useState("Empty island ready. Draw roads to begin."),
    [noticeError, setNoticeError] = useState(false),
    [confirmReset, setConfirmReset] = useState(false),
    [search, setSearch] = useState(""),
    [libraryTab, setLibraryTab] = useState("Buildings"),
    [prices, setPrices] = useState<PriceMap>(basePrices),
    [lastRefresh, setLastRefresh] = useState(Date.now()),
    [now, setNow] = useState(Date.now()),
    [upgrades, setUpgrades] = useState<Record<string, number>>({});
  const tiers = useRef<Record<string, string>>({});
  const history = useRef<CityState[]>([]),
    future = useRef<CityState[]>([]),
    panelRef = useRef<HTMLElement>(null),
    resetRef = useRef<HTMLDivElement>(null);
  const oldFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (isSavedCity(saved)) setCity(saved);
        else {
          setNotice("Saved city was invalid. An empty island is ready.");
          setNoticeError(true);
        }
      }
    } catch {
      setNotice(
        "Could not load the saved city. Starting with an empty island.",
      );
      setNoticeError(true);
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      setMotion(false);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(STORAGE, JSON.stringify(city));
      } catch {
        setNotice("Saving is unavailable in this browser.");
        setNoticeError(true);
      }
  }, [city, ready]);
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => setSeconds((s) => s + speed), 1000);
    return () => clearInterval(interval);
  }, [paused, speed]);
  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 1400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!ready || paused) return;
    const interval = setInterval(
      () => {
        setPrices((p) => tickMarket(p));
        setLastRefresh(Date.now());
      },
      Math.max(2500, 4500 / speed),
    );
    return () => clearInterval(interval);
  }, [ready, paused, speed]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    for (const b of city.buildings) {
      if (!defFor(b.kind).ticker) continue;
      const t = tier(returnOf(b, prices));
      if (tiers.current[b.id] && tiers.current[b.id] !== t) {
        next[b.id] = Date.now();
        changed = true;
      }
      tiers.current[b.id] = t;
    }
    if (changed) {
      setUpgrades((u) => ({ ...u, ...next }));
      setNotice("A building upgraded to a new level.");
    }
  }, [prices, city.buildings]);
  const notify = (message: string, error = false) => {
    setNotice(message);
    setNoticeError(error);
  };
  const commit = (next: CityState) => {
    if (next === city) return;
    history.current = [...history.current.slice(-29), city];
    future.current = [];
    setCity(next);
  };
  const undo = () => {
    const last = history.current.pop();
    if (!last) return;
    future.current.push(city);
    setCity(last);
    setSelected(null);
    notify("Last construction action undone.");
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    history.current.push(city);
    setCity(next);
    notify("Construction action restored.");
  };
  const setTool = (next: Tool) => {
    setPortfolioView(false);
    setActiveTool(next);
  };
  const showPortfolio = () => {
    cancel();
    setPortfolioView(true);
  };
  const cancel = () => {
    setTool("inspect");
    setKind(null);
    setMoving(null);
    setSelected(null);
    setPanel(null);
    setCategory(null);
  };
  const chooseCategory = (next: Category) => {
    if (category === next) {
      cancel();
      return;
    }
    setBuildExpanded(true);
    setPanel(null);
    setSelected(null);
    setMoving(null);
    setCategory(category === next ? null : next);
    setKind(null);
    setTool(next === "roads" ? "road" : "inspect");
    notify(
      next === "roads"
        ? "Click and drag across the island to draw a road."
        : next === "companies"
          ? "Choose a company, then place its building on the island."
          : "Choose a service, then place it on the island.",
    );
  };
  const chooseBuilding = (value: BuildingKind) => {
    setKind(value);
    setTool("build");
    setSelected(null);
    setMoving(null);
    setPanel(null);
    setCategory(defFor(value).category);
    notify(`Place ${defFor(value).name}. Right-click or Esc to cancel.`);
  };
  const openPanel = (value: Panel) => {
    setPortfolioView(false);
    setPanel(panel === value ? null : value);
    setSelected(null);
  };
  const onPlace = (cell: Cell) => {
    if (!kind || !ready) return;
    if (tool === "move" && moving) {
      const error = placementError(cell, city, moving);
      if (error) {
        notify(error, true);
        return;
      }
      commit({
        ...city,
        buildings: city.buildings.map((b) =>
          b.id === moving ? { ...b, ...cell } : b,
        ),
      });
      setSelected(moving);
      setMoving(null);
      setTool("inspect");
      setKind(null);
      notify("Building moved.");
      return;
    }
    const result = constructBuilding(kind, cell, amount, city, prices);
    if (result.error) {
      notify(result.error, true);
      return;
    }
    commit(result.state);
    notify(
      `${defFor(kind).name} placed${defFor(kind).ticker ? ` at ${money(priceOf(defFor(kind).ticker!, prices))} per simulated share` : ""}. Place another, or Esc.`,
    );
  };
  const onRoad = (cells: Cell[]) => {
    if (!ready) return;
    const result = constructRoad(cells, city);
    if (result.error) {
      notify(result.error, true);
      return;
    }
    const count = result.state.roads.length - city.roads.length;
    if (!count) return;
    commit(result.state);
    notify(
      `${count} road tile${count === 1 ? "" : "s"} built · ${wholeMoney(count * ROAD_COST)}`,
    );
  };
  const onBulldoze = (cell: Cell) => {
    const result = bulldoze(cell, city, prices);
    if (result.state === city) return;
    commit(result.state);
    setSelected(null);
    notify(result.message + " Undo is available.");
  };
  const changeZoom = useCallback(
    (delta: number) =>
      setZoom((z) =>
        Math.max(1, Math.min(2, Math.round((z + delta) * 100) / 100)),
      ),
    [],
  );
  const current = city.buildings.find((b) => b.id === selected),
    definition = current ? defFor(current.kind) : null,
    buildDef = kind ? defFor(kind) : null;
  const portfolio = city.buildings.reduce(
      (sum, b) => sum + valueOf(b, prices),
      0,
    ),
    costBasis = city.buildings
      .filter((b) => defFor(b.kind).ticker)
      .reduce((s, b) => s + b.quantity * b.entry, 0),
    profits = portfolio - costBasis;
  const dayBase = costBasis || portfolio || 1;
  const dayChange = portfolio
    ? ((portfolio - dayBase * 0.995) / (dayBase * 0.995)) * 100
    : 0;
  const connected = city.buildings.filter((b) => hasRoad(b, city.roads)).length;
  const health = healthOf(city.buildings, prices);
  const alloc = allocationOf(
    city.buildings.filter((b) => defFor(b.kind).ticker),
    prices,
  );
  const clock = marketClock(new Date(lastRefresh));
  const freshSecs = Math.max(0, Math.round((now - lastRefresh) / 1000));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (confirmReset) {
        if (e.key === "Escape") {
          setConfirmReset(false);
          return;
        }
        if (e.key === "Tab") {
          const buttons =
            resetRef.current?.querySelectorAll<HTMLButtonElement>("button");
          if (buttons?.length) {
            if (e.shiftKey && document.activeElement === buttons[0]) {
              e.preventDefault();
              buttons[buttons.length - 1].focus();
            } else if (
              !e.shiftKey &&
              document.activeElement === buttons[buttons.length - 1]
            ) {
              e.preventDefault();
              buttons[0].focus();
            }
          }
        }
        return;
      }
      if (e.key === "Escape") {
        cancel();
        return;
      }
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "r":
          setBuildExpanded(true);
          setCategory("roads");
          setTool("road");
          setKind(null);
          setSelected(null);
          setPanel(null);
          break;
        case "b":
          setBuildExpanded(true);
          setCategory("companies");
          setTool("inspect");
          setKind(null);
          setPanel(null);
          break;
        case "s":
          setBuildExpanded(true);
          setCategory("services");
          setTool("inspect");
          setKind(null);
          setPanel(null);
          break;
        case "v":
          cancel();
          break;
        case "x":
          setTool("bulldoze");
          setCategory(null);
          setPanel(null);
          setSelected(null);
          break;
        case "g":
          if (!portfolioView) setGrid((v) => !v);
          break;
        case "p":
          setPaused((v) => !v);
          break;
        case "home":
          setCameraReset((n) => n + 1);
          setZoom(1);
          break;
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  useEffect(() => {
    if (panel) {
      oldFocus.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() =>
        panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      );
    } else oldFocus.current?.focus();
  }, [panel]);
  useEffect(() => {
    if (confirmReset)
      requestAnimationFrame(() =>
        resetRef.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      );
  }, [confirmReset]);
  const steps = [
    city.roads.length > 0,
    city.buildings.some((b) => defFor(b.kind).ticker),
    city.buildings.some((b) => !defFor(b.kind).ticker),
  ];
  return (
    <main className={`simcity ${category ? "tray-open" : ""}`}>
      {!booted && (
        <div className="boot-overlay" aria-label="Loading Stockva">
          <video
            className="boot-video"
            src="/assets/background-main.mp4"
            poster="/assets/background.png"
            muted
            autoPlay
            loop
            playsInline
          />
          <div className="boot-card">
            <span className="boot-kicker">STOCKVA · LOCAL SANDBOX</span>
            <strong>Building your empty island…</strong>
            <small>
              Loading island loop · placing no buildings · saving locally
            </small>
          </div>
        </div>
      )}
      <CityMap
        city={city}
        tool={tool}
        kind={kind}
        amount={amount}
        selected={selected}
        moving={moving}
        zoom={zoom}
        cameraReset={cameraReset}
        grid={grid || portfolioView}
        portfolioView={portfolioView}
        motion={motion}
        paused={paused}
        speed={speed}
        prices={prices}
        now={now}
        upgrades={upgrades}
        onZoom={changeZoom}
        onSelect={(id) => {
          setSelected(id);
          setPanel(null);
        }}
        onPlace={onPlace}
        onRoad={onRoad}
        onBulldoze={onBulldoze}
        onCancel={cancel}
        onHover={setHover}
      />
      {portfolioView && <div className={portfolioStyles.heading} role="status">
        <h2>Portfolio view</h2>
        <p>{city.buildings.some(b => !!defFor(b.kind).ticker) ? "All holdings · Unrealized return" : "No holdings yet · Place a company to begin"}</p>
        <p>Select returns to your city</p>
      </div>}
      <header className="game-header">
        <button
          className={`menu-button ${panel === "settings" ? "active" : ""}`}
          onClick={() => openPanel("settings")}
          aria-label="Game menu"
        >
          <img src={sprite("buttons/settings")} alt="" />
        </button>
        <div className="header-resources">
          <button
            className="cash-resource"
            onClick={() => openPanel("portfolio")}
          >
            <img src={sprite("buttons/portfolio")} alt="" aria-hidden="true" />
            <span>
              <small>DEMO FUNDS</small>
              <b>{wholeMoney(city.cash)}</b>
            </span>
          </button>
          <button
            className="portfolio-resource"
            onClick={() => openPanel("portfolio")}
          >
            <img src={sprite("buttons/buy")} alt="" aria-hidden="true" />
            <span>
              <small>STOCK VALUE</small>
              <b>{wholeMoney(portfolio)}</b>
            </span>
          </button>
          <button
            className="market-button"
            onClick={() => openPanel("market")}
            title="Stock market"
          >
            <GameArt index={5} />
            <span>Market</span>
          </button>
        </div>
      </header>
      {tool !== "inspect" && !category && (
        <div className="active-tool-chip" role="status">
          <GameArt
            index={
              tool === "road"
                ? 1
                : tool === "bulldoze"
                  ? 4
                  : kind && defFor(kind).category === "services"
                    ? 3
                    : 2
            }
          />
          <span>
            <strong>
              {tool === "road"
                ? "Drawing roads"
                : tool === "bulldoze"
                  ? "Bulldoze mode"
                  : `${tool === "move" ? "Move" : "Place"} ${kind ? defFor(kind).name : "building"}`}
            </strong>
            <small>
              {tool === "road"
                ? "$10 / tile · drag a route"
                : tool === "bulldoze"
                  ? "Select an object to remove"
                  : "Choose a clear plot on the island"}
            </small>
          </span>
          <button onClick={cancel} aria-label="Finish building">
            Done <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {(!city.buildings.length || !city.roads.length) && !panel && booted && !category && (
        <div className={`start-note ${guideHidden ? "minimized" : ""}`} role="status">
          <span className="step-number">
            {steps.filter(Boolean).length + 1}/3
          </span>
          {!guideHidden && (
            <span>
              <b>Empty island — build it yourself</b>
              <small>
                {steps[0] ? "✓" : "1."} Drag Roads (R) · {steps[1] ? "✓" : "2."}{" "}
                Place a company (B) · {steps[2] ? "✓" : "3."} Place a service (S)
              </small>
            </span>
          )}
          <button
            className="start-note-toggle"
            onClick={() => setGuideHidden((v) => !v)}
            aria-label={guideHidden ? "Expand guideline" : "Hide guideline"}
            title={guideHidden ? "Expand guideline" : "Hide guideline"}
          >
            {guideHidden ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}
      {category && (
        <section
          className="construction-tray"
          aria-label="Construction catalogue"
        >
          <header>
            <span>
              {category === "roads"
                ? "TRANSPORT"
                : category === "companies"
                  ? "STOCK BUILDINGS"
                  : "CITY SERVICES"}
            </span>
            <small>
              {category === "roads"
                ? "Click and drag to build"
                : category === "companies"
                  ? "Select a building, then place it on the island"
                  : "Place services wherever you need them"}
            </small>
            <button
              onClick={() => setCategory(null)}
              aria-label="Hide construction catalogue"
            >
              <ChevronDown size={16} />
            </button>
          </header>
          <div className="tray-content">
            {category === "roads" ? (
              <>
                <button
                  className={`build-card road-card ${tool === "road" ? "chosen" : ""}`}
                  onClick={() => {
                    setTool("road");
                    setKind(null);
                  }}
                >
                  <div className="card-image">
                    <img
                      src={sprite("roads/straight_ul_lr")}
                      alt="Two-lane road"
                    />
                  </div>
                  <strong>Two-lane road</strong>
                  <span>{wholeMoney(ROAD_COST)} / tile</span>
                  <kbd>R</kbd>
                </button>
                <div className="road-instructions">
                  <div
                    className="fleet-preview"
                    aria-label="Your city vehicles"
                  >
                    {[
                      "electric_bus",
                      "construction_truck",
                      "maintenance_van",
                    ].map((v) => (
                      <img
                        key={v}
                        src={sprite(`vehicles/${v}/lower_right`)}
                        alt={v.replaceAll("_", " ")}
                      />
                    ))}
                  </div>
                  <div>
                    <strong>Draw your road network</strong>
                    <p>
                      Click a starting point, drag a route, then release.
                      <br />
                      Corners and intersections connect automatically.
                    </p>
                    <span>
                      <span className="instruction-key">SPACE</span> Hold Space
                      to pan while building
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {catalogue
                  .filter((d) => d.category === category)
                  .map((d) => (
                    <button
                      key={d.kind}
                      className={`build-card ${kind === d.kind ? "chosen" : ""} ${d.category === "companies" ? "company-card" : "service-card"}`}
                      onClick={() => chooseBuilding(d.kind)}
                      disabled={!ready || city.cash < (d.ticker ? 1 : d.cost)}
                    >
                      <div className="card-image">
                        <img src={sprite(d.image)} alt={d.name} />
                      </div>
                      <strong>{d.name}</strong>
                      <span>{d.ticker ?? wholeMoney(d.cost)}</span>
                      {kind === d.kind && (
                        <Check className="card-selected" size={12} />
                      )}
                    </button>
                  ))}
                <div className="build-options">
                  {buildDef && defFor(kind!).category === category ? (
                    <>
                      <strong>{buildDef.name}</strong>
                      <span className="footprint-label">2 × 2 footprint</span>
                      {buildDef.ticker ? (
                        <>
                          <label htmlFor="build-amount">Demo position</label>
                          <div className="investment-input">
                            <span>$</span>
                            <input
                              id="build-amount"
                              type="number"
                              min="1"
                              step="50"
                              value={Number.isNaN(amount) ? "" : amount}
                              onChange={(e) =>
                                setAmount(
                                  e.target.value === ""
                                    ? NaN
                                    : Number(e.target.value),
                                )
                              }
                            />
                          </div>
                          <small>
                            {Number.isFinite(amount)
                              ? (
                                  amount / priceOf(buildDef.ticker, prices)
                                ).toFixed(3)
                              : "0"}{" "}
                            shares · {money(priceOf(buildDef.ticker, prices))} /
                            share · {PROVIDER_TAG}
                          </small>
                        </>
                      ) : (
                        <>
                          <span className="service-cost">
                            {wholeMoney(buildDef.cost)}
                          </span>
                          <small>{buildDef.description}</small>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <MousePointer2 size={20} />
                      <strong>Select a building</strong>
                      <small>
                        {category === "companies"
                          ? "Each stock position becomes a building you place yourself."
                          : "Services start unbuilt. Choose one and place it on a clear plot."}
                      </small>
                    </>
                  )}
                  {buildDef && (
                    <button
                      className="place-on-island"
                      onClick={() => setCategory(null)}
                      disabled={
                        !!buildDef.ticker &&
                        (!Number.isFinite(amount) ||
                          amount < 1 ||
                          amount > city.cash)
                      }
                    >
                      Place on island <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {current && definition && tool === "inspect" && !panel && (
        <aside className="inspection-panel" aria-label="Selected building">
          <header>
            <div>
              <small>
                {definition.category === "companies"
                  ? "STOCK BUILDING · DEMO POSITION"
                  : "CITY SERVICE"}
              </small>
              <h2>
                {definition.ticker && (
                  <span className="ticker-badge">{definition.ticker}</span>
                )}{" "}
                {definition.name}
              </h2>
            </div>
            <button
              aria-label="Close building inspector"
              onClick={() => setSelected(null)}
            >
              <X size={17} />
            </button>
          </header>
          <div className={`inspection-art ${definition.category}`}>
            <img
              src={sprite(buildingImage(current, prices))}
              alt={definition.name}
            />
            <span>
              {definition.ticker
                ? tier(returnOf(current, prices))
                    .replace("_", " ")
                    .toUpperCase()
                : "SERVICE"}
            </span>
          </div>
          <div
            className={`road-connection ${hasRoad(current, city.roads) ? "connected" : ""}`}
          >
            <Route size={13} />
            {hasRoad(current, city.roads)
              ? "Road access connected"
              : "No road access — connect a road"}
          </div>
          {definition.ticker ? (
            (() => {
              const ret = returnOf(current, prices);
              const val = valueOf(current, prices);
              const myAlloc = alloc.find((a) => a.id === current.id)?.pct ?? 0;
              const live = priceOf(definition.ticker, prices);
              return (
                <>
                  <div className="inspection-stats">
                    <span>
                      Position value<strong>{money(val)}</strong>
                    </span>
                    <span>
                      Simulated price
                      <b>{money(live)}</b>
                    </span>
                    <span>
                      Shares
                      <b>
                        {current.quantity.toFixed(4)} {definition.ticker}
                      </b>
                    </span>
                    <span>
                      Average entry<b>{money(current.entry)}</b>
                    </span>
                    <span>
                      Return
                      <b className={ret >= 0 ? "positive" : "negative"}>
                        {pct(ret)}
                      </b>
                    </span>
                    <span>
                      Allocation<b>{myAlloc.toFixed(1)}% of stocks</b>
                    </span>
                    <small>
                      {PROVIDER_TAG} · {MARKET_SOURCE} · updated {freshSecs}s
                      ago
                    </small>
                  </div>
                  <span className="chain-link">
                    Demo position · no on-chain transaction
                  </span>
                </>
              );
            })()
          ) : (
            <p className="service-description">{definition.description}</p>
          )}
          {!definition.ticker && (
            <button
              className="panel-action"
              onClick={() =>
                openPanel(
                  current.kind === "hall"
                    ? "portfolio"
                    : current.kind === "exchange"
                      ? "market"
                      : "data",
                )
              }
            >
              Open{" "}
              {current.kind === "hall"
                ? "finances"
                : current.kind === "exchange"
                  ? "market"
                  : "data status"}
              <ChevronRight size={14} />
            </button>
          )}
          <div className="inspection-actions">
            <button
              onClick={() => {
                setMoving(current.id);
                setKind(current.kind);
                setTool("move");
                setCategory(null);
                notify(
                  "Click a free plot to move this building. Esc to cancel.",
                );
              }}
            >
              Move
            </button>
            <button onClick={() => onBulldoze(current)}>
              <Trash2 size={14} />
              {definition.ticker ? "Sell & remove" : "Bulldoze"}
            </button>
          </div>
          <div className="inspection-note">
            {definition.ticker
              ? "DEMO / TESTNET mock position. Removing returns live value to demo funds."
              : "Service construction costs are not refunded."}
          </div>
        </aside>
      )}
      {panel && (
        <aside
          ref={panelRef}
          className={`utility-panel ${panel === "assets" ? "asset-panel" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label={titles[panel]}
        >
          <header>
            <h2>{titles[panel]}</h2>
            <button onClick={() => setPanel(null)} aria-label="Close panel">
              <X size={18} />
            </button>
          </header>
          {panel === "portfolio" && (
            <div className="panel-body">
              <div className="finance-total">
                <span>Available demo funds</span>
                <strong>{money(city.cash)}</strong>
              </div>
              <dl className="finance-list">
                <div>
                  <dt>Stock portfolio (live)</dt>
                  <dd>{money(portfolio)}</dd>
                </div>
                <div>
                  <dt>Day change (sim)</dt>
                  <dd className={dayChange >= 0 ? "positive" : "negative"}>
                    {pct(dayChange)}
                  </dd>
                </div>
                <div>
                  <dt>Unrealized return</dt>
                  <dd className={profits >= 0 ? "positive" : "negative"}>
                    {money(profits)}
                  </dd>
                </div>
                <div>
                  <dt>City health</dt>
                  <dd>{health.label}</dd>
                </div>
                <div>
                  <dt>Buildings / road access</dt>
                  <dd>
                    {city.buildings.length} / {connected}
                  </dd>
                </div>
                <div>
                  <dt>Road construction</dt>
                  <dd>{city.roads.length} tiles</dd>
                </div>
                <div>
                  <dt>Data freshness</dt>
                  <dd>updated {freshSecs}s ago</dd>
                </div>
              </dl>
              <p className="health-line">
                {health.detail} Not financial advice.
              </p>
              <h3>Stock positions</h3>
              {!city.buildings.some((b) => defFor(b.kind).ticker) ? (
                <div className="empty-panel">
                  <Building2 size={26} />
                  <strong>No stock buildings</strong>
                  <p>
                    Choose Companies in the construction bar and place your
                    first building.
                  </p>
                  <button
                    onClick={() => {
                      setCategory("companies");
                      setPanel(null);
                    }}
                  >
                    Open companies <ChevronRight size={13} />
                  </button>
                </div>
              ) : (
                city.buildings
                  .filter((b) => defFor(b.kind).ticker)
                  .map((b) => {
                    const a = alloc.find((x) => x.id === b.id)?.pct ?? 0;
                    return (
                      <button
                        className="holding"
                        key={b.id}
                        onClick={() => {
                          setSelected(b.id);
                          setPanel(null);
                          setTool("inspect");
                        }}
                      >
                        <span>
                          {defFor(b.kind).name}
                          <small>
                            {b.quantity.toFixed(3)} shares · {a.toFixed(1)}% ·{" "}
                            {pct(returnOf(b, prices))}
                          </small>
                          <span className="alloc-bar" aria-hidden="true">
                            <i style={{ width: `${Math.min(100, a)}%` }} />
                          </span>
                        </span>
                        <b>{money(valueOf(b, prices))}</b>
                        <ChevronRight size={13} />
                      </button>
                    );
                  })
              )}
              <p className="panel-disclaimer">
                DEMO / TESTNET mock positions. Live simulated prices drive
                building levels. Not financial advice.
              </p>
            </div>
          )}
          {panel === "market" && (
            <div className="panel-body">
              <div className="data-label">
                <span />
                {MARKET_SOURCE.toUpperCase()} · {clock.label.toUpperCase()} ·{" "}
                {freshSecs}S AGO
              </div>
              <label className="market-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search stocks"
                  placeholder="Search 20 tracked stocks"
                />
              </label>
              <div className="market-rows">
                {assets
                  .filter((a) =>
                    `${a.name} ${a.ticker}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((a) => {
                    const live = priceOf(a.ticker, prices);
                    const chg =
                      a.price !== 0
                        ? ((live - a.price) / a.price) * 100
                        : a.change;
                    return (
                      <div className="market-row" key={a.ticker}>
                        <span>
                          <strong>{a.ticker}</strong>
                          <small>
                            {a.name} · {PROVIDER_TAG}
                          </small>
                        </span>
                        <span>
                          <b>{money(live)}</b>
                          <small className={chg >= 0 ? "positive" : "negative"}>
                            {pct(chg)}
                          </small>
                        </span>
                        {a.sprite ? (
                          <button
                            aria-label={`Build ${a.name} (demo mock position)`}
                            title="Demo mock position — not live equity"
                            onClick={() =>
                              chooseBuilding(a.sprite as BuildingKind)
                            }
                          >
                            <Plus size={15} />
                          </button>
                        ) : (
                          <span className="watch-only">
                            Watch
                            <br />
                            only
                          </span>
                        )}
                      </div>
                    );
                  })}
                {!assets.some((a) =>
                  `${a.name} ${a.ticker}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                ) && (
                  <div className="empty-panel">
                    <Search size={22} />
                    <strong>No matching stocks</strong>
                    <button onClick={() => setSearch("")}>Clear search</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {panel === "settings" && (
            <div className="panel-body">
              <label className="setting-toggle">
                <span>Island animation & traffic</span>
                <input
                  type="checkbox"
                  checked={motion}
                  onChange={(e) => setMotion(e.target.checked)}
                />
              </label>
              <label className="setting-toggle">
                <span>Show construction grid</span>
                <input
                  type="checkbox"
                  checked={grid}
                  onChange={(e) => setGrid(e.target.checked)}
                />
              </label>
              <button
                className="menu-row"
                onClick={() => {
                  setZoom(1);
                  setCameraReset((n) => n + 1);
                }}
              >
                Reset camera
                <Maximize2 size={15} />
              </button>
              <button className="menu-row" onClick={() => setPanel("help")}>
                Controls & shortcuts
                <HelpCircle size={15} />
              </button>
              <button className="menu-row" onClick={() => setPanel("assets")}>
                Supplied asset library
                <Layers size={15} />
              </button>
              <button
                className="menu-row danger"
                onClick={() => setConfirmReset(true)}
              >
                Start a new city
                <Trash2 size={15} />
              </button>
              <p className="panel-disclaimer">
                Your city saves automatically in this browser. A new city starts
                completely empty with $10,000 in demo funds.
              </p>
            </div>
          )}
          {panel === "help" && (
            <div className="panel-body">
              <p className="help-intro">
                Build your city from the ground up. Nothing is placed for you.
              </p>
              {[
                ["Draw roads", "R, then click and drag"],
                ["Company buildings", "B, choose, then click a plot"],
                ["City services", "S, choose, then click a plot"],
                ["Inspect / select", "V, then click a building"],
                ["Bulldoze", "X, then click a tile"],
                ["Pan the map", "Drag, or hold Space + drag"],
                ["Zoom", "Mouse wheel or + / −"],
                ["Construction grid", "G"],
                ["Pause simulation", "P"],
                ["Undo / redo", "Ctrl Z / Ctrl Shift Z"],
                ["Cancel construction", "Esc or right-click"],
              ].map(([label, key]) => (
                <div className="shortcut-row" key={label}>
                  <span>{label}</span>
                  <kbd>{key}</kbd>
                </div>
              ))}
              <p className="panel-disclaimer">
                Buildings occupy 2 × 2 tiles. Roads cannot cross buildings or
                leave the grassy area. Traffic appears after at least three road
                tiles are connected.
              </p>
            </div>
          )}
          {panel === "data" && (
            <div className="panel-body">
              <div className="data-label">
                <span />
                ORACLE DATA CENTER · {clock.label.toUpperCase()}
              </div>
              {[
                ["Source", MARKET_SOURCE],
                ["Market state", `${clock.label} · ${clock.next}`],
                ["Last refresh", `${freshSecs}s ago · local sim`],
                ["Wallet", "Not connected (demo)"],
                ["Transactions", "None — local simulation"],
                ["Storage", "This browser only"],
              ].map(([label, value]) => (
                <div className="shortcut-row" key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
              <h3>On-chain vs reference (sim)</h3>
              {city.buildings.filter((b) => defFor(b.kind).ticker).length ===
              0 ? (
                <p className="health-line">
                  Place a company building to compare its tokenized quote.
                </p>
              ) : (
                city.buildings
                  .filter((b) => defFor(b.kind).ticker)
                  .slice(0, 4)
                  .map((b) => {
                    const t = defFor(b.kind).ticker!;
                    const q = quoteDiff(t, prices);
                    return (
                      <div className="shortcut-row" key={b.id}>
                        <span>{t}</span>
                        <b>
                          {money(q.onchain)} vs {money(q.ref)} ({q.bps} bps)
                        </b>
                      </div>
                    );
                  })
              )}
              <p className="panel-disclaimer">
                Demo quotes only. Mainnet path uses RWA Data + Trading +
                Transaction APIs with user-confirmed swaps — never demoed as
                real equity.
              </p>
            </div>
          )}
          {panel === "assets" && (
            <>
              <div className="library-tabs">
                {["Buildings", "Roads", "Vehicles", "Effects", "Buttons"].map(
                  (t) => (
                    <button
                      className={libraryTab === t ? "chosen" : ""}
                      onClick={() => setLibraryTab(t)}
                      key={t}
                    >
                      {t}
                    </button>
                  ),
                )}
              </div>
              <div className="library-grid">
                {(libraryTab === "Buildings"
                  ? catalogue.flatMap((d) =>
                      d.ticker
                        ? ["minus", "level_1", "level_2", "level_3"].map(
                            (t) => ({
                              path: `${d.kind}/${t}`,
                              name: `${d.name} ${t.replaceAll("_", " ")}`,
                            }),
                          )
                        : [{ path: d.image, name: d.name }],
                    )
                  : libraryTab === "Roads"
                    ? [
                        "straight_ul_lr",
                        "straight_ur_ll",
                        "corner_ul_ur",
                        "corner_ll_ul",
                        "corner_lr_ll",
                        "corner_ur_lr",
                        "t_ul_ur_ll",
                        "t_ul_ur_lr",
                        "t_ul_ll_lr",
                        "t_ur_ll_lr",
                        "intersection",
                      ].map((t) => ({
                        path: `roads/${t}`,
                        name: t.replaceAll("_", " "),
                      }))
                    : libraryTab === "Vehicles"
                      ? [
                          "electric_bus",
                          "construction_truck",
                          "maintenance_van",
                        ].flatMap((v) =>
                          [
                            "upper_left",
                            "upper_right",
                            "lower_left",
                            "lower_right",
                          ].map((t) => ({
                            path: `vehicles/${v}/${t}`,
                            name: `${v.replaceAll("_", " ")} ${t.replace("_", " ")}`,
                          })),
                        )
                      : libraryTab === "Effects"
                        ? [
                            "construction",
                            "upgrade",
                            "negative_performance",
                            "selection",
                          ].map((t) => ({
                            path: `effects/${t}`,
                            name: t.replaceAll("_", " "),
                          }))
                        : ["buy", "sell", "swap", "portfolio", "settings"].map(
                            (t) => ({ path: `buttons/${t}`, name: t }),
                          )
                ).map((item) => (
                  <figure key={item.path}>
                    <img src={sprite(item.path)} alt={item.name} />
                    <figcaption>{item.name}</figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
      <footer className="command-bar">
        <nav className="tool-palette" aria-label="Construction tools">
          <button
            className={tool === "inspect" && !category && !portfolioView ? "active" : ""}
            onClick={cancel}
            aria-label="Select tool"
            aria-pressed={tool === "inspect" && !category && !portfolioView}
          >
            <GameArt index={0} />
            <span>Select</span>
            <kbd>V</kbd>
          </button>
          <button className={portfolioView ? "active" : ""} onClick={showPortfolio} aria-label="Portfolio view" aria-pressed={portfolioView} title="Show all holdings on the island">
            <GameArt index={5} />
            <span>Portfolio</span>
          </button>
          <span className="tool-divider" />
          <div className="build-menu-group">
            <button
              className={`build-main-button ${category || tool === "road" || (tool === "build" && kind) ? "active" : ""}`}
              onClick={() => {
                if (category || tool === "road") {
                  setBuildExpanded((prev) => !prev);
                } else {
                  setBuildExpanded((prev) => {
                    const next = !prev;
                    if (next && !category) {
                      chooseCategory("roads");
                    }
                    return next;
                  });
                }
              }}
              aria-label="Build menu"
              aria-expanded={buildExpanded}
              aria-pressed={Boolean(category || tool === "road" || (tool === "build" && kind))}
            >
              <GameArt index={2} />
              <span>Build</span>
              <ChevronDown
                size={11}
                className={`build-chevron ${buildExpanded ? "expanded" : ""}`}
              />
            </button>
            {buildExpanded && (
              <div className="build-submenu" role="region" aria-label="Build options">
                <button
                  className={`sub-tool-button ${category === "roads" || tool === "road" ? "active" : ""}`}
                  onClick={() => chooseCategory("roads")}
                  aria-label="Roads tool"
                  aria-pressed={tool === "road"}
                >
                  <GameArt index={1} />
                  <span>Roads</span>
                  <kbd>R</kbd>
                </button>
                <button
                  className={`sub-tool-button ${
                    category === "companies" ||
                    (tool === "build" &&
                      !!kind &&
                      defFor(kind).category === "companies")
                      ? "active"
                      : ""
                  }`}
                  onClick={() => chooseCategory("companies")}
                  aria-label="Companies catalogue"
                  aria-pressed={
                    category === "companies" ||
                    (tool === "build" &&
                      !!kind &&
                      defFor(kind).category === "companies")
                  }
                >
                  <GameArt index={2} />
                  <span>Companies</span>
                  <kbd>B</kbd>
                </button>
                <button
                  className={`sub-tool-button ${
                    category === "services" ||
                    (tool === "build" &&
                      !!kind &&
                      defFor(kind).category === "services")
                      ? "active"
                      : ""
                  }`}
                  onClick={() => chooseCategory("services")}
                  aria-label="Services catalogue"
                  aria-pressed={
                    category === "services" ||
                    (tool === "build" &&
                      !!kind &&
                      defFor(kind).category === "services")
                  }
                >
                  <GameArt index={3} />
                  <span>Services</span>
                  <kbd>S</kbd>
                </button>
              </div>
            )}
          </div>
          <span className="tool-divider" />
          <button
            className={`bulldozer ${tool === "bulldoze" ? "active" : ""}`}
            onClick={() => {
              setTool("bulldoze");
              setCategory(null);
              setPanel(null);
              setSelected(null);
              notify("Click a building or road to remove it. Ctrl Z to undo.");
            }}
            aria-label="Bulldoze tool"
            aria-pressed={tool === "bulldoze"}
          >
            <GameArt index={4} />
            <span>Bulldoze</span>
            <kbd>X</kbd>
          </button>
        </nav>

      </footer>
      {confirmReset && (
        <div className="confirm-overlay">
          <div
            ref={resetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="confirm-dialog"
          >
            <h2 id="reset-title">Start a new city?</h2>
            <p>
              This clears your saved buildings and roads. You’ll start on an
              empty island with $10,000 in demo funds.
            </p>
            <div>
              <button onClick={() => setConfirmReset(false)}>
                Keep this city
              </button>
              <button
                className="confirm-new"
                onClick={() => {
                  setCity(newCity());
                  history.current = [];
                  future.current = [];
                  cancel();
                  setSeconds(0);
                  setConfirmReset(false);
                  setZoom(1);
                  setCameraReset((n) => n + 1);
                  notify("New city started. Select Roads to begin.");
                }}
              >
                Start empty city
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function GameArt({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className={`game-art art-${index}`}
      style={{
        backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 100}%`,
      }}
    />
  );
}
