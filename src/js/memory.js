import { invoke } from "./tauri-api.js";
import { action, bytes } from "./ui.js";
let running = false;
let result = "ボタンを押すと、対象の確認と削除を続けて実行します。";
export const memoryCard = () =>
  `<section class="panel section-space quick-cleanup"><div class="panel-header"><h2>一時ファイルを整理</h2><button class="button primary" id="tidy-memory">1クリックで整理</button></div><p>ユーザーの一時フォルダー直下にある、24時間以上前のファイルを自動削除します。</p><p class="notice">使用中のファイルは残します。アプリは閉じません。ディスクの空き容量を増やす機能です。削除したファイルは復元できません。</p><p id="memory-result" role="status"></p><a href="#cleaner">その他の一時ファイルを確認する →</a></section>`;
export function mountMemory(root) {
  const button = root.querySelector("#tidy-memory");
  root.querySelector("#memory-result").textContent = result;
  button.disabled = running;
  button.onclick = () =>
    action(button, async () => {
      running = true;
      try {
        const r = await invoke("quick_cleanup");
        result = `削除 ${r.deleted}件 · ${bytes(r.bytes)} ／ スキップ ${r.skipped}件 ／ 失敗 ${r.failed}件`;
      } finally {
        running = false;
        const current = document.querySelector("#tidy-memory");
        if (current && current !== button) current.disabled = false;
        const output = document.querySelector("#memory-result");
        if (output) output.textContent = result;
      }
    });
}
