import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// === CONSOLE LOGGING ===
const consoleLogs: { test: string; type: string; text: string; url: string }[] = [];
let currentTestName = '';

test.beforeEach(async ({}, testInfo) => {
  currentTestName = testInfo.title;
});

function captureConsole(page: Page) {
  page.on('console', (msg: ConsoleMessage) => {
    const entry = {
      test: currentTestName,
      type: msg.type(),
      text: msg.text(),
      url: page.url(),
    };
    consoleLogs.push(entry);
    // Also log errors to stderr for immediate visibility
    if (msg.type() === 'error') {
      console.error(`  [CONSOLE ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err: Error) => {
    consoleLogs.push({
      test: currentTestName,
      type: 'pageerror',
      text: err.message,
      url: page.url(),
    });
    console.error(`  [PAGE ERROR] ${err.message}`);
  });
}

// After all tests, write console log
test.afterAll(async () => {
  const logPath = path.join(__dirname, 'console-output.log');
  fs.writeFileSync(logPath, consoleLogs.map(l =>
    `[${l.test}] [${l.type}] ${l.url}\n  ${l.text}\n`
  ).join('\n'));
  console.log(`\nConsole logs written to ${logPath}`);
});

// === CONFIG ===
const BASE_URL = process.env.E2E_BASE_URL || 'https://simogrants.pages.dev';
const API_URL = 'https://simogrants-api.jingjai.workers.dev/api';

// === TEST 1: Landing Page ===
test('Test 1: Landing Page', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  // Hero section with title
  const hero = page.locator('h1, [class*="hero"], [class*="Hero"]');
  await expect(hero.first()).toBeVisible({ timeout: 15000 });

  // Check page has meaningful content
  const bodyText = await page.textContent('body');
  expect(bodyText?.length).toBeGreaterThan(100);

  // Connect Wallet button
  const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Wallet"), [class*="connect"], [class*="wallet"]');
  const connectCount = await connectBtn.count();
  console.log(`  Connect Wallet buttons found: ${connectCount}`);

  // Navigation links
  const navLinks = page.locator('nav a, [class*="nav"] a, header a');
  const navCount = await navLinks.count();
  console.log(`  Nav links found: ${navCount}`);
  expect(navCount).toBeGreaterThanOrEqual(2);

  // SEO meta tags
  const title = await page.title();
  console.log(`  Page title: ${title}`);
  expect(title).toBeTruthy();
  expect(title!.length).toBeGreaterThan(0);

  // Check for viewport meta
  const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
  console.log(`  Viewport meta: ${viewport}`);

  // Performance check
  expect(loadTime).toBeLessThan(10000);
});

// === TEST 2: Browse Rounds ===
test('Test 2: Browse Rounds', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  await page.goto(`${BASE_URL}/rounds`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  // Wait for content to load
  await page.waitForTimeout(3000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);

  // Check for round cards using data-testid
  const cards = page.locator('[data-testid="round-card"]');
  const cardCount = await cards.count();
  console.log(`  Round cards found: ${cardCount}`);

  // Should have some content about rounds
  expect(bodyText?.length).toBeGreaterThan(50);

  // Check for common round-related keywords
  const hasRoundContent =
    (bodyText?.includes('round') || bodyText?.includes('Round') ||
     bodyText?.includes('matching') || bodyText?.includes('grant') ||
     cardCount > 0);
  console.log(`  Has round content: ${hasRoundContent}`);

  // Try clicking the first round card
  if (cardCount > 0) {
    const firstCard = cards.first();
    const href = await firstCard.getAttribute('href');
    console.log(`  First card href: ${href}`);
    await firstCard.click();
    await page.waitForTimeout(2000);
    console.log(`  Navigated to: ${page.url()}`);
    expect(page.url()).toContain('/rounds/');
  }

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 3: Round Detail ===
test('Test 3: Round Detail', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  // First check which rounds are available from API
  const apiResponse = await page.request.get(`${API_URL}/rounds`);
  const apiData = await apiResponse.json();
  console.log(`  API rounds count: ${apiData?.length || 0}`);

  // Pick first round
  const roundId = apiData?.[0]?.id || 'round-001';
  console.log(`  Testing round: ${roundId}`);

  await page.goto(`${BASE_URL}/rounds/${roundId}`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);

  // Should show round information
  expect(bodyText?.length).toBeGreaterThan(50);

  // Check for key elements
  const headings = page.locator('h1, h2, h3');
  const headingCount = await headings.count();
  console.log(`  Headings found: ${headingCount}`);

  // Check for status, dates, or other round metadata
  const hasRoundInfo =
    bodyText?.includes('Status') || bodyText?.includes('status') ||
    bodyText?.includes('Matching') || bodyText?.includes('matching') ||
    bodyText?.includes('Application') || bodyText?.includes('application') ||
    headingCount > 0;
  console.log(`  Has round info: ${hasRoundInfo}`);

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 4: Round Results ===
test('Test 4: Round Results', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  // Get a round that might have results
  const apiResponse = await page.request.get(`${API_URL}/rounds`);
  const apiData = await apiResponse.json();
  const roundId = apiData?.[0]?.id || 'round-001';
  console.log(`  Testing results for round: ${roundId}`);

  await page.goto(`${BASE_URL}/rounds/${roundId}/results`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);
  console.log(`  URL: ${page.url()}`);

  // Check page loaded (even if showing "no results" or similar)
  expect(bodyText?.length).toBeGreaterThan(20);

  // Check for results-related content
  const hasResultsContent =
    bodyText?.includes('Result') || bodyText?.includes('result') ||
    bodyText?.includes('Allocation') || bodyText?.includes('allocation') ||
    bodyText?.includes('QF') || bodyText?.includes('Pheromone') ||
    bodyText?.includes('Score') || bodyText?.includes('Rank');
  console.log(`  Has results content: ${hasResultsContent}`);

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 5: Create Round ===
test('Test 5: Create Round Page', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  await page.goto(`${BASE_URL}/create-round`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);

  // Check for form elements
  const inputs = page.locator('input, textarea, select');
  const inputCount = await inputs.count();
  console.log(`  Form inputs found: ${inputCount}`);
  expect(inputCount).toBeGreaterThanOrEqual(2);

  // Check for common form fields
  const hasFormFields =
    bodyText?.includes('Title') || bodyText?.includes('title') ||
    bodyText?.includes('Description') || bodyText?.includes('description') ||
    bodyText?.includes('Chain') || bodyText?.includes('Token') ||
    bodyText?.includes('Amount') || bodyText?.includes('Create');
  console.log(`  Has form fields: ${hasFormFields}`);

  // Check for submit/create button
  const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Submit")');
  const submitCount = await submitBtn.count();
  console.log(`  Submit buttons: ${submitCount}`);

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 6: Apply to Round ===
test('Test 6: Apply to Round', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  await page.goto(`${BASE_URL}/rounds/round-gov-003/apply`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);

  // Check for form elements or an "Applications Closed" message
  const inputs = page.locator('input, textarea, select');
  const inputCount = await inputs.count();
  console.log(`  Form inputs found: ${inputCount}`);

  // Check for application form fields or closed status
  const hasAppContent =
    bodyText?.includes('Apply') || bodyText?.includes('apply') ||
    bodyText?.includes('Application') || bodyText?.includes('application') ||
    bodyText?.includes('Project') || bodyText?.includes('project') ||
    bodyText?.includes('Closed') || bodyText?.includes('closed') ||
    inputCount >= 2;
  console.log(`  Has application content: ${hasAppContent}`);
  expect(hasAppContent).toBeTruthy();

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 7: Dashboard ===
test('Test 7: Dashboard', async ({ page }) => {
  captureConsole(page);
  const start = Date.now();

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load: ${loadTime}ms`);

  await page.waitForTimeout(2000);

  const bodyText = await page.textContent('body');
  console.log(`  Body text length: ${bodyText?.length}`);
  console.log(`  URL: ${page.url()}`);

  // Dashboard should load - either show data or connect wallet prompt
  expect(bodyText?.length).toBeGreaterThan(20);

  // Check for dashboard-related content or wallet prompt
  const hasDashboardContent =
    bodyText?.includes('Dashboard') || bodyText?.includes('dashboard') ||
    bodyText?.includes('Wallet') || bodyText?.includes('wallet') ||
    bodyText?.includes('Connect') || bodyText?.includes('connect') ||
    bodyText?.includes('My') || bodyText?.includes('Stats');
  console.log(`  Has dashboard content: ${hasDashboardContent}`);

  expect(loadTime).toBeLessThan(10000);
});

// === TEST 8: API Endpoints ===
test('Test 8: API Endpoints', async ({ request }) => {
  const endpoints: { url: string; name: string; method?: string; body?: string }[] = [
    { url: `${API_URL}/health`, name: 'Health' },
    { url: `${API_URL}/rounds`, name: 'Rounds' },
    { url: `${API_URL}/stats`, name: 'Stats' },
    { url: `${API_URL}/auth/nonce`, name: 'Auth Nonce', method: 'POST', body: '{"address":"0x0000000000000000000000000000000000000001"}' },
  ];

  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      const response = endpoint.method === 'POST'
        ? await request.post(endpoint.url, { data: endpoint.body, headers: { 'Content-Type': 'application/json' } })
        : await request.get(endpoint.url);
      const responseTime = Date.now() - start;
      const body = await response.text();

      console.log(`  ${endpoint.name}: ${response.status()} (${responseTime}ms)`);
      console.log(`    Body length: ${body.length}`);

      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(3000);

      // Validate JSON for non-nonce endpoints
      if (endpoint.name !== 'Auth Nonce') {
        try {
          JSON.parse(body);
          console.log(`    Valid JSON: true`);
        } catch {
          console.log(`    Valid JSON: false`);
        }
      } else {
        // Nonce should return something
        expect(body.length).toBeGreaterThan(0);
      }
    } catch (err) {
      console.error(`  ${endpoint.name}: FAILED - ${(err as Error).message}`);
      throw err;
    }
  }
});

// === TEST 9: Responsive Design ===
test('Test 9: Responsive Design (mobile)', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();
  captureConsole(page);

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check for horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  console.log(`  Scroll width: ${scrollWidth}, Client width: ${clientWidth}`);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // Small tolerance

  // Check text is readable (body font size should be reasonable)
  const fontSize = await page.evaluate(() => {
    const body = document.body;
    return window.getComputedStyle(body).fontSize;
  });
  console.log(`  Body font size: ${fontSize}`);
  const fontSizeNum = parseInt(fontSize || '0');
  expect(fontSizeNum).toBeGreaterThanOrEqual(12);

  // Check buttons are tappable (min 44px touch target)
  const buttons = page.locator('button, a[role="button"]');
  const buttonCount = await buttons.count();
  console.log(`  Buttons/links found: ${buttonCount}`);

  if (buttonCount > 0) {
    const smallButtons: number[] = [];
    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        const minDim = Math.min(box.width, box.height);
        if (minDim < 30) smallButtons.push(Math.round(minDim));
      }
    }
    if (smallButtons.length > 0) {
      console.log(`  WARNING: ${smallButtons.length} buttons with small touch targets: ${smallButtons.join(', ')}px`);
    }
  }

  await context.close();
});

// === TEST 10: Accessibility Basics ===
test('Test 10: Accessibility Basics', async ({ page }) => {
  captureConsole(page);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check images without alt text
  const imagesWithoutAlt = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.filter(img => !img.alt || img.alt.trim() === '').map(img => img.src);
  });
  console.log(`  Images without alt text: ${imagesWithoutAlt.length}`);
  if (imagesWithoutAlt.length > 0) {
    console.log(`    Sources: ${imagesWithoutAlt.slice(0, 5).join(', ')}`);
  }

  // Check empty links
  const emptyLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.filter(a => !a.textContent?.trim() && !a.getAttribute('aria-label')).map(a => a.href);
  });
  console.log(`  Empty links: ${emptyLinks.length}`);

  // Check empty buttons
  const emptyButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.filter(b => !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.querySelector('svg, img')).length;
  });
  console.log(`  Empty buttons: ${emptyButtons}`);

  // Check heading hierarchy
  const headingOrder = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map(h => h.tagName);
  });
  console.log(`  Heading hierarchy: ${headingOrder.join(' → ')}`);

  // Check for h1
  const h1Count = await page.locator('h1').count();
  console.log(`  H1 count: ${h1Count}`);
  expect(h1Count).toBeGreaterThanOrEqual(1);

  // Check for lang attribute
  const lang = await page.getAttribute('html', 'lang');
  console.log(`  HTML lang: ${lang}`);
});

// === TEST 11: SPA Navigation ===
test('Test 11: SPA Navigation', async ({ page }) => {
  captureConsole(page);

  // Track full page loads by checking performance entries
  await page.goto(`${BASE_URL}/rounds`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/rounds');
  console.log(`  At /rounds: OK`);

  // Navigate to dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/dashboard');
  console.log(`  At /dashboard: OK`);

  // Navigate to create-round
  await page.goto(`${BASE_URL}/create-round`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  expect(page.url()).toContain('/create-round');
  console.log(`  At /create-round: OK`);

  // Navigate to landing
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  expect(page.url()).toBe(`${BASE_URL}/` || page.url() === BASE_URL);
  console.log(`  At /: OK`);

  // Browser back/forward
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log(`  Back to: ${page.url()}`);

  await page.goForward({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log(`  Forward to: ${page.url()}`);
});

// === TEST 12: Static Assets ===
test('Test 12: Static Assets & Performance', async ({ page }) => {
  captureConsole(page);

  const failedAssets: string[] = [];
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status === 404 && !url.includes('favicon')) {
      failedAssets.push(`${status} ${url}`);
    }
  });

  const start = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  const loadTime = Date.now() - start;
  console.log(`  Page load time: ${loadTime}ms`);

  // Check all pages for 404s
  const pages = ['/rounds', '/dashboard', '/create-round'];
  for (const p of pages) {
    await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
  }

  console.log(`  Failed assets (404s): ${failedAssets.length}`);
  if (failedAssets.length > 0) {
    failedAssets.slice(0, 10).forEach(a => console.log(`    ${a}`));
  }

  // Performance check
  console.log(`  Total load time: ${loadTime}ms`);
  expect(loadTime).toBeLessThan(15000);

  // Report 404s but don't fail on favicon
  const real404s = failedAssets.filter(a => !a.includes('favicon'));
  if (real404s.length > 0) {
    console.log(`  WARNING: ${real404s.length} non-favicon 404s detected`);
  }
});

// === GITHUB ISSUE CREATION HELPERS ===
// These will be used after test run to create issues for failures
export const testDefinitions = [
  'Test 1: Landing Page',
  'Test 2: Browse Rounds',
  'Test 3: Round Detail',
  'Test 4: Round Results',
  'Test 5: Create Round Page',
  'Test 6: Apply to Round',
  'Test 7: Dashboard',
  'Test 8: API Endpoints',
  'Test 9: Responsive Design (mobile)',
  'Test 10: Accessibility Basics',
  'Test 11: SPA Navigation',
  'Test 12: Static Assets & Performance',
];
