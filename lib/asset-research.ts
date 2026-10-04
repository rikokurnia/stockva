/** Research values retain their reporting period; missing data never becomes zero. */
export type FinancialMetric = {
  label: string;
  value: number;
  unit: "USD" | "USD/share" | "ratio" | "percent";
  period?: string;
  filed?: string;
  url?: string;
};
export type AssetResearch = {
  ticker: string;
  fetchedAt: string;
  company?: string;
  currency?: string;
  exchange?: string;
  instrument?: string;
  dayHigh?: number;
  dayLow?: number;
  yearHigh?: number;
  yearLow?: number;
  volume?: number;
  benchmarkAt?: string;
  financials: FinancialMetric[];
  financialSource?: string;
  financialFetchedAt?: string;
  financialUrl?: string;
  financialError?: string;
  marketError?: string;
  stale?: boolean;
};
type SecFact = {
  val: number;
  start?: string;
  end: string;
  filed: string;
  form: string;
  accn?: string;
};
type SecCompany = {
  cik?: number;
  entityName?: string;
  facts?: { "us-gaap"?: Record<string, { units?: Record<string, SecFact[]> }> };
};
export function secFinancials(data: SecCompany): FinancialMetric[] {
  const taxonomy = data.facts?.["us-gaap"] ?? {};
  const metrics: FinancialMetric[] = [];
  const definitions = [
    {
      label: "Revenue · annual",
      tags: [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
      ],
      unit: "USD",
      annual: true,
    },
    {
      label: "Net income · annual",
      tags: ["NetIncomeLoss", "ProfitLoss"],
      unit: "USD",
      annual: true,
    },
    {
      label: "Diluted EPS · annual",
      tags: ["EarningsPerShareDiluted"],
      unit: "USD/share",
      annual: true,
    },
    {
      label: "Operating cash flow · annual",
      tags: ["NetCashProvidedByUsedInOperatingActivities"],
      unit: "USD",
      annual: true,
    },
    { label: "Total assets", tags: ["Assets"], unit: "USD", annual: false },
    {
      label: "Total liabilities",
      tags: ["Liabilities"],
      unit: "USD",
      annual: false,
    },
  ] as const;
  for (const definition of definitions) {
    const unit = definition.unit === "USD/share" ? "USD/shares" : "USD";
    const rows = definition.tags.flatMap(
      (tag) => taxonomy[tag]?.units?.[unit] ?? [],
    );
    const valid = rows
      .filter((row) => {
        if (
          !Number.isFinite(row.val) ||
          !Number.isFinite(Date.parse(row.end)) ||
          !Number.isFinite(Date.parse(row.filed))
        )
          return false;
        if (definition.annual) {
          const days =
            (Date.parse(row.end) - Date.parse(row.start ?? "")) / 86400000;
          return (
            ["10-K", "10-K/A", "20-F", "20-F/A"].includes(row.form) &&
            days >= 300 &&
            days <= 400
          );
        }
        return (
          !row.start &&
          ["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A"].includes(
            row.form,
          )
        );
      })
      .sort(
        (a, b) =>
          Date.parse(b.end) - Date.parse(a.end) ||
          Date.parse(b.filed) - Date.parse(a.filed),
      );
    const row = valid[0];
    if (!row) continue;
    const accession = row.accn?.replace(/-/g, "");
    metrics.push({
      label: definition.label,
      value: row.val,
      unit: definition.unit,
      period: row.end,
      filed: row.filed,
      url:
        data.cik && accession && /^\d+$/.test(accession)
          ? `https://www.sec.gov/Archives/edgar/data/${data.cik}/${accession}/`
          : undefined,
    });
  }
  const revenue = metrics.find((m) => m.label === "Revenue · annual"),
    income = metrics.find((m) => m.label === "Net income · annual");
  if (
    revenue &&
    income &&
    revenue.value > 0 &&
    revenue.period === income.period
  )
    metrics.push({
      label: "Net margin · annual",
      value: (income.value / revenue.value) * 100,
      unit: "percent",
      period: revenue.period,
      filed: income.filed,
      url: income.url,
    });
  return metrics;
}
export type ObservedPoint = { time: number; value: number };
export function observedSeries(
  points: { time: number; token?: number; benchmark?: number }[],
  key: "token" | "benchmark",
): ObservedPoint[] {
  const unique = new Map<number, ObservedPoint>();
  for (const point of points) {
    const value = point[key];
    if (
      Number.isFinite(point.time) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    )
      unique.set(Math.floor(point.time / 1000) * 1000, {
        time: Math.floor(point.time / 1000) * 1000,
        value,
      });
  }
  return [...unique.values()].sort((a, b) => a.time - b.time);
}
export function movingAverage(
  points: ObservedPoint[],
  period: number,
): ObservedPoint[] {
  if (!Number.isInteger(period) || period < 1) return [];
  const output: ObservedPoint[] = [];
  let sum = 0;
  points.forEach((point, index) => {
    sum += point.value;
    if (index >= period) sum -= points[index - period].value;
    if (index >= period - 1)
      output.push({ time: point.time, value: sum / period });
  });
  return output;
}
/** Wilder RSI, computed on observed hourly closes, not generated prices. */
export function relativeStrength(
  points: ObservedPoint[],
  period = 14,
): number | null {
  if (!Number.isInteger(period) || period < 1 || points.length <= period)
    return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = points[i].value - points[i - 1].value;
    gain += Math.max(0, delta) / period;
    loss += Math.max(0, -delta) / period;
  }
  for (let i = period + 1; i < points.length; i++) {
    const delta = points[i].value - points[i - 1].value;
    gain = (gain * (period - 1) + Math.max(0, delta)) / period;
    loss = (loss * (period - 1) + Math.max(0, -delta)) / period;
  }
  return loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
}
