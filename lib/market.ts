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
  const now = Date.now();
  return Array.from({ length: 168 }, (_, i) => {
    const time = now - (168 - i) * 3600000;
    const wave = Math.sin(i * 0.12) * 0.012 + Math.cos(i * 0.06) * 0.008;
    const trend = ((i - 84) / 168) * 0.025;
    const p = price * (1 + trend + wave);
    const spread = Math.sin(i * 0.4) * 0.0018;
    return {
      time,
      token: Number((p * (1 + spread)).toFixed(2)),
      benchmark: Number(p.toFixed(2)),
    };
  });
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
