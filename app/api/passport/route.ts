import { NextRequest, NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import type { Passport } from "../../../lib/market";
const explorers: Record<string, string> = {
  Ethereum: "https://etherscan.io/token/",
  BinanceSmartChain: "https://bscscan.com/token/",
  Solana: "https://solscan.io/token/",
  Arbitrum: "https://arbiscan.io/token/",
  Mantle: "https://mantlescan.xyz/token/",
  Optimism: "https://optimistic.etherscan.io/token/",
  Ink: "https://explorer.inkonchain.com/token/",
};
async function get(path: string) {
  const r = await fetch(`https://api.xstocks.fi/api/v2/public/${path}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 300 },
  });
  if (!r.ok) throw Error();
  return r.json();
}
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  if (!assets.some((a) => a.ticker === ticker))
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  const symbol = `${ticker.replace(".", "")}x`;
  const result: Passport = {
    fetchedAt: new Date().toISOString(),
    deployments: [],
  };
  const [asset, reserves] = await Promise.allSettled([
    get(`assets/${symbol}`),
    get(`proof-of-reserves/${symbol}`),
  ]);
  if (
    asset.status === "fulfilled" &&
    asset.value.symbol === symbol &&
    asset.value.underlyingSymbol?.replace(".", "") === ticker.replace(".", "")
  ) {
    const data = asset.value;
    result.name = typeof data.name === "string" ? data.name : symbol;
    result.symbol = symbol;
    if (typeof data.logo === "string") result.logo = data.logo;
    if (/^CH\d{10}$/.test(data.isin)) result.isin = data.isin;
    result.exchange = data.trading?.exchange?.name;
    result.period = data.trading?.currentPeriod;
    result.nextChangeAt = data.trading?.nextChangeAt;
    result.halted = data.isTradingHalted === true;
    result.deployments = (
      Array.isArray(data.deployments) ? data.deployments : []
    )
      .flatMap((d: { network: unknown; address: unknown }) => {
        if (
          typeof d.network !== "string" ||
          typeof d.address !== "string" ||
          !/^[a-zA-Z0-9_-]{20,100}$/.test(d.address)
        )
          return [];
        return [
          {
            network: d.network,
            address: d.address,
            explorer: explorers[d.network]
              ? `${explorers[d.network]}${encodeURIComponent(d.address)}`
              : undefined,
          },
        ];
      })
      .sort(
        (a: { network: string }, b: { network: string }) =>
          Number(b.network === "BinanceSmartChain") -
          Number(a.network === "BinanceSmartChain"),
      );
  } else
    result.error =
      "Issuer metadata unavailable for this asset. No contract or rights are inferred.";
  if (reserves.status === "fulfilled" && reserves.value.symbol === symbol) {
    const data = reserves.value,
      held = Number(data.sharesHeld),
      supply = Number(data.circulatingSupply);
    if (
      Number.isFinite(held) &&
      held >= 0 &&
      Number.isFinite(supply) &&
      supply > 0 &&
      Number.isFinite(Date.parse(data.timestamp))
    )
      result.reserve = {
        timestamp: data.timestamp,
        sharesHeld: held,
        circulatingSupply: supply,
        providers: Array.isArray(data.holdings)
          ? [
              ...new Set<string>(
                data.holdings
                  .map((h: { provider: string }) => h.provider)
                  .filter((p: unknown) => typeof p === "string"),
              ),
            ]
          : [],
      };
  }
  return NextResponse.json(result);
}
