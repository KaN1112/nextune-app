import { state } from "../state.js";
import { invoke } from "../tauri-api.js";
import {
  heading,
  panel,
  button,
  empty,
  bytes,
  escape,
  confirm,
  action,
  toast,
} from "../ui.js";
export function render() {
  return (
    heading(
      "クリーナー",
      "内容を確認してから、選択した項目だけを削除します。",
      button("ファイルをスキャン", "scan-cleaner", true),
    ) +
    panel(
      "削除対象の概要",
      '<div id="cleanup-summary">既知の一時フォルダーをスキャンして、削除可能なファイルを確認します。</div>',
      '<span class="badge">スキャンだけでは削除しません</span>',
    ) +
    `<div class="section-space">${panel("スキャンしたカテゴリ", '<div id="categories"></div><div class="actions section-space"><button class="button primary" id="clean-files" disabled>選択したファイルを削除</button><span class="muted" id="selected-size"></span></div>')}</div><div class="notice warning section-space">削除したファイルは復元できません。表示したフォルダー直下にある、24時間以上前のファイルのうち、スキャン後に変更されていないものだけが対象です。サブフォルダー、リンク、個人フォルダー、ゲームのセーブ、ブラウザーのデータ、ダウンロードは対象外です。シェーダーキャッシュは再生成時に一時的なカクつきが起きる場合があります。</div><div class="section-space">${panel("削除結果の詳細", '<div id="cleanup-result">ファイルはまだ削除していません。</div>')}</div>`
  );
}
export function mount(root, isCurrent) {
  root.querySelector("#scan-cleaner").onclick = () =>
    action(root.querySelector("#scan-cleaner"), async () => {
      state.cleaner = await invoke("scan_cleaner");
      if (isCurrent()) show(root);
      toast("スキャンが完了しました。ファイルは変更していません。");
    });
  root.querySelector("#clean-files").onclick = () =>
    action(root.querySelector("#clean-files"), async () => {
      const ids = [...root.querySelectorAll("[data-category]:checked")].map(
        (el) => el.dataset.category,
      );
      const scan = state.cleaner;
      if (!scan || !ids.length) return;
      const chosen = scan.categories.filter((c) => ids.includes(c.id));
      if (
        !(await confirm(
          "選択したファイルを削除しますか？",
          `<p>対象ファイルを完全に削除します。この操作は元に戻せません。</p><ul>${chosen.map((c) => `<li>${escape(c.name)} · ${c.count}件 · ${bytes(c.bytes)}</li>`).join("")}</ul>`,
          "ファイルを削除",
        ))
      )
        return;
      try {
        const result = await invoke("run_cleaner", {
          token: scan.token,
          categories: ids,
        });
        if (isCurrent())
          root.querySelector("#cleanup-result").textContent =
            `削除： ${result.deleted} · スキップ： ${result.skipped} · 失敗： ${result.failed} · ${bytes(result.bytes)} を削除しました。`;
        toast(
          `削除処理が完了しました： ${bytes(result.bytes)} を削除しました。`,
        );
      } finally {
        state.cleaner = null;
        if (isCurrent()) show(root);
      }
    });
  show(root);
}
function show(root) {
  const scan = state.cleaner;
  root.querySelector("#categories").innerHTML = scan
    ? `<div class="table-wrap"><table><thead><tr><th>カテゴリ</th><th>ファイル数</th><th>容量</th><th>状態</th></tr></thead><tbody>${scan.categories.map((c) => `<tr><td><label class="check-row"><input type="checkbox" data-category="${escape(c.id)}" ${c.count ? "" : "disabled"}>${escape(c.name)}</label></td><td>${c.count}</td><td>${bytes(c.bytes)}</td><td>${escape(c.status)}</td></tr>`).join("")}</tbody></table></div>`
    : empty(
        "削除する内容は自分で選べます",
        "スキャンして、一時ファイルのカテゴリを確認しましょう。",
        "cleaner",
      );
  root.querySelector("#cleanup-summary").textContent = scan
    ? `${bytes(scan.categories.reduce((n, c) => n + c.bytes, 0))} が対象・ ${scan.categories.reduce((n, c) => n + c.count, 0)}件${scan.capped ? " · 安全上の上限（5,000件）に達しました" : ""} · スキャン結果は10分で失効します`
    : "既知の一時フォルダーをスキャンして、削除可能なファイルを確認します。";
  const sync = () => {
    const ids = [...root.querySelectorAll("[data-category]:checked")].map(
      (e) => e.dataset.category,
    );
    root.querySelector("#clean-files").disabled = !ids.length;
    root.querySelector("#selected-size").textContent = ids.length
      ? `${bytes(state.cleaner.categories.filter((c) => ids.includes(c.id)).reduce((n, c) => n + c.bytes, 0))} を選択中`
      : "";
  };
  root
    .querySelectorAll("[data-category]")
    .forEach((el) => (el.onchange = sync));
  root
    .querySelector("#clean-files")
    .addEventListener("actioncomplete", sync, { once: true });
  sync();
}
