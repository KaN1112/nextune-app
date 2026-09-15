import { state } from "../state.js";
import { invoke } from "../tauri-api.js";
import {
  heading,
  panel,
  button,
  empty,
  escape,
  bytes,
  confirm,
  action,
  toast,
} from "../ui.js";
const BALANCED = "381b4222-f694-41f0-9685-ff5bb260df2e";
export function render() {
  return (
    heading(
      "ゲームブースト",
      "ゲームを始める前に、安全な範囲でPCを整えます。",
      button("スキャン・内容の確認", "scan-boost", true),
    ) +
    `<div class="workflow"><span>01 スキャン</span><span>02 推奨項目</span><span>03 確認</span><span>04 結果</span></div>` +
    panel(
      "最適化の概要",
      '<div id="optimization-summary">PCの設定を変更せずに、推奨項目を確認します。</div>',
      '<span class="badge">自動では変更しません</span>',
    ) +
    `<div class="section-space">${panel("最適化の項目", '<div id="optimization-items"></div>')}</div><div class="grid two section-space">${panel("検出したアプリ", '<div id="detected-apps"></div>')}${panel("安全性について", '<div class="notice">電源プランは変更前の値を保存し、あとで復元できます。アプリには通常の終了を要求するだけです。先に作業内容を保存してください。終了したアプリや削除したファイルは復元できません。</div><p class="muted section-space">セキュリティ機能、Windowsサービス、ドライバー、アンチチートは変更しません。</p>')}</div><div class="actions section-space"><button class="button primary" id="apply-boost" disabled>選択した最適化を実行</button><a class="button" href="#restore">復元履歴を見る</a></div><div class="actions section-space"><button class="button" id="open-power-settings">Windowsの電源設定を開く</button></div><div id="boost-result" class="section-space" aria-live="polite"></div>`
  );
}
export function mount(root, isCurrent) {
  root.onclick = (e) => {
    if (e.target.id === "open-power-settings")
      action(e.target, () =>
        invoke("open_windows_settings", { page: "power" }),
      );
    if (e.target.id === "open-game-settings")
      action(e.target, () => invoke("open_windows_settings", { page: "game" }));
  };
  root.querySelector("#scan-boost").onclick = () =>
    action(root.querySelector("#scan-boost"), async () => {
      state.optimization = await invoke("scan_optimization");
      if (isCurrent()) show(root);
      toast("スキャンが完了しました。設定は変更していません。");
    });
  root.querySelector("#apply-boost").onclick = () =>
    action(root.querySelector("#apply-boost"), async () => {
      const scan = state.optimization;
      if (!scan) return;
      const powerPlan = !!root.querySelector("#select-power")?.checked;
      const processes = [
        ...root.querySelectorAll("[data-process]:checked"),
      ].map((el) => ({
        pid: Number(el.dataset.process),
        startTicks: el.dataset.ticks,
      }));
      if (!powerPlan && !processes.length) return;
      const names = scan.processes.filter((p) =>
        processes.some((x) => x.pid === p.pid),
      );
      if (
        !(await confirm(
          "最適化を実行しますか？",
          `<p>NexTuneが実行する内容をご確認ください。</p><ul>${powerPlan ? "<li>バランス → 高パフォーマンス。元のプランは復元用に保存します。消費電力やファンの音が増える場合があります。</li>" : ""}${names.map((p) => `<li>通常の終了を要求： ${escape(p.name)} (PID ${p.pid}). 先に作業を保存してください。この操作は元に戻せません。</li>`).join("")}</ul>`,
          "選択した変更を適用",
        ))
      )
        return;
      try {
        const result = await invoke("apply_optimization", {
          selection: { token: scan.token, powerPlan, processes },
        });
        if (isCurrent())
          root.querySelector("#boost-result").innerHTML = panel(
            "結果",
            `<ul class="result-list">${result.results.map((r) => `<li>${escape(r)}</li>`).join("")}</ul>`,
          );
        toast("最適化の処理が完了しました。各項目の結果をご確認ください。");
      } finally {
        state.optimization = null;
        if (isCurrent()) show(root);
      }
    });
  show(root);
}
function show(root) {
  const scan = state.optimization;
  root.querySelector("#optimization-items").innerHTML = scan
    ? `
<label class="row check-row"><input id="select-power" type="checkbox" ${scan.powerPlan === BALANCED && scan.highPerformanceAvailable && state.settings.changePowerPlan ? "" : "disabled"}><span class="copy"><strong>電源プラン</strong><small>${scan.powerPlan === BALANCED ? "バランス" : escape(scan.powerPlan || "取得できません")} → ${scan.highPerformanceAvailable ? "高パフォーマンスを利用可能" : "このPCはWindowsの電源設定から変更してください"}${state.settings.changePowerPlan ? "" : " · 設定で無効になっています"}</small></span><span class="badge">復元可能</span></label>
<div class="row"><div><strong>ゲームモード</strong><p>${scan.gameMode == null ? "取得できません" : scan.gameMode ? "オン・変更不要" : "オフ"} · ${state.settings.enableGameMode ? "Windows設定から切り替えられます" : "設定で案内を無効にしています"}</p></div><button class="button" id="open-game-settings">Windows設定を開く</button></div>
<p class="notice">ゲームモードは、Windowsの「設定」→「ゲーム」→「ゲームモード」から変更してください。NexTuneはユーザーごとの明示的な設定値を読み取り、値がなければ不明と表示します。実際の動作はWindowsのバージョンやポリシーにも左右されます。</p>
<div class="row"><div><strong>一時ファイル</strong><p>${state.settings.cleanTemporaryFiles ? "確認対象として有効" : "任意"} · クリーナーでスキャンし、対象カテゴリを確認してください。</p></div><a class="button" href="#cleaner">クリーナーを開く →</a></div>`
    : empty(
        "まずはスキャンから",
        "推奨項目を確認してから、変更内容を選びましょう。",
        "game-boost",
      );
  root.querySelector("#detected-apps").innerHTML = scan
    ? scan.processes.length
      ? scan.processes
          .map(
            (p) =>
              `<label class="row check-row"><input type="checkbox" data-process="${p.pid}" data-ticks="${escape(p.startTicks)}" ${state.settings.closeBackgroundApps ? "" : "disabled"}><span class="copy"><strong>${escape(p.name)}</strong><small>PID ${p.pid} · ${bytes(p.memory)}</small></span></label>`,
          )
          .join("") +
        (state.settings.closeBackgroundApps
          ? ""
          : '<p class="notice section-space">アプリを選ぶには、設定で「バックグラウンドアプリを終了」を有効にしてください。</p>')
      : empty(
          "対象のアプリはありません",
          "ウィンドウがある一部の許可済みアプリだけを確認し、除外設定を適用します。",
        )
    : empty(
        "まだスキャンしていません",
        "システム、セキュリティ、ゲーム、ランチャーのプロセスは対象にしません。",
      );
  root.querySelector("#optimization-summary").textContent = scan
    ? `読み取り専用スキャン完了 · ${scan.processes.length} 件のアプリ候補・確認結果は10分で失効します`
    : "PCの設定を変更せずに、推奨項目を確認します。";
  const sync = () =>
    (root.querySelector("#apply-boost").disabled = !root.querySelector(
      "#select-power:checked, [data-process]:checked",
    ));
  root.querySelectorAll("input").forEach((el) => (el.onchange = sync));
  root
    .querySelector("#apply-boost")
    .addEventListener("actioncomplete", sync, { once: true });
  sync();
}
