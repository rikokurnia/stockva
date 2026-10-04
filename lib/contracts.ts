import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  parseAbi,
  getAddress,
} from "viem";
import { bscTestnet } from "viem/chains";

export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_RPC =
  "https://data-seed-prebsc-1-s1.binance.org:8545/";
export const BSC_TESTNET_RPC_LOGS = "https://bsc-testnet-rpc.publicnode.com";
export const BSC_EXPLORER_URL = "https://testnet.bscscan.com";

// Deployed & Verified Contracts on BSC Testnet
export const MOCK_USD_ADDRESS =
  "0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21" as const;
export const VAULT_ADDRESS =
  "0x1810b360e0a4d593117f0bfaf2e0939b2df5e415" as const;

export const bscAddressLink = (address: string) =>
  `${BSC_EXPLORER_URL}/address/${address}`;

export const bscTxLink = (hash: string) => `${BSC_EXPLORER_URL}/tx/${hash}`;

export const MOCK_USD_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function claimFaucet() external",
  "function lastFaucetClaim(address) view returns (uint256)",
  "function FAUCET_AMOUNT() view returns (uint256)",
  "event FaucetClaimed(address indexed recipient, uint256 amount)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const VAULT_ABI = parseAbi([
  "struct Position { bytes32 id; address owner; string ticker; uint256 usdCost; uint256 entryPrice; uint256 quantity; uint256 openedAt; uint8 buildingTier; bool active; }",
  "function paymentToken() view returns (address)",
  "function totalPositionsCount() view returns (uint256)",
  "function totalVolumeUSD() view returns (uint256)",
  "function positions(bytes32 id) view returns (bytes32 id, address owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint256 openedAt, uint8 buildingTier, bool active)",
  "function getUserPositionIds(address user) view returns (bytes32[])",
  "function getUserPositions(address user) view returns (Position[])",
  "function buyPosition(string ticker, uint256 usdAmount, uint256 entryPrice, uint8 initialTier) returns (bytes32 positionId)",
  "function buyPositionsBatch(string[] tickers, uint256[] usdAmounts, uint256[] entryPrices, uint8[] initialTiers) returns (bytes32[] positionIds)",
  "function updateTier(bytes32 positionId, uint8 newTier) external",
  "function sellPosition(bytes32 positionId, uint256 currentPrice, uint256 fractionBps) returns (uint256 payout)",
  "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
  "event PositionTierUpdated(bytes32 indexed id, address indexed owner, uint8 oldTier, uint8 newTier)",
  "event PositionSold(bytes32 indexed id, address indexed owner, string ticker, uint256 soldQuantity, uint256 payoutUSD, int256 pnlUSD, uint256 fractionBps, bool fullyClosed)",
]);

export type OnchainPosition = {
  id: `0x${string}`;
  owner: `0x${string}`;
  ticker: string;
  usdCost: bigint;
  entryPrice: bigint;
  quantity: bigint;
  openedAt: bigint;
  buildingTier: number;
  active: boolean;
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (
        event: string,
        handler: (...args: unknown[]) => void,
      ) => void;
    };
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && !!window.ethereum?.request;
}

const BSC_TESTNET_CHAIN_HEX = "0x61";

export async function ensureBscTestnet(): Promise<void> {
  if (!hasInjectedWallet()) throw new Error("No wallet found");
  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BSC_TESTNET_CHAIN_HEX }],
    });
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? (err as { code: unknown }).code
        : undefined;
    if (code === 4902) {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BSC_TESTNET_CHAIN_HEX,
            chainName: "BNB Smart Chain Testnet",
            nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
            rpcUrls: [BSC_TESTNET_RPC],
            blockExplorerUrls: [BSC_EXPLORER_URL],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectInjectedWallet(): Promise<`0x${string}`> {
  if (!hasInjectedWallet())
    throw new Error("MetaMask not found. Install it to connect.");
  await ensureBscTestnet();
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts?.length || !accounts[0])
    throw new Error("No accounts returned");
  return getAddress(accounts[0]);
}

/** Send a real on-chain claimFaucet tx. Caller must have connected + switched chain. */
export async function claimFaucetOnchain(
  account: `0x${string}`,
): Promise<`0x${string}`> {
  const { createWalletClient, custom } = await import("viem");
  const { bscTestnet } = await import("viem/chains");
  await ensureBscTestnet();
  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: custom(window.ethereum!),
  });
  const hash = await walletClient.writeContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: "claimFaucet",
    account,
    chain: bscTestnet,
  });
  const client = getBscClient();
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      timeout: 30_000,
    });
    return receipt.transactionHash ?? hash;
  } catch {
    return hash;
  }
}

/** Read current $mUSD token balance for a wallet address from BSC Testnet. */
export async function getMusdBalance(account: `0x${string}`): Promise<number> {
  try {
    const client = getBscClient();
    const balance = (await client.readContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "balanceOf",
      args: [account],
    })) as bigint;
    return Number(formatUnits(balance, 18));
  } catch {
    return 0;
  }
}

/** Read live on-chain vault positions for a wallet. */
export async function getOnchainPositions(
  user: `0x${string}`,
): Promise<OnchainPosition[]> {
  const client = getBscClient();
  return (await client.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getUserPositions",
    args: [user],
  })) as unknown as OnchainPosition[];
}

/** First block with vault + token activity (deploy tx). Bounds log queries. */
export const VAULT_DEPLOY_BLOCK = BigInt(134016336);

export type RecordBuildingInput = {
  ticker: string;
  usdAmount: number;
  entryPrice: number;
  initialTier?: number;
};

export type RecordBuildingResult = {
  hash: `0x${string}`;
  positionId: `0x${string}`;
};

const toWei = (n: number): bigint => {
  if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid amount");
  return parseUnits(n.toFixed(6), 18);
};

async function getClients(account: `0x${string}`) {
  const { createWalletClient, custom, createPublicClient, http } =
    await import("viem");
  const { bscTestnet } = await import("viem/chains");
  await ensureBscTestnet();
  const accounts = (await window.ethereum!.request({
    method: "eth_accounts",
  })) as string[];
  if (
    !accounts.some((address) => address.toLowerCase() === account.toLowerCase())
  )
    throw new Error(
      "Your wallet account changed. Reconnect the wallet that reviewed this plan.",
    );
  const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC, { timeout: 10_000, retryCount: 2 }),
  });
  const walletClient = createWalletClient({
    account,
    chain: bscTestnet,
    transport: custom(window.ethereum!),
  });
  return { publicClient, walletClient, bscTestnet };
}

/** A sale is signed by the position owner and never applied locally before mining. */
export async function sellBuildingOnchain(
  account: `0x${string}`,
  positionId: `0x${string}`,
  price: number,
  fractionBps: number,
  onStatus?: (hash?: `0x${string}`) => void,
): Promise<`0x${string}`> {
  if (
    !/^0x[a-fA-F0-9]{64}$/.test(positionId) ||
    !Number.isInteger(fractionBps) ||
    fractionBps < 1 ||
    fractionBps > 10000
  )
    throw new Error("Invalid position or sell percentage.");
  const {
    publicClient,
    walletClient,
    bscTestnet: chain,
  } = await getClients(account);
  const position = await publicClient.readContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "positions",
    args: [positionId],
  });
  if (!position[8] || position[1].toLowerCase() !== account.toLowerCase())
    throw new Error(
      "This position is closed or belongs to another wallet. Request a fresh plan.",
    );
  onStatus?.();
  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "sellPosition",
    args: [positionId, toWei(price), BigInt(fractionBps)],
    account,
    chain,
  });
  onStatus?.(hash);
  return hash;
}

export type RebalanceReceipt = {
  hash: `0x${string}`;
  positionId: `0x${string}`;
  ticker: string;
  quantity: number;
  amount: number;
  entryPrice: number;
  fullyClosed: boolean;
};

/** Decode vault events and the actual mUSD transfer, including capped payouts. */
export async function confirmedRebalanceReceipt(
  account: `0x${string}`,
  hash: `0x${string}`,
  action: "buy" | "sell",
  onCanonicalHash?: (hash: `0x${string}`) => void,
): Promise<RebalanceReceipt> {
  const { decodeEventLog } = await import("viem");
  const client = getBscClient();
  const original = await client.getTransaction({ hash });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 120_000,
    onReplaced: ({ transactionReceipt }) =>
      onCanonicalHash?.(transactionReceipt.transactionHash),
  });
  const canonicalHash = receipt.transactionHash;
  onCanonicalHash?.(canonicalHash);
  if (receipt.status !== "success")
    throw new Error(
      "The transaction reverted on BNB Testnet. No city change was applied.",
    );
  const tx = await client.getTransaction({ hash: canonicalHash });
  if (
    canonicalHash !== hash &&
    (tx.to?.toLowerCase() !== original.to?.toLowerCase() ||
      tx.input !== original.input ||
      tx.value !== original.value)
  )
    throw new Error(
      "The signed transaction was replaced or cancelled on-chain. No city change was applied; request a fresh signature.",
    );
  if (
    tx.from.toLowerCase() !== account.toLowerCase() ||
    tx.to?.toLowerCase() !== VAULT_ADDRESS.toLowerCase()
  )
    throw new Error(
      "This receipt does not belong to the reviewed wallet and vault.",
    );
  let result: RebalanceReceipt | undefined;
  let actualPayout = BigInt(0);
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() === MOCK_USD_ADDRESS.toLowerCase() &&
      action === "sell"
    ) {
      try {
        const event = decodeEventLog({
          abi: MOCK_USD_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (
          event.eventName === "Transfer" &&
          event.args.to.toLowerCase() === account.toLowerCase() &&
          event.args.from.toLowerCase() === VAULT_ADDRESS.toLowerCase()
        )
          actualPayout += event.args.value;
      } catch {
        /* unrelated token event */
      }
    }
    if (log.address.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) continue;
    try {
      const event = decodeEventLog({
        abi: VAULT_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (
        action === "buy" &&
        event.eventName === "PositionOpened" &&
        event.args.owner.toLowerCase() === account.toLowerCase()
      ) {
        result = {
          hash: canonicalHash,
          positionId: event.args.id,
          ticker: event.args.ticker,
          quantity: Number(formatUnits(event.args.quantity, 18)),
          amount: Number(formatUnits(event.args.usdCost, 18)),
          entryPrice: Number(formatUnits(event.args.entryPrice, 18)),
          fullyClosed: false,
        };
      }
      if (
        action === "sell" &&
        event.eventName === "PositionSold" &&
        event.args.owner.toLowerCase() === account.toLowerCase()
      ) {
        result = {
          hash: canonicalHash,
          positionId: event.args.id,
          ticker: event.args.ticker,
          quantity: Number(formatUnits(event.args.soldQuantity, 18)),
          amount: 0,
          entryPrice: 0,
          fullyClosed: event.args.fullyClosed,
        };
      }
    } catch {
      /* unrelated vault event */
    }
  }
  if (!result)
    throw new Error(
      "The receipt has no matching position event. Keep this hash and check City Hall before retrying.",
    );
  if (action === "sell") result.amount = Number(formatUnits(actualPayout, 18));
  return result;
}

/**
 * Record a placed stock building on-chain: approve mUSD if needed, then
 * buyPosition. Each step prompts a wallet signature (popup).
 */
export async function recordBuildingOnchain(
  account: `0x${string}`,
  input: RecordBuildingInput,
  onStatus?: (step: "approve" | "buy", hash?: `0x${string}`) => void,
): Promise<RecordBuildingResult> {
  const { decodeEventLog, parseAbiItem } = await import("viem");
  const { publicClient, walletClient, bscTestnet } = await getClients(account);
  const amountWei = toWei(input.usdAmount);
  const entryWei = toWei(input.entryPrice);

  const balance = (await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  if (balance < amountWei) {
    throw new Error(
      `Insufficient $mUSD balance. You have $${Number(formatUnits(balance, 18)).toLocaleString()} mUSD, but need $${Number(formatUnits(amountWei, 18)).toLocaleString()} mUSD. Claim 10,000 $mUSD from the Faucet in City Hall first.`,
    );
  }

  const allowance = (await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: "allowance",
    args: [account, VAULT_ADDRESS],
  })) as bigint;
  if (allowance < amountWei) {
    onStatus?.("approve");
    const approveHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, amountWei],
      account,
      chain: bscTestnet,
    });
    onStatus?.("approve", approveHash);
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    if (approveReceipt.status === "reverted") {
      throw new Error("mUSD approval transaction reverted on-chain.");
    }
  }

  onStatus?.("buy");
  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "buyPosition",
    args: [input.ticker, amountWei, entryWei, input.initialTier ?? 1],
    account,
    chain: bscTestnet,
  });
  onStatus?.("buy", hash);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    onReplaced: ({ transactionReceipt }) =>
      onStatus?.("buy", transactionReceipt.transactionHash),
  });
  if (receipt.transactionHash !== hash)
    onStatus?.("buy", receipt.transactionHash);
  if (receipt.status === "reverted") {
    throw new Error(
      `Transaction reverted on BSC Testnet (tx: ${hash.slice(0, 10)}…). Please ensure you have claimed $mUSD in City Hall.`,
    );
  }

  const openedEvent = parseAbiItem(
    "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
  );
  let positionId: `0x${string}` = "0x";
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [openedEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PositionOpened") {
        positionId = (decoded.args as { id: `0x${string}` }).id;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(positionId))
    throw new Error(
      "The signed transaction was replaced or cancelled on-chain. No city change was applied; request a fresh signature.",
    );
  return { hash: receipt.transactionHash, positionId };
}

export type BatchBuildingInput = {
  buildingId: string;
  ticker: string;
  usdAmount: number;
  entryPrice: number;
  initialTier?: number;
};

export type BatchRecordResult = {
  hash: `0x${string}`;
  positionIds: `0x${string}`[];
};

/**
 * Demo batch confirm: approve once (if needed), then record ALL queued
 * buildings in ONE buyPositionsBatch tx — a single wallet signature.
 */
export async function recordBuildingsBatch(
  account: `0x${string}`,
  items: BatchBuildingInput[],
  onStatus?: (step: "approve" | "buy", hash?: `0x${string}`) => void,
): Promise<BatchRecordResult> {
  if (!items.length) throw new Error("Nothing to confirm");
  const { decodeEventLog, parseAbiItem } = await import("viem");
  const { publicClient, walletClient, bscTestnet } = await getClients(account);
  const amounts = items.map((i) => toWei(i.usdAmount));
  const entries = items.map((i) => toWei(i.entryPrice));
  const tiers = items.map((i) => i.initialTier ?? 1);
  const total = amounts.reduce((sum, a) => sum + a, BigInt(0));

  const balance = (await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  if (balance < total) {
    throw new Error(
      `Insufficient $mUSD balance. You have $${Number(formatUnits(balance, 18)).toLocaleString()} mUSD, but need $${Number(formatUnits(total, 18)).toLocaleString()} mUSD for this batch. Claim from the Faucet in City Hall first.`,
    );
  }

  const allowance = (await publicClient.readContract({
    address: MOCK_USD_ADDRESS,
    abi: MOCK_USD_ABI,
    functionName: "allowance",
    args: [account, VAULT_ADDRESS],
  })) as bigint;
  if (allowance < total) {
    onStatus?.("approve");
    const approveHash = await walletClient.writeContract({
      address: MOCK_USD_ADDRESS,
      abi: MOCK_USD_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, total],
      account,
      chain: bscTestnet,
    });
    onStatus?.("approve", approveHash);
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    if (approveReceipt.status === "reverted") {
      throw new Error("mUSD approval transaction reverted on-chain.");
    }
  }

  onStatus?.("buy");
  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "buyPositionsBatch",
    args: [items.map((i) => i.ticker), amounts, entries, tiers],
    account,
    chain: bscTestnet,
  });
  onStatus?.("buy", hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error(
      `Batch transaction reverted on BSC Testnet (tx: ${hash.slice(0, 10)}…). Please ensure you have claimed $mUSD in City Hall.`,
    );
  }

  const openedEvent = parseAbiItem(
    "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
  );
  const positionIds: `0x${string}`[] = [];
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [openedEvent],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "PositionOpened") {
        positionIds.push((decoded.args as { id: `0x${string}` }).id);
      }
    } catch {
      continue;
    }
  }
  return { hash, positionIds };
}

/** History RPC: the default seed endpoint rejects eth_getLogs, so log
 * queries go to a secondary endpoint that supports them. */
export function getLogsClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC_LOGS, {
      timeout: 20_000,
      retryCount: 2,
    }),
  });
}

/** Page through history in chunks to stay under RPC limits. */
type RawLog = {
  args?: Record<string, unknown>;
  transactionHash?: `0x${string}` | null;
};
async function getLogsChunked(
  client: ReturnType<typeof getLogsClient>,
  args: Parameters<typeof client.getLogs>[0],
  span = BigInt(20000),
): Promise<RawLog[]> {
  const latest = await client.getBlockNumber();
  const pages: Promise<unknown>[] = [];
  for (
    let from = VAULT_DEPLOY_BLOCK;
    from <= latest;
    from += span + BigInt(1)
  ) {
    const to = from + span > latest ? latest : from + span;
    pages.push(
      client.getLogs({ ...args, fromBlock: from, toBlock: to } as never),
    );
  }
  // Small concurrency to stay under RPC limits.
  const out: RawLog[] = [];
  for (let i = 0; i < pages.length; i += 3) {
    const chunk = (await Promise.all(pages.slice(i, i + 3))) as RawLog[][];
    for (const logs of chunk) out.push(...logs);
  }
  return out;
}

/** Map vault position id -> opening tx hash for an owner (real history). */ export async function getPositionOpenTxns(
  owner: `0x${string}`,
): Promise<Record<string, `0x${string}`>> {
  try {
    const { parseAbiItem } = await import("viem");
    const client = getLogsClient();
    const logs = await getLogsChunked(client, {
      address: VAULT_ADDRESS,
      event: parseAbiItem(
        "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
      ),
      args: { owner },
    });
    const map: Record<string, `0x${string}`> = {};
    for (const log of logs) {
      const id = log.args?.id as `0x${string}` | undefined;
      if (id && log.transactionHash)
        map[id.toLowerCase()] = log.transactionHash;
    }
    return map;
  } catch {
    return {};
  }
}

/** Recent faucet claim tx hashes for a wallet (real history). */
export async function getFaucetTxns(
  recipient: `0x${string}`,
  limit = 5,
): Promise<`0x${string}`[]> {
  try {
    const { parseAbiItem } = await import("viem");
    const client = getLogsClient();
    const logs = await getLogsChunked(client, {
      address: MOCK_USD_ADDRESS,
      event: parseAbiItem(
        "event FaucetClaimed(address indexed recipient, uint256 amount)",
      ),
      args: { recipient },
    });
    return logs
      .map((l) => l.transactionHash)
      .filter((h): h is `0x${string}` => !!h)
      .slice(-limit)
      .reverse();
  } catch {
    return [];
  }
}
/** Public read-only client for BSC Testnet queries */
export function getBscClient() {
  return createPublicClient({
    chain: bscTestnet,
    transport: http(BSC_TESTNET_RPC, {
      timeout: 10_000,
      retryCount: 3,
    }),
  });
}

export type OnChainVaultStats = {
  totalPositions: number;
  totalVolume: number;
  vaultReserves: number;
  faucetAmount: number;
  verified: boolean;
};

/**
 * Fetch live on-chain stats from BSC Testnet
 */
export async function getLiveVaultStats(): Promise<OnChainVaultStats | null> {
  try {
    const client = getBscClient();
    const [positionsCount, volumeWei, reservesWei] = await Promise.all([
      client.readContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "totalPositionsCount",
      }),
      client.readContract({
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        functionName: "totalVolumeUSD",
      }),
      client.readContract({
        address: MOCK_USD_ADDRESS,
        abi: MOCK_USD_ABI,
        functionName: "balanceOf",
        args: [VAULT_ADDRESS],
      }),
    ]);

    return {
      totalPositions: Number(positionsCount),
      totalVolume: Number(formatUnits(volumeWei, 18)),
      vaultReserves: Number(formatUnits(reservesWei, 18)),
      faucetAmount: 10_000,
      verified: true,
    };
  } catch (err) {
    console.warn("Failed to query live BSC vault stats:", err);
    return null;
  }
}
