# SIMOGRANTS

**Stigmergic Impact Oracle for Public Goods**

SIMOGRANTS is an autonomous multi-agent system for evaluating Ethereum public goods projects. It combines:
- **async public-goods data collection** from 7 sources
- **multi-stakeholder AI evaluation** across developer, user, funder, and ecosystem perspectives
- **Stigmergic Quadratic Funding (SQF)**: QF extended with pheromone learning and PageRank attribution
- **on-chain attestation** on Base with Filecoin-backed evidence bundles

Built for **The Synthesis** hackathon.

## Why this matters

Public goods funding is often distorted by popularity bias, shallow metrics, and opaque decision-making. SIMOGRANTS makes evaluation:
- more **transparent**,
- more **multi-perspective**,
- more **adaptive over time**, and
- more **verifiable on-chain**.

## Architecture

```text
Input Project
   |
   v
[Collector Layer]
  GitHub | Etherscan | DefiLlama | Gitcoin | Snapshot | Octant | Packages
   |
   v
[Evaluation Layer]
  Developer Agent
  User Agent
  Funder Agent
  Ecosystem Agent
   |
   +--> Bradley-Terry aggregation
   +--> Tension detection
   |
   v
[Mechanism Layer]
  QF × Pheromone × PageRank
  + Anti-Goodhart rotation
   |
   v
[On-Chain Layer]
  Filecoin evidence bundle + Base attestation contract
```

## Current status

Working vertical slice completed:
- collect ✅
- evaluate ✅
- allocate ✅
- create attestation artifact ✅

Example smoke test result:
- collection completeness: `0.4286`
- evaluation score: `89.33`
- stakeholder evaluations: `4`
- tensions: `0`

## Repo layout

```text
src/
  collectors/   # 7 async collectors + orchestrator
  evaluator/    # prompts, engine, bradley-terry, tension detection
  mechanism/    # qf, pheromone, pagerank, sqf, anti-goodhart, backtest
  blockchain/   # filecoin uploader + attestation publisher
  routers/      # FastAPI routes
  database.py   # SQLite persistence
  main.py       # FastAPI app
contracts/
  SIMOGrantsAttestation.sol
scripts/
  deploy.js
test/
  attestation.test.js
```

## API

Core endpoints:
- `GET /health`
- `GET /version`
- `POST /projects`
- `POST /projects/{project_id}/collect`
- `POST /evaluate/projects/{project_id}`
- `POST /mechanism/allocate`
- `POST /attestations/publish`
- `POST /pipeline/run`

## Tech stack

- Python 3.10+
- FastAPI
- SQLite + aiosqlite
- httpx
- numpy
- scipy
- networkx
- Solidity / Hardhat / ethers.js
- Filecoin
- ASI1 (`asi1-mini`) for stakeholder evaluation

## Research basis

SIMOGRANTS is grounded in the IERR 2025 ideas referenced in the whitepaper:
- Simocracy
- Better Rankings with Agents
- QF Under Constrained Budget is Suboptimal
- MERI Framework
- Hybrid PageRank
- Impact Drift
- Deep Funding Juror Data
- ERC-8004 Agent Receipts

## Running locally

```bash
python3 -m pip install fastapi uvicorn httpx aiosqlite numpy scipy networkx anthropic pydantic
uvicorn src.main:app --reload
```

Then open:
- `http://localhost:8000/health`
- `http://localhost:8000/docs`

## Security

- Never share private keys in chat
- API keys are stored locally in `.env`
- ERC-8004 self-custody transfer requires only a public wallet address

## Submission tracks

SIMOGRANTS targets:
1. Mechanism Design for Public Goods Evaluation
2. Agents for Public Goods Data Collection
3. Agents for Public Goods Data Analysis
4. Let the Agent Cook — No Humans Required
5. Agents With Receipts — ERC-8004
6. Best Use Case with Agentic Storage
7. Synthesis Open Track
