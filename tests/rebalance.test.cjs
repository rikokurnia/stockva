const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const {
  buildRebalancePlan,
  buildRebalancePrompt,
  parseRebalanceProposal,
  parseRebalanceRequest,
  rebalanceFingerprint,
  isRebalancePlanCurrent,
} = require("../lib/rebalance.ts");
const { hasRoad, placementError } = require("../lib/city.ts");
const { NextResponse } = require("next/server");
const WEI = BigInt("1000000000000000000");
const walletAddress = `0x${"1".repeat(40)}`;
const positionId = (n) => `0x${String(n).padStart(64, "0")}`;
const building = (id, kind, r, c, quantity = 0, extra = {}) => ({
  id,
  kind,
  r,
  c,
  quantity,
  entry: quantity ? 100 : 0,
  cost: quantity * 100,
  builtAt: 1000,
  ...extra,
});
const fixture = () => ({
  walletAddress,
  walletCash: 500,
  budget: 0,
  vaultReserves: 10000,
  city: {
    version: 2,
    cash: 500,
    buildings: [
      building("exchange", "exchange", -4, -4),
      building("nvda", "nvidia", 0, 0, 8, {
        vaultId: positionId(1),
        vaultTx: positionId(101),
      }),
      building("tsla", "tesla", 0, 4, 2, {
        vaultId: positionId(2),
        vaultTx: positionId(102),
      }),
    ],
    roads: [
      { r: 0, c: -1 },
      { r: 0, c: 3 },
    ],
  },
  prices: { NVDA: 100, TSLA: 100, JPM: 100, SPY: 100, WMT: 100 },
  positions: [
    {
      id: positionId(1),
      owner: walletAddress,
      ticker: "NVDA",
      quantity: WEI * BigInt(8),
      entryPrice: WEI * BigInt(100),
      active: true,
    },
    {
      id: positionId(2),
      owner: walletAddress,
      ticker: "TSLA",
      quantity: WEI * BigInt(2),
      entryPrice: WEI * BigInt(100),
      active: true,
    },
  ],
});
const proposal = (
  targets = [
    ["NVDA", 50],
    ["JPM", 50],
  ],
) => ({
  summary:
    "Reduce concentrated technology exposure and add financial services.",
  targets: targets.map(([ticker, weight]) => ({
    ticker,
    weight,
    reason: `Allocate ${weight}% to ${ticker}.`,
  })),
});

test("a rotation closes confirmed positions first and reserves non-overlapping road-connected rebuilds", () => {
  const input = fixture();
  const plan = buildRebalancePlan(input, proposal(), 10000);
  assert.equal(plan.source, "agent");
  assert.equal(plan.walletAddress, walletAddress);
  assert.equal(plan.expiresAt, 310000);
  assert.deepEqual(
    plan.steps.map((s) => `${s.action}:${s.ticker}`),
    ["sell:NVDA", "sell:TSLA", "buy:NVDA", "buy:JPM"],
  );
  assert.deepEqual(
    plan.steps.slice(0, 2).map((s) => s.positionQuantity),
    [(WEI * BigInt(8)).toString(), (WEI * BigInt(2)).toString()],
  );
  assert.ok(
    plan.steps
      .filter((s) => s.action === "sell")
      .every((s) => s.fractionBps === 10000 && s.removesBuilding),
  );
  assert.equal(plan.before.stockValue, 1000);
  assert.equal(plan.before.cash, 500);
  assert.equal(plan.after.stockValue, 1000);
  assert.equal(plan.after.cash, 500);
  assert.deepEqual(
    plan.after.holdings.map((h) => h.weight),
    [50, 50],
  );
  const working = {
    ...input.city,
    buildings: input.city.buildings.filter((b) => b.kind === "exchange"),
  };
  for (const step of plan.steps.filter((s) => s.action === "buy")) {
    assert.equal(placementError(step.cell, working), "");
    assert.equal(hasRoad(step.cell, working.roads), true);
    working.buildings.push(
      building(step.buildingId, step.kind, step.cell.r, step.cell.c),
    );
  }
  assert.equal(
    input.city.buildings.length,
    3,
    "planning must leave the original city untouched",
  );
});

test("chain quantities determine sale size and basis, excluding local, paper, drafts and unmapped wallet positions", () => {
  const input = fixture();
  input.city.buildings[1].quantity = 800;
  input.city.buildings.push(
    building("draft", "walmart", 4, 0, 50, { locked: true }),
  );
  input.city.paper = [
    {
      id: "paper",
      ticker: "SPY",
      quantity: 1000,
      entry: 100,
      cost: 100000,
      boughtAt: 1000,
    },
  ];
  input.positions.push({
    ...input.positions[0],
    id: positionId(3),
    ticker: "SPY",
    quantity: WEI * BigInt(1000),
  });
  const plan = buildRebalancePlan(input, proposal());
  assert.equal(plan.before.stockValue, 1000);
  assert.equal(plan.steps[0].quantity, 8);
  assert.equal(plan.steps[0].amount, 800);
  assert.equal(plan.steps[0].costBasis, 800);
  assert.ok(
    plan.steps.every(
      (s) => s.ticker !== "WMT" && s.positionId !== positionId(3),
    ),
  );
});

test("additional cash is explicit, bounded by both city and wallet balance, and decimal dust is retained", () => {
  const input = fixture();
  input.budget = 123.123456;
  const plan = buildRebalancePlan(
    input,
    proposal([
      ["NVDA", 66.67],
      ["JPM", 33.33],
    ]),
  );
  const spending = plan.steps
    .filter((s) => s.action === "buy")
    .reduce((sum, s) => sum + s.amount, 0);
  assert.ok(spending <= plan.before.stockValue + input.budget + 1e-9);
  assert.ok(plan.after.cash >= plan.before.cash - input.budget - 1e-9);
  assert.ok(Math.abs(plan.after.stockValue + plan.after.cash - 1500) < 1e-8);
  input.budget = 501;
  assert.throws(() => buildRebalancePlan(input, proposal()), /exceeds/);
  input.budget = 10;
  input.walletCash = 5;
  assert.throws(() => buildRebalancePlan(input, proposal()), /exceeds/);
});

test("inactive, foreign-owned, mismatched and duplicated on-chain mappings cannot become sell actions", () => {
  for (const change of [
    (input) => {
      input.positions[0].active = false;
    },
    (input) => {
      input.positions[0].owner = `0x${"2".repeat(40)}`;
    },
    (input) => {
      input.positions[0].ticker = "JPM";
    },
    (input) => {
      input.positions = input.positions.slice(1);
    },
    (input) => {
      input.city.buildings.push({
        ...input.city.buildings[1],
        id: "duplicate",
      });
    },
  ]) {
    const input = fixture();
    change(input);
    assert.throws(
      () => buildRebalancePlan(input, proposal()),
      /active wallet|Duplicate/,
    );
  }
});

test("no-road construction and depleted vault reserves fail before execution", () => {
  const input = fixture();
  input.city.roads = [];
  assert.throws(
    () => buildRebalancePlan(input, proposal()),
    /road-connected lot/,
  );
  input.city.roads = fixture().city.roads;
  input.vaultReserves = 999;
  assert.throws(
    () => buildRebalancePlan(input, proposal()),
    /insufficient reserves/,
  );
});

test("a correctly weighted city requires no unnecessary wallet transactions", () => {
  const plan = buildRebalancePlan(
    fixture(),
    proposal([
      ["NVDA", 80],
      ["TSLA", 20],
    ]),
  );
  assert.deepEqual(plan.steps, []);
  assert.equal(plan.before.stockValue, plan.after.stockValue);
});

test("AI output cannot introduce unsupported assets, duplicate targets, negative allocations or invented weights", () => {
  for (const bad of [
    proposal([["EVIL", 100]]),
    proposal([
      ["NVDA", 50],
      ["NVDA", 50],
    ]),
    proposal([
      ["NVDA", -20],
      ["JPM", 120],
    ]),
    proposal([
      ["NVDA", 30],
      ["JPM", 30],
    ]),
    { summary: "no allocations", targets: [] },
    "hello instead of JSON",
  ])
    assert.throws(() => parseRebalanceProposal(bad));
  const parsed = parseRebalanceProposal(
    "```json\n" + JSON.stringify(proposal()) + "\n```",
  );
  assert.equal(parsed.targets.length, 2);
  const prompt = buildRebalancePrompt(fixture());
  assert.match(prompt, /client-supplied/);
  assert.match(prompt, /fully closed and rebuilt/);
  assert.match(prompt, /Default goal/);
  assert.doesNotMatch(prompt, /private.key|GEMINI_API_KEY/);
});

test("reviewed plans expire and invalidate after wallet, funds, holdings or road changes", () => {
  const input = fixture();
  const plan = buildRebalancePlan(input, proposal(), 1000);
  assert.equal(
    isRebalancePlanCurrent(plan, input.city, walletAddress, 1001),
    true,
  );
  assert.equal(
    isRebalancePlanCurrent(plan, input.city, walletAddress, plan.expiresAt),
    false,
  );
  assert.equal(
    isRebalancePlanCurrent(plan, input.city, `0x${"2".repeat(40)}`, 1001),
    false,
  );
  const reordered = structuredClone(input.city);
  reordered.buildings.reverse();
  reordered.roads.reverse();
  assert.equal(rebalanceFingerprint(reordered), plan.fingerprint);
  for (const mutate of [
    (c) => {
      c.cash -= 1;
    },
    (c) => {
      c.buildings[1].quantity += 1;
    },
    (c) => {
      c.buildings[1].r += 1;
    },
    (c) => {
      c.roads.pop();
    },
    (c) => {
      c.buildings[1].locked = true;
    },
  ]) {
    const changed = structuredClone(input.city);
    mutate(changed);
    assert.equal(
      isRebalancePlanCurrent(plan, changed, walletAddress, 1001),
      false,
    );
  }
});

test("request parsing rejects malformed maps and preserves the reviewed fingerprint", () => {
  const input = fixture();
  const body = {
    city: input.city,
    prices: input.prices,
    walletAddress,
    budget: 0,
  };
  assert.equal(
    rebalanceFingerprint(parseRebalanceRequest(body).city),
    rebalanceFingerprint(input.city),
  );
  for (const bad of [
    { ...body, walletAddress: "wallet" },
    { ...body, budget: -1 },
    { ...body, budget: 501 },
    { ...body, prices: { NVDA: Infinity } },
    { ...body, city: { ...body.city, roads: [{ r: 9000, c: 0 }] } },
    {
      ...body,
      city: {
        ...body.city,
        buildings: [{ ...body.city.buildings[1], vaultId: "fake" }],
      },
    },
  ])
    assert.throws(() => parseRebalanceRequest(bad));
});

function loadRoute({
  input = fixture(),
  answer = JSON.stringify(proposal()),
  chainFails = false,
  noCredentials = false,
} = {}) {
  const source = ts.transpileModule(
    fs.readFileSync(require.resolve("../app/api/rebalance/route.ts"), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {};
  let calls = 0;
  vm.runInNewContext(source, {
    exports,
    process: {
      env: noCredentials ? {} : { GEMINI_API_KEY: "server-only-test-key" },
    },
    AbortSignal,
    JSON,
    Error,
    Date,
    Number,
    Promise,
    fetch: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: answer }] } }],
        }),
      );
    },
    require: (id) => {
      if (id === "next/server") return { NextResponse };
      if (id === "viem")
        return {
          http: () => ({}),
          formatUnits: (value) => String(Number(value) / Number(WEI)),
          createPublicClient: () => ({
            readContract: async ({ functionName, args }) => {
              if (chainFails) throw Error("offline");
              if (functionName === "getUserPositions") return input.positions;
              return (
                WEI *
                BigInt(
                  args[0] === walletAddress
                    ? input.walletCash
                    : input.vaultReserves,
                )
              );
            },
          }),
        };
      if (id === "viem/chains") return { bscTestnet: { id: 97 } };
      if (id.endsWith("/lib/contracts"))
        return {
          BSC_TESTNET_RPC: "http://chain.invalid",
          MOCK_USD_ABI: [],
          VAULT_ABI: [],
          MOCK_USD_ADDRESS: "token",
          VAULT_ADDRESS: "vault",
        };
      if (id.endsWith("/lib/rebalance")) return require("../lib/rebalance.ts");
      throw Error(`Unexpected dependency ${id}`);
    },
  });
  return { post: exports.POST, providerCalls: () => calls };
}
const request = (input = fixture()) =>
  new Request("http://local/api/rebalance", {
    method: "POST",
    body: JSON.stringify({
      city: input.city,
      prices: input.prices,
      walletAddress,
      budget: input.budget,
    }),
  });

test("the read-only API binds valid real-provider proposals to confirmed wallet holdings", async () => {
  const route = loadRoute();
  const response = await route.post(request());
  assert.equal(response.status, 200);
  const { plan } = await response.json();
  assert.equal(plan.walletAddress, walletAddress);
  assert.equal(plan.source, "agent");
  assert.equal(plan.steps.length, 4);
  assert.equal(route.providerCalls(), 1);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("provider, credentials and chain failures never return fabricated successful plans", async () => {
  for (const options of [
    { answer: "not JSON" },
    { noCredentials: true },
    { chainFails: true },
  ]) {
    const route = loadRoute(options);
    const response = await route.post(request());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.ok(body.error);
    assert.equal(body.plan, undefined);
    if (options.noCredentials || options.chainFails)
      assert.equal(route.providerCalls(), 0);
  }
});

test("unsupported provider allocations and invalid request bodies cannot escape API validation", async () => {
  const route = loadRoute({
    answer: JSON.stringify(proposal([["UNSUPPORTED", 100]])),
  });
  assert.equal((await route.post(request())).status, 503);
  const bad = new Request("http://local/api/rebalance", {
    method: "POST",
    body: "{}",
  });
  assert.equal((await route.post(bad)).status, 400);
});
