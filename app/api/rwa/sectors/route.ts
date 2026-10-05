import { NextResponse } from "next/server";
import { assets } from "../../../../lib/city";
import { rwaConfigured, rwaSectorTabs } from "../../../../lib/rwa-server";
export const runtime = "nodejs";
let cache: { at: number; body: unknown } | undefined;
/** Official RWA sector tabs (Magnificent 7, AI Chips, ETF, …) with tickers. */
export async function GET() {
  if (!rwaConfigured()) return NextResponse.json({ available: false, tabs: [] });
  if (cache && Date.now() - cache.at < 3600000)
    return NextResponse.json(cache.body);
  try {
    const tabs = await rwaSectorTabs(new Set(assets.map((a) => a.ticker)));
    const body = {
      available: true,
      fetchedAt: new Date().toISOString(),
      tabs,
    };
    cache = { at: Date.now(), body };
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      tabs: [],
      error: error instanceof Error ? error.message : "RWA unavailable",
    });
  }
}
