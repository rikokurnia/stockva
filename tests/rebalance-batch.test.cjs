const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const viem = require("viem");
const chains = require("viem/chains");
const { webcrypto } = require("node:crypto");
const OWNER = `0x${"a".repeat(40)}`;
const POSITION = `0x${"b".repeat(64)}`;
const OPENED = `0x${"c".repeat(64)}`;
const HASH = `0x${"d".repeat(64)}`;
const ID = `0x${"e".repeat(64)}`;
const VAULT = "0x1810b360e0a4d593117f0bfaf2e0939b2df5e415";
const TOKEN = "0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21";
const vaultAbi = viem.parseAbi([
  "struct Position { bytes32 id; address owner; string ticker; uint256 usdCost; uint256 entryPrice; uint256 quantity; uint256 openedAt; uint8 buildingTier; bool active; }",
  "function getUserPositions(address user) view returns (Position[])",
  "function buyPositionsBatch(string[] tickers,uint256[] usdAmounts,uint256[] entryPrices,uint8[] initialTiers) returns (bytes32[])",
  "function sellPosition(bytes32 id,uint256 currentPrice,uint256 fractionBps) returns (uint256)",
  "function rebalanceBatch(bytes32[] sellIds,uint256[] sellPrices,(string ticker,uint256 usdAmount,uint256 entryPrice,uint8 initialTier)[] buys) returns (bytes32[])",
  "event PositionOpened(bytes32 indexed id,address indexed owner,string ticker,uint256 usdCost,uint256 entryPrice,uint256 quantity,uint8 initialTier)",
  "event PositionSold(bytes32 indexed id,address indexed owner,string ticker,uint256 soldQuantity,uint256 payoutUSD,int256 pnlUSD,uint256 fractionBps,bool fullyClosed)",
]);
const tokenAbi = viem.parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 value) returns (bool)",
  "event Transfer(address indexed from,address indexed to,uint256 value)",
]);
const wei = (n) => viem.parseUnits(String(n), 18);
const plan = {
  id: "one-approval",
  walletAddress: OWNER,
  steps: [
    {
      id: "sell",
      action: "sell",
      ticker: "NVDA",
      positionId: POSITION,
      positionQuantity: wei(5).toString(),
      price: 100,
      fractionBps: 10000,
    },
    { id: "buy", action: "buy", ticker: "JPM", amount: 400, price: 200 },
  ],
};
function log(eventName, args, address = VAULT) {
  const abi = address === TOKEN ? tokenAbi : vaultAbi;
  const event = abi.find((e) => e.name === eventName);
  const inputs = event.inputs.filter((i) => !i.indexed);
  return {
    address,
    topics: viem.encodeEventTopics({ abi, eventName, args }),
    data: viem.encodeAbiParameters(
      inputs,
      inputs.map((i) => args[i.name]),
    ),
  };
}
function logs(payout = 500) {
  return [
    log("Transfer", { from: VAULT, to: OWNER, value: wei(payout) }, TOKEN),
    log("PositionSold", {
      id: POSITION,
      owner: OWNER,
      ticker: "NVDA",
      soldQuantity: wei(5),
      payoutUSD: wei(500),
      pnlUSD: 0n,
      fractionBps: 10000n,
      fullyClosed: true,
    }),
    log("Transfer", { from: OWNER, to: VAULT, value: wei(400) }, TOKEN),
    log("PositionOpened", {
      id: OPENED,
      owner: OWNER,
      ticker: "JPM",
      usdCost: wei(400),
      entryPrice: wei(200),
      quantity: wei(2),
      initialTier: 1,
    }),
  ];
}
const filename = path.resolve(__dirname, "../lib/rebalance-batch.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;
function load(options = {}) {
  const requests = [],
    reads = [],
    waits = [];
  const receipt = {
    status: "success",
    transactionHash: HASH,
    logs: logs(),
    ...options.receipt,
  };
  const publicClient = {
    async readContract(args) {
      reads.push(args);
      if (args.functionName === "getUserPositions")
        return (
          options.positions ?? [
            {
              id: POSITION,
              owner: OWNER,
              ticker: "NVDA",
              active: true,
              quantity: wei(5),
              ...options.position,
            },
          ]
        );
      if (args.functionName === "allowance") return options.allowance ?? 0n;
      if (args.functionName === "balanceOf")
        return args.args[0] === VAULT
          ? (options.reserves ?? wei(1000))
          : (options.balance ?? wei(100));
      throw new Error("Unexpected read");
    },
    async waitForTransactionReceipt(args) {
      waits.push(args);
      return receipt;
    },
    async getTransactionReceipt(args) {
      if (!options.singleTx) throw new Error("Unexpected read");
      if (options.mined === false) return null;
      return { status: "success", transactionHash: HASH, logs: logs() };
    },
    async call(args) {
      if (!options.singleTx) throw new Error("Unexpected read");
      if (options.v2 === false) throw new Error("execution reverted");
      const reason = { cause: { data: `0x08c379a0${"00".repeat(64)}` } };
      throw reason;
    },
  };
  const provider = {
    async request(args) {
      requests.push(args);
      if (args.method === "eth_chainId") return options.chainId ?? "0x61";
      if (args.method === "eth_accounts") return options.accounts ?? [OWNER];
      if (args.method === "eth_estimateGas") {
        if (!options.singleTx) throw new Error(`Unexpected wallet request: ${args.method}`);
        return 200000n;
      }
      if (args.method === "eth_sendTransaction") {
        if (!options.singleTx) throw new Error(`Unexpected wallet request: ${args.method}`);
        return options.txHash ?? HASH;
      }
      if (args.method === "wallet_getCapabilities")
        return {
          "0x61": { atomicBatch: { status: options.capability ?? "ready" } },
        };
      if (args.method === "wallet_sendCalls") {
        if (options.sendError) throw options.sendError;
        return { id: args.params[0].id };
      }
      if (args.method === "wallet_getCallsStatus") {
        if (options.statusError) throw options.statusError;
        return {
          id: ID,
          chainId: "0x61",
          atomic: true,
          status: 200,
          receipts: [
            {
              transactionHash: HASH,
              blockNumber: "0x64",
              gasUsed: "0x123",
              status: "0x1",
              logs: [],
            },
          ],
          ...options.status,
        };
      }
      // Fails loudly if viem ever falls back to separate signatures.
      throw new Error(`Unexpected wallet request: ${args.method}`);
    },
  };
  const mod = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: mod,
      exports: mod.exports,
      crypto: webcrypto,
      require(id) {
        if (id === "viem") return viem;
        if (id === "viem/chains") return chains;
        if (id === "./contracts")
          return {
            BSC_TESTNET_CHAIN_ID: 97,
            getBscClient: () => publicClient,
            MOCK_USD_ABI: tokenAbi,
            VAULT_ABI: vaultAbi,
            MOCK_USD_ADDRESS: TOKEN,
            VAULT_ADDRESS: VAULT,
          };
        throw new Error(`Unexpected dependency ${id}`);
      },
    },
    { filename },
  );
  return { batch: mod.exports, provider, requests, reads, waits, receipt };
}

test("sales, exact approval and all purchases require exactly ONE signing RPC on chain 97", async () => {
  const { batch, provider, requests } = load();
  const calls = await batch.prepareRebalanceBatch(provider, plan);
  assert.equal(
    requests.filter((r) => r.method === "wallet_sendCalls").length,
    0,
    "preflight is read-only",
  );
  const id = await batch.sendRebalanceBatch(provider, plan, calls, ID);
  assert.equal(id, ID);
  const signing = requests.filter((r) => r.method === "wallet_sendCalls");
  assert.equal(signing.length, 1);
  const request = signing[0].params[0];
  assert.equal(request.atomicRequired, true);
  assert.equal(request.chainId, "0x61");
  assert.equal(request.from.toLowerCase(), OWNER);
  assert.equal(request.id, ID);
  assert.equal(request.calls.length, 3);
  const sale = viem.decodeFunctionData({
    abi: vaultAbi,
    data: request.calls[0].data,
  });
  assert.equal(sale.functionName, "sellPosition");
  assert.deepEqual(sale.args, [POSITION, wei(100), 10000n]);
  assert.equal(request.calls[1].to, TOKEN);
  const approval = viem.decodeFunctionData({
    abi: tokenAbi,
    data: request.calls[1].data,
  });
  assert.equal(approval.functionName, "approve");
  assert.equal(
    approval.args[1],
    wei(400),
    "approval is bounded to the reviewed spend",
  );
  const buy = viem.decodeFunctionData({
    abi: vaultAbi,
    data: request.calls[2].data,
  });
  assert.equal(buy.functionName, "buyPositionsBatch");
  assert.deepEqual(buy.args, [["JPM"], [wei(400)], [wei(200)], [1]]);
  assert.equal(
    requests.filter((r) =>
      ["eth_sendTransaction", "eth_signTypedData_v4", "personal_sign"].includes(
        r.method,
      ),
    ).length,
    0,
  );
});

test("sufficient allowance skips approval; sale-only and buy-only plans still use one batch", async () => {
  const { batch, provider } = load({ allowance: wei(400), balance: wei(600) });
  assert.equal((await batch.prepareRebalanceBatch(provider, plan)).length, 2);
  assert.equal(
    (
      await batch.prepareRebalanceBatch(provider, {
        ...plan,
        steps: [plan.steps[0]],
      })
    ).length,
    1,
  );
  assert.equal(
    (
      await batch.prepareRebalanceBatch(provider, {
        ...plan,
        steps: [plan.steps[1]],
      })
    ).length,
    1,
  );
});

test("multiple purchases all fit in the same request", async () => {
  const { batch, provider, requests } = load({ balance: wei(1000) });
  const second = {
    ...plan.steps[1],
    id: "buy-2",
    ticker: "AAPL",
    amount: 250,
    price: 125,
  };
  const multi = { ...plan, steps: [...plan.steps, second] };
  const calls = await batch.prepareRebalanceBatch(provider, multi);
  await batch.sendRebalanceBatch(provider, multi, calls, ID);
  const request = requests.find((r) => r.method === "wallet_sendCalls")
    .params[0];
  const buys = viem.decodeFunctionData({
    abi: vaultAbi,
    data: request.calls.at(-1).data,
  });
  assert.deepEqual(buys.args[0], ["JPM", "AAPL"]);
  assert.equal(
    requests.filter((r) => r.method === "wallet_sendCalls").length,
    1,
  );
});

test("unsupported wallets and wallets requiring an upgrade never ask for multiple signatures", async () => {
  for (const capability of ["unsupported", "supported"]) {
    const { batch, provider, requests } = load({ capability });
    await assert.rejects(
      batch.prepareRebalanceBatch(provider, plan),
      /atomic batching|batch a rebalance/,
    );
    assert.ok(
      !requests.some(
        (r) =>
          r.method === "wallet_sendCalls" || r.method === "eth_sendTransaction",
      ),
    );
  }
  const { batch, provider, requests } = load({
    sendError: { code: -32601, message: "Method not found" },
  });
  await assert.rejects(
    batch.sendRebalanceBatch(provider, plan, [], ID),
    batch.RebalanceBatchRejected,
  );
  assert.deepEqual(
    requests.map((r) => r.method),
    ["wallet_sendCalls"],
  );
});

test("wrong chain/account, changed positions and insufficient funds stop before signing", async () => {
  for (const options of [
    { chainId: "0x38" },
    { accounts: [] },
    { position: { quantity: wei(4) } },
    { position: { active: false } },
    { position: { owner: `0x${"f".repeat(40)}` } },
    { reserves: wei(499) },
    { balance: 0n, reserves: 0n },
  ]) {
    const { batch, provider, requests } = load(options);
    await assert.rejects(batch.prepareRebalanceBatch(provider, plan));
    assert.equal(
      requests.filter((r) => r.method === "wallet_sendCalls").length,
      0,
    );
  }
  const { batch, provider } = load({ balance: 0n });
  await assert.rejects(
    batch.prepareRebalanceBatch(provider, { ...plan, steps: [plan.steps[1]] }),
    /balance changed/,
  );
});

test("mined batch verifies public logs and returns a receipt per building with the same hash", async () => {
  const { batch, provider, requests, waits } = load();
  const result = await batch.confirmRebalanceBatch(provider, plan, ID);
  assert.equal(result.length, 2);
  assert.equal(result[0].positionId, POSITION);
  assert.equal(result[1].positionId, OPENED);
  assert.equal(result[0].amount, 500);
  assert.equal(result[1].amount, 400);
  assert.ok(result.every((r) => r.hash === HASH));
  assert.equal(waits[0].hash, HASH);
  assert.ok(
    requests.every((r) => r.method === "wallet_getCallsStatus"),
    "recovery is polling only, never signs",
  );
});

test("settlement uses actual capped transfers and rejects missing, foreign or changed events", () => {
  const { batch, receipt } = load({ receipt: { logs: logs(450) } });
  assert.equal(batch.decodeRebalanceBatch(plan, receipt)[0].amount, 450);
  for (const bad of [
    { ...receipt, logs: receipt.logs.slice(0, 2) },
    {
      ...receipt,
      logs: receipt.logs.map((l) =>
        l.address === VAULT ? { ...l, address: OWNER } : l,
      ),
    },
    { ...receipt, status: "reverted" },
  ])
    assert.throws(() => batch.decodeRebalanceBatch(plan, bad));
  assert.throws(
    () =>
      batch.decodeRebalanceBatch(
        { ...plan, steps: [plan.steps[0], { ...plan.steps[1], amount: 401 }] },
        receipt,
      ),
    /purchase/,
  );
  assert.throws(
    () =>
      batch.decodeRebalanceBatch(
        {
          ...plan,
          steps: [{ ...plan.steps[0], positionId: OPENED }, plan.steps[1]],
        },
        receipt,
      ),
    /sale/,
  );
});

test("rejected requests are clearable, while uncertain transport errors preserve recovery", async () => {
  const rejected = load({ sendError: { code: 4001, message: "Rejected" } });
  await assert.rejects(
    rejected.batch.sendRebalanceBatch(rejected.provider, plan, [], ID),
    rejected.batch.RebalanceBatchRejected,
  );
  const uncertain = load({
    sendError: new Error("Connection closed after submission"),
  });
  await assert.rejects(
    uncertain.batch.sendRebalanceBatch(uncertain.provider, plan, [], ID),
    (e) => !(e instanceof uncertain.batch.RebalanceBatchRejected),
  );
  assert.equal(
    uncertain.requests.filter((r) => r.method === "wallet_sendCalls").length,
    1,
    "no transport retry",
  );
});

test("non-atomic, wrong-chain, missing and multiple transaction results cannot change the city", async () => {
  for (const status of [
    { atomic: false },
    { chainId: "0x38" },
    { receipts: [] },
    {
      receipts: [
        {
          transactionHash: HASH,
          blockNumber: "0x64",
          gasUsed: "0x123",
          status: "0x1",
        },
        {
          transactionHash: POSITION,
          blockNumber: "0x64",
          gasUsed: "0x123",
          status: "0x1",
        },
      ],
    },
    { status: 600 },
  ]) {
    const { batch, provider, waits } = load({ status });
    await assert.rejects(batch.confirmRebalanceBatch(provider, plan, ID));
    assert.equal(
      waits.length,
      0,
      "ambiguous wallet status is not accepted as a batch receipt",
    );
  }
});

test("atomic failure and public chain reverts return definitive failure, without another signature", async () => {
  for (const options of [
    { status: { status: 300, receipts: [] } },
    {
      status: {
        status: 400,
        receipts: [
          {
            transactionHash: HASH,
            blockNumber: "0x64",
            gasUsed: "0x123",
            status: "0x0",
          },
        ],
      },
    },
    { receipt: { status: "reverted" } },
  ]) {
    const { batch, provider, requests } = load(options);
    await assert.rejects(
      batch.confirmRebalanceBatch(provider, plan, ID),
      batch.RebalanceBatchRejected,
    );
    assert.ok(requests.every((r) => r.method === "wallet_getCallsStatus"));
  }
});

test("each persisted request ID is unique and wallet-provided replacement ID is retained", async () => {
  const { batch, provider } = load();
  const first = batch.newRebalanceBatchId();
  assert.match(first, /^0x[0-9a-f]{64}$/);
  assert.notEqual(first, batch.newRebalanceBatchId());
  const actual = `0x${"1".repeat(64)}`;
  const wrapper = {
    request: (args) =>
      args.method === "wallet_sendCalls"
        ? Promise.resolve({ id: actual })
        : provider.request(args),
  };
  assert.equal(
    await batch.sendRebalanceBatch(wrapper, plan, [], first),
    actual,
  );
});

test("several sales and buys share one signature, with payouts attributed to each sale", async () => {
  const secondId = `0x${"2".repeat(64)}`;
  const second = {
    ...plan.steps[0],
    id: "sell-2",
    ticker: "AAPL",
    positionId: secondId,
    positionQuantity: wei(2).toString(),
    price: 50,
  };
  const multi = { ...plan, steps: [plan.steps[0], second, plan.steps[1]] };
  const events = logs(450);
  events.splice(
    2,
    0,
    log("Transfer", { from: VAULT, to: OWNER, value: wei(80) }, TOKEN),
    log("PositionSold", {
      id: secondId,
      owner: OWNER,
      ticker: "AAPL",
      soldQuantity: wei(2),
      payoutUSD: wei(100),
      pnlUSD: 0n,
      fractionBps: 10000n,
      fullyClosed: true,
    }),
  );
  const { batch, provider, requests } = load({
    positions: [
      {
        id: POSITION,
        owner: OWNER,
        ticker: "NVDA",
        active: true,
        quantity: wei(5),
      },
      {
        id: secondId,
        owner: OWNER,
        ticker: "AAPL",
        active: true,
        quantity: wei(2),
      },
    ],
    receipt: { logs: events },
  });
  const calls = await batch.prepareRebalanceBatch(provider, multi);
  assert.equal(calls.length, 4);
  await batch.sendRebalanceBatch(provider, multi, calls, ID);
  const result = await batch.confirmRebalanceBatch(provider, multi, ID);
  assert.deepEqual(
    Array.from(result, (r) => r.amount),
    [450, 80, 400],
  );
  assert.ok(result.every((r) => r.hash === HASH));
  assert.equal(
    requests.filter((r) => r.method === "wallet_sendCalls").length,
    1,
  );
});

test("an invalid wallet response keeps the saved request ID instead of permitting another send", async () => {
  const { batch, provider } = load();
  const invalid = {
    request: (args) =>
      args.method === "wallet_sendCalls"
        ? Promise.resolve({})
        : provider.request(args),
  };
  await assert.rejects(
    batch.sendRebalanceBatch(invalid, plan, [], ID),
    (error) =>
      /saved request ID/.test(error.message) &&
      !(error instanceof batch.RebalanceBatchRejected),
  );
});

test("single-tx rebalance signs once for all steps on any plain wallet", async () => {
  const { batch, provider, requests } = load({ singleTx: true });
  const submitted = await batch.submitRebalanceSingleTx(provider, plan);
  assert.equal(submitted.hash, HASH);
  assert.ok(submitted.approvalHash, "exact approval is its own prompt");
  const sends = requests.filter((r) => r.method === "eth_sendTransaction");
  assert.equal(sends.length, 2, "approve + one vault call, nothing per stock");
  assert.ok(
    !requests.some((r) => r.method === "wallet_sendCalls"),
    "no EIP-7702 needed",
  );
  const receipts = await batch.confirmRebalanceSingleTx(plan, submitted.hash);
  assert.equal(receipts.length, 2);
  assert.ok(receipts.every((r) => r.hash === HASH));
  assert.equal(receipts[0].positionId, POSITION);
  assert.equal(receipts[1].positionId, OPENED);
});

test("single-tx skips approval when allowance already covers the buys", async () => {
  const { batch, provider, requests } = load({
    singleTx: true,
    allowance: wei(10000),
  });
  const submitted = await batch.submitRebalanceSingleTx(provider, plan);
  assert.equal(submitted.approvalHash, undefined);
  assert.equal(
    requests.filter((r) => r.method === "eth_sendTransaction").length,
    1,
    "exactly one signature total",
  );
});

test("single-tx refuses to sign anything when Vault V2 is not deployed", async () => {
  const { batch, provider, requests } = load({
    singleTx: true,
    v2: false,
  });
  await assert.rejects(
    batch.submitRebalanceSingleTx(provider, plan),
    batch.RebalanceV2Missing,
  );
  assert.equal(
    requests.filter((r) => r.method === "eth_sendTransaction").length,
    0,
    "no signature was requested",
  );
});

test("recovery returns mined receipts and null for absent transactions", async () => {
  const { batch } = load({ singleTx: true });
  const found = await batch.recoverRebalanceTx(plan, HASH);
  assert.equal(found.length, 2);
  const { batch: cold } = load({ singleTx: true, mined: false });
  assert.equal(await cold.recoverRebalanceTx(plan, HASH), null);
});
