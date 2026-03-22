# AGENTS.md

## Project
SIMOGRANTS — Stigmergic Impact Oracle for Public Goods

## What this system does
SIMOGRANTS evaluates Ethereum public goods projects using a multi-agent pipeline:
1. collect evidence from public APIs
2. run 4 stakeholder evaluations
3. aggregate using Bradley-Terry + tension detection
4. compute SQF allocation
5. produce on-chain-attestable evidence artifacts

## Primary entrypoints
- API app: `src/main.py`
- Collectors: `src/collectors/`
- Evaluator: `src/evaluator/`
- Mechanism: `src/mechanism/`
- Blockchain helpers: `src/blockchain/`
- Contract: `contracts/SIMOGrantsAttestation.sol`

## Capabilities
- Async collection from 7 data sources
- Structured stakeholder evaluation
- Pairwise ranking / aggregation
- Stigmergic QF allocation
- Filecoin evidence upload helpers
- Base attestation contract + deploy script

## Key routes
- `/health`
- `/version`
- `/projects`
- `/projects/{project_id}/collect`
- `/evaluate/projects/{project_id}`
- `/mechanism/allocate`
- `/attestations/publish`
- `/pipeline/run`

## Models / engines
- Evaluator can run with ASI1-compatible chat completions
- Mechanism uses deterministic numeric logic
- Database is SQLite-backed

## Constraints
- Never request private keys
- Use only public wallet addresses for ERC-8004 transfer flow
- Secrets must stay in environment variables / `.env`

## Evidence of real execution
A full vertical slice was executed locally:
- collection succeeded
- evaluation via ASI1 succeeded
- allocation succeeded
- attestation hash artifact created
