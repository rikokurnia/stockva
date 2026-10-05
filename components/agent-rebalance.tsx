"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock3,
  ExternalLink,
  Hammer,
  LoaderCircle,
  MapPinned,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  catalogue,
  defFor,
  money,
  sprite,
  type CityState,
  type PriceMap,
} from "../lib/city";
import { bscTxLink } from "../lib/contracts";
import type { MarketFeed } from "../lib/market";
import {
  rebalanceFingerprint,
  type RebalancePlan,
  type RebalanceStep,
} from "../lib/rebalance";
import {
  hasPendingRebalance,
  type RebalanceExecution,
  type RebalanceStepProgress,
} from "../lib/rebalance-execution";
import styles from "./agent-rebalance.module.css";

type Props = {
  city: CityState;
  prices: PriceMap;
  feed: MarketFeed;
  walletConnected: boolean;
  walletAddress: string | null;
  execution: RebalanceExecution | null;
  onExecute: (plan: RebalancePlan) => Promise<void>;
  onConnectWallet: () => Promise<void>;
  onWatchCity: () => void;
  onClearExecution: () => void;
};

const percent = (value: number) => `${value.toFixed(1)}%`;
const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

function stepLabel(step: RebalanceStep) {
  return step.action === "sell"
    ? `Remove ${step.ticker}`
    : `Build ${step.ticker}`;
}

function progressLabel(progress?: RebalanceStepProgress) {
  return progress?.status === "wallet"
    ? "Awaiting wallet signature"
    : progress?.status === "submitted"
      ? "Confirming on BNB Chain"
      : progress?.status === "confirmed"
        ? "Confirmed on-chain"
        : progress?.status === "error"
          ? "Execution paused"
          : "Queued";
}

function StatusIcon({ progress }: { progress?: RebalanceStepProgress }) {
  return progress?.status === "confirmed" ? (
    <Check size={16} aria-hidden="true" />
  ) : progress?.status === "wallet" ? (
    <Wallet size={16} aria-hidden="true" />
  ) : progress?.status === "submitted" ? (
    <LoaderCircle size={16} className={styles.spin} aria-hidden="true" />
  ) : progress?.status === "error" ? (
    <AlertCircle size={16} aria-hidden="true" />
  ) : (
    <Clock3 size={16} aria-hidden="true" />
  );
}

export default function AgentRebalance({
  city,
  prices,
  feed,
  walletConnected,
  walletAddress,
  execution,
  onExecute,
  onConnectWallet,
  onWatchCity,
  onClearExecution,
}: Props) {
  const [instruction, setInstruction] = useState(
    "Reduce concentration and spread my city across sectors. Keep the changes practical.",
  );
  const [budget, setBudget] = useState("0");
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [walletMusd, setWalletMusd] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<"current" | "planned">("planned");
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const draftInputs = useRef("");
  const rows = useRef<Record<string, HTMLLIElement | null>>({});

  const rebalanceCount = Math.min(
    3,
    city.rebalanceCount ??
      new Set(
        (city.agentReceipts ?? [])
          .map((r) => r.planId)
          .filter((id) => id && id !== "direct"),
      ).size,
  );
  const rebalancesRemaining = Math.max(0, 3 - rebalanceCount);
  const maxRebalancesReached = rebalanceCount >= 3;

  const running = execution?.status === "running";
  const shownPlan =
    execution &&
    (!plan ||
      execution.plan.id === plan.id ||
      running ||
      execution.status === "paused")
      ? execution.plan
      : plan;
  const shownExecution =
    execution?.plan.id === shownPlan?.id ? execution : null;
  const completed =
    shownExecution?.steps.filter((s) => s.status === "confirmed").length ?? 0;
  const active = shownExecution?.steps.find(
    (s) =>
      s.status === "wallet" || s.status === "submitted" || s.status === "error",
  );
  const activeStep = shownPlan?.steps.find((s) => s.id === active?.stepId);
  const budgetAmount = Number(budget);
  const validBudget =
    budget.trim() !== "" && Number.isFinite(budgetAmount) && budgetAmount >= 0;
  const expired = !!shownPlan && shownPlan.expiresAt <= now && !shownExecution;
  const walletChanged =
    !!shownPlan &&
    shownPlan.walletAddress.toLowerCase() !== walletAddress?.toLowerCase();
  const cityChanged =
    !!shownPlan &&
    !shownExecution &&
    shownPlan.fingerprint !== rebalanceFingerprint(city);
  const inputsChanged =
    !!plan &&
    shownPlan?.id === plan.id &&
    !shownExecution &&
    draftInputs.current !== JSON.stringify([instruction.trim(), budgetAmount]);
  const blocked = expired || walletChanged || cityChanged || inputsChanged;
  const stockBuildings = city.buildings.filter(
    (b) => defFor(b.kind).ticker && !b.locked,
  );
  const onchainBuildings = stockBuildings.filter((b) => b.vaultId);

  useEffect(() => {
    mounted.current = true;
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      mounted.current = false;
      controller.current?.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setWalletMusd(null);
      return;
    }
    let cancelled = false;
    async function checkBalance() {
      try {
        const { createPublicClient, http, formatUnits } = await import("viem");
        const { bscTestnet } = await import("viem/chains");
        const { BSC_TESTNET_RPC, MOCK_USD_ADDRESS, MOCK_USD_ABI } = await import(
          "../lib/contracts"
        );
        const client = createPublicClient({
          chain: bscTestnet,
          transport: http(BSC_TESTNET_RPC, { timeout: 8000 }),
        });
        const bal = (await client.readContract({
          address: MOCK_USD_ADDRESS,
          abi: MOCK_USD_ABI,
          functionName: "balanceOf",
          args: [walletAddress as `0x${string}`],
        })) as bigint;
        if (!cancelled) {
          setWalletMusd(Number(formatUnits(bal, 18)));
        }
      } catch {
        // Silently continue
      }
    }
    void checkBalance();
    const interval = setInterval(() => void checkBalance(), 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [walletAddress]);

  const allocations = useMemo(() => {
    if (!shownPlan) return [];
    const tickers = [
      ...new Set(
        [...shownPlan.before.holdings, ...shownPlan.after.holdings].map(
          (h) => h.ticker,
        ),
      ),
    ];
    return tickers
      .map((ticker) => {
        const before = shownPlan.before.holdings.find(
          (h) => h.ticker === ticker,
        );
        const after = shownPlan.after.holdings.find((h) => h.ticker === ticker);
        return {
          ticker,
          before,
          after,
          weight: Math.max(before?.weight ?? 0, after?.weight ?? 0),
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [shownPlan]);

  const previewBuildings = useMemo(() => {
    const removed = new Set(
      shownPlan?.steps
        .filter((s) => s.action === "sell")
        .map((s) => s.buildingId),
    );
    const added = new Set(
      shownPlan?.steps
        .filter((s) => s.action === "buy")
        .map((s) => s.buildingId),
    );
    const live = stockBuildings
      .filter(
        (b) =>
          (!shownPlan || !added.has(b.id)) &&
          (preview === "current" || !shownPlan || !removed.has(b.id)),
      )
      .map((b) => ({
        id: b.id,
        cell: { r: b.r, c: b.c },
        image: defFor(b.kind).image,
        ticker: defFor(b.kind).ticker!,
        planned: false,
        stepId: shownPlan?.steps.find(
          (s) => s.action === "sell" && s.buildingId === b.id,
        )?.id,
      }));
    if (preview === "current" && shownPlan) {
      for (const step of shownPlan.steps) {
        if (
          step.action !== "sell" ||
          live.some((b) => b.id === step.buildingId)
        )
          continue;
        const image = catalogue.find((d) => d.ticker === step.ticker)?.image;
        if (image)
          live.push({
            id: step.buildingId,
            cell: step.cell,
            image,
            ticker: step.ticker,
            planned: false,
            stepId: step.id,
          });
      }
    }
    if (preview === "planned" && shownPlan) {
      for (const step of shownPlan.steps) {
        if (step.action !== "buy") continue;
        live.push({
          id: step.buildingId,
          cell: step.cell,
          image: defFor(step.kind).image,
          ticker: step.ticker,
          planned: true,
          stepId: step.id,
        });
      }
    }
    const points = live.map((b) => ({
      ...b,
      x: b.cell.c - b.cell.r,
      y: b.cell.c + b.cell.r,
    }));
    const minX = points.length ? Math.min(...points.map((b) => b.x)) : 0;
    const maxX = points.length ? Math.max(...points.map((b) => b.x)) : 0;
    const minY = points.length ? Math.min(...points.map((b) => b.y)) : 0;
    const maxY = points.length ? Math.max(...points.map((b) => b.y)) : 0;
    const spanX = Math.max(6, maxX - minX);
    const spanY = Math.max(6, maxY - minY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return points.map((b) => ({
      ...b,
      left: 50 + ((b.x - midX) / spanX) * 72,
      top: 38 + ((b.y - midY) / spanY) * 40,
      zIndex: Math.round(b.y * 10 + 500),
    }));
  }, [stockBuildings, shownPlan, preview]);

  async function connect() {
    setConnecting(true);
    setError("");
    try {
      await onConnectWallet();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Wallet connection didn’t finish. Try again.",
        );
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }

  async function requestPlan() {
    if (busy || running || !walletAddress || !validBudget || maxRebalancesReached) return;
    setBusy(true);
    setError("");
    const nextController = new AbortController();
    controller.current = nextController;
    const timeout = setTimeout(() => nextController.abort(), 60_000);
    try {
      const response = await fetch("/api/rebalance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city: {
            ...city,
            cash: Math.max(city.cash, walletMusd ?? 0),
          },
          prices,
          feed,
          walletAddress,
          budget: budgetAmount,
          instruction: instruction.trim(),
        }),
        signal: nextController.signal,
      });
      const result = (await response.json()) as {
        plan?: RebalancePlan;
        error?: string;
      };
      if (!response.ok || !result.plan || !Array.isArray(result.plan.steps))
        throw new Error(
          result.error ||
            "Cokoo couldn’t prepare a valid blueprint. Try again.",
        );
      if (!mounted.current) return;
      draftInputs.current = JSON.stringify([instruction.trim(), budgetAmount]);
      setPlan(result.plan);
      setPreview("planned");
      setSelected(null);
      setNow(Date.now());
    } catch (cause) {
      if (!mounted.current) return;
      setError(
        nextController.signal.aborted
          ? "The agent took too long to reply. Your city is unchanged. Try again."
          : cause instanceof Error
            ? cause.message
            : "Can’t reach the agent. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }

  async function execute() {
    if (!shownPlan || running || starting || walletChanged) return;
    setStarting(true);
    setError("");
    try {
      await onExecute(shownPlan);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Execution paused. Review the pending step and try again.",
        );
    } finally {
      if (mounted.current) setStarting(false);
    }
  }

  const buys = shownPlan?.steps.filter((s) => s.action === "buy").length ?? 0;
  const sells = shownPlan?.steps.filter((s) => s.action === "sell").length ?? 0;
  const currentStage =
    shownExecution?.status === "completed"
      ? 3
      : active?.status === "wallet"
        ? 1
        : shownExecution?.batchStatus === "pending" ||
            shownExecution?.steps.some((step) => step.hash && !step.reverted)
          ? 2
          : shownPlan
            ? 1
            : 0;

  return (
    <section className={styles.rebalance} aria-labelledby="rebalance-title">
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>
            <Sparkles size={13} aria-hidden="true" /> AGENT REBALANCE
          </span>
          <h3 id="rebalance-title">A new balance. A city in motion.</h3>
          <p>
            Give Cokoo a direction. Review the blueprint, approve in your wallet,
            then watch your stock buildings take shape.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className={styles.badgeCount}>
            Rebalance {rebalanceCount}/3 {maxRebalancesReached ? "(Limit reached)" : `(${rebalancesRemaining} left)`}
          </span>
          <span className={styles.network}>
            <i /> BNB Chain testnet
          </span>
        </div>
      </div>

      <ol className={styles.stages} aria-label="Rebalance stages">
        {[
          {
            title: "Agent blueprint",
            detail: "Your goals, actual holdings",
            icon: Sparkles,
          },
          {
            title: "Wallet approval",
            detail: "1 signature for all stocks (same as Bundle)",
            icon: Wallet,
          },
          {
            title: "City restructuring",
            detail: "On-chain receipts, live buildings",
            icon: Hammer,
          },
        ].map(({ title, detail, icon: Icon }, index) => (
          <li
            key={title}
            className={
              currentStage > index
                ? styles.stageDone
                : currentStage === index
                  ? styles.stageActive
                  : ""
            }
          >
            <span>
              {currentStage > index ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Icon size={17} aria-hidden="true" />
              )}
            </span>
            <div>
              <b>{title}</b>
              <small>{detail}</small>
            </div>
            {index < 2 && (
              <ArrowRight
                size={16}
                className={styles.stageArrow}
                aria-hidden="true"
              />
            )}
          </li>
        ))}
      </ol>

      <div className={styles.workspace}>
        <aside className={styles.workbench}>
          <div className={styles.buddy}>
            <img src="/assets/ai_logo.png" alt="" width={52} height={52} />
            <div>
              <h4>Cokoo’s workbench</h4>
              <span>Your city, your call.</span>
            </div>
          </div>
          {maxRebalancesReached && (
            <div
              className={styles.boundary}
              style={{
                borderColor: "rgba(240, 185, 11, 0.4)",
                background: "rgba(240, 185, 11, 0.08)",
                marginBottom: "14px",
              }}
            >
              <ShieldCheck size={17} aria-hidden="true" style={{ color: "#f0b90b" }} />
              <p>
                <b>3 of 3 rebalances completed.</b> You have used all 3 available AI rebalances for this city.
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void requestPlan();
            }}
          >
            <label className={styles.label} htmlFor="rebalance-direction">
              What should change?
            </label>
            <textarea
              id="rebalance-direction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              maxLength={500}
              rows={4}
              disabled={running || busy || shownExecution?.status === "paused" || maxRebalancesReached}
              autoComplete="off"
            />
            <div
              className={styles.quickGoals}
              aria-label="Rebalance directions"
            >
              {[
                {
                  label: "Spread the risk",
                  text: "Reduce concentration and spread my city across sectors. Keep the changes practical.",
                },
                {
                  label: "Simplify the city",
                  text: "Simplify my city into fewer stock buildings while keeping exposure across sectors.",
                },
              ].map((goal) => (
                <button
                  type="button"
                  key={goal.label}
                  onClick={() => setInstruction(goal.text)}
                  aria-pressed={instruction === goal.text}
                  disabled={
                    running || busy || shownExecution?.status === "paused" || maxRebalancesReached
                  }
                >
                  {goal.label}
                </button>
              ))}
            </div>
            <div className={styles.budgetHeader}>
              <label className={styles.label} htmlFor="rebalance-budget" style={{ margin: 0 }}>
                Extra budget <span>mUSD</span>
              </label>
              {walletMusd !== null && (
                <span className={styles.walletBalanceBadge}>
                  Wallet: <b>${walletMusd.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b> mUSD
                </span>
              )}
            </div>
            <div className={styles.amountInput}>
              <span>$</span>
              <input
                id="rebalance-budget"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                disabled={
                  running || busy || shownExecution?.status === "paused" || maxRebalancesReached
                }
                aria-invalid={!validBudget}
                aria-describedby="rebalance-budget-hint"
              />
            </div>
            {walletConnected && (
              <div className={styles.budgetChips}>
                <button
                  type="button"
                  className={styles.budgetChip}
                  onClick={() => setBudget("0")}
                  disabled={running || busy || maxRebalancesReached}
                >
                  $0 (Rotate)
                </button>
                <button
                  type="button"
                  className={styles.budgetChip}
                  onClick={() => setBudget("100")}
                  disabled={running || busy || maxRebalancesReached}
                >
                  +$100
                </button>
                <button
                  type="button"
                  className={styles.budgetChip}
                  onClick={() => setBudget("500")}
                  disabled={running || busy || maxRebalancesReached}
                >
                  +$500
                </button>
                {walletMusd !== null && walletMusd > 0 && (
                  <button
                    type="button"
                    className={styles.budgetChip}
                    onClick={() => setBudget(String(Math.floor(walletMusd)))}
                    disabled={running || busy || maxRebalancesReached}
                  >
                    Max wallet (${Math.floor(walletMusd)})
                  </button>
                )}
              </div>
            )}
            <p
              id="rebalance-budget-hint"
              className={!validBudget ? styles.errorText : styles.hint}
            >
              {validBudget
                ? "Set 0 to rotate existing positions. Extra mUSD comes from your connected wallet."
                : "Enter 0 or a positive amount in mUSD."}
            </p>
            {!walletConnected ? (
              <button
                className={styles.primary}
                type="button"
                onClick={() => void connect()}
                disabled={connecting}
                aria-busy={connecting}
              >
                <Wallet size={16} aria-hidden="true" />
                {connecting ? "Connecting wallet…" : "Connect wallet to begin"}
              </button>
            ) : (
              <button
                className={styles.primary}
                type="submit"
                disabled={
                  busy ||
                  running ||
                  !validBudget ||
                  !instruction.trim() ||
                  shownExecution?.status === "paused" ||
                  maxRebalancesReached
                }
                aria-busy={busy}
              >
                <Sparkles
                  size={16}
                  className={busy ? styles.spin : undefined}
                  aria-hidden="true"
                />
                {maxRebalancesReached
                  ? "Max 3 rebalances used"
                  : busy
                    ? "Cokoo is planning…"
                    : shownPlan
                      ? "Generate a fresh blueprint"
                      : "Ask Cokoo for a blueprint"}
              </button>
            )}
          </form>
          <div className={styles.boundary}>
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              The agent prepares the plan. Your wallet approves all stock
              buildings in 1 transaction (same as the bundle feature).
            </p>
          </div>
          <div className={styles.snapshot}>
            <span>City snapshot</span>
            <div>
              <b>{onchainBuildings.length}</b>on-chain stock buildings
            </div>
            <div>
              <b>{rebalanceCount} of 3</b>rebalances used
            </div>
            {stockBuildings.length > onchainBuildings.length && (
              <small>
                {stockBuildings.length - onchainBuildings.length} local
                positions stay outside this plan.
              </small>
            )}
          </div>
          <div aria-live="polite">
            {error && (
              <div className={styles.errorBox} role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <div>
                  <b>
                    {busy
                      ? "Planning interrupted"
                      : "Couldn’t finish this step"}
                  </b>
                  <p>{error}</p>
                  {!running && (
                    <button
                      type="button"
                      onClick={() =>
                        walletConnected ? void requestPlan() : void connect()
                      }
                      disabled={busy || shownExecution?.status === "paused"}
                    >
                      <RefreshCw size={14} aria-hidden="true" /> Try again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className={styles.blueprint}>
          {busy ? (
            <div
              className={styles.planning}
              aria-live="polite"
              aria-busy="true"
            >
              <div className={styles.planningIcon}>
                <Sparkles size={24} aria-hidden="true" />
              </div>
              <span className={styles.eyebrow}>COKOO IS AT WORK</span>
              <h4>Drawing your next city.</h4>
              <p>
                Checking your on-chain holdings, available funds, and room on
                the island. The blueprint can take up to a minute.
              </p>
              <div className={styles.skeleton} aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : !shownPlan ? (
            <div className={styles.empty}>
              <div className={styles.emptyArt}>
                <img
                  src="/assets/sprites/functional/agent_hall.png"
                  alt=""
                  width={144}
                  height={144}
                />
                <span>
                  <MapPinned size={22} aria-hidden="true" />
                </span>
              </div>
              <span className={styles.eyebrow}>YOUR NEXT CITY STARTS HERE</span>
              <h4>See the whole plan before a single move.</h4>
              <p>
                Cokoo will show what to remove, what to build, and how your
                allocation changes. Every building gets its own BNB Chain
                receipt.
              </p>
              <div className={styles.emptyFacts}>
                <span>
                  <ArrowDownRight size={15} aria-hidden="true" /> Remove &
                  release funds
                </span>
                <span>
                  <Plus size={15} aria-hidden="true" /> Build the new balance
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.blueprintHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    {shownExecution?.status === "completed"
                      ? "RESTRUCTURING COMPLETE"
                      : running
                        ? "LIVE RESTRUCTURING"
                        : shownExecution?.status === "paused"
                          ? "RESTRUCTURING PAUSED"
                          : "BLUEPRINT READY TO REVIEW"}
                  </span>
                  <h4>
                    {shownExecution?.status === "completed"
                      ? "Your city has a new balance."
                      : running
                        ? activeStep
                          ? `${stepLabel(activeStep)} is in progress.`
                          : "Cokoo is working through your city."
                        : shownExecution?.status === "paused"
                          ? completed
                            ? "Your confirmed changes are safe."
                            : "Your city is unchanged."
                          : "Here’s the shape of your next city."}
                  </h4>
                </div>
                <span className={styles.planTag}>
                  {shownExecution
                    ? `${completed}/${shownPlan.steps.length} confirmed`
                    : "Agent proposal"}
                </span>
              </div>
              <p className={styles.summary}>{shownPlan.summary}</p>

              <div className={styles.planMetrics}>
                <div>
                  <Trash2 size={16} aria-hidden="true" />
                  <b>{sells}</b>
                  <span>removals</span>
                </div>
                <div>
                  <Hammer size={16} aria-hidden="true" />
                  <b>{buys}</b>
                  <span>builds</span>
                </div>
                <div>
                  <Wallet size={16} aria-hidden="true" />
                  <b>{money(shownPlan.budget)}</b>
                  <span>extra mUSD</span>
                </div>
              </div>

              <div className={styles.previewHeader}>
                <h5>City blueprint</h5>
                <div aria-label="City blueprint view">
                  <button
                    type="button"
                    aria-pressed={preview === "current"}
                    onClick={() => setPreview("current")}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    aria-pressed={preview === "planned"}
                    onClick={() => setPreview("planned")}
                  >
                    Planned
                  </button>
                </div>
              </div>
              <div
                className={styles.cityPreview}
                aria-label={`${preview === "planned" ? "Planned" : "Current"} stock buildings`}
              >
                <div className={styles.isoGrid} aria-hidden="true" />
                {previewBuildings.map((building) => (
                  <button
                    key={building.id}
                    type="button"
                    className={`${styles.previewBuilding} ${building.planned ? styles.plannedBuilding : ""}`}
                    style={{
                      left: `${building.left}%`,
                      top: `${building.top}%`,
                      zIndex: building.zIndex,
                    }}
                    aria-label={`${building.ticker} at tile ${building.cell.r}, ${building.cell.c}${building.planned ? ", planned building" : ""}`}
                    aria-pressed={
                      !!building.stepId && selected === building.stepId
                    }
                    onClick={() => {
                      if (building.stepId) {
                        setSelected(building.stepId);
                        rows.current[building.stepId]?.scrollIntoView({
                          block: "nearest",
                        });
                      }
                    }}
                  >
                    <img
                      src={sprite(building.image)}
                      width={62}
                      height={62}
                      alt=""
                    />
                    <span>
                      {building.ticker}
                      {building.planned && (
                        <Plus size={10} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ))}
                {!previewBuildings.length && (
                  <p>No stock buildings in this view.</p>
                )}
                <span className={styles.previewCaption}>
                  {preview === "planned"
                    ? "Proposed layout · changes appear after confirmation"
                    : "Stock buildings before this blueprint"}
                </span>
              </div>

              <div className={styles.allocationHeader}>
                <h5>Allocation shift</h5>
                <span>
                  Current <ArrowRight size={12} aria-hidden="true" /> Planned
                </span>
              </div>
              <div className={styles.allocations}>
                {allocations.map(({ ticker, before, after }) => (
                  <div className={styles.allocation} key={ticker}>
                    <div>
                      <b>{ticker}</b>
                      <small>{after?.sector ?? before?.sector}</small>
                    </div>
                    <div className={styles.allocationBars} aria-hidden="true">
                      <i
                        style={{
                          transform: `scaleX(${(before?.weight ?? 0) / 100})`,
                        }}
                      />
                      <i
                        style={{
                          transform: `scaleX(${(after?.weight ?? 0) / 100})`,
                        }}
                      />
                    </div>
                    <span>
                      {percent(before?.weight ?? 0)}{" "}
                      <ArrowRight size={12} aria-hidden="true" />{" "}
                      <b>{percent(after?.weight ?? 0)}</b>
                    </span>
                  </div>
                ))}
              </div>
              {shownPlan.quoteNote && (
                <p className={styles.hint}>{shownPlan.quoteNote}</p>
              )}

              <div className={styles.ledgerHeader}>
                <h5>Every building. Every step.</h5>
                <span>
                  {shownPlan.steps.length} changes · 1 batch approval
                </span>
              </div>
              {shownExecution?.batchId && (
                <p className={styles.hint} style={{ overflowWrap: "anywhere" }}>
                  Saved batch ID: <code>{shownExecution.batchId}</code>
                  {shownExecution.batchStatus !== "confirmed" &&
                    shownExecution.batchStatus !== "failed" &&
                    " · Check confirmation to recover this request. No new signature is needed."}
                </p>
              )}
              <ol
                className={styles.steps}
                aria-label="Building changes in the rebalance batch"
              >
                {shownPlan.steps.map((step, index) => {
                  const progress = shownExecution?.steps.find(
                    (s) => s.stepId === step.id,
                  );
                  const image =
                    step.action === "buy"
                      ? defFor(step.kind).image
                      : catalogue.find((d) => d.ticker === step.ticker)?.image;
                  return (
                    <li
                      key={step.id}
                      ref={(node) => {
                        rows.current[step.id] = node;
                      }}
                      className={`${styles.step} ${selected === step.id ? styles.selectedStep : ""}`}
                      data-status={progress?.status ?? "queued"}
                    >
                      <div className={styles.stepNumber}>
                        {progress?.status === "confirmed" ? (
                          <Check size={13} aria-hidden="true" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className={styles.stepSprite}>
                        {image && (
                          <img
                            src={sprite(image)}
                            alt=""
                            width={42}
                            height={42}
                          />
                        )}
                        <span
                          className={
                            step.action === "sell"
                              ? styles.removeMark
                              : styles.addMark
                          }
                        >
                          {step.action === "sell" ? (
                            <Trash2 size={10} aria-hidden="true" />
                          ) : (
                            <Plus size={11} aria-hidden="true" />
                          )}
                        </span>
                      </div>
                      <div className={styles.stepDetails}>
                        <div>
                          <b>{stepLabel(step)}</b>
                          <span>
                            {step.action === "sell" ? "Release" : "Allocate"}{" "}
                            {money(step.amount)} mUSD
                          </span>
                        </div>
                        <p>{step.reason}</p>
                        <small>
                          Tile {step.cell.r}, {step.cell.c} ·{" "}
                          {step.quantity.toFixed(4)} units
                        </small>
                        {progress?.error && (
                          <p className={styles.errorText}>{progress.error}</p>
                        )}
                        {progress?.hash && (
                          <a
                            href={bscTxLink(progress.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            BNB receipt · {shortHash(progress.hash)}
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                        {progress?.approvalHash && (
                          <a
                            href={bscTxLink(progress.approvalHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            mUSD approval · {shortHash(progress.approvalHash)}
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      <div className={styles.stepStatus}>
                        <StatusIcon progress={progress} />
                        <span>
                          {shownExecution
                            ? progressLabel(progress)
                            : step.action === "sell"
                              ? "Remove"
                              : "Build"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className={styles.executeBox} aria-live="polite">
                {shownExecution?.status === "completed" ? (
                  <>
                    <div className={styles.executeHeading}>
                      <CheckCheck size={20} aria-hidden="true" />
                      <div>
                        <b>{completed} building changes confirmed.</b>
                        <p>
                          {rebalanceCount >= 3
                            ? "3 of 3 rebalances completed for this city. Every building is recorded in City Hall."
                            : `Rebalance ${rebalanceCount} of 3 complete (${rebalancesRemaining} remaining). Explore your city or plan your next rebalance.`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", width: "100%" }}>
                      <button
                        type="button"
                        className={styles.primary}
                        style={{ flex: 1, minWidth: "180px" }}
                        onClick={onWatchCity}
                      >
                        <MapPinned size={17} aria-hidden="true" /> Explore your
                        rebalanced city
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                      {!maxRebalancesReached && (
                        <button
                          type="button"
                          className={styles.secondary}
                          style={{ flex: 1, minWidth: "180px" }}
                          onClick={() => {
                            onClearExecution();
                            setPlan(null);
                            setError("");
                          }}
                        >
                          <Sparkles size={16} aria-hidden="true" />
                          Plan next rebalance ({rebalancesRemaining} remaining)
                        </button>
                      )}
                    </div>
                  </>
                ) : running ? (
                  <>
                    <div className={styles.executeHeading}>
                      <StatusIcon progress={active} />
                      <div>
                        <b>
                          {active
                            ? progressLabel(active)
                            : shownExecution?.mode === "sequential"
                              ? "Executing rebalance steps"
                              : "Preparing the rebalance"}
                        </b>
                        <p>
                          {shownExecution?.mode === "sequential"
                            ? "Confirm each step in your wallet. The city updates as each building confirms on-chain."
                            : active?.status === "wallet"
                              ? "Approve the batch in your wallet, including any mUSD approval. The city updates after confirmation."
                              : "The rebalance settles on BNB Chain. Follow the confirmed building changes from your island."}
                        </p>
                      </div>
                    </div>
                    <div className={styles.progressTrack}>
                      <i
                        style={{
                          transform: `scaleX(${shownPlan.steps.length ? completed / shownPlan.steps.length : 0})`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={onWatchCity}
                    >
                      <MapPinned size={17} aria-hidden="true" /> Watch the city
                      change
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </>
                ) : shownExecution?.status === "paused" ? (
                  <>
                    <div className={styles.executeHeading}>
                      <AlertCircle size={20} aria-hidden="true" />
                      <div>
                        <b>Paused after {completed} confirmed changes.</b>
                        <p>
                          {shownExecution.error ||
                            "The rebalance could not finish."}{" "}
                          {hasPendingRebalance(shownExecution)
                            ? "Checking confirmation recovers the saved request without asking you to sign again."
                            : shownExecution.mode === "sequential"
                              ? "Resume to continue signing remaining building changes, or keep confirmed changes and replan."
                              : "Keep any confirmed changes and request a fresh blueprint, or retry the wallet check."}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={
                        starting ||
                        walletChanged ||
                        shownExecution.batchStatus === "failed"
                      }
                      onClick={() => void execute()}
                      aria-busy={starting}
                    >
                      <RefreshCw size={16} aria-hidden="true" />
                      {starting
                        ? "Checking…"
                        : hasPendingRebalance(shownExecution)
                          ? "Check confirmation"
                          : shownExecution.mode === "sequential"
                            ? "Resume rebalance"
                            : "Retry wallet check"}
                    </button>
                    {walletChanged && (
                      <p className={styles.errorText}>
                        Connect the wallet that approved this blueprint to
                        resume.
                      </p>
                    )}
                    {!hasPendingRebalance(shownExecution) && (
                      <button
                        type="button"
                        className={styles.replan}
                        disabled={starting}
                        onClick={() => {
                          onClearExecution();
                          setPlan(null);
                          setError("");
                        }}
                      >
                        Keep confirmed changes & start a new plan
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.executeHeading}>
                      <ShieldCheck size={21} aria-hidden="true" />
                      <div>
                        <b>Review first. 1 signature for all stocks.</b>
                        <p>
                          {shownPlan.steps.length} building changes on BNB
                          testnet. 1 signature in your wallet for all stocks
                          (same as the Bundle feature). Network fees paid in tBNB.
                        </p>
                      </div>
                    </div>
                    {blocked && (
                      <p className={styles.errorText}>
                        {walletChanged
                          ? "Your wallet changed. Generate a blueprint for this wallet."
                          : cityChanged
                            ? "Your city changed since this blueprint. Ask Cokoo for a fresh plan."
                            : inputsChanged
                              ? "Your direction or budget changed. Generate a blueprint for these inputs."
                              : "This blueprint expired. Generate a fresh one with current holdings."}
                      </p>
                    )}
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={blocked || starting || !shownPlan.steps.length}
                      onClick={() => void execute()}
                      aria-busy={starting}
                    >
                      <Wallet size={17} aria-hidden="true" />
                      {starting
                        ? "Opening your wallet…"
                        : "Sign once & rebalance city"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                    <small className={styles.executeNote}>
                      1 batch signature for all stocks on BNB testnet. Every
                      building is permanently recorded in City Hall.
                    </small>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function AgentExecutionDock({
  execution,
  onOpen,
  onClose,
}: {
  execution: RebalanceExecution;
  onOpen: () => void;
  onClose: () => void;
}) {
  const confirmed = execution.steps.filter(
    (step) => step.status === "confirmed",
  ).length;
  const progress = execution.steps.find(
    (step) =>
      step.status === "wallet" ||
      step.status === "submitted" ||
      step.status === "error",
  );
  const step = execution.plan.steps.find(
    (item) => item.id === progress?.stepId,
  );
  return (
    <aside
      className={styles.dock}
      data-status={execution.status}
      aria-label="Agent rebalance progress"
      aria-live="polite"
    >
      <div className={styles.dockHeader}>
        <img src="/assets/ai_logo.png" alt="" width={36} height={36} />
        <div>
          <b>
            {execution.status === "completed"
              ? "City rebalanced"
              : execution.status === "paused"
                ? "Cokoo’s plan is paused"
                : "Cokoo is restructuring"}
          </b>
          <small>
            {confirmed}/{execution.plan.steps.length} building changes confirmed
          </small>
        </div>
        {execution.status === "completed" ? (
          <CheckCheck size={18} aria-hidden="true" />
        ) : (
          <StatusIcon progress={progress} />
        )}
        <button
          type="button"
          className={styles.dockClose}
          onClick={onClose}
          aria-label="Dismiss notification"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
      <p>
        {execution.status === "completed"
          ? "Rebalance complete. Every building recorded in City Hall."
          : execution.status === "paused"
            ? "Open Agent Hall to resume or review saved progress."
            : execution.mode === "atomic"
              ? execution.batchStatus === "confirmed"
                ? "Batch confirmed · touring your updated city"
                : progress
                  ? progressLabel(progress)
                  : "Preparing wallet approval"
              : `${step ? `${stepLabel(step)} · ` : ""}${progress ? progressLabel(progress) : "Checking saved receipts"}`}
      </p>
      <div className={styles.progressTrack}>
        <i
          style={{
            transform: `scaleX(${execution.plan.steps.length ? confirmed / execution.plan.steps.length : 0})`,
          }}
        />
      </div>
      <button type="button" onClick={onOpen}>
        Open Agent Hall
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </aside>
  );
}
