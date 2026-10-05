// Binance Web3 RWA Data — server-only HTTP + signing.
// Imported ONLY by API routes. Reads BINANCE_WEB3_API_KEY/SECRET from env;
// every export degrades to null/false when credentials are absent so the
// game keeps running on its xStocks/Yahoo chain.
//
// Signing (verified against the community Postman collection pre-request
// script): preHash = timestamp + METHOD + "/build" + path + ["?" + query] +
// body, signature = Base64(HMAC-SHA256(secret, preHash)).
import { createHmac } from "node:crypto";
import {
  estimatedSession,
  sessionLabel,
  spreadBps,
  underlyingTicker,
  type RwaCompany,
  type RwaSectorTab,
  type RwaSession,
  type RwaSessionState,
  type RwaSpreadQuote,
} from "./rwa.ts";

const BASE = "https://web3.binance.com/build";
const CHAIN = process.env.BINANCE_WEB3_RWA_CHAIN_ID ?? "56";

export const rwaConfigured = () =>
  Boolean(
    process.env.BINANCE_WEB3_API_KEY && process.env.BINANCE_WEB3_API_SECRET,
  );

function encodeQuery(params: Record<string, string>) {
  // Postman-style wire encoding: commas stay raw (address lists).
  return Object.entries(params)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%2C/gi, ",")}`,
    )
    .join("&");
}

/** Exported for tests: Base64(HMAC-SHA256(secret, ts + METHOD + path + body)). */
export function signRwaRequest(
  secret: string,
  timestamp: string,
  method: string,
  signedPath: string,
  body = "",
): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}${method}${signedPath}${body}`)
    .digest("base64");
}
async function rwaGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const key = process.env.BINANCE_WEB3_API_KEY;
  const secret = process.env.BINANCE_WEB3_API_SECRET;
  if (!key || !secret) throw new Error("RWA credentials missing");
  const ts = new Date().toISOString();
  const qs = encodeQuery(params);
  const signedPath = `/build${path}${qs ? `?${qs}` : ""}`;
  const sig = signRwaRequest(secret, ts, "GET", signedPath);
  const response = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    headers: {
      "X-OC-APIKEY": key,
      "X-OC-TIMESTAMP": ts,
      "X-OC-SIGN": sig,
      "X-OC-NONCE": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      "X-OC-RECV-WINDOW": "15000",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`RWA HTTP ${response.status}`);
  const body = (await response.json()) as {
    code?: number;
    msg?: string;
    data?: T;
  };
  if (body?.code !== 0)
    throw new Error(`RWA ${body?.code ?? "?"}: ${body?.msg ?? "error"}`);
  return body.data as T;
}

/** Case-insensitive key scan so minor schema renames don't break parsing. */
function pick(row: Record<string, unknown>, pattern: RegExp): unknown {
  for (const [k, v] of Object.entries(row))
    if (pattern.test(k)) return v;
  return undefined;
}
const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) && (n as number) > 0 ? (n as number) : null;
};
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
const msToIso = (v: unknown): string | null => {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (!Number.isFinite(n) || (n as number) <= 0) return null;
  const ms = (n as number) < 1e12 ? (n as number) * 1000 : (n as number);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

type Resolution = {
  contract: string;
  platform: string;
  name?: string;
  symbol?: string;
};
const resolutionCache = new Map<string, { at: number; value: Resolution | null }>();

/** Resolve a game ticker (NVDA) to its BSC RWA token contract via /rwa/search. */
export async function resolveRwaToken(
  ticker: string,
): Promise<Resolution | null> {
  const hit = resolutionCache.get(ticker);
  if (hit && Date.now() - hit.at < 24 * 3600 * 1000) return hit.value;
  let value: Resolution | null = null;
  try {
    const rows = await rwaGet<Record<string, unknown>[]>(
      "/api/v1/dex/market/rwa/search",
      { keyword: ticker },
    );
    const list = Array.isArray(rows) ? rows : [];
    const match =
      list.find(
        (r) =>
          String(pick(r, /chainid|chain_id/i) ?? "") === CHAIN &&
          str(pick(r, /contractaddress/i)),
      ) ??
      list.find((r) => str(pick(r, /contractaddress/i)));
    if (match) {
      value = {
        contract: str(pick(match, /contractaddress/i))!,
        platform:
          str(pick(match, /platformid|platform/i))?.toLowerCase() ?? "unknown",
        name: str(pick(match, /^name$/i)) ?? undefined,
        symbol: str(pick(match, /symbol/i)) ?? undefined,
      };
    }
  } catch {
    value = null;
  }
  resolutionCache.set(ticker, { at: Date.now(), value });
  return value;
}

function parsePriceRow(
  ticker: string,
  contract: string,
  platform: string,
  row: Record<string, unknown>,
): RwaSpreadQuote | null {
  const onchain = num(pick(row, /^tokenprice$/i));
  const reference = num(pick(row, /^referenceprice$/i));
  if (onchain === null || reference === null) return null;
  const sessionRaw = str(
    pick(row, /session|tradestatus|marketstatus|status/i),
  )?.toLowerCase();
  const session: RwaSessionState = sessionRaw
    ? /halt|pause|suspend/.test(sessionRaw)
      ? "halted"
      : /open|trad|live|normal/.test(sessionRaw)
        ? "open"
        : /clos/.test(sessionRaw)
          ? "closed"
          : "unknown"
    : "unknown";
  return {
    ticker,
    contract,
    platform,
    onchain,
    reference,
    spreadBps: spreadBps(onchain, reference),
    onchainAt: msToIso(pick(row, /tokenpriceupdatedat|updatedat/i)),
    session,
    referenceFrozen: session === "closed",
    nextOpenAt: msToIso(pick(row, /nextopen|openat|nextmarketopen/i)),
    nextCloseAt: msToIso(pick(row, /nextclose|closeat|nextmarketclose/i)),
    high52W: num(pick(row, /^high52w$/i)),
    low52W: num(pick(row, /^low52w$/i)),
  };
}

/** Batch on-chain vs reference quotes for game tickers (one call per 100). */
export async function rwaSpreadQuotes(
  tickers: string[],
): Promise<RwaSpreadQuote[]> {
  const resolved = (
    await Promise.all(
      tickers.map(async (t) => ({ t, r: await resolveRwaToken(t) })),
    )
  ).filter((x) => x.r);
  const out: RwaSpreadQuote[] = [];
  for (let i = 0; i < resolved.length; i += 100) {
    const chunk = resolved.slice(i, i + 100);
    try {
      const rows = await rwaGet<Record<string, unknown>[]>(
        "/api/v1/dex/market/rwa/price",
        {
          binanceChainId: CHAIN,
          tokenContractAddresses: chunk.map((x) => x.r!.contract).join(","),
        },
      );
      const byContract = new Map(
        (Array.isArray(rows) ? rows : []).map((r) => [
          str(pick(r, /contractaddress/i))?.toLowerCase(),
          r,
        ]),
      );
      for (const { t, r } of chunk) {
        const row = byContract.get(r!.contract.toLowerCase());
        if (!row) continue;
        const parsed = parsePriceRow(t, r!.contract, r!.platform, row);
        if (parsed) out.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return out;
}

/** Aggregate US-market session from spread rows, else estimated clock. */
export async function rwaSession(
  tickers: string[],
): Promise<RwaSession> {
  const now = new Date().toISOString();
  try {
    const quotes = await rwaSpreadQuotes(tickers.slice(0, 20));
    const states = quotes.map((q) => q.session);
    const state: RwaSessionState = states.includes("open")
      ? "open"
      : states.includes("halted") && !states.includes("open")
        ? "halted"
        : states.includes("closed")
          ? "closed"
          : "unknown";
    if (state === "unknown") return { ...estimatedSession(), fetchedAt: now };
    const nextOpenAt =
      quotes.map((q) => q.nextOpenAt).find(Boolean) ?? null;
    const nextCloseAt =
      quotes.map((q) => q.nextCloseAt).find(Boolean) ?? null;
    return {
      state,
      label: sessionLabel(state, nextOpenAt, nextCloseAt),
      nextOpenAt,
      nextCloseAt,
      provenance: "rwa",
      fetchedAt: now,
    };
  } catch {
    return { ...estimatedSession(), fetchedAt: now };
  }
}

/** Company profile + contracts + live spread for the RWA passport. */
export async function rwaCompany(ticker: string): Promise<RwaCompany | null> {
  const resolution = await resolveRwaToken(ticker);
  if (!resolution) return null;
  const company: RwaCompany = {
    ticker,
    name: resolution.name,
    symbol: resolution.symbol,
    platform: resolution.platform,
    contracts: [{ chain: `BSC (${CHAIN})`, address: resolution.contract }],
  };
  try {
    const rows = await rwaGet<Record<string, unknown>[]>(
      "/api/v1/dex/market/rwa/underlying-profile",
      {
        binanceChainId: CHAIN,
        tokenContractAddress: resolution.contract,
      },
    );
    const row = (Array.isArray(rows) ? rows : [])[0];
    if (row) {
      company.name =
        str(pick(row, /companyname|^name$/i)) ?? company.name;
      company.symbol =
        str(pick(row, /symbol|ticker/i)) ?? company.symbol;
      company.sector = str(pick(row, /sector|industry/i)) ?? undefined;
    }
  } catch {
    /* profile endpoint shape differs — contracts + spread still stand */
  }
  try {
    const [spread] = await rwaSpreadQuotes([ticker]);
    company.spread = spread ?? null;
  } catch {
    company.spread = null;
  }
  return company;
}

/** Official sector tabs (Magnificent 7, AI Chips, ETF, Buffett…) from /rwa/tokens. */
export async function rwaSectorTabs(
  knownTickers: Set<string>,
): Promise<RwaSectorTab[]> {
  const rows = await rwaGet<Record<string, unknown>[]>(
    "/api/v1/dex/market/rwa/tokens",
  );
  const list = Array.isArray(rows) ? rows : [];
  const groups = new Map<string, Set<string>>();
  for (const row of list) {
    const tab =
      str(pick(row, /sectortab|tab|sector|category/i)) ?? "Other";
    const ticker = underlyingTicker(
      str(pick(row, /symbol/i)) ?? "",
      knownTickers,
    );
    if (!ticker) continue;
    if (!groups.has(tab)) groups.set(tab, new Set());
    groups.get(tab)!.add(ticker);
  }
  return [...groups.entries()]
    .map(([label, set]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      tickers: [...set],
    }))
    .filter((g) => g.tickers.length > 0);
}
