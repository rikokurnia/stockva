const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
// Exercise the real route without starting Next.js or opening a port.
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
const { GET } = require("../app/api/company-news/route.ts");
const { NextRequest } = require("next/server");
const request = (ticker) =>
  new NextRequest(`http://local/api/company-news?ticker=${ticker}`);

test("news route returns attributed reports, filters clickbait and deduplicates", async () => {
  const original = global.fetch;
  const date = new Date().toUTCString();
  const item = (title, id, publisher = "Reuters") =>
    `<item><title>${title} - ${publisher}</title><link>https://news.google.com/rss/articles/${id}</link><pubDate>${date}</pubDate><source url="https://example.com">${publisher}</source></item>`;
  global.fetch = async () =>
    new Response(
      `<rss><channel>${item("Nvidia signs chip supply agreement with cloud provider", "1")}${item("Nvidia signs chip supply agreement with cloud provider", "duplicate")}${item("Nvidia reports higher data center revenue", "2")}${item("Nvidia expands manufacturing partnership", "3")}${item("Should you buy Nvidia stock now?", "4")}</channel></rss>`,
    );
  try {
    const result = await (await GET(request("NVDA"))).json();
    assert.equal(result.articles.length, 3);
    assert.ok(
      result.articles.every(
        (a) =>
          a.source === "Reuters" &&
          a.title.startsWith("Nvidia") &&
          !a.title.endsWith(" - Reuters") &&
          a.publishedAt,
      ),
    );
    assert.equal(new Set(result.articles.map((a) => a.title)).size, 3);
  } finally {
    global.fetch = original;
  }
});
test("offline refresh labels cached headlines stale and never invents fallback news", async () => {
  const originalFetch = global.fetch,
    originalNow = Date.now;
  const now = Date.now();
  global.fetch = async () => {
    throw Error("offline");
  };
  Date.now = () => now + 11 * 60000;
  try {
    const cached = await (await GET(request("NVDA"))).json();
    assert.equal(cached.stale, true);
    assert.equal(cached.articles.length, 3);
    const empty = await (await GET(request("TSLA"))).json();
    assert.deepEqual(empty.articles, []);
    assert.ok(empty.error);
    assert.equal((await GET(request("UNKNOWN"))).status, 400);
  } finally {
    global.fetch = originalFetch;
    Date.now = originalNow;
  }
});
