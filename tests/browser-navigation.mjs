import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173");
await page
  .getByRole("heading", { name: "ダッシュボード", exact: true })
  .waitFor();
await mkdir("work/screenshots", { recursive: true });
await page.screenshot({
  path: "work/screenshots/dashboard.png",
  fullPage: true,
});
for (const [route, title] of [
  ["dashboard", "ダッシュボード"],
  ["game-boost", "ゲームブースト"],
  ["applications", "アプリ管理"],
  ["performance", "パフォーマンス"],
  ["network", "ネットワーク"],
  ["cleaner", "クリーナー"],
  ["restore", "復元"],
  ["announcements", "お知らせ"],
  ["settings", "設定"],
]) {
  await page.locator(`nav a[href="#${route}"]`).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  for (const size of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `${title}: horizontal overflow at ${size.width}`,
    );
  }
  console.log(`PASS ${title}: navigation and layout`);
}
await page.locator('nav a[href="#cleaner"]').click();
await page.locator("#scan-cleaner").click();
await page
  .getByText(
    "デスクトップアプリが必要です。ブラウザープレビューではPC情報の取得や設定変更はできません。",
    { exact: true },
  )
  .first()
  .waitFor();
assert.equal(await page.locator("#clean-files").isDisabled(), true);
console.log("PASS browser preview rejects OS actions");
assert.deepEqual(errors, []);
await browser.close();
