import { invoke } from "./tauri-api.js";
import { action, bytes } from "./ui.js";
let running = false;
let result = "最小化した対応アプリが対象です。アプリを終了せずに整理します。";
export const memoryCard = () => `<section class="panel section-space"><div class="panel-header"><h2>メモリ整理</h2><button class="button primary" id="tidy-memory">1クリックで整理</button></div><p>対応：Chrome・Edge・Firefox・Teams・Spotify・Creative Cloud（除外設定を優先）</p><p class="notice">一時的なメモリ整理です。再使用するとメモリは戻り、アプリの再表示が遅くなる場合があります。FPSの向上は保証しません。</p><p id="memory-result" role="status"></p><a href="#applications">不要なアプリを閉じて、メモリを空ける →</a></section>`;
export function mountMemory(root) {
 const button = root.querySelector("#tidy-memory");
 const output = root.querySelector("#memory-result");
 output.textContent = result;
 button.disabled = running;
 button.onclick = () => action(button, async () => {
  running = true;
  try {
   const r = await invoke("tidy_memory");
   result = r.processed ? `${r.processed}件を整理・ワーキングセット減少量 ${bytes(r.reduced)}（実行直後の合計）。スキップ ${r.skipped}件。` : `整理できる対象がありませんでした。対応アプリを最小化してください。スキップ ${r.skipped}件。`;
   output.textContent = result;
  } finally {
   running = false;
   const current = document.querySelector("#tidy-memory");
   if (current && current !== button) current.disabled = false;
   const currentOutput = document.querySelector("#memory-result");
   if (currentOutput) currentOutput.textContent = result;
  }
 });
}
