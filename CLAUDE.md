# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SIMOGRANTS is a stigmergic multi-agent evaluation system for Ethereum public goods funding. ASI1-powered AI agents evaluate projects through pheromone-coordinated signals, then allocate funds via Stigmergic Quadratic Funding (SQF). The platform runs on **Base Sepolia testnet only**.

Two layers:
- **TypeScript/Solidity (active)**: Cloudflare-native Web4 platform — React SPA, Hono Workers API, D1 database, 4 Solidity contracts on Base Sepolia, real ASI1 LLM evaluator
- **Python (legacy reference)**: FastAPI monolith with 7 data collectors, 4 evaluator agents, Bradley-Terry aggregation

## Build & Run Commands

### Full-stack dev (both backend + frontend)
```bash
npm run dev
# Backend: http://localhost:8787, Frontend: http://localhost:5173
```

### Backend only (Cloudflare Workers + Hono)
```bash
cd packages/backend
npx wrangler dev --local
```

### Frontend only (React + Vite)
```bash
cd packages/frontend
npm run dev
```

### Database setup (local D1)
```bash
cd packages/backend
npm run db:init    # Create schema
npm run db:seed    # Seed test data
npm run db:reset   # Reset to clean state
```

### Python pipeline (legacy)
```bash
pip install -e .
python run_pipeline.py           # Full 6-step pipeline
uvicorn src.main:app --port 8000 # FastAPI server
```

## Testing

### Smart contract tests (104 tests, Hardhat + Chai)
```bash
npx hardhat test                                    # All contract tests
npx hardhat test test/SQFMechanism.test.js          # Single test file
```

### E2E tests (Playwright, 12/12 passing)
```bash
cd e2e-tests
npx playwright install --with-deps
npx playwright test
# Against custom URL:
E2E_BASE_URL=https://simogrants.com npx playwright test
```

### Python tests
```bash
pytest src/tests/ -v
```

### Linting
```bash
ruff check src/ && ruff format src/     # Python
cd packages/backend && npx tsc --noEmit # TypeScript
```

## Architecture

### Monorepo workspaces (`packages/`)

- **`packages/backend/`** — Cloudflare Workers API (Hono). Routes in `src/routes/` (auth, rounds, projects, evaluations, pipeline, evidence, stats). Core engines in `src/lib/` (evaluator.ts for real ASI1, mockEvaluator.ts for dev, sqf.ts, qf.ts, pheromone.ts, pagerank.ts). SIWE auth middleware. Config in `wrangler.toml`. Bindings: D1 (SQLite), KV (sessions), R2 (evidence), ASI1_API_KEY (secret).
- **`packages/frontend/`** — React 19 SPA on Cloudflare Pages. Design system: Syne (display) + Outfit (body) fonts, amber/teal palette on #0a0a12 charcoal, noise textures, staggered animations. Uses wagmi/viem for Web3 (Base Sepolia only), SIWE for auth, contract hooks in `hooks/useContracts.ts`. API client in `lib/api.ts` auto-transforms snake_case/camelCase. Path alias `@/` → `./src/`. Mock API available via `VITE_USE_MOCK_API=true`.
- **`packages/contracts/`** — Solidity 0.8.24 on Base Sepolia: `GrantFactory` (EIP-1167 proxies), `GrantRound` (lifecycle), `SQFMechanism` (on-chain SQF), `AttestationRegistry` (IPFS CID attestations). Tests in `test/`.

### ASI1 Evaluator (`packages/backend/src/lib/evaluator.ts`)

Real LLM evaluator calling ASI1 Mini (`asi1-mini`) at `https://api.asi1.ai/v1/chat/completions`. Runs 4 stakeholder agents in parallel via `Promise.allSettled`, each scoring 3 dimensions (12 total). Retry with exponential backoff + JSON repair. Falls back to `mockEvaluator.ts` when `ASI1_API_KEY` is not set.

### Frontend-Backend Data Flow

- Frontend `api.ts` sends requests with `toSnakeCase()` transform on body
- Backend Zod schemas accept **both** camelCase and snake_case field names (e.g., `applicationDeadline` and `application_deadline`)
- Backend responses come back in snake_case, frontend `toCamelCase()` transforms on receive
- Auth: SIWE flow → `POST /auth/nonce` (with `{address}`) → sign message → `POST /auth/verify` → Bearer token stored in localStorage

### Smart Contracts (Base Sepolia only)

Frontend connects via wagmi hooks in `hooks/useContracts.ts` — 5 write hooks (createRound, apply, startEvaluation, recordScores, computeSQF) and 6 read hooks (status, applications, pheromone, attestation, factory count). Contract addresses in `lib/contractsConfig.ts` for chain ID 84532.

### Deployment

```bash
# Full deploy
bash scripts/deploy-all.sh

# Backend
cd packages/backend && npx wrangler deploy
npx wrangler secret put ASI1_API_KEY  # Set the ASI1 key

# Frontend (deploy to production)
cd packages/frontend && npm run build
npx wrangler pages deploy dist --project-name=simogrants --branch=main

# Contracts
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
```

## Key Constraints

- **Base Sepolia testnet only** — no mainnet support. Chain ID 84532. wagmi config only includes BASE_SEPOLIA.
- **ASI1 API** — Real evaluator requires `ASI1_API_KEY` secret (set via `npx wrangler secret put` for prod, `.dev.vars` for local)
- **Dual-casing** — Backend Zod schemas must accept both camelCase and snake_case because frontend's `toSnakeCase` transform runs before sending. Always add both field name variants when adding new fields.
- **Auth flow** — `ConnectButton` auto-triggers SIWE signIn when wallet connects without a stored token. `useAuth` restores sessions on mount via `checkSession()`.
- **Dashboard filtering** — Dashboard filters rounds/projects client-side by connected wallet address (creatorAddress/createdBy). The API doesn't support server-side filtering by creator yet.
- Secrets must stay in `.env` / `.dev.vars` — never commit
- Hardhat: Solidity 0.8.24, optimizer 10,000 runs, EVM version `paris`
- Python: ruff for linting (100-char line length), pytest with `asyncio_mode = "auto"`
- Design system: font-display (Syne) for headings, amber-400/500 primary, teal-400 secondary, white/[opacity] surfaces on #0a0a12 base
