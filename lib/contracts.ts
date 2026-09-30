import { createPublicClient, http, parseUnits, formatUnits, parseAbi } from "viem";
import { bscTestnet } from "viem/chains";

export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
export const BSC_EXPLORER_URL = "https://testnet.bscscan.com";

// Deployed & Verified Contracts on BSC Testnet
export const MOCK_USD_ADDRESS = "0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21" as const;
export const VAULT_ADDRESS = "0xc5456674Fb80Dc2DCA3eDd41c350EF4bbA49B849" as const;

export const bscAddressLink = (address: string) =>
  `${BSC_EXPLORER_URL}/address/${address}`;

export const bscTxLink = (hash: string) =>
  `${BSC_EXPLORER_URL}/tx/${hash}`;

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
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]);

export const VAULT_ABI = parseAbi([
  "struct Position { bytes32 id; address owner; string ticker; uint256 usdCost; uint256 entryPrice; uint256 quantity; uint256 openedAt; uint8 buildingTier; bool active; }",
  "function paymentToken() view returns (address)",
  "function totalPositionsCount() view returns (uint256)",
  "function totalVolumeUSD() view returns (uint256)",
  "function positions(bytes32 id) view returns (bytes32 id, address owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint256 openedAt, uint8 buildingTier, bool active)",
  "function getUserPositions(address user) view returns (bytes32[] ids, Position[] memory pos)",
  "function buyPosition(string ticker, uint256 usdAmount, uint256 entryPrice, uint8 initialTier) returns (bytes32 positionId)",
  "function updateTier(bytes32 positionId, uint8 newTier) external",
  "function sellPosition(bytes32 positionId, uint256 currentPrice, uint256 fractionBps) returns (uint256 payout)",
  "event PositionOpened(bytes32 indexed id, address indexed owner, string ticker, uint256 usdCost, uint256 entryPrice, uint256 quantity, uint8 initialTier)",
  "event PositionTierUpdated(bytes32 indexed id, address indexed owner, uint8 oldTier, uint8 newTier)",
  "event PositionSold(bytes32 indexed id, address indexed owner, string ticker, uint256 soldQuantity, uint256 payoutUSD, int256 pnlUSD, uint256 fractionBps, bool fullyClosed)"
]);

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
