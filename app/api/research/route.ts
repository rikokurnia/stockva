import { NextRequest, NextResponse } from "next/server";
import { assets } from "../../../lib/city";
import { secFinancials, type AssetResearch } from "../../../lib/asset-research";
export const runtime = "nodejs";
const cache = new Map<string, { at: number; data: AssetResearch }>();
let companies:
  | { at: number; rows: Record<string, { cik_str: number; ticker: string }> }
  | undefined;
let companyRequest:
  Promise<Record<string, { cik_str: number; ticker: string }>> | undefined;
const inflight = new Map<string, Promise<AssetResearch>>();
type CompanyFinancials = {
  metrics: AssetResearch["financials"];
  name?: string;
  url: string;
  fetchedAt: string;
};
// SEC company-facts can exceed Next's 2MB response-cache limit. Keep only
// normalized figures in memory, never the full raw filing payload.
const financialCache = new Map<
  string,
  { at: number; data: CompanyFinancials }
>();
async function json(url: string, sec = false, largePayload = false) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    headers: {
      "User-Agent": sec
        ? process.env.SEC_USER_AGENT || "StockCity Research"
        : "Mozilla/5.0",
      Accept: "application/json",
    },
    ...(largePayload
      ? { cache: "no-store" as const }
      : { next: { revalidate: sec ? 3600 : 60 } }),
  });
  if (!response.ok) throw new Error("Provider unavailable");
  return response.json();
}
async function companyMap() {
  if (companies && Date.now() - companies.at < 86400000) return companies.rows;
  if (!companyRequest)
    companyRequest = json(
      "https://www.sec.gov/files/company_tickers.json",
      true,
    )
      .then((rows) => {
        companies = { at: Date.now(), rows };
        return rows;
      })
      .finally(() => {
        companyRequest = undefined;
      });
  return companyRequest;
}
async function fundamentals(ticker: string) {
  const saved = financialCache.get(ticker);
  if (saved && Date.now() - saved.at < 3600000) return saved.data;
  const rows = await companyMap();
  const company = Object.values(rows).find(
    (row) => row.ticker?.replace(/[-.]/g, "") === ticker.replace(/[-.]/g, ""),
  );
  if (!company || !Number.isInteger(company.cik_str)) return null;
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(company.cik_str).padStart(10, "0")}.json`;
  const data = await json(url, true, true);
  const normalized: CompanyFinancials = {
    metrics: secFinancials(data),
    name: data.entityName as string | undefined,
    url,
    fetchedAt: new Date().toISOString(),
  };
  financialCache.set(ticker, { at: Date.now(), data: normalized });
  return normalized;
}
async function load(ticker: string): Promise<AssetResearch> {
  const [market, financial] = await Promise.allSettled([
    json(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker.replace(".", "-"))}?interval=1d&range=5d`,
    ),
    fundamentals(ticker),
  ]);
  const result: AssetResearch = {
    ticker,
    fetchedAt: new Date().toISOString(),
    financials: [],
  };
  if (market.status === "fulfilled") {
    const meta = market.value?.chart?.result?.[0]?.meta;
    if (meta?.symbol === ticker.replace(".", "-")) {
      result.company = meta.longName ?? meta.shortName;
      result.currency = meta.currency;
      result.exchange = meta.fullExchangeName ?? meta.exchangeName;
      result.instrument = meta.instrumentType;
      for (const [target, source] of Object.entries({
        dayHigh: "regularMarketDayHigh",
        dayLow: "regularMarketDayLow",
        yearHigh: "fiftyTwoWeekHigh",
        yearLow: "fiftyTwoWeekLow",
        volume: "regularMarketVolume",
      }))
        if (
          typeof meta[source] === "number" &&
          Number.isFinite(meta[source]) &&
          meta[source] >= 0
        )
          Object.assign(result, { [target]: meta[source] });
      if (Number.isFinite(meta.regularMarketTime))
        result.benchmarkAt = new Date(
          meta.regularMarketTime * 1000,
        ).toISOString();
    } else result.marketError = "Underlying market statistics are unavailable.";
  } else
    result.marketError =
      "Underlying market statistics are unavailable. Retry shortly.";
  if (financial.status === "fulfilled" && financial.value?.metrics.length) {
    result.financials = financial.value.metrics;
    result.company = financial.value.name ?? result.company;
    result.financialSource = "SEC EDGAR · company filings";
    result.financialFetchedAt = financial.value.fetchedAt;
    result.financialUrl = financial.value.url;
  } else
    result.financialError =
      financial.status === "fulfilled" && !financial.value
        ? "No matching company filer. Funds and some international assets do not have comparable U.S. company financials."
        : "Company filing data is unavailable from SEC EDGAR. No financial values are estimated.";
  return result;
}
export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker") ?? "";
  if (!assets.some((asset) => asset.ticker === ticker))
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  const saved = cache.get(ticker);
  if (
    saved &&
    Date.now() - saved.at <
      (saved.data.financialError || saved.data.marketError ? 30000 : 300000)
  )
    return NextResponse.json(saved.data);
  let pending = inflight.get(ticker);
  if (!pending) {
    pending = load(ticker)
      .then((data) => {
        if (saved && !data.financials.length && data.financialError) {
          data.financials = saved.data.financials;
          data.financialSource = saved.data.financialSource;
          data.financialFetchedAt = saved.data.financialFetchedAt;
          data.financialUrl = saved.data.financialUrl;
          data.stale = saved.data.financials.length > 0;
        }
        cache.set(ticker, { at: Date.now(), data });
        return data;
      })
      .finally(() => inflight.delete(ticker));
    inflight.set(ticker, pending);
  }
  return NextResponse.json(await pending);
}
