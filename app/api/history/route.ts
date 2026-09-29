import { NextRequest, NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import {
  sampleHistory,
  type HistoryFeed,
  type PricePoint,
} from "../../../lib/market";
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  const asset = assets.find((a) => a.ticker === ticker);
  if (!asset)
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  const pair = request.nextUrl.searchParams.get("pair");
  if (pair && !/^[A-Za-z0-9]{3,25}$/.test(pair))
    return NextResponse.json({ error: "Invalid pair" }, { status: 400 });
  const output: HistoryFeed = {
    points: [],
    simulated: true,
    tokenSource: "Illustrative fallback",
    benchmarkSource: "Unavailable",
  };
  const [token, stock] = await Promise.allSettled([
    pair
      ? fetch(
          `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(pair)}&interval=60&asset_class=tokenized_asset`,
          { signal: AbortSignal.timeout(8000), next: { revalidate: 60 } },
        ).then((r) => r.json())
      : Promise.resolve(null),
    fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replace(".", "-"))}?interval=60m&range=5d`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 60 } },
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
      for (const row of rows.slice(-120)) {
        const time = Number(row[0]) * 1000;
        const price = Number(row[4]);
        if (Number.isFinite(time) && Number.isFinite(price) && price > 0)
          points.set(time, { time, token: price });
      }
    if (points.size) {
      output.simulated = false;
      output.tokenSource = "Kraken · hourly close";
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
          points.set(key, { ...points.get(key), time: key, benchmark: close });
        }
      });
    }
  }
  output.points = [...points.values()].sort((a, b) => a.time - b.time);
  if (!output.points.length) output.points = sampleHistory(asset.price);
  return NextResponse.json(output);
}
