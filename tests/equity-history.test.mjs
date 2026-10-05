import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyDeltas,
  loadEquityHistory,
  recordEquityPoint,
} from "../lib/equity-history.ts";

test("empty store yields no history (no window in node)", () => {
  assert.deepEqual(loadEquityHistory(), []);
  const recorded = recordEquityPoint(1000);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].equity, 1000);
});

test("dailyDeltas collapses snapshots to day-over-day rows", () => {
  const base = Date.UTC(2026, 9, 1);
  const deltas = dailyDeltas([
    { t: base, equity: 800000 },
    { t: base + 3600000, equity: 810000 },
    { t: base + 86400000, equity: 790000 },
  ]);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].equity, 790000);
  assert.equal(deltas[0].pnl, -20000);
  assert.ok(deltas[0].pct < 0);
});

test("a single day never fabricates a delta", () => {
  const base = Date.UTC(2026, 9, 1);
  assert.deepEqual(
    dailyDeltas([
      { t: base, equity: 800000 },
      { t: base + 3600000, equity: 810000 },
    ]),
    [],
  );
});
