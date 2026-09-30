import test from "node:test";
import assert from "node:assert/strict";
import {
  asHistory,
  asSnapshot,
  buildSystemPrompt,
  buildUserPrompt,
} from "../lib/advisor.ts";

test("advisor snapshot keeps only real holdings, capped at 20", () => {
  const snap = asSnapshot({
    cash: 8500,
    totalValue: 1500,
    walletConnected: true,
    onchainCount: 1,
    holdings: [
      { ticker: "NVDA", units: 3.5, entry: 142.87, returnPct: 5.1 },
      { ticker: 123 },
      null,
    ],
  });
  assert.equal(snap.cash, 8500);
  assert.equal(snap.walletConnected, true);
  assert.equal(snap.holdings?.length, 1);
  assert.equal(snap.holdings?.[0].ticker, "NVDA");
});

test("advisor prompt carries live numbers and never names providers", () => {
  const snap = asSnapshot({
    cash: 8500,
    totalValue: 1500,
    walletConnected: true,
    onchainCount: 1,
    holdings: [
      {
        ticker: "TSLA",
        units: 5,
        entry: 180,
        price: 175,
        value: 875,
        returnPct: -2.8,
        onchain: true,
        active: true,
      },
    ],
  });
  const prompt = buildUserPrompt(buildSystemPrompt(snap), [], "allocation?");
  assert.match(prompt, /8500/);
  assert.match(prompt, /TSLA/);
  assert.match(prompt, /-2\.8%/);
  assert.doesNotMatch(prompt, /gemini|deepseek|musespark/i);
});

test("advisor history keeps last 6 valid messages only", () => {
  const raw = [
    ...Array.from({ length: 8 }, (_, i) => ({ role: "user", text: `q${i}` })),
    { role: "bot", text: "nope" },
    "junk",
  ];
  const history = asHistory(raw);
  assert.equal(history.length, 6);
  assert.equal(history[0].text, "q2");
});
