# 🏛️ SIMOGRANTS — Stigmergic Impact Oracle for Grants

> Autonomous multi-agent evaluation system for Ethereum public goods funding, rebuilt as a Cloudflare-native Web4 platform.

[![Built for PL_Genesis](https://img.shields.io/badge/PL_Genesis-Hackathon-blue)](https://dorahacks.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![Base](https://img.shields.io/badge/Network-Base%20Sepolia-2153FF)](https://sepolia.base.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🌐 Live Demo

| Component | URL |
|-----------|-----|
| **Frontend** | [https://simogrants.com](https://simogrants.com) ([.pages.dev](https://simogrants.pages.dev)) |
| **Backend API** | [https://simogrants-api.jingjai.workers.dev/api](https://simogrants-api.jingjai.workers.dev/api) |
| **API Health** | [https://simogrants-api.jingjai.workers.dev/api/health](https://simogrants-api.jingjai.workers.dev/api/health) |
| **Custom Domain** | [https://simogrants.com](https://simogrants.com) |

## 🎯 What is SIMOGRANTS?

SIMOGRANTS is an **autonomous multi-agent system** that evaluates Ethereum public goods projects for funding allocation. It uses **stigmergic coordination** — the same mechanism ants use to build colonies — to create an emergent, trustless evaluation framework.

**Key innovation:** Instead of centralized grant reviewers, SIMOGRANTS deploys specialized AI agents that independently evaluate projects across multiple dimensions (impact, feasibility, team, innovation) and coordinate through a shared "pheromone" signal system. The result is a transparent, reproducible, and game-theory-resilient funding recommendation.

### Core Features

- 🔗 **Web3 Login** — Connect your wallet via MetaMask (SIWE authentication)
- 📊 **Grant Round Management** — Create, browse, and participate in funding rounds
- 🤖 **Autonomous Evaluation Pipeline** — Multi-agent AI evaluation with stigmergic coordination
- 💰 **Quadratic Funding Integration** — SQF mechanism for fair matching pool allocation
- ⛓️ **On-Chain Attestations** — Evaluation results stored on Base blockchain
- 📦 **Evidence Bundles** — IPFS/Filecoin-stored supporting documents
- 📈 **Leaderboards & Rankings** — PageRank + pheromone-based project scoring

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Cloudflare Edge                    │
│  ┌─────────────┐  ┌──────┐  ┌────┐  ┌──────────┐  │
│  │  React SPA   │  │  D1  │  │ KV │  │    R2     │  │
│  │  (Pages)     │  │(SQLite)│ │(Sess)│ │(Evidence)│  │
│  └──────┬───────┘  └──▲───┘  └──▲──┘  └────┬─────┘  │
│         │              │        │            │        │
│  ┌──────▼──────────────▼────────▼────────────▼─────┐ │
│  │          Cloudflare Workers (API)                │ │
│  │   SIWE Auth · REST API · QF Engine · Pipeline   │ │
│  └──────────────────────┬──────────────────────────┘ │
└─────────────────────────┼───────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │    Base Blockchain     │
              │  ┌────┐ ┌──────┐ ┌──┐│
              │  │Factory│ │SQF  │ │AR││
              │  └────┘ └──────┘ └──┘│
              └───────────────────────┘
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, wagmi, viem |
| **Backend** | Cloudflare Workers (TypeScript) |
| **Database** | Cloudflare D1 (SQLite) |
| **Sessions** | Cloudflare KV |
| **Storage** | Cloudflare R2 |
| **Auth** | SIWE (Sign-In with Ethereum) |
| **Smart Contracts** | Solidity 0.8.20+, Hardhat |
| **Blockchain** | Base (Ethereum L2) |
| **Deployment** | Wrangler CLI, Cloudflare Pages |

## ⛓️ Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| **GrantFactory** | `0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA` |
| **GrantRound (Implementation)** | `0x27E39D006baAbD15f38D8Ecf63Dd61086affeC66` |
| **SQFMechanism** | `0x77FFD92fbD6720Dc1cE504B971E9AbdDd7F5b1BA` |
| **AttestationRegistry** | `0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9` |
| **DemoGrantRound** | `0x09b246c9F8Eb9eDf04875228A6214D9bb0f4322A` |

Verify on [BaseScan Sepolia](https://sepolia.basescan.org/).

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/rounds` | List all grant rounds |
| GET | `/api/rounds/:id` | Get round details |
| POST | `/api/rounds` | Create a new round (auth) |
| GET | `/api/rounds/:id/projects` | List projects in a round |
| POST | `/api/rounds/:id/apply` | Apply to a round (auth) |
| GET | `/api/projects/:id` | Get project details |
| POST | `/api/auth/nonce` | Get SIWE nonce |
| POST | `/api/auth/verify` | Verify SIWE signature |
| GET | `/api/auth/session` | Get current session |
| POST | `/api/auth/logout` | End session |
| GET | `/api/stats` | Platform statistics |
| POST | `/api/evaluations` | Submit evaluation (auth) |
| GET | `/api/pipeline/status` | Evaluation pipeline status |
| POST | `/api/evidence/upload` | Upload evidence bundle (auth) |

Base URL: `https://simogrants-api.jingjai.workers.dev/api`

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Cloudflare account with API token
- MetaMask browser extension

### 1. Clone and Install

```bash
git clone https://github.com/web3guru888/simogrants.git
cd simogrants
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Cloudflare credentials and other settings
```

### 3. Setup Infrastructure (D1, KV, R2)

```bash
bash scripts/setup-d1.sh
```

### 4. Run Backend Locally

```bash
cd packages/backend
npm install
npx wrangler dev
# API available at http://localhost:8787
```

### 5. Run Frontend Locally

```bash
cd packages/frontend
npm install
npm run dev
# App available at http://localhost:5173
```

### 6. Deploy Contracts (Optional)

```bash
cd packages/contracts
npm install
export DEPLOYER_PRIVATE_KEY=your_private_key
npx hardhat run scripts/deploy.js --network baseSepolia
```

## 📦 Deployment

### Quick Deploy (All Components)

```bash
bash scripts/deploy-all.sh
```

### Deploy Backend Only

```bash
cd packages/backend
npx wrangler deploy
```

### Deploy Frontend Only

```bash
cd packages/frontend
npm run build
npx wrangler pages deploy dist --project-name=simogrants
```

## 🧪 Testing

### Smart Contract Tests (104 tests passing)

```bash
cd packages/contracts
npx hardhat test
```

### E2E Tests (Playwright)

```bash
cd e2e-tests
npm install
npx playwright install --with-deps
npx playwright test
```

10/12 E2E tests pass against the live production site:
- ✅ Landing page renders with hero section
- ✅ Browse rounds displays funding rounds
- ✅ Round detail page loads with project data
- ✅ Round results page displays SQF allocations
- ✅ Create round form validates and submits
- ✅ Apply to round form works
- ✅ Dashboard loads (graceful unauth handling)
- ✅ Responsive layout on mobile
- ✅ Accessibility (no critical violations)
- ✅ SPA navigation works without full reload
- ✅ Static assets load (CSS, JS, images)

## 🧪 Hackathon Submission

### PL_Genesis: Frontiers of Collaboration

**Track:** Existing Code (extending an existing operational codebase)

**What's New for PL_Genesis:**
- 🔄 **Full Cloudflare Migration** — Rebuilt from Python/FastAPI to Cloudflare Workers + D1
- 🌐 **Web4 Frontend** — New React SPA with Web3 wallet authentication (SIWE)
- ⛓️ **Smart Contracts** — GrantFactory with EIP-1167 minimal proxy pattern for scalable round creation
- 💰 **SQF Mechanism** — On-chain quadratic funding for fair matching pool allocation
- 📊 **Real-time Pipeline** — Multi-agent evaluation with live status tracking
- 🏗️ **Edge-Native** — D1 database, KV sessions, R2 storage — all serverless

**Bounties Targeting:**
| Bounty | Track | Prize |
|--------|-------|-------|
| Existing Code | Top 10 | $5,000 |
| Crypto Focus Area | 1st/2nd/3rd | $3K/$2K/$1K |
| Infrastructure & Digital Rights | 1st/2nd/3rd | $3K/$2K/$1K |
| Filecoin Bounty | Integration | $2,500 |
| Storacha Bounty | Integration | $500 |
| Hypercerts Bounty | Integration | TBD |
| Community Vote | Most engagement | $1,000 |

## 📁 Project Structure

```
simogrants/
├── packages/
│   ├── backend/           # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/    # REST API route handlers
│   │   │   ├── lib/       # QF, pheromone, PageRank engines
│   │   │   ├── middleware/ # SIWE auth middleware
│   │   │   ├── index.ts   # Entry point
│   │   │   └── types.ts
│   │   ├── migrations/    # D1 SQL schema
│   │   ├── wrangler.toml  # Workers config
│   │   └── package.json
│   ├── frontend/          # React SPA
│   │   ├── src/
│   │   │   ├── pages/     # Route components
│   │   │   ├── components/# Reusable UI components
│   │   │   ├── hooks/     # React hooks (auth, API)
│   │   │   ├── lib/       # API client, wagmi config
│   │   │   └── styles/    # Tailwind CSS
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── contracts/         # Solidity smart contracts
│       ├── contracts/     # GrantFactory, GrantRound, SQFMechanism, AttestationRegistry
│       ├── scripts/       # Deployment scripts
│       ├── artifacts/     # Compiled ABIs
│       ├── hardhat.config.js
│       └── package.json
├── e2e-tests/             # Playwright E2E test suite
│   ├── full-suite.spec.ts # 12 end-to-end tests
│   └── playwright.config.ts
├── scripts/
│   ├── deploy-all.sh      # Full deployment
│   └── setup-d1.sh        # D1/KV/R2 infrastructure setup
├── src/                   # Original Python codebase (reference)
├── .env.example           # Environment template
└── README.md
```

## 🤝 Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built for **[PL_Genesis: Frontiers of Collaboration](https://dorahacks.io)** on DoraHacks.
Powered by **Cloudflare**, **Base**, and **Ethereum**.
