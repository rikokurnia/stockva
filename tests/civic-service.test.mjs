import test from "node:test";
import assert from "node:assert/strict";
import {
  observedSeries,
  movingAverage,
  buildNaturalSeries,
  relativeStrength,
  secFinancials,
} from "../lib/asset-research.ts";
import { transactionHistory, validateBundle } from "../lib/civic.ts";
test("independent histories never manufacture a token price from the benchmark", () => {
  const data = [
    { time: 3000, benchmark: 110 },
    { time: 1000, token: 100 },
    { time: 2000, benchmark: 105 },
    { time: 1001, token: 101 },
    { time: NaN, token: 99 },
    { time: 4000, token: Infinity },
  ];
  assert.deepEqual(observedSeries(data, "token"), [{ time: 1000, value: 101 }]);
  assert.deepEqual(observedSeries(data, "benchmark"), [
    { time: 2000, value: 105 },
    { time: 3000, value: 110 },
  ]);
});
test("technical indicators require enough observations and handle flat/up/down series", () => {
  const points = Array.from({ length: 60 }, (_, i) => ({
    time: i * 3600000,
    value: i + 1,
  }));
  assert.equal(movingAverage(points, 20)[0].value, 10.5);
  assert.equal(movingAverage(points, 50).at(-1).value, 35.5);
  assert.equal(movingAverage(points.slice(0, 10), 20).length, 0);
  assert.equal(relativeStrength(points), 100);
  assert.equal(
    relativeStrength(points.map((p) => ({ ...p, value: 100 - p.value }))),
    0,
  );
  assert.equal(relativeStrength(points.map((p) => ({ ...p, value: 100 }))), 50);
  assert.equal(relativeStrength(points.slice(0, 14)), null);
});
const annual = (val, extra = {}) => ({
  val,
  start: "2024-01-01",
  end: "2024-12-31",
  filed: "2025-02-01",
  form: "10-K",
  accn: "0000000001-25-000001",
  ...extra,
});
test("SEC normalization separates annual durations from quarterly facts and retains provenance", () => {
  const facts = secFinancials({
    cik: 1,
    facts: {
      "us-gaap": {
        Revenues: {
          units: {
            USD: [
              annual(100),
              annual(200, {
                start: "2025-01-01",
                end: "2025-03-31",
                filed: "2025-04-01",
                form: "10-Q",
              }),
            ],
          },
        },
        NetIncomeLoss: { units: { USD: [annual(-10)] } },
        Assets: {
          units: {
            USD: [
              {
                val: 150,
                end: "2025-03-31",
                filed: "2025-04-01",
                form: "10-Q",
              },
            ],
          },
        },
        EarningsPerShareDiluted: { units: { "USD/shares": [annual(2)] } },
      },
    },
  });
  assert.equal(facts.find((m) => m.label === "Revenue · annual").value, 100);
  assert.equal(facts.find((m) => m.label === "Net margin · annual").value, -10);
  assert.equal(
    facts.find((m) => m.label === "Total assets").period,
    "2025-03-31",
  );
  assert.equal(
    facts.find((m) => m.label === "Diluted EPS · annual").unit,
    "USD/share",
  );
  assert.match(
    facts[0].url,
    /sec.gov\/Archives\/edgar\/data\/1\/000000000125000001/,
  );
});
test("no margin is inferred from mismatched reporting periods or missing financials", () => {
  assert.deepEqual(secFinancials({}), []);
  const facts = secFinancials({
    facts: {
      "us-gaap": {
        Revenues: { units: { USD: [annual(100)] } },
        NetIncomeLoss: {
          units: {
            USD: [annual(10, { start: "2023-01-01", end: "2023-12-31" })],
          },
        },
      },
    },
  });
  assert.equal(
    facts.some((m) => m.label === "Net margin · annual"),
    false,
  );
});
test("batch receipts deduplicate case-insensitively without counting each building as a transaction", () => {
  const hash = `0x${"a".repeat(64)}`;
  const rows = transactionHistory([
    { hash, kind: "placement", tickers: ["NVDA"], source: "city" },
    { hash, kind: "placement", tickers: ["AAPL"], source: "city" },
    {
      hash: `0x${"A".repeat(64)}`,
      kind: "placement",
      tickers: ["NVDA"],
      source: "wallet",
      at: 100,
    },
    { hash: "0x", kind: "faucet", tickers: [], source: "wallet" },
  ]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].tickers, ["NVDA", "AAPL"]);
  assert.equal(rows[0].source, "wallet");
  assert.equal(rows[0].at, 100);
});
test("bundle validation rejects partial/invalid selections instead of silently buying fewer assets", () => {
  const available = ["AAPL", "NVDA"];
  assert.equal(
    validateBundle(
      ["AAPL", "NVDA"],
      { AAPL: "100", NVDA: "oops" },
      available,
      1000,
    ).valid,
    false,
  );
  assert.equal(
    validateBundle(
      ["AAPL", "NVDA"],
      { AAPL: "100", NVDA: "500" },
      available,
      599,
    ).valid,
    false,
  );
  assert.equal(
    validateBundle(["AAPL"], { AAPL: "100" }, [], 1000).valid,
    false,
  );
  assert.equal(validateBundle([], {}, available, 1000).valid, false);
  assert.equal(
    validateBundle(["AAPL"], { AAPL: "1.001" }, available, 1000).valid,
    false,
  );
  const valid = validateBundle(
    ["AAPL", "AAPL", "NVDA"],
    { AAPL: "100.50", NVDA: "500" },
    available,
    1000,
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.total, 600.5);
});

test("sector baskets can bundle all stocks in a sector and map to valid building kinds in catalogue", async () => {
  const { catalogue, SECTOR_DEFINITIONS } = await import("../lib/city.ts");
  for (const sec of SECTOR_DEFINITIONS) {
    assert.ok(sec.stocks.length > 0);
    const available = [...sec.stocks];
    const amounts = Object.fromEntries(sec.stocks.map((t) => [t, "500"]));
    const res = validateBundle(sec.stocks, amounts, available, sec.stocks.length * 500);
    assert.equal(res.valid, true);
    assert.equal(res.total, sec.stocks.length * 500);

    // Verify all tickers in sector bundle map to valid catalogue building kinds
    const items = res.tickers.map((ticker) => {
      const def = catalogue.find((d) => d.ticker === ticker);
      assert.ok(def, `Missing catalogue definition for sector stock ${ticker}`);
      assert.equal(def.category, "sectors");
      assert.equal(def.sectorKey, sec.key);
      return { kind: def.kind, amount: Number(amounts[ticker]) };
    });
    assert.equal(items.length, sec.stocks.length);
  }
});

test("stock exchange supports buying single-stock bundles as well as mixed multi-sector baskets", async () => {
  const { catalogue } = await import("../lib/city.ts");

  // 1. Single stock bundle
  const singleAvailable = ["JNJ"];
  const singleRes = validateBundle(["JNJ"], { JNJ: "500" }, singleAvailable, 1000);
  assert.equal(singleRes.valid, true);
  assert.equal(singleRes.tickers.length, 1);
  const singleDef = catalogue.find((d) => d.ticker === "JNJ");
  assert.ok(singleDef);
  assert.equal(singleDef.kind, "jnj");

  // 2. Mixed multi-sector basket (hero stocks + sector stocks)
  const mixedTickers = ["NVDA", "JNJ", "TXN", "BAC", "CAT"];
  const mixedAmounts = { NVDA: "1000", JNJ: "500", TXN: "500", BAC: "250", CAT: "750" };
  const mixedRes = validateBundle(mixedTickers, mixedAmounts, mixedTickers, 5000);
  assert.equal(mixedRes.valid, true);
  assert.equal(mixedRes.total, 3000);
  const mixedItems = mixedRes.tickers.map((t) => ({
    kind: catalogue.find((d) => d.ticker === t).kind,
    amount: Number(mixedAmounts[t]),
  }));
  assert.equal(mixedItems.length, 5);
  assert.deepEqual(mixedItems.map((i) => i.kind), ["nvidia", "jnj", "txn", "bac", "cat"]);
});

test("buildNaturalSeries creates rich continuous history for 1h, 1d, 1w and past scrollback", () => {
  const targetPrice = 251.31;
  const series = buildNaturalSeries([], targetPrice);
  assert.ok(series.length > 2000, `Expected >2000 points, got ${series.length}`);
  
  // Strictly monotonic time
  for (let i = 1; i < series.length; i++) {
    assert.ok(series[i].time > series[i - 1].time, `Timestamp must strictly increase at ${i}`);
    assert.ok(series[i].value > 0, `Value must be positive at ${i}`);
  }

  // Final point matches target price
  assert.equal(series[series.length - 1].value, targetPrice);

  // Time window coverage
  const now = series[series.length - 1].time;
  const p1h = series.filter((p) => p.time >= now - 3600 * 1000);
  const p1d = series.filter((p) => p.time >= now - 86400 * 1000);
  const p1w = series.filter((p) => p.time >= now - 7 * 86400 * 1000);

  assert.ok(p1h.length >= 30, `Expected at least 30 points in 1h, got ${p1h.length}`);
  assert.ok(p1d.length >= 100, `Expected at least 100 points in 1d, got ${p1d.length}`);
  assert.ok(p1w.length >= 500, `Expected at least 500 points in 1w, got ${p1w.length}`);

  // Moving average MA 10 and MA 20 compute cleanly
  const ma10 = movingAverage(series, 10);
  const ma20 = movingAverage(series, 20);
  assert.equal(ma10.length, series.length - 9);
  assert.equal(ma20.length, series.length - 19);
});

