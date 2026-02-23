import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

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
  const joinAsGuest = process.env.JOIN_AS_GUEST === "true";
  const guestName = process.env.GUEST_NAME || "Guest Recorder";

  const storageStatePath = process.env.GOOGLE_STORAGE_STATE || path.join(".auth", "google.json");
  let useStorageState = false;
  if (!joinAsGuest) {
    try {
      await fs.access(storageStatePath);
      useStorageState = true;
    } catch {
      useStorageState = false;
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    storageState: useStorageState ? storageStatePath : undefined,
  });
  const page = await context.newPage();

  if (!useStorageState && !joinAsGuest) {
    if (!botEmail || !botPass) {
      throw new Error("Missing BOT_EMAIL/BOT_PASS and no GOOGLE_STORAGE_STATE found");
    }

    await page.goto("https://accounts.google.com/");
    await page.fill('input[type="email"]', botEmail);
    await page.click('button:has-text("Next")');
    await page.waitForTimeout(1000);
    await page.fill('input[type="password"]', botPass);
    await page.click('button:has-text("Next")');
  }

  await page.goto(meetUrl, { waitUntil: "domcontentloaded" });

  await page.waitForTimeout(4000);
  if (joinAsGuest) {
    const nameInput = page.locator('input[aria-label="Your name"], input[name="name"]');
    if (await nameInput.count()) {
      await nameInput.first().fill(guestName);
    }
  }
  await clickIfVisible(page, 'button:has-text("Turn off microphone")');
  await clickIfVisible(page, 'button:has-text("Turn off camera")');

  await clickIfVisible(page, 'button:has-text("Join now")');
  await clickIfVisible(page, 'button:has-text("Ask to join")');

  return { browser, page };
}