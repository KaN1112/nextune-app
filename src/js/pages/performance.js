import { state } from "../state.js";
import { heading, panel, definition, bytes, number } from "../ui.js";
import { drawChart } from "../charts.js";
export function render() {
  return (
    heading("パフォーマンス", "システムの動作をリアルタイムで確認できます。") +
    panel(
      "リアルタイム測定",
      `<div class="performance-metrics">${["CPU", "GPU", "RAM", "VRAM", "ディスク", "ネットワーク"].map((name) => `<div><div class="metric-label">${name}</div><div class="metric-value" id="metric-${name}">—</div><div class="metric-detail">${["CPU", "RAM"].includes(name) ? "リアルタイム・1秒間隔" : "取得できません"}</div></div>`).join("")}</div>`,
      '<span class="badge">読み取り専用</span>',
    ) +
    `<div class="section-space">${panel("システムの稼働状況", '<canvas class="chart" id="activity-chart" role="img" aria-label="過去60秒のCPU・メモリ使用率"></canvas><div class="chart-axis"><span>60秒前</span><span>0–100% · 現在</span></div>', '<div class="chart-legend"><span>CPU</span><span class="ram">RAM</span></div>')}</div><div class="section-space">${panel("システム詳細", '<div id="system-details"></div>')}</div>`
  );
}
export function mount() {
  update();
}
export function update() {
  const root = document.querySelector("#main");
  if (!root.querySelector("#activity-chart")) return;
  const s = { ...state.snapshot, ...state.sensors };
  root.querySelector("#metric-GPU").textContent = number(s.gpu, "%");
  root.querySelector("#metric-GPU").nextElementSibling.textContent =
    s.gpu == null
      ? "WDDM対応カウンターから取得待ち"
      : "全GPU中の最繁忙エンジン・約5秒間隔";
  root.querySelector("#metric-VRAM").textContent = bytes(s.vram);
  root.querySelector("#metric-VRAM").nextElementSibling.textContent =
    s.vram == null ? "専用GPUメモリの取得待ち" : "全GPUの専用メモリ使用量合計";
  root.querySelector("#metric-CPU").textContent = number(s?.cpu, "%");
  root.querySelector("#metric-RAM").textContent = s?.ramTotal
    ? number((s.ramUsed / s.ramTotal) * 100, "%")
    : "—";
  for (const [name, key] of [
    ["ディスク", "disk"],
    ["ネットワーク", "network"],
  ]) {
    const el = root.querySelector(`#metric-${name}`);
    el.textContent = s?.[key] == null ? "—" : `${bytes(s[key])}/s`;
    el.nextElementSibling.textContent =
      s?.[key] == null
        ? "取得できません"
        : name === "ディスク"
          ? "全ディスクの読み書き合計"
          : "全アダプターの送受信合計";
  }
  root.querySelector("#system-details").innerHTML = definition([
    ["論理コア数", state.info?.logicalCores],
    ["物理コア数", state.info?.physicalCores],
    ["利用可能メモリ", bytes(s?.ramAvailable)],
    ["メモリ総容量", bytes(s?.ramTotal)],
  ]);
  drawChart(root.querySelector("#activity-chart"), [
    { values: state.samples.values.map((s) => s?.cpu) },
    {
      values: state.samples.values.map((s) =>
        s?.ramTotal ? (s.ramUsed / s.ramTotal) * 100 : null,
      ),
    },
  ]);
}
