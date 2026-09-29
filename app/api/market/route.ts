import { NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import { fallbackFeed, type MarketFeed } from "../../../lib/market";
export const runtime = "nodejs";
let cache: { at: number; feed: MarketFeed } | undefined;
async function get(path: string) {
  const response = await fetch(`https://api.kraken.com/0/public/${path}`, {
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error("Provider unavailable");
  const data = await response.json();
  if (data.error?.length || !data.result)
    throw new Error("Provider unavailable");
  return data.result;
}
export async function GET() {
  if (cache && Date.now() - cache.at < 60000)
    return NextResponse.json(cache.feed);
  const feed = fallbackFeed();
  try {
    const [pairs, tickers] = await Promise.all([
      get("AssetPairs?aclass_base=tokenized_asset"),
      get("Ticker?asset_class=tokenized_asset"),
    ]);
    for (const asset of assets) {
      const matches = Object.entries(pairs).filter(([, raw]) => {
        const p = raw as {
          base?: string;
          quote?: string;
          aclass_base?: string;
        };
        return (
          p.aclass_base === "tokenized_asset" &&
          p.base?.toUpperCase() === `${asset.ticker.replace(".", "")}X` &&
          ["ZUSD", "USD"].includes(p.quote ?? "")
        );
      });
      for (const [key, raw] of matches) {
        const p = raw as { altname: string; base: string };
        const t = tickers[key] ?? tickers[p.altname];
        const price = Number(t?.c?.[0]);
        const open = Number(t?.o);
        if (!Number.isFinite(price) || price <= 0) continue;
        feed.quotes[asset.ticker] = {
          ticker: asset.ticker,
          price,
          change: open > 0 ? (price / open - 1) * 100 : 0,
          source: "Kraken xStocks · last trade",
          status: "live",
          fetchedAt: feed.fetchedAt,
          pair: key,
          tokenName: p.base,
        };
        break;
      }
    }
    if (!Object.values(feed.quotes).some((q) => q.status === "live"))
      throw new Error("No matching quotes");
    if (cache)
      for (const [ticker, q] of Object.entries(cache.feed.quotes)) {
        if (
          feed.quotes[ticker]?.status === "fallback" &&
          q.status !== "fallback"
        )
          feed.quotes[ticker] = { ...q, status: "stale" };
      }
    cache = { at: Date.now(), feed };
  } catch {
    feed.error =
      "Live provider unavailable. Retry shortly; fallback prices are illustrative.";
    if (cache)
      for (const [ticker, q] of Object.entries(cache.feed.quotes))
        if (q.status === "live")
          feed.quotes[ticker] = { ...q, status: "stale" };
  }
  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
