import { NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import { fallbackFeed, type MarketFeed } from "../../../lib/market";
import { rwaConfigured, rwaSession, rwaSpreadQuotes } from "../../../lib/rwa-server";
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
async function xstocksIndicative(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.xstocks.fi/api/v2/public/assets/${symbol}/price-data`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const price = Number(data?.quote);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function yahooUnderlying(
  ticker: string,
): Promise<{ price: number; change: number } | null> {
  try {
    const symbol = encodeURIComponent(ticker.replace(".", "-"));
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0" },
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const closes = result?.indicators?.quote?.[0]?.close as unknown as
      number[] | undefined;
    const price = Number(meta?.regularMarketPrice);
    const prev = Number(meta?.chartPreviousClose);
    if (!Number.isFinite(price) || price <= 0) {
      const valid = (closes ?? []).filter((c) => Number.isFinite(c) && c > 0);
      const last = valid[valid.length - 1];
      const before = valid[valid.length - 2];
      if (!Number.isFinite(last) || last <= 0) return null;
      return {
        price: last,
        change: before > 0 ? (last / before - 1) * 100 : 0,
      };
    }
    return { price, change: prev > 0 ? (price / prev - 1) * 100 : 0 };
  } catch {
    return null;
  }
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
    // Fallback chain for tickers Kraken doesn't list (e.g. BLK, WMT):
    // 1) xStocks indicative token price (same issuer family),
    // 2) Yahoo underlying reference (honestly labeled, never illustrative).
    const missing = assets.filter(
      (a) => feed.quotes[a.ticker]?.status !== "live",
    );
    if (missing.length) {
      const indicative = await Promise.all(
        missing.map(async (a) => ({
          ticker: a.ticker,
          price: await xstocksIndicative(`${a.ticker.replace(".", "")}x`),
        })),
      );
      for (const { ticker, price } of indicative) {
        if (price === null || feed.quotes[ticker]?.status === "live") continue;
        feed.quotes[ticker] = {
          ticker,
          price,
          change: 0,
          source: "xStocks · indicative price",
          status: "live",
          fetchedAt: feed.fetchedAt,
          tokenName: `${ticker}x`,
        };
      }
      const stillMissing = missing.filter(
        (a) => feed.quotes[a.ticker]?.status !== "live",
      );
      if (stillMissing.length) {
        const underlying = await Promise.all(
          stillMissing.map(async (a) => ({
            ticker: a.ticker,
            quote: await yahooUnderlying(a.ticker),
          })),
        );
        for (const { ticker, quote } of underlying) {
          if (!quote || feed.quotes[ticker]?.status === "live") continue;
          feed.quotes[ticker] = {
            ticker,
            price: quote.price,
            change: quote.change,
            source: "Underlying reference · Yahoo",
            status: "live",
            fetchedAt: feed.fetchedAt,
          };
        }
      }
    }
    if (!Object.values(feed.quotes).some((q) => q.status === "live"))
      throw new Error("No matching quotes");
    // Best-effort RWA layer: on-chain vs reference spread + market session
    // from Binance Web3 RWA Data. Never breaks the xStocks/Yahoo chain.
    if (rwaConfigured()) {
      try {
        const [spreads, session] = await Promise.all([
          rwaSpreadQuotes(
            Object.values(feed.quotes)
              .filter((q) => q.status === "live")
              .map((q) => q.ticker),
          ),
          rwaSession(assets.map((a) => a.ticker)),
        ]);
        for (const spread of spreads) {
          const quote = feed.quotes[spread.ticker];
          if (!quote || quote.status !== "live") continue;
          quote.rwa = {
            onchain: spread.onchain,
            reference: spread.reference,
            spreadBps: spread.spreadBps,
            onchainAt: spread.onchainAt,
            session: spread.session,
            referenceFrozen: spread.referenceFrozen,
            platform: spread.platform,
            contract: spread.contract,
          };
        }
        feed.marketSession = session;
      } catch {
        /* RWA layer stays silent; core quotes stand on their own */
      }
    }
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
