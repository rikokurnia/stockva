import type { RebalancePlan } from "./rebalance";
import type { CityState } from "./city";
import type { SaleRecord } from "./city.ts";
import { defFor } from "./city.ts";
import type { RebalanceReceipt, BatchBuildingInput, BatchRecordResult } from "./contracts";

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
  mode?: "atomic" | "sequential";
  batchId?: string;
  batchStatus?: "wallet" | "pending" | "confirmed" | "failed";
};

export const REBALANCE_STORAGE = "stockva.agent-rebalance.v1";
export const DIRECT_SALE_STORAGE = "stockva.pending-sale.v1";
export const DIRECT_PURCHASE_STORAGE = "stockva.pending-purchase.v1";
export type PendingDirectPurchase = {
  owner: `0x${string}`;
  hash: `0x${string}`;
  items: BatchBuildingInput[];
};
export function recoverDirectPurchase(value: unknown): PendingDirectPurchase | null {
  if (!value || typeof value !== "object") return null;
  const purchase = value as PendingDirectPurchase;
  if (!/^0x[a-fA-F0-9]{40}$/.test(purchase.owner) ||
      !/^0x[a-fA-F0-9]{64}$/.test(purchase.hash) ||
      !Array.isArray(purchase.items) || !purchase.items.length || purchase.items.length > 150) return null;
  const ids = new Set<string>();
  for (const item of purchase.items) {
    if (!item || typeof item.buildingId !== "string" || !item.buildingId || item.buildingId.length > 100 ||
        ids.has(item.buildingId) || typeof item.ticker !== "string" || !/^[A-Z0-9]{1,24}$/.test(item.ticker) ||
        !Number.isFinite(item.usdAmount) || item.usdAmount <= 0 ||
        !Number.isFinite(item.entryPrice) || item.entryPrice <= 0 ||
        (item.initialTier !== undefined && item.initialTier !== 1)) return null;
    ids.add(item.buildingId);
  }
  return purchase;
}
export function applyDirectPurchaseReceipt(
  city: CityState, purchase: PendingDirectPurchase, result: BatchRecordResult,
): CityState {
  if (result.positionIds.length !== purchase.items.length ||
      new Set(result.positionIds).size !== result.positionIds.length ||
      result.positionIds.some((id) => !/^0x[a-fA-F0-9]{64}$/.test(id)))
    throw new Error("The purchase receipt is missing valid position IDs.");
  for (const [index, item] of purchase.items.entries()) {
    const building = city.buildings.find((b) => b.id === item.buildingId);
    if (!building || defFor(building.kind).ticker !== item.ticker ||
        building.cost !== item.usdAmount || building.entry !== item.entryPrice ||
        (building.vaultId && building.vaultId.toLowerCase() !== result.positionIds[index].toLowerCase()))
      throw new Error("The submitted purchase no longer matches its city draft. Keep the hash for reconciliation.");
  }
  return { ...city, buildings: city.buildings.map((building) => {
    const index = purchase.items.findIndex((item) => item.buildingId === building.id);
    return index < 0 ? building : { ...building, locked: false, vaultTx: result.hash, vaultId: result.positionIds[index] };
  }) };
}
export type PendingDirectSale = { buildingId: string; owner: `0x${string}`; hash: `0x${string}` };
export function recoverDirectSale(value: unknown): PendingDirectSale | null {
  if (!value || typeof value !== "object") return null;
  const sale = value as PendingDirectSale;
  return typeof sale.buildingId === "string" && sale.buildingId.length > 0 &&
    sale.buildingId.length <= 100 && /^0x[a-fA-F0-9]{40}$/.test(sale.owner) &&
    /^0x[a-fA-F0-9]{64}$/.test(sale.hash) ? sale : null;
}

export function hasPendingRebalance(
  run: RebalanceExecution | null | undefined,
): boolean {
  return (
    !!run &&
    ((!!run.batchId &&
      run.batchStatus !== "failed" &&
      run.batchStatus !== "confirmed") ||
      run.steps.some(
        (s) => !!s.hash && !s.reverted && s.status !== "confirmed",
      ))
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
  if (run.mode !== undefined && run.mode !== "atomic" && run.mode !== "sequential") return null;
  if (
    run.mode === "sequential" &&
    (run.batchId !== undefined || run.batchStatus !== undefined)
  )
    return null;
  if (
    (run.mode === "atomic" || run.batchId !== undefined || run.batchStatus !== undefined) &&
    ((run.batchId !== undefined &&
      (typeof run.batchId !== "string" ||
        !run.batchId.length ||
        run.batchId.length > 512)) ||
      (run.batchStatus !== undefined &&
        !["wallet", "pending", "confirmed", "failed"].includes(
          run.batchStatus,
        )) ||
      (!!run.batchStatus && !run.batchId) ||
      (run.status === "completed" && run.mode === "atomic" && run.batchStatus !== "confirmed"))
  )
    return null;
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
          (step.cityPositionId !== undefined && (typeof step.cityPositionId !== "string" || !validHash(step.cityPositionId))) ||
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
      ((progress[0].status === "confirmed" ||
        (progress[0].status === "submitted" && !run.batchId)) &&
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
    (row) =>
      row.hash.toLowerCase() === receipt.hash.toLowerCase() &&
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
  let saleRow: SaleRecord | null = null;
  if (step.action === "sell") {
    if (step.fractionBps === 10000 && !receipt.fullyClosed)
      throw new Error("The approved full sale did not close its position.");
    if (receipt.positionId.toLowerCase() !== step.positionId.toLowerCase())
      throw new Error("The confirmed position does not match this building.");
    const building = buildings.find((b) => b.id === step.buildingId);
    if (
      !building ||
      building.vaultId?.toLowerCase() !== (step.cityPositionId ?? step.positionId).toLowerCase()
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
    saleRow = {
      id: globalThis.crypto.randomUUID(),
      ticker: step.ticker,
      quantity: receipt.quantity,
      proceeds: receipt.amount,
      realized: receipt.amount - step.costBasis,
      at: Date.now(),
      hash: receipt.hash,
      source: "onchain",
    };
  } else {
    if ((step.amount !== undefined && receipt.amount !== Number(step.amount.toFixed(6))) ||
        (step.price !== undefined && receipt.entryPrice !== Number(step.price.toFixed(6))))
      throw new Error("The confirmed purchase amounts do not match the approved plan.");
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
    saleHistory: [...(city.saleHistory ?? []), ...(saleRow ? [saleRow] : [])],
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
        ...(sharedBatch ? { batch: true } : {}),
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
  if (
    !receipts.length ||
    receipts.length !== plan.steps.length ||
    new Set(receipts.map((r) => r.hash.toLowerCase())).size !== 1
  )
    throw new Error(
      "An atomic rebalance requires all building receipts from one transaction.",
    );
  const applied = city.agentReceipts?.filter((r) => r.planId === plan.id) ?? [];
  if (
    applied.length &&
    (applied.length !== plan.steps.length ||
      !plan.steps.every((s) =>
        applied.some(
          (r) =>
            r.stepId === s.id &&
            r.hash.toLowerCase() === receipts[0].hash.toLowerCase(),
        ),
      ))
  )
    throw new Error(
      "The saved batch is incomplete. Reconcile the city before continuing.",
    );
  return plan.steps.reduce(
    (next, step, index) =>
      applyRebalanceReceipt(next, plan, step, receipts[index], true),
    city,
  );
}

/**
 * Apply a wallet-signed inspector sale (no agent plan). The vault receipt is
 * chain truth: payout and closed fraction come from the mined PositionSold
 * event. Saved as a direct agent receipt so City Hall history links the tx.
 */
export function applyDirectSellReceipt(
  city: CityState,
  buildingId: string,
  receipt: RebalanceReceipt,
  owner: `0x${string}`,
): CityState {
  const building = city.buildings.find((b) => b.id === buildingId);
  if (
    city.agentReceipts?.some(
      (row) => row.hash.toLowerCase() === receipt.hash.toLowerCase(),
    )
  )
    return city;
  if (!building) throw new Error("The sold building is gone. Keep the receipt and reload your saved city.");
  const ticker = defFor(building.kind).ticker;
  if (!ticker || ticker !== receipt.ticker)
    throw new Error("The confirmed ticker does not match this building.");
  if (
    !building.vaultId ||
    building.vaultId.toLowerCase() !== receipt.positionId.toLowerCase()
  )
    throw new Error("The confirmed position does not match this building.");
  if (
    ![receipt.amount, receipt.quantity].every(Number.isFinite) ||
    receipt.amount < 0 ||
    receipt.quantity <= 0
  )
    throw new Error("The receipt has invalid position amounts.");
  const soldQty = Math.min(receipt.quantity, building.quantity);
  const basis = soldQty * building.entry;
  const fullyClosed = receipt.fullyClosed || soldQty >= building.quantity;
  const buildings = fullyClosed
    ? city.buildings.filter((b) => b.id !== buildingId)
    : city.buildings.map((b) =>
        b.id === buildingId
          ? {
              ...b,
              quantity: Math.max(0, b.quantity - soldQty),
              cost: b.cost * Math.max(0, 1 - soldQty / b.quantity),
            }
          : b,
      );
  return {
    ...city,
    buildings,
    cash: Math.round((city.cash + receipt.amount) * 1_000_000) / 1_000_000,
    realizedPnl: (city.realizedPnl ?? 0) + (receipt.amount - basis),
    saleHistory: [
      ...(city.saleHistory ?? []),
      {
        id: globalThis.crypto.randomUUID(),
        ticker,
        quantity: soldQty,
        proceeds: receipt.amount,
        realized: receipt.amount - basis,
        at: Date.now(),
        hash: receipt.hash,
        source: "onchain",
      },
    ],
    agentReceipts: [
      ...(city.agentReceipts ?? []),
      {
        hash: receipt.hash,
        owner,
        ticker,
        action: "sell",
        at: Date.now(),
        planId: "direct",
        stepId: buildingId,
        positionId: receipt.positionId,
      },
    ],
  };
}
