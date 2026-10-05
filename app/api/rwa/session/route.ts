import { NextResponse } from "next/server";
import { assets } from "../../../../lib/city";
import { rwaConfigured, rwaSession } from "../../../../lib/rwa-server";
export const runtime = "nodejs";
let cache: { at: number; body: unknown } | undefined;
/** US-market session (open/closed/halted + next open/close) for the clock. */
export async function GET() {
  if (!rwaConfigured())
    return NextResponse.json({
      state: "unknown",
      label: "Market session unknown · RWA key not set",
      nextOpenAt: null,
      nextCloseAt: null,
      provenance: "unavailable",
      fetchedAt: new Date().toISOString(),
    });
  if (cache && Date.now() - cache.at < 60000)
    return NextResponse.json(cache.body);
  const body = await rwaSession(assets.map((a) => a.ticker));
  cache = { at: Date.now(), body };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
