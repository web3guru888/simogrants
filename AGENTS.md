# AGENTS.md

## Project
SIMOGRANTS — Stigmergic Impact Oracle for Public Goods

## What this system does
SIMOGRANTS evaluates Ethereum public goods projects using ASI1-powered multi-agent evaluation on Base Sepolia:
1. Collect project applications via Web3 frontend (SIWE auth)
2. Run 4 ASI1 stakeholder evaluations in parallel (Developer, User, Funder, Ecosystem)
3. Aggregate scores using Bradley-Terry pairwise ranking
4. Compute SQF allocation with persistent pheromone trails + PageRank modifiers
5. Attest evaluation hashes on-chain (keccak256 + optional IPFS CID)

## Primary entrypoints
- Frontend SPA: `packages/frontend/src/App.tsx`
- Backend API: `packages/backend/src/index.ts`
- Evaluator: `packages/backend/src/lib/evaluator.ts`
- SQF Engine: `packages/backend/src/lib/sqfWithPheromone.ts`
- Smart Contracts: `packages/contracts/contracts/`

## Capabilities
- ASI1 Mini LLM evaluation (4 agents, 12 dimensions, parallel)
- Bradley-Terry pairwise ranking
- Stigmergic QF with persistent pheromone state across rounds
- Anti-Goodhart dimension rotation per epoch
- On-chain attestation hash computation
- IPFS evidence upload (web3.storage)
- R2 evidence storage
- SIWE wallet authentication
- Smart contract integration (GrantFactory, GrantRound, SQFMechanism, AttestationRegistry)

## Key routes
- `GET /api/health` — Health check
- `GET /api/rounds` — List grant rounds
- `POST /api/rounds` — Create round (auth required)
- `POST /api/rounds/:id/evaluate` — Trigger ASI1 evaluation (auth required)
- `GET /api/rounds/:id/results` — View ranked results with SQF allocations
- `POST /api/auth/nonce` — SIWE authentication
- `GET /api/stats` — Platform statistics

## Models / engines
- ASI1 Mini (`asi1-mini`) via `https://api.asi1.ai/v1/chat/completions`
- SQF mechanism uses deterministic numeric logic (QF x pheromone x PageRank)
- Database: Cloudflare D1 (SQLite at edge)
- Sessions: Cloudflare KV
- Evidence: Cloudflare R2

## Constraints
- Base Sepolia testnet only (chain ID 84532)
- Secrets must stay in environment variables / `.dev.vars`
- Never request private keys
- Backend Zod schemas must accept both camelCase and snake_case field names
