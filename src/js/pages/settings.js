import { state } from "../state.js";
import { invoke, isDesktop } from "../tauri-api.js";
import { heading, panel, button, escape, action, toast } from "../ui.js";
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
    `<div class="stack settings-panel">${panel("一般", toggleRows(general))}${panel("更新", '<p>GitHub Releases：KaN1112/nextune-app</p><p>確認時にGitHubへ接続します。新しい版は配布ページから入手できます。</p><div class="actions"><button id="check-updates" class="button">更新を確認</button><button id="open-release" class="button">配布ページを開く</button></div><p id="update-result" role="status">未確認</p>')}${panel("表示", '<label class="row"><span>テーマ</span><select id="theme"><option value="dark">ダーク</option><option value="light">ライト</option><option value="system">システムに合わせる</option></select></label>')}${panel("ゲームブースト", toggleRows(toggles))}${panel("除外設定", '<label class="field">除外する実行ファイル名（1行に1つ）<textarea id="exclusions" spellcheck="false" aria-label="除外する実行ファイル名"></textarea></label><p class="notice section-space">ゲームブーストとアプリ管理に適用します。アプリ管理では主要なシステム画面とNexTuneを除外し、ウィンドウを持つアプリの通常終了だけを要求します。</p>')}</div>`
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
  root.querySelector("#check-updates").onclick = () =>
    action(root.querySelector("#check-updates"), async () => {
      const output = root.querySelector("#update-result");
      output.textContent = "GitHubの更新情報を確認中…";
      try {
        const r = await invoke("check_updates");
        output.textContent =
          r.status === "unpublished"
            ? "公開された正式リリースを取得できません。未公開・非公開リポジトリの場合もあります。"
            : r.status === "available"
              ? `新しいバージョン ${r.latest} があります。配布ページから入手してください。`
              : `使用中：${r.current} ／ 公開版：${r.latest}。新しい正式版はありません。`;
      } catch (e) {
        output.textContent = e.message;
        throw e;
      }
    });
  root.querySelector("#open-release").onclick = () =>
    action(root.querySelector("#open-release"), () =>
      invoke("open_windows_settings", { page: "release" }),
    );
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
