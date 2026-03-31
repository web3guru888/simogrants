# 🎬 SIMOGRANTS Demo Script

**Duration: ~4 minutes**
**Preparation:** Open MetaMask, switch to Base Sepolia network

---

## Scene 1: Introduction (0:00 - 0:30)

**Voiceover / Text overlay:**
> "SIMOGRANTS — Stigmergic Impact Oracle for Grants. A decentralized, AI-powered grant evaluation platform built on Ethereum and Cloudflare."

**Actions:**
1. Show the landing page: https://simogrants.pages.dev
2. Pan down to show the hero section
3. Highlight: "Autonomous multi-agent evaluation", "On-chain attestations", "Quadratic funding"

---

## Scene 2: Wallet Connect (0:30 - 1:00)

**Voiceover:**
> "Getting started is simple — just connect your wallet. We use Sign-In with Ethereum for secure, passwordless authentication."

**Actions:**
1. Click "Connect Wallet" button (top right)
2. MetaMask popup appears — connect
3. Show the signed message (SIWE)
4. Once connected, show the user address in the header

---

## Scene 3: Browse Grant Rounds (1:00 - 1:45)

**Voiceover:**
> "Browse active grant rounds. Each round has a matching pool, evaluation criteria, and deadline. The data comes from our Cloudflare Workers API backed by D1 database."

**Actions:**
1. Navigate to "Browse Rounds" (or show from landing page)
2. Show 3 rounds:
   - "Ethereum Infrastructure Round 1" — $500K pool, evaluating
   - "DeFi Safety & Auditing Round" — $250K pool, accepting applications
   - "Community Governance Fund" — $150K pool, funded
3. Click into "Ethereum Infrastructure Round 1"
4. Show round details: description, deadline, projects, evaluation status

---

## Scene 4: View Project Evaluations (1:45 - 2:30)

**Voiceover:**
> "Each project gets evaluated by our autonomous multi-agent system across multiple dimensions: impact, feasibility, team quality, and innovation. The pheromone signal system creates an emergent consensus."

**Actions:**
1. From the round detail page, show the list of projects
2. Click on "OpenZeppelin" project
3. Show project detail with evaluation scores:
   - Overall score: 88.5
   - Individual dimension scores
4. Explain the stigmergic evaluation briefly

---

## Scene 5: Round Results & QF Allocation (2:30 - 3:15)

**Voiceover:**
> "Results use Sequential Quadratic Funding with PageRank-based weighting. This ensures fair allocation that accounts for project dependencies and community signals."

**Actions:**
1. Navigate to "Community Governance Fund" (status: funded)
2. Show the results page with:
   - Allocation bar charts
   - QF matching amounts
   - Project rankings
3. Highlight the transparency — all calculations are reproducible

---

## Scene 6: Create a Round (3:15 - 3:45)

**Voiceover:**
> "Anyone can create a grant round. Set your matching pool, evaluation criteria, and deadlines. Smart contracts on Base handle the on-chain logic."

**Actions:**
1. Navigate to "Create Round"
2. Fill in the form (or show pre-filled):
   - Title: "Demo Round"
   - Description: brief text
   - Matching pool: $10,000
   - Chain: Base
3. Show the form validation and submission
4. Brief mention of the GrantFactory contract

---

## Scene 7: Smart Contracts & Close (3:45 - 4:00)

**Voiceover:**
> "All evaluation results are stored as on-chain attestations on Base. The GrantFactory uses EIP-1167 minimal proxies for gas-efficient round creation. SIMOGRANTS — making public goods funding transparent, trustless, and scalable."

**Actions:**
1. Show the contract addresses (maybe a quick screenshot of BaseScan)
2. Final shot: landing page with tagline
3. Links: simogrants.pages.dev | github.com/web3guru888/simogrants

---

## 🔗 Quick Links for Demo

- **Live site:** https://simogrants.pages.dev
- **API:** https://simogrants-api.jingjai.workers.dev/api
- **Rounds API:** https://simogrants-api.jingjai.workers.dev/api/rounds
- **Stats:** https://simogrants-api.jingjai.workers.dev/api/stats
- **GrantFactory on BaseScan:** https://sepolia.basescan.org/address/0x795b0475aBd01B5F09479d81a4C56f8dF829e5dA

## 📝 Tips for Recording

- Use a screen recording tool (OBS, Loom, or browser built-in)
- Set browser to 1920x1080 for clean capture
- Use Base Sepolia network in MetaMask
- Pre-load the pages so there's no waiting
- Keep transitions smooth — don't rush
- Have a fallback plan if wallet connect has issues (show mock data mode)
- End with a clear CTA: "Vote for SIMOGRANTS on DoraHacks!"
