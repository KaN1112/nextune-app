import { invoke } from "../tauri-api.js";
import { heading, panel, button, escape, bytes, action, confirm, toast } from "../ui.js";

export function render() {
  return heading("アプリ管理", "タスクマネージャーを開かずに、起動中のアプリを終了できます。", button("一覧を更新", "refresh-apps")) +
    panel("起動中のアプリ", `<p>現在のWindowsセッションで画面を持つアプリを表示します。NexTuneとWindowsの動作に必要な主要プロセスだけを保護します。</p><p>通常終了で残ったアプリには、強制終了を選択できます。強制終了すると未保存データが失われる場合があります。</p><label for="app-search">アプリ名またはウィンドウ名で検索</label><input id="app-search" type="search" placeholder="例：chrome" autocomplete="off"><p id="apps-status" role="status">一覧を取得中…</p><div id="apps-list"></div>`);
}

export async function mount(root, active) {
  let apps = [];
  const refresh = async () => {
    apps = await invoke("list_applications");
    if (active()) draw();
  };
  const force = async (app, element) => {
    if (!(await confirm(`${app.name}を強制終了しますか？`, `<p><strong>未保存の内容は失われます。</strong></p><p>${escape(app.title || app.name)} を直ちに終了します。</p>`, "強制終了"))) return;
    await action(element, async () => {
      const result = await invoke("force_close_application", { selection: { pid: app.pid, startTicks: app.startTicks } });
      toast(result.closed ? "アプリを強制終了しました。" : "強制終了を確認できませんでした。", !result.closed);
      await refresh();
    });
  };
  const close = async (app, element) => {
    if (!(await confirm(`${app.name}を閉じますか？`, "<p>すべてのウィンドウへ通常の終了を要求します。保存確認が表示された場合はアプリ側で対応してください。</p>", "閉じる"))) return;
    const result = await action(element, () =>
      invoke("close_application", {
        selection: { pid: app.pid, startTicks: app.startTicks },
      }),
    );
    if (!result) return;
    if (result.closed) {
      toast("アプリを終了しました。");
      await refresh();
    } else {
      toast(result.requested ? "通常終了を要求しましたが、アプリが残っています。保存確認を確認するか、強制終了を選んでください。" : "通常終了を送信できませんでした。必要なら強制終了を選んでください。", true);
      element.textContent = "強制終了";
      element.classList.add("danger");
      element.onclick = () => force(app, element);
    }
  };
  const draw = () => {
    const query = root.querySelector("#app-search").value.toLowerCase();
    const shown = apps.filter((app) => `${app.name} ${app.title || ""}`.toLowerCase().includes(query));
    root.querySelector("#apps-status").textContent = `${shown.length}件・メモリ使用量の多い順`;
    const list = root.querySelector("#apps-list");
    list.innerHTML = shown.length ? shown.map((app) => `<div class="row"><div><strong>${escape(app.title || app.name)}</strong><small>${escape(app.name)} · PID ${app.pid} · ${bytes(app.memory)}</small></div><button class="button" data-pid="${app.pid}">閉じる</button></div>`).join("") : '<p class="notice">表示中のアプリがないか、検索条件に一致しません。</p>';
    list.querySelectorAll("button").forEach((element) => {
      element.onclick = () => {
        const app = apps.find((candidate) => candidate.pid === Number(element.dataset.pid));
        if (app) close(app, element);
      };
    });
  };
  root.querySelector("#app-search").oninput = draw;
  root.querySelector("#refresh-apps").onclick = () => action(root.querySelector("#refresh-apps"), refresh);
  await refresh();
}
