import { invoke } from "../tauri-api.js";
import { heading, panel, button, escape, bytes, action, confirm, toast } from "../ui.js";
export function render() {
 return heading("アプリ管理", "タスクマネージャーを開かずに、不要なアプリを閉じられます。", button("一覧を更新", "refresh-apps")) + panel("起動中のアプリ", `<p>このセッションでウィンドウを持つアプリを表示します。Windowsの主要なシステム画面・NexTune・除外設定のアプリは対象外です。</p><p>表示するメモリはウィンドウを持つプロセス単体の使用量です。ブラウザーなどの子プロセスは合算しません。</p><label for="app-search">アプリ名で検索</label><input id="app-search" type="search" placeholder="例：chrome" autocomplete="off"><p id="apps-status" role="status">一覧を取得中…</p><div id="apps-list"></div>`);
}
export async function mount(root, active) {
 let apps = [];
 const draw = () => {
  const query = root.querySelector("#app-search").value.toLowerCase();
  const shown = apps.filter(p => p.name.toLowerCase().includes(query));
  root.querySelector("#apps-status").textContent = `${shown.length}件・メモリ使用量の多い順`;
  const list = root.querySelector("#apps-list");
  list.innerHTML = shown.length ? shown.map(p => `<div class="row"><div><strong>${escape(p.name)}</strong><small> PID ${p.pid} · ${bytes(p.memory)}</small></div><button class="button" data-pid="${p.pid}">閉じる</button></div>`).join("") : '<p class="notice">対象のアプリはありません。除外設定や検索条件も確認してください。</p>';
  list.querySelectorAll("button").forEach(btn => btn.onclick = () => action(btn, async () => {
   const app = apps.find(p => p.pid === Number(btn.dataset.pid));
   if (!await confirm(`${app.name}を閉じますか？`, "<p>通常の終了を要求します。未保存の内容がある場合は、アプリ側の保存確認に対応してください。</p>", "閉じる")) return;
   const r = await invoke("close_application", {selection:{pid:app.pid,startTicks:app.startTicks}});
   toast(r.requested ? "終了を要求しました。保存確認やトレイへの移動でアプリが残る場合があります。" : "終了要求を受け付けませんでした。アプリ側で状態を確認してください。", !r.requested);
   if(active()) await refresh();
  }));
 };
 const refresh = async () => { apps = await invoke("list_applications"); if(active()) draw(); };
 root.querySelector("#app-search").oninput = draw;
 root.querySelector("#refresh-apps").onclick = () => action(root.querySelector("#refresh-apps"), refresh);
 await refresh();
}
