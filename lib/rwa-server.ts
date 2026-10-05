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

/** Full BSC RWA token list (one call, ~500 rows). Cached 60s, shared. */
let tokensCache: { at: number; rows: Record<string, unknown>[] } | undefined;
async function rwaTokenList(): Promise<Record<string, unknown>[]> {
  if (tokensCache && Date.now() - tokensCache.at < 60000)
    return tokensCache.rows;
  const rows = await rwaGet<Record<string, unknown>[]>(
    "/api/v1/dex/market/rwa/tokens",
  );
  const list = Array.isArray(rows) ? rows : [];
  tokensCache = { at: Date.now(), rows: list };
  return list;
}

const isBsc = (row: Record<string, unknown>) =>
  String(pick(row, /chainid|chain_id/i) ?? "") === CHAIN;

const underlyingOf = (row: Record<string, unknown>): string | null => {
  const direct = str(pick(row, /underlyingticker/i))?.toUpperCase() ?? null;
  return direct || null;
};

/** All BSC matches for a game ticker (Ondo + BStocks), Ondo first. */
function bscMatches(
  list: Record<string, unknown>[],
  ticker: string,
): Record<string, unknown>[] {
  const matches = list.filter(
    (r) => isBsc(r) && underlyingOf(r) === ticker,
  );
  const rank = (r: Record<string, unknown>) =>
    str(pick(r, /platformid|platform/i))?.toLowerCase() === "ondo" ? 0 : 1;
  return matches.sort((a, b) => rank(a) - rank(b));
}

/** Real session from a tokens-list statusInfo block. Exported for tests. */
export function sessionFromStatus(statusInfo: unknown): {
  session: RwaSessionState;
  referenceFrozen: boolean;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  marketStatus: string | null;
} {
  const info = (statusInfo ?? {}) as Record<string, unknown>;
  const reason = str(pick(info, /reasoncode/i)) ?? "";
  const marketStatus = str(pick(info, /marketstatus/i))?.toLowerCase() ?? null;
  const open =
    (pick(info, /openstate/i) as boolean | undefined) === true ||
    /^true$/i.test(String(pick(info, /openstate/i) ?? ""));
  if (/halt/i.test(reason))
    return {
      session: "halted",
      referenceFrozen: true,
      nextOpenAt: msToIso(pick(info, /nextopen/i)),
      nextCloseAt: msToIso(pick(info, /nextclose/i)),
      marketStatus,
    };
  if (!marketStatus && !open)
    return {
      session: "unknown",
      referenceFrozen: false,
      nextOpenAt: null,
      nextCloseAt: null,
      marketStatus,
    };
  const session: RwaSessionState = open ? "open" : "closed";
  return {
    session,
    // The per-share reference only moves during the regular session;
    // overnight/pre/post-market the on-chain leg trades alone.
    referenceFrozen: marketStatus !== null && marketStatus !== "regular",
    nextOpenAt: msToIso(pick(info, /nextopen/i)),
    nextCloseAt: msToIso(pick(info, /nextclose/i)),
    marketStatus,
  };
}

function parsePriceRow(
  ticker: string,
  row: Record<string, unknown>,
): RwaSpreadQuote | null {
  const contract = str(pick(row, /contractaddress/i));
  const onchain = num(pick(row, /^tokenprice$/i));
  const reference = num(pick(row, /^referenceprice$/i));
  if (!contract || onchain === null || reference === null) return null;
  const status = sessionFromStatus(pick(row, /statusinfo/i));
  return {
    ticker,
    contract,
    platform:
      str(pick(row, /platformid|platform/i))?.toLowerCase() ?? "unknown",
    onchain,
    reference,
    spreadBps: spreadBps(onchain, reference),
    onchainAt: msToIso(pick(row, /tokenpriceupdatedat|updatedat/i)),
    session: status.session,
    referenceFrozen: status.referenceFrozen,
    nextOpenAt: status.nextOpenAt,
    nextCloseAt: status.nextCloseAt,
    high52W: num(pick(row, /^high52w$/i)),
    low52W: num(pick(row, /^low52w$/i)),
  };
}

/** Batch on-chain vs reference quotes for game tickers (one list call). */
export async function rwaSpreadQuotes(
  tickers: string[],
): Promise<RwaSpreadQuote[]> {
  const list = await rwaTokenList();
  const out: RwaSpreadQuote[] = [];
  for (const ticker of tickers) {
    const [primary] = bscMatches(list, ticker);
    if (!primary) continue;
    const parsed = parsePriceRow(ticker, primary);
    if (parsed) out.push(parsed);
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
    const overnight =
      state === "open" && quotes.every((q) => q.referenceFrozen);
    return {
      state,
      label:
        sessionLabel(state, nextOpenAt, nextCloseAt) +
        (overnight ? " · overnight, ref frozen" : ""),
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
  const list = await rwaTokenList();
  const matches = bscMatches(list, ticker);
  if (!matches.length) return null;
  const primary = matches[0];
  const platformOf = (m: Record<string, unknown>) =>
    str(pick(m, /platformid|platform/i))?.toLowerCase() ?? "rwa";
  const company: RwaCompany = {
    ticker,
    name: str(pick(primary, /underlyingname/i)) ?? undefined,
    symbol: str(pick(primary, /tokensymbol|symbol/i)) ?? undefined,
    platform: platformOf(primary),
    contracts: matches.map((m) => ({
      chain: `BSC · ${platformOf(m)}`,
      address: str(pick(m, /contractaddress/i)) ?? "",
    })),
  };
  const contract = str(pick(primary, /contractaddress/i)) ?? "";
  const oneRow = (data: unknown): Record<string, unknown> | null => {
    if (Array.isArray(data)) {
      const [first] = data;
      return first && typeof first === "object"
        ? (first as Record<string, unknown>)
        : null;
    }
    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  };
  try {
    const row = oneRow(
      await rwaGet<unknown>("/api/v1/dex/market/rwa/underlying-profile", {
        binanceChainId: CHAIN,
        tokenContractAddress: contract,
      }),
    );
    if (row) {
      company.name =
        str(pick(row, /underlyingfullname|companyname|^name$/i)) ??
        company.name;
      company.symbol =
        str(pick(row, /underlyingsymbol|symbol|ticker/i)) ?? company.symbol;
      company.sector = str(pick(row, /sector|industry/i)) ?? undefined;
      company.tokenToShareRatio =
        str(pick(row, /tokentoshare/i)) ?? undefined;
      const info = oneRow(pick(row, /companyinfo/i));
      if (info) {
        company.website = str(pick(info, /website/i)) ?? undefined;
        company.description =
          str(pick(info, /description/i)) ?? undefined;
        if (!company.sector)
          company.sector = str(pick(info, /industry/i)) ?? undefined;
      }
      const protections = oneRow(pick(row, /protections/i));
      if (protections) {
        const attestations: { label: string; url: string }[] = [];
        for (const [key, label] of [
          ["dailyattestation", "Daily attestation"],
          ["monthlyattestation", "Monthly attestation"],
        ] as const) {
          const entry = oneRow(pick(protections, new RegExp(key, "i")));
          const url = entry ? str(pick(entry, /url/i)) : null;
          if (url) attestations.push({ label, url });
        }
        if (attestations.length) company.attestations = attestations;
      }
    }
  } catch {
    /* profile shape differs — list row + spread still stand */
  }
  const spread = parsePriceRow(ticker, primary);
  try {
    const market = oneRow(
      pick(
        oneRow(
          await rwaGet<unknown>("/api/v1/dex/market/rwa/underlying-market", {
            binanceChainId: CHAIN,
            tokenContractAddress: contract,
          }),
        ) ?? {},
        /marketdata/i,
      ),
    );
    if (market) {
      if (spread) {
        spread.high52W = num(pick(market, /^high52w$/i)) ?? spread.high52W;
        spread.low52W = num(pick(market, /^low52w$/i)) ?? spread.low52W;
      }
    }
  } catch {
    /* 52-week range stays empty */
  }
  company.spread = spread;
  return company;
}

/**
 * Official Binance baskets from /rwa/tokens. The sector-tab filter param is
 * not documented discoverably, so tabs are grouped from real row fields:
 * platform (Ondo / BStocks), asset type (stocks vs funds), and tags (alpha).
 */
export async function rwaSectorTabs(
  knownTickers?: Set<string>,
): Promise<RwaSectorTab[]> {
  const list = await rwaTokenList();
  const known = knownTickers ?? new Set<string>();
  const groups = new Map<string, Set<string>>();
  const add = (label: string, ticker: string | null) => {
    if (!ticker) return;
    if (!groups.has(label)) groups.set(label, new Set());
    groups.get(label)!.add(ticker);
  };
  for (const row of list) {
    if (!isBsc(row)) continue;
    // Prefer the canonical underlying ticker; fall back to suffix stripping.
    const ticker =
      str(pick(row, /underlyingticker/i))?.toUpperCase() ??
      underlyingTicker(str(pick(row, /symbol/i)) ?? "", known);
    if (!ticker || (known.size > 0 && !known.has(ticker))) continue;
    const platform = str(pick(row, /platformid|platform/i))?.toLowerCase();
    add(platform === "ondo" ? "Ondo" : platform === "bstock" ? "BStocks" : "RWA", ticker);
    if (String(pick(row, /assettype/i) ?? "") === "3")
      add("Funds & ETFs", ticker);
    const tags = pick(row, /^tags$/i);
    if (Array.isArray(tags) && tags.map(String).map((t) => t.toLowerCase()).includes("alpha"))
      add("Alpha picks", ticker);
  }
  return [...groups.entries()]
    .map(([label, set]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      tickers: [...set],
    }))
    .filter((g) => g.tickers.length > 0);
}
