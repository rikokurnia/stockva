export const portfolioLevel = (tier: string): 1 | 2 | 3 =>
  tier === "level_3" ? 3 : tier === "level_2" ? 2 : 1;
export const portfolioPercent = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}%`;
};
type Anchor = { id: string; x: number; y: number };
export const LABEL_WIDTH = 124;
export const LABEL_HEIGHT = 60;
// Deterministic positions keep plaques steady during live price updates.
export function layoutPortfolioLabels(anchors: Anchor[]) {
  const placed: (Anchor & { left: number; top: number })[] = [];
  for (const anchor of [...anchors].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id),
  )) {
    const candidates = [];
    for (let row = 0; row < 8; row++)
      for (const col of [0, -1, 1, -2, 2, -3, 3]) {
        for (const side of [-1, 1]) {
          const left = Math.max(
            82,
            Math.min(
              1148,
              anchor.x - LABEL_WIDTH / 2 + col * (LABEL_WIDTH + 10),
            ),
          );
          const top = Math.max(
            108,
            Math.min(
              636,
              anchor.y + (side < 0 ? -86 - row * 70 : 20 + row * 70),
            ),
          );
          candidates.push({
            left,
            top,
            score:
              Math.hypot(
                left + LABEL_WIDTH / 2 - anchor.x,
                top + LABEL_HEIGHT / 2 - anchor.y,
              ) + (side > 0 ? 15 : 0),
          });
        }
      }
    candidates.sort((a, b) => a.score - b.score);
    const spot =
      candidates.find(
        (c) =>
          !placed.some(
            (p) =>
              c.left < p.left + LABEL_WIDTH + 8 &&
              c.left + LABEL_WIDTH + 8 > p.left &&
              c.top < p.top + LABEL_HEIGHT + 8 &&
              c.top + LABEL_HEIGHT + 8 > p.top,
          ),
      ) ?? candidates[0];
    placed.push({ ...anchor, left: spot.left, top: spot.top });
  }
  return placed;
}
