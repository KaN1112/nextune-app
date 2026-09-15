import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const balanced = "381b4222-f694-41f0-9685-ff5bb260df2e",
    high = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
  window.calls = [];
  window.saved = {
    welcomeComplete: true,
    theme: "dark",
    closeBackgroundApps: true,
    cleanTemporaryFiles: false,
    changePowerPlan: true,
    enableGameMode: true,
    exclusions: ["Discord.exe"],
  };
  const session = {
    id: "11111111-1111-4111-8111-111111111111",
    createdAt: new Date().toISOString(),
    version: "1.0.0",
    status: "applied",
    changes: [{ kind: "powerPlan", before: balanced, after: high }],
  };
  window.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        window.calls.push({ command, args });
        switch (command) {
          case "quick_cleanup":
            if (window.deferMemory)
              await new Promise((r) => (window.releaseMemory = r));
            return { deleted: 1, skipped: 0, failed: 0, bytes: 10485760 };
          case "list_applications":
            return [
              {
                pid: 4321,
                name: "Example.exe",
                startTicks: "987",
                memory: 10485760,
              },
            ];
          case "close_application":
            return { requested: true };
          case "get_hardware_sensors":
            return {
              gpu: 42,
              vram: 1073741824,
              measuredAt: new Date().toISOString(),
            };
          case "check_updates":
            return { status: "available", latest: "v1.2.0", current: "1.1.0" };
          case "open_windows_settings":
            return null;
          case "load_settings":
            return window.saved;
          case "save_settings":
            window.saved = args.settings;
            return null;
          case "get_system_info":
            return {
              cpu: "Test CPU",
              gpu: ["Test GPU"],
              ramTotal: 16 * 1073741824,
              windows: "Windows fixture",
              architecture: "x86_64",
              logicalCores: 12,
              physicalCores: 6,
              administrator: false,
              diskTotal: 100,
              diskAvailable: 40,
            };
          case "get_performance_snapshot":
            return {
              cpu: 18,
              ramTotal: 16 * 1073741824,
              ramUsed: 7.2 * 1073741824,
              ramAvailable: 8.8 * 1073741824,
            };
          case "get_network_info":
            return {
              adapter: "Test adapter",
              connectionType: "Ethernet",
              ipv4: ["192.0.2.1"],
              dns: ["1.1.1.1"],
            };
          case "scan_optimization":
            return {
              token: "boost-token",
              powerPlan: balanced,
              highPerformanceAvailable: true,
              gameMode: true,
              processes: [
                {
                  pid: 1234,
                  name: "chrome.exe",
                  startTicks: "123456",
                  memory: 1234567,
                },
              ],
            };
          case "apply_optimization":
            return {
              sessionId: session.id,
              results: [
                "電源プランを高パフォーマンスに変更しました。復元できます。",
              ],
            };
          case "scan_cleaner":
            return {
              token: "clean-token",
              capped: false,
              categories: [
                {
                  id: "user",
                  name: "ユーザーの一時ファイル",
                  count: 2,
                  bytes: 1000,
                  status: "Ready",
                },
                {
                  id: "shader",
                  name: "DirectXシェーダーキャッシュ",
                  count: 1,
                  bytes: 500,
                  status: "Ready",
                },
              ],
            };
          case "run_cleaner":
            return { deleted: 2, skipped: 0, failed: 0, bytes: 1000 };
          case "run_ping_test":
            if (window.deferPing)
              await new Promise((resolve) => (window.releasePing = resolve));
            return {
              target: args.target,
              samples: [10, 20, null, 12],
              sent: 4,
              received: 3,
              average: 14,
              minimum: 10,
              maximum: 20,
              jitter: 10,
              packetLoss: 25,
              measuredAt: new Date().toISOString(),
            };
          case "get_restore_history":
            return [session];
          case "restore_session":
            session.status = "restored";
            return session;
          default:
            throw new Error(command);
        }
      },
    },
  };
});
await page.goto("http://127.0.0.1:4173");
await page.getByText("Test CPU", { exact: true }).waitFor();
assert.equal(
  await page.evaluate(() =>
    calls.some((c) =>
      ["run_ping_test", "apply_optimization", "run_cleaner"].includes(
        c.command,
      ),
    ),
  ),
  false,
  "startup must never mutate or ping",
);
await page.locator('nav a[href="#game-boost"]').click();
await page.locator("#select-power").check();
await page.locator("#apply-boost").click();
await page.locator("dialog[open]").waitFor();
await page.locator("#cancel-dialog").click();
assert.equal(
  await page.evaluate(() =>
    calls.some((c) => c.command === "apply_optimization"),
  ),
  false,
);
await page.locator("#apply-boost").click();
await page.locator("#accept-dialog").click();
await page.getByRole("heading", { name: "結果", exact: true }).waitFor();
assert.equal(await page.locator("#apply-boost").isDisabled(), true);
const applied = await page.evaluate(
  () => calls.find((c) => c.command === "apply_optimization").args.selection,
);
assert.deepEqual(applied, {
  token: "boost-token",
  powerPlan: true,
  processes: [],
});
console.log("PASS boost cancel / exact selection / one-use UI");
await page.locator('nav a[href="#cleaner"]').click();
await page.locator("#scan-cleaner").click();
await page.locator('[data-category="user"]').check();
await page.locator("#clean-files").click();
await page.locator("#cancel-dialog").click();
assert.equal(
  await page.evaluate(() => calls.some((c) => c.command === "run_cleaner")),
  false,
);
await page.locator("#clean-files").click();
await page.locator("#accept-dialog").click();
await page.getByText(/削除： 2/).waitFor();
assert.equal(await page.locator("#clean-files").isDisabled(), true);
assert.deepEqual(
  await page.evaluate(
    () => calls.find((c) => c.command === "run_cleaner").args,
  ),
  { token: "clean-token", categories: ["user"] },
);
console.log("PASS cleaner scan / cancel / selected categories / result");
await page.locator('nav a[href="#restore"]').click();
await page.locator("[data-session]").click();
await page.locator("#restore-selected").click();
await page.locator("#cancel-dialog").click();
assert.equal(
  await page.evaluate(() => calls.some((c) => c.command === "restore_session")),
  false,
);
await page.locator("#restore-selected").click();
await page.locator("#accept-dialog").click();
await page.getByText("復元済み", { exact: true }).waitFor();
console.log("PASS restore confirmation and completion");
await page.locator('nav a[href="#settings"]').click();
await page.locator("#theme").selectOption("light");
await page.locator("#exclusions").fill("Discord.exe\nSpotify.exe");
await page.locator("#save-settings").click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "light",
);
assert.deepEqual(await page.evaluate(() => saved.exclusions), [
  "Discord.exe",
  "Spotify.exe",
]);
for (const id of ["autoStart", "startMinimized", "minimizeToTray"]) {
  assert.equal(await page.locator(`#${id}`).isEnabled(), true);
  await page.locator(`#${id}`).check();
}
await page.locator("#save-settings").click();
await page.waitForFunction(
  () => saved.autoStart && saved.startMinimized && saved.minimizeToTray,
);
await page.locator("#check-updates").click();
await page.getByText(/新しいバージョン v1.2.0/).waitFor();
await page.locator("#open-release").click();
await page.waitForFunction(() =>
  calls.some(
    (c) => c.command === "open_windows_settings" && c.args.page === "release",
  ),
);
console.log("PASS startup/tray settings and update check");
await page.locator('nav a[href="#network"]').click();
await page.locator("#run-ping").click();
await page.getByText("25%", { exact: true }).waitFor();
console.log("PASS network metrics");
await page.evaluate(() => (window.deferPing = true));
await page.locator("#run-ping").click();
await page.waitForFunction(() => !!window.releasePing);
await page.locator('nav a[href="#performance"]').click();
await page.locator('nav a[href="#network"]').click();
assert.equal(await page.locator("#run-ping").isDisabled(), true);
await page.evaluate(() => window.releasePing());
await page.waitForFunction(() => !document.querySelector("#run-ping").disabled);
console.log("PASS navigation during pending network test");
await page.locator('nav a[href="#dashboard"]').click();
await page.screenshot({
  path: "work/screenshots/dashboard-fixture-light.png",
  fullPage: true,
});
await page.locator("#tidy-memory").click();
await page.getByText(/削除 1件 · 10.0 MB/).waitFor();
assert.equal(
  await page.evaluate(
    () => calls.filter((c) => c.command === "quick_cleanup").length,
  ),
  1,
);
await page.locator('nav a[href="#applications"]').click();
await page.getByText("Example.exe", { exact: true }).waitFor();
await page.locator("#app-search").fill("missing");
assert.equal(await page.locator("#apps-list button").count(), 0);
await page.locator("#app-search").fill("Example");
await page.locator("#apps-list button").click();
await page.locator("#cancel-dialog").click();
assert.equal(
  await page.evaluate(
    () => calls.filter((c) => c.command === "close_application").length,
  ),
  0,
);
await page.locator("#apps-list button").click();
await page.locator("#accept-dialog").click();
await page.waitForFunction(() =>
  calls.some((c) => c.command === "close_application"),
);
assert.deepEqual(
  await page.evaluate(
    () => calls.find((c) => c.command === "close_application").args,
  ),
  { selection: { pid: 4321, startTicks: "987" } },
);
await page.locator('nav a[href="#dashboard"]').click();
await page.evaluate(() => (window.deferMemory = true));
await page.locator("#tidy-memory").click();
await page.waitForFunction(() => !!window.releaseMemory);
await page.locator('nav a[href="#performance"]').click();
await page.locator('nav a[href="#dashboard"]').click();
assert.equal(await page.locator("#tidy-memory").isDisabled(), true);
await page.evaluate(() => window.releaseMemory());
await page.waitForFunction(
  () => !document.querySelector("#tidy-memory").disabled,
);
console.log(
  "PASS one-click memory, pending navigation, app search, cancel, and exact process identity",
);
await page.locator('nav a[href="#performance"]').click();
await page.waitForFunction(
  () => document.querySelector("#metric-GPU").textContent === "42%",
);
assert.equal(await page.locator("#metric-VRAM").textContent(), "1.0 GB");
await page.locator('nav a[href="#cleaner"]').click();
await page.locator("#open-storage").click();
await page.locator('nav a[href="#game-boost"]').click();
await page.locator("#scan-boost").click();
await page.locator("#open-game-settings").click();
await page.locator("#open-power-settings").click();
const opened = await page.evaluate(() =>
  calls
    .filter((c) => c.command === "open_windows_settings")
    .map((c) => c.args.page),
);
assert.ok(["storage", "game", "power"].every((p) => opened.includes(p)));
assert.equal(
  (await page.locator(".brand small").count())
    ? await page.locator(".brand small").textContent()
    : "Gaming PC Utility",
  "Gaming PC Utility",
);
console.log("PASS GPU/VRAM and Windows settings routes");
assert.deepEqual(errors, []);
await browser.close();
