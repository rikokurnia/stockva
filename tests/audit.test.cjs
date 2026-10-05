const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, dependencies = {}, globals = {}) {
  const filename = path.resolve(__dirname, "..", file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module,
      exports: module.exports,
      ...globals,
      require(id) {
        if (!(id in dependencies))
          throw new Error(`Unexpected dependency: ${id}`);
        return dependencies[id];
      },
    },
    { filename },
  );
  return module.exports;
}

const hash = (n) => `0x${String(n).repeat(64)}`;
const sequence = () => ({
  mode: "sequential",
  status: "running",
  plan: {
    steps: [
      { id: "sell", action: "sell" },
      { id: "buy", action: "buy" },
    ],
  },
  steps: [
    { stepId: "sell", status: "queued" },
    { stepId: "buy", status: "queued" },
  ],
});

test("standard wallets must mine a real sale before submitting a purchase", async () => {
  const { executeSequentialRebalance } = load("lib/rebalance-sequential.ts");
  const calls = [];
  let cash = 0;
  const result = await executeSequentialRebalance(sequence(), {
    save(run) {
      calls.push(`save:${run.steps.map((s) => s.status).join(",")}`);
    },
    async send(step, submitted, approved) {
      calls.push(`send:${step.action}`);
      if (step.action === "buy") {
        assert.equal(cash, 450, "purchase uses actual sale proceeds");
        approved(hash(3));
      }
      const tx = hash(step.action === "sell" ? 1 : 2);
      submitted(tx);
      return tx;
    },
    async confirm(step, tx) {
      calls.push(`mine:${step.action}`);
      return { hash: tx, amount: step.action === "sell" ? 450 : 400 };
    },
    apply(step, receipt) {
      calls.push(`apply:${step.action}`);
      cash += step.action === "sell" ? receipt.amount : -receipt.amount;
      return "saved-city";
    },
  });
  assert.deepEqual(
    calls.filter((c) => !c.startsWith("save:")),
    [
      "send:sell",
      "mine:sell",
      "apply:sell",
      "send:buy",
      "mine:buy",
      "apply:buy",
    ],
  );
  assert.equal(cash, 50);
  assert.ok(result.steps.every((s) => s.status === "confirmed"));
  assert.equal(result.steps[1].approvalHash, hash(3));
  assert.ok(
    calls.indexOf("save:submitted,queued") < calls.indexOf("mine:sell"),
  );
});

test("a receipt timeout retains the hash and resume polls without another sale", async () => {
  const { executeSequentialRebalance } = load("lib/rebalance-sequential.ts");
  let saved;
  const sent = [];
  const io = {
    save(run) {
      saved = JSON.parse(JSON.stringify(run));
    },
    async send(step, submitted) {
      sent.push(step.action);
      const tx = hash(step.action === "sell" ? 1 : 2);
      submitted(tx);
      return tx;
    },
    async confirm() {
      throw new Error("RPC timeout");
    },
    apply() {
      assert.fail("unmined transactions cannot alter the city");
    },
  };
  await assert.rejects(
    executeSequentialRebalance(sequence(), io),
    /RPC timeout/,
  );
  assert.equal(saved.steps[0].hash, hash(1));
  assert.deepEqual(sent, ["sell"]);
  const result = await executeSequentialRebalance(saved, {
    ...io,
    async confirm(step, tx, canonical) {
      canonical(tx);
      return { hash: tx };
    },
    apply() {
      return "confirmed-city";
    },
  });
  assert.deepEqual(sent, ["sell", "buy"]);
  assert.ok(result.steps.every((s) => s.status === "confirmed"));
});

test("a rejected sale stops all purchases; a reverted buy can be retried without selling twice", async () => {
  const { executeSequentialRebalance } = load("lib/rebalance-sequential.ts");
  let saved;
  await assert.rejects(
    executeSequentialRebalance(sequence(), {
      save(run) {
        saved = run;
      },
      async send(step) {
        assert.equal(step.action, "sell");
        throw new Error("User rejected");
      },
      async confirm() {
        assert.fail("nothing was submitted");
      },
      apply() {
        assert.fail("nothing was mined");
      },
    }),
    /User rejected/,
  );
  assert.equal(saved.steps[1].status, "queued");
  const run = sequence();
  run.steps[0] = { stepId: "sell", status: "confirmed", hash: hash(1) };
  run.steps[1] = {
    stepId: "buy",
    status: "error",
    hash: hash(2),
    reverted: true,
  };
  const result = await executeSequentialRebalance(run, {
    save() {},
    async send(step, submitted) {
      assert.equal(step.action, "buy");
      submitted(hash(4));
      return hash(4);
    },
    async confirm(step, tx) {
      assert.equal(tx, hash(4));
      return { hash: tx };
    },
    apply() {
      return "city";
    },
  });
  assert.equal(result.steps[1].hash, hash(4));
});

const assets = [
  { ticker: "NVDA", price: 10 },
  { ticker: "JPM", price: 20 },
];
const json = {
  NextResponse: {
    json(body) {
      return body;
    },
  },
};
function market(fetch) {
  let time = 1_800_000_000_000;
  class Clock extends Date {
    static now() {
      return time;
    }
  }
  const fallbackFeed = () => ({
    fetchedAt: new Date(time).toISOString(),
    quotes: Object.fromEntries(
      assets.map((a) => [
        a.ticker,
        { ...a, change: 0, status: "fallback", fetchedAt: null },
      ]),
    ),
  });
  const route = load(
    "app/api/market/route.ts",
    {
      "next/server": json,
      "../../../lib/city": { assets },
      "../../../lib/market": { fallbackFeed },
      "../../../lib/rwa-server": { rwaConfigured: () => false },
    },
    { fetch, Date: Clock, AbortSignal },
  );
  return {
    get: route.GET,
    advance() {
      time += 61000;
    },
  };
}

test("Kraken failure still uses xStocks then Yahoo, with daily rather than weekly change", async () => {
  const calls = [];
  const route = market(async (url) => {
    calls.push(url);
    if (url.includes("kraken")) throw new Error("Kraken down");
    if (url.includes("xstocks"))
      return {
        ok: true,
        async json() {
          return { quote: url.includes("NVDAx") ? "110" : null };
        },
      };
    return {
      ok: true,
      async json() {
        return {
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 210,
                  chartPreviousClose: 100,
                  previousClose: 200,
                },
                indicators: { quote: [{ close: [100, 150, 200, 210] }] },
              },
            ],
          },
        };
      },
    };
  });
  const feed = await route.get();
  assert.equal(feed.quotes.NVDA.price, 110);
  assert.equal(feed.quotes.NVDA.source, "xStocks · indicative price");
  assert.equal(feed.quotes.JPM.source, "Underlying reference · Yahoo");
  assert.ok(Math.abs(feed.quotes.JPM.change - 5) < 1e-9);
  assert.equal(feed.error, undefined);
  assert.equal(calls.filter((u) => u.includes("yahoo")).length, 1);
});

test("repeated complete provider outages preserve observed prices and their timestamp as stale", async () => {
  let offline = false;
  const route = market(async (url) => {
    if (offline) throw new Error("offline");
    if (url.includes("kraken")) throw new Error("Kraken down");
    return {
      ok: true,
      async json() {
        return { quote: "110" };
      },
    };
  });
  const first = await route.get();
  offline = true;
  route.advance();
  const second = await route.get();
  route.advance();
  const third = await route.get();
  for (const feed of [second, third]) {
    assert.equal(feed.quotes.NVDA.price, 110);
    assert.equal(feed.quotes.NVDA.status, "stale");
    assert.equal(feed.quotes.NVDA.fetchedAt, first.fetchedAt);
    assert.match(feed.error, /unavailable/);
  }
});

test("RWA spread requests cannot receive another ticker's cached response", async () => {
  const route = load(
    "app/api/rwa/spread/route.ts",
    {
      "next/server": json,
      "../../../../lib/city": { assets },
      "../../../../lib/rwa-server": {
        rwaConfigured: () => true,
        async rwaSpreadQuotes(tickers) {
          return tickers.map((ticker) => ({
            ticker,
            onchain: 110,
            reference: 100,
          }));
        },
      },
    },
    { URL },
  );
  const nvda = await route.GET(
    new Request("http://localhost/api/rwa/spread?tickers=NVDA"),
  );
  const jpm = await route.GET(
    new Request("http://localhost/api/rwa/spread?tickers=JPM"),
  );
  assert.deepEqual(Object.keys(nvda.quotes), ["NVDA"]);
  assert.deepEqual(Object.keys(jpm.quotes), ["JPM"]);
});

const viem = require("viem");
const OWNER = `0x${"a".repeat(40)}`;
const VAULT = "0x1810b360e0a4d593117f0bfaf2e0939b2df5e415";
const TOKEN = "0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21";
const events = viem.parseAbi([
  "event FaucetClaimed(address indexed recipient,uint256 amount)",
  "event PositionOpened(bytes32 indexed id,address indexed owner,string ticker,uint256 usdCost,uint256 entryPrice,uint256 quantity,uint8 initialTier)",
]);
function event(name, args, address) {
  const inputs = events
    .find((e) => e.name === name)
    .inputs.filter((p) => !p.indexed);
  return {
    address,
    topics: viem.encodeEventTopics({ abi: events, eventName: name, args }),
    data: viem.encodeAbiParameters(
      inputs,
      inputs.map((p) => args[p.name]),
    ),
  };
}
function contracts(receipt, options = {}) {
  const writes = [];
  const client = {
    async readContract({ functionName }) {
      return functionName === "balanceOf" || functionName === "allowance"
        ? viem.parseUnits("10000", 18)
        : undefined;
    },
    async waitForTransactionReceipt(args) {
      if (options.timeout) throw new Error("RPC timeout");
      args.onReplaced?.({ transactionReceipt: receipt });
      return receipt;
    },
  };
  const provider = {
    async request({ method }) {
      return method === "eth_accounts" ? [OWNER] : "0x61";
    },
  };
  const mod = load("lib/contracts.ts", {
    viem: {
      ...viem,
      createPublicClient: () => client,
      createWalletClient: () => ({
        async writeContract(args) {
          writes.push(args);
          return hash(1);
        },
      }),
    },
    "viem/chains": require("viem/chains"),
  });
  return { mod, writes, provider };
}
test("faucet only credits successful matching mined claims, including Privy providers", async () => {
  const claim = event(
    "FaucetClaimed",
    { recipient: OWNER, amount: viem.parseUnits("10000", 18) },
    TOKEN,
  );
  const receipt = {
    status: "success",
    transactionHash: hash(2),
    logs: [claim],
  };
  const good = contracts(receipt);
  assert.equal(
    await good.mod.claimFaucetOnchain(OWNER, good.provider),
    hash(2),
  );
  assert.equal(good.writes[0].functionName, "claimFaucet");
  for (const [badReceipt, options, message] of [
    [{ ...receipt, status: "reverted" }, {}, /reverted/],
    [receipt, { timeout: true }, /RPC timeout/],
    [{ ...receipt, logs: [] }, {}, /does not confirm/],
    [
      { ...receipt, logs: [{ ...claim, address: VAULT }] },
      {},
      /does not confirm/,
    ],
  ]) {
    const bad = contracts(badReceipt, options);
    await assert.rejects(
      bad.mod.claimFaucetOnchain(OWNER, bad.provider),
      message,
    );
  }
});
test("bundle settlement rejects missing or changed positions and returns canonical hashes", async () => {
  const args = {
    id: hash(3),
    owner: OWNER,
    ticker: "NVDA",
    usdCost: viem.parseUnits("500", 18),
    entryPrice: viem.parseUnits("100", 18),
    quantity: viem.parseUnits("5", 18),
    initialTier: 1,
  };
  const opened = event("PositionOpened", args, VAULT);
  const receipt = {
    status: "success",
    transactionHash: hash(2),
    logs: [opened],
  };
  const items = [
    {
      buildingId: "building",
      ticker: "NVDA",
      usdAmount: 500,
      entryPrice: 100,
      initialTier: 1,
    },
  ];
  const good = contracts(receipt);
  const result = await good.mod.recordBuildingsBatch(
    OWNER,
    items,
    undefined,
    good.provider,
  );
  assert.equal(result.hash, hash(2));
  assert.equal(result.positionIds[0], hash(3));
  const recovered = contracts(receipt);
  const canonical = [];
  const saved = await recovered.mod.confirmedBuildingPurchases(OWNER, hash(1), items, (h) => canonical.push(h));
  assert.equal(saved.hash, hash(2));
  assert.equal(saved.positionIds[0], hash(3));
  assert.equal(recovered.writes.length, 0, "Recovery must never request another signature");
  assert.equal(canonical.at(-1), hash(2));
  for (const logs of [
    [],
    [{ ...opened, address: TOKEN }],
    [event("PositionOpened", { ...args, ticker: "JPM" }, VAULT)],
    [opened, opened],
  ]) {
    const bad = contracts({ ...receipt, logs });
    await assert.rejects(
      bad.mod.recordBuildingsBatch(OWNER, items, undefined, bad.provider),
      /missing building positions|does not match/,
    );
    await assert.rejects(bad.mod.confirmedBuildingPurchases(OWNER, hash(1), items), /missing building positions|does not match/);
  }
  const timeout = contracts(receipt, { timeout: true });
  await assert.rejects(timeout.mod.confirmedBuildingPurchases(OWNER, hash(1), items), /RPC timeout/);
  assert.equal(timeout.writes.length, 0);
  await assert.rejects(contracts({ ...receipt, status: "reverted" }).mod.confirmedBuildingPurchases(OWNER, hash(1), items), /reverted/);
});
