#!/bin/bash
# ──────────────────────────────────────────────────────────────
# SIMOGRANTS — Cloudflare Infrastructure Setup
# Creates D1 database, KV namespace, R2 bucket, and runs migrations
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$ROOT_DIR/packages/backend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}✔${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✖${NC} $1" >&2; }

echo "═══════════════════════════════════════════════════"
echo "  SIMOGRANTS — Cloudflare Infrastructure Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Check authentication ──
echo "▸ Checking Cloudflare authentication…"
if ! npx wrangler whoami 2>&1 | grep -q "Account"; then
  err "Not authenticated. Please run one of:"
  echo ""
  echo "  npx wrangler login                    # (interactive browser auth)"
  echo "  export CLOUDFLARE_API_TOKEN=your_token  # (API token)"
  echo ""
  echo "Required permissions for API token:"
  echo "  - Cloudflare Pages: Edit"
  echo "  - Workers Scripts: Edit"
  echo "  - Workers KV Storage: Edit"
  echo "  - D1: Edit"
  echo "  - Workers R2 Storage: Edit"
  echo ""
  exit 1
fi
log "Authenticated"
echo ""

# ── Create D1 Database ──
echo "▸ Creating D1 database (simogrants-db)…"
D1_OUTPUT=$(npx wrangler d1 create simogrants-db 2>&1)
D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+')
if [ -z "$D1_ID" ]; then
  # Already exists — try to get it from list
  warn "Could not create D1 (may already exist). Looking up ID…"
  D1_ID=$(npx wrangler d1 list 2>&1 | grep "simogrants-db" | head -1 | awk '{print $NF}')
fi
if [ -z "$D1_ID" ]; then
  err "Failed to get D1 database ID"
  exit 1
fi
log "D1 Database: simogrants-db (id: $D1_ID)"
echo ""

# ── Create KV Namespace ──
echo "▸ Creating KV namespace (SESSIONS)…"
KV_OUTPUT=$(npx wrangler kv namespace create SESSIONS 2>&1)
KV_ID=$(echo "$KV_OUTPUT" | grep -oP 'id\s*=\s*"\K[^"]+')
if [ -z "$KV_ID" ]; then
  warn "Could not create KV namespace (may already exist). Looking up ID…"
  KV_ID=$(npx wrangler kv namespace list 2>&1 | grep "SESSIONS" | head -1 | grep -oP '"id"\s*:\s*"\K[^"]+')
fi
if [ -z "$KV_ID" ]; then
  warn "KV namespace ID not found — will use placeholder"
  KV_ID="REPLACE_ME"
fi
log "KV Namespace: SESSIONS (id: $KV_ID)"
echo ""

# ── Create R2 Bucket ──
echo "▸ Creating R2 bucket (simogrants-evidence)…"
if npx wrangler r2 bucket create simogrants-evidence 2>&1; then
  log "R2 Bucket: simogrants-evidence"
else
  warn "R2 bucket may already exist (this is fine)"
fi
echo ""

# ── Update wrangler.toml ──
echo "▸ Updating wrangler.toml with real IDs…"
WRANGLER_TOML="$BACKEND_DIR/wrangler.toml"
cat > "$WRANGLER_TOML" <<EOF
name = "simogrants-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "simogrants-db"
database_id = "$D1_ID"

[[kv_namespaces]]
binding = "SESSIONS"
id = "$KV_ID"

[[r2_buckets]]
binding = "EVIDENCE"
bucket_name = "simogrants-evidence"

[vars]
ENVIRONMENT = "production"

[dev]
port = 8787
local_protocol = "http"
EOF
log "wrangler.toml updated"
echo ""

# ── Run migrations ──
echo "▸ Running D1 migrations…"
echo ""
echo "  Applying 0001_initial.sql…"
npx wrangler d1 execute simogrants-db --remote --file="$BACKEND_DIR/migrations/0001_initial.sql"
log "Schema created"
echo ""

echo "  Applying 0002_seed_data.sql…"
npx wrangler d1 execute simogrants-db --remote --file="$BACKEND_DIR/migrations/0002_seed_data.sql"
log "Seed data inserted"
echo ""

# ── Summary ──
echo "═══════════════════════════════════════════════════"
echo "  Infrastructure setup complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  D1 Database:   simogrants-db"
echo "  D1 ID:         $D1_ID"
echo "  KV Namespace:  SESSIONS"
echo "  KV ID:         $KV_ID"
echo "  R2 Bucket:     simogrants-evidence"
echo ""
echo "  Next step: run ./scripts/deploy-all.sh"
echo ""
