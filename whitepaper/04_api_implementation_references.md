# SIMOGRANTS Whitepaper — Part 4: API Design, Implementation Guide & References

## 8. API Design

### 8.1 FastAPI Application Structure

```
src/
├── main.py                    # FastAPI app, CORS, lifespan
├── config.py                  # Configuration management
├── models.py                  # Pydantic models for API
├── database.py                # SQLite + aiosqlite
├── routers/
│   ├── health.py              # /health, /version
│   ├── projects.py            # /projects CRUD
│   ├── evaluate.py            # /evaluate endpoints
│   ├── mechanism.py           # /mechanism endpoints
│   └── attestations.py        # /attestations endpoints
├── collectors/
│   ├── base.py                # BaseCollector ABC
│   ├── github.py              # GitHub collector
│   ├── etherscan.py           # Etherscan collector
│   ├── defillama.py           # DefiLlama collector
│   ├── gitcoin.py             # Gitcoin collector
│   ├── snapshot.py            # Snapshot collector
│   ├── octant.py              # Octant collector
│   ├── packages.py            # npm/pypi/crates collector
│   └── orchestrator.py        # Parallel orchestration
├── evaluator/
│   ├── prompts.py             # Stakeholder system prompts
│   ├── engine.py              # LLM evaluation engine
│   ├── bradley_terry.py       # BT aggregation
│   └── tension.py             # Tension detection
├── mechanism/
│   ├── qf.py                  # Standard QF
│   ├── pheromone.py           # Pheromone tracker
│   ├── pagerank.py            # PageRank engine
│   ├── sqf.py                 # Combined SQF
│   ├── anti_goodhart.py       # Dimension rotation
│   └── backtest.py            # Backtesting engine
├── blockchain/
│   ├── deployer.py            # Contract deployment
│   ├── attester.py            # Attestation publisher
│   └── filecoin.py            # Filecoin upload
└── tests/
    ├── test_collectors.py
    ├── test_evaluator.py
    ├── test_mechanism.py
    ├── test_api.py
    └── conftest.py
```

### 8.2 API Endpoints

#### Health & Info
```
GET  /health                → {"status": "ok", "version": "1.0.0"}
GET  /version               → {"version": "1.0.0", "components": {...}}
```

#### Project Management
```
POST   /projects                       → Create project entry
GET    /projects                       → List all projects
GET    /projects/{project_id}          → Get project details
DELETE /projects/{project_id}          → Delete project
```

#### Data Collection
```
POST /projects/{project_id}/collect    → Trigger data collection
GET  /projects/{project_id}/profile    → Get collected ProjectProfile
POST /collect/batch                    → Collect data for multiple projects
```

#### Evaluation
```
POST /projects/{project_id}/evaluate   → Run stakeholder evaluation
GET  /projects/{project_id}/evaluation → Get evaluation results
POST /evaluate/batch                   → Evaluate multiple projects
GET  /projects/{project_id}/tensions   → Get tension analysis
POST /evaluate/compare                 → Pairwise compare two projects
```

#### Mechanism
```
POST /mechanism/allocate               → Compute SQF allocation for pool
GET  /mechanism/pheromone              → Get current pheromone state
POST /mechanism/epoch/advance          → Advance epoch (decay + deposit)
GET  /mechanism/pagerank               → Get PageRank scores
POST /mechanism/backtest               → Run backtesting simulation
GET  /mechanism/config                 → Get mechanism parameters
```

#### On-Chain
```
POST /attestations/publish             → Publish attestation on-chain
GET  /attestations/{project_id}        → Get attestation history
POST /attestations/batch               → Batch publish attestations
GET  /attestations/verify/{tx_hash}    → Verify attestation
```

#### Full Pipeline
```
POST /pipeline/run                     → Run full pipeline for project(s)
GET  /pipeline/status/{run_id}         → Check pipeline run status
GET  /pipeline/results/{run_id}        → Get pipeline results
```

### 8.3 Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import Optional

class ProjectCreate(BaseModel):
    name: str
    description: str
    github_url: Optional[str] = None
    contract_addresses: Optional[list[str]] = None
    defillama_slug: Optional[str] = None
    snapshot_space: Optional[str] = None
    package_names: Optional[dict[str, str]] = None

class EvaluationRequest(BaseModel):
    project_id: str
    force_recollect: bool = False

class AllocationRequest(BaseModel):
    project_ids: list[str]
    matching_pool: float = 100000.0
    contributions: Optional[dict[str, list[float]]] = None

class AttestationRequest(BaseModel):
    project_id: str
    evaluation_id: str

class PipelineRequest(BaseModel):
    projects: list[ProjectCreate]
    matching_pool: float = 100000.0
    publish_onchain: bool = True
```

---

## 9. Implementation Guide

### 9.1 Build Order (14-day plan)

**Phase 1: Foundation (Days 1–2)**
- Set up FastAPI skeleton with /health endpoint
- Implement ProjectProfile dataclass and all models
- Build all 7 collectors with error handling
- Write collector tests with mocked responses
- Implement CollectionOrchestrator

**Phase 2: Intelligence (Days 3–4)**  
- Build 4 stakeholder agent prompts
- Implement EvaluationEngine with LLM calls
- Build Bradley-Terry aggregation
- Implement tension detection
- Write evaluation tests

**Phase 3: Mechanism (Days 5–6)**
- Implement QF engine
- Build pheromone tracker with persistence
- Implement PageRank engine
- Combine into SQF formula
- Add anti-Goodhart rotation
- Build backtesting engine
- Write mechanism tests

**Phase 4: Integration (Days 7–8)**
- Wire all layers together
- Implement all API endpoints
- Add SQLite persistence
- Run end-to-end with 5 test projects
- API integration tests

**Phase 5: Blockchain (Days 9–10)**
- Write Solidity attestation contract
- Deploy to Base testnet → mainnet
- Implement Filecoin upload
- Build on-chain publication flow
- ERC-8004 compliance

**Phase 6: Production (Days 11–12)**
- Run full pipeline: 30 real projects
- Generate all attestations
- Performance optimization
- Error handling & edge cases

**Phase 7: Submission (Days 13–14)**
- Documentation (README, API docs)
- Demo video
- Moltbook post
- Submission metadata
- Publish to hackathon

### 9.2 Project List (30 Ethereum Public Goods)

Target projects for evaluation:
1. Uniswap
2. Aave
3. Compound
4. MakerDAO
5. Lido
6. Ethereum Name Service (ENS)
7. Gnosis Safe
8. OpenZeppelin
9. Ethers.js
10. Hardhat
11. Foundry
12. The Graph
13. Chainlink
14. Gitcoin
15. Protocol Guild
16. EthStaker
17. Optimism (OP Stack)
18. Arbitrum
19. Polygon
20. Base
21. Filecoin/FVM
22. IPFS
23. libp2p
24. Wagmi/Viem
25. RainbowKit
26. WalletConnect
27. Snapshot
28. Mirror
29. Zora
30. Nouns DAO

### 9.3 Testing Strategy

- **Unit tests:** Each module independently tested with mocks
- **Integration tests:** Layer-to-layer data flow
- **End-to-end:** Full pipeline with real API calls (subset of 5 projects)
- **Backtesting:** Multi-epoch simulation with synthetic data
- **On-chain tests:** Hardhat local network for contract testing

---

## 10. Configuration Reference

```yaml
# config.yaml — Full configuration reference

# API Keys (from environment variables)
env:
  ANTHROPIC_API_KEY: ""           # For LLM evaluations
  GITHUB_TOKEN: ""                # GitHub API (optional, higher rate limits)
  ETHERSCAN_API_KEY: ""           # Etherscan API
  WEB3_STORAGE_TOKEN: ""          # Filecoin uploads
  BASE_RPC_URL: ""                # Base chain RPC
  DEPLOYER_PRIVATE_KEY: ""        # Contract deployment (NEVER log this)
  SYNTHESIS_API_KEY: ""           # Hackathon API

# Collector configuration  
collector:
  timeout_seconds: 30
  max_concurrent: 7
  cache_ttl_hours: 24
  retry_count: 3
  retry_delay_seconds: 1

# Evaluator configuration
evaluator:
  model: "claude-sonnet-4-20250514"
  temperature: 0.3
  max_tokens: 4096
  stakeholder_agents:
    - developer
    - user  
    - funder
    - ecosystem
  pairwise_comparisons: true
  tension_threshold: 35
  confidence_weight_by_completeness: true

# Mechanism configuration
mechanism:
  matching_pool: 100000
  pheromone:
    initial: 5.0
    min: 0.0
    max: 10.0
    decay_rate: 0.2
    deposit_rate: 0.5
  pagerank:
    damping: 0.85
    max_iterations: 100
    convergence: 1.0e-6
  anti_goodhart:
    rotation_interval_epochs: 5
    dimension_count: 12
    active_dimensions: 8
  qf:
    cap_per_project: 0.25  # max 25% of pool to single project

# Blockchain configuration
blockchain:
  chain: "base"
  chain_id: 8453
  rpc_url: "https://mainnet.base.org"
  contract_address: ""
  gas_limit: 500000
  filecoin_gateway: "https://api.web3.storage"

# API configuration
api:
  host: "0.0.0.0"
  port: 8000
  cors_origins: ["*"]
  rate_limit: 100  # requests per minute
```

---

## 11. Error Handling

### 11.1 Collector Errors
- Individual collector failure does NOT block others
- Errors recorded in `ProjectProfile.collection_errors`
- `data_completeness` reflects available data
- Evaluator adjusts confidence based on completeness

### 11.2 Evaluation Errors
- LLM call failures: retry 3x with exponential backoff
- JSON parse failures: retry with stronger prompt
- Stakeholder agent failure: proceed with available agents (min 2)

### 11.3 Mechanism Errors
- Missing contributions: use evaluation scores as synthetic signal
- Empty dependency graph: skip PageRank modifier
- Division by zero: handle in renormalization

### 11.4 On-Chain Errors
- Transaction failures: retry with higher gas
- Filecoin upload failures: retry, fall back to local storage
- RPC failures: failover to backup RPC

---

## 12. Research References

SIMOGRANTS draws on research presented at IERR 2025 (Incentive Engineering Research Retreat):

1. **Simocracy** (Dao & Rekhan, Protocol Labs)
   - Multi-stakeholder evaluation using agent-based deliberation
   - Each stakeholder agent represents a distinct user perspective
   - Applied: Our 4-agent evaluation architecture

2. **Better Rankings with Agents** (Gasquez, Protocol Labs)
   - Pairwise comparison outperforms absolute scoring for subjective evaluation
   - Bradley-Terry model for aggregating pairwise preferences
   - Applied: Our Bradley-Terry aggregation layer

3. **QF Under Constrained Budget is Suboptimal** (Old School Mathematicians)
   - Standard QF can produce pathological allocations under budget constraints
   - Modified QF mechanisms needed for real-world deployment
   - Applied: Our SQF modifications (pheromone + PageRank)

4. **MERI Framework** (Dao & Jeff)
   - Measurement → Evaluation → Ranking → Incentivization loop
   - Iterative funding with feedback mechanisms
   - Applied: Our epoch-based pheromone learning

5. **Hybrid PageRank** (Carl)
   - Dependency-graph attribution for infrastructure projects
   - Foundational libraries deserve higher funding via PageRank
   - Applied: Our PageRank modifier in SQF

6. **Impact Drift** (Hu)
   - Goodhart's Law in impact measurement: metrics become targets
   - Rotating evaluation dimensions prevents gaming
   - Applied: Our Anti-Goodhart dimension rotation

7. **Deep Funding Juror Data** (Yeung, Lido)
   - Bradley-Terry aggregation of human juror evaluations
   - Statistical methods for combining subjective assessments
   - Applied: Our BT implementation in scipy

8. **Stigmergy in Coordination** (various)
   - Ant colony optimization as coordination mechanism
   - Pheromone trails encode collective learning
   - Applied: Our pheromone tracker for historical accuracy

9. **Public Goods Funding Mechanisms** (Buterin, Hitzig, Weyl 2018)
   - Original Quadratic Funding paper
   - Mathematical foundation for democratic funding
   - Applied: Base QF layer of our SQF mechanism

10. **ERC-8004 Agent Receipts** (Protocol Labs)
    - On-chain receipts for autonomous agent actions
    - Verifiable proof of AI-generated work
    - Applied: Our attestation contract on Base

---

## 13. Glossary

- **SQF** — Stigmergic Quadratic Funding
- **QF** — Quadratic Funding
- **Pheromone** — Historical accuracy signal (0–10)
- **PageRank** — Graph centrality measure for dependency attribution
- **Bradley-Terry** — Statistical model for pairwise comparison aggregation
- **Tension** — Significant disagreement between stakeholder agents
- **Epoch** — One cycle of evaluation + allocation + learning
- **Anti-Goodhart** — Defense against metric gaming via dimension rotation
- **Attestation** — On-chain record of evaluation result
- **Evidence Bundle** — Full evaluation data stored on Filecoin
- **Simocracy** — Multi-agent deliberative evaluation methodology
- **MERI** — Measurement, Evaluation, Ranking, Incentivization loop

---

*End of SIMOGRANTS Technical Whitepaper*
*Total specification: ~2000 lines across 4 parts*
*This document is the authoritative blueprint for implementation.*
