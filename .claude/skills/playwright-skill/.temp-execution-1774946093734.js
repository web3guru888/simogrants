const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://simogrants.pages.dev");
  const title = await page.title();
  console.log("Title:", title);
  const h1 = await page.locator("h1").first().textContent();
  console.log("H1:", h1);
  await browser.close();
  console.log("Playwright skill working!");
})();
