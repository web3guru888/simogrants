const { chromium } = require("playwright");

const BASE = "https://simogrants.pages.dev";
const API = "https://simogrants-api.jingjai.workers.dev/api";

const results = [];
const consoleLogs = [];
let testNum = 0;

function log(msg) { console.log(msg); }
function pass(name) { testNum++; results.push({ num: testNum, name, status: "PASS" }); log(`  ✅ #${testNum} ${name}`); }
function fail(name, reason) { testNum++; results.push({ num: testNum, name, status: "FAIL", reason }); log(`  ❌ #${testNum} ${name} — ${reason}`); }
function assert(condition, name, reason) { condition ? pass(name) : fail(name, reason || "assertion failed"); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "SIMOGRANTS-E2E-Test/1.0",
  });
  const page = await context.newPage();

  // Capture console
  page.on("console", msg => consoleLogs.push({ type: msg.type(), text: msg.text(), url: page.url() }));
  page.on("pageerror", err => consoleLogs.push({ type: "pageerror", text: err.message, url: page.url() }));

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 1: LANDING PAGE ═══");
  // ══════════════════════════════════════════════════════════
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const loadTime = Date.now() - t0;
  assert(loadTime < 5000, "Landing loads < 5s", `took ${loadTime}ms`);

  // Typography
  const h1Font = await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily);
  assert(h1Font.toLowerCase().includes("syne"), "Syne font on h1", `got: ${h1Font}`);

  // Title
  const title = await page.title();
  assert(title.includes("SIMOGRANTS"), "Page title contains SIMOGRANTS", `got: ${title}`);

  // Favicon
  const favicon = await page.getAttribute('link[rel="icon"]', "href");
  assert(favicon && favicon.includes("favicon"), "Custom favicon (not vite.svg)", `got: ${favicon}`);

  // Hero content
  const bodyText = await page.textContent("body");
  assert(bodyText.includes("ASI1"), "ASI1 mentioned on landing", "ASI1 not found");
  assert(bodyText.includes("Base Sepolia") || bodyText.includes("Sepolia"), "Base Sepolia mentioned", "Sepolia not found");
  assert(bodyText.includes("pheromone") || bodyText.includes("Pheromone") || bodyText.includes("stigmergic") || bodyText.includes("Stigmergic"), "Stigmergic/pheromone concept present", "not found");

  // Nav links
  const navLinks = await page.locator("nav a").count();
  assert(navLinks >= 4, "Nav has 4+ links", `found ${navLinks}`);

  // Connect Wallet button
  const walletBtn = await page.locator('button:has-text("Connect")').count();
  assert(walletBtn >= 1, "Connect Wallet button visible", "not found");

  // Staggered animation classes
  const hasAnimations = await page.evaluate(() => !!document.querySelector(".animate-fade-up"));
  assert(hasAnimations, "Staggered fade-up animations present", "no .animate-fade-up found");

  // Noise texture
  const hasNoise = await page.evaluate(() => !!document.querySelector(".noise-bg"));
  assert(hasNoise, "Noise texture overlay present", "no .noise-bg found");

  // Dot grid
  const hasDotGrid = await page.evaluate(() => !!document.querySelector(".dot-grid"));
  assert(hasDotGrid, "Dot grid pattern present", "no .dot-grid found");

  // Footer
  const footerText = await page.locator("footer").textContent();
  assert(footerText.includes("ASI1"), "Footer mentions ASI1", "not found");
  assert(footerText.includes("Base Sepolia"), "Footer mentions Base Sepolia", "not found");

  // Responsive - no horizontal overflow
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  assert(scrollW <= clientW + 2, "No horizontal overflow", `scroll=${scrollW} client=${clientW}`);

  // SEO
  const metaDesc = await page.getAttribute('meta[name="description"]', "content");
  assert(metaDesc && metaDesc.includes("ASI1"), "Meta description mentions ASI1", `got: ${metaDesc}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 2: BROWSE ROUNDS ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const pageTitle = await page.locator("h1").first().textContent();
  assert(pageTitle.includes("Grant Rounds"), "Browse Rounds h1", `got: ${pageTitle}`);

  const cards = await page.locator('[data-testid="round-card"]').count();
  assert(cards >= 1, "At least 1 round card", `found ${cards}`);
  log(`    → ${cards} round cards found`);

  // Filter tabs
  const tabs = await page.locator("button").filter({ hasText: /All Rounds|Active|Accepting|Funded/ }).count();
  assert(tabs >= 3, "Filter tabs present (3+)", `found ${tabs}`);

  // Click first card
  if (cards > 0) {
    const href = await page.locator('[data-testid="round-card"]').first().getAttribute("href");
    await page.locator('[data-testid="round-card"]').first().click();
    await page.waitForTimeout(2000);
    assert(page.url().includes("/rounds/"), "Card click navigates to round detail", `url: ${page.url()}`);
  }

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 3: ROUND DETAIL ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/rounds/round-001`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const rdBody = await page.textContent("body");
  assert(rdBody.length > 100, "Round detail has content", `body length: ${rdBody.length}`);

  const headings = await page.locator("h1, h2, h3").count();
  assert(headings >= 3, "Round detail has 3+ headings", `found ${headings}`);

  // Stats grid
  const hasPool = rdBody.includes("Matching Pool") || rdBody.includes("matching");
  assert(hasPool, "Matching Pool stat visible", "not found");

  const hasDeadline = rdBody.includes("Deadline") || rdBody.includes("deadline");
  assert(hasDeadline, "Deadline stat visible", "not found");

  // Tabs
  const tabBtns = await page.locator("button").filter({ hasText: /applications|details/i }).count();
  assert(tabBtns >= 2, "Applications/Details tabs", `found ${tabBtns}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 4: ROUND RESULTS ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/rounds/round-001/results`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const rrBody = await page.textContent("body");
  assert(rrBody.includes("Result") || rrBody.includes("result") || rrBody.includes("Rank"), "Results page has content", "no results content");
  assert(rrBody.includes("Allocation") || rrBody.includes("allocation") || rrBody.includes("QF"), "Allocation data visible", "not found");

  // Summary cards
  const summaryCards = await page.locator('[class*="rounded"]').filter({ hasText: /Total Pool|Projects Funded|Average Score|On-Chain/ }).count();
  assert(summaryCards >= 3, "3+ summary cards", `found ${summaryCards}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 5: CREATE ROUND ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/create-round`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const crBody = await page.textContent("body");
  assert(crBody.includes("Create Grant Round") || crBody.includes("Create Round"), "Create Round heading", "not found");

  const inputs = await page.locator("input, textarea, select").count();
  assert(inputs >= 5, "Form has 5+ inputs", `found ${inputs}`);

  // Chain dropdown - only Base Sepolia
  const chainOptions = await page.locator("select#chain option").allTextContents();
  log(`    → Chain options: ${JSON.stringify(chainOptions)}`);
  assert(!chainOptions.some(o => o === "Base" && !o.includes("Sepolia")), "No mainnet option in chain dropdown", `options: ${chainOptions}`);
  assert(chainOptions.some(o => o.includes("Sepolia")), "Base Sepolia option exists", `options: ${chainOptions}`);

  // Wallet prompt
  const hasWalletPrompt = crBody.includes("Connect your wallet") || crBody.includes("connect your wallet");
  assert(hasWalletPrompt, "Wallet connection prompt shown (unauthenticated)", "not found");

  // Submit button
  const submitBtn = await page.locator('button[type="submit"]').count();
  assert(submitBtn >= 1, "Submit button present", "not found");

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 6: APPLY TO ROUND ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/rounds/round-002/apply`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const apBody = await page.textContent("body");
  assert(apBody.includes("Apply") || apBody.includes("apply") || apBody.includes("Application") || apBody.includes("Closed"), "Apply page loaded", "no apply content");

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 7: DASHBOARD ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const dbBody = await page.textContent("body");
  assert(
    dbBody.includes("Dashboard") || dbBody.includes("dashboard") ||
    dbBody.includes("Connect Your Wallet") || dbBody.includes("Welcome"),
    "Dashboard page loaded", "no dashboard content"
  );
  assert(dbBody.includes("Connect") || dbBody.includes("Welcome"), "Shows wallet prompt or welcome", "neither found");

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 8: API ENDPOINTS ═══");
  // ══════════════════════════════════════════════════════════

  // Health
  let resp = await page.request.get(`${API}/health`);
  assert(resp.status() === 200, "API /health returns 200", `got ${resp.status()}`);
  let json = await resp.json();
  assert(json.status === "ok", "Health status is 'ok'", `got: ${json.status}`);

  // Rounds
  resp = await page.request.get(`${API}/rounds`);
  assert(resp.status() === 200, "API /rounds returns 200", `got ${resp.status()}`);
  json = await resp.json();
  assert(json.rounds && json.rounds.length >= 1, "Rounds array has data", `length: ${json.rounds?.length}`);
  log(`    → ${json.rounds.length} rounds from API`);

  // Stats
  resp = await page.request.get(`${API}/stats`);
  assert(resp.status() === 200, "API /stats returns 200", `got ${resp.status()}`);

  // Auth nonce (POST)
  resp = await page.request.post(`${API}/auth/nonce`, {
    data: { address: "0x0000000000000000000000000000000000000001" },
    headers: { "Content-Type": "application/json" },
  });
  assert(resp.status() === 200, "API /auth/nonce POST returns 200", `got ${resp.status()}`);
  json = await resp.json();
  assert(json.nonce && json.message, "Nonce response has nonce + message", `keys: ${Object.keys(json)}`);
  assert(json.message.includes("simogrants.com"), "SIWE message references simogrants.com", "not found");

  // Auth error cases
  resp = await page.request.get(`${API}/auth/me`);
  assert(resp.status() === 401, "GET /auth/me without token returns 401", `got ${resp.status()}`);

  resp = await page.request.post(`${API}/rounds`, { data: {}, headers: { "Content-Type": "application/json" } });
  assert(resp.status() === 401, "POST /rounds without auth returns 401", `got ${resp.status()}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 9: RESPONSIVE DESIGN (MOBILE) ═══");
  // ══════════════════════════════════════════════════════════
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.goto(BASE, { waitUntil: "networkidle" });
  await mobilePage.waitForTimeout(1500);

  const mScrollW = await mobilePage.evaluate(() => document.documentElement.scrollWidth);
  const mClientW = await mobilePage.evaluate(() => document.documentElement.clientWidth);
  assert(mScrollW <= mClientW + 2, "Mobile: no horizontal overflow", `scroll=${mScrollW} client=${mClientW}`);

  const mFontSize = await mobilePage.evaluate(() => getComputedStyle(document.body).fontSize);
  assert(parseInt(mFontSize) >= 14, "Mobile: font size >= 14px", `got ${mFontSize}`);

  // Mobile nav hamburger
  const hamburger = await mobilePage.locator('button[aria-label="Toggle menu"]').count();
  assert(hamburger >= 1, "Mobile: hamburger menu present", "not found");

  await mobileCtx.close();

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 10: ACCESSIBILITY ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(BASE, { waitUntil: "networkidle" });

  const lang = await page.getAttribute("html", "lang");
  assert(lang === "en", "HTML lang='en'", `got: ${lang}`);

  const h1Count = await page.locator("h1").count();
  assert(h1Count >= 1, "At least 1 h1", `found ${h1Count}`);

  const imgsNoAlt = await page.evaluate(() =>
    Array.from(document.querySelectorAll("img")).filter(i => !i.alt || !i.alt.trim()).length
  );
  assert(imgsNoAlt === 0, "All images have alt text", `${imgsNoAlt} missing`);

  const emptyLinks = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a")).filter(a => !a.textContent?.trim() && !a.getAttribute("aria-label")).length
  );
  assert(emptyLinks === 0, "No empty links", `${emptyLinks} empty`);

  // ARIA on score bars
  await page.goto(`${BASE}/rounds/round-001/results`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const ariaMeters = await page.locator('[role="meter"]').count();
  assert(ariaMeters >= 1, "Score bars have role='meter'", `found ${ariaMeters}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 11: SPA NAVIGATION ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/rounds`, { waitUntil: "networkidle" });
  assert(page.url().includes("/rounds"), "At /rounds", page.url());

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  assert(page.url().includes("/dashboard"), "At /dashboard", page.url());

  await page.goto(`${BASE}/create-round`, { waitUntil: "networkidle" });
  assert(page.url().includes("/create-round"), "At /create-round", page.url());

  await page.goBack({ waitUntil: "networkidle" });
  assert(page.url().includes("/dashboard"), "Back navigates to /dashboard", page.url());

  await page.goForward({ waitUntil: "networkidle" });
  assert(page.url().includes("/create-round"), "Forward navigates to /create-round", page.url());

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 12: STATIC ASSETS & PERFORMANCE ═══");
  // ══════════════════════════════════════════════════════════
  const failed404s = [];
  page.on("response", resp => {
    if (resp.status() === 404 && !resp.url().includes("favicon.ico")) {
      failed404s.push(resp.url());
    }
  });

  const pages = ["/", "/rounds", "/dashboard", "/create-round", "/rounds/round-001", "/rounds/round-001/results"];
  for (const p of pages) {
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
  }
  assert(failed404s.length === 0, "Zero 404s across all pages", `${failed404s.length} 404s: ${failed404s.slice(0, 3).join(", ")}`);

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 13: PROJECT DETAIL ═══");
  // ══════════════════════════════════════════════════════════
  await page.goto(`${BASE}/projects/proj-001`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const projBody = await page.textContent("body");
  assert(projBody.includes("OpenZeppelin") || projBody.length > 200, "Project detail loads content", `body: ${projBody.length} chars`);

  // Allocation empty state or data
  const hasAllocation = projBody.includes("Allocation") || projBody.includes("allocation") || projBody.includes("hasn't received");
  assert(hasAllocation, "Allocation section visible (data or empty state)", "not found");

  // ══════════════════════════════════════════════════════════
  log("\n═══ SECTION 14: CONSOLE ERRORS ═══");
  // ══════════════════════════════════════════════════════════
  const errors = consoleLogs.filter(l => l.type === "error" || l.type === "pageerror");
  const warnings = consoleLogs.filter(l => l.type === "warning");
  const expectedWarnings = warnings.filter(w => w.text.includes("VITE_WC_PROJECT_ID") || w.text.includes("walletConnect"));
  const unexpectedErrors = errors.filter(e => !e.text.includes("MetaMask") && !e.text.includes("ethereum"));

  assert(unexpectedErrors.length === 0, "Zero unexpected console errors", `${unexpectedErrors.length} errors: ${unexpectedErrors.slice(0, 3).map(e => e.text.slice(0, 80)).join(" | ")}`);
  log(`    → ${errors.length} total errors, ${unexpectedErrors.length} unexpected`);
  log(`    → ${warnings.length} warnings (${expectedWarnings.length} expected WC warning)`);

  // ══════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════
  await browser.close();

  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  const total = results.length;

  log("\n══════════════════════════════════════════");
  log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  log("══════════════════════════════════════════");

  if (failed > 0) {
    log("\nFailed tests:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      log(`  ❌ #${r.num} ${r.name}: ${r.reason}`);
    });
  }

  log(`\nConsole summary: ${errors.length} errors, ${warnings.length} warnings`);
  process.exit(failed > 0 ? 1 : 0);
})();
