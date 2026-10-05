import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRebalanceReceipt,
  applyRebalanceBatch,
  hasPendingRebalance,
  recoverRebalanceExecution,
} from "../lib/rebalance-execution.ts";

const hash = `0x${"a".repeat(64)}`;
const positionId = `0x${"b".repeat(64)}`;
const walletAddress = `0x${"c".repeat(40)}`;
const building = {
  id: "old",
  kind: "nvidia",
  r: 1,
  c: 1,
  quantity: 5,
  cost: 500,
  entry: 100,
  builtAt: 0,
  vaultId: positionId,
};
const city = { version: 2, cash: 100, roads: [], buildings: [building] };
const plan = { id: "plan", walletAddress };
const sell = {
  id: "sell",
  action: "sell",
  ticker: "NVDA",
  buildingId: "old",
  positionId,
  costBasis: 500,
};
const receipt = {
  hash,
  positionId,
  ticker: "NVDA",
  quantity: 5,
  amount: 450,
  entryPrice: 0,
  fullyClosed: true,
};

test("a confirmed removal records actual capped proceeds and remains in city history", () => {
  const next = applyRebalanceReceipt(city, plan, sell, receipt);
  assert.equal(next.cash, 550);
  assert.equal(next.realizedPnl, -50);
  assert.equal(next.buildings.length, 0);
  assert.equal(next.agentReceipts[0].hash, hash);
  assert.equal(next.agentReceipts[0].action, "sell");
  assert.equal(city.buildings.length, 1, "original city is immutable");
});

test("recovery never applies the same mined transaction twice", () => {
  const next = applyRebalanceReceipt(city, plan, sell, receipt);
  assert.equal(applyRebalanceReceipt(next, plan, sell, receipt), next);
});

test("a confirmed purchase uses chain quantity, cost and position receipt", () => {
  const step = {
    id: "buy",
    action: "buy",
    ticker: "JPM",
    kind: "jpmorgan",
    buildingId: "new",
    cell: { r: 4, c: 2 },
  };
  const buy = {
    ...receipt,
    ticker: "JPM",
    amount: 200,
    quantity: 0.8,
    entryPrice: 250,
    fullyClosed: false,
  };
  const next = applyRebalanceReceipt(
    { ...city, cash: 550, buildings: [] },
    plan,
    step,
    buy,
  );
  assert.equal(next.cash, 350);
  assert.equal(next.buildings[0].quantity, 0.8);
  assert.equal(next.buildings[0].vaultTx, hash);
  assert.equal(next.buildings[0].vaultId, positionId);
  assert.equal(next.buildings[0].locked, false);
});

test("a mismatched receipt cannot mutate the city", () => {
  assert.throws(
    () =>
      applyRebalanceReceipt(city, plan, sell, { ...receipt, ticker: "TSLA" }),
    /ticker/,
  );
  assert.throws(
    () =>
      applyRebalanceReceipt(city, plan, sell, {
        ...receipt,
        positionId: `0x${"d".repeat(64)}`,
      }),
    /position/,
  );
  assert.equal(city.cash, 100);
});

test("floating settlement cannot invalidate the saved city with a negative zero balance", () => {
  const step = {
    id: "buy",
    action: "buy",
    ticker: "JPM",
    kind: "jpmorgan",
    buildingId: "new",
    cell: { r: 4, c: 2 },
  };
  const next = applyRebalanceReceipt(
    { ...city, cash: 7.9399999999999995, buildings: [] },
    plan,
    step,
    {
      ...receipt,
      ticker: "JPM",
      amount: 7.94,
      quantity: 0.1,
      entryPrice: 79.4,
    },
  );
  assert.equal(next.cash, 0);
});

test("a transaction hash cannot be reused for a different step", () => {
  const next = applyRebalanceReceipt(city, plan, sell, receipt);
  assert.throws(
    () => applyRebalanceReceipt(next, plan, { ...sell, id: "other" }, receipt),
    /different/,
  );
});

const supportedKinds = ["nvidia", "jpmorgan"];
const savedExecution = () => ({
  plan: {
    id: "saved-plan",
    source: "agent",
    walletAddress,
    createdAt: 1000,
    expiresAt: 301000,
    fingerprint: "reviewed-city",
    summary: "Rebalance the city into financial services.",
    quoteNote: "Unexecuted testnet proposal using supplied city quotes.",
    budget: 0,
    targets: [
      { ticker: "JPM", weight: 100, reason: "Diversify sector exposure." },
    ],
    before: {
      cash: 100,
      stockValue: 500,
      holdings: [
        {
          ticker: "NVDA",
          name: "NVIDIA",
          sector: "Technology",
          value: 500,
          weight: 100,
        },
      ],
    },
    after: {
      cash: 100,
      stockValue: 500,
      holdings: [
        {
          ticker: "JPM",
          name: "JPMorgan",
          sector: "Finance",
          value: 500,
          weight: 100,
        },
      ],
    },
    steps: [
      {
        id: "saved-sell",
        action: "sell",
        ticker: "NVDA",
        buildingId: "old",
        positionId,
        positionQuantity: "5000000000000000000",
        costBasis: 500,
        fractionBps: 10000,
        removesBuilding: true,
        amount: 500,
        price: 100,
        quantity: 5,
        cell: { r: 1, c: 1 },
        reason: "Retire NVIDIA before the replacement purchase.",
      },
      {
        id: "saved-buy",
        action: "buy",
        ticker: "JPM",
        buildingId: "new",
        kind: "jpmorgan",
        amount: 500,
        price: 250,
        quantity: 2,
        cell: { r: 4, c: 2 },
        reason: "Build the target financial services holding.",
      },
    ],
  },
  status: "paused",
  fingerprint: "city-after-confirmed-sale",
  error: "Execution paused after reload.",
  steps: [
    { stepId: "saved-sell", status: "confirmed", hash },
    {
      stepId: "saved-buy",
      status: "submitted",
      hash: `0x${"d".repeat(64)}`,
      approvalHash: `0x${"e".repeat(64)}`,
    },
  ],
});

test("a valid paused execution restores exact signed hashes and the approved plan without mutation", () => {
  const saved = savedExecution();
  const untouched = structuredClone(saved);
  const recovered = recoverRebalanceExecution(saved, supportedKinds);
  assert.equal(recovered, saved);
  assert.equal(recovered.status, "paused");
  assert.equal(recovered.steps[0].hash, hash);
  assert.equal(recovered.steps[1].status, "submitted");
  assert.equal(recovered.steps[1].hash, `0x${"d".repeat(64)}`);
  assert.equal(recovered.steps[1].approvalHash, `0x${"e".repeat(64)}`);
  assert.equal(recovered.plan.steps[0].positionQuantity, "5000000000000000000");
  assert.deepEqual(saved, untouched);
});

test("corrupt saved state and incomplete plan shapes are discarded without throwing", () => {
  for (const bad of [
    null,
    undefined,
    "not an execution",
    [],
    {},
    { plan: null },
    { plan: { id: "partial" } },
  ]) {
    assert.doesNotThrow(() => recoverRebalanceExecution(bad, supportedKinds));
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
  for (const mutate of [
    (run) => {
      run.plan.steps = null;
    },
    (run) => {
      run.steps = null;
    },
    (run) => {
      run.plan.before = null;
    },
    (run) => {
      run.plan.after.holdings = [null];
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("saved plans with corrupt identity, timing or allocation amounts cannot be resumed", () => {
  for (const mutate of [
    (run) => {
      run.plan.walletAddress = "another-wallet";
    },
    (run) => {
      run.plan.source = "mock";
    },
    (run) => {
      run.plan.fingerprint = null;
    },
    (run) => {
      run.plan.budget = -1;
    },
    (run) => {
      run.plan.before.stockValue = Infinity;
    },
    (run) => {
      run.plan.after.holdings[0].weight = NaN;
    },
    (run) => {
      run.plan.expiresAt = run.plan.createdAt - 1;
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("saved step data requires a real sell position and a supported purchase building", () => {
  for (const mutate of [
    (run) => {
      delete run.plan.steps[0].positionId;
    },
    (run) => {
      run.plan.steps[0].positionQuantity = "0";
    },
    (run) => {
      run.plan.steps[0].positionQuantity = "5e18";
    },
    (run) => {
      run.plan.steps[0].fractionBps = 20000;
    },
    (run) => {
      run.plan.steps[1].kind = "unknown-building";
    },
    (run) => {
      run.plan.steps[1].price = 0;
    },
    (run) => {
      run.plan.steps[1].cell.r = 0.5;
    },
    (run) => {
      run.plan.steps[1].action = "airdrop";
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("invalid execution and progress statuses are never treated as completion", () => {
  for (const mutate of [
    (run) => {
      run.status = "successful";
    },
    (run) => {
      run.steps[0].status = "mined";
    },
    (run) => {
      run.steps[1].status = null;
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("submitted and confirmed steps require valid transaction hashes while approval hashes are validated separately", () => {
  for (const mutate of [
    (run) => {
      run.steps[1].hash = "0x123";
    },
    (run) => {
      run.steps[1].hash = `0x${"g".repeat(64)}`;
    },
    (run) => {
      delete run.steps[1].hash;
    },
    (run) => {
      delete run.steps[0].hash;
    },
    (run) => {
      run.steps[1].approvalHash = "not-an-approval";
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("duplicate or missing progress rows cannot skip a building change on reload", () => {
  for (const mutate of [
    (run) => {
      run.steps[1] = { ...run.steps[0] };
    },
    (run) => {
      run.steps.pop();
    },
    (run) => {
      run.steps.push({ ...run.steps[0] });
    },
    (run) => {
      run.steps[1].stepId = "unreviewed-step";
    },
    (run) => {
      run.plan.steps[1].id = run.plan.steps[0].id;
    },
  ]) {
    const bad = savedExecution();
    mutate(bad);
    assert.equal(recoverRebalanceExecution(bad, supportedKinds), null);
  }
});

test("a completed saved execution must have every building change confirmed", () => {
  const complete = savedExecution();
  complete.status = "completed";
  complete.steps[1].status = "confirmed";
  assert.equal(recoverRebalanceExecution(complete, supportedKinds), complete);
  for (const status of ["queued", "wallet", "submitted", "error"]) {
    const incomplete = structuredClone(complete);
    incomplete.steps[1].status = status;
    assert.equal(recoverRebalanceExecution(incomplete, supportedKinds), null);
  }
});

test("non-finite, negative or zero-quantity receipt amounts cannot change city funds or buildings", () => {
  for (const corrupt of [
    { amount: NaN },
    { amount: Infinity },
    { amount: -1 },
    { quantity: 0 },
    { quantity: -1 },
    { quantity: Infinity },
    { entryPrice: NaN },
    { entryPrice: -1 },
  ]) {
    const untouched = structuredClone(city);
    assert.throws(
      () => applyRebalanceReceipt(city, plan, sell, { ...receipt, ...corrupt }),
      /invalid position amounts/,
    );
    assert.deepEqual(city, untouched);
  }
});

test("a valid sale receipt cannot remove a missing or reassigned building", () => {
  for (const changed of [
    { ...city, buildings: [] },
    { ...city, buildings: [{ ...building, vaultId: `0x${"d".repeat(64)}` }] },
  ]) {
    const untouched = structuredClone(changed);
    assert.throws(
      () => applyRebalanceReceipt(changed, plan, sell, receipt),
      /sold building changed/,
    );
    assert.deepEqual(changed, untouched);
  }
});

test("purchase receipts cannot overwrite a building or debit more than the city's confirmed cash", () => {
  const step = {
    id: "buy",
    action: "buy",
    ticker: "JPM",
    kind: "jpmorgan",
    buildingId: "old",
    cell: { r: 4, c: 2 },
  };
  const buy = {
    ...receipt,
    ticker: "JPM",
    amount: 200,
    quantity: 0.8,
    entryPrice: 250,
    fullyClosed: false,
  };
  const untouched = structuredClone(city);
  assert.throws(
    () => applyRebalanceReceipt(city, plan, step, buy),
    /already exists/,
  );
  assert.throws(
    () =>
      applyRebalanceReceipt(city, plan, { ...step, buildingId: "new" }, buy),
    /below zero/,
  );
  assert.deepEqual(city, untouched);
});

test("a fully closed position with zero actual testnet payout records its receipt without fabricated sale proceeds", () => {
  const next = applyRebalanceReceipt(city, plan, sell, {
    ...receipt,
    amount: 0,
  });
  assert.equal(next.cash, city.cash);
  assert.equal(next.realizedPnl, -500);
  assert.equal(next.buildings.length, 0);
  assert.equal(next.agentReceipts[0].hash, hash);
});

test("atomic settlement records every building with the same hash and applies once", () => {
  const buyStep = {
    id: "buy",
    action: "buy",
    ticker: "JPM",
    kind: "jpmorgan",
    buildingId: "new",
    cell: { r: 4, c: 2 },
  };
  const batchPlan = { ...plan, steps: [sell, buyStep] };
  const bought = {
    ...receipt,
    positionId: `0x${"d".repeat(64)}`,
    ticker: "JPM",
    amount: 400,
    quantity: 2,
    entryPrice: 200,
    fullyClosed: false,
  };
  const next = applyRebalanceBatch(city, batchPlan, [receipt, bought]);
  assert.equal(next.cash, 150);
  assert.equal(next.buildings.length, 1);
  assert.equal(next.buildings[0].id, "new");
  assert.equal(next.buildings[0].vaultTx, hash);
  assert.equal(next.agentReceipts.length, 2);
  assert.ok(next.agentReceipts.every((r) => r.hash === hash && r.batch));
  assert.deepEqual(
    next.agentReceipts.map((r) => r.action),
    ["sell", "buy"],
  );
  assert.equal(applyRebalanceBatch(next, batchPlan, [receipt, bought]), next);
  assert.equal(city.buildings[0].id, "old");
});

test("an incomplete or invalid batch cannot partially apply a sale", () => {
  const buyStep = {
    id: "buy",
    action: "buy",
    ticker: "JPM",
    kind: "jpmorgan",
    buildingId: "new",
    cell: { r: 4, c: 2 },
  };
  const batchPlan = { ...plan, steps: [sell, buyStep] };
  const bought = {
    ...receipt,
    ticker: "JPM",
    amount: 99999,
    quantity: 2,
    entryPrice: 200,
    fullyClosed: false,
  };
  assert.throws(
    () => applyRebalanceBatch(city, batchPlan, [receipt]),
    /all building receipts/,
  );
  assert.throws(
    () => applyRebalanceBatch(city, batchPlan, [receipt, bought]),
    /cash/,
  );
  assert.throws(
    () =>
      applyRebalanceBatch(city, batchPlan, [
        receipt,
        { ...bought, hash: `0x${"f".repeat(64)}` },
      ]),
    /one transaction/,
  );
  assert.equal(city.cash, 100);
  assert.equal(city.buildings.length, 1);
  assert.equal(city.agentReceipts, undefined);
});

test("a saved atomic batch with no transaction hash stays locked and can be recovered", () => {
  const saved = savedExecution();
  saved.mode = "atomic";
  saved.batchId = `0x${"f".repeat(64)}`;
  saved.batchStatus = "pending";
  saved.steps = saved.steps.map((s) => ({
    stepId: s.stepId,
    status: "submitted",
  }));
  assert.equal(recoverRebalanceExecution(saved, supportedKinds), saved);
  assert.equal(hasPendingRebalance(saved), true);
  saved.batchStatus = "wallet";
  saved.steps = saved.steps.map((s) => ({ ...s, status: "error" }));
  assert.equal(
    hasPendingRebalance(saved),
    true,
    "a lost wallet response is not safe to resubmit",
  );
  saved.batchStatus = "failed";
  assert.equal(
    hasPendingRebalance(saved),
    false,
    "a definite atomic revert can be cleared",
  );
  saved.batchId = undefined;
  assert.equal(recoverRebalanceExecution(saved, supportedKinds), null);
});
