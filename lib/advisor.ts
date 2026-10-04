export type ChatMsg = { role: "user" | "guide"; text: string };

export type Holding = {
  ticker: string;
  name?: string;
  sector?: string;
  units?: number;
  entry?: number;
  price?: number;
  value?: number;
  returnPct?: number;
  tier?: number;
  onchain?: boolean;
  active?: boolean;
};

export type Snapshot = {
  cash?: number;
  totalValue?: number;
  holdings?: Holding[];
  onchainCount?: number;
  walletConnected?: boolean;
  marketNote?: string;
};

export type HallAnalysis = {
  mode: "overview" | "basket" | "stress";
  template?: string;
  tickers?: string[];
  budget?: number;
  ticker?: string;
  shockPct?: number;
  impact?: number;
  after?: number;
};

const finite = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const validTicker = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9.^-]{1,12}$/.test(value);

export function asHallAnalysis(value: unknown): HallAnalysis | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (v.mode !== "overview" && v.mode !== "basket" && v.mode !== "stress")
    return undefined;
  return {
    mode: v.mode,
    template:
      typeof v.template === "string" ? v.template.slice(0, 64) : undefined,
    tickers: Array.isArray(v.tickers)
      ? v.tickers.filter(validTicker).slice(0, 12)
      : undefined,
    budget: finite(v.budget),
    ticker: validTicker(v.ticker) ? v.ticker : undefined,
    shockPct: finite(v.shockPct),
    impact: finite(v.impact),
    after: finite(v.after),
  };
}

export function asHistory(value: unknown): ChatMsg[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (m): m is ChatMsg =>
        typeof m === "object" &&
        m !== null &&
        ((m as ChatMsg).role === "user" || (m as ChatMsg).role === "guide") &&
        typeof (m as ChatMsg).text === "string",
    )
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1000) }))
    .slice(-6);
}

export function asSnapshot(value: unknown, holdingLimit = 20): Snapshot {
  if (typeof value !== "object" || value === null) return {};
  const s = value as Record<string, unknown>;
  const holdings = Array.isArray(s.holdings)
    ? (s.holdings as Holding[])
        .filter((h) => h && validTicker(h.ticker))
        .slice(0, Math.max(0, Math.min(40, holdingLimit)))
        .map((h) => ({
          ticker: h.ticker,
          name: typeof h.name === "string" ? h.name.slice(0, 80) : undefined,
          sector:
            typeof h.sector === "string" ? h.sector.slice(0, 50) : undefined,
          units: finite(h.units),
          entry: finite(h.entry),
          price: finite(h.price),
          value: finite(h.value),
          returnPct: finite(h.returnPct),
          tier: finite(h.tier),
          onchain: h.onchain === true,
          active: h.active !== false,
        }))
    : [];
  return {
    cash: finite(s.cash),
    totalValue: finite(s.totalValue),
    holdings,
    onchainCount: finite(s.onchainCount),
    walletConnected: s.walletConnected === true,
    marketNote:
      typeof s.marketNote === "string" ? s.marketNote.slice(0, 200) : undefined,
  };
}

export function buildSystemPrompt(snap: Snapshot, hall?: HallAnalysis): string {
  const lines: string[] = [
    "You are cokoo, the friendly island buddy for StockCity, an isometric world that visualizes a tokenized-stock portfolio as buildings on an island.",
    "Personality: kind, fun, and helpful. Warm and encouraging, a little playful, never sarcastic or condescending. Celebrate the user's progress.",
    "Answer in the user's language (default to clear, friendly English; use Bahasa Indonesia if the user writes in it). Keep replies under 120 words.",
    "Use ONLY the live portfolio snapshot below. Never invent holdings, prices, or transactions.",
    "Educational only: explain allocation, concentration, and risk in simple terms. Never promise returns, never give personal investment advice.",
  ];
  lines.push("--- LIVE SNAPSHOT ---");
  lines.push(
    `Treasury cash: ${snap.cash !== undefined ? `$${snap.cash.toFixed(2)}` : "unknown"}`,
  );
  lines.push(
    `Total stock value: ${snap.totalValue !== undefined ? `$${snap.totalValue.toFixed(2)}` : "unknown"}`,
  );
  lines.push(
    `Wallet: ${snap.walletConnected ? `connected, ${snap.onchainCount ?? 0} on-chain vault position(s)` : "not connected"}`,
  );
  if (snap.holdings?.length) {
    lines.push("Buildings:");
    for (const h of snap.holdings) {
      const parts = [
        h.ticker,
        h.name ?? "",
        h.sector ? `sector ${h.sector}` : "",
        h.units !== undefined ? `${h.units.toFixed(4)} units` : "",
        h.entry !== undefined ? `entry $${h.entry.toFixed(2)}` : "",
        h.price !== undefined ? `now $${h.price.toFixed(2)}` : "",
        h.value !== undefined ? `value $${h.value.toFixed(2)}` : "",
        h.returnPct !== undefined ? `return ${h.returnPct.toFixed(1)}%` : "",
        h.tier !== undefined ? `tier ${h.tier}` : "",
        h.onchain ? "on-chain" : "local-sim",
        h.active === false ? "closed" : "",
      ].filter(Boolean);
      lines.push(`- ${parts.join(" · ")}`);
    }
  } else {
    lines.push("Buildings: none yet (empty island).");
  }
  if (snap.marketNote) lines.push(`Market: ${snap.marketNote}`);
  if (hall) {
    lines.push("--- AGENT HALL RESEARCH TASK ---");
    lines.push(
      "Treat the snapshot as client-supplied local city data, NOT verified wallet balances or independent market research. A connected wallet does not verify these holdings.",
    );
    lines.push(
      "Reply in plain text with three short sections: Assessment, Key risk, Next step. No markdown. Explain the selected scenario below alongside the user's question. No trades, funds, alerts, or autonomous monitoring have been executed or scheduled.",
    );
    lines.push(
      "State allocation percentages precisely from the supplied values. Do not minimize risk or claim a position outweighs all other positions combined unless its allocation exceeds 50%. Distinguish stock value from treasury cash.",
    );
    if (hall.mode === "basket") {
      lines.push(
        `Unexecuted equal-weight basket: ${hall.template ?? "custom"}; assets: ${hall.tickers?.join(", ") ?? "none"}; budget: ${hall.budget === undefined ? "invalid or not set" : `$${hall.budget.toFixed(2)}`}. Each asset has equal weight. This is a starting template, not a recommendation.`,
      );
    } else if (hall.mode === "stress") {
      lines.push(
        `Hypothetical shock: ${hall.shockPct ?? 0}% on ${hall.ticker ?? "entire portfolio"}; modeled portfolio impact: $${(hall.impact ?? 0).toFixed(2)}; stock value after scenario: $${(hall.after ?? 0).toFixed(2)}. Treasury cash is unchanged. No correlations, fees, or slippage modeled. This is not a price prediction.`,
      );
    } else {
      lines.push(
        "Review portfolio and sector concentration using all the listed holdings. If empty, explain how to start exploring; do not invent a position.",
      );
    }
  }
  return lines.join("\n");
}

export function buildUserPrompt(
  system: string,
  history: ChatMsg[],
  message: string,
): string {
  const convo = history
    .map((m) => `${m.role === "user" ? "User" : "Advisor"}: ${m.text}`)
    .join("\n");
  return `${system}\n--- CONVERSATION ---\n${convo}\nUser: ${message}\nAdvisor:`;
}
