import { invoke, isDesktop } from "./tauri-api.js";
import { state } from "./state.js";
import { initRouter } from "./router.js";
import { confirm, toast, errorHTML } from "./ui.js";
import { applyTheme } from "./pages/settings.js";

async function start() {
  document.querySelector("#connection-badge").textContent = isDesktop
    ? "デスクトップ版・ローカルデータ"
    : "ブラウザープレビュー・PC操作不可";
  if (!isDesktop) {
    document.querySelector("#connection-badge").classList.add("preview-label");
    document.querySelector("#privilege").textContent =
      "デスクトップアプリが必要です";
  }
  try {
    if (isDesktop) {
      state.settings = await invoke("load_settings");
      applyTheme(state.settings.theme);
    }
  } catch (e) {
    state.errors.settings = e;
    toast(e.message, true);
  }
  initRouter();
  let focusRefreshPending = false;
  window.addEventListener("focus", async () => {
    if (!isDesktop || focusRefreshPending) return;
    focusRefreshPending = true;
    try {
      state.optimization = await invoke("scan_optimization");
      window.dispatchEvent(new Event("nextune:sample"));
    } catch (error) {
      if (error?.code !== "busy") toast(error.message, true);
    } finally {
      focusRefreshPending = false;
    }
  });
  matchMedia("(prefers-color-scheme:light)").addEventListener("change", () => {
    if (state.settings.theme === "system") applyTheme("system");
  });
  if (!isDesktop) return;
  // Only local, read-only queries run at startup. Ping is always started by the user.
  const initial = Promise.allSettled([
    invoke("get_system_info").then((v) => {
      state.info = v;
      document.querySelector("#privilege").textContent =
        v.administrator == null
          ? "権限を取得できません"
          : v.administrator
            ? "管理者"
            : "標準ユーザー";
    }),
    invoke("get_network_info").then((v) => (state.network = v)),
    invoke("scan_optimization").then((v) => (state.optimization = v)),
  ]).then((results) => {
    for (const r of results)
      if (r.status === "rejected") toast(r.reason.message, true);
    window.dispatchEvent(new Event("nextune:sample"));
  });
  sample();
  sampleSensors();
  if (!state.settings.welcomeComplete && !state.errors.settings) {
    const accepted = await confirm(
      "NexTuneへようこそ",
      '<div class="brand-mark welcome-mark"><img src="assets/app-icon.png" alt="NexTuneアイコン"></div><p>NexTuneは、ゲームに向けたPCの状態確認と準備をお手伝いします。</p><p>許可なくWindowsの重要な設定を変更することはありません。</p><p>データはこのPC内に保持します。ネットワークテストは開始したときだけ実行します。</p>',
      "はじめる",
    );
    if (accepted) {
      try {
        await initial;
        const settings = { ...state.settings, welcomeComplete: true };
        await invoke("save_settings", { settings });
        state.settings = settings;
        toast(
          "初回スキャンが完了しました。ダッシュボードで準備状態をご確認ください。",
        );
      } catch (e) {
        toast(e.message, true);
      }
    }
  }
}
async function sample() {
  if (document.hidden) {
    setTimeout(sample, 1000);
    return;
  }
  try {
    state.snapshot = await invoke("get_performance_snapshot");
    state.lastSample = Date.now();
    state.samples.pushTimed(state.snapshot);
    state.errors.monitor = null;
    document.querySelector("#sample-status").textContent =
      `更新時刻： ${new Date().toLocaleTimeString("ja-JP")}`;
  } catch (e) {
    state.snapshot = null;
    state.samples.pushTimed(null);
    if (!state.errors.monitor) toast(e.message, true);
    state.errors.monitor = e;
    document.querySelector("#sample-status").textContent =
      "監視データを取得できません";
  }
  window.dispatchEvent(new Event("nextune:sample"));
  setTimeout(sample, 1000);
}
start().catch((e) => {
  document.querySelector("#main").innerHTML = errorHTML(e);
});

async function sampleSensors() {
  if (!document.hidden) {
    try {
      state.sensors = await invoke("get_hardware_sensors");
    } catch (e) {
      state.sensors = { error: e.message };
    }
    window.dispatchEvent(new Event("nextune:sample"));
  }
  setTimeout(sampleSensors, 5000);
}
