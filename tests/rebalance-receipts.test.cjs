const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const viem = require("viem");

const OWNER = `0x${"a".repeat(40)}`;
const FOREIGN = `0x${"b".repeat(40)}`;
const POSITION = `0x${"c".repeat(64)}`;
const ORIGINAL_HASH = `0x${"1".repeat(64)}`;
const CANONICAL_HASH = `0x${"2".repeat(64)}`;
const VAULT = "0x1810b360e0a4d593117f0bfaf2e0939b2df5e415";
const TOKEN = "0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21";

const EVENT_ABI = viem.parseAbi([
  "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
  "event PositionSold(bytes32 indexed id, address indexed owner, string ticker, uint256 soldQuantity, uint256 payoutUSD, int256 pnlUSD, uint256 fractionBps, bool fullyClosed)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);
const BUY_ABI = viem.parseAbi([
  "function buyPosition(string ticker, uint256 usdAmount, uint256 entryPrice, uint8 initialTier) returns (bytes32 positionId)",
]);
const BUY_INPUT = viem.encodeFunctionData({
  abi: BUY_ABI,
  functionName: "buyPosition",
  args: ["NVDA", viem.parseUnits("500", 18), viem.parseUnits("100", 18), 1],
});
const SELL_INPUT = viem.encodeFunctionData({
  abi: viem.parseAbi([
    "function sellPosition(bytes32 positionId, uint256 currentPrice, uint256 fractionBps) returns (uint256 payout)",
  ]),
  functionName: "sellPosition",
  args: [POSITION, viem.parseUnits("200", 18), 10000n],
});

/** Produce actual raw EVM topics/data, rather than stubbing event decoding. */
function rawEvent(eventName, args, address = VAULT) {
  const event = EVENT_ABI.find((item) => item.name === eventName);
  const dataInputs = event.inputs.filter((input) => !input.indexed);
  return {
    address,
    topics: viem.encodeEventTopics({ abi: EVENT_ABI, eventName, args }),
    data: viem.encodeAbiParameters(
      dataInputs,
      dataInputs.map((input) => args[input.name]),
    ),
  };
}

const opened = (owner = OWNER, address = VAULT) =>
  rawEvent(
    "PositionOpened",
    {
      id: POSITION,
      owner,
      ticker: "NVDA",
      usdCost: viem.parseUnits("500", 18),
      entryPrice: viem.parseUnits("100", 18),
      quantity: viem.parseUnits("5", 18),
      initialTier: 1,
    },
    address,
  );

const filename = path.resolve(__dirname, "../lib/contracts.ts");
const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

/** Every test gets an isolated module and read-only client; no global patching. */
function loadContracts(options = {}) {
  const receipt = {
    status: "success",
    transactionHash: ORIGINAL_HASH,
    logs: [opened()],
    ...options.receipt,
  };
  const original = {
    hash: ORIGINAL_HASH,
    from: OWNER,
    to: VAULT,
    input: BUY_INPUT,
    value: 0n,
    ...options.original,
  };
  const canonical = {
    ...original,
    hash: receipt.transactionHash,
    ...options.canonical,
  };
  const calls = { transactions: [], waits: [] };
  const client = {
    async getTransaction({ hash }) {
      calls.transactions.push(hash);
      if (hash === ORIGINAL_HASH) return original;
      if (hash === receipt.transactionHash) return canonical;
      throw new Error(`Unexpected transaction lookup: ${hash}`);
    },
    async waitForTransactionReceipt(args) {
      calls.waits.push({ hash: args.hash, timeout: args.timeout });
      if (receipt.transactionHash !== ORIGINAL_HASH) {
        args.onReplaced?.({
          reason: options.replacementReason ?? "repriced",
          replacedTransaction: original,
          transaction: canonical,
          transactionReceipt: receipt,
        });
      }
      return receipt;
    },
  };
  const mockedViem = {
    ...viem,
    createPublicClient: () => client,
    // Prevent the production client factory from constructing a real transport.
    http: () => ({ testTransport: true }),
  };
  const mod = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: mod,
      exports: mod.exports,
      require(id) {
        if (id === "viem") return mockedViem;
        if (id === "viem/chains") return require("viem/chains");
        throw new Error(`Unexpected dependency: ${id}`);
      },
    },
    { filename },
  );
  assert.equal(mod.exports.VAULT_ADDRESS, VAULT);
  assert.equal(mod.exports.MOCK_USD_ADDRESS, TOKEN);
  return { contracts: mod.exports, calls };
}

test("a wallet speed-up records and validates the canonical mined hash", async () => {
  const { contracts, calls } = loadContracts({
    receipt: { transactionHash: CANONICAL_HASH },
  });
  const hashes = [];
  const result = await contracts.confirmedRebalanceReceipt(
    OWNER,
    ORIGINAL_HASH,
    "buy",
    (hash) => hashes.push(hash),
  );
  assert.equal(result.hash, CANONICAL_HASH);
  assert.equal(result.positionId, POSITION);
  assert.equal(result.ticker, "NVDA");
  assert.equal(result.amount, 500);
  assert.equal(result.quantity, 5);
  assert.equal(result.entryPrice, 100);
  assert.deepEqual(calls.transactions, [ORIGINAL_HASH, CANONICAL_HASH]);
  assert.deepEqual(calls.waits, [{ hash: ORIGINAL_HASH, timeout: 120_000 }]);
  assert.ok(hashes.length > 0);
  assert.ok(hashes.every((hash) => hash === CANONICAL_HASH));
});

test("a mined cancellation or replacement cannot apply the original city's change", async () => {
  for (const changed of [
    { to: OWNER, input: "0x" },
    { input: "0x12345678" },
    { value: 1n },
  ]) {
    const { contracts } = loadContracts({
      receipt: { transactionHash: CANONICAL_HASH },
      canonical: changed,
      replacementReason: changed.to === OWNER ? "cancelled" : "replaced",
    });
    // Even a valid-looking event must not rescue mismatched replacement calldata.
    await assert.rejects(
      contracts.confirmedRebalanceReceipt(OWNER, ORIGINAL_HASH, "buy"),
      /replaced or cancelled on-chain/,
    );
  }
});

test("a reverted receipt never becomes a completed building", async () => {
  const { contracts, calls } = loadContracts({
    receipt: { status: "reverted" },
  });
  await assert.rejects(
    contracts.confirmedRebalanceReceipt(OWNER, ORIGINAL_HASH, "buy"),
    /transaction reverted.*No city change was applied/,
  );
  assert.deepEqual(calls.transactions, [ORIGINAL_HASH]);
});

test("successful receipts from a foreign wallet or contract are rejected", async () => {
  for (const changed of [{ from: FOREIGN }, { to: FOREIGN }]) {
    const { contracts } = loadContracts({ original: changed });
    await assert.rejects(
      contracts.confirmedRebalanceReceipt(OWNER, ORIGINAL_HASH, "buy"),
      /does not belong to the reviewed wallet and vault/,
    );
  }
});

test("sale proceeds use actual matching mUSD transfers instead of quoted event payout", async () => {
  const transfer = (amount, overrides = {}, address = TOKEN) =>
    rawEvent(
      "Transfer",
      {
        from: VAULT,
        to: OWNER,
        value: viem.parseUnits(String(amount), 18),
        ...overrides,
      },
      address,
    );
  const sold = rawEvent("PositionSold", {
    id: POSITION,
    owner: OWNER,
    ticker: "NVDA",
    soldQuantity: viem.parseUnits("5", 18),
    payoutUSD: viem.parseUnits("1000", 18),
    pnlUSD: viem.parseUnits("500", 18),
    fractionBps: 10000n,
    fullyClosed: true,
  });
  const { contracts } = loadContracts({
    original: { input: SELL_INPUT },
    receipt: {
      logs: [
        transfer(400),
        transfer(50),
        transfer(700, {}, FOREIGN),
        transfer(800, { to: FOREIGN }),
        transfer(900, { from: FOREIGN }),
        sold,
      ],
    },
  });
  const result = await contracts.confirmedRebalanceReceipt(
    OWNER,
    ORIGINAL_HASH,
    "sell",
  );
  assert.equal(result.hash, ORIGINAL_HASH);
  assert.equal(result.positionId, POSITION);
  assert.equal(result.amount, 450, "vault reserves capped the actual transfer");
  assert.equal(result.quantity, 5);
  assert.equal(result.fullyClosed, true);
});

test("missing, foreign-contract or foreign-owner position events cannot confirm a change", async () => {
  for (const logs of [[], [opened(OWNER, FOREIGN)], [opened(FOREIGN)]]) {
    const { contracts } = loadContracts({ receipt: { logs } });
    await assert.rejects(
      contracts.confirmedRebalanceReceipt(OWNER, ORIGINAL_HASH, "buy"),
      /no matching position event/,
    );
  }
});
