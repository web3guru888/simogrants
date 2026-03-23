# SIMOGRANTS Whitepaper — Part 1: Architecture & System Overview

## 1. Abstract

SIMOGRANTS (Stigmergic Impact Oracle for Grants) is an autonomous multi-agent system that evaluates Ethereum public goods projects for funding allocation. It combines:

1. **Simocratic Multi-Agent Evaluation** — Multiple LLM-powered stakeholder agents evaluate projects from different perspectives, then aggregate via Bradley-Terry pairwise comparison
2. **Stigmergic Quadratic Funding (SQF)** — A novel funding mechanism that extends standard QF with pheromone-based learning and PageRank attribution
3. **On-Chain Attestation** — Immutable evaluation records on Base with evidence bundles on Filecoin

The system processes 30+ Ethereum public goods projects end-to-end: collecting data from 7 sources, evaluating via 4 stakeholder perspectives, computing optimal funding allocation, and publishing cryptographic attestations on-chain.

## 2. Problem Statement

Current public goods funding mechanisms suffer from:
- **Popularity bias** — QF rewards projects that mobilize small donors, not necessarily those with highest impact
- **Evaluation opacity** — Funding decisions lack transparent, multi-perspective analysis
- **Static allocation** — No learning from historical accuracy; same mistakes repeat
- **Sybil vulnerability** — QF matching is gameable through identity multiplication
- **Goodhart's Law** — Metrics become targets, distorting genuine impact measurement

SIMOGRANTS addresses each through its three-layer architecture.

## 3. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SIMOGRANTS API                     │
│                  (FastAPI + SQLite)                   │
├─────────────┬──────────────┬────────────────────────┤
│  Layer 1    │   Layer 2    │       Layer 3           │
│  COLLECTOR  │  ANALYZER    │     MECHANISM           │
│             │              │                         │
│ 7 Data      │ 4 Stakeholder│  Stigmergic QF         │
│ Sources     │ Agents       │  = QF × Pheromone      │
│ (async)     │ + Bradley-   │    × PageRank          │
│             │   Terry      │  + Anti-Goodhart       │
├─────────────┴──────────────┴────────────────────────┤
│              ON-CHAIN LAYER                          │
│  Base Attestation Contract + Filecoin Evidence       │
└─────────────────────────────────────────────────────┘
```

### 3.1 Technology Stack

- **Runtime:** Python 3.11+
- **API Framework:** FastAPI with uvicorn
- **Database:** SQLite (via aiosqlite for async)
- **HTTP Client:** httpx (async)
- **LLM:** ASI1-mini via ASI1 API (https://api.asi1.ai/v1/chat/completions)
- **Math:** scipy (Bradley-Terry, optimization), numpy
- **Graph:** networkx (PageRank, dependency graphs)
- **Blockchain:** Solidity 0.8.20+, ethers.js, Hardhat
- **Storage:** Filecoin (via web3.storage or lighthouse)

### 3.2 Data Flow

```
Input: project_identifier (GitHub URL, ENS name, or contract address)
  │
  ├─► Collector Layer (parallel async, ~10s)
  │     ├─ GitHub API → repo stats, contributors, commit velocity
  │     ├─ Etherscan API → contract deployments, tx volume, TVL
  │     ├─ DefiLlama → protocol TVL, revenue, chain coverage
  │     ├─ Gitcoin → grants history, unique donors, passport scores
  │     ├─ Snapshot → governance proposals, voter participation
  │     ├─ Octant → epoch allocations, community support
  │     └─ Package registries → npm/crates/pypi download stats
  │     Result: ProjectProfile dataclass
  │
  ├─► Evaluation Layer (~30s per project)
  │     ├─ Developer Agent → code quality, maintenance, security
  │     ├─ User Agent → adoption, UX, community engagement
  │     ├─ Funder Agent → capital efficiency, sustainability, ROI
  │     └─ Ecosystem Agent → composability, network effects, alignment
  │     ├─ Pairwise Comparison → Bradley-Terry aggregation
  │     └─ Tension Detection → flag disagreements (spread > 35)
  │     Result: EvaluationResult with scores + narratives
  │
  ├─► Mechanism Layer (~5s for full pool)
  │     ├─ Standard QF baseline
  │     ├─ Pheromone modifier (historical accuracy learning)
  │     ├─ PageRank modifier (dependency graph attribution)
  │     ├─ Anti-Goodhart rotation (dimension weight shuffling)
  │     └─ Final allocation computation
  │     Result: FundingAllocation per project
  │
  └─► On-Chain Layer (~60s for attestation)
        ├─ Compute evaluation hash
        ├─ Upload evidence bundle to Filecoin
        ├─ Publish attestation to Base contract
        └─ Return transaction receipt
        Result: OnChainAttestation with txHash + CID
```

### 3.3 Core Design Principles

1. **Transparency** — Every evaluation step produces explainable artifacts
2. **Composability** — Each layer works independently and can be used by other systems
3. **Learning** — Pheromone system improves allocation accuracy over time
4. **Robustness** — Anti-Goodhart rotation prevents metric gaming
5. **Verifiability** — On-chain attestations enable third-party auditing

### 3.4 Configuration

All parameters are configurable via `config.yaml`:

```yaml
collector:
  timeout_seconds: 30
  max_concurrent: 7
  cache_ttl_hours: 24

evaluator:
  model: "asi1-mini"
  temperature: 0.3
  max_tokens: 4096
  stakeholder_agents:
    - developer
    - user
    - funder
    - ecosystem
  pairwise_comparisons: true
  tension_threshold: 35

mechanism:
  matching_pool: 100000  # in USD
  pheromone:
    initial: 5.0
    min: 0.0
    max: 10.0
    decay_rate: 0.2  # 20% per epoch
    deposit_rate: 0.5
  pagerank:
    damping: 0.85
    max_iterations: 100
    convergence: 1e-6
  anti_goodhart:
    rotation_interval_epochs: 5
    dimension_count: 12
    active_dimensions: 8

blockchain:
  chain: "base"
  chain_id: 8453
  rpc_url: "https://mainnet.base.org"
  contract_address: ""  # filled after deployment
  filecoin_gateway: "https://api.web3.storage"

api:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["*"]
```
