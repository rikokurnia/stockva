import test from "node:test";
import assert from "node:assert/strict";
import {
  asHistory,
  asHallAnalysis,
  asSnapshot,
  buildSystemPrompt,
  buildUserPrompt,
  isCompleteReply,
  plainText,
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

test("hall reviews include all 37 assets while chat keeps its 20-holding limit", () => {
  const holdings = Array.from({ length: 37 }, (_, i) => ({
    ticker: `S${i}`,
    units: 1,
    value: 100,
  }));
  assert.equal(asSnapshot({ holdings }).holdings.length, 20);
  assert.equal(asSnapshot({ holdings }, 40).holdings.length, 37);
  assert.equal(asSnapshot({ holdings }, 1000).holdings.length, 37);
});

test("advisor rejects malformed numeric fields instead of crashing the prompt", () => {
  const snap = asSnapshot({
    cash: Infinity,
    totalValue: NaN,
    holdings: [{ ticker: "NVDA", units: "oops", entry: NaN, value: 150 }],
  });
  const prompt = buildSystemPrompt(snap);
  assert.match(prompt, /value \$150\.00/);
  assert.doesNotMatch(prompt, /NaN|Infinity|oops/);
});

test("hall AI receives selected asset stress context without implying execution", () => {
  const hall = asHallAnalysis({
    mode: "stress",
    ticker: "NVDA",
    shockPct: -10,
    impact: -50,
    after: 450,
  });
  const prompt = buildSystemPrompt(asSnapshot({ totalValue: 500 }), hall);
  assert.match(prompt, /-10% on NVDA/);
  assert.match(prompt, /impact: \$-50\.00/);
  assert.match(prompt, /after scenario: \$450\.00/);
  assert.match(prompt, /NOT verified wallet balances/);
  assert.match(prompt, /not a price prediction/);
  assert.equal(asHallAnalysis({ mode: "trade" }), undefined);
});

test("hall AI retains sectors for concentration analysis", () => {
  const snap = asSnapshot(
    {
      holdings: [
        { ticker: "NVDA", sector: "Semiconductors", units: 3, value: 300 },
      ],
    },
    40,
  );
  assert.match(
    buildSystemPrompt(snap, { mode: "overview" }),
    /sector Semiconductors/,
  );
});

test("basket context carries equal weights and validates tickers and budget", () => {
  const hall = asHallAnalysis({
    mode: "basket",
    template: "AI district",
    tickers: ["NVDA", 123, "INVALID TOKEN", "MSFT"],
    budget: 500,
  });
  assert.deepEqual(hall.tickers, ["NVDA", "MSFT"]);
  const prompt = buildSystemPrompt({}, hall);
  assert.match(prompt, /Unexecuted equal-weight basket: AI district/);
  assert.match(prompt, /budget: \$500\.00/);
  assert.equal(
    asHallAnalysis({ mode: "basket", budget: NaN }).budget,
    undefined,
  );
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

test("plainText strips markdown the chat cannot render", () => {
  assert.equal(plainText("## Hello\n**bold** and *em* text"), "Hello\nbold and em text");
  assert.equal(plainText("`code` and [link](https://x.y)"), "code and link");
  assert.equal(plainText("- a\n* b\n+ c"), "- a\n- b\n- c");
  assert.equal(plainText("```js\nconst a = 1;\n```"), "const a = 1;");
  // Apostrophes in normal words must survive.
  assert.match(plainText("don't stop, it's yours"), /don't stop, it's yours/);
});

test("isCompleteReply catches mid-word cuts", () => {
  assert.equal(isCompleteReply("All good. Thanks!"), true);
  assert.equal(isCompleteReply("Nice work…"), true);
  assert.equal(isCompleteReply("while your te"), false);
  assert.equal(isCompleteReply("Almost done, the island is"), false);
  assert.equal(isCompleteReply(""), false);
});

test("system prompt demands short, finished, plain replies", () => {
  const prompt = buildSystemPrompt(asSnapshot({ cash: 1, holdings: [] }));
  assert.match(prompt, /Under 80 words/);
  assert.match(prompt, /never stop or trail off mid-word/);
  assert.match(prompt, /Plain text only/);
});
