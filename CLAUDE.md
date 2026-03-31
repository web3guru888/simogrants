# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SIMOGRANTS is a stigmergic multi-agent evaluation system for Ethereum public goods funding. It evaluates projects using AI stakeholder agents coordinated through pheromone signals, then allocates funds via Stigmergic Quadratic Funding (SQF). The codebase has two layers:

- **Python (original)**: FastAPI monolith with 7 data collectors, 4 LLM evaluator agents, Bradley-Terry aggregation, pheromone/PageRank mechanisms, and on-chain attestation
- **TypeScript/Solidity (PL Genesis rebuild)**: Cloudflare-native Web4 platform with React SPA, Hono Workers API, D1 database, and 4 Solidity contracts on Base

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
npm run db:init    # Create schema
npm run db:seed    # Seed test data
npm run db:reset   # Reset to clean state
```

### Python pipeline (original evaluator)
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

### Python tests
```bash
pytest src/tests/ -v                     # All tests
pytest src/tests/test_api.py -v          # Single file
pytest src/tests/test_api.py::test_name  # Single test
```

### E2E tests (Playwright, tests against live deployment)
```bash
cd e2e-tests
npx playwright install --with-deps
npx playwright test
```

### Linting (Python)
```bash
ruff check src/
ruff format src/
```

### TypeScript type checking
```bash
cd packages/backend && npx tsc --noEmit
```

## Architecture

### Monorepo workspaces (`packages/`)

- **`packages/backend/`** — Cloudflare Workers API (Hono framework). Routes in `src/routes/`, QF/pheromone/PageRank engines in `src/lib/`. Config in `wrangler.toml`. Uses D1 (SQLite), KV (sessions), R2 (evidence storage).
- **`packages/frontend/`** — React 19 SPA deployed to Cloudflare Pages. Uses wagmi/viem for Web3, SIWE for auth, TanStack Query for server state, Tailwind CSS. Vite proxies `/api` to backend in dev. Path alias `@/` → `./src/`.
- **`packages/contracts/`** — Solidity 0.8.24 contracts: `GrantFactory` (EIP-1167 proxy factory), `GrantRound` (round lifecycle), `SQFMechanism` (on-chain SQF), `AttestationRegistry` (evaluation attestations with IPFS CIDs). Tests in root `test/` dir.

### Python pipeline (`src/`)

The pipeline runs 6 sequential steps (see `run_pipeline.py`):
1. **Collection** (`src/collectors/`) — 7 async collectors (GitHub, Etherscan, DefiLlama, Gitcoin, Snapshot, Octant, npm/pypi/crates) orchestrated via `asyncio.gather`
2. **Evaluation** (`src/evaluator/`) — 4 LLM stakeholder agents (developer, user, funder, ecosystem) score on 4 dimensions (impact, feasibility, team quality, innovation)
3. **Aggregation** (`src/evaluator/bradley_terry.py`, `tension.py`) — Pairwise ranking + tension detection (score spread > 35%)
4. **SQF Mechanism** (`src/mechanism/`) — QF × pheromone modifier (20% decay/epoch) × PageRank modifier
5. **Attestation** (`src/blockchain/attestation.py`) — keccak256 hashes, optional publish to Base
6. **Storage** (`src/blockchain/filecoin.py`) — Evidence bundles to Filecoin/web3.storage

### Smart contracts (Base Sepolia)

Deployed to Base Sepolia testnet. Deployment via:
```bash
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network baseSepolia
```

### Deployment

Full deployment script: `bash scripts/deploy-all.sh` (supports `--skip-infra`, `--skip-backend`, `--skip-frontend`, `--skip-contracts`).

Individual deploys:
- Backend: `cd packages/backend && npx wrangler deploy`
- Frontend: `cd packages/frontend && npm run build && npx wrangler pages deploy dist --project-name=simogrants`

## Key Constraints

- Secrets (API keys, private keys) must stay in environment variables / `.env` — never commit them
- The evaluator can use ASI1-compatible chat completions API; mechanism logic is deterministic
- Database is SQLite-backed (D1 on Cloudflare, aiosqlite locally for Python)
- Hardhat config: Solidity 0.8.24, optimizer 10,000 runs, EVM version `paris`
- Python: ruff for linting (100-char line length), pytest with `asyncio_mode = "auto"`
