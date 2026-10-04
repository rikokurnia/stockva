export type CityTransaction = {
  hash: string;
  kind: "placement" | "faucet";
  tickers: string[];
  at?: number;
  source: "wallet" | "city";
};
export function stamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not available";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
/** One batch hash is one transaction, even when several buildings reference it. */
export function transactionHistory(rows: CityTransaction[]): CityTransaction[] {
  const map = new Map<string, CityTransaction>();
  for (const row of rows) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(row.hash)) continue;
    const key = row.hash.toLowerCase(),
      previous = map.get(key);
    map.set(key, {
      ...row,
      hash: key,
      tickers: [...new Set([...(previous?.tickers ?? []), ...row.tickers])],
      at: previous?.at ?? row.at,
      source: previous?.source === "wallet" ? "wallet" : row.source,
    });
  }
  return [...map.values()].sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}
export function validateBundle(
  tickers: string[],
  amounts: Record<string, string>,
  available: string[],
  cash: number,
) {
  const unique = [...new Set(tickers)],
    errors: Record<string, string> = {};
  for (const ticker of unique) {
    const text = amounts[ticker]?.trim() ?? "";
    if (!available.includes(ticker))
      errors[ticker] = "Already built or not available for a building bundle.";
    else if (
      !/^\d+(?:\.\d{1,2})?$/.test(text) ||
      !Number.isFinite(Number(text)) ||
      Number(text) < 1
    )
      errors[ticker] = "Enter at least $1, with up to two decimal places.";
  }
  const total = unique.reduce(
    (sum, ticker) => sum + (errors[ticker] ? 0 : Number(amounts[ticker])),
    0,
  );
  const error = !unique.length
    ? "Choose at least one company."
    : Object.keys(errors).length
      ? "Fix the highlighted amounts before placing your bundle."
      : total > cash
        ? "Your bundle exceeds available city cash. Lower the amounts."
        : "";
  return {
    tickers: unique,
    total,
    errors,
    error,
    valid: !error && Number.isFinite(cash),
  };
}
