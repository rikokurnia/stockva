import test from "node:test";
import assert from "node:assert/strict";
import { applyDirectSellReceipt } from "../lib/rebalance-execution.ts";

const OWNER = `0x${"a".repeat(40)}`;
const POSITION = `0x${"c".repeat(64)}`;
const HASH = `0x${"3".repeat(64)}`;
const building = {
  r: 1,
  c: 1,
  id: "b-nvda-1",
  kind: "nvidia",
  quantity: 5,
  entry: 100,
  cost: 500,
  builtAt: Date.now(),
  vaultId: POSITION,
};
const city = () => ({
  version: 2,
  cash: 1000,
  realizedPnl: 0,
  buildings: [{ ...building }],
  roads: [],
});
const receipt = (overrides = {}) => ({
  hash: HASH,
  positionId: POSITION,
  ticker: "NVDA",
  quantity: 5,
  amount: 600,
  entryPrice: 120,
  fullyClosed: true,
  ...overrides,
});

test("full on-chain sale removes the building and banks payout + P/L", () => {
  const next = applyDirectSellReceipt(city(), building.id, receipt(), OWNER);
  assert.equal(next.buildings.length, 0);
  assert.equal(next.cash, 1600);
  assert.equal(next.realizedPnl, 100);
  const saved = next.agentReceipts.at(-1);
  assert.equal(saved.hash, HASH);
  assert.equal(saved.action, "sell");
  assert.equal(saved.ticker, "NVDA");
  assert.equal(saved.positionId, POSITION);
});

test("partial sale keeps a reduced building", () => {
  const next = applyDirectSellReceipt(
    city(),
    building.id,
    receipt({ quantity: 2, amount: 240, fullyClosed: false }),
    OWNER,
  );
  assert.equal(next.buildings.length, 1);
  assert.equal(next.buildings[0].quantity, 3);
  assert.equal(next.cash, 1240);
  assert.equal(next.realizedPnl, 40);
});

test("replaying the same hash is idempotent", () => {
  const once = applyDirectSellReceipt(city(), building.id, receipt(), OWNER);
  const twice = applyDirectSellReceipt(once, building.id, receipt(), OWNER);
  assert.equal(twice, once);
});

test("wrong position or ticker is rejected", () => {
  assert.throws(
    () =>
      applyDirectSellReceipt(
        city(),
        building.id,
        receipt({ positionId: `0x${"d".repeat(64)}` }),
        OWNER,
      ),
    /position/,
  );
  assert.throws(
    () => applyDirectSellReceipt(city(), building.id, receipt({ ticker: "TSLA" }), OWNER),
    /ticker/,
  );
  assert.throws(
    () => applyDirectSellReceipt(city(), "missing-id", receipt(), OWNER),
    /gone/,
  );
});
