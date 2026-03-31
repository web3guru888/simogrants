# Simulation Plan — SIMOGRANTS Live Data

Full end-to-end simulation of the SIMOGRANTS platform with realistic grant rounds, projects, applications, ASI1 evaluations, and SQF allocations.

---

## Objective

Clear the production database and seed it with **3 realistic grant rounds**, each with **5-8 real Ethereum public goods projects**, then run the full ASI1 evaluation pipeline on each round to produce real scores, tensions, and SQF fund allocations. The result should be a live platform where every round has been through the complete lifecycle.

---

## Phase 1: Database Reset

Clear all existing data from the remote D1 database:

```bash
npx wrangler d1 execute simogrants-db --remote --command="
  DELETE FROM evidence;
  DELETE FROM allocations;
  DELETE FROM evaluations;
  DELETE FROM pipeline_runs;
  DELETE FROM applications;
  DELETE FROM projects;
  DELETE FROM rounds;
  DELETE FROM users;
"
```

---

## Phase 2: Seed Users

Create 3 simulated round operators and 1 simulated project submitter:

| Address | Display Name | Role |
|---------|-------------|------|
| `0xSIMO000000000000000000000000000000000001` | SIMOGRANTS Platform | Round creator (Infra) |
| `0xSIMO000000000000000000000000000000000002` | DeFi Safety Council | Round creator (DeFi/Security) |
| `0xSIMO000000000000000000000000000000000003` | Governance Working Group | Round creator (Governance) |
| `0xSIMO000000000000000000000000000000000004` | Project Submitter | Applies to all rounds |

---

## Phase 3: Seed Grant Rounds

### Round 1: Ethereum Core Infrastructure (Completed + Funded)
- **Pool**: $500,000 USDC
- **Status**: `funded` (evaluation complete, allocations done)
- **Focus**: Client diversity, protocol tooling, developer infrastructure
- **Deadline**: 2026-03-15 (past)
- **Chain**: base-sepolia

### Round 2: DeFi Security & Auditing (Completed + Funded)
- **Pool**: $250,000 USDC
- **Status**: `funded` (evaluation complete, allocations done)
- **Focus**: Smart contract auditing tools, formal verification, security infrastructure
- **Deadline**: 2026-03-20 (past)
- **Chain**: base-sepolia

### Round 3: Governance & Public Goods (Active + Accepting)
- **Pool**: $350,000 USDC
- **Status**: `accepting` (open for applications, not yet evaluated)
- **Focus**: DAO tooling, voting mechanisms, public goods funding infrastructure
- **Deadline**: 2026-05-01 (future)
- **Chain**: base-sepolia

---

## Phase 4: Seed Projects

### Round 1 Projects (Core Infrastructure) — 6 projects
| Project | Category | GitHub | Description |
|---------|----------|--------|-------------|
| Lodestar | infrastructure | github.com/ChainSafe/lodestar | TypeScript Ethereum consensus client promoting client diversity |
| Hardhat | developer-tooling | github.com/NomicFoundation/hardhat | Ethereum development environment for compiling, testing, deploying |
| Foundry | developer-tooling | github.com/foundry-rs/foundry | Blazing fast EVM toolkit written in Rust (forge, cast, anvil) |
| EthereumJS | infrastructure | github.com/ethereumjs/ethereumjs-monorepo | JavaScript implementation of Ethereum protocol primitives |
| Remix IDE | developer-tooling | github.com/ethereum/remix-project | Browser-based Solidity IDE and development suite |
| Ethers.js | developer-tooling | github.com/ethers-io/ethers.js | Complete Ethereum library and wallet implementation in JavaScript |

### Round 2 Projects (DeFi Security) — 5 projects
| Project | Category | GitHub | Description |
|---------|----------|--------|-------------|
| Slither | developer-tooling | github.com/crytic/slither | Static analysis framework for Solidity smart contracts |
| Echidna | developer-tooling | github.com/crytic/echidna | Property-based fuzzer for Ethereum smart contracts |
| OpenZeppelin Contracts | developer-tooling | github.com/OpenZeppelin/openzeppelin-contracts | Battle-tested library of secure, reusable smart contract components |
| Certora Prover | developer-tooling | github.com/Certora/Examples | Formal verification tool for smart contract correctness proofs |
| Immunefi | community | github.com/nicedaybruno/immunefi | Leading bug bounty platform connecting security researchers with DeFi projects |

### Round 3 Projects (Governance & Public Goods) — 5 projects
| Project | Category | GitHub | Description |
|---------|----------|--------|-------------|
| Snapshot | governance | github.com/snapshot-labs/snapshot | Off-chain gasless governance voting for DAOs and communities |
| Gitcoin Passport | identity | github.com/gitcoinco/passport | Sybil-resistant identity aggregator for Web3 governance and funding |
| Protocol Guild | governance | github.com/protocolguild/docs | Collective funding mechanism for Ethereum core protocol contributors |
| Tally | governance | github.com/withtally/tally | Full-featured DAO governance interface and proposal management |
| Retroactive Public Goods | governance | github.com/ethereum-optimism/op-analytics | Optimism's retroactive funding framework for public goods impact |

---

## Phase 5: Seed Applications

Every project applies to its respective round:
- Round 1: 6 applications (all `evaluated` + `funded`)
- Round 2: 5 applications (all `evaluated` + `funded`)
- Round 3: 5 applications (all `submitted` — awaiting evaluation)

---

## Phase 6: Run ASI1 Evaluations (Rounds 1 & 2)

For each funded round, call the evaluation API endpoint:

```bash
# Create a test auth session
npx wrangler kv key put "session:sim-token" \
  '{"address":"0xsimo000000000000000000000000000000000001","chainId":84532,"expiresAt":"2027-01-01T00:00:00Z"}' \
  --binding SESSIONS --remote

# Evaluate Round 1
curl -X POST https://simogrants-api.jingjai.workers.dev/api/rounds/round-infra-001/evaluate \
  -H "Authorization: Bearer sim-token" \
  -H "Content-Type: application/json"

# Evaluate Round 2
curl -X POST https://simogrants-api.jingjai.workers.dev/api/rounds/round-defi-sec-002/evaluate \
  -H "Authorization: Bearer sim-token" \
  -H "Content-Type: application/json"
```

This triggers:
- 4 ASI1 stakeholder agents per project (Developer, User, Funder, Ecosystem)
- 12 dimension scores per project
- Tension detection between agents
- SQF allocation with pheromone + PageRank modifiers
- Round status transitions to `funded`

---

## Phase 7: Verify Results

After evaluation, verify:

```bash
# Check evaluations
curl https://simogrants-api.jingjai.workers.dev/api/rounds/round-infra-001/results

# Check allocations
curl https://simogrants-api.jingjai.workers.dev/api/rounds/round-defi-sec-002/results

# Check project detail
curl https://simogrants-api.jingjai.workers.dev/api/projects/proj-hardhat
```

---

## Expected Final State

### simogrants.com/rounds
- **Ethereum Core Infrastructure** — Status: Funded, $500K allocated across 6 projects
- **DeFi Security & Auditing** — Status: Funded, $250K allocated across 5 projects
- **Governance & Public Goods** — Status: Accepting, $350K pool, 5 applications waiting

### simogrants.com/rounds/{id}/results (Rounds 1 & 2)
- Full rankings with ASI1-generated scores
- SQF allocation bars showing fund distribution
- Tension analysis between stakeholder agents
- On-chain attestation badges

### simogrants.com/projects/{id}
- 4 stakeholder evaluation cards with dimension scores
- Aggregated scores across 12 dimensions
- Allocation history showing funding received

### simogrants.com/dashboard (when connected)
- Shows user's own rounds and projects
- Stats reflect actual data

---

## Execution Script

The entire simulation will be executed via a single SQL seed script + 2 API calls:

1. **SQL seed** — Insert users, rounds, projects, applications
2. **API call 1** — `POST /rounds/round-infra-001/evaluate` (triggers real ASI1)
3. **API call 2** — `POST /rounds/round-defi-sec-002/evaluate` (triggers real ASI1)

Round 3 is left in `accepting` status intentionally — this is the live round users can interact with.

---

## Timeline

| Step | Duration |
|------|----------|
| Database reset | ~5 seconds |
| Seed data insert | ~5 seconds |
| ASI1 evaluation Round 1 (6 projects) | ~30-60 seconds |
| ASI1 evaluation Round 2 (5 projects) | ~20-40 seconds |
| Verification | ~10 seconds |
| **Total** | **~2 minutes** |
