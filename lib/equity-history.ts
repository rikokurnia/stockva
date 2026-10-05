// Local equity-history store: snapshots of total equity (invested + cash)
// recorded as the city evolves. No backfill is ever fabricated — the curve
// and daily P&L only cover days the game actually ran.
export type EquityPoint = { t: number; equity: number };
const KEY = "stockcity.equity-history.v1";
const MAX_POINTS = 400;
const MIN_GAP_MS = 6 * 3600 * 1000;

export function loadEquityHistory(): EquityPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is EquityPoint =>
          Boolean(p) &&
          Number.isFinite((p as EquityPoint).t) &&
          Number.isFinite((p as EquityPoint).equity),
      )
      .sort((a, b) => a.t - b.t)
      .slice(-MAX_POINTS);
  } catch {
    return [];
  }
}

/** Append a snapshot when the day changed or 6h passed. Returns the series. */
export function recordEquityPoint(equity: number): EquityPoint[] {
  const points = loadEquityHistory();
  if (!Number.isFinite(equity)) return points;
  const now = Date.now();
  const last = points[points.length - 1];
  if (last) {
    const sameDay =
      new Date(last.t).toDateString() === new Date(now).toDateString();
    if (sameDay && now - last.t < MIN_GAP_MS) return points;
    if (Math.abs(equity - last.equity) < 0.005 && now - last.t < MIN_GAP_MS)
      return points;
  }
  const next = [...points, { t: now, equity }].slice(-MAX_POINTS);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — history just doesn't persist */
  }
  return next;
}

export type DailyDelta = {
  date: string;
  equity: number;
  pnl: number;
  pct: number;
};

/** Collapse snapshots to one point per day, then day-over-day deltas. */
export function dailyDeltas(points: EquityPoint[]): DailyDelta[] {
  const byDay = new Map<string, EquityPoint>();
  for (const p of points) byDay.set(new Date(p.t).toDateString(), p);
  const days = [...byDay.values()].sort((a, b) => a.t - b.t);
  return days.slice(1).map((point, i) => {
    const prev = days[i].equity;
    const pnl = point.equity - prev;
    return {
      date: new Date(point.t).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "2-digit",
      }),
      equity: point.equity,
      pnl,
      pct: prev > 0 ? (pnl / prev) * 100 : 0,
    };
  });
}
