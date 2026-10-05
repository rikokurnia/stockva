// Binance Web3 RWA Data — shared types + pure math.
// No secrets in this module: safe to import from client components.
// HTTP + signing live in lib/rwa-server.ts (server only).

export type RwaSessionState = "open" | "closed" | "halted" | "unknown";

export type RwaSpreadQuote = {
  ticker: string;
  contract: string;
  platform: string;
  onchain: number;
  reference: number;
  /** (onchain - reference) / reference * 10000. Positive = on-chain premium. */
  spreadBps: number;
  onchainAt: string | null;
  session: RwaSessionState;
  /** True while the underlying market is closed, so the reference is frozen. */
  referenceFrozen: boolean;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  high52W?: number | null;
  low52W?: number | null;
};

export type RwaSession = {
  state: RwaSessionState;
  label: string;
  referenceFrozen?: boolean;
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  /** "rwa" when derived from Binance RWA Data, "estimated" for clock fallback. */
  provenance: "rwa" | "estimated" | "unavailable";
  fetchedAt: string;
};

export type RwaCompany = {
  ticker: string;
  name?: string;
  symbol?: string;
  platform?: string;
  sector?: string;
  tokenToShareRatio?: string;
  website?: string;
  description?: string;
  attestations?: { label: string; url: string }[];
  contracts: { chain: string; address: string }[];
  spread?: RwaSpreadQuote | null;
};

export type RwaSectorTab = {
  id: string;
  label: string;
  /** Underlying tickers (e.g. NVDA) that intersect the game catalogue. */
  tickers: string[];
};

export const spreadBps = (onchain: number, reference: number) =>
  reference > 0 ? ((onchain - reference) / reference) * 10000 : 0;

const fmtTime = (iso: string | null) => {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function sessionLabel(
  state: RwaSessionState,
  nextOpenAt: string | null,
  nextCloseAt: string | null,
): string {
  if (state === "open")
    return `US market open${nextCloseAt ? ` · closes ${fmtTime(nextCloseAt)}` : ""}`;
  if (state === "halted") return "Trading halted · corporate action";
  if (state === "closed")
    return `US market closed${nextOpenAt ? ` · opens ${fmtTime(nextOpenAt)}` : " · reference frozen"}`;
  return "Market session unknown";
}

/** Regular weekday session in New York; holidays require the provider's calendar. */
export function estimatedSession(now = new Date()): RwaSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)?.value;
  const day = part("weekday");
  const mins = Number(part("hour")) * 60 + Number(part("minute"));
  const state: RwaSessionState =
    day === "Sun" || day === "Sat"
      ? "closed"
      : mins >= 9 * 60 + 30 && mins < 16 * 60
        ? "open"
        : "closed";
  const fetchedAt = now.toISOString();
  return {
    state,
    label: sessionLabel(state, null, null),
    nextOpenAt: null,
    nextCloseAt: null,
    provenance: "estimated",
    fetchedAt,
  };
}

/** Map an RWA token symbol (NVDAon, TSLAB, AAPLx) to an underlying game ticker. */
export function underlyingTicker(symbol: string, known: Set<string>): string | null {
  const clean = symbol.trim().toUpperCase().replace(/[^A-Z._]/g, "");
  if (known.has(clean)) return clean;
  for (const suffix of ["ON", "X", "B"]) {
    if (clean.endsWith(suffix)) {
      const base = clean.slice(0, -suffix.length);
      if (known.has(base)) return base;
    }
  }
  return null;
}
