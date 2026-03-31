# SIMOGRANTS — Stigmergic Impact Oracle for Grants

> ASI1-powered multi-agent evaluation system for Ethereum public goods funding, built as a Cloudflare-native Web4 platform on Base Sepolia.

[![Built for PL_Genesis](https://img.shields.io/badge/PL_Genesis-Hackathon-blue)](https://dorahacks.io)
[![ASI1](https://img.shields.io/badge/AI-ASI1%20Mini-f59e0b)](https://asi.ai)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com)
[![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia%20(Testnet)-2153FF)](https://sepolia.base.org)
[![E2E Tests](https://img.shields.io/badge/E2E_Tests-12%2F12_passing-brightgreen)]()
[![Contract Tests](https://img.shields.io/badge/Contract_Tests-104_passing-brightgreen)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Live Deployment

| Component | URL | Network |
|-----------|-----|---------|
| **Frontend** | [https://simogrants.com](https://simogrants.com) | — |
| **Frontend (alt)** | [https://simogrants.pages.dev](https://simogrants.pages.dev) | — |
| **Backend API** | [https://simogrants-api.jingjai.workers.dev/api](https://simogrants-api.jingjai.workers.dev/api) | — |
| **Smart Contracts** | [View on BaseScan](https://sepolia.basescan.org/address/0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA) | Base Sepolia (84532) |

> **Note:** This platform runs on **Base Sepolia testnet only**. All transactions use testnet ETH. No real funds are involved.

## What is SIMOGRANTS?

SIMOGRANTS is an **autonomous multi-agent system** that evaluates Ethereum public goods projects for funding allocation. It uses **stigmergic coordination** — the same mechanism ants use to build colonies — to create an emergent, trustless evaluation framework.

Instead of centralized grant reviewers, SIMOGRANTS deploys **4 specialized ASI1-powered stakeholder agents** that independently evaluate projects across 12 dimensions and coordinate through a shared "pheromone" signal system. Funds are allocated via **Stigmergic Quadratic Funding (SQF)** — a novel mechanism combining standard QF with pheromone and PageRank modifiers for game-theory-resilient allocation.

### How It Works

1. **Project Submission** — Teams apply to grant rounds with project details (name, description, GitHub, category)
2. **ASI1 Multi-Agent Evaluation** — 4 ASI1-powered stakeholder agents evaluate each project in parallel:
   - **Developer Agent** — Code quality, maintenance health, security posture
   - **User Agent** — Adoption metrics, community engagement, user experience
   - **Funder Agent** — Capital efficiency, funding sustainability, track record (skeptical by design)
   - **Ecosystem Agent** — Composability, network effects, mission alignment
3. **Tension Detection** — The system identifies disagreements between agents (e.g., a technically strong project the funder agent rates poorly because it's self-sustaining)
4. **SQF Allocation** — Funds are distributed using: `Allocation = QF_Base x Pheromone_Modifier x PageRank_Modifier`
5. **On-Chain Attestation** — Results are attested on Base Sepolia with evidence bundles stored on IPFS/Filecoin

### Key Features

- **Web3 Authentication** — SIWE (Sign-In with Ethereum) via MetaMask or injected wallets
- **Grant Round Management** — Create, browse, and participate in funding rounds on Base Sepolia
- **ASI1 AI Evaluation** — ASI1 Mini LLM powers 4 stakeholder agents with calibrated scoring (0-100 per dimension)
- **Stigmergic Quadratic Funding** — Fair matching pool allocation with pheromone decay (20%/epoch) and PageRank modifiers
- **On-Chain Smart Contracts** — GrantFactory (EIP-1167), GrantRound, SQFMechanism, AttestationRegistry on Base Sepolia
- **Evidence Bundles** — Supporting documents stored on IPFS/Filecoin via Cloudflare R2
- **Parallel Evaluation** — All 4 ASI1 agents run concurrently per project; all projects in a round are evaluated concurrently

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                          │
│  ┌─────────────┐  ┌──────────┐  ┌──────┐  ┌──────────────┐ │
│  │  React SPA   │  │    D1    │  │  KV  │  │      R2      │ │
│  │  (Pages)     │  │ (SQLite) │  │(Sess)│  │  (Evidence)  │ │
│  └──────┬───────┘  └────▲─────┘  └──▲───┘  └──────┬───────┘ │
│         │               │           │              │         │
│  ┌──────▼───────────────▼───────────▼──────────────▼───────┐ │
│  │             Cloudflare Workers (Hono API)                │ │
│  │   SIWE Auth · REST API · SQF Engine · Eval Pipeline     │ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────┘
                          │
            ┌─────────────▼─────────────┐
            │      ASI1 LLM API         │
            │  (4 stakeholder agents)   │
            │  asi1-mini model           │
            └─────────────┬─────────────┘
                          │
            ┌─────────────▼─────────────┐
            │   Base Sepolia (Testnet)   │
            │  ┌────────┐ ┌───┐ ┌────┐  │
            │  │Factory │ │SQF│ │ AR │  │
            │  └────────┘ └───┘ └────┘  │
            └───────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite 6, Tailwind CSS 4, wagmi 2, viem 2, TanStack Query 5 |
| **Design** | Syne + Outfit fonts, amber/teal palette, noise textures, staggered animations |
| **Backend** | Cloudflare Workers, Hono framework (TypeScript) |
| **AI Evaluator** | ASI1 Mini (`asi1-mini`) via chat completions API at `https://api.asi1.ai/v1/chat/completions` |
| **Database** | Cloudflare D1 (SQLite at edge) |
| **Sessions** | Cloudflare KV |
| **Storage** | Cloudflare R2 (evidence bundles) |
| **Auth** | SIWE (Sign-In with Ethereum) |
| **Smart Contracts** | Solidity 0.8.24, Hardhat, EIP-1167 minimal proxies |
| **Blockchain** | Base Sepolia testnet (chain ID 84532) |
| **E2E Testing** | Playwright (Chromium) |
| **Deployment** | Wrangler CLI, Cloudflare Pages |

## Deployed Contracts (Base Sepolia)

All contracts are deployed on **Base Sepolia testnet** (chain ID 84532).

| Contract | Address | Purpose |
|----------|---------|---------|
| **GrantFactory** | [`0x795b...e5dA`](https://sepolia.basescan.org/address/0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA) | EIP-1167 proxy factory for creating grant rounds |
| **GrantRound** | [`0x27E3...eC66`](https://sepolia.basescan.org/address/0x27E39D006baAbD15f38D8Ecf63Dd61086affeC66) | Implementation contract for round lifecycle |
| **SQFMechanism** | [`0x77FF...1dD9`](https://sepolia.basescan.org/address/0x77FFD92fbD6720Dc1cE504B971E9AbdDd7F5b1BA) | On-chain SQF allocation calculation |
| **AttestationRegistry** | [`0xb706...1dD9`](https://sepolia.basescan.org/address/0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9) | Evaluation attestations with IPFS CID references |
| **DemoGrantRound** | [`0x09b2...322A`](https://sepolia.basescan.org/address/0x09b246c9F8Eb9eDf04875228A6214D9bb0f4322A) | Demo round instance |

## API Reference

Base URL: `https://simogrants-api.jingjai.workers.dev/api`

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/nonce` | Generate SIWE nonce (body: `{address}`) |
| POST | `/auth/verify` | Verify SIWE signature (body: `{message, signature}`) |
| GET | `/auth/me` | Get current session (requires Bearer token) |
| POST | `/auth/logout` | End session |

### Rounds
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rounds` | List all grant rounds (optional `?status=` filter) |
| GET | `/rounds/:id` | Get round details with applications |
| POST | `/rounds` | Create a new round (auth required) |
| POST | `/rounds/:id/apply` | Apply to a round (auth required, body: `{projectId}`) |
| POST | `/rounds/:id/evaluate` | Trigger ASI1 evaluation for all projects in round (auth required) |
| POST | `/rounds/:id/allocate` | Compute SQF allocation (auth required) |
| GET | `/rounds/:id/results` | Get ranked results with scores and allocations |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| GET | `/projects/:id` | Get project details with evaluations and allocations |
| POST | `/projects` | Create a new project (auth required) |
| GET | `/projects/:id/evaluations` | Get all evaluations for a project |

### Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pipeline/run` | Run full pipeline: ASI1 evaluate + SQF allocate (auth required) |
| GET | `/pipeline/:runId` | Get pipeline run status and progress |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/stats` | Platform statistics (rounds, projects, allocations) |
| GET | `/evaluations` | List evaluations (optional `?round_id=` filter) |
| POST | `/evidence/upload` | Upload evidence bundle to R2 (auth required) |
| GET | `/evidence/:projectId` | List evidence for a project |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Cloudflare account with API token
- MetaMask or any injected Ethereum wallet (configured for **Base Sepolia**)
- Base Sepolia testnet ETH ([faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))

### 1. Clone and Install

```bash
git clone https://github.com/web3guru888/simogrants.git
cd simogrants
git checkout pl-genesis-hackathon
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Cloudflare credentials
```

For the backend, create `packages/backend/.dev.vars`:
```
ASI1_API_KEY=your-asi1-api-key
```

Get an ASI1 API key at [https://asi.ai](https://asi.ai).

### 3. Setup Infrastructure (D1, KV, R2)

```bash
bash scripts/setup-d1.sh
```

### 4. Initialize Database

```bash
cd packages/backend
npm run db:init    # Create schema
npm run db:seed    # Populate seed data
```

### 5. Run Locally

```bash
# Full stack (backend + frontend)
npm run dev
# Backend: http://localhost:8787
# Frontend: http://localhost:5173

# Or individually:
cd packages/backend && npx wrangler dev --local
cd packages/frontend && npm run dev
```

### 6. Deploy Contracts (Optional)

```bash
cd packages/contracts
export DEPLOYER_PRIVATE_KEY=0x...
npx hardhat run scripts/deploy.js --network baseSepolia
```

## Deployment

### Full Deploy (All Components)

```bash
bash scripts/deploy-all.sh
```

Supports flags: `--skip-infra`, `--skip-backend`, `--skip-frontend`, `--skip-contracts`

### Deploy Backend

```bash
cd packages/backend
npx wrangler deploy
# Set the ASI1 API key as a secret:
npx wrangler secret put ASI1_API_KEY
```

### Deploy Frontend

```bash
cd packages/frontend
npm run build
npx wrangler pages deploy dist --project-name=simogrants --branch=main
```

## Testing

### Smart Contract Tests (104 passing)

```bash
npx hardhat test                               # All tests
npx hardhat test test/SQFMechanism.test.js     # Single file
```

4 test suites covering GrantFactory, GrantRound, SQFMechanism, and AttestationRegistry.

### E2E Tests (12/12 passing)

```bash
cd e2e-tests
npm install
npx playwright install --with-deps
npx playwright test

# Test against a different URL:
E2E_BASE_URL=https://simogrants.com npx playwright test
```

| Test | What it validates |
|------|-------------------|
| Landing Page | Hero section, nav links, connect wallet button, SEO meta, load time |
| Browse Rounds | Round cards render with `data-testid`, click navigates to detail |
| Round Detail | Headings, round metadata (status, matching pool, applications) |
| Round Results | SQF allocation data, scores, rankings render correctly |
| Create Round | Form with 6 inputs, submit button present |
| Apply to Round | Application form or "Applications Closed" message |
| Dashboard | Dashboard content or wallet connect prompt |
| API Endpoints | Health, Rounds, Stats return 200; Auth Nonce returns 200 (POST) |
| Responsive (mobile) | No horizontal overflow at 375px, readable font, tappable buttons |
| Accessibility | Alt text on images, no empty links/buttons, heading hierarchy, lang attribute |
| SPA Navigation | Client-side routing, browser back/forward |
| Static Assets | Zero 404s across all pages, fast load times |

Console output: zero errors across all tests.

### Python Tests (Legacy Pipeline)

```bash
pip install -e .
pytest src/tests/ -v
```

### Linting

```bash
# Python
ruff check src/
ruff format src/

# TypeScript
cd packages/backend && npx tsc --noEmit
```

## ASI1 Evaluation Pipeline

### AI Model

The system uses **ASI1 Mini** (`asi1-mini`) from the [ASI Alliance](https://asi.ai) (formerly Fetch.ai / SingularityNET / Ocean Protocol), accessed via an OpenAI-compatible chat completions API at `https://api.asi1.ai/v1/chat/completions`.

- **Model**: `asi1-mini`
- **Temperature**: 0.3 (low, for consistent scoring)
- **Max tokens**: 2,048 per agent call
- **Retry logic**: 3 attempts with exponential backoff + JSON repair prompts
- **Parallel execution**: All 4 agents run concurrently per project via `Promise.allSettled`
- **Fallback**: When no `ASI1_API_KEY` is configured, a deterministic mock evaluator generates realistic scores for development

### Scoring Calibration

Each ASI1 agent scores 3 dimensions on a 0-100 scale:
- **90-100**: World-class, top 1%. Extremely rare.
- **80-89**: Exceptional, top ~5%.
- **70-79**: Strong, above average.
- **60-69**: Good, solid but not exceptional.
- **50-59**: Average for funded Ethereum public goods.
- **Below 50**: Below average to poor.

### SQF Mechanism

The Stigmergic Quadratic Funding formula:

```
Allocation = QF_Base x Pheromone_Modifier x PageRank_Modifier
```

- **QF_Base**: Standard quadratic funding calculation
- **Pheromone_Modifier**: Signal strength (0-10 scale, 20% decay per epoch, 0.5 deposit rate)
- **PageRank_Modifier**: Dependency graph influence (damping factor 0.85)

### Tension Detection

When ASI1 stakeholder agents disagree significantly (spread > 15 points), the system generates tension narratives. Example: a technically excellent project that the funder agent scores low because it's self-sustaining and doesn't need grants.

## Project Structure

```
simogrants/
├── packages/
│   ├── backend/                # Cloudflare Workers API (Hono + TypeScript)
│   │   ├── src/
│   │   │   ├── routes/         # 7 route handlers (auth, rounds, projects, evaluations, pipeline, evidence, stats)
│   │   │   ├── lib/            # Core engines
│   │   │   │   ├── evaluator.ts    # Real ASI1 LLM evaluator (4 agents, parallel)
│   │   │   │   ├── mockEvaluator.ts # Deterministic mock for dev
│   │   │   │   ├── sqf.ts          # SQF allocation engine
│   │   │   │   ├── qf.ts           # Quadratic funding calculation
│   │   │   │   ├── pheromone.ts    # Pheromone state management
│   │   │   │   └── pagerank.ts     # PageRank calculation
│   │   │   ├── middleware/     # SIWE auth middleware
│   │   │   ├── index.ts        # Hono app entry point
│   │   │   └── types.ts        # TypeScript types (Env bindings, DB rows, API contracts)
│   │   ├── migrations/         # D1 SQL (0001_initial.sql, 0002_seed_data.sql)
│   │   ├── wrangler.toml       # Workers config (D1, KV, R2 bindings)
│   │   └── .dev.vars           # Local secrets (gitignored)
│   ├── frontend/               # React 19 SPA (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── pages/          # 8 pages (Landing, BrowseRounds, RoundDetail, RoundResults,
│   │   │   │                   #   CreateRound, ApplyToRound, Dashboard, ProjectDetail)
│   │   │   ├── components/     # 9 reusable components (Layout, ConnectButton, RoundCard,
│   │   │   │                   #   ProjectCard, AllocationBar, ScoreBar, StatusBadge, etc.)
│   │   │   ├── hooks/          # useAuth (SIWE), useContracts (wagmi contract hooks)
│   │   │   ├── lib/            # API client, wagmi config (Base Sepolia only), contract ABIs
│   │   │   └── styles/         # Tailwind CSS + Syne/Outfit fonts
│   │   └── vite.config.ts      # Vite + React + Tailwind, /api proxy to :8787
│   └── contracts/              # Solidity 0.8.24 smart contracts (Base Sepolia)
│       ├── contracts/          # GrantFactory, GrantRound, SQFMechanism, AttestationRegistry
│       ├── test/               # 104 Hardhat + Chai tests
│       └── scripts/            # Deployment scripts
├── e2e-tests/                  # Playwright E2E test suite (12 tests)
├── src/                        # Original Python pipeline (FastAPI, 7 collectors, 4 ASI1 evaluator agents)
│   ├── collectors/             # GitHub, Etherscan, DefiLlama, Gitcoin, Snapshot, Octant, packages
│   ├── evaluator/              # ASI1 evaluation engine, stakeholder prompts, Bradley-Terry aggregation
│   ├── mechanism/              # QF, pheromone tracker, PageRank engine, anti-Goodhart rotation
│   └── blockchain/             # Attestation, deployment, Filecoin upload helpers
├── contracts/                  # Original Solidity contract (SIMOGrantsAttestation.sol)
├── whitepaper/                 # 4-part technical whitepaper
├── scripts/                    # deploy-all.sh, setup-d1.sh
├── run_pipeline.py             # Full 6-step Python pipeline orchestrator
├── CLAUDE.md                   # Claude Code guidance
└── README.md
```

## Hackathon Submission

### PL_Genesis: Frontiers of Collaboration

**Track:** Existing Code (extending an existing operational codebase)

**What was built for PL_Genesis:**
- **Full Cloudflare Migration** — Rebuilt from Python/FastAPI monolith to Cloudflare Workers + D1 + KV + R2
- **Web4 Frontend** — React SPA with SIWE wallet authentication, custom design system (Syne/Outfit, amber/teal palette), 8 pages, 9 components
- **ASI1 AI Evaluation** — Real ASI1 Mini LLM integration with 4 stakeholder agents running in parallel
- **Smart Contracts** — GrantFactory (EIP-1167 minimal proxies), GrantRound, SQFMechanism, AttestationRegistry on Base Sepolia — 104 tests
- **On-Chain Integration** — Frontend calls GrantFactory.createRound(), GrantRound.submitApplication(), reads on-chain status
- **SQF Mechanism** — Quadratic funding with pheromone and PageRank modifiers
- **Full E2E Testing** — 12 Playwright tests, all passing against live production
- **Custom Domain** — Deployed and SSL-certified at simogrants.com

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

## Contributing

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built for **[PL_Genesis: Frontiers of Collaboration](https://dorahacks.io)** on DoraHacks.
Powered by **[ASI1](https://asi.ai)**, **[Cloudflare](https://workers.cloudflare.com)**, **[Base Sepolia](https://sepolia.base.org)**, and **Ethereum**.
