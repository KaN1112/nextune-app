import { state } from "../state.js";
import { invoke, isDesktop } from "../tauri-api.js";
import { heading, panel, button, escape, action, toast } from "../ui.js";
const toggles = [
  [
    "closeBackgroundApps",
    "バックグラウンドアプリを終了",
    "対象アプリを選び、通常の終了を要求できるようにします。",
  ],
  [
    "cleanTemporaryFiles",
    "一時ファイルを削除",
    "クリーナーでの確認を案内します。削除には別途確認が必要です。",
  ],
  [
    "changePowerPlan",
    "電源プランを変更",
    "既存のWindows標準「高パフォーマンス」プランを提案します。",
  ],
  [
    "enableGameMode",
    "ゲームモードの案内",
    "ゲームモードの明示設定がオフの場合に、変更方法を案内します。",
  ],
];
export function render() {
  return (
    heading(
      "設定",
      "設定はこのPC内に保存されます。",
      button("設定を保存", "save-settings", true),
    ) +
    `<div class="stack settings-panel">${panel("一般", `<div class="row"><div><strong>Windows起動時にNexTuneを起動</strong><p>このバージョンでは未対応です。</p></div><input aria-label="Windows起動時の自動起動は未対応" type="checkbox" disabled></div><div class="row"><div><strong>最小化して起動</strong><p>このバージョンでは未対応です。</p></div><input aria-label="最小化での起動は未対応" type="checkbox" disabled></div><div class="row"><div><strong>トレイに最小化</strong><p>v1.1で対応予定です。ウィンドウを閉じるとNexTuneは終了します。</p></div><input aria-label="トレイへの最小化は未対応" type="checkbox" disabled></div><div class="row"><div><strong>更新を確認</strong><p>配布サーバーが未設定のため、自動更新の確認は無効です。</p></div><span class="badge">未設定</span></div>`)}${panel("表示", `<label class="row"><span><strong>テーマ</strong><p>お好みの表示テーマを選んでください。</p></span><select id="theme"><option value="dark">ダーク</option><option value="light">ライト</option><option value="system">システムに合わせる</option></select></label>`)}${panel("ゲームブースト", toggles.map(([id, title, description]) => `<label class="row"><span><strong>${title}</strong><p>${description}</p></span><input type="checkbox" id="${id}"></label>`).join(""))}${panel("除外設定", '<label class="field">除外する実行ファイル名（1行に1つ）<textarea id="exclusions" spellcheck="false" aria-label="除外する実行ファイル名"></textarea></label><p class="notice section-space">ここで名前を追加・削除できます。この一覧に関係なく、ゲーム、ランチャー、アンチチート、セキュリティ、システムのプロセスは保護されます。対象候補は、ウィンドウがあるSpotify、Teams、Chrome、Adobe Creative Cloudに限定します。</p>')}</div>`
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
  toggles.forEach(
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
      toggles.forEach(
        ([id]) => (settings[id] = root.querySelector(`#${id}`).checked),
      );
      await invoke("save_settings", { settings });
      state.settings = settings;
      state.optimization = null;
      applyTheme(settings.theme);
      toast("設定を保存しました。");
    });
}
