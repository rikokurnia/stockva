import { NextRequest, NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import { type HistoryFeed, type PricePoint } from "../../../lib/market";
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset)
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  const pair = request.nextUrl.searchParams.get("pair");
  if (pair && !/^[A-Za-z0-9]{3,25}$/.test(pair))
    return NextResponse.json({ error: "Invalid pair" }, { status: 400 });
  const range = request.nextUrl.searchParams.get("range") ?? "1mo";
  const interval =
    request.nextUrl.searchParams.get("interval") ??
    (range === "1d"
      ? "2m"
      : range === "5d"
        ? "5m"
        : range === "1mo" || range === "3mo"
          ? "15m"
          : "60m");
  const krakenInterval =
    range === "1d" ? 5 : range === "5d" ? 15 : range === "1mo" ? 60 : 1440;

  const output: HistoryFeed = {
    points: [],
    simulated: false,
    tokenSource: "Token history unavailable",
    benchmarkSource: "Unavailable",
  };
  const [token, stock] = await Promise.allSettled([
    pair
      ? fetch(
          `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=${krakenInterval}&asset_class=tokenized_asset`,
          { signal: AbortSignal.timeout(8000), next: { revalidate: 60 } },
        ).then((r) => r.json())
      : Promise.resolve(null),
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replace(".", "-"))}?interval=${interval}&range=${range}`,
      {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      },
    ).then((r) => r.json()),
  ]);
  const points = new Map<number, PricePoint>();
  if (
    token.status === "fulfilled" &&
    token.value?.result &&
    !token.value.error?.length
  ) {
    const rows = Object.entries(token.value.result).find(
      ([key]) => key !== "last",
    )?.[1];
    if (Array.isArray(rows))
      for (const row of rows.slice(-720)) {
        const time = Number(row[0]) * 1000;
        const price = Number(row[4]);
        if (Number.isFinite(time) && Number.isFinite(price) && price > 0)
          points.set(time, { time, token: price });
      }
    if (points.size) {
      output.simulated = false;
      output.tokenSource =
        krakenInterval === 1440
          ? "Kraken · daily close"
          : "Kraken · token observation";
      output.tokenAt = new Date(Math.max(...points.keys())).toISOString();
    }
  }
  if (stock.status === "fulfilled") {
    const result = stock.value?.chart?.result?.[0];
    const price = Number(result?.meta?.regularMarketPrice);
    if (
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(result?.meta?.regularMarketTime)
    ) {
      output.benchmarkPrice = price;
      output.benchmarkAt = new Date(
        result.meta.regularMarketTime * 1000,
      ).toISOString();
      output.benchmarkSource = "Yahoo Finance · delayed reference";
      output.exchange = result.meta.exchangeName;
      result.timestamp?.forEach((time: number, i: number) => {
        const close = result.indicators?.quote?.[0]?.close?.[i];
        if (typeof close === "number" && Number.isFinite(close) && close > 0) {
          const key = time * 1000;
          const existing = points.get(key);
          points.set(key, {
            ...existing,
            time: key,
            benchmark: close,
          });
        }
      });
    }
  }
  output.points = [...points.values()].sort((a, b) => a.time - b.time);
  return NextResponse.json(output);
}
