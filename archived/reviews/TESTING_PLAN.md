# Live Testing Plan — SIMOGRANTS

Comprehensive manual testing plan for the live deployment at https://simogrants.com.
Covers all user flows, smart contract interactions, ASI1 evaluation, and edge cases.

**Prerequisites:**
- MetaMask browser extension installed
- MetaMask configured for Base Sepolia (chain ID 84532, RPC: https://sepolia.base.org)
- Base Sepolia testnet ETH in wallet ([faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet))
- Browser dev tools open (Console tab) to monitor errors

---

## 1. Landing Page

### 1.1 Visual & Content
- [ ] Page loads within 3 seconds
- [ ] Syne font renders on hero title and section headings (not Inter/Arial)
- [ ] Outfit font renders on body text
- [ ] Amber/gold accent color on CTAs and highlights (not purple)
- [ ] Noise texture overlay visible on background (subtle grain)
- [ ] Dot grid pattern visible in hero section
- [ ] Pheromone trail SVG lines animate (subtle opacity pulse)
- [ ] Background orbs float with organic drift (not pulsing)
- [ ] Staggered fade-up animation on hero elements (badge → title → subtitle → CTAs)
- [ ] "ASI1" mentioned in hero subtitle, feature card, and "How It Works" step 3
- [ ] "Base Sepolia" mentioned in hero subtitle and attestation feature card
- [ ] Stats section shows dynamic pool total (fetched from API, not hardcoded)
- [ ] Custom hexagonal favicon in browser tab (not Vite default)

### 1.2 Navigation
- [ ] "Browse Rounds" CTA navigates to `/rounds`
- [ ] "Create Round" CTA navigates to `/create-round`
- [ ] Nav bar sticky on scroll with backdrop blur
- [ ] Logo "SIMOGRANTS" with amber accent visible
- [ ] Nav links: Home, Rounds, Create, Dashboard
- [ ] Active nav link highlighted in amber
- [ ] "Connect Wallet" button visible in nav (amber)

### 1.3 Footer
- [ ] Footer shows "Base Sepolia", "ASI1", "Cloudflare", "SQF" tags
- [ ] Footer description mentions "ASI1-powered agents" and "Base Sepolia"
- [ ] Footer links navigate correctly

### 1.4 Responsive
- [ ] Mobile (375px): No horizontal overflow
- [ ] Mobile: Hamburger menu toggles nav
- [ ] Mobile: CTAs stack vertically
- [ ] Tablet (768px): 2-column feature grid

---

## 2. Wallet Connection & Authentication

### 2.1 Fresh Connection
- [ ] Click "Connect Wallet" → MetaMask popup opens
- [ ] Select account → MetaMask asks to sign SIWE message
- [ ] SIWE message contains: "simogrants.com wants you to sign in with your Ethereum account" + nonce
- [ ] After signing: button changes to truncated address with green dot
- [ ] Console: no errors after connection
- [ ] `localStorage` contains `simogrants_token` key

### 2.2 Session Persistence
- [ ] Refresh page → wallet still shows as connected
- [ ] Session restores automatically (useAuth checkSession fires on mount)
- [ ] If token expired → auto-triggers new SIWE sign prompt

### 2.3 Disconnect
- [ ] Click "Disconnect" → address disappears, "Connect Wallet" returns
- [ ] `simogrants_token` removed from localStorage
- [ ] Authenticated pages show appropriate prompts

### 2.4 Wrong Network
- [ ] Connect with MetaMask on Ethereum mainnet
- [ ] Verify behavior — contract hooks should show `contractsReady: false`
- [ ] No mainnet options in any dropdown (Create Round chain selector only shows "Base Sepolia")

---

## 3. Browse Rounds

### 3.1 Page Load
- [ ] Navigate to `/rounds`
- [ ] Page title: "Grant Rounds"
- [ ] Filter tabs visible: All Rounds, Active, Accepting, Funded
- [ ] Default tab: "All Rounds" with count badge
- [ ] Round cards render with `data-testid="round-card"`

### 3.2 Round Cards
- [ ] Each card shows: title, description (truncated 2 lines), pool amount, application count, deadline
- [ ] Pool amount in amber color with currency label
- [ ] Deadline shows days remaining (green) or "Closed" (red)
- [ ] Chain indicator shows "base-sepolia"
- [ ] "View Details →" link in amber
- [ ] Hover: border changes to amber, smooth transition

### 3.3 Filters
- [ ] Click "Active" → only active rounds shown
- [ ] Click "Accepting" → only accepting rounds shown
- [ ] Click "Funded" → only funded rounds shown
- [ ] Click "All Rounds" → all rounds shown
- [ ] Active filter highlighted in amber

### 3.4 Click Through
- [ ] Click a round card → navigates to `/rounds/{id}`
- [ ] Back button returns to `/rounds` with filter state preserved

### 3.5 Empty State
- [ ] If a filter returns no results: "No rounds found" message with search icon

---

## 4. Create Round

### 4.1 Page Load (Unauthenticated)
- [ ] Navigate to `/create-round` without wallet connected
- [ ] Form renders with all fields
- [ ] Amber warning: "Connect your wallet to deploy this round on-chain"
- [ ] Submit button says "Create Round" (not "Create Round (On-Chain)")

### 4.2 Page Load (Authenticated)
- [ ] Connect wallet first, then navigate to `/create-round`
- [ ] No amber warning shown
- [ ] Submit button says "Create Round (On-Chain)"

### 4.3 Form Validation
- [ ] Title field: required, shows validation on empty submit
- [ ] Description field: required, textarea
- [ ] Matching Pool: number input, default 10000, min 0
- [ ] Chain: dropdown with only "Base Sepolia (Testnet)" — no mainnet option
- [ ] Application Deadline: date picker, required
- [ ] Max Applications: number input, default 50, min 1, max 500

### 4.4 Submission (Authenticated, On-Chain)
- [ ] Fill all fields, click "Create Round (On-Chain)"
- [ ] Button changes to spinner: "Confirm in Wallet..."
- [ ] MetaMask popup asks to confirm GrantFactory.createRound() transaction
- [ ] After MetaMask confirm: "Waiting for Confirmation..."
- [ ] After tx confirms: "Creating..." (backend save)
- [ ] Redirect to `/rounds`
- [ ] New round appears in round list with correct title, pool, deadline
- [ ] Check BaseScan Sepolia: transaction visible from your address to GrantFactory

### 4.5 Submission (Unauthenticated, Off-Chain)
- [ ] Fill all fields without connecting wallet
- [ ] Click "Create Round"
- [ ] Round saves to backend (API call succeeds)
- [ ] Redirect to `/rounds`
- [ ] New round appears with `contract_address: null`

### 4.6 Error Handling
- [ ] Reject MetaMask transaction → error message shown, form remains filled
- [ ] Submit with description > 500 chars on-chain → "Description too long" error before tx
- [ ] Network error → error banner with message

---

## 5. Round Detail

### 5.1 Page Load
- [ ] Navigate to `/rounds/{id}`
- [ ] Header shows: title, status badge, description
- [ ] Stats grid: Matching Pool (amber), Applications count, Deadline, Chain (teal)
- [ ] "Apply to This Round" button visible for accepting/active rounds
- [ ] "View Results" button visible for funded/closed rounds

### 5.2 Applications Tab
- [ ] Default tab is "Applications"
- [ ] Each application shows: project name, status badge, applied date
- [ ] Score bar if evaluated
- [ ] Click application → navigates to `/projects/{id}`
- [ ] Empty state: "No applications yet" with icon

### 5.3 Details Tab
- [ ] Click "Details" tab
- [ ] Statistics: Total Applications, Matching Pool, Allocated, Avg Score
- [ ] Round Information: Created date, Last Updated, Creator address (truncated)
- [ ] Contract address links to BaseScan Sepolia (if contract deployed)
- [ ] On-Chain Status displayed if contract exists (Created/Accepting/Evaluating/etc.)
- [ ] On-Chain Applications count
- [ ] Factory Round Count

### 5.4 Evaluate Button (Round Creator Only)
- [ ] Connect wallet that created the round
- [ ] "Run AI Evaluation" button appears (green/teal)
- [ ] Connect a different wallet → button does NOT appear
- [ ] Click evaluate → ASI1 runs, round status changes to "evaluating" then "funded"
- [ ] After evaluation: "View Results" button appears

### 5.5 Evaluate Button (Non-Creator)
- [ ] Connect a wallet that did NOT create the round
- [ ] "Run AI Evaluation" button should NOT appear
- [ ] Verify no unauthorized evaluation is possible

---

## 6. Apply to Round

### 6.1 Page Load
- [ ] Navigate to `/rounds/{id}/apply` for an accepting round
- [ ] Back link shows round title
- [ ] Form shows: Project Name, Description, Website, GitHub URL, Team Size, Category

### 6.2 Closed Round
- [ ] Navigate to apply page for a funded/closed round
- [ ] "Applications Closed" message shown instead of form

### 6.3 On-Chain Info
- [ ] Connect wallet, apply to round with contract address
- [ ] Green banner: "Your application will be recorded on-chain"

### 6.4 Submission
- [ ] Fill required fields (name, description, team size, category)
- [ ] Click submit
- [ ] Backend: project created + application submitted
- [ ] If wallet connected + round has contract: MetaMask popup for GrantRound.submitApplication()
- [ ] If on-chain tx fails: warning message shown but backend application still saved
- [ ] Redirect to `/rounds/{id}`
- [ ] Application appears in round detail applications list

### 6.5 Form Validation
- [ ] Empty name → blocked
- [ ] Empty description → blocked
- [ ] Invalid website URL → HTML5 validation
- [ ] Invalid GitHub URL → HTML5 validation
- [ ] Category dropdown: 8 options (developer-tooling, defi, governance, etc.)

---

## 7. ASI1 Evaluation Pipeline

### 7.1 Trigger Evaluation
- [ ] As round creator, go to round detail
- [ ] Click "Run AI Evaluation"
- [ ] API call: `POST /rounds/{id}/evaluate`
- [ ] Backend calls ASI1 API with 4 stakeholder prompts in parallel
- [ ] Response returns within 30-60 seconds for 5 projects
- [ ] Round status changes to "funded"

### 7.2 Verify Evaluation Quality
- [ ] Go to `/rounds/{id}/results`
- [ ] Each project has an overall score (0-100)
- [ ] Scores are calibrated (most projects 35-75 range)
- [ ] Funder agent is skeptical of self-sustaining projects (e.g., Uniswap scores lower on capital_efficiency)
- [ ] SQF allocation: top project gets most, distribution follows QF curve
- [ ] Pheromone and PageRank modifiers visible

### 7.3 Verify Evaluation Data
- [ ] Click a project name → `/projects/{id}`
- [ ] Stakeholder Evaluations: 4 cards (Developer, User, Funder, Ecosystem)
- [ ] Each card shows 3 dimension scores with justifications
- [ ] Confidence level shown per agent
- [ ] Narrative per agent
- [ ] Aggregated Scores section shows all 12 dimensions
- [ ] Tension Analysis section shows disagreements (if spread > 15)

### 7.4 Re-Evaluation
- [ ] Trigger evaluation again on same round
- [ ] Old evaluation rows deleted, new ones inserted (no duplicates)
- [ ] Results page shows latest scores only

---

## 8. Round Results

### 8.1 Page Load
- [ ] Navigate to `/rounds/{id}/results`
- [ ] Summary cards: Total Pool, Total Allocated, Projects Funded, Average Score, On-Chain status
- [ ] On-Chain card shows "Verified" with BaseScan link (if contracts deployed) or "Off-Chain"
- [ ] 5-column grid on desktop

### 8.2 Allocation Visualization
- [ ] Bar chart showing funding distribution per project
- [ ] Bars proportional to allocation amount
- [ ] Percentage shown per bar

### 8.3 Rankings Table
- [ ] Desktop: full table with Rank, Project, Score, SQF Allocation, QF Base, Pheromone, PageRank, Attestation
- [ ] Rank badges: gold (#1), silver (#2), bronze (#3)
- [ ] Score bar per project
- [ ] Pheromone/PageRank modifiers with green (>=1) or red (<1) coloring
- [ ] Attestation column: "On-Chain" link to BaseScan or "Pending" badge
- [ ] Mobile: card layout with compact info

### 8.4 Navigation
- [ ] "Back to Round" link navigates to round detail
- [ ] Project names link to `/projects/{id}`

---

## 9. Project Detail

### 9.1 Page Load
- [ ] Navigate to `/projects/{id}`
- [ ] Header: project name, category badge, description
- [ ] Website and GitHub links (if provided)
- [ ] Team size
- [ ] Overall score (large amber number)
- [ ] Error retry button works if page fails to load

### 9.2 Evaluations
- [ ] Stakeholder Evaluations: 4 cards with dimension scores
- [ ] Aggregated Scores: 12 dimension bars (guarded — no crash if empty)
- [ ] Tension Analysis: tension cards with high/low agent comparison

### 9.3 Allocations
- [ ] Allocation History: rounds where project received funding
- [ ] QF Base, Pheromone Mod, PageRank Mod shown with null safety (`?.` guards, "—" fallback)
- [ ] Empty state: "This project hasn't received any funding allocations yet."

### 9.4 Dates
- [ ] All dates use browser locale (not hardcoded en-US)

---

## 10. Dashboard

### 10.1 Unauthenticated
- [ ] Navigate to `/dashboard` without wallet
- [ ] "Connect Your Wallet" prompt with wallet icon
- [ ] Public stats shown: Total Rounds, Total Projects

### 10.2 Authenticated
- [ ] Connect wallet, navigate to `/dashboard`
- [ ] Welcome message with truncated address
- [ ] Stats: My Rounds (count), My Projects (count), Avg Score
- [ ] Stats show YOUR data, not global totals (verify with a fresh wallet — should show 0s)

### 10.3 My Rounds Section
- [ ] Shows only rounds where `creatorAddress` matches your wallet
- [ ] Empty state if you haven't created any rounds
- [ ] Max 3 rounds shown with "View all" link

### 10.4 My Projects Section
- [ ] Shows only projects where `createdBy` matches your wallet
- [ ] Empty state if you haven't submitted any projects
- [ ] Max 6 projects shown with "Find rounds" link

### 10.5 Quick Actions
- [ ] "Create Round" button (amber) → `/create-round`
- [ ] "Browse Rounds" button → `/rounds`

---

## 11. API Endpoints

### 11.1 Public Endpoints
```bash
# Health check
curl https://simogrants-api.jingjai.workers.dev/api/health
# Expected: {"status":"ok","service":"simogrants-api","version":"1.0.0"}

# List rounds
curl https://simogrants-api.jingjai.workers.dev/api/rounds
# Expected: {"rounds":[...],"total":N}

# Platform stats
curl https://simogrants-api.jingjai.workers.dev/api/stats
# Expected: {"overview":{...},"roundsByStatus":{...}}

# Auth nonce (POST)
curl -X POST https://simogrants-api.jingjai.workers.dev/api/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address":"0x0000000000000000000000000000000000000001"}'
# Expected: {"nonce":"...","message":"simogrants.com wants you to sign in..."}
```

### 11.2 Authenticated Endpoints
```bash
# Create round (requires Bearer token)
curl -X POST https://simogrants-api.jingjai.workers.dev/api/rounds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","description":"Test round","matching_pool":1000}'
# Expected: 201 with round object

# Trigger evaluation (requires Bearer token, must be round creator)
curl -X POST https://simogrants-api.jingjai.workers.dev/api/rounds/ROUND_ID/evaluate \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: {"pipelineRunId":"...","status":"complete","projectCount":N}
```

### 11.3 Error Cases
- [ ] Missing auth header → 401 `{"error":"Missing or invalid Authorization header"}`
- [ ] Expired token → 401 `{"error":"Session expired"}`
- [ ] Invalid round ID → 404 `{"error":"Round not found"}`
- [ ] Invalid JSON body → 400 `{"error":"Validation error"}`

---

## 12. Smart Contract Integration

### 12.1 GrantFactory
- [ ] Create round with wallet connected → MetaMask tx fires
- [ ] Transaction visible on BaseScan Sepolia
- [ ] GrantFactory address: `0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA`

### 12.2 GrantRound
- [ ] Apply to round with contract address → MetaMask tx fires for submitApplication()
- [ ] Application recorded on-chain

### 12.3 On-Chain Reads
- [ ] Round Detail "Details" tab shows on-chain status, app count, factory count
- [ ] Data comes from wagmi `useReadContract` hooks
- [ ] Values refresh when contract state changes

### 12.4 AttestationRegistry
- [ ] Round Results "Attestation" column shows "On-Chain" links
- [ ] Links point to correct BaseScan Sepolia address: `0xb7064a2C8283a7a5f2D54E43c509FE76DA2D1dD9`

---

## 13. Edge Cases & Error Handling

### 13.1 Network Errors
- [ ] Disconnect internet → API calls show error messages with "Try Again" button
- [ ] Reconnect → "Try Again" works

### 13.2 Invalid Routes
- [ ] Navigate to `/nonexistent` → 404 page or redirect
- [ ] Navigate to `/rounds/fake-id` → "Round not found" error
- [ ] Navigate to `/projects/fake-id` → error with retry button

### 13.3 Concurrent Operations
- [ ] Click "Create Round" rapidly → no duplicate submissions (button disabled while submitting)
- [ ] Click "Run AI Evaluation" while another eval is running → graceful handling

### 13.4 Large Data
- [ ] Round with many applications → page renders without crash
- [ ] Long project descriptions → text truncated with line-clamp

### 13.5 Wallet Edge Cases
- [ ] Switch MetaMask accounts while on dashboard → data should reflect new account
- [ ] Reject SIWE signature → stays disconnected, no errors
- [ ] Lock MetaMask while tx pending → tx fails gracefully

---

## 14. Performance

### 14.1 Load Times
- [ ] Landing page: < 3 seconds
- [ ] Browse Rounds: < 2 seconds
- [ ] Round Detail: < 2 seconds
- [ ] API health: < 500ms
- [ ] API rounds list: < 1 second

### 14.2 Assets
- [ ] Zero 404s on any page (check Network tab)
- [ ] JS bundle < 600KB gzipped
- [ ] CSS < 10KB gzipped
- [ ] No render-blocking resources

### 14.3 Console
- [ ] Zero console errors on any page
- [ ] Only expected warning: `[wagmi] VITE_WC_PROJECT_ID not set` (when no WalletConnect ID)
- [ ] No `console.warn` or `console.log` from application code in production

---

## 15. Cross-Browser

- [ ] Chrome (latest): all tests pass
- [ ] Firefox (latest): all tests pass
- [ ] Safari (latest): all tests pass
- [ ] Mobile Safari (iOS): responsive layout, wallet connect via WalletConnect
- [ ] Mobile Chrome (Android): responsive layout

---

## 16. Automated E2E Tests

Run the full Playwright suite to verify:
```bash
cd e2e-tests
npx playwright test --reporter=list
```

Expected: 12/12 passing, zero console errors.

| # | Test | Validates |
|---|------|-----------|
| 1 | Landing Page | Hero, nav, wallet button, SEO, load time |
| 2 | Browse Rounds | Round cards with data-testid, click navigation |
| 3 | Round Detail | Headings, metadata, status |
| 4 | Round Results | Allocation data, scores, rankings |
| 5 | Create Round | Form inputs, submit button |
| 6 | Apply to Round | Form or "Applications Closed" |
| 7 | Dashboard | Content or wallet prompt |
| 8 | API Endpoints | Health, Rounds, Stats, Auth Nonce (POST) |
| 9 | Responsive | No overflow at 375px, readable font |
| 10 | Accessibility | Alt text, empty links, heading hierarchy, lang |
| 11 | SPA Navigation | Client-side routing, back/forward |
| 12 | Static Assets | Zero 404s, fast load |

---

## 17. Database Verification

Verify data integrity directly:
```bash
# Check rounds (remote D1)
npx wrangler d1 execute simogrants-db --remote \
  --command="SELECT id, title, creator_address, status, application_deadline, contract_address FROM rounds ORDER BY created_at DESC"

# Check projects
npx wrangler d1 execute simogrants-db --remote \
  --command="SELECT id, name, category, created_by, overall_score FROM projects ORDER BY created_at DESC"

# Check applications
npx wrangler d1 execute simogrants-db --remote \
  --command="SELECT id, round_id, project_id, status FROM applications ORDER BY applied_at DESC"

# Check evaluations
npx wrangler d1 execute simogrants-db --remote \
  --command="SELECT application_id, overall_score, data_completeness, evaluated_at FROM evaluations ORDER BY evaluated_at DESC"

# Check users
npx wrangler d1 execute simogrants-db --remote \
  --command="SELECT address, last_login FROM users ORDER BY last_login DESC"
```

---

## Sign-Off Checklist

| Area | Status | Tester | Date |
|------|--------|--------|------|
| Landing Page | | | |
| Wallet Connection | | | |
| Browse Rounds | | | |
| Create Round | | | |
| Round Detail | | | |
| Apply to Round | | | |
| ASI1 Evaluation | | | |
| Round Results | | | |
| Project Detail | | | |
| Dashboard | | | |
| API Endpoints | | | |
| Smart Contracts | | | |
| Edge Cases | | | |
| Performance | | | |
| Cross-Browser | | | |
| E2E Automated | | | |
| Database | | | |
