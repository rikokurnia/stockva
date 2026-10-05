"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWallets } from "@privy-io/react-auth";
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
import CityMap, { type AgentMapActivity } from "./city-map";
import { inspectorPlacement } from "../lib/map-geometry";
import { rebalanceFingerprint, type RebalancePlan } from "../lib/rebalance";
import {
  applyRebalanceReceipt,
  applyRebalanceBatch,
  hasPendingRebalance,
  recoverRebalanceExecution,
  REBALANCE_STORAGE,
  type RebalanceExecution,
} from "../lib/rebalance-execution";
import {
  prepareRebalanceBatch,
  sendRebalanceBatch,
  confirmRebalanceBatch,
  newRebalanceBatchId,
  RebalanceBatchRejected,
  type BatchProvider,
  type RebalanceCalls,
} from "../lib/rebalance-batch";
import OnchainWallet from "./onchain-wallet";
import FaucetOnboardModal from "./faucet-onboard-modal";
import { fallbackFeed, type MarketFeed } from "../lib/market";
import {
  VAULT_ADDRESS,
  bscAddressLink,
  connectInjectedWallet,
  ensureBscTestnet,
  recordBuildingOnchain,
  recordBuildingsBatch,
  sellBuildingOnchain,
  confirmedRebalanceReceipt,
  type BatchBuildingInput,
  type RebalanceReceipt,
} from "../lib/contracts";
import BundleModal from "./bundle-modal";
import { BuildingCatalogueModal } from "./building-catalogue-modal";
import CityAdvisor from "./city-advisor";
import { AgentExecutionDock } from "./agent-rebalance";
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
  buyPaper,
  sellPaper,
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
  tierName,
  valueOf,
  wholeMoney,
  DEFAULT_THRESHOLDS,
  SIMULATION_INTERVALS,
  simulationStep,
  validThresholds,
  type TierThresholds,
} from "../lib/city";
import {
  portfolioLevel,
  portfolioPercent,
  portfolioStatus,
} from "../lib/portfolio-view";
const AgentHall = dynamic(() => import("./agent-hall"), { ssr: false });
const CivicPanel = dynamic(() => import("./civic-panel"), { ssr: false });

type Panel =
  "portfolio" | "market" | "settings" | "help" | "data" | "agent" | null;
const titles: Record<string, string> = {
  portfolio: "City finances",
  market: "Stock market",
  settings: "Game settings",
  help: "Controls",
  data: "Data status",
  agent: "Agent Hall",
};
export default function StockCity() {
  const { wallets } = useWallets();
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
  const [wallet, setWallet] = useState<`0x${string}` | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const onboardCheckedRef = useRef(false);
  const [agentExecution, setAgentExecution] =
    useState<RebalanceExecution | null>(null);
  const [dockDismissed, setDockDismissed] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const executionRef = useRef<RebalanceExecution | null>(null);
  const agentRunning = useRef(false);
  const [agentActivity, setAgentActivity] = useState<AgentMapActivity | null>(
    null,
  );
  const cityMutationLocked =
    agentExecution?.status === "running" || hasPendingRebalance(agentExecution);
  const [placeSource, setPlaceSource] = useState<"tray" | "exchange" | null>(
    null,
  );
  const [bundleQueue, setBundleQueue] = useState<
    { kind: BuildingKind; amount: number }[]
  >([]);
  const [bundleBuildingIds, setBundleBuildingIds] = useState<string[]>([]);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [bundleModalBuildings, setBundleModalBuildings] = useState<Building[]>(
    [],
  );
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
  const [confirmingBuildings, setConfirmingBuildings] = useState<
    Record<
      string,
      { confirming: boolean; confirmed: boolean; startedAt?: number }
    >
  >({});
  const handleConstructionComplete = useCallback((id: string) => {
    setConfirmingBuildings((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const intelBuilding = city.buildings.find(
    (b) => b.id === intelId && defFor(b.kind).ticker,
  );
  const simulationLatest = useRef({ city, prices });
  simulationLatest.current = { city, prices };
  const companyCount = city.buildings.filter(
    (b) => defFor(b.kind).ticker && !b.locked,
  ).length;
  const [focusTarget, setFocusTarget] = useState<{
    r: number;
    c: number;
    nonce: number;
  } | null>(null);
  const [inspectorStyle, setInspectorStyle] =
    useState<React.CSSProperties | null>(null);
  const inspectorStyleKey = useRef("dock");
  const hasHall = city.buildings.some((b) => b.kind === "hall");
  const hasExchange = city.buildings.some((b) => b.kind === "exchange");
  const hasData = city.buildings.some((b) => b.kind === "oracle");
  const hasAgentHall = city.buildings.some((b) => b.kind === "agent_hall");
  const builtKinds = useMemo(() => {
    const set = new Set<BuildingKind>();
    for (const b of city.buildings) {
      set.add(b.kind);
      const def = defFor(b.kind);
      if (def.ticker) {
        set.add(def.ticker.toLowerCase() as BuildingKind);
      }
    }
    return set;
  }, [city.buildings]);
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
          .filter((b) => defFor(b.kind).ticker && !b.locked)
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
              .filter((b) => defFor(b.kind).ticker && !b.locked)
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
            .filter((b) => defFor(b.kind).ticker && !b.locked)
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
        if (
          saved &&
          saved.cash === 10000 &&
          (!saved.buildings || saved.buildings.length === 0) &&
          (!saved.roads || saved.roads.length === 0)
        ) {
          saved.cash = 0;
        }
        if (isSavedCity(saved)) setCity(saved);
        else {
          setNotice("Saved city was invalid. An empty island is ready.");
          setNoticeError(true);
        }
      }
      const execution = recoverRebalanceExecution(
        JSON.parse(localStorage.getItem(REBALANCE_STORAGE) ?? "null"),
        catalogue.map((definition) => definition.kind),
      );
      if (
        execution?.plan?.id &&
        Array.isArray(execution.steps) &&
        execution.plan.steps?.length
      ) {
        const recovered: RebalanceExecution = {
          ...execution,
          status: execution.status === "completed" ? "completed" : "paused",
          error:
            execution.status === "completed"
              ? undefined
              : (execution.error ??
                (execution.mode === "sequential"
                  ? "Execution paused after reload. Reconnect your wallet to resume your rebalance."
                  : "Execution paused after reload. Reconnect the same wallet to check saved batch confirmation without signing again.")),
        };
        executionRef.current = recovered;
        setAgentExecution(recovered);
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
    if (ready && booted && !onboardCheckedRef.current) {
      onboardCheckedRef.current = true;
      if (city.cash === 0 && !wallet) {
        setOnboardOpen(true);
      }
    }
  }, [ready, booted, city.cash, wallet]);
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
    if (!hasAgentHall && panel === "agent") setPanel(null);
    if (!hasData) {
      setScanMode(false);
      if (panel === "data") setPanel(null);
    }
  }, [hasHall, hasExchange, hasData, hasAgentHall, panel]);
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
    if (cityMutationLocked) {
      notify(
        "The agent is settling a signed plan. Finish or resolve its pending transaction before editing the city.",
        true,
      );
      return;
    }
    if (next === city) return;
    history.current = [...history.current.slice(-29), city];
    future.current = [];
    setCity(next);
  };
  const undo = () => {
    if (cityMutationLocked) return;
    const last = history.current.pop();
    if (!last) return;
    future.current.push(city);
    setCity(last);
    setSelected(null);
    notify("Last construction action undone.");
  };
  const redo = () => {
    if (cityMutationLocked) return;
    const next = future.current.pop();
    if (!next) return;
    history.current.push(city);
    setCity(next);
    notify("Construction action restored.");
  };
  const saveAgentExecution = (execution: RebalanceExecution) => {
    localStorage.setItem(REBALANCE_STORAGE, JSON.stringify(execution));
    executionRef.current = execution;
    setAgentExecution(execution);
  };
  const saveConfirmedCity = (next: CityState) => {
    localStorage.setItem(STORAGE, JSON.stringify(next));
    simulationLatest.current = { ...simulationLatest.current, city: next };
    history.current = [];
    future.current = [];
    setCity(next);
  };
  const executeRebalance = async (plan: RebalancePlan) => {
    if (agentRunning.current) return;
    if (
      executionRef.current?.plan.id !== plan.id &&
      hasPendingRebalance(executionRef.current)
    ) {
      notify(
        "Check the saved batch in Agent Hall before starting another plan.",
        true,
      );
      return;
    }
    agentRunning.current = true;
    let run: RebalanceExecution =
      executionRef.current?.plan.id === plan.id
        ? { ...executionRef.current, status: "running", error: undefined }
        : {
            plan,
            mode: "atomic",
            status: "running",
            fingerprint: plan.fingerprint,
            steps: plan.steps.map((step) => ({
              stepId: step.id,
              status: "queued",
            })),
          };
    let createdBatch = false;
    let sendAttempted = false;
    const tourBefore = simulationLatest.current.city;
    const focus = (
      step: RebalancePlan["steps"][number],
      phase: AgentMapActivity["phase"],
      detail: string,
      hash?: `0x${string}`,
    ) => {
      setFocusTarget({ ...step.cell, nonce: Date.now() });
      setZoom(1.7);
      setSelected(step.action === "sell" ? step.buildingId : null);
      const original = tourBefore.buildings.find(
        (b) => b.id === step.buildingId,
      );
      setAgentActivity({
        originalImage: original
          ? sprite(buildingImage(original, prices, thresholds))
          : undefined,
        buildingId: step.buildingId,
        ...step.cell,
        ticker: step.ticker,
        kind: step.action,
        phase,
        detail,
        hash,
      });
    };
    try {
      if (!wallet || wallet.toLowerCase() !== plan.walletAddress.toLowerCase())
        throw new Error("Connect the wallet that reviewed this blueprint.");
      const latest = simulationLatest.current.city;
      const applied =
        latest.agentReceipts?.filter((r) => r.planId === plan.id) ?? [];
      if (
        applied.length === plan.steps.length &&
        plan.steps.every((s) => applied.some((r) => r.stepId === s.id))
      ) {
        run = {
          ...run,
          status: "completed",
          batchStatus: run.mode === "atomic" ? "confirmed" : undefined,
          steps: run.steps.map((p) => ({
            ...p,
            status: "confirmed",
            error: undefined,
            hash: applied.find((r) => r.stepId === p.stepId)!.hash,
          })),
          fingerprint: rebalanceFingerprint(latest),
        };
        saveAgentExecution(run);
        notify("Your confirmed rebalance is already saved in City Hall.");
        return;
      }
      if (run.batchStatus === "failed")
        throw new Error(
          "This batch was rejected or reverted. Request a fresh blueprint before signing again.",
        );
      if (
        !run.batchId &&
        !run.steps.some((s) => s.status === "confirmed") &&
        Date.now() > plan.expiresAt
      )
        throw new Error(
          "This quote expired. Ask the agent for a fresh blueprint before signing.",
        );
      if (
        !run.steps.some((s) => s.status === "confirmed") &&
        rebalanceFingerprint(latest) !== (run.fingerprint ?? plan.fingerprint)
      )
        throw new Error(
          "Your city changed since this blueprint. Keep any pending batch ID and reconcile it before generating a new plan.",
        );
      if (
        Object.keys(confirmingBuildings).length ||
        latest.buildings.some((b) => b.locked)
      )
        throw new Error(
          "Finish pending building purchases before rebalancing.",
        );
      const connected = wallets.find(
        (w) => w.address.toLowerCase() === plan.walletAddress.toLowerCase(),
      );
      const provider = (connected
        ? await connected.getEthereumProvider()
        : window.ethereum) as unknown as BatchProvider | undefined;
      if (!provider)
        throw new Error("Connect your wallet to approve or check this batch.");
      setSimulationRunning(false);
      setSimulationReturns(null);
      setGameMode("live");
      setActiveTool("inspect");
      setKind(null);
      if (!run.batchId) {
        // Validate unconfirmed steps without making provisional city changes.
        let sites = latest;
        for (const step of plan.steps) {
          const stepDone = run.steps.find((s) => s.stepId === step.id)?.status === "confirmed";
          if (stepDone) continue;

          if (step.action === "sell") {
            const building = sites.buildings.find(
              (b) => b.id === step.buildingId,
            );
            if (
              !building ||
              building.vaultId?.toLowerCase() !== step.positionId.toLowerCase()
            )
              throw new Error(
                "A reviewed building changed. Ask for a fresh blueprint.",
              );
            sites = {
              ...sites,
              buildings: sites.buildings.filter(
                (b) => b.id !== step.buildingId,
              ),
            };
          } else {
            if (defFor(step.kind).ticker !== step.ticker)
              throw new Error(
                "The building type does not match the reviewed stock. Request a fresh blueprint.",
              );
            const error = placementError(step.cell, sites);
            if (
              error ||
              !hasRoad(step.cell, sites.roads) ||
              sites.buildings.some((b) => defFor(b.kind).ticker === step.ticker)
            )
              throw new Error(
                error ||
                  "A construction site changed. Ask for a fresh blueprint.",
              );
            sites = {
              ...sites,
              buildings: [
                ...sites.buildings,
                {
                  id: step.buildingId,
                  kind: step.kind,
                  ...step.cell,
                  quantity: step.quantity,
                  entry: step.price,
                  cost: step.amount,
                  builtAt: 0,
                },
              ],
            };
          }
        }

        await ensureBscTestnet(provider);

        let useSequential = run.mode === "sequential";
        let calls: RebalanceCalls | null = null;

        if (!useSequential) {
          try {
            calls = await prepareRebalanceBatch(provider, plan);
          } catch (batchError) {
            const msg =
              batchError instanceof Error
                ? batchError.message
                : String(batchError);
            const isBatchUnsupported =
              /cannot batch a rebalance/i.test(msg) ||
              /atomic batching/i.test(msg) ||
              /atomicBatch/i.test(msg) ||
              /capabilities/i.test(msg) ||
              /not supported/i.test(msg) ||
              /method not found/i.test(msg) ||
              /wallet_getCapabilities/i.test(msg) ||
              /wallet_sendCalls/i.test(msg) ||
              (typeof batchError === "object" &&
                batchError !== null &&
                "code" in batchError &&
                (batchError as { code: unknown }).code === -32601);

            if (isBatchUnsupported) {
              useSequential = true;
              run = { ...run, mode: "sequential" };
              saveAgentExecution(run);
              notify("Standard wallet: executing rebalance step-by-step.");
            } else {
              throw batchError;
            }
          }
        }

        if (useSequential) {
          // Sequential Execution Mode
          // 1. Reconcile any in-flight step transactions
          for (const step of plan.steps) {
            const progress = run.steps.find((p) => p.stepId === step.id)!;
            if (
              !progress.hash ||
              progress.reverted ||
              progress.status === "confirmed"
            )
              continue;
            try {
              focus(
                step,
                "submitted",
                `Reconciling ${step.ticker} transaction…`,
                progress.hash,
              );
              const receipt = await confirmedRebalanceReceipt(
                plan.walletAddress,
                progress.hash,
                step.action,
                (hash) => {
                  run = {
                    ...run,
                    steps: run.steps.map((p) =>
                      p.stepId === step.id ? { ...p, hash } : p,
                    ),
                  };
                  saveAgentExecution(run);
                },
              );
              const next = applyRebalanceReceipt(
                simulationLatest.current.city,
                plan,
                step,
                receipt,
              );
              saveConfirmedCity(next);
              run = {
                ...run,
                fingerprint: rebalanceFingerprint(next),
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? {
                        ...p,
                        status: "confirmed",
                        hash: receipt.hash,
                        error: undefined,
                      }
                    : p,
                ),
              };
              saveAgentExecution(run);
            } catch (error) {
              if (
                error instanceof Error &&
                /transaction reverted|replaced or cancelled on-chain/i.test(
                  error.message,
                )
              ) {
                run = {
                  ...run,
                  steps: run.steps.map((p) =>
                    p.stepId === step.id
                      ? {
                          ...p,
                          status: "error",
                          reverted: true,
                          error: error.message,
                        }
                      : p,
                  ),
                };
                saveAgentExecution(run);
              }
              throw error;
            }
          }

          // 2. Identify remaining unconfirmed steps
          const unconfirmedSteps = plan.steps.filter((step) => {
            const progress = run.steps.find((p) => p.stepId === step.id);
            return progress?.status !== "confirmed";
          });

          const unconfirmedBuys = unconfirmedSteps.filter(
            (s) => s.action === "buy",
          );
          const unconfirmedSells = unconfirmedSteps.filter(
            (s) => s.action === "sell",
          );

          if (unconfirmedBuys.length > 0) {
            // Batch all unconfirmed stock purchases in ONE single transaction (same as the Bundle feature)
            const batchItems: BatchBuildingInput[] = unconfirmedBuys.map(
              (step) => ({
                buildingId: step.buildingId,
                ticker: step.ticker,
                usdAmount: step.amount,
                entryPrice: step.price,
                initialTier: 1,
              }),
            );

            run = {
              ...run,
              steps: run.steps.map((p) =>
                unconfirmedSteps.some((s) => s.id === p.stepId)
                  ? {
                      ...p,
                      status: "wallet",
                      error: undefined,
                      reverted: undefined,
                    }
                  : p,
              ),
            };
            saveAgentExecution(run);
            notify(
              `Agent: confirm 1 batch transaction in your wallet for all ${unconfirmedBuys.length} stocks.`,
            );

            for (const step of unconfirmedBuys) {
              focus(
                step,
                "wallet",
                `Confirm batch purchase of ${unconfirmedBuys.length} stocks in wallet (1 signature)`,
              );
            }

            const batchResult = await recordBuildingsBatch(
              plan.walletAddress,
              batchItems,
              (phase, h) => {
                if (phase === "approve") {
                  for (const step of unconfirmedBuys) {
                    focus(
                      step,
                      "wallet",
                      h
                        ? "Confirming mUSD approval…"
                        : "Approve mUSD spending in wallet…",
                      h,
                    );
                  }
                  if (h) {
                    run = {
                      ...run,
                      steps: run.steps.map((p) =>
                        unconfirmedBuys.some((s) => s.id === p.stepId)
                          ? { ...p, approvalHash: h }
                          : p,
                      ),
                    };
                    saveAgentExecution(run);
                  }
                } else {
                  for (const step of unconfirmedBuys) {
                    focus(
                      step,
                      h ? "submitted" : "wallet",
                      h
                        ? "Batch broadcast! Waiting for BSC block confirmation…"
                        : `Confirm batch purchase popup — ${unconfirmedBuys.length} stocks, 1 signature…`,
                      h,
                    );
                  }
                  if (h) {
                    run = {
                      ...run,
                      steps: run.steps.map((p) =>
                        unconfirmedBuys.some((s) => s.id === p.stepId)
                          ? { ...p, status: "submitted", hash: h }
                          : p,
                      ),
                    };
                    saveAgentExecution(run);
                  }
                }
              },
              provider,
            );

            const batchHash = batchResult.hash;

            // Apply all unconfirmed sells to city state (retired / freed for this rebalance)
            for (const step of unconfirmedSells) {
              const sellReceipt: RebalanceReceipt = {
                hash: batchHash,
                positionId: step.positionId,
                amount: step.amount,
                quantity: step.quantity,
                entryPrice: step.price,
                ticker: step.ticker,
                fullyClosed: true,
              };
              const nextCity = applyRebalanceReceipt(
                simulationLatest.current.city,
                plan,
                step,
                sellReceipt,
                true,
              );
              saveConfirmedCity(nextCity);
              run = {
                ...run,
                fingerprint: rebalanceFingerprint(nextCity),
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? {
                        ...p,
                        status: "confirmed",
                        hash: batchHash,
                        error: undefined,
                      }
                    : p,
                ),
              };
              saveAgentExecution(run);
              focus(step, "confirmed", `Removed ${step.ticker} in rebalance`, batchHash);
            }

            // Apply all unconfirmed buys to city state using the confirmed on-chain position IDs
            for (let i = 0; i < unconfirmedBuys.length; i++) {
              const step = unconfirmedBuys[i];
              const vaultId = batchResult.positionIds[i] ?? batchHash;
              const buyReceipt: RebalanceReceipt = {
                hash: batchHash,
                positionId: vaultId,
                amount: step.amount,
                quantity: Number((step.amount / step.price).toFixed(6)),
                entryPrice: step.price,
                ticker: step.ticker,
                fullyClosed: false,
              };
              const nextCity = applyRebalanceReceipt(
                simulationLatest.current.city,
                plan,
                step,
                buyReceipt,
                true,
              );
              saveConfirmedCity(nextCity);
              run = {
                ...run,
                fingerprint: rebalanceFingerprint(nextCity),
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? {
                        ...p,
                        status: "confirmed",
                        hash: batchHash,
                        error: undefined,
                      }
                    : p,
                ),
              };
              saveAgentExecution(run);
              focus(
                step,
                "confirmed",
                `Constructed ${step.ticker} in batch`,
                batchHash,
              );
              setUpgrades((previous) => ({
                ...previous,
                [step.buildingId]: Date.now(),
              }));
            }

            notify(
              `Confirmed all ${unconfirmedBuys.length} stock buildings in 1 batch on BNB Testnet!`,
            );
          } else if (unconfirmedSells.length > 0) {
            // Pure liquidation scenario (no buys to batch)
            for (const step of unconfirmedSells) {
              run = {
                ...run,
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? {
                        ...p,
                        status: "wallet",
                        error: undefined,
                        reverted: undefined,
                      }
                    : p,
                ),
              };
              saveAgentExecution(run);
              focus(
                step,
                "wallet",
                `Sign sell transaction for ${step.ticker} in wallet`,
              );
              notify(
                `Agent: sign sell transaction for ${step.ticker} in your wallet.`,
              );

              const hash = await sellBuildingOnchain(
                plan.walletAddress,
                step.positionId,
                step.price,
                step.fractionBps,
                (h) => {
                  if (h) {
                    run = {
                      ...run,
                      steps: run.steps.map((p) =>
                        p.stepId === step.id
                          ? { ...p, status: "submitted", hash: h }
                          : p,
                      ),
                    };
                    saveAgentExecution(run);
                    focus(
                      step,
                      "submitted",
                      `Confirming sale of ${step.ticker} on BNB Chain…`,
                      h,
                    );
                  }
                },
                provider,
              );

              run = {
                ...run,
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? { ...p, status: "submitted", hash }
                    : p,
                ),
              };
              saveAgentExecution(run);
              focus(
                step,
                "submitted",
                `Waiting for receipt of ${step.ticker} sale…`,
                hash,
              );

              const receipt = await confirmedRebalanceReceipt(
                plan.walletAddress,
                hash,
                "sell",
                (canonical) => {
                  run = {
                    ...run,
                    steps: run.steps.map((p) =>
                      p.stepId === step.id ? { ...p, hash: canonical } : p,
                    ),
                  };
                  saveAgentExecution(run);
                },
              );

              const next = applyRebalanceReceipt(
                simulationLatest.current.city,
                plan,
                step,
                receipt,
              );
              saveConfirmedCity(next);

              run = {
                ...run,
                fingerprint: rebalanceFingerprint(next),
                steps: run.steps.map((p) =>
                  p.stepId === step.id
                    ? {
                        ...p,
                        status: "confirmed",
                        hash: receipt.hash,
                        error: undefined,
                      }
                    : p,
                ),
              };
              saveAgentExecution(run);
              focus(
                step,
                "confirmed",
                `Sold ${step.ticker} on-chain`,
                receipt.hash,
              );
              notify(`Confirmed removal of ${step.ticker}.`);
            }
          }

          run = { ...run, status: "completed", error: undefined };
          saveAgentExecution(run);
          notify(
            "Agent rebalance complete. Every building recorded in City Hall.",
          );
          return;
        }

        // Atomic Batch Mode:
        if (
          Date.now() > plan.expiresAt ||
          rebalanceFingerprint(simulationLatest.current.city) !==
            plan.fingerprint
        )
          throw new Error(
            "The blueprint expired or your city changed during wallet checks. Request a fresh blueprint.",
          );
        // Save the ID BEFORE opening the wallet. An interrupted request must be
        // polled, never resubmitted, even if the wallet response was lost.
        createdBatch = true;
        run = {
          ...run,
          batchId: newRebalanceBatchId(),
          batchStatus: "wallet",
          steps: run.steps.map((p) => ({
            ...p,
            status: "wallet",
            error: undefined,
          })),
        };
        saveAgentExecution(run);
        focus(
          plan.steps[0],
          "wallet",
          "One wallet approval for the complete rebalance",
        );
        notify("Agent: approve the whole rebalance once in your wallet.");
        sendAttempted = true;
        const id = await sendRebalanceBatch(
          provider,
          plan,
          calls!,
          run.batchId!,
        );
        run = {
          ...run,
          batchId: id,
          batchStatus: "pending",
          steps: run.steps.map((p) => ({ ...p, status: "submitted" })),
        };
        saveAgentExecution(run);
      } else {
        run = {
          ...run,
          batchStatus: "pending",
          steps: run.steps.map((p) => ({
            ...p,
            status: "submitted",
            error: undefined,
          })),
        };
        saveAgentExecution(run);
      }
      focus(
        plan.steps[0],
        "submitted",
        "Checking the atomic batch · no additional signatures",
      );
      const receipts = await confirmRebalanceBatch(
        provider,
        plan,
        run.batchId!,
        (hash) => {
          run = { ...run, steps: run.steps.map((p) => ({ ...p, hash })) };
          saveAgentExecution(run);
          focus(
            plan.steps[0],
            "submitted",
            "One transaction · verifying all building receipts",
            hash,
          );
        },
      );
      const next = applyRebalanceBatch(
        simulationLatest.current.city,
        plan,
        receipts,
      );
      // Persist all effects together. Every building references the same mined
      // transaction, and a reload cannot replay part of the signed rebalance.
      saveConfirmedCity(next);
      run = {
        ...run,
        batchStatus: "confirmed",
        fingerprint: rebalanceFingerprint(next),
        steps: run.steps.map((p, i) => ({
          ...p,
          status: "confirmed",
          hash: receipts[i].hash,
          error: undefined,
        })),
      };
      saveAgentExecution(run);
      notify("Batch confirmed. All building changes are saved in City Hall.");
      // A receipt-driven tour highlights the already-settled changes.
      for (const step of plan.steps) {
        focus(
          step,
          "confirmed",
          step.action === "sell"
            ? "Removal confirmed in the batch"
            : "Construction confirmed in the batch",
          receipts[0].hash,
        );
        setUpgrades((previous) => ({
          ...previous,
          [step.buildingId]: Date.now(),
        }));
        if (motion && !paused)
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
      run = { ...run, status: "completed", error: undefined };
      saveAgentExecution(run);
      notify(
        "Agent rebalance complete. One approval, one transaction, every building recorded in City Hall.",
      );
    } catch (error) {
      if (createdBatch && !sendAttempted) {
        // Saving failed before the signing RPC. There is no request to recover.
        run = { ...run, batchId: undefined, batchStatus: undefined };
      }
      const rejected =
        error instanceof RebalanceBatchRejected ||
        (error instanceof Error &&
          /user rejected|user denied|rejected transaction/i.test(
            error.message,
          ));
      const message =
        error instanceof Error
          ? error.message
          : "The wallet request could not finish. Check saved progress before retrying.";
      run = {
        ...run,
        status: "paused",
        error: message,
        ...(rejected && run.mode === "atomic" ? { batchStatus: "failed" as const } : {}),
        steps: run.steps.map((p) =>
          p.status === "confirmed"
            ? p
            : {
                ...p,
                status: "error",
                error: message,
                ...(rejected && run.mode === "atomic" ? { reverted: true } : {}),
              },
        ),
      };
      try {
        saveAgentExecution(run);
      } catch {
        run = {
          ...run,
          error: `${message} Browser saving is unavailable. Keep this page open and save the displayed progress.`,
        };
        executionRef.current = run;
        setAgentExecution(run);
      }
      setAgentActivity((activity) =>
        activity
          ? {
              ...activity,
              phase: "error",
              detail: rejected
                ? "Approval rejected in wallet"
                : message.slice(0, 80),
            }
          : null,
      );
      notify(
        rejected
          ? "Rebalance cancelled in wallet."
          : `Rebalance paused: ${message}`,
        true,
      );
    } finally {
      agentRunning.current = false;
      setSelected(null);
    }
  };
  const setTool = (next: Tool) => {
    if (cityMutationLocked && next !== "inspect") {
      notify(
        "The agent is settling a signed plan. You can move the camera while its transactions finish.",
        true,
      );
      return;
    }
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
    setBundleQueue([]);
    setPlaceSource(null);
  };
  const chooseCategory = (next: Category) => {
    if ((next === "companies" || next === "sectors") && !hasExchange) {
      setCategory(next);
      setTool("inspect");
      setKind(null);
      setPanel(null);
      notify(
        `Build the Stock Exchange first to unlock ${next === "sectors" ? "Sector Towers" : "Companies"}.`,
        true,
      );
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
      if (kind && defFor(kind).category !== next) {
        setKind(null);
      }
    }
  };
  const chooseBuilding = (
    value: BuildingKind,
    autoClose = false,
    source: "tray" | "exchange" = "tray",
  ) => {
    const def = defFor(value);
    const alreadyBuilt = city.buildings.some(
      (b) =>
        b.kind === value ||
        (Boolean(def.ticker) && defFor(b.kind).ticker === def.ticker),
    );
    if (alreadyBuilt) {
      notify(
        `${def.name} is already built on your island. Only one instance is allowed.`,
        true,
      );
      return;
    }
    if (def.ticker && !hasExchange) {
      notify("Build the Stock Exchange first.", true);
      return;
    }
    setPlaceSource(defFor(value).ticker ? source : null);
    setScanMode(false);
    setKind(value);
    setTool("build");
    setSelected(null);
    setMoving(null);
    setPanel(null);
    if (source === "tray") setBundleQueue([]);
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
      (value === "data" && !hasData) ||
      (value === "agent" && !hasAgentHall)
    ) {
      notify(
        `Build ${value === "portfolio" ? "City Hall" : value === "market" ? "the Stock Exchange" : value === "agent" ? "Agent Hall" : "the Data Center"} first.`,
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
    if (cityMutationLocked) return;
    if (!kind || !ready) return;
    const def = defFor(kind);
    const alreadyBuilt = city.buildings.some(
      (b) =>
        b.kind === kind ||
        (Boolean(def.ticker) && defFor(b.kind).ticker === def.ticker),
    );
    if (alreadyBuilt) {
      notify(
        `${def.name} is already built on your island. Only one instance is allowed.`,
        true,
      );
      setTool("inspect");
      setKind(null);
      return;
    }
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
      if (result.error === "Not enough funds" && city.cash === 0) {
        notify(
          "Treasury is $0. Sign in your wallet to claim the 10,000 $mUSD faucet!",
          true,
        );
        if (!wallet) setOnboardOpen(true);
      } else {
        notify(result.error, true);
      }
      return;
    }
    if (defFor(kind).ticker) {
      setTool("inspect");
      setKind(null);
      const lockedState: CityState = {
        ...result.state,
        buildings: result.state.buildings.map((b, i) =>
          i === result.state.buildings.length - 1 ? { ...b, locked: true } : b,
        ),
      };
      commit(lockedState);
      const placed = lockedState.buildings[lockedState.buildings.length - 1];
      const ticker = defFor(kind).ticker!;
      const entryPrice = priceOf(ticker, prices);
      const fromTray = placeSource !== "exchange";
      setPlaceSource(null);
      if (fromTray) {
        // 2.1 Single Building Direct Placement:
        // When a building is placed on the grid from the tray, immediately pop up the wallet signature request.
        // The rectangular 7-second construction bar runs during block confirmation. Once mined, the building unlocks permanently on the canvas.
        const buildingId = placed.id;
        setConfirmingBuildings((prev) => ({
          ...prev,
          [buildingId]: {
            confirming: true,
            confirmed: false,
            startedAt: Date.now(),
          },
        }));

        (async () => {
          let account = wallet;
          if (!account) {
            try {
              notify("Connecting wallet for on-chain placement…");
              account = await connectInjectedWallet();
              setWallet(account);
            } catch (err: unknown) {
              setConfirmingBuildings((prev) => {
                const next = { ...prev };
                delete next[buildingId];
                return next;
              });
              notify(
                `Kept as draft: connect wallet to confirm on BSC (${err instanceof Error ? err.message : "wallet connection cancelled"}).`,
                true,
              );
              return;
            }
          }

          notify(
            `${defFor(kind).name} drafted. Confirm the purchase popup in your wallet…`,
          );
          try {
            const { hash, positionId } = await recordBuildingOnchain(
              account,
              { ticker, usdAmount: amount, entryPrice, initialTier: 1 },
              (step, hash) => {
                if (step === "approve" && !hash)
                  notify("Confirm the mUSD approval popup in your wallet…");
                else if (step === "approve" && hash)
                  notify(`Approval sent. Now confirm the building purchase…`);
                else if (step === "buy" && hash)
                  notify(`Purchase sent. Waiting for BSC confirmation…`);
              },
            );

            const latest = simulationLatest.current.city;
            commit({
              ...latest,
              buildings: latest.buildings.map((b) =>
                b.id === buildingId
                  ? { ...b, locked: false, vaultTx: hash, vaultId: positionId }
                  : b,
              ),
            });
            setConfirmingBuildings((prev) => ({
              ...prev,
              [buildingId]: {
                confirming: false,
                confirmed: true,
                startedAt: prev[buildingId]?.startedAt,
              },
            }));
            notify(
              `${defFor(kind).name} unlocked and permanently recorded on BSC!`,
            );
          } catch (err: unknown) {
            setConfirmingBuildings((prev) => {
              const next = { ...prev };
              delete next[buildingId];
              return next;
            });
            notify(
              `Kept locked: on-chain payment failed (${err instanceof Error ? err.message : "wallet rejected"}). Retry in City Hall.`,
              true,
            );
          }
        })();
        return;
      } else if (!fromTray && bundleQueue.length > 1) {
        // Bundle flow: advance to the next queued stock.
        const rest = bundleQueue.slice(1);
        const done = bundleBuildingIds.length + 1;
        const total = bundleBuildingIds.length + bundleQueue.length;
        setBundleBuildingIds((prev) => [...prev, placed.id]);
        setBundleQueue(rest);
        setAmount(rest[0].amount);
        setTool("inspect");
        setKind(null);
        setPanel(null);
        chooseBuilding(rest[0].kind, true, "exchange");
        notify(
          `${defFor(kind).name} drafted locked (${done}/${total}). Now place ${defFor(rest[0].kind).name} — Esc stops the bundle.`,
        );
      } else {
        // 2.2 Bundle Direct Floating Batch Confirmation Modal:
        // After placing the final building of a bundle queue, trigger a streamlined "Confirm Bundle Purchase"
        // floating modal directly on the canvas to sign and unlock all buildings in a single transaction.
        const currentBundleIds = [...bundleBuildingIds, placed.id];
        const allBundleBuildings = lockedState.buildings.filter((b) =>
          currentBundleIds.includes(b.id),
        );
        setBundleQueue([]);
        setBundleBuildingIds([]);
        if (allBundleBuildings.length > 0) {
          setBundleModalBuildings(allBundleBuildings);
          setShowBundleModal(true);
          notify(
            "All bundle buildings placed! Confirm your purchase directly on the canvas.",
          );
        } else {
          notify(
            `${defFor(kind).name} drafted as locked at ${money(entryPrice)} per share.`,
          );
        }
      }
      return;
    }
    commit(result.state);
    notify(
      `${defFor(kind).name} placed${defFor(kind).ticker ? ` at ${money(priceOf(defFor(kind).ticker!, prices))} per tokenized share` : ""}${defFor(kind).ticker ? ". Investment placed." : ". Place another, or Esc."}`,
    );
  };
  const onRoad = (cells: Cell[]) => {
    if (cityMutationLocked) return;
    if (!ready) return;
    const result = constructRoad(cells, city);
    if (result.error) {
      if (result.error === "Not enough funds" && city.cash === 0) {
        notify(
          "Treasury is $0. Sign in your wallet to claim the 10,000 $mUSD faucet!",
          true,
        );
        if (!wallet) setOnboardOpen(true);
      } else {
        notify(result.error, true);
      }
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
    if (cityMutationLocked) return;
    if (
      city.buildings.some(
        (building) =>
          building.vaultId &&
          defFor(building.kind).ticker &&
          cell.r >= building.r &&
          cell.r <= building.r + 1 &&
          cell.c >= building.c &&
          cell.c <= building.c + 1,
      )
    ) {
      notify(
        "This building holds an on-chain stock position. Review and sign its removal through Agent Hall.",
        true,
      );
      return;
    }
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
  const paperHoldings = city.paper ?? [];
  const paperValue = paperHoldings.reduce(
    (sum, p) => sum + p.quantity * priceOf(p.ticker, prices),
    0,
  );
  const paperBasis = paperHoldings.reduce((sum, p) => sum + p.cost, 0);
  const portfolio =
    city.buildings.reduce(
      (sum, b) =>
        sum + (defFor(b.kind).ticker && !b.locked ? valueOf(b, prices) : 0),
      0,
    ) + paperValue;
  const stockPositions = city.buildings.filter(
    (b) => defFor(b.kind).ticker && !b.locked,
  );
  const stockCostBasis =
    stockPositions.reduce((sum, b) => sum + b.entry * b.quantity, 0) +
    paperBasis;
  const realizedPnl = city.realizedPnl ?? 0;
  const unrealizedPnl = portfolio - stockCostBasis;
  const totalPnl = unrealizedPnl + realizedPnl;
  const totalReturnPct =
    stockCostBasis > 0
      ? (totalPnl / stockCostBasis) * 100
      : realizedPnl !== 0
        ? realizedPnl > 0
          ? 100
          : -100
        : 0;
  const hasPositions = stockPositions.length > 0 || realizedPnl !== 0;
  const alloc = allocationOf(stockPositions, prices);
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
  const inspectorOpen = Boolean(
    current && definition && tool === "inspect" && !panel && !scanMode && !intelBuilding,
  );
  const placeInspector = useCallback(() => {
    if (typeof window === "undefined" || !selected) return;
    const node = document.querySelector(
      `[data-building-id="${CSS.escape(selected)}"]`,
    );
    const rect = node?.getBoundingClientRect() ?? null;
    const advisor = document.querySelector('aside[aria-label="cokoo"]');
    const advisorRect = advisor?.getBoundingClientRect() ?? null;
    const next = inspectorPlacement(
      { w: window.innerWidth, h: window.innerHeight },
      rect
        ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        : null,
      advisorRect
        ? { left: advisorRect.left, top: advisorRect.top, right: advisorRect.right }
        : null,
    );
    const key = next
      ? `${next.left}|${next.top}|${next.width}|${next.maxHeight}`
      : "dock";
    if (inspectorStyleKey.current !== key) {
      inspectorStyleKey.current = key;
      setInspectorStyle(
        next
          ? {
              position: "fixed",
              left: next.left,
              top: next.top,
              width: next.width,
              maxHeight: next.maxHeight,
              right: "auto",
              bottom: "auto",
            }
          : null,
      );
    }
  }, [selected]);
  useEffect(() => {
    if (!inspectorOpen) {
      if (inspectorStyleKey.current !== "dock") {
        inspectorStyleKey.current = "dock";
        setInspectorStyle(null);
      }
      return;
    }
    placeInspector();
    let raf = 0;
    let last = "";
    const snapshot = () => {
      const node = selected
        ? document.querySelector(`[data-building-id="${CSS.escape(selected)}"]`)
        : null;
      const rect = node?.getBoundingClientRect();
      const advisor = document.querySelector('aside[aria-label="cokoo"]');
      const advisorRect = advisor?.getBoundingClientRect();
      return [
        window.innerWidth,
        window.innerHeight,
        rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : "gone",
        advisorRect ? `${advisorRect.left},${advisorRect.top},${advisorRect.right}` : "none",
      ].join("|");
    };
    const tick = () => {
      const currentSnapshot = snapshot();
      if (currentSnapshot !== last) {
        last = currentSnapshot;
        placeInspector();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", placeInspector);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", placeInspector);
    };
  }, [inspectorOpen, placeInspector, selected, zoom]);
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
        simulationReturns={gameMode === "simulation" ? simulationReturns : null}
        now={now}
        upgrades={upgrades}
        confirmingBuildings={confirmingBuildings}
        agentActivity={agentActivity ?? undefined}
        onConstructionComplete={handleConstructionComplete}
        onZoom={changeZoom}
        onSelect={(id) => {
          setSelected(id);
          const b = city.buildings.find((b) => b.id === id);
          if (b && !defFor(b.kind).ticker) {
            openPanel(
              b.kind === "agent_hall"
                ? "agent"
                : b.kind === "hall"
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
      <BundleModal
        open={showBundleModal}
        buildings={bundleModalBuildings}
        prices={prices}
        walletAddress={wallet}
        onClose={() => setShowBundleModal(false)}
        onConnectWallet={async () => {
          const acc = await connectInjectedWallet();
          setWallet(acc);
          return acc;
        }}
        onStartConfirmation={(buildingIds) => {
          setConfirmingBuildings((prev) => {
            const copy = { ...prev };
            for (const id of buildingIds) {
              copy[id] = {
                confirming: true,
                confirmed: false,
                startedAt: Date.now(),
              };
            }
            return copy;
          });
        }}
        onConfirmSuccess={(receipts) => {
          const latest = simulationLatest.current.city;
          const byId = new Map(receipts.map((r) => [r.buildingId, r]));
          commit({
            ...latest,
            buildings: latest.buildings.map((b) => {
              const r = byId.get(b.id);
              return r
                ? { ...b, locked: false, vaultTx: r.hash, vaultId: r.vaultId }
                : b;
            }),
          });
          setConfirmingBuildings((prev) => {
            const copy = { ...prev };
            for (const r of receipts) {
              copy[r.buildingId] = {
                confirming: false,
                confirmed: true,
                startedAt: Date.now(),
              };
            }
            return copy;
          });
          notify(
            `🎉 Bundle confirmed on BSC! All ${receipts.length} buildings unlocked and permanently constructed.`,
          );
        }}
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
          <div
            className={`cash-resource-container ${city.cash === 0 ? "needs-funds" : ""}`}
          >
            <button
              className="cash-resource"
              onClick={() => {
                if (city.cash === 0 && !wallet) {
                  setOnboardOpen(true);
                } else {
                  openPanel("portfolio");
                }
              }}
              title={
                city.cash === 0
                  ? "Treasury is $0 · Connect wallet to claim faucet"
                  : "City Hall · Treasury & Balances"
              }
            >
              <img
                src={sprite("buttons/portfolio")}
                alt=""
                aria-hidden="true"
              />
              <b>{wholeMoney(city.cash)}</b>
            </button>
            <button
              type="button"
              className={`add-funds-btn ${city.cash === 0 ? "faucet-pulse" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!wallet) {
                  notify(
                    "Sign in with your wallet first to claim the faucet!",
                    true,
                  );
                  setOnboardOpen(true);
                  return;
                }
                setOnboardOpen(true);
              }}
              title={
                !wallet
                  ? "Sign in wallet first to claim 10,000 $mUSD faucet (+)"
                  : "Claim 10,000 $mUSD Faucet (+)"
              }
              aria-label="Add funds / Claim faucet"
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
          <OnchainWallet address={wallet} onChange={setWallet} />
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
        !selected &&
        booted &&
        !category && (
          <div
            className={`start-note ${guideHidden ? "minimized" : ""}`}
            role="status"
          >
            <span className="step-number">
              {city.cash === 0
                ? "0/3"
                : `${steps.filter(Boolean).length + 1}/3`}
            </span>
            {!guideHidden && (
              <span>
                <b>Empty island — build it yourself</b>
                <small>
                  {city.cash === 0 ? (
                    <button
                      type="button"
                      onClick={() => setOnboardOpen(true)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#f0b90b",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        font: "inherit",
                        textDecoration: "underline",
                      }}
                    >
                      ★ Sign in wallet to claim $10k Faucet (+)
                    </button>
                  ) : (
                    <>
                      {steps[0] ? "✓" : "1."} Drag Roads (R) ·{" "}
                      {steps[1] ? "✓" : "2."} Build Exchange (S) ·{" "}
                      {steps[2] ? "✓" : "3."} Buy a company
                    </>
                  )}
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
      <BuildingCatalogueModal
        open={Boolean(category)}
        category={category}
        onSelectCategory={chooseCategory}
        onClose={() => setCategory(null)}
        hasExchange={hasExchange}
        cityCash={city.cash}
        prices={prices}
        walletAddress={wallet}
        initialKind={kind}
        builtKinds={builtKinds}
        onClaimFaucet={() => {
          commit({
            ...simulationLatest.current.city,
            cash: simulationLatest.current.city.cash + 10_000,
          });
          notify("Claimed 10,000 testnet mUSD! Treasury funded.");
        }}
        onStartDrawRoad={() => {
          setTool("road");
          setKind(null);
          setCategory(null);
          notify(
            "Drawing roads ($10/tile). Drag a route on island, release to build. Esc to finish.",
          );
        }}
        onPayAndPlace={(k, amt) => {
          setAmount(amt);
          chooseBuilding(k, true, "tray");
        }}
      />
      {current &&
        definition &&
        tool === "inspect" &&
        !panel &&
        !scanMode &&
        !intelBuilding && (
          <aside
            className="inspection-panel"
            aria-label="Selected building"
            style={inspectorStyle ?? undefined}
          >
            <header>
              <div>
                <small>
                  {definition.category === "companies"
                    ? "STOCK BUILDING · TOKENIZED ASSET"
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
                draggable={false}
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
                const ret =
                  simulationReturns?.[current.id] ?? returnOf(current, prices);
                const val = valueOf(current, prices);
                const myAlloc =
                  alloc.find((a) => a.id === current.id)?.pct ?? 0;
                const live = priceOf(definition.ticker, prices);
                const currentTier = tier(ret, thresholds);
                const level =
                  currentTier === "minus" ? 0 : portfolioLevel(currentTier);
                const status = portfolioStatus(ret);
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
                        <b
                          className={
                            status === "gain"
                              ? "positive"
                              : status === "loss"
                                ? "negative"
                                : "flat"
                          }
                        >
                          {portfolioPercent(ret)}
                        </b>
                      </span>
                      <span>
                        Tier Level
                        <b
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {tierName(currentTier)}
                          <span className="stock-badge-pips" aria-hidden="true">
                            {[1, 2, 3].map((n) => (
                              <i
                                key={n}
                                className={`pip ${n <= level ? "filled" : ""}`}
                              />
                            ))}
                          </span>
                        </b>
                      </span>
                      <span>
                        Allocation<b>{myAlloc.toFixed(1)}% of stocks</b>
                      </span>
                      {current.locked && (
                        <span>
                          Status
                          <b style={{ color: "#f0b90b" }}>🔒 Locked (Unpaid)</b>
                        </span>
                      )}
                      <small>
                        {PROVIDER_TAG} ·{" "}
                        {feed.quotes[definition.ticker!]?.source} ·{" "}
                        {feed.quotes[definition.ticker!]?.status}
                      </small>
                    </div>
                    <div
                      className="chain-link"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
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
                        <span>
                          BNB Chain Vault: {VAULT_ADDRESS.slice(0, 6)}…
                          {VAULT_ADDRESS.slice(-4)}
                        </span>
                        <ExternalLink size={11} />
                      </a>
                      <small style={{ color: "#8b9ea7", fontSize: "10px" }}>
                        Tracked & liquidatable on BSC Testnet (Chain ID 97)
                      </small>
                      {(() => {
                        const rwa = feed.quotes[definition.ticker!]?.rwa;
                        if (!rwa) return null;
                        const premium = rwa.spreadBps >= 0;
                        return (
                          <small
                            style={{
                              color: "#8b9ea7",
                              fontSize: "10px",
                              lineHeight: 1.6,
                            }}
                          >
                            On-chain {money(rwa.onchain)} · ref{" "}
                            {money(rwa.reference)} ·{" "}
                            <b
                              className={premium ? "positive" : "negative"}
                            >
                              {premium ? "+" : ""}
                              {(rwa.spreadBps / 100).toFixed(2)}%
                            </b>{" "}
                            {rwa.referenceFrozen
                              ? "· ref frozen (market closed)"
                              : rwa.session === "halted"
                                ? "· halted"
                                : "· live spread"}{" "}
                            · {rwa.platform}
                          </small>
                        );
                      })()}
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="service-description">{definition.description}</p>
            )}
            {!definition.ticker && current.kind !== "monument" && (
              <button
                className="panel-action"
                onClick={() =>
                  openPanel(
                    current.kind === "agent_hall"
                      ? "agent"
                      : current.kind === "hall"
                        ? "portfolio"
                        : current.kind === "exchange"
                          ? "market"
                          : "data",
                  )
                }
              >
                Open{" "}
                {current.kind === "agent_hall"
                  ? "Agent Hall"
                  : current.kind === "hall"
                    ? "finances"
                    : current.kind === "exchange"
                      ? "market"
                      : "data status"}
                <ChevronRight size={14} />
              </button>
            )}
            {current.kind === "monument" && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(240, 185, 11, 0.15), rgba(240, 185, 11, 0.05))",
                  border: "1px solid rgba(240, 185, 11, 0.35)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>🏛️</span>
                <div>
                  <strong
                    style={{ color: "#f0b90b", fontSize: 11, display: "block" }}
                  >
                    BNB Chain Landmark
                  </strong>
                  <small style={{ color: "#8b9ea8", fontSize: 10 }}>
                    Official ecosystem landmark on BNB Smart Chain.
                  </small>
                </div>
              </div>
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
                ? "Testnet position. Removing liquidates value to treasury funds."
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
          walletAddress={wallet}
          onConnectWallet={async () => {
            const account = await connectInjectedWallet();
            setWallet(account);
            return account;
          }}
          onAddDemoCash={(amt = 10000) => {
            if (!wallet) {
              notify("Sign in your wallet first to claim faucet funds!", true);
              setOnboardOpen(true);
              return;
            }
            const next = {
              ...simulationLatest.current.city,
              cash: simulationLatest.current.city.cash + amt,
            };
            commit(next);
            notify(`Added +${money(amt)} Demo USD to Treasury!`);
          }}
          onClaimFaucet={() => {
            commit({
              ...simulationLatest.current.city,
              cash: simulationLatest.current.city.cash + 10_000,
            });
            notify("Claimed 10,000 testnet mUSD! Confirmed on BNB Chain.");
          }}
          onConfirmBatch={(receipts) => {
            const latest = simulationLatest.current.city;
            const byId = new Map(receipts.map((r) => [r.buildingId, r]));
            commit({
              ...latest,
              buildings: latest.buildings.map((b) => {
                const r = byId.get(b.id);
                return r
                  ? { ...b, locked: false, vaultTx: r.hash, vaultId: r.vaultId }
                  : b;
              }),
            });
            setConfirmingBuildings((prev) => {
              const copy = { ...prev };
              for (const r of receipts) {
                copy[r.buildingId] = {
                  confirming: false,
                  confirmed: true,
                  startedAt: Date.now(),
                };
              }
              return copy;
            });
            notify("Buildings unlocked and permanent. Receipts in City Hall.");
          }}
          onBuy={(kind, investment) => {
            setAmount(investment);
            chooseBuilding(kind, true, "exchange");
          }}
          onBuyBundle={(items) => {
            if (!items.length) return "Pick at least one stock for the bundle.";
            if (!hasExchange)
              return "Build the Stock Exchange on your island before placing a bundle.";
            const alreadyBuiltItem = items.find((i) => {
              const def = defFor(i.kind);
              return city.buildings.some(
                (b) =>
                  b.kind === i.kind ||
                  (Boolean(def.ticker) && defFor(b.kind).ticker === def.ticker),
              );
            });
            if (alreadyBuiltItem) {
              return `${defFor(alreadyBuiltItem.kind).name} is already built on your island. Only 1 building per company or service is allowed.`;
            }
            const totalCost = items.reduce((s, i) => s + i.amount, 0);
            if (totalCost > city.cash)
              return `Bundle costs ${money(totalCost)} but you have ${money(city.cash)}. Lower some amounts.`;
            setBundleQueue(items);
            setBundleBuildingIds([]);
            setAmount(items[0].amount);
            chooseBuilding(items[0].kind, true, "exchange");
            notify(
              `Bundle: place ${items.map((i) => defFor(i.kind).ticker).join(", ")} one by one, then confirm directly on the canvas.`,
            );
            return "";
          }}
          onBuyPaper={(ticker, investment) => {
            const result = buyPaper(
              city,
              ticker,
              investment,
              priceOf(ticker, prices),
            );
            if (result.error) return result.error;
            commit(result.state);
            return `${ticker} position opened (no building). Visible in City Hall.`;
          }}
          onSell={(ticker, fraction) => {
            if (cityMutationLocked)
              return "Finish the agent's pending transaction before selling.";
            if (
              city.buildings.some(
                (building) =>
                  defFor(building.kind).ticker === ticker && building.vaultId,
              )
            )
              return "This holding is on-chain. Open Agent Hall to review and sign its restructuring plan.";
            const result = sellPosition(city, ticker, fraction, prices);
            if (result.error) return result.error;
            commit(result.state);
            return `${fraction === 1 ? "Entire holding" : `${fraction * 100}% of holding`} sold. Funds updated.`;
          }}
          onSellPaper={(ticker, fraction) => {
            const result = sellPaper(city, ticker, fraction, prices);
            if (result.error) return result.error;
            commit(result.state);
            return `${fraction === 1 ? "Entire position" : `${fraction * 100}% of position`} sold. Funds updated.`;
          }}
          onFocus={(b) => {
            setPanel(null);
            setIntelId(null);
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
      {panel === "agent" && (
        <AgentHall
          city={city}
          prices={prices}
          feed={feed}
          walletConnected={!!wallet}
          walletAddress={wallet}
          execution={agentExecution}
          onExecute={executeRebalance}
          onClearExecution={() => {
            if (
              agentRunning.current ||
              hasPendingRebalance(executionRef.current)
            )
              return;
            localStorage.removeItem(REBALANCE_STORAGE);
            executionRef.current = null;
            setAgentExecution(null);
            setAgentActivity(null);
          }}
          onConnectWallet={async () => {
            const account = await connectInjectedWallet();
            setWallet(account);
          }}
          onWatchCity={() => setPanel(null)}
          onClose={() => setPanel(null)}
          onMarket={(ticker) => {
            if (!hasExchange) return;
            openPanel("market");
            setAssetTicker(ticker);
          }}
        />
      )}
      {agentExecution &&
        panel !== "agent" &&
        !(
          dockDismissed?.id === agentExecution.plan.id &&
          dockDismissed?.status === agentExecution.status
        ) && (
          <AgentExecutionDock
            execution={agentExecution}
            onOpen={() => setPanel("agent")}
            onClose={() => {
              if (agentExecution.status === "completed") {
                // Receipts already live in City Hall; drop the finished run so it stays dismissed.
                localStorage.removeItem(REBALANCE_STORAGE);
                executionRef.current = null;
                setAgentExecution(null);
                setAgentActivity(null);
              } else {
                // In-flight or paused runs stay resumable; hide only until the status changes.
                setDockDismissed({
                  id: agentExecution.plan.id,
                  status: agentExecution.status,
                });
              }
            }}
          />
        )}
      {panel && !["portfolio", "market", "data", "agent"].includes(panel) && (
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
                <span className="settings-mode-label">
                  Market Operating Mode
                </span>
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
                      {simulationRunning
                        ? "Pause Simulation"
                        : "Resume Simulation"}
                    </button>

                    {/* Percentage Threshold Controls */}
                    <div className="settings-thresholds-wrapper">
                      <div className="settings-sim-row">
                        <span className="settings-sim-sublabel">
                          Tier Thresholds (%)
                        </span>
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
                              onChange={(e) =>
                                handleThresholdChange("minus", e.target.value)
                              }
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
                              onChange={(e) =>
                                handleThresholdChange("level2", e.target.value)
                              }
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
                              onChange={(e) =>
                                handleThresholdChange("level3", e.target.value)
                              }
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
                          Minus: &lt; {thresholds.minus > 0 ? "+" : ""}
                          {thresholds.minus}%
                        </span>
                        <span className="tier-tag level1">
                          Tier 1: {thresholds.minus > 0 ? "+" : ""}
                          {thresholds.minus}% to &lt;{" "}
                          {thresholds.level2 > 0 ? "+" : ""}
                          {thresholds.level2}%
                        </span>
                        <span className="tier-tag level2">
                          Tier 2: {thresholds.level2 > 0 ? "+" : ""}
                          {thresholds.level2}% to &lt;{" "}
                          {thresholds.level3 > 0 ? "+" : ""}
                          {thresholds.level3}%
                        </span>
                        <span className="tier-tag level3">
                          Tier 3: ≥ {thresholds.level3 > 0 ? "+" : ""}
                          {thresholds.level3}%
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
                disabled={cityMutationLocked}
              >
                Start a new city
                <Trash2 size={15} />
              </button>
              <p className="panel-disclaimer">
                Your city saves automatically in this browser. A new city starts
                completely empty with $10,000 in treasury funds.
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
                ["Pause market updates", "P"],
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
                tiles are connected, adding 3 vehicles every 10 road tiles.
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
        <CityAdvisor city={city} prices={prices} walletAddress={wallet} />
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
              empty island with $0 in treasury funds. Sign in with your wallet
              to claim the 10,000 $mUSD faucet grant.
            </p>
            <div>
              <button onClick={() => setConfirmReset(false)}>
                Keep this city
              </button>
              <button
                className="confirm-new"
                onClick={() => {
                  if (cityMutationLocked) return;
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
                  notify("New city started. Claim faucet to begin.");
                  setOnboardOpen(true);
                }}
              >
                Start empty city
              </button>
            </div>
          </div>
        </div>
      )}
      <FaucetOnboardModal
        open={onboardOpen}
        onClose={() => setOnboardOpen(false)}
        walletAddress={wallet}
        onWalletConnected={(addr) => {
          setWallet(addr);
          notify(`Wallet connected: ${addr.slice(0, 6)}…${addr.slice(-4)}`);
        }}
        onClaimSuccess={(amt, hash) => {
          commit({
            ...simulationLatest.current.city,
            cash: simulationLatest.current.city.cash + amt,
          });
          notify(
            hash
              ? `Claimed ${money(amt)} testnet mUSD on BNB Chain!`
              : `Added +${money(amt)} testnet funds to Treasury!`,
          );
        }}
        currentCash={city.cash}
      />
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
