<p align="center">
  <img src="public/assets/ai_logo.png" width="120" alt="Stockva Logo" />
</p>

<h1 align="center">Stockva</h1>

<p align="center">
  <strong>Build the City Behind Your Stocks.</strong><br />
  A tokenized Real-World Asset (RWA) city-building sandbox powered by BNB Smart Chain.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Network-BNB_Chain_Testnet_(97)-F0B90B?logo=binance&logoColor=white" alt="BNB Chain" />
  <img src="https://img.shields.io/badge/Framework-Next.js_15_(App_Router)-000000?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Language-TypeScript_5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Web3-EVM_Wallet_%26_Viem-blueviolet" alt="Web3 Viem" />
  <img src="https://img.shields.io/badge/Smart_Contracts-Foundry_%26_Solidity-orange" alt="Solidity Foundry" />
</p>

---

## Overview

**Stockva** transforms abstract equity portfolios and tokenized Real-World Assets (RWA) into an interactive isometric metropolis. Players start on an undeveloped island and construct their financial city from the ground up—laying custom road networks, founding civic institutions, and placing headquarters for global equities and tokenized assets.

Every corporate headquarters dynamically evolves across architectural tiers based on live market pricing and performance. Stockva bridges on-chain DeFi verification with accessible simulation gameplay, backed by a verified **BNB Smart Chain Testnet Vault**, an interactive **AI Mayor Companion**, and seamless Web3 wallet integration.

---

## Architecture & Key Features

### 1. Living Isometric Simulation Engine
- **Unconstrained Creative Freedom:** Start on a clean island canvas with full layout autonomy and starting treasury reserves.
- **Autonomous Road & Traffic Mechanics:** Construct custom road networks with continuous curves and automatic intersection joins. The pathfinding system coordinates multi-directional vehicles (maintenance vans, transit buses, utility haulers) navigating lane offsets and turn tangents.
- **Civic Progression Hierarchy:** Founding the **Stock Exchange** unlocks active market trading, while establishing **City Hall** enables treasury budgeting, portfolio telemetry, and on-chain settlement.

### 2. Tokenized Stocks & Dynamic Tier Evolution
- **100 S&P 100 Assets (115 Catalogue Entries):** 30 hero bespoke stocks plus 70 sector companies across Technology, Finance, Consumer, Energy, and Indices (e.g., Apple, Tesla, NVIDIA, Microsoft, Alphabet, Amazon, Berkshire Hathaway), plus 5 civic services including the Agent Hall.
- **Dynamic 4-Tier Architectural State:** Corporate buildings adapt their visual presence in response to market returns:
  - **Distressed Tier:** Active when returns fall below the liquidation threshold.
  - **Level 1 (Foundation):** Standard entry-level commercial operations.
  - **Level 2 (Growth):** Expanded commercial facilities with increased civic activity.
  - **Level 3 (Skyscraper):** Modern high-rise pinnacle for top-performing holdings.
- **Market Control:** Adjustable cycle frequencies (4s–10s), pause/resume updates, and user-configurable tier threshold parameters.

### 3. BNB Smart Chain (Testnet) Integration
- **On-Chain Settlement (`StockCityVault`):** Record placed building positions and tokenized allocations directly to the BSC Testnet smart contract.
- **Faucet Distribution:** Built-in one-click distribution of 10,000 **$mUSD** (Stockva Testnet USD) via the verified `claimFaucet()` interface.
- **Position Transparency:** Live querying of user position IDs, entry prices, quantities, and cost bases directly from the blockchain with automated BscScan explorer linking.

### 4. Unified Web3 Wallet Experience
- **Cross-Route Session Synchronization:** Persistent wallet connectivity shared between the cinematic Landing Page (`/`) and the interactive City Sandbox (`/city`).
- **Standard EVM Wallet Support:** Compatible with MetaMask, Binance Web3 Wallet, Coinbase Wallet, and WalletConnect.
- **Live Account Status:** Checksummed address formatting, live network indicators, one-click address copy, explorer lookup, and disconnection management.

### 5. Intelligent City Advisor
- **Context-Aware Recommendations:** Financial and municipal advisory system conditioned on real-time city state (cash reserves, active buildings, portfolio allocation, and market movements).
- **Triple-Provider Fallback (Gemini → DeepSeek → MuseSpark):** `/api/advisor` and `/api/rebalance` try the configured server AI keys in order. Without any key, both return an explicit "unavailable" error — no fabricated reviews or plans. Provider names are never exposed to the client.

### 6. Agent Hall — Cokoo's Command Center
- **Four Tabs, One Flow:** Rebalance (agent blueprint → wallet approval → city restructuring), Overview (portfolio landscape), Strategy Lab (equal-weight basket templates), and Stress Test (hypothetical ±50% shock playground).
- **Verified-Only Rebalance:** Plans derive every transaction from read-only BNB Testnet vault positions mapped 1:1 to buildings. Changed positions fully close before rebuilding; local, draft, and unmapped holdings stay outside the plan.
- **Review-First Execution:** Fingerprinted, expiring blueprints (5 min) with before/after allocation shift, road-connected blueprint preview, per-step receipts in City Hall, and pause/resume with hash recovery on reload.

---

## Verified Smart Contracts (BSC Testnet)

The core game logic and ledger contracts are deployed and verified on **BNB Smart Chain Testnet (Chain ID: 97)**:

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **StockCityVault** | `0x1810b360e0a4d593117f0bfaf2e0939b2df5e415` | [View on BscScan](https://testnet.bscscan.com/address/0x1810b360e0a4d593117f0bfaf2e0939b2df5e415) |
| **MockUSD (mUSD)** | `0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21` | [View on BscScan](https://testnet.bscscan.com/address/0xCA2Ab14Aa5F41705a2f3BF17b728a272441C4f21) |

---

## Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Modular Vanilla CSS, responsive viewport design, glassmorphism, hardware-accelerated transforms
- **Web3 Integration:** Viem 2.x, EVM Provider standards
- **Smart Contracts:** Solidity `^0.8.24`, Foundry (`forge`)
- **Data Pipeline:** Tokenized quote feeds, xStocks reserves endpoints, Kraken OHLC, and cached corporate news syndication
- **Testing:** Node.js native test runner with experimental strip-types

### Civic services & research data

- **Agent Hall rebalance:** Cokoo uses the configured server AI keys to propose target allocations from verified, mapped BNB Testnet vault positions. Review the building blueprint and before/after weights, then sign each removal and construction in your injected wallet. Changed positions close before rebuilding; each building maps to one vault position. The camera follows the worksite, and City Hall retains buy/sell receipts even after demolition. Rejected requests pause the sequence; reloading preserves submitted hashes for receipt recovery. Prices are quoted city estimates, and local, draft and unmapped wallet holdings remain outside the rebalance.
- **City Hall:** one saved-city holdings ledger, separate unpaid drafts, testnet funding and confirmation, and a collapsible transaction history deduplicated by hash. Wallet positions are matched by position ID; unmatched wallet records are excluded from city valuation. Local position management does not close an on-chain vault record.
- **Stock Exchange:** read-only asset research plus bundle placement. Individual purchases remain in the left-side building menu. Bundles require an Exchange on the island and are staged for placement before any wallet transaction.
- **Data Center:** issuer identity, network contracts, reserve evidence, independent price histories and product-rights limitations. Real token contracts are distinct from the city’s testnet vault.
- `/api/history` returns actual Kraken token closes and Yahoo Finance underlying observations (default 1 month at 15-minute intervals), independently. The API never synthesizes a missing series. The Stock Exchange chart (1H/1D/1W, candles/area, MA 10/20) bridges periods without observations with a clearly labelled illustrative path to the live price, and its volume bars are labelled as estimates. The Data Center comparison chart plots raw observations only. Quotes/history are checked around once a minute; underlying data may be delayed.
- `/api/research` combines underlying market statistics with SEC EDGAR company facts. Annual figures and latest balance-sheet values retain reporting and filing dates. Results cache for five minutes; normalized SEC figures cache server-side for one hour. The large raw company-facts payload is never sent to the browser. Funds and unsupported filers show unavailable company metrics rather than made-up values.
- Public research sources need no paid API key. For deployment, set optional server-only `SEC_USER_AGENT` to an identifying application name and contact address in accordance with SEC fair-access guidance. Provider outages/rate limits are displayed explicitly; prior company filings are marked stale.
- Civic panels support keyboard trapping, Escape and mobile layouts. Agent Hall follows the navy, steel and construction-yellow city theme. No additional UI dependency was installed.

To validate a production build while the dev server remains open, use `STOCKCITY_NEXT_DIST_DIR=.next-production npm run build`, then `STOCKCITY_NEXT_DIST_DIR=.next-production npm run start -- --port 3001`. The separate output directory avoids concurrent writes to `.next`.

---

## Getting Started

### Prerequisites

- **Node.js:** `v20.x` or higher
- **Package Manager:** `npm` (or `pnpm` / `yarn`)
- **Web3 Wallet:** Any EVM-compatible browser wallet (MetaMask, Binance Web3 Wallet, etc.)

### 1. Clone Repository

```bash
git clone https://github.com/rikokurnia/stockva.git
cd stockva/projects/stockcity
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Template variables (see `.env.example`):

```env
# Wallet login (Privy)
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_ID=
PRIVY_APP_SECRET=

# AI providers for Cokoo advisor (/api/advisor) and Agent Hall rebalance (/api/rebalance).
# Set at least one key; providers are tried in order Gemini → DeepSeek → MuseSpark.
# Without any key, AI reviews/plans return an explicit "unavailable" error (no fabricated plans).
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
MUSESPARK_API_KEY=
MUSESPARK_BASE_URL=https://api.musespark.ai/v1
MUSESPARK_MODEL=muse-spark-1.3

# Optional: identifying app name + contact for SEC EDGAR fair-access
SEC_USER_AGENT=
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Validation

```bash
# Run unit & contract integration tests
npm test

# Run TypeScript typechecks
npm run typecheck

# Build optimized production bundle
npm run build
```

### Smart Contract Verification (Foundry)

```bash
cd contracts
forge test -vvv
```

---

## Controls & Shortcuts

| Action | Control | Description |
| :--- | :--- | :--- |
| **Select / Inspect** | `V` | Click any building or road segment to inspect metrics or demolish |
| **Draw Roads** | `R` | Click and drag along bare ground to trace asphalt road networks |
| **Build Companies** | `B` | Open the commercial catalogue to draft company headquarters |
| **Civic Services** | `S` | Place the Stock Exchange or City Hall |
| **Bulldoze** | `X` | Remove existing structures and recover simulated capital |
| **Camera Pan** | `Space + Drag` / Mouse Drag | Move viewport across the terrain |
| **Zoom** | `Mouse Wheel` / HUD Buttons | Adjust isometric camera distance |
| **Undo / Redo** | `Ctrl + Z` / `Ctrl + Shift + Z` | Revert or repeat construction actions |
| **Settings** | HUD Gear Icon | Adjust simulation tick rate, tier thresholds, and display mode |

---

## Project Structure

```
projects/stockcity/
├── app/                  # Next.js App Router (pages, layout, API routes)
│   ├── api/              # advisor, rebalance, market, history, research, company-news, passport, stock-logo
│   ├── city/             # Main simulation canvas & HUD
│   ├── layout.tsx        # Root layout with Web3 providers
│   └── page.tsx          # Cinematic landing experience
├── components/           # UI components, simulation engine, and game dialogs
│   ├── agent-hall.tsx    # Cokoo command center (Rebalance, Overview, Strategy Lab, Stress Test)
│   ├── agent-rebalance.tsx # Agent blueprint, allocation shift, step ledger + execution dock
│   ├── city-advisor.tsx  # Interactive AI Mayor dialogue system
│   ├── civic-panel.tsx   # Treasury, Exchange, Data Center, and On-chain Vault ledger
│   ├── civic-city-hall.tsx # Holdings ledger, drafts, faucet, receipts
│   ├── civic-market.tsx  # Stock Exchange research + bundle placement
│   ├── civic-research.tsx # Data Center issuer/reserve/price evidence
│   ├── landing-hero.tsx  # Landing page presentation
│   ├── onchain-wallet.tsx# In-game Web3 wallet chip & modal
│   └── stock-city.tsx    # Isometric canvas renderer & game loop
├── contracts/            # Foundry smart contract suite
│   ├── src/              # StockCityVault.sol & MockUSD.sol
│   └── script/           # Deployment scripts for BSC Testnet
├── lib/                  # Simulation algorithms, city state, and contract ABI
│   ├── advisor.ts        # Snapshot + hallAnalysis prompt builders (overview/basket/stress)
│   ├── agent-hall.ts     # Portfolio landscape, stress scenarios, basket budgets
│   ├── rebalance.ts      # Verified-only plan builder (fingerprint, expiry, 1:1 mapping)
│   └── rebalance-execution.ts # Receipt application + paused-execution recovery
└── public/               # Static assets, sprites, audio, and corporate logos
```

---

## Disclaimer

Stockva is a decentralized Web3 application on the **BNB Smart Chain Testnet (Chain ID: 97)**. Asset quotes and corporate profiles are utilized for interactive tokenized asset visualization. On-chain positions and balances inside the application do not constitute financial advice.

---

<p align="center">
  Built with ❤️ for the <strong>Indonesia Web3 Hackathon</strong>.
</p>
