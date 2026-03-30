# SIMOGRANTS E2E Test Report

**Date**: 2026-03-30 11:12 UTC  
**Platform**: Cloudflare Pages (simogrants.pages.dev) + Workers API  
**Browser**: Chromium (Playwright headless)  
**Test Suite**: 12 tests  

---

## 📊 Summary

| Metric | Count |
|--------|-------|
| **Total Tests** | 12 |
| **Passed** | 9 |
| **Failed (initial)** | 3 |
| **Fixed & Re-passed** | 1 (Test 4) |
| **Remaining Issues** | 2 (non-critical) |
| **Pass Rate** | 75% → 83% (after fix) |

---

## ✅ Passing Tests

### Test 1: Landing Page ✅
- Hero section renders correctly
- Page title: "SIMOGRANTS — Stigmergic Impact Oracle"
- Connect Wallet button present
- 5 navigation links found
- Viewport meta tag set correctly
- Load time: ~1.5s ✅

### Test 3: Round Detail ✅
- Round info renders (headings, content)
- 6 headings found on page
- Content displays properly
- Load time: ~1.5s ✅

### Test 5: Create Round Page ✅
- 6 form inputs found
- Form fields for Title, Description, Chain, Token, Amount present
- Submit button present
- Load time: ~1.2s ✅

### Test 6: Apply to Round ✅
- 6 form inputs found
- Application fields for Project, Name, Description present
- Load time: ~1.2s ✅

### Test 7: Dashboard ✅
- Loads correctly (shows Connect Wallet prompt when unauthenticated)
- Public stats displayed (Total Rounds, Total Projects)
- Load time: ~1.2s ✅

### Test 8: API Endpoints (3/4 passed) ✅
- `GET /api/health` → 200 (95ms) ✅
- `GET /api/rounds` → 200 (53ms) ✅
- `GET /api/stats` → 200 (76ms) ✅
- `GET /api/auth/nonce` → 404 (see Issue #5) ❌

### Test 9: Responsive Design ✅
- No horizontal overflow at 375x667
- Body font size: 16px ✅
- Touch targets adequate

### Test 10: Accessibility ✅
- No images without alt text
- No empty links or buttons
- Proper heading hierarchy: H1 → H2 → H3 → H3 → H3 → H2 → H3 → H3 → H3 → H2 → H4 → H4
- HTML lang="en" set correctly
- Single H1 tag ✅

### Test 11: SPA Navigation ✅
- All routes load correctly: /rounds, /dashboard, /create-round, /
- Browser back/forward works
- No 404s or blank pages ✅

### Test 12: Static Assets ✅
- No 404 errors on static assets
- Page load time: ~1.4s ✅

---

## ❌ Failing Tests

### Test 2: Browse Rounds ❌ (LOW severity)
**Issue**: Clicking the first element matching generic CSS selectors (`[class*="card"]`) navigated to homepage instead of round detail page.  
**Cause**: 25 elements match the broad selector; the first match is a tab button, not a round card.  
**Actual behavior**: Round cards ARE proper `<Link>` elements that navigate correctly — this is a test specificity issue.  
**GitHub Issue**: [#5](https://github.com/web3guru888/simogrants/issues/5)

### Test 4: Round Results ❌ → ✅ FIXED
**Issue**: Page crashed with `Cannot read properties of null (reading 'qfBase')`  
**Cause**: API returns `sqfDetails: null` but component accessed properties without null check.  
**Fix Applied**: Added optional chaining (`?.`) and null coalescing (`??`) to all `sqfDetails` accesses in `RoundResults.tsx`.  
**Status**: ✅ Fixed, redeployed, test passes (body text: 10 chars → 1142 chars)  
**GitHub Issue**: [#1](https://github.com/web3guru888/simogrants/issues/1)

### Test 8: API /auth/nonce ❌ (LOW severity)
**Issue**: `GET /api/auth/nonce?address=0x...` returns 404  
**Cause**: Endpoint is POST-only, not RESTful for GET requests  
**Actual behavior**: POST with JSON body works correctly: `{"nonce":"...","message":"..."}`  
**GitHub Issue**: (covered in API design discussion)

---

## 🔍 Cross-Cutting Issues (Every Page)

### Reown/WalletConnect Config 403 Error (MEDIUM)
Every page load triggers console errors from the Reown SDK:
```
[Reown Config] Failed to fetch remote project configuration. Using local/default values. Error: HTTP status code: 403
Failed to load resource: the server responded with a status of 403 ()
Failed to load resource: the server responded with a status of 400 ()
```
**Cause**: `VITE_WC_PROJECT_ID` defaults to `'demo-project-id'` (invalid).  
**GitHub Issue**: [#2](https://github.com/web3guru888/simogrants/issues/2)

### API snake_case/camelCase Mismatch (MEDIUM)
Backend returns snake_case, frontend expects camelCase. Handled via `toCamelCase()` converter but creates fragile coupling.  
**GitHub Issue**: [#4](https://github.com/web3guru888/simogrants/issues/4)

---

## 📋 GitHub Issues Created

| # | Title | Severity | URL |
|---|-------|----------|-----|
| 1 | RoundResults page crashes when sqfDetails is null | 🔴 Critical (FIXED) | https://github.com/web3guru888/simogrants/issues/1 |
| 2 | Reown/WalletConnect config 403 error on every page | 🟡 Medium | https://github.com/web3guru888/simogrants/issues/2 |
| 4 | API snake_case/camelCase mismatch | 🟡 Medium | https://github.com/web3guru888/simogrants/issues/4 |
| 5 | Browse Rounds generic CSS selector clicks wrong element | 🟢 Low | https://github.com/web3guru888/simogrants/issues/5 |

---

## 🚀 Recommendations (Priority Order)

### 1. ✅ DONE: Fix RoundResults null safety
Added optional chaining to all `sqfDetails` accesses. Deployed to production.

### 2. Set valid WalletConnect Project ID
Get a free project ID from https://cloud.walletconnect.com and set `VITE_WC_PROJECT_ID` in the build. This eliminates 6+ console errors per page.

### 3. Fix Backend API nonce results
Update the results endpoint to return proper `sqfDetails` instead of `null`:
```json
{"sqfDetails": {"qfBase": 0, "pheromoneMod": 1, "pagerankMod": 1}}
```

### 4. Add data-testid attributes for testing
Add `data-testid="round-card-{id}"` to RoundCard and similar components for reliable E2E testing.

### 5. Add GET handler for /auth/nonce
Either add a GET handler or return 405 Method Not Allowed instead of 404.

---

## 📁 Files

- Test suite: `e2e-tests/full-suite.spec.ts`
- Playwright config: `e2e-tests/playwright.config.ts`
- Console output: `e2e-tests/console-output.log`
- Test results JSON: `e2e-tests/test-results.json`
- Failure screenshots: `e2e-tests/test-results/`
