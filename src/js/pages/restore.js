import { statusLabel, changeLabel } from "../ui.js";
import { state } from "../state.js";
import { invoke } from "../tauri-api.js";
import {
  heading,
  panel,
  button,
  empty,
  escape,
  definition,
  confirm,
  action,
  toast,
} from "../ui.js";
let selected = null;
export function render() {
  return (
    heading(
      "復元",
      "変更内容を確認し、元の設定に戻せます。",
      button("再読み込み", "refresh-history"),
    ) +
    `<div class="grid two">${panel("変更履歴", '<div id="history-list"></div>')}${panel("履歴の詳細", '<div id="session-details"></div>')}</div><div class="notice section-space">NexTuneによる変更だけを表示します。電源プランは復元できますが、削除した一時ファイルや終了したアプリは復元できません。中断した処理の記録も復元用に保持します。その後、別のアプリやユーザーが異なる電源プランを選んだ場合は、上書きせず復元を停止します。</div>`
  );
}
export async function mount(root, isCurrent) {
  const refresh = async () => {
    state.history = await invoke("get_restore_history");
    if (isCurrent()) show(root, isCurrent);
  };
  root.querySelector("#refresh-history").onclick = () =>
    action(root.querySelector("#refresh-history"), refresh);
  show(root, isCurrent);
  await refresh();
}
function show(root, isCurrent) {
  root.querySelector("#history-list").innerHTML = state.history.length
    ? state.history
        .map(
          (s) =>
            `<button class="history-item ${selected === s.id ? "selected" : ""}" data-session="${escape(s.id)}"><strong>電源プランの変更</strong><small>${escape(new Date(s.createdAt).toLocaleString("ja-JP"))} · ${escape(statusLabel(s.status))}</small></button>`,
        )
        .join("")
    : empty(
        "変更履歴はありません",
        "電源プランを変更すると、復元履歴がここに表示されます。",
        "restore",
      );
  root.querySelectorAll("[data-session]").forEach(
    (el) =>
      (el.onclick = () => {
        selected = el.dataset.session;
        show(root, isCurrent);
      }),
  );
  const session = state.history.find((s) => s.id === selected);
  root.querySelector("#session-details").innerHTML = session
    ? definition([
        ["作成日時", new Date(session.createdAt).toLocaleString("ja-JP")],
        ["状態", statusLabel(session.status)],
        ["バージョン", session.version],
      ]) +
      `<div class="section-space">${session.changes.map((c) => `<div class="notice"><strong>${escape(changeLabel(c.kind))}</strong><p>変更前： <code>${escape(c.before)}</code></p><p>変更後： <code>${escape(c.after)}</code></p></div>`).join("")}</div>${session.status === "restored" ? "" : `<div class="section-space">${button("設定を復元", "restore-selected", true)}</div>`}`
    : empty(
        "履歴を選択してください",
        "復元前に、変更前と変更後の値をご確認ください。",
      );
  const btn = root.querySelector("#restore-selected");
  if (btn)
    btn.onclick = () =>
      action(btn, async () => {
        if (
          !(await confirm(
            "設定を復元しますか？",
            `<p>次の設定を元の値に戻します。</p><ul>${session.changes.map((c) => `<li>${escape(changeLabel(c.kind))} → <code>${escape(c.before)}</code></li>`).join("")}</ul>`,
            "設定を復元",
          ))
        )
          return;
        await invoke("restore_session", { id: session.id });
        state.optimization = null;
        state.history = await invoke("get_restore_history");
        if (isCurrent()) show(root, isCurrent);
        toast("設定を復元しました。");
      });
}
