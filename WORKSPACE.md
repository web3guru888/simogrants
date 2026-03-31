# Workspace Setup

## Quick Start

```bash
git clone https://github.com/web3guru888/simogrants.git
cd simogrants
git checkout pl-genesis-hackathon
npm install
```

## Development

```bash
npm run dev                    # Full stack (backend :8787 + frontend :5173)
cd packages/backend && npx wrangler dev --local   # Backend only
cd packages/frontend && npm run dev               # Frontend only
```

## Required Secrets

Create `packages/backend/.dev.vars`:
```
ASI1_API_KEY=your-asi1-api-key
```

## Database

```bash
cd packages/backend
npm run db:init    # Create schema
npm run db:seed    # Seed test data
```

## Testing

```bash
npx hardhat test                          # 104 contract tests
cd e2e-tests && npx playwright test       # 12 E2E tests
cd packages/backend && npx tsc --noEmit   # Type check
```

## Deployment

```bash
bash scripts/deploy-all.sh                # Full deploy
cd packages/backend && npx wrangler deploy       # Backend
cd packages/frontend && npm run build && npx wrangler pages deploy dist --project-name=simogrants --branch=main  # Frontend
```

## Structure

```
packages/backend/    — Cloudflare Workers API (Hono)
packages/frontend/   — React 19 SPA (Cloudflare Pages)
packages/contracts/  — Solidity 0.8.24 (Base Sepolia)
e2e-tests/           — Playwright E2E suite
scripts/             — deploy-all.sh, setup-d1.sh
whitepaper/          — Mechanism design docs
archived/            — Legacy Python backend + hackathon artifacts
```
