# Stockcity Audit and QA - 2026-10-05

## Scope

Update on 2026-10-06: AI rebalances are atomic-only again. Automatic separate-signature fallback is removed. Unsupported wallets stop before signing. Interrupted older sequential executions can only reconcile already-submitted hashes; remaining changes require a fresh atomic blueprint.

Reviewed agent planning and execution, atomic and sequential wallet flows, direct purchases and sales, faucet settlement, vault accounting, market-provider fallbacks, RWA metadata/spreads/sessions, and desktop/mobile interaction. Changes are limited to Stockcity. No transactions were signed, contracts deployed, or commits pushed during this audit.

## Findings Fixed

| Severity | Finding | Resolution |
| --- | --- | --- |
| Critical | Non-atomic rebalance bought new positions but fabricated successful sale receipts and removed old city buildings without selling their vault positions. It could also guess missing purchase position IDs. | Sequential execution now sends and confirms every real sale before purchases, applies validated receipts, persists each submitted hash, and never guesses IDs or retries an uncertain transaction. |
| High | Reloads/timeouts could lose direct-sale and manual-purchase hashes, leaving a submitted transaction retryable. | Persist submitted hashes and reviewed purchase inputs; recover by reading receipts, not signing again. Lock city mutations while settlement is unresolved. Batch rejection clears transient construction locks. |
| High | Faucet receipt failures were swallowed, allowing local credit despite a revert or timeout. | Require a successful receipt with the correct token's matching wallet/amount event. Use the selected Privy provider for faucet, direct purchases, and bundles. |
| High | Batch receipts accepted incomplete or unrelated position events; local undo could reverse settled chain changes. | Validate emitting vault, owner, ticker, cost, price, tier, quantity, order, unique IDs, and complete event count. Save canonical mined hashes and clear local undo/redo at settlement. |
| High | Vault source returned/emitted nominal proceeds even when reserves capped the actual transfer. | Return and emit actual payout and actual P/L. The application continues deriving sale proceeds from matching token transfers, including the currently deployed older contract. |
| Medium | Kraken failure prevented independent xStocks/Yahoo fallbacks; repeated outages could discard observed quotes. | Isolate provider failures, retain stale observed prices with their original observation timestamp, and correct Yahoo daily-change reference selection. |
| Medium | RWA spread response cache leaked one ticker request's result into another request. | Remove redundant global response cache; retain the existing shared provider-data cache and filter each request independently. |
| Medium | Estimated session used fixed summer UTC hours, and overnight token trading could be presented as an open US equity session. | Use New York time across DST; distinguish token session from frozen US reference and label estimates explicitly. |
| Medium | Stock Exchange mobile status badge pushed its close button outside a 390px viewport. | Responsive two-row header with a stable close-button column and wrapping session badge. |

## Verification

- `npm test`: all suites passed, including new provider-outage/cache tests, receipt validation, sequential sell-before-buy, retry/recovery, capped-proceeds, and persisted manual-purchase tests.
- `npm run typecheck`: passed.
- Isolated production build using `STOCKCITY_NEXT_DIST_DIR=.next-production npm run build`: passed.
- Foundry: 9 contract tests passed, including 256 fuzz cases for partial/full-sale conservation, non-owner restrictions, and capped payout return/event/transfer agreement.
- Read-only BSC checks: both configured RPC endpoints returned chain ID 97; deployed vault payment token matched the configured MockUSD address. Public active NVDA and TSLA positions were read and used for a live planning request.
- Live rebalance API: rejected an invalid overlapping city fixture, then returned HTTP 200 for the corrected fixture with ordered NVDA sale, TSLA sale, and JPM purchase, using mapped sale proceeds without additional cash.
- Live market API: observed quotes for all 100 catalogue tickers through the configured provider chain. Separate NVDA/JPM RWA queries returned their own ticker data. NVDA passport, research, and history returned provider evidence; AI portfolio review returned a real response.
- Browser QA via gstack: desktop/mobile city, Agent Hall, Stock Exchange, session badge, chart rendering, Escape dismissal, and mobile close control. Screenshots inspected at desktop and 390x844 mobile; chart pixels were nonblank after data loaded.

## Important Boundaries

1. **This is a testnet simulation, not real stock execution or custody.** The vault accepts caller-supplied prices and MockUSD is a development token. There is no authenticated price oracle. Do not use this contract for real-value collateral without a separately designed pricing/security model.
2. **The Solidity correction is source-only.** No deployment was authorized or performed. Existing deployed addresses and existing positions remain unchanged; a separate deployment/migration is needed for the corrected payout events on-chain.
3. **Live wallet signing remains unverified.** Wallet, replacement, receipt, failure, and recovery behavior were exercised with deterministic tests, and contract execution with Foundry. No human-connected wallet was used to send live buys, sells, faucet claims, or atomic batches.
4. Cities affected by the old fabricated-sale path may still have active vault positions absent from the city. This audit prevents new occurrences but cannot retroactively close or reconstruct those positions without explicit wallet reconciliation.
5. Market `live` means a provider supplied an observed quote, not guaranteed tick-by-tick exchange freshness. Underlying quotes can remain frozen outside their session. Session-clock fallback is estimated and does not include a holiday calendar.
6. A successful replacement transaction whose events do not match the reviewed purchase remains locked for reconciliation. This is intentionally safer than automatically resending a possibly completed purchase.

## Regression Tests

- `tests/audit.test.cjs`: integration-style isolated provider and wallet tests.
- `tests/rebalance-execution.test.mjs`: durable progress, exact settlement, manual purchase/sale recovery validation, and idempotence.
- `tests/rebalance-receipts.test.cjs` and `tests/rebalance-batch.test.cjs`: canonical receipts, replacement/cancellation, atomic wallet capabilities, and multi-trade settlement.
- `tests/rwa.test.mjs`: DST and reference-session behavior.
- `contracts/test/StockCity.t.sol`: vault ownership, settlement, reserve-cap accounting, and conservation fuzz tests.
