import {
  createWalletClient,
  custom,
  decodeEventLog,
  encodeFunctionData,
  formatUnits,
  parseUnits,
  toHex,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { bscTestnet } from "viem/chains";
import {
  BSC_TESTNET_CHAIN_ID,
  getBscClient,
  MOCK_USD_ABI,
  MOCK_USD_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
  type RebalanceReceipt,
} from "./contracts";
import type {
  RebalanceBuyStep,
  RebalancePlan,
  RebalanceSellStep,
} from "./rebalance";

export type BatchProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
export type RebalanceCalls = { to: Hex; data: Hex }[];

/** A definitive rejection/revert can be cleared. Timeouts keep their batch ID. */
export class RebalanceBatchRejected extends Error {}

/** Vault V2 (rebalanceBatch) is not deployed at VAULT_ADDRESS yet. */
export class RebalanceV2Missing extends Error {}

export function newRebalanceBatchId(): Hex {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

function walletClient(provider: BatchProvider, account: Hex) {
  return createWalletClient({
    account,
    chain: bscTestnet,
    transport: custom(provider, { retryCount: 0 }),
  });
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const wei = (value: number) => {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error("The blueprint contains an invalid amount or price.");
  const amount = parseUnits(value.toFixed(6), 18);
  if (amount <= 0) throw new Error("The blueprint amount is too small.");
  return amount;
};
const decimal = (value: bigint) => Number(formatUnits(value, 18));

export type RebalanceOnchainState = {
  positions: readonly {
    id: `0x${string}`;
    owner: `0x${string}`;
    ticker: string;
    active: boolean;
    quantity: bigint;
  }[];
  balance: bigint;
  reserves: bigint;
  allowance: bigint;
};

/** Public chain reads for rebalance validation. No wallet prompts. */
export async function readRebalanceOnchain(
  plan: RebalancePlan,
): Promise<RebalanceOnchainState> {
  const client = getBscClient();
  const [positions, balance, reserves, allowance] = await Promise.all([
    client.readContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "getUserPositions",
      args: [plan.walletAddress],
    }),
    client.readContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "balanceOf",
      args: [plan.walletAddress],
    }),
    client.readContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "balanceOf",
      args: [VAULT_ADDRESS],
    }),
    client.readContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "allowance",
      args: [plan.walletAddress, VAULT_ADDRESS],
    }),
  ]);
  return {
    positions: positions as RebalanceOnchainState["positions"],
    balance: balance as bigint,
    reserves: reserves as bigint,
    allowance: allowance as bigint,
  };
}

/**
 * Shared blueprint validation (positions, order, reserves, funds).
 * Identical checks back both the EIP-7702 batch path and the single-tx path.
 */
export function checkRebalanceState(
  plan: RebalancePlan,
  state: RebalanceOnchainState,
): {
  sells: RebalanceSellStep[];
  buys: RebalanceBuyStep[];
  total: bigint;
  proceeds: bigint;
} {
  const sells = plan.steps.filter((s) => s.action === "sell");
  const buys = plan.steps.filter((s) => s.action === "buy");
  if (
    new Set(sells.map((s) => s.positionId.toLowerCase())).size !==
      sells.length ||
    new Set(buys.map((s) => s.ticker)).size !== buys.length ||
    plan.steps.some(
      (s, i) =>
        s.action === "sell" &&
        plan.steps.slice(0, i).some((p) => p.action === "buy"),
    )
  )
    throw new Error(
      "The blueprint has duplicate positions or an invalid execution order.",
    );
  let proceeds = BigInt(0);
  const ten18 = BigInt(10) ** BigInt(18);
  for (const step of sells) {
    const position = state.positions.find((p) => same(p.id, step.positionId));
    if (
      !position?.active ||
      !same(position.owner, plan.walletAddress) ||
      position.ticker !== step.ticker ||
      position.quantity.toString() !== step.positionQuantity ||
      step.fractionBps !== 10000
    )
      throw new Error(
        "An on-chain position changed. Request a fresh blueprint before signing.",
      );
    proceeds += (position.quantity * wei(step.price)) / ten18;
  }
  const total = buys.reduce((sum, step) => sum + wei(step.amount), BigInt(0));
  if (state.reserves < proceeds)
    throw new Error(
      "Vault reserves changed. Request a fresh blueprint before signing.",
    );
  if (state.balance + proceeds < total)
    throw new Error(
      "Your mUSD balance changed. Request a fresh blueprint before signing.",
    );
  return { sells, buys, total, proceeds };
}

/** Read-only preflight. No chain switch, approval, or transaction is requested. */
export async function prepareRebalanceBatch(
  provider: BatchProvider,
  plan: RebalancePlan,
): Promise<RebalanceCalls> {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (Number(chainId) !== BSC_TESTNET_CHAIN_ID)
    throw new Error(
      "Switch your connected wallet to BNB Chain testnet before signing the rebalance.",
    );
  const accounts = await provider.request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    !accounts.some((a) => typeof a === "string" && same(a, plan.walletAddress))
  )
    throw new Error("Connect the wallet that reviewed this blueprint.");
  let capabilities;
  try {
    capabilities = await walletClient(
      provider,
      plan.walletAddress,
    ).getCapabilities({ chainId: BSC_TESTNET_CHAIN_ID });
  } catch {
    throw new Error(
      "This wallet cannot batch a rebalance with one approval on BNB testnet. Connect a wallet with atomic batching enabled.",
    );
  }
  // 'supported' may prompt for an account upgrade. Require 'ready' so this flow
  // cannot introduce a second signature or migrate the position owner's address.
  if (capabilities?.atomicBatch?.status !== "ready")
    throw new Error(
      capabilities?.atomicBatch?.status === "supported"
        ? "Enable atomic batching for this wallet on BNB testnet first, then request a fresh blueprint. The rebalance itself requires one approval."
        : "This wallet cannot batch a rebalance with one approval on BNB testnet. Connect a wallet with atomic batching enabled.",
    );
  if (!plan.steps.length || plan.steps.length > 16)
    throw new Error(
      "Request a fresh blueprint with at most 16 building changes.",
    );
  const state = await readRebalanceOnchain(plan);
  const { sells, buys, total } = checkRebalanceState(plan, state);
  const tenThousand = BigInt(10000);
  const calls: RebalanceCalls = sells.map((step) => {
    return {
      to: VAULT_ADDRESS,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "sellPosition",
        args: [step.positionId, wei(step.price), tenThousand],
      }),
    };
  });
  if (buys.length) {
    // Exact spending approval is INSIDE the same atomic request, never a second
    // wallet prompt and never an unlimited allowance.
    if (state.allowance < total)
      calls.push({
        to: MOCK_USD_ADDRESS,
        data: encodeFunctionData({
          abi: MOCK_USD_ABI,
          functionName: "approve",
          args: [VAULT_ADDRESS, total],
        }),
      });
    calls.push({
      to: VAULT_ADDRESS,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "buyPositionsBatch",
        args: [
          buys.map((s) => s.ticker),
          buys.map((s) => wei(s.amount)),
          buys.map((s) => wei(s.price)),
          buys.map(() => 1),
        ],
      }),
    });
  }
  return calls;
}

/** The only signing request. Never enable viem's sequential transaction fallback. */
export async function sendRebalanceBatch(
  provider: BatchProvider,
  plan: RebalancePlan,
  calls: RebalanceCalls,
  id: string,
): Promise<string> {
  try {
    const result = await walletClient(provider, plan.walletAddress).sendCalls({
      calls,
      id,
      forceAtomic: true,
    });
    if (
      typeof result?.id !== "string" ||
      !result.id.length ||
      result.id.length > 512
    )
      throw new Error(
        "The wallet returned no usable batch ID. Keep the saved request ID and check confirmation without signing again.",
      );
    return result.id;
  } catch (error) {
    // Traverse viem's error causes. Everything else could have been accepted by
    // the wallet before a connection error, so must be recovered by ID.
    let cause: unknown = error;
    for (let i = 0; i < 8 && cause && typeof cause === "object"; i++) {
      const rpc = cause as { code?: number; cause?: unknown };
      if (
        [
          4001, 4100, 4200, -32601, -32602, 5700, 5710, 5720, 5730, 5740,
        ].includes(rpc.code ?? 0)
      )
        throw new RebalanceBatchRejected(
          "The wallet rejected the batch. No rebalance was submitted. Review wallet support and try a fresh blueprint.",
        );
      cause = rpc.cause;
    }
    throw error;
  }
}

/**
 * Probe whether the deployed vault has rebalanceBatch (Vault V2).
 * V2 reverts WITH a reason ("Empty rebalance"); a missing function reverts
 * with empty data. Only reason-carrying reverts count as support.
 */
export async function vaultSupportsRebalance(): Promise<boolean> {
  const probe = encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "rebalanceBatch",
    args: [[], [], []],
  });
  try {
    await getBscClient().call({ to: VAULT_ADDRESS, data: probe });
    return true;
  } catch (error) {
    let cause: unknown = error;
    for (let i = 0; i < 8 && cause && typeof cause === "object"; i++) {
      const data = (cause as { data?: unknown }).data;
      if (
        typeof data === "string" &&
        /^0x[0-9a-fA-F]{8}[0-9a-fA-F]*$/.test(data) &&
        data.length > 10
      )
        return true;
      cause = (cause as { cause?: unknown }).cause;
    }
    return false;
  }
}

/**
 * One-signature rebalance for ANY plain EOA wallet: exact mUSD approval only
 * when needed, then a single vault.rebalanceBatch transaction for every step.
 * Throws RebalanceV2Missing before any signature when Vault V2 is not live.
 */
export async function submitRebalanceSingleTx(
  provider: BatchProvider,
  plan: RebalancePlan,
): Promise<{ approvalHash?: Hex; hash: Hex }> {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (Number(chainId) !== BSC_TESTNET_CHAIN_ID)
    throw new Error(
      "Switch your connected wallet to BNB Chain testnet before signing the rebalance.",
    );
  const accounts = await provider.request({ method: "eth_accounts" });
  if (
    !Array.isArray(accounts) ||
    !accounts.some((a) => typeof a === "string" && same(a, plan.walletAddress))
  )
    throw new Error("Connect the wallet that reviewed this blueprint.");
  if (!(await vaultSupportsRebalance()))
    throw new RebalanceV2Missing(
      `Vault V2 with rebalanceBatch is not deployed at ${VAULT_ADDRESS} yet. Deploy it with contracts/script/DeployVaultV2.s.sol, update the vault address, then retry — one signature covers the whole rebalance.`,
    );
  const state = await readRebalanceOnchain(plan);
  const { sells, buys, total } = checkRebalanceState(plan, state);
  const wc = walletClient(provider, plan.walletAddress);
  let approvalHash: Hex | undefined;
  if (buys.length && state.allowance < total) {
    approvalHash = await wc.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, total],
      account: plan.walletAddress as Hex,
      chain: bscTestnet,
    });
  }
  const hash = await wc.writeContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "rebalanceBatch",
    args: [
      sells.map((s) => s.positionId),
      sells.map((s) => wei(s.price)),
      buys.map((b) => ({
        ticker: b.ticker,
        usdAmount: wei(b.amount),
        entryPrice: wei(b.price),
        initialTier: 1,
      })),
    ],
    account: plan.walletAddress as Hex,
    chain: bscTestnet,
  });
  return { approvalHash, hash };
}

/** Confirm a submitted single-tx rebalance from public logs. Never signs. */
export async function confirmRebalanceSingleTx(
  plan: RebalancePlan,
  hash: Hex,
): Promise<RebalanceReceipt[]> {
  const receipt = await getBscClient().waitForTransactionReceipt({
    hash,
    timeout: 120_000,
  });
  return decodeRebalanceBatch(plan, receipt);
}

/**
 * Recovery poll for an interrupted single-tx: mined → receipts; absent →
 * null (safe to submit fresh — vault atomicity reverts any double).
 */
export async function recoverRebalanceTx(
  plan: RebalancePlan,
  id: string,
): Promise<RebalanceReceipt[] | null> {
  let receipt = null;
  try {
    receipt = await getBscClient().getTransactionReceipt({ hash: id as Hex });
  } catch {
    return null;
  }
  if (!receipt) return null;
  return decodeRebalanceBatch(plan, receipt);
}

/** Verify every vault event against the signed plan using public chain logs. */
export function decodeRebalanceBatch(
  plan: RebalancePlan,
  receipt: Pick<TransactionReceipt, "status" | "transactionHash" | "logs">,
): RebalanceReceipt[] {
  if (receipt.status !== "success")
    throw new RebalanceBatchRejected(
      "The atomic rebalance reverted. No building changes were applied.",
    );
  const receipts: RebalanceReceipt[] = [];
  let payout = BigInt(0);
  const ten18 = BigInt(10) ** BigInt(18);
  const tenThousand = BigInt(10000);
  const openedIds = new Set<string>();
  for (const log of receipt.logs) {
    if (same(log.address, MOCK_USD_ADDRESS)) {
      try {
        const event = decodeEventLog({
          abi: MOCK_USD_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (
          event.eventName === "Transfer" &&
          same(event.args.from, VAULT_ADDRESS) &&
          same(event.args.to, plan.walletAddress)
        )
          payout += event.args.value;
      } catch {
        /* Not a token transfer. */
      }
      continue;
    }
    if (!same(log.address, VAULT_ADDRESS)) continue;
    let event;
    try {
      event = decodeEventLog({
        abi: VAULT_ABI,
        data: log.data,
        topics: log.topics,
      });
    } catch {
      continue;
    }
    if (
      event.eventName !== "PositionOpened" &&
      event.eventName !== "PositionSold"
    )
      continue;
    if (!same(event.args.owner, plan.walletAddress)) continue;
    const step = plan.steps[receipts.length];
    if (!step || step.ticker !== event.args.ticker)
      throw new Error(
        "The batch receipt does not match the reviewed blueprint. Keep the batch ID for reconciliation.",
      );
    if (event.eventName === "PositionSold") {
      if (
        step.action !== "sell" ||
        !same(step.positionId, event.args.id) ||
        event.args.soldQuantity !== BigInt(step.positionQuantity) ||
        event.args.fractionBps !== tenThousand ||
        !event.args.fullyClosed ||
        event.args.payoutUSD !==
          (BigInt(step.positionQuantity) * wei(step.price)) / ten18 ||
        payout > event.args.payoutUSD
      )
        throw new Error(
          "The confirmed sale does not match the approved position.",
        );
      receipts.push({
        hash: receipt.transactionHash,
        positionId: event.args.id,
        ticker: step.ticker,
        quantity: decimal(event.args.soldQuantity),
        amount: decimal(payout),
        entryPrice: 0,
        fullyClosed: true,
      });
      payout = BigInt(0);
    } else {
      if (
        step.action !== "buy" ||
        event.args.usdCost !== wei(step.amount) ||
        event.args.entryPrice !== wei(step.price) ||
        event.args.initialTier !== 1 ||
        event.args.quantity !== (wei(step.amount) * ten18) / wei(step.price) ||
        openedIds.has(event.args.id.toLowerCase())
      )
        throw new Error(
          "The confirmed purchase does not match the approved blueprint.",
        );
      openedIds.add(event.args.id.toLowerCase());
      receipts.push({
        hash: receipt.transactionHash,
        positionId: event.args.id,
        ticker: step.ticker,
        quantity: decimal(event.args.quantity),
        amount: decimal(event.args.usdCost),
        entryPrice: decimal(event.args.entryPrice),
        fullyClosed: false,
      });
    }
  }
  if (receipts.length !== plan.steps.length || payout !== BigInt(0))
    throw new Error(
      "The chain receipt is missing reviewed building changes. Keep the batch ID and check confirmation again.",
    );
  return receipts;
}

/** Recovery only polls: it can never submit or sign another transaction. */
export async function confirmRebalanceBatch(
  provider: BatchProvider,
  plan: RebalancePlan,
  id: string,
  onHash?: (hash: Hex) => void,
): Promise<RebalanceReceipt[]> {
  const status = await walletClient(
    provider,
    plan.walletAddress,
  ).waitForCallsStatus({
    id,
    timeout: 60_000,
    pollingInterval: 2_000,
    throwOnFailure: false,
  });
  if (status.chainId !== BSC_TESTNET_CHAIN_ID || !status.atomic)
    throw new Error(
      "The wallet did not confirm an atomic BNB testnet batch. Keep its batch ID for reconciliation.",
    );
  if (status.status === "failure") {
    // 300: off-chain failure; 400: atomic revert. A 500/600 result may contain
    // partial execution and must stay locked rather than permit a duplicate send.
    if (
      (status.statusCode >= 300 &&
        status.statusCode < 400 &&
        !status.receipts?.length) ||
      (status.statusCode >= 400 &&
        status.statusCode < 500 &&
        status.receipts?.every((r) => r.status === "reverted"))
    )
      throw new RebalanceBatchRejected(
        "The atomic rebalance failed. No building changes were applied. Request a fresh blueprint.",
      );
    throw new Error(
      "The wallet reported an unexpected batch result. Keep the batch ID for reconciliation.",
    );
  }
  const hashes = [
    ...new Set(status.receipts?.map((r) => r.transactionHash.toLowerCase())),
  ];
  if (
    status.status !== "success" ||
    hashes.length !== 1 ||
    !/^0x[a-fA-F0-9]{64}$/.test(hashes[0])
  )
    throw new Error(
      "Waiting for the single atomic transaction receipt. Check confirmation again without signing.",
    );
  onHash?.(hashes[0] as Hex);
  const receipt = await getBscClient().waitForTransactionReceipt({
    hash: hashes[0] as Hex,
    confirmations: 1,
    timeout: 60_000,
  });
  if (!same(receipt.transactionHash, hashes[0]))
    onHash?.(receipt.transactionHash);
  return decodeRebalanceBatch(plan, receipt);
}
