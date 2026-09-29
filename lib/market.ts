import { assets } from "./city";
export type Quote = {
  ticker: string;
  price: number;
  change: number;
  source: string;
  status: "live" | "fallback" | "stale";
  fetchedAt: string | null;
  pair?: string;
  tokenName?: string;
};
export type MarketFeed = {
  quotes: Record<string, Quote>;
  fetchedAt: string;
  error?: string;
};
export type PricePoint = { time: number; token?: number; benchmark?: number };
export type HistoryFeed = {
  points: PricePoint[];
  benchmarkPrice?: number;
  benchmarkAt?: string;
  tokenAt?: string;
  tokenSource: string;
  benchmarkSource: string;
  simulated: boolean;
  exchange?: string;
};
export function fallbackFeed(): MarketFeed {
  return {
    fetchedAt: new Date().toISOString(),
    quotes: Object.fromEntries(
      assets.map((a) => [
        a.ticker,
        {
          ticker: a.ticker,
          price: a.price,
          change: a.change,
          source: "Illustrative fallback",
          status: "fallback",
          fetchedAt: null,
        },
      ]),
    ),
  };
}
// Stable illustrative series; never represented as observed trading history.
export function sampleHistory(price: number): PricePoint[] {
  return Array.from({ length: 32 }, (_, i) => ({
    time: Date.UTC(2025, 0, 2) + i * 3600000,
    token: price * (0.978 + i * 0.0007 + Math.sin(i * 1.7) * 0.004),
  }));
}
export type Passport = {
  fetchedAt: string;
  name?: string;
  symbol?: string;
  logo?: string;
  isin?: string;
  exchange?: string;
  period?: string;
  nextChangeAt?: string;
  halted?: boolean;
  deployments: { network: string; address: string; explorer?: string }[];
  reserve?: {
    timestamp: string;
    sharesHeld: number;
    circulatingSupply: number;
    providers: string[];
  };
  error?: string;
};
