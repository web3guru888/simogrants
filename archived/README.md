# Archived Content

This directory contains historical artifacts from the SIMOGRANTS hackathon development (PL_Genesis, March 2026). All content here has been superseded by the active codebase in `packages/`.

## Subdirectories

| Directory | Contents |
|-----------|----------|
| `python-backend/` | Original FastAPI backend (`src/`), pipeline scripts, Docker/Render configs. Replaced by `packages/backend/` (Cloudflare Workers + Hono). |
| `legacy-contracts/` | Original `SIMOGrantsAttestation.sol` contract. Replaced by `packages/contracts/` (GrantFactory, GrantRound, SQFMechanism, AttestationRegistry). |
| `legacy-scripts/` | Old deployment and backtest scripts that reference the Python pipeline. Replaced by `scripts/deploy-all.sh` and the API evaluation pipeline. |
| `hackathon-data/` | Pipeline output, evidence bundles, Filecoin upload results, agent logs. All from hackathon Days 1-13. Live data is now in Cloudflare D1 + R2. |
| `reviews/` | Post-mortem documentation: frontend code review, design review, testing plan, simulation plan, ASI1 verification report, sprint report, demo script, conversation log, hackathon submission. |

## Why archived (not deleted)

The Python source code in `python-backend/src/` contains the original evaluation prompts, mechanism design, and collector implementations that informed the TypeScript port. The hackathon data provides proof of mechanism correctness. The reviews document architectural decisions. All are valuable for reference but not needed in the active development tree.
