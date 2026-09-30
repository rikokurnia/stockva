"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowUpRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Grid2X2,
  HelpCircle,
  Landmark,
  Maximize2,
  Menu,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Route,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import CityMap from "./city-map";
import CivicPanel from "./civic-panel";
import { fallbackFeed, type MarketFeed } from "../lib/market";
import { VAULT_ADDRESS, bscAddressLink } from "../lib/contracts";
import CityAdvisor from "./city-advisor";
import StockLogo from "./stock-logo";
import CompanyIntel from "./company-intel";
import portfolioStyles from "./portfolio-view.module.css";
import type {
  Building,
  BuildingKind,
  Category,
  Cell,
  CityState,
  PriceMap,
  Tool,
} from "../lib/city";
import {
  PROVIDER_TAG,
  ROAD_COST,
  STORAGE,
  allocationOf,
  assetFor,
  assets,
  buildingImage,
  bulldoze,
  sellPosition,
  catalogue,
  constructBuilding,
  constructRoad,
  defFor,
  hasRoad,
  isSavedCity,
  money,
  newCity,
  pct,
  placementError,
  priceOf,
  returnOf,
  sprite,
  basePrices,
  tier,
  valueOf,
  wholeMoney,
  DEFAULT_THRESHOLDS,
  SIMULATION_INTERVALS,
  simulationStep,
  validThresholds,
  type TierThresholds,
} from "../lib/city";
type Panel =
  "portfolio" | "market" | "settings" | "help" | "data" | null;
const titles: Record<string, string> = {
  portfolio: "City finances",
  market: "Stock market",
  settings: "Game settings",
  help: "Controls",
  data: "Data status",
};
export default function StockCity() {
  const [city, setCity] = useState<CityState>(newCity),
    [ready, setReady] = useState(false),
    [booted, setBooted] = useState(false),
    [tool, setActiveTool] = useState<Tool>("inspect"),
    [portfolioView, setPortfolioView] = useState(false),
    [category, setCategory] = useState<Category | null>(null),
    [lastCategory, setLastCategory] = useState<Category>("companies"),
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
    [prices, setPrices] = useState<PriceMap>(basePrices),
    [now, setNow] = useState(Date.now()),
    [upgrades, setUpgrades] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<MarketFeed>(fallbackFeed);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assetTicker, setAssetTicker] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [scanTarget, setScanTarget] = useState<string | null>(null);
  const [intelId, setIntelId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<"live" | "simulation">("live");
  const [thresholds, setThresholds] =
    useState<TierThresholds>(DEFAULT_THRESHOLDS);
  const [thresholdDraft, setThresholdDraft] = useState<{
    minus: string;
    level2: string;
    level3: string;
  }>({
    minus: String(DEFAULT_THRESHOLDS.minus),
    level2: String(DEFAULT_THRESHOLDS.level2),
    level3: String(DEFAULT_THRESHOLDS.level3),
  });
  const [simulationInterval, setSimulationInterval] = useState(6);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationReturns, setSimulationReturns] = useState<Record<
    string,
    number
  > | null>(null);
  const intelBuilding = city.buildings.find(
    (b) => b.id === intelId && defFor(b.kind).ticker,
  );
  const simulationLatest = useRef({ city, prices });
  simulationLatest.current = { city, prices };
  const companyCount = city.buildings.filter(
    (b) => defFor(b.kind).ticker,
  ).length;
  const [focusTarget, setFocusTarget] = useState<{
    r: number;
    c: number;
    nonce: number;
  } | null>(null);
  const hasHall = city.buildings.some((b) => b.kind === "hall");
  const hasExchange = city.buildings.some((b) => b.kind === "exchange");
  const hasData = city.buildings.some((b) => b.kind === "oracle");
  const scanBuilding = city.buildings.find((b) => b.id === scanTarget);
  const scanTicker = scanBuilding
    ? defFor(scanBuilding.kind).ticker
    : undefined;
  const tiers = useRef<Record<string, string>>({});
  const history = useRef<CityState[]>([]),
    future = useRef<CityState[]>([]),
    panelRef = useRef<HTMLElement>(null),
    resetRef = useRef<HTMLDivElement>(null);
  const oldFocus = useRef<HTMLElement | null>(null);
  const switchToLiveMode = useCallback(() => {
    setGameMode("live");
    setSimulationRunning(false);
    setSimulationReturns(null);
    setNotice(
      "🟢 24/7 Live RWA Market: Buildings reflect real-time on-chain pricing.",
    );
    setNoticeError(false);
  }, []);

  const switchToSimulationMode = useCallback(() => {
    setGameMode("simulation");
    setSimulationReturns((prev) => {
      if (prev !== null) return prev;
      return Object.fromEntries(
        city.buildings
          .filter((b) => defFor(b.kind).ticker)
          .map((b) => [b.id, returnOf(b, prices)]),
      );
    });
    setSimulationRunning(true);
    setNotice(
      `⚡ Simulation Mode: Buildings cycle every ${simulationInterval}s based on custom thresholds.`,
    );
    setNoticeError(false);
  }, [city.buildings, prices, simulationInterval]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("stockva.building-simulation.v1") ?? "null",
      );
      if (validThresholds(saved?.thresholds)) {
        setThresholds(saved.thresholds);
        setThresholdDraft({
          minus: String(saved.thresholds.minus),
          level2: String(saved.thresholds.level2),
          level3: String(saved.thresholds.level3),
        });
      }
      if (SIMULATION_INTERVALS.includes(saved?.interval))
        setSimulationInterval(saved.interval);
    } catch {
      /* Invalid optional preferences fall back to defaults. */
    }
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        "stockva.building-simulation.v1",
        JSON.stringify({ thresholds, interval: simulationInterval }),
      );
    } catch {
      /* Simulation remains usable without persistence. */
    }
  }, [thresholds, simulationInterval, ready]);

  const handleThresholdChange = (
    key: "minus" | "level2" | "level3",
    val: string,
  ) => {
    setThresholdDraft((prev) => {
      const updated = { ...prev, [key]: val };
      const next = {
        minus: Number(updated.minus),
        level2: Number(updated.level2),
        level3: Number(updated.level3),
      };
      if (
        updated.minus.trim() !== "" &&
        updated.level2.trim() !== "" &&
        updated.level3.trim() !== "" &&
        validThresholds(next)
      ) {
        setThresholds(next);
      }
      return updated;
    });
  };

  const resetThresholds = () => {
    setThresholds(DEFAULT_THRESHOLDS);
    setThresholdDraft({
      minus: String(DEFAULT_THRESHOLDS.minus),
      level2: String(DEFAULT_THRESHOLDS.level2),
      level3: String(DEFAULT_THRESHOLDS.level3),
    });
    notify("Thresholds reset to default (-5%, +5%, +15%)");
  };

  const isThresholdDraftValid =
    thresholdDraft.minus.trim() !== "" &&
    thresholdDraft.level2.trim() !== "" &&
    thresholdDraft.level3.trim() !== "" &&
    validThresholds({
      minus: Number(thresholdDraft.minus),
      level2: Number(thresholdDraft.level2),
      level3: Number(thresholdDraft.level3),
    });
  useEffect(() => {
    if (!companyCount) {
      setSimulationRunning(false);
      setGameMode("live");
    }
    setSimulationReturns((previous) =>
      previous === null
        ? null
        : Object.fromEntries(
            city.buildings
              .filter((b) => defFor(b.kind).ticker)
              .map((b) => [
                b.id,
                previous[b.id] ?? returnOf(b, simulationLatest.current.prices),
              ]),
          ),
    );
  }, [city.buildings, companyCount]);
  useEffect(() => {
    if (!simulationRunning || gameMode !== "simulation") return;
    const timer = setInterval(() => {
      setSimulationReturns((previous) => {
        const latest = simulationLatest.current;
        const values = Object.fromEntries(
          latest.city.buildings
            .filter((b) => defFor(b.kind).ticker)
            .map((b) => [b.id, previous?.[b.id] ?? returnOf(b, latest.prices)]),
        );
        return simulationStep(values, thresholds);
      });
    }, simulationInterval * 1000);
    return () => clearInterval(timer);
  }, [simulationRunning, gameMode, simulationInterval, thresholds]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        let saved = JSON.parse(raw);
        if (saved && Array.isArray(saved.buildings)) {
          saved = {
            ...saved,
            buildings: saved.buildings.filter((b: Building) =>
              catalogue.some((d) => d.kind === b.kind),
            ),
          };
        }
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
    const controller = new AbortController();
    const refresh = async () => {
      setFeedLoading(true);
      try {
        const response = await fetch("/api/market", {
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const next: MarketFeed = await response.json();
        if (
          !next.quotes ||
          !assets.every(
            (a) =>
              Number.isFinite(next.quotes[a.ticker]?.price) &&
              next.quotes[a.ticker].price > 0,
          )
        )
          throw Error();
        if (controller.signal.aborted) return;
        setFeed(next);
        setPrices(
          Object.fromEntries(
            Object.entries(next.quotes).map(([ticker, q]) => [ticker, q.price]),
          ),
        );
      } catch {
        if (!controller.signal.aborted)
          setFeed((old) => ({
            ...old,
            error:
              "Connection unavailable. Displaying last available or illustrative prices.",
            quotes: Object.fromEntries(
              Object.entries(old.quotes).map(([ticker, q]) => [
                ticker,
                { ...q, status: q.status === "live" ? "stale" : q.status },
              ]),
            ),
          }));
      } finally {
        if (!controller.signal.aborted) setFeedLoading(false);
      }
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [refreshKey]);
  useEffect(() => {
    if (!hasHall) {
      setPortfolioView(false);
      if (panel === "portfolio") setPanel(null);
    }
    if (!hasExchange && panel === "market") setPanel(null);
    if (!hasData) {
      setScanMode(false);
      if (panel === "data") setPanel(null);
    }
  }, [hasHall, hasExchange, hasData, panel]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 800);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    for (const b of city.buildings) {
      if (!defFor(b.kind).ticker) continue;
      const t = tier(
        simulationReturns?.[b.id] ?? returnOf(b, prices),
        thresholds,
      );
      if (tiers.current[b.id] && tiers.current[b.id] !== t) {
        next[b.id] = Date.now();
        changed = true;
      }
      tiers.current[b.id] = t;
    }
    if (changed) {
      setUpgrades((u) => ({ ...u, ...next }));
      setNotice("Building tiers updated.");
    }
  }, [prices, city.buildings, thresholds, simulationReturns]);
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
    if (!hasHall) {
      notify("Build City Hall to unlock portfolio status.", true);
      return;
    }
    cancel();
    setPortfolioView(true);
  };
  const toggleSelectPortfolio = () => {
    if (portfolioView) {
      setPortfolioView(false);
      setActiveTool("inspect");
      notify("Select mode active. Click any building to inspect.");
    } else {
      showPortfolio();
    }
  };
  const cancel = () => {
    setIntelId(null);
    setScanMode(false);
    setTool("inspect");
    setKind(null);
    setMoving(null);
    setSelected(null);
    setPanel(null);
    setCategory(null);
  };
  const chooseCategory = (next: Category) => {
    if (next === "companies" && !hasExchange) {
      setCategory("companies");
      setTool("inspect");
      setKind(null);
      setPanel(null);
      notify("Build the Stock Exchange first to unlock Companies.", true);
      return;
    }
    setPortfolioView(false);
    setPanel(null);
    setSelected(null);
    setMoving(null);
    setCategory(next);
    setLastCategory(next);
    if (next === "roads") {
      setTool("road");
      setKind(null);
    } else {
      const firstInCat = catalogue.find((d) => d.category === next);
      if (firstInCat && (!kind || defFor(kind).category !== next)) {
        setKind(firstInCat.kind);
        setTool("build");
      }
    }
  };
  const chooseBuilding = (value: BuildingKind, autoClose = false) => {
    if (defFor(value).ticker && !hasExchange) {
      notify("Build the Stock Exchange first.", true);
      return;
    }
    setScanMode(false);
    setKind(value);
    setTool("build");
    setSelected(null);
    setMoving(null);
    setPanel(null);
    if (autoClose) {
      setCategory(null);
      notify(
        `Placing ${defFor(value).name}. Click island plot to build, Esc to cancel.`,
      );
    } else {
      setCategory(defFor(value).category);
    }
  };
  const openPanel = (value: Panel) => {
    if (
      (value === "portfolio" && !hasHall) ||
      (value === "market" && !hasExchange) ||
      (value === "data" && !hasData)
    ) {
      notify(
        `Build ${value === "portfolio" ? "City Hall" : value === "market" ? "the Stock Exchange" : "the Data Center"} first.`,
        true,
      );
      return;
    }
    setAssetTicker(null);
    setCategory(null);
    setActiveTool("inspect");
    setScanMode(false);
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
    if (defFor(kind).ticker) {
      setTool("inspect");
      setKind(null);
    }
    notify(
      `${defFor(kind).name} placed${defFor(kind).ticker ? ` at ${money(priceOf(defFor(kind).ticker!, prices))} per simulated share` : ""}${defFor(kind).ticker ? ". Investment placed." : ". Place another, or Esc."}`,
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
  );
  const stockPositions = city.buildings.filter((b) => defFor(b.kind).ticker);
  const stockCostBasis = stockPositions.reduce(
    (sum, b) => sum + b.entry * b.quantity,
    0,
  );
  const realizedPnl = city.realizedPnl ?? 0;
  const unrealizedPnl = portfolio - stockCostBasis;
  const totalPnl = unrealizedPnl + realizedPnl;
  const totalReturnPct = stockCostBasis > 0
    ? (totalPnl / stockCostBasis) * 100
    : (realizedPnl !== 0 ? (realizedPnl > 0 ? 100 : -100) : 0);
  const hasPositions = stockPositions.length > 0 || realizedPnl !== 0;
  const alloc = allocationOf(
    stockPositions,
    prices,
  );
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
          setCategory("roads");
          setTool("road");
          setKind(null);
          setSelected(null);
          setPanel(null);
          break;
        case "b":
          setCategory("companies");
          setTool("inspect");
          setKind(null);
          setPanel(null);
          break;
        case "s":
          setCategory("services");
          setTool("inspect");
          setKind(null);
          setPanel(null);
          break;
        case "v":
          toggleSelectPortfolio();
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
    hasExchange,
    city.buildings.some((b) => defFor(b.kind).ticker),
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
        focusTarget={focusTarget}
        scanMode={scanMode}
        scanTarget={scanTarget}
        onScanTarget={setScanTarget}
        grid={grid || portfolioView}
        portfolioView={portfolioView}
        motion={motion}
        paused={paused}
        speed={speed}
        prices={prices}
        thresholds={thresholds}
        simulationReturns={
          gameMode === "simulation" ? simulationReturns : null
        }
        now={now}
        upgrades={upgrades}
        onZoom={changeZoom}
        onSelect={(id) => {
          setSelected(id);
          const b = city.buildings.find((b) => b.id === id);
          if (b && !defFor(b.kind).ticker) {
            openPanel(
              b.kind === "hall"
                ? "portfolio"
                : b.kind === "exchange"
                  ? "market"
                  : "data",
            );
          } else if (b && scanMode) {
            setScanTarget(id);
          } else {
            setPanel(null);
            if (b && defFor(b.kind).ticker) setIntelId(b.id);
          }
        }}
        onPlace={onPlace}
        onRoad={onRoad}
        onBulldoze={onBulldoze}
        onCancel={cancel}
        onHover={setHover}
      />
      {intelBuilding && (
        <CompanyIntel
          key={intelBuilding.id}
          mode={gameMode}
          building={intelBuilding}
          prices={prices}
          quote={feed.quotes[defFor(intelBuilding.kind).ticker!]}
          thresholds={thresholds}
          simulatedReturn={
            gameMode === "simulation"
              ? simulationReturns?.[intelBuilding.id]
              : undefined
          }
          running={simulationRunning}
          hasExchange={hasExchange}
          hasData={hasData}
          onClose={() => {
            setIntelId(null);
            setSelected(null);
          }}
          onTrade={() => {
            setIntelId(null);
            openPanel("market");
            setAssetTicker(defFor(intelBuilding.kind).ticker!);
          }}
          onPassport={() => {
            setIntelId(null);
            openPanel("data");
            setAssetTicker(defFor(intelBuilding.kind).ticker!);
          }}
          onMove={() => {
            setIntelId(null);
            setMoving(intelBuilding.id);
            setKind(intelBuilding.kind);
            setTool("move");
            setCategory(null);
            notify("Choose an empty plot for this building. Escape cancels.");
          }}
        />
      )}
      {portfolioView && (
        <div className={portfolioStyles.heading} role="status">
          <h2>Portfolio view</h2>
          <p>
            {city.buildings.some((b) => !!defFor(b.kind).ticker)
              ? gameMode === "simulation" && simulationReturns !== null
                ? `Simulated returns · ${simulationRunning ? "Running" : "Paused"}`
                : "24/7 Live RWA Market · Unrealized return"
              : "No holdings yet · Place a company to begin"}
          </p>
          <p>Select returns to your city</p>
        </div>
      )}
      <header className="game-header">
        <button
          className={`menu-button ${panel === "settings" ? "active" : ""}`}
          onClick={() => openPanel("settings")}
          aria-label="Game menu"
          title="Game settings"
        >
          <img src={sprite("buttons/settings")} alt="" />
        </button>
        <div className="header-resources">
          <div className="cash-resource-container">
            <button
              className="cash-resource"
              onClick={() => openPanel("portfolio")}
              title="City Hall · Treasury & Balances"
            >
              <img src={sprite("buttons/portfolio")} alt="" aria-hidden="true" />
              <b>{wholeMoney(city.cash)}</b>
            </button>
            <button
              type="button"
              className="add-funds-btn"
              onClick={(e) => {
                e.stopPropagation();
                commit({
                  ...city,
                  cash: city.cash + 10_000,
                });
                notify("Added +$10,000 USD to Treasury!");
              }}
              title="Add +$10,000 USD to Treasury"
              aria-label="Add funds"
            >
              <Plus size={14} />
            </button>
          </div>
          <button
            className="portfolio-resource"
            onClick={() => openPanel("portfolio")}
            title={
              hasPositions
                ? `Total Return: ${totalPnl >= 0 ? "+" : ""}${wholeMoney(totalPnl)} (${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1)}%)`
                : "Build City Hall to inspect your stock portfolio"
            }
          >
            <img src={sprite("buttons/buy")} alt="" aria-hidden="true" />
            <span>
              <small>STOCK VALUE</small>
              <b>
                {hasHall ? (
                  <>
                    <span>{wholeMoney(portfolio)}</span>
                    {hasPositions && (
                      <span
                        className={`portfolio-accumulator-badge ${totalPnl >= 0 ? "profit" : "loss"}`}
                      >
                        {totalReturnPct >= 0 ? "+" : ""}
                        {totalReturnPct.toFixed(1)}%
                      </span>
                    )}
                  </>
                ) : (
                  "Build City Hall"
                )}
              </b>
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
                  : kind && defFor(kind).ticker
                    ? `$${amount} investment · Click island plot to build`
                    : kind
                      ? `${wholeMoney(defFor(kind).cost)} · Click island plot to build`
                      : "Choose a clear plot on the island"}
            </small>
          </span>
          <button onClick={cancel} aria-label="Finish building">
            Done <kbd>Esc</kbd>
          </button>
        </div>
      )}
      {(!city.buildings.length || !city.roads.length) &&
        !panel &&
        booted &&
        !category && (
          <div
            className={`start-note ${guideHidden ? "minimized" : ""}`}
            role="status"
          >
            <span className="step-number">
              {steps.filter(Boolean).length + 1}/3
            </span>
            {!guideHidden && (
              <span>
                <b>Empty island — build it yourself</b>
                <small>
                  {steps[0] ? "✓" : "1."} Drag Roads (R) ·{" "}
                  {steps[1] ? "✓" : "2."} Build Exchange (S) ·{" "}
                  {steps[2] ? "✓" : "3."} Buy a company
                </small>
              </span>
            )}
            <button
              className="start-note-toggle"
              onClick={() => setGuideHidden((v) => !v)}
              aria-label={guideHidden ? "Expand guideline" : "Hide guideline"}
              title={guideHidden ? "Expand guideline" : "Hide guideline"}
            >
              {guideHidden ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          </div>
        )}
      {category && (
        <section
          className="construction-tray"
          aria-label="Construction catalogue"
        >
          <header className="build-tray-header">
            <div className="build-tray-nav">
              <span className="build-title-badge">BUILDS</span>
              <div
                className="build-category-tabs"
                role="tablist"
                aria-label="Build categories"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === "roads"}
                  className={`build-cat-tab ${category === "roads" ? "active" : ""}`}
                  onClick={() => chooseCategory("roads")}
                >
                  <GameArt index={1} />
                  <span>Roads</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === "companies"}
                  className={`build-cat-tab ${category === "companies" ? "active" : ""}`}
                  onClick={() => chooseCategory("companies")}
                >
                  <GameArt index={2} />
                  <span>Companies{!hasExchange ? " · Locked" : ""}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={category === "services"}
                  className={`build-cat-tab ${category === "services" ? "active" : ""}`}
                  onClick={() => chooseCategory("services")}
                >
                  <GameArt index={3} />
                  <span>Services</span>
                </button>
              </div>
            </div>
            <button
              className="build-tray-close"
              onClick={() => setCategory(null)}
              aria-label="Close construction catalogue"
              title="Close (Esc)"
            >
              <X size={15} />
            </button>
          </header>
          <div className="tray-content">
            {category === "companies" && !hasExchange ? (
              <div className="companies-locked">
                <Landmark size={26} />
                <div>
                  <strong>Open the market first</strong>
                  <p>Build the Stock Exchange to unlock company buildings.</p>
                </div>
                <button onClick={() => chooseCategory("services")}>
                  Build services <ChevronRight size={15} />
                </button>
              </div>
            ) : category === "roads" ? (
              <>
                <button
                  className={`build-card road-card ${tool === "road" ? "chosen" : ""}`}
                  onClick={() => {
                    setTool("road");
                    setKind(null);
                    setCategory(null);
                    notify(
                      "Drawing roads ($10/tile). Drag a route on island, release to build. Esc to finish.",
                    );
                  }}
                  title="Click to start drawing roads"
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
                    <button
                      className="place-on-island road-start-btn"
                      onClick={() => {
                        setTool("road");
                        setKind(null);
                        setCategory(null);
                        notify(
                          "Drawing roads ($10/tile). Drag a route on island, release to build. Esc to finish.",
                        );
                      }}
                    >
                      <span>Start Drawing Roads ($10/tile)</span>
                      <ArrowUpRight size={14} />
                    </button>
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
                      onDoubleClick={() => chooseBuilding(d.kind, true)}
                      disabled={!ready || city.cash < (d.ticker ? 1 : d.cost)}
                    >
                      <div className="card-image">
                        <img src={sprite(d.image)} alt={d.name} />
                        {d.ticker && (
                          <StockLogo
                            ticker={d.ticker}
                            name={d.name}
                            size={20}
                            className="card-logo-chip"
                          />
                        )}
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
                      <div className="build-def-header">
                        {buildDef.ticker && (
                          <StockLogo
                            ticker={buildDef.ticker}
                            name={buildDef.name}
                            size={26}
                          />
                        )}
                        <strong>{buildDef.name}</strong>
                      </div>
                      <span className="footprint-label">2 × 2 footprint</span>
                      {buildDef.ticker ? (
                        <>
                          <div className="investment-header">
                            <label htmlFor="build-amount">Investment</label>
                            <div className="quick-amount-chips">
                              {[50, 100, 200, 500].map((amt) => (
                                <button
                                  key={amt}
                                  type="button"
                                  className={`quick-amount-btn ${amount === amt ? "active" : ""}`}
                                  onClick={() => setAmount(amt)}
                                >
                                  ${amt}
                                </button>
                              ))}
                            </div>
                          </div>
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
                          <button
                            className="place-on-island"
                            onClick={() => {
                              setCategory(null);
                              notify(
                                `Placing ${buildDef.name} ($${amount}). Click island plot to build, Esc to cancel.`,
                              );
                            }}
                            disabled={
                              !Number.isFinite(amount) ||
                              amount < 1 ||
                              amount > city.cash
                            }
                          >
                            <span>
                              Pay ${Number.isFinite(amount) ? amount : 0} &
                              Place
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="service-cost">
                            {wholeMoney(buildDef.cost)}
                          </span>
                          <small>{buildDef.description}</small>
                          <button
                            className="place-on-island"
                            onClick={() => {
                              setCategory(null);
                              notify(
                                `Placing ${buildDef.name} (${wholeMoney(buildDef.cost)}). Click island plot to build, Esc to cancel.`,
                              );
                            }}
                            disabled={city.cash < buildDef.cost}
                          >
                            <span>Pay {wholeMoney(buildDef.cost)} & Place</span>
                            <ArrowUpRight size={14} />
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <MousePointer2 size={20} />
                      <strong>Select a building</strong>
                      <small>
                        {category === "companies"
                          ? "Select a company above, then click Pay & Place."
                          : "Choose a service, then click Pay & Place."}
                      </small>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
      {current &&
        definition &&
        tool === "inspect" &&
        !panel &&
        !scanMode &&
        !intelBuilding && (
          <aside className="inspection-panel" aria-label="Selected building">
            <header>
              <div>
                <small>
                  {definition.category === "companies"
                    ? "STOCK BUILDING · DEMO POSITION"
                    : "CITY SERVICE"}
                </small>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "4px",
                  }}
                >
                  {definition.ticker && (
                    <StockLogo
                      ticker={definition.ticker}
                      name={definition.name}
                      size={28}
                    />
                  )}
                  <h2 style={{ margin: 0 }}>
                    {definition.ticker && (
                      <span className="ticker-badge">{definition.ticker}</span>
                    )}{" "}
                    {definition.name}
                  </h2>
                </div>
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
                src={sprite(
                  buildingImage(
                    current,
                    prices,
                    thresholds,
                    simulationReturns?.[current.id],
                  ),
                )}
                alt={definition.name}
              />
              <span>
                {definition.ticker
                  ? tier(
                      simulationReturns?.[current.id] ??
                        returnOf(current, prices),
                      thresholds,
                    )
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
                const myAlloc =
                  alloc.find((a) => a.id === current.id)?.pct ?? 0;
                const live = priceOf(definition.ticker, prices);
                return (
                  <>
                    <div className="inspection-stats">
                      <span>
                        Position value<strong>{money(val)}</strong>
                      </span>
                      <span>
                        Token price
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
                        {PROVIDER_TAG} ·{" "}
                        {feed.quotes[definition.ticker!]?.source} ·{" "}
                        {feed.quotes[definition.ticker!]?.status}
                      </small>
                    </div>
                    <div className="chain-link" style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <a
                        href={bscAddressLink(VAULT_ADDRESS)}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          color: "#f0b90b",
                          fontWeight: 600,
                          fontSize: "11px",
                          textDecoration: "none",
                        }}
                      >
                        <ShieldCheck size={13} />
                        <span>BNB Chain Vault: {VAULT_ADDRESS.slice(0, 6)}…{VAULT_ADDRESS.slice(-4)}</span>
                        <ExternalLink size={11} />
                      </a>
                      <small style={{ color: "#8b9ea7", fontSize: "10px" }}>
                        Tracked & liquidatable on BSC Testnet (Chain ID 97)
                      </small>
                    </div>
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
            {definition.ticker && (
              <div className="inspection-actions">
                <button
                  disabled={!hasExchange}
                  title={
                    hasExchange
                      ? "Open Stock Exchange"
                      : "Build the Stock Exchange first"
                  }
                  onClick={() => {
                    openPanel("market");
                    setAssetTicker(definition.ticker!);
                  }}
                >
                  Trade position
                </button>
                <button
                  disabled={!hasData}
                  title={
                    hasData
                      ? "Inspect issuer and token evidence"
                      : "Build the Data Center first"
                  }
                  onClick={() => {
                    openPanel("data");
                    setAssetTicker(definition.ticker!);
                  }}
                >
                  RWA passport
                </button>
              </div>
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
      {scanMode && (
        <div className="scan-toolbar">
          <span>SCAN MODE · Hover or tap a building</span>
          <button
            onClick={() => {
              setScanMode(false);
              setScanTarget(null);
            }}
          >
            Exit scan <X size={14} />
          </button>
        </div>
      )}
      {scanMode && scanTicker && (
        <aside className="scan-card">
          <small>RWA SIGNAL</small>
          <h3>{feed.quotes[scanTicker]?.tokenName ?? scanTicker}</h3>
          <p>
            {feed.quotes[scanTicker]?.tokenName
              ? "xStocks / Backed"
              : "Issuer unconfirmed"}
          </p>
          <dl>
            <dt>Price source</dt>
            <dd>{feed.quotes[scanTicker]?.source}</dd>
            <dt>Last fetched</dt>
            <dd>
              {feed.quotes[scanTicker]?.fetchedAt
                ? new Date(
                    feed.quotes[scanTicker].fetchedAt!,
                  ).toLocaleTimeString()
                : "Illustrative · no live timestamp"}
            </dd>
          </dl>
          <button
            onClick={() => {
              setAssetTicker(scanTicker);
              setPanel("data");
              setScanMode(false);
            }}
          >
            View Passport <ChevronRight size={14} />
          </button>
        </aside>
      )}
      {(panel === "portfolio" || panel === "market" || panel === "data") && (
        <CivicPanel
          mode={panel}
          city={city}
          prices={prices}
          feed={feed}
          loading={feedLoading}
          initialTicker={assetTicker}
          onClose={() => setPanel(null)}
          onRetry={() => setRefreshKey((n) => n + 1)}
          onBuy={(kind, investment) => {
            setAmount(investment);
            chooseBuilding(kind, true);
          }}
          onSell={(ticker, fraction) => {
            const result = sellPosition(city, ticker, fraction, prices);
            if (result.error) return result.error;
            commit(result.state);
            return `${fraction === 1 ? "Entire holding" : `${fraction * 100}% of holding`} sold. Demo funds updated.`;
          }}
          onFocus={(b) => {
            setPanel(null);
            setSelected(b.id);
            setTool("inspect");
            setZoom(1.7);
            setFocusTarget({ r: b.r, c: b.c, nonce: Date.now() });
          }}
          onScan={() => {
            setPanel(null);
            setSelected(null);
            setTool("inspect");
            setCategory(null);
            setScanMode(true);
            setScanTarget(null);
          }}
        />
      )}
      {panel && !["portfolio", "market", "data"].includes(panel) && (
        <aside
          ref={panelRef}
          className="utility-panel"
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
          {panel === "settings" && (
            <div className="panel-body">
              <div className="settings-mode-container">
                <span className="settings-mode-label">Market Operating Mode</span>
                <div
                  className="mode-toggle-group"
                  role="radiogroup"
                  aria-label="Stockva Operating Mode"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gameMode === "live"}
                    className={`mode-toggle-btn ${gameMode === "live" ? "active-live" : ""}`}
                    onClick={switchToLiveMode}
                    title="24/7 Live RWA Market: Real-time on-chain pricing without timer looping"
                  >
                    <span className="live-pulse-dot" />
                    <span>Live RWA (24/7)</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={gameMode === "simulation"}
                    className={`mode-toggle-btn ${gameMode === "simulation" ? "active-sim" : ""}`}
                    onClick={switchToSimulationMode}
                    title="Simulation Mode: Custom % thresholds and dynamic looping skyline transformation"
                  >
                    <SlidersHorizontal size={13} />
                    <span>Simulation</span>
                    {gameMode === "simulation" && simulationRunning && (
                      <span className="sim-speed-badge">
                        {simulationInterval}s
                      </span>
                    )}
                  </button>
                </div>
                <small className="settings-mode-hint">
                  {gameMode === "live"
                    ? "Live RWA: Real-time pricing via on-chain tokenized equity oracle feeds."
                    : "Simulation: Dynamic visual tier cycling based on custom % thresholds."}
                </small>
                {gameMode === "simulation" && (
                  <div className="settings-sim-subcontrols">
                    <div className="settings-sim-row">
                      <span className="settings-sim-sublabel">Cycle Speed</span>
                      <div className="settings-interval-chips">
                        {SIMULATION_INTERVALS.map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            className={`interval-chip ${simulationInterval === sec ? "active" : ""}`}
                            onClick={() => setSimulationInterval(sec)}
                            title={`Loop every ${sec} seconds`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`settings-sim-toggle-btn ${simulationRunning ? "running" : "paused"}`}
                      onClick={() => setSimulationRunning((r) => !r)}
                    >
                      {simulationRunning ? "Pause Simulation" : "Resume Simulation"}
                    </button>

                    {/* Percentage Threshold Controls */}
                    <div className="settings-thresholds-wrapper">
                      <div className="settings-sim-row">
                        <span className="settings-sim-sublabel">Tier Thresholds (%)</span>
                        <button
                          type="button"
                          className="settings-threshold-reset-btn"
                          onClick={resetThresholds}
                          title="Reset to default: -5%, +5%, +15%"
                        >
                          Reset defaults
                        </button>
                      </div>

                      <div className="settings-thresholds-grid">
                        <div className="threshold-field">
                          <label htmlFor="thresh-minus">Minus below</label>
                          <div className="threshold-input-pill">
                            <input
                              id="thresh-minus"
                              type="number"
                              step="0.5"
                              min="-98.5"
                              max="1000"
                              value={thresholdDraft.minus}
                              onChange={(e) => handleThresholdChange("minus", e.target.value)}
                            />
                            <span className="threshold-unit">%</span>
                          </div>
                        </div>

                        <div className="threshold-field">
                          <label htmlFor="thresh-level2">Tier 2 at</label>
                          <div className="threshold-input-pill">
                            <input
                              id="thresh-level2"
                              type="number"
                              step="0.5"
                              min="-98.5"
                              max="1000"
                              value={thresholdDraft.level2}
                              onChange={(e) => handleThresholdChange("level2", e.target.value)}
                            />
                            <span className="threshold-unit">%</span>
                          </div>
                        </div>

                        <div className="threshold-field">
                          <label htmlFor="thresh-level3">Tier 3 at</label>
                          <div className="threshold-input-pill">
                            <input
                              id="thresh-level3"
                              type="number"
                              step="0.5"
                              min="-98.5"
                              max="1000"
                              value={thresholdDraft.level3}
                              onChange={(e) => handleThresholdChange("level3", e.target.value)}
                            />
                            <span className="threshold-unit">%</span>
                          </div>
                        </div>
                      </div>

                      {!isThresholdDraftValid && (
                        <p className="threshold-validation-error">
                          Rule: −99 &lt; Minus &lt; Tier 2 &lt; Tier 3 ≤ 1000
                        </p>
                      )}

                      <div className="settings-tier-preview">
                        <span className="tier-tag minus">
                          Minus: &lt; {thresholds.minus > 0 ? "+" : ""}{thresholds.minus}%
                        </span>
                        <span className="tier-tag level1">
                          Tier 1: {thresholds.minus > 0 ? "+" : ""}{thresholds.minus}% to &lt; {thresholds.level2 > 0 ? "+" : ""}{thresholds.level2}%
                        </span>
                        <span className="tier-tag level2">
                          Tier 2: {thresholds.level2 > 0 ? "+" : ""}{thresholds.level2}% to &lt; {thresholds.level3 > 0 ? "+" : ""}{thresholds.level3}%
                        </span>
                        <span className="tier-tag level3">
                          Tier 3: ≥ {thresholds.level3 > 0 ? "+" : ""}{thresholds.level3}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
        </aside>
      )}
      <footer className="command-bar">
        <nav className="tool-palette" aria-label="Construction tools">
          <button
            className={`portfolio-select-button ${portfolioView ? "active portfolio-active" : tool === "inspect" && !category ? "active select-active" : ""}`}
            onClick={toggleSelectPortfolio}
            aria-label={
              portfolioView
                ? "Switch to Select mode"
                : "Switch to Portfolio view"
            }
            aria-pressed={portfolioView}
            title={
              portfolioView
                ? "Currently in Portfolio view. Click or press V for Select mode"
                : "Currently in Select mode. Click or press V for Portfolio view"
            }
          >
            {portfolioView ? (
              <img
                src="/assets/portfolio-menu.png"
                alt="Portfolio view"
                className="menu-custom-icon"
              />
            ) : (
              <GameArt index={0} />
            )}
            <span>{portfolioView ? "Portfolio" : "Select"}</span>
            <kbd>V</kbd>
          </button>
          <span className="tool-divider" />
          <button
            className={`build-main-button ${category || tool === "road" || (tool === "build" && kind) ? "active" : ""}`}
            onClick={() => {
              if (category) {
                setCategory(null);
              } else {
                chooseCategory(kind ? defFor(kind).category : lastCategory);
              }
            }}
            aria-label="Builds menu"
            aria-expanded={Boolean(category)}
            aria-pressed={Boolean(
              category || tool === "road" || (tool === "build" && kind),
            )}
          >
            <img
              src="/assets/buids-menu.png"
              alt="Build menu"
              className="menu-custom-icon"
            />
            <span>Build</span>
            <kbd>B</kbd>
          </button>
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
      {hasHall && !panel && !scanMode && !intelBuilding && (
        <CityAdvisor city={city} prices={prices} />
      )}
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
                  setSimulationRunning(false);
                  setSimulationReturns(null);
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
