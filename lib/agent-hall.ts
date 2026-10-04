export type HallPosition = {
  ticker: string;
  sector: string;
  units: number;
  basis: number;
  price: number;
  locked?: boolean;
};

export type HallHolding = HallPosition & { value: number; allocation: number };

/** Combine building and position-only holdings without counting unpaid drafts. */
export function portfolioLandscape(positions: HallPosition[]) {
  const grouped = new Map<string, HallHolding>();
  for (const position of positions) {
    if (
      position.locked ||
      !position.ticker ||
      ![position.units, position.basis, position.price].every(
        Number.isFinite,
      ) ||
      position.units <= 0 ||
      position.basis < 0 ||
      position.price <= 0
    )
      continue;
    const previous = grouped.get(position.ticker);
    grouped.set(position.ticker, {
      ...position,
      units: (previous?.units ?? 0) + position.units,
      basis: (previous?.basis ?? 0) + position.basis,
      value: (previous?.value ?? 0) + position.units * position.price,
      allocation: 0,
    });
  }
  const holdings = [...grouped.values()].sort((a, b) => b.value - a.value);
  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  const basis = holdings.reduce((sum, h) => sum + h.basis, 0);
  for (const holding of holdings)
    holding.allocation = total ? (holding.value / total) * 100 : 0;
  return {
    holdings,
    total,
    basis,
    sectors: [...new Set(holdings.map((h) => h.sector))],
    concentration: holdings[0]?.allocation ?? 0,
  };
}

/** Apply a simple price shock, leaving cash and other positions unchanged. */
export function stressScenario(
  holdings: HallHolding[],
  percent: number,
  ticker: string | null = null,
) {
  const total = holdings.reduce((sum, h) => sum + h.value, 0);
  const boundedPercent = Number.isFinite(percent)
    ? Math.max(-50, Math.min(50, percent))
    : 0;
  const affected = ticker
    ? (holdings.find((h) => h.ticker === ticker)?.value ?? 0)
    : total;
  const impact =
    affected && boundedPercent ? (affected * boundedPercent) / 100 : 0;
  return {
    total,
    affected,
    percent: boundedPercent,
    impact,
    after: total + impact,
  };
}

export function equalWeightBudget(
  budget: string,
  cash: number,
  assetCount: number,
) {
  const amount = Number(budget);
  const valid =
    Number.isFinite(amount) &&
    Number.isFinite(cash) &&
    assetCount > 0 &&
    amount >= assetCount &&
    amount <= cash;
  return {
    amount: valid ? amount : 0,
    perAsset: valid ? amount / assetCount : 0,
    valid,
  };
}
