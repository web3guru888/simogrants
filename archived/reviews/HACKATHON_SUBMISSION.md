# 🏆 SIMOGRANTS — Hackathon Submission

## PL_Genesis: Frontiers of Collaboration
### DoraHacks | Deadline: April 1, 2026 @ 6:59 AM UTC

---

## 📝 Project Summary

**SIMOGRANTS (Stigmergic Impact Oracle for Grants)** is an autonomous multi-agent evaluation system for Ethereum public goods funding. Originally built for The Synthesis hackathon as a Python/FastAPI application with live attestations on Base mainnet, we've completely rebuilt it as a **Cloudflare-native Web4 platform** — demonstrating how decentralized grant evaluation can scale to serve the entire Ethereum ecosystem.

### The Problem
Grant evaluation for public goods is slow, opaque, and centralized. Reviewers are biased, overloaded, and inconsistent. The Ethereum ecosystem needs a trustless, reproducible, and game-theory-resilient way to evaluate thousands of funding proposals.

### Our Solution
SIMOGRANTS uses **stigmergic coordination** — the same mechanism ants use to build colonies — to create an emergent, transparent evaluation framework. Specialized AI agents independently evaluate projects across multiple dimensions (impact, feasibility, team, innovation) and coordinate through a shared "pheromone" signal system. The result is a funding recommendation that's transparent, reproducible, and resistant to gaming.

---

## 🆕 What's New for PL_Genesis

### From Python to Cloudflare (Complete Rewrite)
| | Before (Existing Code) | After (PL_Genesis) |
|---|---|---|
| **Backend** | Python 3.12 / FastAPI | Cloudflare Workers / TypeScript |
| **Database** | aiosqlite (local SQLite) | Cloudflare D1 (edge SQLite) |
| **Storage** | web3.storage | Cloudflare R2 |
| **Sessions** | In-memory | Cloudflare KV |
| **Frontend** | None (API-only) | React 19 / Vite / Tailwind / wagmi |
| **Auth** | None | SIWE (Sign-In with Ethereum) |
| **Contracts** | Single attestation contract | 4-contract system (Factory, Round, SQF, Attestation) |
| **Infrastructure** | Render.com (single server) | Cloudflare Pages + Workers (edge) |
| **Architecture** | Monolithic Python app | Full-stack TypeScript monorepo |

### New Features Built
1. **Web3 Authentication** — SIWE-based wallet login via MetaMask
2. **Full React SPA** — 8 pages: Landing, Browse Rounds, Round Detail, Create Round, Apply, Dashboard, Project Detail, Round Results
3. **GrantFactory Smart Contract** — EIP-1167 minimal proxy pattern for scalable round creation
4. **SQF Mechanism** — On-chain quadratic funding with pheromone signal integration
5. **AttestationRegistry** — Evaluation results stored as on-chain attestations on Base
6. **Edge-Native Storage** — D1 for data, KV for sessions, R2 for evidence bundles
7. **Quadratic Funding Engine** — Ported from Python to TypeScript, running on Cloudflare Workers
8. **PageRank Scoring** — Dependency graph analysis for project evaluation
9. **Real-time Pipeline** — Multi-agent evaluation with live status tracking

### What We Extended from Existing Code
- **Evaluation Engine** — The core stigmergic multi-agent evaluation logic from `src/evaluator/engine.py`
- **SQF Algorithm** — Sequential Quadratic Funding from `src/mechanism/sqf.py`
- **Pheromone Signal System** — From `src/mechanism/pheromone.py`
- **Domain Knowledge** — Grant evaluation criteria, stakeholder weighting, tension detection
- **Base Network Integration** — Existing Base mainnet attestations (5 live attestations)

---

## 🎯 Tracks & Bounties

### Primary Track: Existing Code ($50,000 — $5K × top 10)
We took an **operational codebase** (88 source files, tests passing, live API, deployed to Base mainnet with 5 real attestations) and **completely rebuilt it** for a new platform paradigm. This is a textbook "Existing Code" submission — massive extension, new tech stack, new capabilities.

### Focus Area: Crypto ($6,000 — $3K/$2K/$1K)
- Web3 wallet authentication (SIWE)
- Smart contracts on Base (GrantFactory, GrantRound, SQFMechanism, AttestationRegistry)
- On-chain evaluation attestations
- USDC/USDT support for matching pools

### Focus Area: Infrastructure & Digital Rights ($6,000 — $3K/$2K/$1K)
- Decentralized and trustless grant evaluation
- Transparent, reproducible scoring methodology
- Censorship-resistant (edge-deployed, on-chain data)
- No single point of failure or control

### Filecoin Bounty ($2,500)
- Evidence bundle storage architecture supports IPFS/Filecoin integration
- R2 storage backend is designed to be swappable to web3.storage/Filecoin

### Storacha Bounty ($500)
- Same evidence storage architecture supports Storacha (formerly web3.storage v2)

### Hypercerts Bounty (TBD)
- Evaluation results can be minted as Hypercerts (evaluation impact credentials)
- AttestationRegistry stores all data needed for Hypercert minting

### Community Vote Bounty ($1,000)
- Engaging demo with real on-chain data
- Active X/Twitter presence

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| **Live Demo** | https://simogrants.pages.dev |
| **Custom Domain** | https://simogrants.com |
| **Backend API** | https://simogrants-api.jingjai.workers.dev/api |
| **API Health** | https://simogrants-api.jingjai.workers.dev/api/health |
| **Repository** | https://github.com/web3guru888/simogrants/tree/pl-genesis-hackathon |
| **Branch** | `pl-genesis-hackathon` |

### Contract Addresses (Base Sepolia)
| Contract | Address | Explorer |
|----------|---------|----------|
| GrantFactory | `0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA` | [BaseScan](https://sepolia.basescan.org/address/0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA) |
| GrantRound (Impl) | `0x27E39D006baAbD15f38D8Ecf63Dd61086affeC66` | [BaseScan](https://sepolia.basescan.org/address/0x27E39D006baAbD15f38D8Ecf63Dd61086affeC66) |
| SQFMechanism | `0x77FFD92fbD6720Dc1cE504B971E9AbdDd7F5b1BA` | [BaseScan](https://sepolia.basescan.org/address/0x77FFD92fbD6720Dc1cE504B971E9AbdDd7F5b1BA) |
| AttestationRegistry | `0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9` | [BaseScan](https://sepolia.basescan.org/address/0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9) |
| DemoGrantRound | `0x09b246c9F8Eb9eDf04875228A6214D9bb0f4322A` | [BaseScan](https://sepolia.basescan.org/address/0x09b246c9F8Eb9eDf04875228A6214D9bb0f4322A) |

---

## 📊 Technical Metrics

| Metric | Value |
|--------|-------|
| Total new files | 70 |
| New code lines | ~11,000 |
| Smart contracts | 4 (1,167 lines Solidity) |
| Contract tests | 104 (all passing) |
| API endpoints | 15+ |
| Frontend pages | 8 |
| React components | 8 |
| Database tables | 7 |
| Seed data records | 10+ |
| Cloudflare services used | 5 (Workers, D1, KV, R2, Pages) |
| Blockchain networks | Base Sepolia (+ Base mainnet attestations from v1) |

---

## 🏗️ Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4, wagmi 2, viem 2, SIWE, React Router 7, TanStack Query
- **Backend:** Cloudflare Workers, TypeScript, Hono-style router
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Sessions:** Cloudflare KV
- **Storage:** Cloudflare R2
- **Smart Contracts:** Solidity 0.8.20+, Hardhat, OpenZeppelin 5
- **Blockchain:** Base (Ethereum L2)
- **Deployment:** Wrangler CLI, Cloudflare Pages

---

## 👥 Team

Built by the SIMOGRANTS team for PL_Genesis: Frontiers of Collaboration on DoraHacks.

### Sponsors & Tools
- **Cloudflare** — Workers, Pages, D1, KV, R2
- **Base** — Ethereum L2 network
- **OpenZeppelin** — Smart contract library
- **DoraHacks** — Hackathon platform
