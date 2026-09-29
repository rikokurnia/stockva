# stockva — city-building frontend

An empty-island city builder for a simulated RWA stock portfolio. The player lays every road and places every company and service building. No starter city or starter holdings are loaded.

## Building simulation and company intelligence

- The parchment **Building simulation** control opens three editable thresholds: Minus below X, Level 1 from X to below Y, Level 2 from Y to below Z, and Level 3 at Z or above. Defaults are −5%, +5%, +15%. Values must be finite and ordered; preferences persist locally.
- **Start / Pause** runs a bounded percentage simulation every 4, 6, 8 or 10 seconds. Pause freezes simulated returns; **Return to market percentages** restores market-based building returns. Threshold changes apply immediately to sprites and portfolio plaques. Simulation never changes quote data, cash, units or purchase basis, and never auto-starts after reload.
- Clicking a company building or portfolio plaque opens a light Company Ledger with a matching tier sprite, company profile, operating drivers, risks, position facts and three recent attributed headlines where available. The ten requested companies have tailored profiles; other listed companies can also retrieve coverage. Trade, RWA passport and Move actions remain available.
- `/api/company-news` retrieves a Google News RSS search, caches each ticker for ten minutes, filters common stock-picking clickbait and prefers reported corporate events. Dates and publishers come from the feed. Failed refreshes show cached reports as stale, or an explicit retry state; no fictional Bloomberg/Reuters headlines are supplied. The public RSS feed is intended for personal, non-commercial feed reading; production distribution needs an appropriately licensed news source.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Requires Node.js 22.6+ for the TypeScript model tests.

The home route is Stockva's single-screen video landing page, adapted from the supplied `landing-page` template with Instrument Serif and Inter. **Start building** opens the existing sandbox at `/city`. The background uses the supplied `landing-page-video.mp4`, with a poster fallback, pause control, and reduced-motion support.

The top-right wallet button uses Privy's React SDK. Set `PRIVY_APP_ID` in `.env` (or `NEXT_PUBLIC_PRIVY_APP_ID`); only the public app ID is passed to the client. `PRIVY_APP_SECRET` is not needed for this client login flow and is never exposed. Enable wallet login and allow your deployment's origin in the Privy dashboard. Wallet login does not change the browser-local simulated portfolio into real-money positions.

```sh
npm run typecheck
npm test
npm run build
npm start
```

## Gameplay

A new game starts with **zero roads, zero buildings, zero holdings, and $10,000 of demo funds**.

1. Select **Roads** (`R`). Click on bare ground, drag a route, and release. The displayed price is charged once per stroke. Connections, corners, and junctions choose the supplied road sprites automatically.
2. Open **Services** (`S`) and construct the **Stock Exchange** to unlock Companies and trading. Build **City Hall** to unlock portfolio status. Roads and services are available immediately.
3. Every building occupies a 2×2 footprint. Buildings and roads cannot overlap or extend beyond the island's buildable grass polygon.
4. Use **Select** (`V`) and click a building to inspect it, move it, or remove it. Company demolition returns the simulated position value; service and road demolition do not refund construction costs.
5. **Bulldoze** (`X`) removes a clicked building or road. **Undo / Redo** restores the whole action, including funds and a complete road stroke.
6. Traffic appears only when the connected road component yields a route of at least five steps. The electric bus, construction truck, and maintenance van drive offset lanes, carve sampled turns through corners, U-turn at dead ends, and reroute after edits. Each vehicle uses eight painted perspectives (original upper-left/upper-right plus generated lower and side views) selected by projected isometric heading — never mirrored.

## Controls

| Action               | Control                                   |
| -------------------- | ----------------------------------------- |
| Select               | V                                         |
| Roads                | R, then click and drag                    |
| Companies / services | B / S, then choose and place              |
| Bulldoze             | X, then click a tile                      |
| Pan                  | Drag in select mode, or hold Space + drag |
| Zoom                 | Mouse wheel or camera buttons             |
| Reset camera         | Home or reset button                      |
| Show grid            | G                                         |
| Pause simulation     | P                                         |
| Undo / redo          | Ctrl/Cmd Z / Ctrl/Cmd Shift Z             |
| Cancel current tool  | Escape or right-click                     |

The city saves to `stockva.sandbox.v2` in local storage. The previous dashboard's starter-city save is intentionally not imported. **Settings → Start a new city** restores an empty island after explicit confirmation.

## Scope and assets

- Next.js App Router, React, TypeScript, custom game UI, accessible DOM/SVG city renderer, public-data route handlers, and browser-local demo positions. No real-money execution or deployed contracts.
- 37 buildable stocks/funds. Kraken provides live xStocks last-trade prices where listed; unavailable listings use labeled illustrative fallback prices. Ten company artwork sets are reused by sector for other assets. All funds and positions remain simulated.
- Uses the supplied island animation and Nusara art. All 45 sprites are viewable under **Settings → Supplied asset library**. The toolbar uses a painted 6-icon construction atlas (`public/assets/ui/construction-atlas.png`, documented in `docs/illustrated-ui.md`); vehicle perspectives are documented in `docs/vehicle-generation-prompts.json`. Original vehicle PNGs are preserved and WebP copies are generated by `scripts/encode-vehicles.mjs`. Static fallback and ocean texture are derived from the supplied video; original files in `my-random/` remain unchanged.
- The loading/fallback media aliases are copies of the supplied island loop and its extracted poster.
- Clicking a service opens its distinct panel: City Hall (numbers, allocations, owned-building camera focus), Exchange (search, hourly chart, buy-to-placement and 25/50/75/100% sales), Data Center (issuer passport, reserve report, independent price comparison and island scan mode). Panels sit on the right on desktop and become expandable/swipeable bottom sheets on mobile.
- Simulation speed affects the game clock and traffic. Public quotes poll every 60 seconds independently of pause/speed. Reduced-motion preferences suppress island and scanner animations. Realized sale P/L and remaining cost basis persist with the city; old saves without realized P/L default to zero.

## Verification

The model tests cover empty startup, first-road placement, atomic road costs, manual company and service placement, 2×2 collision checks, land bounds, insufficient funds, demolition, connected traffic routes, all 11 road sprite connection shapes, camera bounds, joined road geometry, continuous vehicle paths, eight-direction vehicle art without mirroring, rotation tangent projection, and valid vehicle frame crops.

Browser checks with gstack also verified: a fresh city renders no roads/buildings/traffic; seven manually placed road tiles cost $70 and unlock exactly three vehicles; a $500 NVIDIA position and $250 City Hall are placed manually; moving preserves the position; bulldozing credits its value; undo restores both the building and budget; save/reload preserves the city; New City clears it again. Desktop, 375px phone, and 768px tablet layouts were inspected. The final empty state has no browser console errors.

# stockva

## Public data and provenance

The public market-data routes do not require API keys. The landing page's wallet connection requires the Privy app ID described above.

- `/api/market`: [Kraken AssetPairs and Ticker](https://docs.kraken.com/api-reference/market-data/get-ticker-information). Catalogue discovery uses `aclass_base=tokenized_asset`; quotes use `asset_class=tokenized_asset`. Positive finite prices only. One-minute caching, nine-second timeout, stale last-known prices before illustrative fallback. Quote timestamps indicate retrieval, not last-trade time. Daily change is from midnight UTC.
- `/api/history`: Kraken hourly OHLC and Yahoo Finance's public chart endpoint for an independently timestamped underlying reference. Yahoo is a best-effort, unofficial public endpoint; availability and delay are not guaranteed. Missing series are labeled explicitly; sample lines are never presented as observed prices. Comparison quotes are not synchronized, so spread is indicative, not executable arbitrage.
- `/api/passport`: [xStocks public API](https://docs.xstocks.fi/apis/openapi), asset deployments and proof-of-reserves. Five-minute upstream caching and eight-second timeout. BNB Smart Chain is selected first when issuer-confirmed. Explorer URLs use an allowlist of networks, and no contract is inferred from a ticker. Reserve shares, token supply, report time and custody provider are issuer-reported, not an independent attestation; no backing ratio is inferred across multipliers.
- Rights and prospectus: [issuer legal overview](https://docs.xstocks.fi/docs/product-legal-overview), [official legal documentation](https://assets.backed.fi/legal-documentation). Contracts describe real tokens; city positions do not own them.
- Market status uses the issuer's regular/extended/overnight/closed session for selected assets. If unavailable, the UI labels a New York weekday-hours estimate (DST aware, without holiday/early-close exceptions).

Unsupported token listings stay available only as explicitly simulated positions. Public providers can rate-limit or remove instruments. Offline fallback is intentionally static rather than invented live ticks.

### Civic feature verification

`npm test` includes progression, partial/full liquidation, realized P/L, remaining basis, persistence, all catalogue artwork, and DST session boundaries. Browser checks cover locking, manual Exchange construction, buy/place, partial sale, service clicks, City Hall camera focus, hover-to-passport, desktop right panel, mobile sheet, and real public-data responses. During verification, 31 of 37 catalogue entries returned live token quotes; NVIDIA also returned hourly token history, the underlying benchmark, issuer contracts and a dated reserve report.
