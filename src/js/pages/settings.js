import { state } from "../state.js";
import { invoke } from "../tauri-api.js";
import { heading, panel, button, action, toast } from "../ui.js";
const general = [
  [
    "autoStart",
    "Windows起動時にNexTuneを起動",
    "このユーザーのサインイン時に起動します。exeを移動する場合は設定し直してください。",
  ],
  ["startMinimized", "最小化して起動", "次回の起動時から適用します。"],
  [
    "minimizeToTray",
    "トレイに最小化",
    "最小化・閉じる操作でトレイに収納します。トレイのメニューから開く／終了できます。",
  ],
];
const toggles = [
  [
    "closeBackgroundApps",
    "バックグラウンドアプリを終了",
    "ゲームブーストで選択したアプリに通常終了を要求します。",
  ],
  [
    "cleanTemporaryFiles",
    "一時ファイルを削除",
    "ゲームブーストからクリーナーへ案内します。ダッシュボードの1クリック整理は単独で使えます。",
  ],
  [
    "changePowerPlan",
    "電源プランを変更",
    "既存の高パフォーマンスプランを提案します。",
  ],
  [
    "enableGameMode",
    "ゲームモードの案内",
    "Windowsのゲームモード設定を直接開けます。",
  ],
];
const toggleRows = (rows) =>
  rows
    .map(
      ([id, title, description]) =>
        `<label class="row"><span><strong>${title}</strong><p>${description}</p></span><input type="checkbox" id="${id}"></label>`,
    )
    .join("");
export function render() {
  return (
    heading(
      "設定",
      "設定はこのPC内に保存されます。",
      button("設定を保存", "save-settings", true),
    ) +
    `<div class="stack settings-panel">${panel("一般", toggleRows(general))}${panel("表示", '<label class="row"><span>テーマ</span><select id="theme"><option value="dark">ダーク</option><option value="light">ライト</option><option value="system">システムに合わせる</option></select></label>')}${panel("ゲームブースト", toggleRows(toggles))}${panel("除外設定", '<label class="field">除外する実行ファイル名（1行に1つ）<textarea id="exclusions" spellcheck="false" aria-label="除外する実行ファイル名"></textarea></label><p class="notice section-space">ゲームブーストとアプリ管理に適用します。アプリ管理では主要なシステム画面とNexTuneを除外し、ウィンドウを持つアプリの通常終了だけを要求します。</p>')}</div>`
  );
}
export function applyTheme(theme) {
  document.documentElement.dataset.theme =
    theme === "system"
      ? matchMedia("(prefers-color-scheme:light)").matches
        ? "light"
        : "dark"
      : theme;
}
export function mount(root) {
  root.querySelector("#theme").value = state.settings.theme;
  [...general, ...toggles].forEach(
    ([id]) => (root.querySelector(`#${id}`).checked = state.settings[id]),
  );
  root.querySelector("#exclusions").value =
    state.settings.exclusions.join("\n");
  root.querySelector("#save-settings").onclick = () =>
    action(root.querySelector("#save-settings"), async () => {
      const settings = {
        ...state.settings,
        theme: root.querySelector("#theme").value,
        exclusions: [
          ...new Set(
            root
              .querySelector("#exclusions")
              .value.split("\n")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ],
      };
      [...general, ...toggles].forEach(
        ([id]) => (settings[id] = root.querySelector(`#${id}`).checked),
      );
      await invoke("save_settings", { settings });
      state.settings = settings;
      state.optimization = null;
      applyTheme(settings.theme);
      toast("設定を保存しました。");
    });
}
