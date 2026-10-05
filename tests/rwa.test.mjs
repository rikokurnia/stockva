import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  spreadBps,
  underlyingTicker,
  sessionLabel,
  estimatedSession,
} from "../lib/rwa.ts";
import { signRwaRequest, sessionFromStatus } from "../lib/rwa-server.ts";

test("spreadBps measures on-chain premium in basis points", () => {
  assert.equal(spreadBps(101, 100), 100);
  assert.equal(spreadBps(99, 100), -100);
  assert.equal(spreadBps(100, 0), 0);
});

test("underlyingTicker strips issuer suffixes to game tickers", () => {
  const known = new Set(["NVDA", "TSLA", "BRK_B"]);
  assert.equal(underlyingTicker("NVDAon", known), "NVDA");
  assert.equal(underlyingTicker("TSLAB", known), "TSLA");
  assert.equal(underlyingTicker("AAPLx", known), null);
  assert.equal(underlyingTicker("BRK_B", known), "BRK_B");
});

test("sessionLabel narrates open, closed, halted and unknown", () => {
  assert.match(
    sessionLabel("open", null, "2026-10-06T20:00:00.000Z"),
    /open.*closes/,
  );
  assert.match(
    sessionLabel("closed", "2026-10-06T13:30:00.000Z", null),
    /closed.*opens/,
  );
  assert.match(sessionLabel("halted", null, null), /halt/i);
  assert.match(sessionLabel("unknown", null, null), /unknown/);
});

test("estimatedSession follows the 13:30-20:00 UTC weekday clock", () => {
  const open = estimatedSession(new Date("2026-10-07T15:00:00.000Z"));
  assert.equal(open.state, "open");
  assert.equal(open.provenance, "estimated");
  const weekend = estimatedSession(new Date("2026-10-11T15:00:00.000Z"));
  assert.equal(weekend.state, "closed");
  const night = estimatedSession(new Date("2026-10-07T02:00:00.000Z"));
  assert.equal(night.state, "closed");
});

test("sessionFromStatus reads real RWA statusInfo blocks", () => {
  const overnight = sessionFromStatus({
    openState: true,
    marketStatus: "overnight",
    reasonCode: "TRADING",
    nextOpenTime: 1791187260000,
    nextCloseTime: 1791186900000,
  });
  assert.equal(overnight.session, "open");
  assert.equal(overnight.referenceFrozen, true);
  assert.equal(
    overnight.nextOpenAt,
    new Date(1791187260000).toISOString(),
  );
  const regular = sessionFromStatus({
    openState: true,
    marketStatus: "regular",
    reasonCode: "TRADING",
  });
  assert.equal(regular.session, "open");
  assert.equal(regular.referenceFrozen, false);
  const paused = sessionFromStatus({
    openState: false,
    marketStatus: "paused",
    reasonCode: "MARKET_PAUSED",
  });
  assert.equal(paused.session, "closed");
  const halted = sessionFromStatus({
    openState: false,
    marketStatus: "halt",
    reasonCode: "HALTED_CORP_ACTION",
  });
  assert.equal(halted.session, "halted");
  assert.equal(sessionFromStatus(null).session, "unknown");
});

test("signRwaRequest matches Base64(HMAC-SHA256(ts + METHOD + path))", () => {
  const secret = "test-secret";
  const ts = "2026-10-05T04:00:00.000Z";
  const path = "/build/api/v1/dex/market/rwa/search?keyword=NVDA";
  const expected = createHmac("sha256", secret)
    .update(`${ts}GET${path}`)
    .digest("base64");
  assert.equal(signRwaRequest(secret, ts, "GET", path), expected);
  assert.match(signRwaRequest(secret, ts, "GET", path), /^[A-Za-z0-9+/]{43}=$/);
  assert.notEqual(
    signRwaRequest(secret, ts, "GET", path),
    signRwaRequest(secret, ts, "GET", `${path}&extra=1`),
  );
});
