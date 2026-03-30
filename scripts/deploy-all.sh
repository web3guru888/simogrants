#!/bin/bash
# ──────────────────────────────────────────────────────────────
# SIMOGRANTS — Full Deployment Script
# Deploys backend (Workers) + frontend (Pages), prints all URLs
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/packages/backend"
FRONTEND_DIR="$ROOT_DIR/packages/frontend"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}✔${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✖${NC} $1" >&2; }
step() { echo -e "\n${BLUE}▸${NC} $1"; }
header() { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  SIMOGRANTS — Full Deployment"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Check authentication ──
step "Checking Cloudflare authentication…"
if ! npx wrangler whoami 2>&1 | grep -q "Account"; then
  err "Not authenticated. Run: npx wrangler login"
  exit 1
fi

ACCOUNT_ID=$(npx wrangler whoami 2>&1 | grep -oP 'Account ID\s*\|\s*\K\S+')
log "Account: $ACCOUNT_ID"
echo ""

# Parse args
SKIP_INFRA=false
SKIP_BACKEND=false
SKIP_FRONTEND=false
SKIP_CONTRACTS=false

for arg in "$@"; do
  case $arg in
    --skip-infra)    SKIP_INFRA=true ;;
    --skip-backend)  SKIP_BACKEND=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-contracts)SKIP_CONTRACTS=true ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --skip-infra     Skip D1/KV/R2 setup (already done)"
      echo "  --skip-backend   Skip backend deployment"
      echo "  --skip-frontend  Skip frontend deployment"
      echo "  --skip-contracts Skip contract deployment"
      echo ""
      exit 0
      ;;
  esac
done

# ════════════════════════════════════════
# STEP 1: Infrastructure
# ════════════════════════════════════════
if [ "$SKIP_INFRA" = false ]; then
  header "STEP 1: Infrastructure Setup"
  if [ -f "$ROOT_DIR/scripts/setup-d1.sh" ]; then
    bash "$ROOT_DIR/scripts/setup-d1.sh"
  else
    err "setup-d1.sh not found"
    exit 1
  fi
else
  header "STEP 1: Infrastructure (skipped)"
fi

# ════════════════════════════════════════
# STEP 2: Build Frontend
# ════════════════════════════════════════
if [ "$SKIP_FRONTEND" = false ]; then
  header "STEP 2: Build Frontend"
  step "Installing frontend dependencies…"
  cd "$FRONTEND_DIR"
  npm install

  step "Building frontend…"
  npm run build
  log "Frontend built → dist/"
else
  header "STEP 2: Frontend Build (skipped)"
fi

# ════════════════════════════════════════
# STEP 3: Deploy Backend (Workers)
# ════════════════════════════════════════
BACKEND_URL=""
if [ "$SKIP_BACKEND" = false ]; then
  header "STEP 3: Deploy Backend (Cloudflare Workers)"
  step "Installing backend dependencies…"
  cd "$BACKEND_DIR"
  npm install

  step "Deploying to Cloudflare Workers…"
  DEPLOY_OUTPUT=$(npx wrangler deploy 2>&1)
  echo "$DEPLOY_OUTPUT"
  BACKEND_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
  log "Backend deployed"
else
  header "STEP 3: Backend Deploy (skipped)"
fi

# ════════════════════════════════════════
# STEP 4: Deploy Frontend (Pages)
# ════════════════════════════════════════
FRONTEND_URL=""
if [ "$SKIP_FRONTEND" = false ]; then
  header "STEP 4: Deploy Frontend (Cloudflare Pages)"
  step "Deploying to Cloudflare Pages…"
  cd "$FRONTEND_DIR"
  DEPLOY_OUTPUT=$(npx wrangler pages deploy dist --project-name=simogrants 2>&1)
  echo "$DEPLOY_OUTPUT"
  FRONTEND_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[a-zA-Z0-9.-]+\.pages\.dev' | head -1)
  log "Frontend deployed"
fi

# ════════════════════════════════════════
# STEP 5: Deploy Contracts (optional)
# ════════════════════════════════════════
if [ "$SKIP_CONTRACTS" = false ]; then
  header "STEP 5: Smart Contracts (manual)"
  warn "Contract deployment requires a funded wallet and private key."
  echo ""
  echo "  To deploy contracts on Base Sepolia:"
  echo "    cd $CONTRACTS_DIR"
  echo "    export DEPLOYER_PRIVATE_KEY=your_private_key"
  echo "    npx hardhat run scripts/deploy.js --network baseSepolia"
  echo ""
  echo "  To deploy on Base mainnet:"
  echo "    export DEPLOYER_PRIVATE_KEY=your_private_key"
  echo "    npx hardhat run scripts/deploy.js --network base"
fi

# ════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════"
echo "  🚀 SIMOGRANTS Deployment Complete!"
echo "═══════════════════════════════════════════════════"
echo ""
if [ -n "$FRONTEND_URL" ]; then
  echo -e "  🌐 Frontend:   ${CYAN}$FRONTEND_URL${NC}"
fi
if [ -n "$BACKEND_URL" ]; then
  echo -e "  ⚙️  API:        ${CYAN}$BACKEND_URL${NC}"
  echo -e "  🏥 Health:     ${CYAN}${BACKEND_URL}/api/health${NC}"
fi
echo ""
echo "  📊 D1 Database: simogrants-db"
echo "  🔑 KV:         SESSIONS namespace"
echo "  📦 R2:         simogrants-evidence bucket"
echo ""
echo "  💡 To verify the backend is working:"
echo "     curl $BACKEND_URL/api/health"
echo ""
