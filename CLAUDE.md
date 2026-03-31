# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SIMOGRANTS is a stigmergic multi-agent evaluation system for Ethereum public goods funding. ASI1-powered AI agents evaluate projects through pheromone-coordinated signals, then allocate funds via Stigmergic Quadratic Funding (SQF). The platform runs on **Base Sepolia testnet only**.

The active codebase is in `packages/` (TypeScript/Solidity). Legacy Python code and hackathon artifacts are preserved in `archived/`.

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

### TypeScript type checking
```bash
cd packages/backend && npx tsc --noEmit
```

## Architecture

### Monorepo workspaces (`packages/`)

- **`packages/backend/`** — Cloudflare Workers API (Hono). Routes in `src/routes/` (auth, rounds, projects, evaluations, pipeline, evidence, stats). Core engines in `src/lib/` (evaluator.ts, sqf.ts, sqfWithPheromone.ts, bradleyTerry.ts, antiGoodhart.ts, attestation.ts, ipfs.ts, pheromone.ts, pagerank.ts, qf.ts). Bindings: D1, KV, R2, ASI1_API_KEY, WEB3_STORAGE_TOKEN.
- **`packages/frontend/`** — React 19 SPA on Cloudflare Pages. Design: Syne + Outfit fonts, amber/teal on #0a0a12. wagmi/viem (Base Sepolia only), SIWE auth, contract hooks in `hooks/useContracts.ts`. API client in `lib/api.ts` auto-transforms snake/camelCase. Path alias `@/` = `./src/`.
- **`packages/contracts/`** — Solidity 0.8.24 on Base Sepolia: GrantFactory, GrantRound, SQFMechanism, AttestationRegistry. 104 tests.

### ASI1 Evaluator (`packages/backend/src/lib/evaluator.ts`)

Calls ASI1 Mini (`asi1-mini`) at `https://api.asi1.ai/v1/chat/completions`. 4 stakeholder agents in parallel, 12 dimensions, retry with backoff + JSON repair. Falls back to mock when `ASI1_API_KEY` is not set.

### SQF Pipeline

1. ASI1 evaluates all projects in parallel
2. Bradley-Terry ranking computes pairwise strength parameters
3. SQF allocates: `QF_Base x Pheromone_Modifier x PageRank_Modifier`
4. Pheromone state persisted to D1 (loads previous, decays 20%/epoch, deposits by accuracy)
5. Attestation hashes computed (keccak256 per project + round-level hash)
6. IPFS upload if WEB3_STORAGE_TOKEN configured

### Key Data Flow

- Frontend `toSnakeCase()` on request body → Backend Zod accepts both casings → Backend responds snake_case → Frontend `toCamelCase()` on response
- Auth: SIWE `POST /auth/nonce` → sign → `POST /auth/verify` → Bearer token in localStorage
- ConnectButton auto-triggers signIn when wallet reconnects without token

### Deployment

```bash
bash scripts/deploy-all.sh              # Full deploy
cd packages/backend && npx wrangler deploy   # Backend only
cd packages/frontend && npm run build && npx wrangler pages deploy dist --project-name=simogrants --branch=main  # Frontend only
```

### Database Operations

```bash
npx wrangler d1 execute simogrants-db --remote --command="SELECT id, title, status FROM rounds"
npx wrangler kv key put "session:sim-token" '{"address":"0x...","chainId":84532,"expiresAt":"2027-01-01T00:00:00Z"}' --namespace-id d795fd0e52154eabb348f65ebb8bad26 --remote
```

## Key Constraints

- **Base Sepolia only** — chain ID 84532, no mainnet
- **ASI1_API_KEY** — secret for real evaluator (`.dev.vars` locally, `wrangler secret put` for prod)
- **Dual-casing** — Backend Zod schemas must accept both camelCase and snake_case for all fields
- **Dashboard** — filters client-side by wallet address (no server-side creator filter yet)
- Design: `font-display` (Syne) for headings, amber-400/500 primary, teal-400 secondary

## Directory Structure

```
simogrants/
  packages/
    backend/         # Cloudflare Workers API (Hono + TypeScript)
    frontend/        # React 19 SPA (Cloudflare Pages)
    contracts/       # Solidity 0.8.24 (Base Sepolia)
  e2e-tests/         # Playwright E2E suite (12 tests)
  scripts/           # deploy-all.sh, setup-d1.sh
  whitepaper/        # Mechanism design docs
  archived/          # Legacy Python backend, hackathon data, review docs
  CLAUDE.md          # This file
  README.md          # Project overview + API reference
```

See `archived/README.md` for details on archived content.
