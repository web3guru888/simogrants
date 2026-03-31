# SIMOGRANTS — Build Plan & Status

## Project
**SIMOGRANTS: Stigmergic Impact Oracle for Public Goods**
ASI1-powered multi-agent evaluation system for Ethereum public goods funding on Base Sepolia.

## Live Deployment
- **Frontend**: https://simogrants.com (Cloudflare Pages)
- **Backend API**: https://simogrants-api.jingjai.workers.dev/api (Cloudflare Workers)
- **Blockchain**: Base Sepolia (chain ID 84532)
- **Repo**: https://github.com/web3guru888/simogrants/tree/pl-genesis-hackathon

## Architecture
```
React SPA (Pages) → Hono API (Workers) → ASI1 LLM + D1/KV/R2 → Base Sepolia Contracts
```

## Completed Features

### Core Platform
- [x] Cloudflare Workers backend (Hono, D1, KV, R2)
- [x] React 19 frontend (Vite, Tailwind, wagmi/viem)
- [x] SIWE wallet authentication
- [x] Grant round CRUD (create, browse, apply, evaluate, results)
- [x] Dashboard with wallet-filtered data

### ASI1 Evaluation
- [x] Real ASI1 Mini LLM integration (4 agents, 12 dimensions, parallel)
- [x] Bradley-Terry pairwise ranking
- [x] Persistent pheromone trails (decay + deposit across rounds)
- [x] Anti-Goodhart dimension rotation per epoch
- [x] Attestation hash computation (keccak256)
- [x] IPFS evidence upload (web3.storage, when token configured)

### Smart Contracts (Base Sepolia)
- [x] GrantFactory (EIP-1167 minimal proxies)
- [x] GrantRound (application lifecycle)
- [x] SQFMechanism (on-chain SQF computation)
- [x] AttestationRegistry (evaluation attestations)
- [x] 104 Hardhat tests passing

### Frontend Design
- [x] Custom design system: Syne + Outfit fonts, amber/teal palette
- [x] Noise textures, dot grid, pheromone trail SVGs
- [x] Staggered fade-up animations
- [x] Mobile responsive, accessibility (ARIA roles)

### Testing & QA
- [x] 12/12 Playwright E2E tests passing
- [x] 64/64 custom live E2E tests passing
- [x] 104 contract tests passing
- [x] Zero console errors on production

### Infrastructure
- [x] Custom domain (simogrants.com, SSL)
- [x] Cloudflare D1 + KV + R2 bindings
- [x] ASI1_API_KEY secret deployed
- [x] Full deployment scripts (deploy-all.sh)

## Hackathon History

Originally built for "The Synthesis" hackathon as a Python/FastAPI monolith (Days 0-13), then rebuilt as a Cloudflare-native Web4 platform for PL_Genesis. The original Python codebase is preserved in `archived/python-backend/` for reference.
