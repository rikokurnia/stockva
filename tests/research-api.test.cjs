const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = (mod, filename) =>
  mod._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    filename,
  );
const { GET: history } = require("../app/api/history/route.ts");
const { GET: research } = require("../app/api/research/route.ts");
const { NextRequest } = require("next/server");
const request = (path) => new NextRequest(`http://local/api/${path}`);
test("history API keeps underlying-only observations separate from token OHLC", async () => {
  const original = global.fetch;
  global.fetch = async (url) =>
    new Response(
      JSON.stringify(
        url.includes("kraken")
          ? {
              error: [],
              result: {
                AAPLXUSD: [
                  [1000, 0, 0, 0, "110"],
                  [2000, 0, 0, 0, "112"],
                ],
                last: 2000,
              },
            }
          : {
              chart: {
                result: [
                  {
                    meta: {
                      regularMarketPrice: 111,
                      regularMarketTime: 3000,
                      exchangeName: "NMS",
                    },
                    timestamp: [2000, 3000],
                    indicators: { quote: [{ close: [111, 113] }] },
                  },
                ],
              },
            },
      ),
    );
  try {
    const result = await (
      await history(request("history?ticker=AAPL&pair=AAPLXUSD"))
    ).json();
    assert.deepEqual(result.points, [
      { time: 1000000, token: 110 },
      { time: 2000000, token: 112, benchmark: 111 },
      { time: 3000000, benchmark: 113 },
    ]);
    assert.equal(result.simulated, false);
  } finally {
    global.fetch = original;
  }
});
test("history outage returns an empty observed dataset, never a generated fallback", async () => {
  const original = global.fetch;
  global.fetch = async () => {
    throw Error("offline");
  };
  try {
    const result = await (await history(request("history?ticker=AAPL"))).json();
    assert.deepEqual(result.points, []);
    assert.equal(result.simulated, false);
    assert.equal(
      (await history(request("history?ticker=UNKNOWN"))).status,
      400,
    );
    assert.equal(
      (await history(request("history?ticker=AAPL&pair=http://bad"))).status,
      400,
    );
  } finally {
    global.fetch = original;
  }
});
test("research API returns observed market statistics and SEC reporting periods", async () => {
  const original = global.fetch;
  global.fetch = async (url) =>
    new Response(
      JSON.stringify(
        url.includes("company_tickers")
          ? { 0: { cik_str: 320193, ticker: "AAPL" } }
          : url.includes("companyfacts")
            ? {
                cik: 320193,
                entityName: "Apple Inc.",
                facts: {
                  "us-gaap": {
                    Revenues: {
                      units: {
                        USD: [
                          {
                            val: 1000000000,
                            start: "2024-01-01",
                            end: "2024-12-31",
                            filed: "2025-02-01",
                            form: "10-K",
                          },
                        ],
                      },
                    },
                  },
                },
              }
            : {
                chart: {
                  result: [
                    {
                      meta: {
                        symbol: "AAPL",
                        currency: "USD",
                        instrumentType: "EQUITY",
                        regularMarketTime: 1000,
                        regularMarketDayHigh: 112,
                        regularMarketDayLow: 110,
                        regularMarketVolume: 10000,
                      },
                    },
                  ],
                },
              },
      ),
    );
  try {
    const data = await (await research(request("research?ticker=AAPL"))).json();
    assert.equal(data.financials[0].value, 1000000000);
    assert.equal(data.financials[0].period, "2024-12-31");
    assert.equal(data.financialSource, "SEC EDGAR · company filings");
    assert.equal(data.volume, 10000);
    assert.ok(data.financialFetchedAt);
  } finally {
    global.fetch = original;
  }
});
test("research outage preserves previous filings with their original retrieval time and stale flag", async () => {
  const original = global.fetch,
    originalNow = Date.now;
  const earlier = await (
    await research(request("research?ticker=AAPL"))
  ).json();
  Date.now = () => originalNow() + 61 * 60000;
  global.fetch = async () => {
    throw Error("offline");
  };
  try {
    const data = await (await research(request("research?ticker=AAPL"))).json();
    assert.equal(data.stale, true);
    assert.equal(data.financials[0].value, 1000000000);
    assert.equal(data.financialFetchedAt, earlier.financialFetchedAt);
    assert.ok(data.financialError);
    assert.equal(
      (await research(request("research?ticker=UNKNOWN"))).status,
      400,
    );
    const absent = await (
      await research(request("research?ticker=NVDA"))
    ).json();
    assert.deepEqual(absent.financials, []);
  } finally {
    global.fetch = original;
    Date.now = originalNow;
  }
});
