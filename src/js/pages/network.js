import { state } from "../state.js";
import { invoke } from "../tauri-api.js";
import {
  heading,
  panel,
  definition,
  button,
  number,
  action,
  toast,
  escape,
} from "../ui.js";
import { drawChart } from "../charts.js";
let running = false;
export function render() {
  return (
    heading(
      "ネットワーク",
      "ネットワーク設定を変えずに、接続の状態を測定します。",
    ) +
    panel(
      "ネットワークの概要",
      `<div class="network-metrics">${[
        ["average", "平均Ping"],
        ["minimum", "最小Ping"],
        ["maximum", "最大Ping"],
        ["jitter", "ジッター"],
        ["packetLoss", "パケットロス"],
      ]
        .map(
          ([id, name]) =>
            `<div><div class="metric-label">${name}</div><div class="metric-value" id="net-${id}">—</div></div>`,
        )
        .join("")}</div>`,
    ) +
    `<div class="grid two section-space">${panel("測定先", `<div class="stack"><label class="field">測定先<select id="target"><option value="1.1.1.1">Cloudflare · 1.1.1.1</option><option value="8.8.8.8">Google · 8.8.8.8</option><option value="custom">IPアドレスを指定</option></select></label><label class="field" id="custom-field" hidden>IPアドレス<input id="custom-ip" placeholder="192.168.1.1" maxlength="45" autocomplete="off"></label><div class="actions">${button("Pingテストを実行", "run-ping", true)}<small>20回測定・各回のタイムアウトは1秒</small></div><p class="muted" id="test-progress" aria-live="polite"></p></div>`)}${panel("接続情報", '<div id="connection-details"></div>')}</div><div class="section-space">${panel("Pingの推移", '<canvas class="chart" id="ping-chart" role="img" aria-label="直近20回のPingの往復時間"></canvas><div class="chart-axis"><span>1回目</span><span id="ping-scale">20回目</span></div><p id="ping-meta" class="muted section-space"></p>')}</div><p class="notice section-space">選択したアドレスへのICMPテストです。実際のゲームサーバーへのPingとは限りません。ICMPが遮断されたり、優先度を下げられたりする場合があります。ジッターは連続して成功した測定値の差の絶対値を平均したものです。タイムアウトをまたぐ差は含めません。</p>`
  );
}
export async function mount(root, isCurrent) {
  root.querySelector("#target").onchange = (e) =>
    (root.querySelector("#custom-field").hidden = e.target.value !== "custom");
  const btn = root.querySelector("#run-ping");
  btn.disabled = running;
  btn.onclick = () =>
    action(btn, async () => {
      const selected = root.querySelector("#target").value;
      const target =
        selected === "custom"
          ? root.querySelector("#custom-ip").value.trim()
          : selected;
      if (!target) throw new Error("IPアドレスを入力してください。");
      running = true;
      root.querySelector("#test-progress").textContent =
        "20回測定しています…最大25秒ほどかかります。";
      try {
        state.ping = await invoke("run_ping_test", { target });
        toast("ネットワークテストが完了しました。");
      } finally {
        running = false;
        update();
      }
    });
  update();
  try {
    state.network = await invoke("get_network_info");
    if (isCurrent()) update();
  } catch (e) {
    if (isCurrent()) toast(e.message, true);
  }
}
export function update() {
  const root = document.querySelector("#main");
  if (!root.querySelector("#ping-chart")) return;
  root.querySelector("#run-ping").disabled = running;
  root.querySelector("#target").disabled = running;
  root.querySelector("#custom-ip").disabled = running;
  root.querySelector("#test-progress").textContent = running
    ? "20回測定しています…測定中も別の画面に移動できます。"
    : "";
  const p = state.ping;
  for (const id of ["average", "minimum", "maximum", "jitter", "packetLoss"])
    root.querySelector(`#net-${id}`).textContent = number(
      p?.[id],
      id === "packetLoss" ? "%" : " ms",
      id === "jitter" ? 1 : 0,
    );
  root.querySelector("#connection-details").innerHTML = definition([
    ["アダプター", state.network?.adapter],
    ["接続方式", state.network?.connectionType],
    ["IPv4", state.network?.ipv4?.join(", ")],
    ["DNS", state.network?.dns?.join(", ")],
  ]);
  const max =
    Math.max(20, ...(p?.samples || []).filter((v) => v != null)) * 1.2;
  drawChart(
    root.querySelector("#ping-chart"),
    [{ values: p?.samples || [] }],
    20,
    max,
  );
  root.querySelector("#ping-scale").textContent =
    `0–${Math.ceil(max)} ms · 20回目`;
  root.querySelector("#ping-meta").textContent = p
    ? `${p.received}/${p.sent}回応答・ ${p.target} · ${new Date(p.measuredAt).toLocaleString("ja-JP")}`
    : "まだ測定していません。テストを開始したときだけ通信します。";
}
