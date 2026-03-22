<p align="center">
  <h1 align="center">🏛️ SIMOGRANTS</h1>
  <p align="center">
    <strong>Stigmergic Impact Oracle for Public Goods</strong>
  </p>
  <p align="center">
    Autonomous multi-agent evaluation + stigmergic quadratic funding for Ethereum public goods
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/python-3.11-blue?logo=python&logoColor=white" alt="Python 3.11" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT" />
    <img src="https://img.shields.io/badge/hackathon-The%20Synthesis-purple" alt="Hackathon: The Synthesis" />
    <img src="https://img.shields.io/badge/chain-Base-0052FF?logo=coinbase" alt="Chain: Base" />
    <img src="https://img.shields.io/badge/storage-Filecoin-0090FF?logo=filecoin" alt="Storage: Filecoin" />
  </p>
</p>

---

> **The problem:** Public goods funding relies on single-metric scoring that's easy to game, expensive human juries, or black-box AI. Every simple proxy — stars, donations, TVL — can be Goodharted.
>
> **Our answer:** A multi-agent system where four stakeholder agents evaluate projects independently, disagree productively, and allocate funding through a novel mechanism that combines quadratic funding with stigmergic reputation and network topology — with every decision attested on-chain.

---

## 📑 Table of Contents

- [Architecture](#-architecture)
- [How It Works — 3 Layers](#-how-it-works)
- [Stigmergic Quadratic Funding (SQF)](#-stigmergic-quadratic-funding-sqf)
- [Multi-Agent Architecture](#-multi-agent-architecture)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [API Endpoints](#-api-endpoints)
- [Research References](#-research-references)
- [Hackathon Track Alignment](#-hackathon-track-alignment)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SIMOGRANTS Pipeline                        │
│                                                                 │
│  ┌───────────┐    ┌───────────────┐    ┌────────────────────┐  │
│  │  COLLECT  │───▶│   EVALUATE    │───▶│  ALLOCATE (SQF)    │  │
│  │ 7 sources │    │ 4 stakeholder │    │ QF × Pheromone ×   │  │
│  │ async     │    │ agents + B-T  │    │ PageRank           │  │
│  └───────────┘    └───────────────┘    └────────────────────┘  │
│       │                  │                       │              │
│       ▼                  ▼                       ▼              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               ON-CHAIN ATTESTATION                        │  │
│  │    Base (Solidity) + Filecoin (evidence) + ERC-8004       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Module Map

```
simogrants/
├── collectors/
│   ├── orchestrator.py       # Fan-out across 7 async sources
│   ├── github.py             # Stars, commits, contributors, health files
│   ├── etherscan.py          # Balances, tx count, contract verification
│   ├── defillama.py          # TVL, fees, revenue, chain presence
│   ├── gitcoin.py            # Rounds, donors, matching history
│   ├── snapshot.py           # Governance activity, voter turnout
│   ├── octant.py             # Epoch participation, GLM allocation
│   ├── packages.py           # npm/PyPI downloads, dependents
│   └── models.py             # ProjectProfile dataclass (50+ fields)
├── evaluator/
│   ├── engine.py             # 4 stakeholder agents in parallel
│   ├── prompts.py            # Stakeholder-specific system prompts
│   ├── tension.py            # Disagreement detection (threshold: 35)
│   ├── bradley_terry.py      # MLE pairwise ranking (scipy L-BFGS-B)
│   └── models.py             # Evaluation structures + dimensions
├── blockchain/
│   ├── contracts/
│   │   └── SIMOGrantsAttestation.sol   # On-chain receipt contract
│   ├── python/
│   │   ├── attester.py       # Python publisher (keccak256 + publish)
│   │   └── filecoin.py       # web3.storage / Lighthouse uploader
│   ├── scripts/deploy.js     # Hardhat deployment to Base mainnet / Base Sepolia
│   └── test/attestation.test.js
└── docs/
    ├── API.md
    ├── AGENTS.md
    ├── demo_script.md
    └── submission_metadata.json
```

---

## 🔬 How It Works

SIMOGRANTS operates as a three-layer pipeline — **Collect → Evaluate → Allocate** — followed by on-chain attestation. Each layer is independently testable and composable.

### Layer 1: Data Collection — 7 Async Sources

The **Collection Orchestrator** fans out across seven data sources simultaneously using `asyncio.gather` + `httpx`:

| Source | What It Captures |
|--------|-----------------|
| **GitHub** | Stars, forks, contributors, commit frequency, PRs, health files (README, LICENSE, CONTRIBUTING) |
| **Etherscan** | Balance, tx count, contract verification, unique senders/receivers, gas usage |
| **DefiLlama** | TVL, fees, revenue, chain presence, category, audit links |
| **Gitcoin** | Rounds participated, total donations, unique donors, matching amounts |
| **Snapshot** | Proposals, voter turnout, member count, governance strategies |
| **Octant** | Epoch participation, GLM allocation, matched amounts, donor count |
| **npm/PyPI** | Weekly downloads, dependents count, maintainers, release cadence |

The output is a typed `ProjectProfile` dataclass with **50+ fields** and a `data_completeness` score (0.0–1.0) based on how many sources returned data. Collection degrades gracefully — if Etherscan is down, the other six sources still produce a valid profile.

### Layer 2: Simocratic Evaluation — 4 Stakeholder Agents

Inspired by Simocracy's multi-institutional reasoning, SIMOGRANTS runs **four LLM stakeholder agents in parallel**, each representing a distinct constituency:

| Stakeholder | Dimensions Scored | What They Care About |
|-------------|------------------|---------------------|
| 🔧 **Developer** | `code_quality`, `maintenance_health`, `security_posture` | Is this well-built? Is it maintained? Is it safe? |
| 👤 **User** | `adoption_metrics`, `community_engagement`, `user_experience` | Do people use this? Is the community healthy? |
| 💰 **Funder** | `capital_efficiency`, `funding_sustainability`, `track_record` | Is money well-spent? Can this sustain itself? |
| 🌐 **Ecosystem** | `composability`, `network_effects`, `mission_alignment` | Does this make the ecosystem better? |

Each agent returns:
- **Per-dimension scores** (0–100) with written justification
- **Overall narrative** (2–4 sentence summary)
- **Confidence score** (0.0–1.0) based on data availability

**Why four agents instead of one?** A project can be brilliant engineering (Developer: 92) but have terrible UX (User: 41). A single score hides this. SIMOGRANTS preserves the structure.

#### Tension Detection

When stakeholder scores diverge by more than **35 points**, the system flags a **tension** — a first-class output, not an error. Tensions are detected at three levels:

1. **Dimension-level** — Same dimension, different agents disagree
2. **Meta-tension** — One agent's mean score diverges from group mean
3. **Cross-category** — Developer thinks it's great, Funder thinks it's wasteful

This is SIMOGRANTS' **anti-Goodhart** mechanism: projects face a plural evaluation surface that can't be optimized by gaming a single metric.

#### Bradley-Terry Pairwise Ranking

For comparing multiple projects, SIMOGRANTS uses **Bradley-Terry Maximum Likelihood Estimation** via `scipy.optimize.minimize` (L-BFGS-B). Instead of sorting raw scores, the system estimates latent strength parameters from pairwise comparisons:

```
P(A beats B) = sigmoid(θ_A − θ_B)
```

This produces rankings that are more robust to score scale inconsistencies across different evaluation runs.

### Layer 3: Stigmergic Quadratic Funding (SQF)

The allocation layer introduces **SQF** — our novel mechanism-design contribution:

```
SQF = QF × Pheromone_Modifier × PageRank_Modifier
```

Each component captures a different signal family (see [SQF section](#-stigmergic-quadratic-funding-sqf) below).

### On-Chain: Attestation & Receipts

Every evaluation produces a verifiable receipt:

1. Evidence JSON is canonicalized and hashed → `evaluationHash = keccak256(evidence)`
2. Evidence bundle uploaded to **Filecoin** (via web3.storage or Lighthouse) → `filecoinCID`
3. Both are published to `SIMOGrantsAttestation.sol` on **Base** → on-chain event

The contract stores per-attestation: `evaluationHash`, `filecoinCID`, `timestamp`, `attester`, and `epoch`. It supports single and batch attestation, epoch management, and authorized attester control — following **ERC-8004** patterns for machine-verifiable agent receipts.

---

## 📐 Stigmergic Quadratic Funding (SQF)

SQF extends traditional Quadratic Funding with two evidence-aware modifiers:

```
SQF(p) = QF(p) × Φ(p) × R(p)
```

| Component | What It Measures | Intuition |
|-----------|-----------------|-----------|
| **QF(p)** — Quadratic Funding | Breadth of community support | "Do many people support this?" |
| **Φ(p)** — Pheromone Modifier | Accumulated reputation over time | "Has this project consistently delivered value?" |
| **R(p)** — PageRank Modifier | Structural importance in the ecosystem graph | "Is this project load-bearing infrastructure?" |

### Why "Stigmergic"?

In biology, stigmergy is indirect coordination through environmental traces — ants leaving pheromone trails. SIMOGRANTS applies this concept:

- **Pheromone** trails accumulate when a project produces credible evidence across epochs. They decay at **20% per epoch**, so past performance matters but doesn't lock in forever.
- **PageRank** is computed via `networkx` over the dependency graph — a project depended on by many others has higher structural importance regardless of popularity.

### The Anti-Goodhart Angle

Standard QF can be gamed by manufacturing many small donations. SQF makes gaming harder because optimizing for one axis hurts another:

- Manufacturing donors helps QF but doesn't affect Pheromone (needs real evidence over time)
- Inflating metrics doesn't change PageRank (structural position is independently verifiable)
- **Dimension rotation** — the evaluation surface shifts across epochs, preventing metric ossification

A project with moderate visibility but strong ecosystem centrality and repeated evidence of usefulness may deserve more funding than popularity alone would imply.

---

## 🤖 Multi-Agent Architecture

SIMOGRANTS was built by a coordinated team of **6 AI agents** on the Taurus multi-agent orchestration platform:

| Agent | Role | What It Built |
|-------|------|--------------|
| 🎯 **SIMO** (orchestrator) | Sprint planning, delegation, integration | Architecture decisions, task breakdown, cross-agent coordination |
| 📊 **collector-agent** | Data collection specialist | 7 async collectors, ProjectProfile model, collection orchestrator |
| 🧠 **evaluator-agent** | LLM evaluation + aggregation | 4 stakeholder agents, tension detection, Bradley-Terry ranking |
| ⚙️ **mechanism-agent** | Funding mechanism design | SQF formula, pheromone decay, PageRank computation |
| ⛓️ **blockchain-agent** | Smart contracts + storage | SIMOGrantsAttestation.sol, Filecoin uploader, deployment scripts |
| 📝 **docs-agent** | Documentation + submission | README, API docs, demo script, submission metadata |

This is not a "one prompt to rule them all" system — it's a genuine multi-agent collaboration where each agent has domain expertise, operates independently, and produces auditable artifacts.

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.11, FastAPI, httpx, aiosqlite, Pydantic |
| **AI / Evaluation** | Anthropic Claude, structured JSON prompts, asyncio parallel execution |
| **Math** | scipy (L-BFGS-B optimization), networkx (PageRank), numpy |
| **Blockchain** | Solidity 0.8.20+, Hardhat, ethers.js, Base mainnet / Base Sepolia |
| **Storage** | Filecoin via web3.storage + Lighthouse fallback |
| **Orchestration** | Taurus multi-agent platform |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+ (for smart contract tooling)
- API key for LLM provider (Anthropic)
- Optional: Filecoin storage token, Etherscan API key

### 1. Clone & Install

```bash
git clone https://github.com/web3guru888/simogrants
cd simogrants
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Required for evaluation
export ANTHROPIC_API_KEY=your_key

# Optional — collector API keys
export ETHERSCAN_API_KEY=your_key
export GITHUB_TOKEN=your_token

# Optional — blockchain
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC=https://sepolia.base.org

# Optional — Filecoin storage
export WEB3STORAGE_TOKEN=your_token
export LIGHTHOUSE_TOKEN=your_token
```

### 3. Run the Server

```bash
python -m uvicorn src.main:app --reload
```

### 4. Run the Full Pipeline

```bash
# Collect → Evaluate → Allocate → Attest in one call
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"project_id": "uniswap", "github": "Uniswap/v3-core", "etherscan": "0x1F98431c8aD98523631AE4a59f267346ea31F984"}'
```

### 5. Run Tests

```bash
# Python tests
pytest src/tests/

# Smart contract tests
cd blockchain && npm install && npm test
```

### 6. Deploy Contract (Base Mainnet)

```bash
npm install
npx hardhat run scripts/deploy.js --network base
```

---

## 📡 API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/version` | API version and build info |
| `POST` | `/projects` | Create a new project for evaluation |
| `GET` | `/projects/{id}` | Get project details and latest evaluation |
| `POST` | `/collect/{project_id}` | Run all 7 collectors for a project |
| `POST` | `/evaluate/{project_id}` | Run 4-stakeholder evaluation |
| `POST` | `/mechanism/allocate` | Run SQF allocation across a project set |
| `POST` | `/pipeline/run` | Full pipeline: collect → evaluate → allocate → attest |
| `POST` | `/attestations/{project_id}` | Generate and publish on-chain attestation |
| `GET` | `/mechanism/pheromone/{project_id}` | Get current pheromone state for a project |

> 📖 Full request/response examples in [docs/API.md](docs/API.md)

---

## 📚 Research References

SIMOGRANTS builds on seven research papers from **IERR 2025** (International Evaluation & Reputation Research):

| # | Paper | Authors | How It Informs SIMOGRANTS |
|---|-------|---------|--------------------------|
| 1 | **Simocracy** | Dao & Rekhan (Protocol Labs) | Multi-stakeholder institutional evaluation — the conceptual foundation for our 4-agent architecture |
| 2 | **Better Rankings with Agents** | Gasquez (Protocol Labs) | Agentic pairwise comparison methodology — directly implemented in our Bradley-Terry module |
| 3 | **QF Under Constrained Budget is Suboptimal** | Old School Mathematicians | Formal proof that standard QF has limitations — motivates SQF's evidence-aware modifiers |
| 4 | **MERI Framework** | Dao & Jeff | Iterative evaluation-to-funding loops — informs our epoch-based pheromone accumulation |
| 5 | **Hybrid PageRank** | Carl | Dependency-graph attribution for ecosystem impact — implemented via networkx in our PageRank modifier |
| 6 | **Impact Drift** | Hu | Anti-Goodhart defense through dimension rotation — motivates our tension detection and multi-axis evaluation |
| 7 | **Deep Funding Juror Data** | Yeung & Lido | Empirical analysis of juror preferences and Bradley-Terry aggregation — validates our stakeholder disagreement modeling |

---

## 🎯 Hackathon Track Alignment

SIMOGRANTS addresses **7 tracks** in The Synthesis hackathon:

### 1. 🏗 Mechanism Design for Public Goods Evaluation (Octant)
**SQF is a novel funding mechanism.** It extends QF with pheromone-based reputation and PageRank topology. The multi-stakeholder evaluation with tension detection is itself a mechanism-design contribution — it makes evaluation plural, transparent, and harder to game.

### 2. 📊 Agents for Public Goods Data Collection (Octant)
**7 async collectors running in parallel.** GitHub, Etherscan, DefiLlama, Gitcoin, Snapshot, Octant, and npm/PyPI — each with typed models, graceful degradation, and completeness scoring. The `CollectionOrchestrator` is a production-grade data pipeline, not a demo wrapper.

### 3. 🧠 Agents for Public Goods Data Analysis (Octant)
**4 stakeholder evaluation agents** with distinct perspectives, structured scoring, written justification, and tension detection. Bradley-Terry pairwise ranking for comparing projects. This is analysis with a plural lens, not a single-score reducer.

### 4. 🍳 Let the Agent Cook (Protocol Labs)
**A genuine multi-agent system.** Six specialized agents collaborated to build this — from smart contract authoring to data model design to documentation. The evaluation pipeline itself runs four agents concurrently. Disagreement is treated as signal, not noise.

### 5. 🧾 Agents With Receipts — ERC-8004 (Protocol Labs)
**Every evaluation produces an on-chain receipt.** `evaluationHash` as proof of work, `filecoinCID` as the evidence trail, `attester` as agent identity, `epoch` for temporal context. The `SIMOGrantsAttestation.sol` contract follows ERC-8004 compliance patterns.

### 6. 💾 Best Use Case with Agentic Storage (Filecoin)
**Evidence bundles stored on Filecoin** before on-chain publication. Content-addressed, durable, independently verifiable. Supports both web3.storage and Lighthouse backends with automatic retry and fallback.

### 7. 🌐 Synthesis Open Track
**SIMOGRANTS synthesizes everything.** Mechanism design + multi-agent AI + blockchain attestation + decentralized storage + public goods evaluation. It's not a tool that does one thing — it's infrastructure for a more plural, evidence-based, and game-resistant grants ecosystem.

---

## 📊 Evaluation Model Deep Dive

### Stakeholder × Dimension Matrix

```
                    ┌─────────────┬──────────────┬──────────────┬──────────────┐
                    │  Developer  │     User     │    Funder    │  Ecosystem   │
┌───────────────────┼─────────────┼──────────────┼──────────────┼──────────────┤
│ code_quality      │     ✓       │              │              │              │
│ maintenance_health│     ✓       │              │              │              │
│ security_posture  │     ✓       │              │              │              │
│ adoption_metrics  │             │      ✓       │              │              │
│ community_engage  │             │      ✓       │              │              │
│ user_experience   │             │      ✓       │              │              │
│ capital_efficiency│             │              │      ✓       │              │
│ funding_sustain   │             │              │      ✓       │              │
│ track_record      │             │              │      ✓       │              │
│ composability     │             │              │              │      ✓       │
│ network_effects   │             │              │              │      ✓       │
│ mission_alignment │             │              │              │      ✓       │
└───────────────────┴─────────────┴──────────────┴──────────────┴──────────────┘
                              12 dimensions × 4 agents
```

### Example Tension Output

```json
{
  "dimension": "developer_vs_funder",
  "agents": {"developer": 88, "funder": 45},
  "spread": 43,
  "high_agent": "developer",
  "low_agent": "funder",
  "narrative": "Cross-stakeholder tension: developer (mean 88) is 43 points above funder (mean 45). The project resonates much more strongly with developer concerns than funder priorities."
}
```

This tension tells a story: the project is technically excellent but may have capital efficiency or sustainability concerns. A human reviewer now has structured insight, not just a number.

---

## 🔐 Smart Contract

**`SIMOGrantsAttestation.sol`** — Live on Base mainnet

- Contract: `0x6158Ee59Ab932866952A0c1aF5e60321db3dA2Ee`
- Deployment TX: `0x89a49559d131f9ab3287f7959ca68bd603db52a29b4e21a5055a77ee224faef1`
- BaseScan: https://basescan.org/address/0x6158Ee59Ab932866952A0c1aF5e60321db3dA2Ee

```solidity
struct Attestation {
    bytes32 evaluationHash;  // keccak256 of evidence JSON
    string  filecoinCID;     // IPFS/Filecoin CID of evidence bundle
    uint64  timestamp;       // block.timestamp at publication
    address attester;        // agent address that published
    uint64  epoch;           // governance epoch at publication
}
```

**Capabilities:**
- `publishAttestation()` — Single attestation with validation
- `publishBatch()` — Gas-optimized batch publishing
- `advanceEpoch()` — Owner-controlled epoch management
- `setAttester()` — Authorized attester management
- `getLatestAttestation()` / `getAllAttestations()` — Query interface
- Custom errors for gas-efficient reverts

---

## 📄 License

[MIT](LICENSE) — Use it, fork it, build on it.

---

## 🙏 Acknowledgments

- **IERR 2025 researchers** — The seven papers that shaped our mechanism design and evaluation framework
- **Protocol Labs** — For the Simocracy vision and agent infrastructure
- **Octant** — For pioneering public goods funding mechanisms
- **Ethereum public goods community** — For building things worth evaluating
- **Taurus** — Multi-agent orchestration platform that made 6-agent collaboration possible

---

<p align="center">
  <strong>SIMOGRANTS</strong> — Because public goods deserve evaluation that's as plural as the communities they serve.
</p>
