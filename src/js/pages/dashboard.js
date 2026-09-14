import { memoryCard, mountMemory } from "../memory.js";
import { state, currentScore } from "../state.js";
import {
  heading,
  panel,
  icon,
  definition,
  bytes,
  number,
  escape,
} from "../ui.js";
import { drawChart } from "../charts.js";
export function render() {
  return (
    heading(
      "ダッシュボード",
      "ゲーム前に、PCの状態をひと目で確認。",
      '<span class="badge">システムの概要</span>',
    ) +
    memoryCard() + `
<div class="grid dashboard-top">
${panel("ゲーム準備スコア", `<div class="score-body"><div class="score-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="fill" id="score-arc" cx="60" cy="60" r="52"/></svg><div class="score-number"><span id="score-value">—</span><small>/ 100</small></div></div><div><span id="score-label" class="badge">未確定</span><p class="score-caption">ゲームの準備状態<br>FPS性能の評価ではありません</p></div></div><details class="score-breakdown"><summary id="score-coverage">評価の内訳を見る</summary><div id="score-details"></div></details>`)}
${panel("システムの状態", `<div class="status-grid"><div><div class="metric-label">CPU</div><div class="metric-value" id="cpu-value">—</div><div class="metric-detail">CPU使用率</div><div class="meter"><span id="cpu-meter"></span></div></div><div><div class="metric-label">GPU</div><div class="metric-value">—</div><div class="metric-detail">取得できません</div><div class="meter"></div></div><div><div class="metric-label">RAM</div><div class="metric-value" id="ram-value">—</div><div class="metric-detail" id="ram-detail">データを取得中</div><div class="meter"><span id="ram-meter"></span></div></div><div><div class="metric-label">PING</div><div class="metric-value" id="ping-value">—</div><div class="metric-detail">前回の手動テスト</div><div class="meter"></div></div></div>`, `<span class="badge good"><span class="status-dot"></span>1秒ごとに更新</span>`)}
<section class="panel boost-banner span-all"><div class="boost-copy"><span class="boost-icon">${icon("game-boost")}</span><div><h2>次のゲームに向けて、PCを準備。</h2><p>推奨項目を確認し、変更する内容を自分で選べます。</p><small id="boost-summary">スキャンして推奨項目を確認しましょう</small></div></div><a class="button primary" href="#game-boost">ゲームブーストを開く ${icon("arrow")}</a></section>
</div><div class="grid two section-space">${panel("PC情報", '<div id="pc-info"></div>', `<span class="hardware-icon">${icon("cpu")}</span>`)}${panel("ネットワークの状態", '<div id="network-info"></div>', `<a href="#network">接続を診断 →</a>`)}</div>
<div class="section-space">${panel("パフォーマンスの推移", '<canvas class="chart" id="preview-chart" aria-label="過去60秒のCPU・メモリ使用率" role="img"></canvas><div class="chart-axis"><span>60秒前</span><span>現在</span></div>', '<div class="chart-legend"><span>CPU</span><span class="ram">RAM</span></div>')}</div>`
  );
}
export function mount(root) {
  mountMemory(root);
  update();
}
export function update() {
  const root = document.querySelector("#main");
  if (!root.querySelector("#cpu-value")) return;
  const s = state.snapshot;
  const score = currentScore();
  root.querySelector("#cpu-value").textContent = number(s?.cpu, "%");
  root.querySelector("#ram-value").textContent = s?.ramTotal
    ? number((s.ramUsed / s.ramTotal) * 100, "%")
    : "—";
  root.querySelector("#ram-detail").textContent = s
    ? `${bytes(s.ramUsed)} / ${bytes(s.ramTotal)}`
    : "取得できません";
  root.querySelector("#ping-value").textContent = number(
    state.ping?.average,
    " ms",
  );
  root.querySelector("#cpu-meter").style.width = `${s?.cpu ?? 0}%`;
  root.querySelector("#ram-meter").style.width =
    `${s?.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : 0}%`;
  root.querySelector("#score-value").textContent = score.score ?? "—";
  root.querySelector("#score-label").textContent = score.label;
  root.querySelector("#score-arc").style.strokeDashoffset =
    327 * (1 - (score.score ?? 0) / 100);
  root.querySelector("#score-coverage").textContent =
    `${score.coverage}/6 項目を取得済み・評価の内訳`;
  root.querySelector("#score-details").innerHTML =
    score.points
      .map(
        (p) =>
          `<div class="row"><span>${p.name}</span><span>${p.value ?? "—"} / ${p.max}</span></div>`,
      )
      .join("") +
    "<p>ゲームブーストのスキャンとネットワークテストで評価項目を確認できます。ネットワークの評価は5分で失効します。</p>";
  const i = state.info;
  root.querySelector("#pc-info").innerHTML = definition([
    ["プロセッサー", i?.cpu],
    ["グラフィックス", i?.gpu?.join(", ")],
    ["メモリ", i ? bytes(i.ramTotal) : null],
    ["OS", i?.windows],
    ["アーキテクチャ", i?.architecture],
  ]);
  const n = state.network;
  root.querySelector("#network-info").innerHTML =
    `<div class="network-summary"><span class="hardware-icon">${icon("network")}</span><div><h3>${escape(n?.adapter || "アダプター情報なし")}</h3><small>${escape(n?.connectionType || "取得できません")}</small></div></div>` +
    definition([
      ["IPv4", n?.ipv4?.join(", ")],
      ["DNS", n?.dns?.join(", ")],
      ["パケット損失率", number(state.ping?.packetLoss, "%")],
      [
        "前回の測定",
        state.ping
          ? new Date(state.ping.measuredAt).toLocaleTimeString("ja-JP")
          : "未実行",
      ],
    ]);
  if (state.optimization)
    root.querySelector("#boost-summary").textContent =
      `${state.optimization.processes.length} 件のアプリ候補・実行前に内容をご確認ください`;
  drawChart(root.querySelector("#preview-chart"), [
    { values: state.samples.values.map((s) => s?.cpu) },
    {
      values: state.samples.values.map((s) =>
        s?.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : null,
      ),
    },
  ]);
}
