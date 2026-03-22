# SIMOGRANTS — Build Plan & Status Tracker

## Project
**SIMOGRANTS: Stigmergic Impact Oracle for Public Goods**
An autonomous multi-agent system that evaluates Ethereum public goods projects using Simocratic stakeholder evaluation and Stigmergic Quadratic Funding.

## Hackathon
- **Name:** The Synthesis
- **Base URL:** https://synthesis.devfolio.co
- **Duration:** 14 days
- **Tracks:** Octant ×3, Protocol Labs ×2, Filecoin, Open Track
- **Prize ceiling:** ~$36,134

## Target Tracks
1. Mechanism Design for Public Goods Evaluation (Octant) — $1,000
2. Agents for Public Goods Data Collection (Octant) — $1,000
3. Agents for Public Goods Data Analysis (Octant) — $1,000
4. Let the Agent Cook (Protocol Labs) — $2,000
5. Agents With Receipts — ERC-8004 (Protocol Labs) — $2,000
6. Best Use Case with Agentic Storage (Filecoin) — $1,000
7. Synthesis Open Track — $28,134

## Team
orchestrator → collector-agent, evaluator-agent, mechanism-agent, blockchain-agent, docs-agent

---

## Day 0 — Setup & Registration
- [x] Write PLAN.md
- [x] Read all 4 whitepaper files
- [x] Create whitepaper directory with summaries
- [x] Create 5 specialist child agents with focused system prompts
- [x] Initialize src/ project structure (FastAPI skeleton, /health, /version)
- [x] Install Python dependencies (fastapi, httpx, scipy, networkx, etc.)
- [x] Verify tests pass on skeleton
- [x] Create CONVERSATION_LOG.md
- [x] Register for hackathon (Robin Dey, robin@vbrl.ai)
- [x] Create team (auto-created: ae5b8d92c61e4addbec619ca88aede22)
- [x] Get API key (stored in /workspace/.env)
- [x] Registration on-chain: https://basescan.org/tx/0x34dccac02871dad70516a6a390a3c8f3ec13be210bf2e801b2f74178ee99225d
- [x] Identified all 7 target track UUIDs

## Day 1–2 — Data Collection Layer (collector-agent)
- [ ] models.py — ProjectProfile dataclass, all field types
- [ ] base.py — BaseCollector ABC with httpx.AsyncClient
- [ ] collector_github.py — GitHub REST/GraphQL collector
- [ ] collector_etherscan.py — Etherscan multi-chain collector
- [ ] collector_defillama.py — DefiLlama TVL/protocol collector
- [ ] collector_gitcoin.py — Gitcoin grants/passport collector
- [ ] collector_snapshot.py — Snapshot governance collector
- [ ] collector_octant.py — Octant allocation data collector
- [ ] collector_packages.py — npm/crates/pypi download stats
- [ ] collector_orchestrator.py — Parallel collection with data_completeness
- [ ] tests/ — Unit tests for all collectors (mock responses)

## Day 3–4 — Evaluation Layer (evaluator-agent)
- [ ] stakeholder_prompts.py — 4 stakeholder agent system prompts
- [ ] evaluator_engine.py — LLM evaluation with structured output
- [ ] bradley_terry.py — Pairwise comparison + aggregation (scipy)
- [ ] tension_detector.py — Spread > 35 detection, narrative generation
- [ ] consensus_builder.py — Final score computation
- [ ] tests/ — Unit tests for evaluation pipeline

## Day 5–6 — SQF Mechanism (mechanism-agent)
- [ ] qf_engine.py — Standard QF calculation
- [ ] pheromone_tracker.py — Pheromone state (0-10, decay 20%/epoch)
- [ ] pagerank_engine.py — Dependency graph PageRank (networkx)
- [ ] sqf_formula.py — QF × Pheromone_Modifier × PageRank_Modifier
- [ ] anti_goodhart.py — Dimension rotation logic
- [ ] backtesting.py — Historical simulation engine
- [ ] tests/ — Unit tests for mechanism

## Day 7–8 — Integration & API
- [ ] Wire collector → evaluator → mechanism pipeline
- [ ] Implement all FastAPI endpoints (20+)
- [ ] SQLite persistence layer (database.py)
- [ ] Pydantic request/response models
- [ ] Run end-to-end with 5 test projects
- [ ] API tests

## Day 9–10 — On-Chain Layer (blockchain-agent)
- [x] SIMOGrantsAttestation.sol — Solidity contract
- [x] Deploy script — Base testnet → mainnet
- [x] Filecoin upload — Evidence bundles
- [x] ERC-8004 compliance — On-chain receipts
- [x] On-chain publication flow
- [x] Hardhat tests (79/79 green across JS + Python tests)

## Day 11–12 — Full Pipeline & Polish
- [ ] Run full pipeline: 30 real Ethereum projects
- [ ] Generate all on-chain attestations
- [ ] Filecoin evidence bundles for all 30
- [ ] Performance optimization
- [ ] Error handling & edge cases

## Day 13 — Documentation & Submission (docs-agent)
- [ ] README.md (comprehensive)
- [ ] API documentation
- [ ] Demo video script + recording
- [ ] Moltbook post
- [ ] Conversation log polish
- [ ] Submission metadata

## Day 14 — Submit
- [ ] Create project on hackathon platform
- [ ] Publish submission
- [ ] Final verification
- [ ] Self-custody transfer if needed

---

## ⚡ COMPRESSED TIMELINE — 38 HOURS
Deadline: March 22, 11:59 PM PST (March 23, 06:59 UTC)

### Sprint 1: PARALLEL BUILD (Hours 0-12) — NOW
- [x] collector-agent: models + all 7 collectors + orchestrator + tests
- [x] evaluator-agent: prompts + engine + bradley-terry + tension + tests (patched after merge)
- [x] mechanism-agent: qf + pheromone + pagerank + sqf + anti-goodhart + backtest + tests (rebuilt locally after rate-limit issues)
- [x] orchestrator: database.py, API routers, integration wiring

### Sprint 2: INTEGRATION (Hours 12-24)
- [x] Merge all agent code into src/
- [x] Wire end-to-end pipeline
- [x] blockchain-agent: Solidity contract + Base deploy + Filecoin
- [ ] Run on 5-10 real projects
- [ ] Create GitHub repo, push code

### Sprint 3: SUBMIT (Hours 24-38)
- [ ] Run full pipeline on 30 projects
- [ ] docs-agent: README, AGENTS.md, submission metadata
- [ ] ERC-8004 self-custody transfer (need wallet address from Robin)
- [ ] Create draft project on platform
- [ ] Moltbook post
- [ ] Publish project
- [ ] Keep live for judging (March 23-25)

## Status
**Current Phase:** Sprint 2 — INTEGRATION + SMOKE TESTING 🔥
**Last Updated:** 2026-03-21T16:48Z
**Deadline:** March 22, 11:59 PM PST (~38 hours)
**Blockers:** Need wallet address from Robin for ERC-8004 transfer before publish
**Registration TX:** https://basescan.org/tx/0x34dccac02871dad70516a6a390a3c8f3ec13be210bf2e801b2f74178ee99225d
