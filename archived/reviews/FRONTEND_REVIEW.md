# Frontend Code Review — SIMOGRANTS

Full review of all pages, components, hooks, and lib files across the frontend and backend.
Conducted against the `pl-genesis-hackathon` branch at commit `f3c44e5`.

---

## Critical Issues

### 1. Session Initialization Never Called
**Files:** `hooks/useAuth.ts:14-23`, `components/ConnectButton.tsx:6`

The `checkSession()` function in `useAuth` is defined but never invoked on mount. Expired tokens are never cleared, and sessions are never restored on page reload.

```ts
// useAuth.ts — checkSession defined but never called
const checkSession = useCallback(async () => {
  if (api.getToken()) {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      api.clearToken();
    }
  }
}, []);
```

**Fix:** Add `useEffect(() => { checkSession(); }, [checkSession]);` to `useAuth`, or call `checkSession()` in the `ConnectButton` on mount.

---

### 2. Type Mismatch in Application Score Display
**File:** `pages/RoundDetail.tsx:201-204`

```ts
{((app as any).projectScore ?? app.overallScore) !== undefined && (
  <ScoreBar score={(app as any).projectScore ?? app.overallScore!} ... />
)}
```

Uses `as any` casting and a non-null assertion (`!`) on an optional value. If both `projectScore` and `overallScore` are undefined, this crashes.

**Fix:** Use proper type narrowing: `const score = app.projectScore ?? app.overallScore; {score != null && <ScoreBar score={score} ... />}`

---

### 3. Missing Error Retry in ProjectDetail
**File:** `pages/ProjectDetail.tsx:111`

```ts
if (error) return <ErrorMessage message={error} />;
```

Unlike `RoundDetail` and `BrowseRounds`, `ProjectDetail` doesn't pass an `onRetry` callback. Users cannot retry failed project loads.

**Fix:** Pass `onRetry={fetchProject}` to `ErrorMessage`.

---

### 4. Unsafe Metadata for Contract Submission
**File:** `pages/CreateRound.tsx:47-50`

```ts
const metadataURI = JSON.stringify({
  title: form.title.trim(),
  description: form.description.trim(),
});
```

Raw JSON is passed as `metadataURI` to the contract. Not validated as a proper URI, and if it exceeds contract byte limits the transaction will fail with an unhelpful error.

**Fix:** Either upload metadata to IPFS/R2 first and pass the CID as the URI, or validate length before submission and show a user-friendly error.

---

## High Priority Issues

### 5. Evaluation Trigger Missing Authorization Check
**File:** `pages/RoundDetail.tsx:98-112`

The "Run AI Evaluation" button appears for any connected user, not just the round creator. Any user can trigger evaluations on any round.

```ts
{isConnected && (round.status === 'accepting' || ...) && (
  <button onClick={() => api.triggerEvaluation(round.id)}>Run AI Evaluation</button>
)}
```

**Fix:** Add `round.creatorAddress === address` to the condition. The backend already enforces auth, but the button shouldn't appear for non-creators.

---

### 6. Hardcoded Block Explorer URLs
**Files:** `pages/RoundDetail.tsx:261`, `pages/RoundResults.tsx:101,197`

```ts
href={`https://sepolia.basescan.org/address/${round.contractAddress}`}
```

Hardcoded for Base Sepolia. Will break on mainnet.

**Fix:** Create a `getExplorerUrl(chainId, address)` utility. Use `basescan.org` for mainnet (8453) and `sepolia.basescan.org` for testnet (84532).

---

### 7. Missing Pagination in BrowseRounds
**File:** `pages/BrowseRounds.tsx`

API returns `total` count but frontend loads all rounds at once with no pagination or infinite scroll. Won't scale past the backend's default limit.

**Fix:** Add offset/limit params and pagination controls, or implement infinite scroll with intersection observer.

---

### 8. Dashboard Shows Global Stats Instead of User Stats
**File:** `pages/Dashboard.tsx:113,125`

```ts
<div>{userInfo?.roundsCreated ?? rounds.length}</div>
<div>{userInfo?.applicationsSubmitted ?? 0}</div>
```

Fallback shows total round count (all users) when `userInfo` is null. Should show 0 or prompt to connect wallet.

**Fix:** Show 0 when not authenticated rather than falling back to global counts.

---

### 9. On-Chain Features Shown When Contracts Not Deployed
**File:** `pages/RoundResults.tsx:99-114`

The "On-Chain Verified" card appears based on `isContractsDeployed(chainId)`, but on Base Mainnet (8453) the addresses are `0x000...000`, so `isContractsDeployed` returns false — yet the code still renders the card (just showing "Off-Chain"). This is fine, but the BaseScan links in the attestation column should not render for zero-address contracts.

**Fix:** Guard BaseScan links with `contractsReady && addresses.AttestationRegistry !== '0x000...'`.

---

## Medium Priority Issues

### 10. Race Condition in ApplyToRound
**File:** `pages/ApplyToRound.tsx:73-105`

Three sequential operations: create project, apply to round, submit on-chain. If step 3 fails, the backend state is committed but blockchain state is not. The user is redirected to success. The error is only `console.warn`'d.

**Fix:** Show a warning toast: "Application submitted, but on-chain recording failed. You can retry from the round page."

---

### 11. Unsafe aggregatedScores Access in ProjectDetail
**File:** `pages/ProjectDetail.tsx:188`

```ts
{Object.entries(latestEval.aggregatedScores).map(...)
```

If `evaluations` is empty, `latestEval` is `undefined` and this crashes.

**Fix:** Guard with `latestEval?.aggregatedScores && Object.entries(...)`.

---

### 12. Missing Allocation Empty State
**File:** `pages/ProjectDetail.tsx:215`

When a project has no allocations, the entire "Allocation History" section is hidden silently. No feedback.

**Fix:** Add an empty state message: "This project hasn't received any funding allocations yet."

---

### 13. Inefficient Dashboard Data Fetching
**File:** `pages/Dashboard.tsx:24-29`

Fetches ALL rounds and ALL projects globally, then only displays the first few. Should fetch paginated or user-filtered data.

**Fix:** Pass `?limit=6` or `?creator=<address>` to the API calls.

---

### 14. API Filter Params May Not Match Backend
**File:** `pages/BrowseRounds.tsx:28`

```ts
const params = activeTab === 'all' ? {} : { status: activeTab };
```

Tab values include 'active', 'accepting', 'funded'. Need to confirm the backend's `GET /rounds?status=` supports all these values and the filter works correctly.

**Fix:** Verify backend filtering logic and align tab values with supported status values.

---

## Low Priority Issues

### 15. Hardcoded Landing Page Stats
**File:** `pages/Landing.tsx:33-38`

```ts
const STATS = [
  { value: '5+', label: 'Real Attestations' },
  { value: '$250K+', label: 'Evaluated' },
  { value: '4', label: 'Stakeholder Agents' },
  { value: '3', label: 'Rounds Completed' },
];
```

These will become stale. Should fetch from `/api/stats` on mount.

**Fix:** Replace with a `useEffect` that calls `api.getStats()` and populates dynamically. Keep hardcoded values as fallback during loading.

---

### 16. Console Warning Left in Production
**File:** `pages/ApplyToRound.tsx:100`

```ts
console.warn('On-chain application tx failed:', txErr);
```

**Fix:** Remove or replace with user-visible feedback.

---

### 17. Hardcoded Date Locale
**Files:** `pages/RoundDetail.tsx:133`, `pages/ProjectDetail.tsx:262`, others

```ts
toLocaleDateString('en-US', { month: 'short', ... })
```

**Fix:** Use `toLocaleDateString(undefined, ...)` to respect user's browser locale.

---

### 18. Missing Accessibility Attributes
**Files:** All components

- `ScoreBar.tsx` — No aria labels for progress bars
- `AllocationBar.tsx` — Same
- Form error messages not linked via `aria-describedby`
- Tab navigation in `RoundDetail.tsx` not using `role="tablist"` / `role="tab"` / `aria-selected`

**Fix:** Add ARIA attributes progressively. Tab panels are the highest-priority fix.

---

### 19. No Unit or Component Tests
**Files:** All pages and components

No test files exist for any frontend code. Contract hook interactions and API transformations are particularly risky without tests.

**Fix:** Add tests for critical paths: `useAuth`, `useContracts` hooks, `api.ts` transformations, `CreateRound` and `ApplyToRound` submit flows.

---

## Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| Critical | 4 | Auth session, type safety, error handling, contract metadata |
| High | 5 | Authorization, hardcoded URLs, pagination, dashboard stats, contract checks |
| Medium | 5 | Race conditions, null safety, empty states, performance, API params |
| Low | 5 | Hardcoded content, console logs, locale, accessibility, tests |

### Recommended Priority Order

1. **Fix auth session initialization** (#1) — Users can't maintain sessions
2. **Add evaluation authorization check** (#5) — Security issue
3. **Fix type safety in score display** (#2) — Potential crashes
4. **Add error retry to ProjectDetail** (#3) — Quick win
5. **Make block explorer URLs dynamic** (#6) — Required before mainnet
6. **Fix dashboard to show user data** (#8) — Misleading stats
7. **Add pagination to BrowseRounds** (#7) — Scalability
8. **Handle ApplyToRound race condition** (#10) — Data consistency
