import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolioLandscape,
  stressScenario,
  equalWeightBudget,
} from "../lib/agent-hall.ts";

const position = (ticker, units, basis, price, extra = {}) => ({
  ticker,
  units,
  basis,
  price,
  sector: "Technology",
  ...extra,
});

test("hall combines duplicate building and paper positions, excluding drafts and services", () => {
  const portfolio = portfolioLandscape([
    position("NVDA", 2, 160, 100),
    position("NVDA", 1, 90, 100),
    position("JPM", 1, 120, 150, { sector: "Finance" }),
    position("TSLA", 5, 1000, 220, { locked: true }),
    position("", 0, 350, 0),
  ]);
  assert.equal(portfolio.holdings.length, 2);
  assert.equal(portfolio.total, 450);
  assert.equal(portfolio.basis, 370);
  assert.equal(portfolio.holdings[0].units, 3);
  assert.equal(portfolio.holdings[0].basis, 250);
  assert.ok(Math.abs(portfolio.concentration - 200 / 3) < 1e-9);
  assert.deepEqual(portfolio.sectors, ["Technology", "Finance"]);
});

test("empty and invalid positions never produce NaN allocation", () => {
  const portfolio = portfolioLandscape([
    position("BAD", NaN, 100, 10),
    position("ZERO", 1, 100, 0),
    position("NEG", -1, 100, 10),
    position("INF", 1, Infinity, 10),
  ]);
  assert.deepEqual(portfolio.holdings, []);
  assert.equal(portfolio.total, 0);
  assert.equal(portfolio.concentration, 0);
  assert.equal(stressScenario([], -50).after, 0);
});

test("whole portfolio and single-asset shocks use the correct exposure", () => {
  const { holdings } = portfolioLandscape([
    position("NVDA", 3, 250, 100),
    position("JPM", 1, 120, 150),
  ]);
  assert.equal(stressScenario(holdings, -10).impact, -45);
  assert.equal(stressScenario(holdings, -10, "JPM").after, 435);
  assert.equal(stressScenario(holdings, 50, "NVDA").after, 600);
  assert.equal(stressScenario(holdings, -10, "MISSING").impact, 0);
  assert.equal(stressScenario(holdings, -100).percent, -50);
  assert.equal(stressScenario(holdings, NaN).impact, 0);
});

test("basket budgets respect local treasury and fractional allocations", () => {
  assert.deepEqual(equalWeightBudget("501", 1000, 4), {
    valid: true,
    amount: 501,
    perAsset: 125.25,
  });
  for (const budget of ["", "oops", "Infinity", "-1", "3.99", "1001"])
    assert.equal(equalWeightBudget(budget, 1000, 4).valid, false);
  assert.equal(equalWeightBudget("4", 4, 4).valid, true);
  assert.equal(equalWeightBudget("4", 0, 4).valid, false);
});
