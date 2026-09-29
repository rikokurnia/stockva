import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  assets,
  stockLogoUrl,
  rwaLogoUrl,
  stockLogoApiUrl,
  rwaLogoApiUrl,
} from "../lib/city.ts";

test("all 37 assets have valid stock logo URLs and existing SVG files on disk", () => {
  assert.equal(assets.length, 37);
  for (const asset of assets) {
    assert.ok(asset.ticker, "Asset has ticker");
    assert.ok(asset.name, "Asset has name");
    assert.ok(asset.logo, `Asset ${asset.ticker} has logo property`);

    const localUrl = stockLogoUrl(asset.ticker);
    assert.ok(localUrl.startsWith("/logos/stocks/"), `Local URL starts with /logos/stocks/`);

    const filePath = path.join(process.cwd(), "public", localUrl);
    assert.ok(fs.existsSync(filePath), `SVG file exists on disk for ${asset.ticker} at ${filePath}`);

    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("<svg"), `SVG content contains <svg for ${asset.ticker}`);
    assert.ok(content.length > 100, `SVG content has substantive payload for ${asset.ticker}`);

    const apiUrl = stockLogoApiUrl(asset.ticker);
    assert.ok(apiUrl.startsWith("https://assets.parqet.com/logos/symbol/"), `Remote stock logo CDN URL is valid for ${asset.ticker}`);
  }
});

test("all tokenized RWA assets have valid token logo URLs and PNG files on disk", () => {
  let rwaCount = 0;
  for (const asset of assets) {
    const rwaPath = path.join(process.cwd(), "public", rwaLogoUrl(asset.ticker));
    if (fs.existsSync(rwaPath)) {
      rwaCount++;
      const stat = fs.statSync(rwaPath);
      assert.ok(stat.size > 500, `RWA logo for ${asset.ticker} is valid image payload`);
    }
    const rwaApi = rwaLogoApiUrl(asset.ticker);
    assert.ok(rwaApi.startsWith("https://xstocks-metadata.backed.fi/logos/tokens/"), `RWA API URL is formatted correctly for ${asset.ticker}`);
  }
  // At least 36 out of 37 assets are tokenized RWAs on xStocks
  assert.ok(rwaCount >= 36, `Expected at least 36 RWA logos, got ${rwaCount}`);
});

test("special tickers like BRK.B correctly map dashes in stock CDN URLs", () => {
  assert.equal(stockLogoApiUrl("BRK.B"), "https://assets.parqet.com/logos/symbol/BRK-B");
  assert.equal(stockLogoUrl("BRK.B"), "/logos/stocks/brk_b.svg");
});
