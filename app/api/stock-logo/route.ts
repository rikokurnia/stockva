import { NextRequest, NextResponse } from "next/server";
import {
  stockLogoApiUrl,
  rwaLogoApiUrl,
  stockLogoUrl,
  rwaLogoUrl,
  assets,
} from "../../../lib/city";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get("ticker") ?? "";
  const type = searchParams.get("type") === "rwa" ? "rwa" : "stock";
  const redirect = searchParams.get("redirect") === "true";

  if (!ticker) {
    return NextResponse.json(
      { error: "Ticker parameter is required" },
      { status: 400 },
    );
  }

  const asset = assets.find(
    (a) => a.ticker.toLowerCase() === ticker.toLowerCase(),
  );
  const primaryApi =
    type === "rwa" ? rwaLogoApiUrl(ticker) : stockLogoApiUrl(ticker);
  const localUrl = type === "rwa" ? rwaLogoUrl(ticker) : stockLogoUrl(ticker);

  if (redirect) {
    return NextResponse.redirect(primaryApi, { status: 307 });
  }

  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    name: asset?.name ?? ticker.toUpperCase(),
    sector: asset?.sector ?? "Unknown",
    type,
    localUrl,
    apiUrl: primaryApi,
    provider: type === "rwa" ? "xStocks / Backed Fi" : "Parqet Stock CDN",
    tokenSymbol: `${ticker.replace(/\./g, "")}x`,
  });
}
