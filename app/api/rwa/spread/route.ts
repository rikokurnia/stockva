import { NextResponse } from "next/server";
import { assets } from "../../../../lib/city";
import { rwaConfigured, rwaSpreadQuotes } from "../../../../lib/rwa-server";
export const runtime = "nodejs";
/** Batch on-chain vs reference spread for game tickers (Binance RWA Data). */
export async function GET(request: Request) {
  if (!rwaConfigured())
    return NextResponse.json({ available: false, quotes: {} });
  const { searchParams } = new URL(request.url);
  const tickers = (searchParams.get("tickers")?.split(",") ?? [])
    .map((t) => t.trim().toUpperCase())
    .filter((t) => assets.some((a) => a.ticker === t));
  const list = tickers.length ? tickers : assets.map((a) => a.ticker);
  try {
    const quotes = await rwaSpreadQuotes(list);
    const body = {
      available: true,
      fetchedAt: new Date().toISOString(),
      quotes: Object.fromEntries(quotes.map((q) => [q.ticker, q])),
    };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      quotes: {},
      error: error instanceof Error ? error.message : "RWA unavailable",
    });
  }
}
