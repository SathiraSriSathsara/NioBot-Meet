import { chromium } from "playwright";

async function clickIfVisible(page, selector) {
  const locator = page.locator(selector);
  if (await locator.count()) {
    const visible = await locator.first().isVisible();
    if (visible) {
      await locator.first().click({ timeout: 5000 }).catch(() => {});
    }
  }
}

export async function joinMeet({ meetUrl, botEmail, botPass }) {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  await page.goto("https://accounts.google.com/");
  await page.fill('input[type="email"]', botEmail);
  await page.click('button:has-text("Next")');
  await page.waitForTimeout(1000);
  await page.fill('input[type="password"]', botPass);
  await page.click('button:has-text("Next")');

  await page.goto(meetUrl, { waitUntil: "domcontentloaded" });

  await page.waitForTimeout(4000);
  await clickIfVisible(page, 'button:has-text("Turn off microphone")');
  await clickIfVisible(page, 'button:has-text("Turn off camera")');

  await clickIfVisible(page, 'button:has-text("Join now")');
  await clickIfVisible(page, 'button:has-text("Ask to join")');

  return { browser, page };
}