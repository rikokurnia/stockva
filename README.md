<p align="center">
  <img src="public/assets/ai_logo.png" width="130" alt="Stockva Logo" />
</p>

<h1 align="center">Stockva</h1>

<p align="center">
  <strong>Build the City Behind Your Stocks.</strong><br />
  A tokenized Real-World Asset (RWA) city-building sandbox powered by BNB Smart Chain & Privy.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Network-BNB_Chain_Testnet_(97)-F0B90B?logo=binance&logoColor=white" alt="BNB Chain" />
  <img src="https://img.shields.io/badge/Framework-Next.js_15_(App_Router)-000000?logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Language-TypeScript_5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Web3-Privy_Auth_%26_Viem-blueviolet" alt="Privy Viem" />
  <img src="https://img.shields.io/badge/Smart_Contracts-Foundry_%26_Solidity-orange" alt="Solidity Foundry" />
</p>

---

## 🌟 Overview

**Stockva** transforms abstract equity portfolios into a living, breathing isometric metropolis. Players start with a pristine, undeveloped island and construct their city from the ground up—laying custom road networks, founding civic institutions, and erecting the corporate headquarters of top global equities and tokenized assets.

Every corporate building's architectural tier dynamically evolves based on real-time market performance and unrealized gains/losses. Stockva bridges Web3 DeFi with accessible simulation gameplay, featuring a verified **BNB Smart Chain Testnet Vault**, an interactive **AI Mayor Advisor**, and unified **Privy** wallet authentication.

<p align="center">
  <img src="public/assets/connect-wallet.png" width="280" alt="Stockva Web3 Connect" />
</p>

---

## ✨ Key Features

### 🏙️ 1. Living City Sandbox
- **Zero Starter Assumptions:** You start with an untouched island, $10,000 in treasury funds, and complete creative freedom.
- **Autonomous Road & Traffic Engine:** Draw custom road routes across the terrain. An intelligent pathfinding algorithm spawns multi-directional maintenance vans, electric buses, and construction trucks navigating lane offsets and realistic turn radii.
- **Civic Progression:** Construct the **Stock Exchange** to unlock market operations and trading, and build **City Hall** to monitor treasury balances and active portfolio allocations.

### 📈 2. Tokenized Stocks & Dynamic Tier Evolution
- **37+ Buildables:** Equities spanning Tech, Finance, Consumer, Energy, and Indices (e.g., Apple, Tesla, NVIDIA, Microsoft, Alphabet, Amazon, Berkshire Hathaway).
- **4-Tier Isometric Architecture:** Corporate headquarters dynamically evolve based on market performance:
  - 🔻 **Distressed Tier:** Negative return threshold.
  - 🏢 **Level 1:** Entry / Baseline operations.
  - 🏬 **Level 2:** Intermediate expansion and business growth.
  - 🏙️ **Level 3:** Skyscraper pinnacle for high-performing holdings.
- **Game Settings & Simulation Controls:** Freely customize cycle speeds (4s, 6s, 8s, 10s), pause/resume cycles, and fine-tune exact gain/loss percentage thresholds on the fly.

### ⛓️ 3. BNB Smart Chain (Testnet) Integration
- **Live On-Chain Vault (`StockCityVault`):** Record placed building positions directly to the BSC Testnet smart contract.
- **Live Testnet Faucet:** One-click on-chain claim of 10,000 **$mUSD** (Stockva Demo USD) to your connected wallet address via `claimFaucet()`.
- **Transparent Position Verification:** Query live on-chain holdings, position quantities, and cost bases directly from the smart contract with direct BscScan transaction explorer links.

### 🔐 4. Unified Privy Web3 Authentication
- **Synchronized Single Sign-On:** Seamless cross-page state synchronization between the Landing Page (`/`) and the Sandbox Dashboard (`/city`).
- **Flexible Login:** Connect via MetaMask, Binance Web3 Wallet, Coinbase Wallet, or WalletConnect.
- **Active Address Recognition:** Automatic viem checksum formatting, live network status dot, and account management dropdown (copy address, BscScan lookup, network switch, disconnect).

### 🦫 5. AI Mayor Advisor
- **Intelligent Financial Companion:** Integrated AI advisory mascot powered by real-time city snapshot telemetry (cash on hand, active equities, on-chain vault holdings, and market trends).
- **Resilient Fallback:** Hybrid architecture leveraging LLM intelligence with an offline heuristic rules engine for uninterrupted guidance.

---

## 📜 Verified Smart Contracts (BSC Testnet)

The core gameplay smart contracts are deployed and verified on **BNB Smart Chain Testnet (Chain ID: 97)**:

| Contract | Address | Explorer Link |
| :--- | :--- | :--- |
| **StockCityVault** | `0xc5458564D705bC5b5655D119Aeece9B3d9D8B849` | [View on BscScan](https://testnet.bscscan.com/address/0xc5458564D705bC5b5655D119Aeece9B3d9D8B849) |
| **MockUSD (mUSD)** | `0xCA2Acbb5f159F4B3e0D2b1A54b423D0E993B4f21` | [View on BscScan](https://testnet.bscscan.com/address/0xCA2Acbb5f159F4B3e0D2b1A54b423D0E993B4f21) |

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Modular Vanilla CSS with responsive viewport breakpoints, glassmorphism, and hardware-accelerated animations
- **Web3 Integration:** Privy React SDK (`@privy-io/react-auth`), Viem 2.x
- **Smart Contracts:** Solidity `^0.8.24`, Foundry (`forge`)
- **Market Data Feeds:** Real-time tokenized asset quotes, xStocks proof-of-reserves endpoints, Kraken OHLC, and RSS corporate news caching
- **Testing:** Node.js native test runner with experimental strip-types support

---

## 🚀 Getting Started

### Prerequisites

- **Node.js:** `v20.x` or `v22.x` recommended
- **Package Manager:** `npm` (or `pnpm` / `yarn`)
- **Web3 Wallet:** MetaMask, Binance Web3 Wallet, or any EVM-compatible browser extension

### 1. Clone the Repository

```bash
git clone https://github.com/rikokurnia/stockva.git
cd stockva/projects/stockcity
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Populate the required environment variables:

```env
# Privy Authentication (Client & Server)
PRIVY_APP_ID=your_privy_app_id_here
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_app_secret_here

# AI City Advisor (Optional for LLM responses; local rule fallback active by default)
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** Never commit `.env` or sensitive private credentials to public version control.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Validation

Run the comprehensive unit and integration test suite:

```bash
# Run unit & contract tests (33 passing suites)
npm test

# Run TypeScript typechecks
npm run typecheck

# Build optimized production bundle
npm run build
```

### Smart Contract Testing (Foundry)

```bash
cd contracts
forge test -vvv
```

---

## 🎮 Gameplay Controls

| Action | Hotkey / Mouse | Description |
| :--- | :--- | :--- |
| **Select / Inspect** | `V` | Click any building or road to view stats, inspect position, or relocate |
| **Draw Roads** | `R` | Click bare terrain and drag path; automatically connects turns & intersections |
| **Build Companies** | `B` | Browse the corporate catalogue and place company headquarters |
| **Civic Services** | `S` | Place City Hall or Stock Exchange to unlock game features |
| **Bulldoze** | `X` | Demolish tile structures (refunds simulated position value) |
| **Camera Pan** | `Space + Drag` / Mouse Drag | Move the viewport across the island |
| **Zoom In / Out** | `Wheel` / HUD Buttons | Adjust isometric camera distance |
| **Undo / Redo** | `Ctrl + Z` / `Ctrl + Shift + Z` | Revert or repeat construction actions |
| **Game Settings** | HUD Gear Icon | Adjust simulation speed (4s–10s), tier thresholds, and display mode |

---

## 📁 Project Structure

```
projects/stockcity/
├── app/                  # Next.js App Router (pages, API routes, layout)
│   ├── api/              # Route handlers (advisor, market, news, passport)
│   ├── city/             # Main game simulation canvas & HUD
│   ├── layout.tsx        # Root layout with unified Privy Providers
│   └── page.tsx          # Cinematic video landing page
├── components/           # Reusable UI components & game panels
│   ├── city-advisor.tsx  # Interactive AI Mayor Companion
│   ├── civic-panel.tsx   # Treasury, Exchange, and On-chain Vault ledger
│   ├── landing-hero.tsx  # Hero landing presentation
│   ├── onchain-wallet.tsx# In-game Web3 wallet chip & modal
│   └── stock-city.tsx    # Core isometric simulation engine
├── contracts/            # Foundry smart contracts project
│   ├── src/              # StockCityVault.sol & MockUSD.sol
│   └── script/           # Deployment scripts for BSC Testnet
├── lib/                  # Game state algorithms, math, and contracts ABI
└── public/               # Static assets, sprites, audio, and logos
```

---

## 🛡️ Security & Disclaimer

Stockva is created as a demonstration sandbox for the **BNB Chain Hackathon**. Real-World Asset (RWA) tokens and company equities referenced within the city builder utilize public quote data and testnet smart contracts (`MockUSD` on BSC Testnet 97). Positions held in the simulation sandbox do not represent real-world securities ownership or financial advice.

---

<p align="center">
  Built with ❤️ for the <strong>BNB Chain Hackathon</strong>.
</p>
