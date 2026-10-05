import { NextResponse } from "next/server";
import { assets } from "../../../../lib/city";
import { rwaCompany, rwaConfigured } from "../../../../lib/rwa-server";
export const runtime = "nodejs";
const cache = new Map<string, { at: number; body: unknown }>();
/** Company profile + BSC contracts + live spread for one ticker. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!assets.some((a) => a.ticker === ticker))
    return NextResponse.json({ available: false }, { status: 400 });
  if (!rwaConfigured()) return NextResponse.json({ available: false });
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < 300000)
    return NextResponse.json(hit.body);
  try {
    const company = await rwaCompany(ticker);
    if (!company)
      return NextResponse.json({ available: false, ticker });
    const body = {
      available: true,
      fetchedAt: new Date().toISOString(),
      ...company,
    };
    cache.set(ticker, { at: Date.now(), body });
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      ticker,
      error: error instanceof Error ? error.message : "RWA unavailable",
    });
  }
}
