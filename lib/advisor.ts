export type ChatMsg = { role: "user" | "guide"; text: string };

export type Holding = {
  ticker: string;
  name?: string;
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

export function asSnapshot(value: unknown): Snapshot {
  if (typeof value !== "object" || value === null) return {};
  const s = value as Record<string, unknown>;
  const holdings = Array.isArray(s.holdings)
    ? (s.holdings as Holding[])
        .filter((h) => h && typeof h.ticker === "string")
        .slice(0, 20)
    : [];
  return {
    cash: typeof s.cash === "number" ? s.cash : undefined,
    totalValue: typeof s.totalValue === "number" ? s.totalValue : undefined,
    holdings,
    onchainCount:
      typeof s.onchainCount === "number" ? s.onchainCount : undefined,
    walletConnected: s.walletConnected === true,
    marketNote:
      typeof s.marketNote === "string"
        ? s.marketNote.slice(0, 200)
        : undefined,
  };
}

export function buildSystemPrompt(snap: Snapshot): string {
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
