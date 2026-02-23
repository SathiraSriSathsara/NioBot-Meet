import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { chromium } from "playwright";
import "dotenv/config";

function waitForEnter() {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Press Enter after you finish logging in... ", () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const storageStatePath = process.env.GOOGLE_STORAGE_STATE || path.join(".auth", "google.json");
  const storageDir = path.dirname(storageStatePath);
  await fs.mkdir(storageDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log("Opening Google login. Complete login and any MFA in the browser.");
  await page.goto("https://accounts.google.com/");
  await waitForEnter();

  await context.storageState({ path: storageStatePath });
  await browser.close();

  console.log(`Saved Google auth state to ${storageStatePath}`);
}
main().catch(error => {
  console.error(error);
  process.exit(1);
});
