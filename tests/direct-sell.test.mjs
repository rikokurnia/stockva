import test from "node:test";
import assert from "node:assert/strict";
import { applyDirectSellReceipt } from "../lib/rebalance-execution.ts";
import {
  bulldoze,
  newCity,
  sellPosition,
  sellPaper,
  buyPaper,
  constructBuilding,
} from "../lib/city.ts";

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

test("wrong position or ticker is rejected", () => {  assert.throws(
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

test("on-chain sale records a clickable history row", () => {
  const next = applyDirectSellReceipt(city(), building.id, receipt(), OWNER);
  assert.equal(next.saleHistory.length, 1);
  const row = next.saleHistory[0];
  assert.equal(row.ticker, "NVDA");
  assert.equal(row.quantity, 5);
  assert.equal(row.proceeds, 600);
  assert.equal(row.realized, 100);
  assert.equal(row.hash, HASH);
  assert.equal(row.source, "onchain");
});

const fundedCity = () => {
  let state = { ...newCity(), cash: 10000 };
  state = constructBuilding("exchange", { r: -6, c: 0 }, 400, state).state;
  return constructBuilding("nvidia", { r: 1, c: 1 }, 500, state, {
    NVDA: 100,
  }).state;
};

test("local building sales record history with balances intact", () => {
  const bought = fundedCity();
  const sold = sellPosition(bought, "NVDA", 0.5, { NVDA: 120 });
  assert.equal(sold.error, "");
  assert.equal(sold.state.buildings.length, 2);
  assert.equal(sold.state.saleHistory.length, 1);
  const row = sold.state.saleHistory[0];
  assert.equal(row.ticker, "NVDA");
  assert.equal(row.source, "local");
  assert.equal(row.hash, undefined);
  assert.ok(row.proceeds > 0);
  const again = sellPosition(sold.state, "NVDA", 1, { NVDA: 120 });
  assert.equal(again.state.buildings.length, 1);
  assert.equal(again.state.saleHistory.length, 2);
});

test("bulldoze of a stock building records its liquidation", () => {
  const bought = fundedCity();
  const removed = bulldoze({ r: 1, c: 1 }, bought, { NVDA: 110 });
  assert.equal(removed.state.buildings.length, 1);
  assert.equal(removed.state.saleHistory.length, 1);
  assert.equal(removed.state.saleHistory[0].ticker, "NVDA");
});

test("paper sales record history too", () => {
  let state = { ...newCity(), cash: 10000 };
  state = buyPaper(state, "AAPL", 1000, 200).state;
  const sold = sellPaper(state, "AAPL", 1, { AAPL: 220 });
  assert.equal(sold.error, "");
  assert.equal(sold.state.saleHistory.length, 1);
  assert.equal(sold.state.saleHistory[0].ticker, "AAPL");
  assert.equal(sold.state.saleHistory[0].source, "local");
});

test("buys never move realized P/L or sale history — only sells do", () => {
  let state = { ...newCity(), cash: 10000 };
  state = constructBuilding("exchange", { r: -6, c: 0 }, 400, state).state;
  state = constructBuilding("nvidia", { r: 1, c: 1 }, 500, state, {
    NVDA: 100,
  }).state;
  state = buyPaper(state, "AAPL", 1000, 200).state;
  assert.equal(state.realizedPnl, 0);
  assert.deepEqual(state.saleHistory ?? [], []);
  const sold = sellPosition(state, "NVDA", 1, { NVDA: 110 });
  assert.equal(sold.error, "");
  assert.equal(sold.state.realizedPnl, 50);
  assert.equal(sold.state.saleHistory.length, 1);
});
