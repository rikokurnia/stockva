import test from "node:test";
import assert from "node:assert/strict";
import {
  layoutPortfolioLabels,
  portfolioLevel,
  portfolioPercent,
  LABEL_WIDTH,
  LABEL_HEIGHT,
} from "../lib/portfolio-view.ts";
import { tier } from "../lib/city.ts";
test("portfolio levels follow current artwork tiers, including negative performance", () => {
  for (const [gain, level] of [
    [-12, 1],
    [0, 1],
    [4.9, 1],
    [5, 2],
    [9.9, 2],
    [10, 3],
    [200, 3],
  ])
    assert.equal(portfolioLevel(tier(gain)), level);
});
test("returns have explicit gain/loss signs without negative zero", () => {
  assert.equal(portfolioPercent(8.44), "+8.4%");
  assert.equal(portfolioPercent(-2.1), "−2.1%");
  assert.equal(portfolioPercent(-0.01), "0.0%");
});
test("adjacent holdings keep separate plaques and stable anchors", () => {
  const anchors = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    x: 500 + (i % 4) * 64,
    y: 280 + Math.floor(i / 4) * 36,
  }));
  const placed = layoutPortfolioLabels(anchors);
  assert.equal(placed.length, anchors.length);
  assert.deepEqual(placed, layoutPortfolioLabels([...anchors].reverse()));
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i],
        b = placed[j];
      assert.ok(
        a.left + LABEL_WIDTH <= b.left ||
          b.left + LABEL_WIDTH <= a.left ||
          a.top + LABEL_HEIGHT <= b.top ||
          b.top + LABEL_HEIGHT <= a.top,
      );
    }
});
test("an empty city has no fabricated holdings", () =>
  assert.deepEqual(layoutPortfolioLabels([]), []));
