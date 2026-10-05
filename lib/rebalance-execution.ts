import type { RebalancePlan } from "./rebalance";
import type { CityState } from "./city";
import type { RebalanceReceipt } from "./contracts";

export type RebalanceStepProgress = {
  stepId: string;
  status: "queued" | "wallet" | "submitted" | "confirmed" | "error";
  hash?: `0x${string}`;
  approvalHash?: `0x${string}`;
  error?: string;
  reverted?: boolean;
};

export type RebalanceExecution = {
  plan: RebalancePlan;
  status: "running" | "paused" | "completed";
  steps: RebalanceStepProgress[];
  error?: string;
  fingerprint?: string;
  mode?: "atomic";
  batchId?: string;
  batchStatus?: "wallet" | "pending" | "confirmed" | "failed";
};

export const REBALANCE_STORAGE = "stockva.agent-rebalance.v1";

export function hasPendingRebalance(run: RebalanceExecution | null | undefined): boolean {
  return !!run && (
    (!!run.batchId && run.batchStatus !== "failed" && run.batchStatus !== "confirmed") ||
    run.steps.some((s) => !!s.hash && !s.reverted && s.status !== "confirmed")
  );
}

/** Treat saved browser state as untrusted, including old or interrupted versions. */
export function recoverRebalanceExecution(
  value: unknown,
  supportedKinds: string[],
): RebalanceExecution | null {
  if (!value || typeof value !== "object") return null;
  const run = value as RebalanceExecution;
  const plan = run.plan;
  const validHash = (hash: unknown) =>
    hash === undefined ||
    (typeof hash === "string" && /^0x[a-fA-F0-9]{64}$/.test(hash));
  const finite = (n: unknown): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  if (run.mode !== undefined && run.mode !== "atomic") return null;
  if (run.mode === "atomic" && (
    (run.batchId !== undefined && (typeof run.batchId !== "string" || !run.batchId.length || run.batchId.length > 512)) ||
    (run.batchStatus !== undefined && !["wallet", "pending", "confirmed", "failed"].includes(run.batchStatus)) ||
    (!!run.batchStatus && !run.batchId) ||
    (run.status === "completed" && run.batchStatus !== "confirmed")
  )) return null;
  if (
    !plan ||
    typeof plan.id !== "string" ||
    plan.source !== "agent" ||
    !/^0x[a-fA-F0-9]{40}$/.test(plan.walletAddress ?? "") ||
    typeof plan.fingerprint !== "string" ||
    typeof plan.summary !== "string" ||
    !finite(plan.createdAt) ||
    !finite(plan.expiresAt) ||
    plan.expiresAt <= plan.createdAt ||
    !finite(plan.budget) ||
    !Array.isArray(plan.steps) ||
    !plan.steps.length ||
    plan.steps.length > 16 ||
    !Array.isArray(run.steps) ||
    run.steps.length !== plan.steps.length ||
    !["running", "paused", "completed"].includes(run.status)
  )
    return null;
  if (
    run.status === "completed" &&
    run.steps.some((progress) => progress.status !== "confirmed")
  )
    return null;
  for (const landscape of [plan.before, plan.after]) {
    if (
      !landscape ||
      !finite(landscape.cash) ||
      !finite(landscape.stockValue) ||
      !Array.isArray(landscape.holdings) ||
      !landscape.holdings.every(
        (h) =>
          h &&
          typeof h.ticker === "string" &&
          typeof h.sector === "string" &&
          finite(h.value) &&
          finite(h.weight),
      )
    )
      return null;
  }
  const ids = new Set<string>();
  for (const step of plan.steps) {
    if (
      !step ||
      typeof step.id !== "string" ||
      ids.has(step.id) ||
      typeof step.buildingId !== "string" ||
      typeof step.reason !== "string" ||
      typeof step.ticker !== "string" ||
      !finite(step.amount) ||
      !finite(step.price) ||
      step.price <= 0 ||
      !finite(step.quantity) ||
      !step.cell ||
      !Number.isInteger(step.cell.r) ||
      !Number.isInteger(step.cell.c)
    )
      return null;
    ids.add(step.id);
    if (
      step.action === "buy"
        ? !supportedKinds.includes(step.kind)
        : step.action !== "sell" ||
          typeof step.positionId !== "string" ||
          !validHash(step.positionId) ||
          typeof step.positionQuantity !== "string" ||
          !/^\d+$/.test(step.positionQuantity) ||
          step.positionQuantity.length > 80 ||
          BigInt(step.positionQuantity) === BigInt(0) ||
          !finite(step.costBasis) ||
          step.fractionBps !== 10000
    )
      return null;
    const progress = run.steps.filter((p) => p?.stepId === step.id);
    if (
      progress.length !== 1 ||
      !["queued", "wallet", "submitted", "confirmed", "error"].includes(
        progress[0].status,
      ) ||
      !validHash(progress[0].hash) ||
      !validHash(progress[0].approvalHash) ||
      ((progress[0].status === "confirmed" || (progress[0].status === "submitted" && !run.batchId)) &&
        !progress[0].hash)
    )
      return null;
  }
  return run;
}

/** A mined receipt is applied once; balances use actual transfer amounts. */
export function applyRebalanceReceipt(
  city: CityState,
  plan: RebalancePlan,
  step: RebalancePlan["steps"][number],
  receipt: RebalanceReceipt,
  sharedBatch = false,
): CityState {
  const previous = city.agentReceipts?.find(
    (row) => row.hash.toLowerCase() === receipt.hash.toLowerCase() &&
      (!sharedBatch || row.planId !== plan.id || row.stepId === step.id),
  );
  if (previous) {
    if (previous.planId !== plan.id || previous.stepId !== step.id)
      throw new Error(
        "This receipt already belongs to a different city change.",
      );
    return city;
  }
  if (
    ![receipt.amount, receipt.quantity, receipt.entryPrice].every(
      Number.isFinite,
    ) ||
    receipt.amount < 0 ||
    receipt.quantity <= 0 ||
    receipt.entryPrice < 0
  )
    throw new Error("The receipt has invalid position amounts.");
  if (receipt.ticker !== step.ticker)
    throw new Error("The confirmed ticker does not match the approved plan.");
  let buildings = city.buildings;
  let cash = city.cash;
  let realizedPnl = city.realizedPnl ?? 0;
  if (step.action === "sell") {
    if (receipt.positionId.toLowerCase() !== step.positionId.toLowerCase())
      throw new Error("The confirmed position does not match this building.");
    const building = buildings.find((b) => b.id === step.buildingId);
    if (
      !building ||
      building.vaultId?.toLowerCase() !== receipt.positionId.toLowerCase()
    )
      throw new Error(
        "The sold building changed. Keep the receipt and reload your saved city.",
      );
    buildings = receipt.fullyClosed
      ? buildings.filter((b) => b.id !== step.buildingId)
      : buildings.map((b) =>
          b.id === step.buildingId
            ? {
                ...b,
                quantity: Math.max(0, b.quantity - receipt.quantity),
                cost: b.cost * Math.max(0, 1 - receipt.quantity / b.quantity),
              }
            : b,
        );
    cash += receipt.amount;
    realizedPnl += receipt.amount - step.costBasis;
  } else {
    if (buildings.some((b) => b.id === step.buildingId))
      throw new Error(
        "This new building already exists. Check the receipt before continuing.",
      );
    buildings = [
      ...buildings,
      {
        ...step.cell,
        id: step.buildingId,
        kind: step.kind,
        quantity: receipt.quantity,
        entry: receipt.entryPrice,
        cost: receipt.amount,
        builtAt: Date.now(),
        vaultId: receipt.positionId,
        vaultTx: receipt.hash,
        locked: false,
      },
    ];
    cash -= receipt.amount;
  }
  cash = Math.round(cash * 1_000_000) / 1_000_000;
  if (cash < 0)
    throw new Error(
      "Confirmed city cash is below zero. Check the receipt and reconcile funds before continuing.",
    );
  cash = Math.max(0, cash);
  return {
    ...city,
    buildings,
    cash,
    realizedPnl,
    agentReceipts: [
      ...(city.agentReceipts ?? []),
      {
        hash: receipt.hash,
        owner: plan.walletAddress,
        ticker: step.ticker,
        action: step.action,
        at: Date.now(),
        planId: plan.id,
        stepId: step.id,
        positionId: receipt.positionId,
      },
    ],
  };
}

/** Commit the complete validated batch in memory before persisting any city change. */
export function applyRebalanceBatch(
  city: CityState,
  plan: RebalancePlan,
  receipts: RebalanceReceipt[],
): CityState {
  if (!receipts.length || receipts.length !== plan.steps.length ||
      new Set(receipts.map((r) => r.hash.toLowerCase())).size !== 1)
    throw new Error("An atomic rebalance requires all building receipts from one transaction.");
  const applied = city.agentReceipts?.filter((r) => r.planId === plan.id) ?? [];
  if (applied.length && (applied.length !== plan.steps.length ||
      !plan.steps.every((s) => applied.some((r) => r.stepId === s.id && r.hash.toLowerCase() === receipts[0].hash.toLowerCase()))))
    throw new Error("The saved batch is incomplete. Reconcile the city before continuing.");
  return plan.steps.reduce((next, step, index) => applyRebalanceReceipt(next, plan, step, receipts[index], true), city);
}
