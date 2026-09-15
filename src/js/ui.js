export const escape = (value) =>
  String(value ?? "取得できません").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const bytes = (value) =>
  value == null
    ? "—"
    : value >= 1073741824
      ? `${(value / 1073741824).toFixed(1)} GB`
      : value >= 1048576
        ? `${(value / 1048576).toFixed(1)} MB`
        : `${(value / 1024).toFixed(1)} KB`;
export const number = (value, suffix = "", digits = 0) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : `${value.toFixed(digits)}${suffix}`;
export const statusLabel = (value) =>
  ({ pending: "復元用の記録あり", applied: "適用済み", restored: "復元済み" })[
    value
  ] ?? "不明";
export const changeLabel = (value) =>
  value === "powerPlan" ? "電源プラン" : "未対応の設定";
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  "game-boost": "m13 2-9 12h7l-1 8 10-13h-7z",
  performance: "M3 12h4l3-8 4 16 3-8h4",
  network:
    "M3 8a15 15 0 0 1 18 0 M6 12a10 10 0 0 1 12 0 M9 16a5 5 0 0 1 6 0 M12 20h.01",
  cleaner: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  restore: "M3 4v6h6 M3 10a9 9 0 1 1 1 8 M12 7v5l3 2",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  arrow: "M5 12h14 m-5-5 5 5-5 5",
  check: "m5 12 4 4L19 6",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  cpu: "M6 6h12v12H6z M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cpu}"/></svg>`;
export const heading = (title, sub, action = "") =>
  `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${action}</div>`;
export const button = (text, id, primary = false) =>
  `<button class="button ${primary ? "primary" : ""}" id="${id}">${text}</button>`;
export const panel = (title, content, extra = "") =>
  `<section class="panel"><div class="panel-header"><h2>${title}</h2>${extra}</div>${content}</section>`;
export const definition = (entries) =>
  `<dl class="definition">${entries.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl>`;
export const empty = (title, detail, name = "shield") =>
  `<div class="empty">${icon(name)}<h3>${escape(title)}</h3>${escape(detail)}</div>`;
export const loading = (message) =>
  `<div class="loading"><span class="spinner"></span>${escape(message)}</div>`;
export const errorHTML = (error) =>
  `<div class="notice error" role="alert">${escape(error?.message || error || "予期しないエラーが発生しました。")}</div>`;
export function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = `toast ${error ? "error" : ""}`;
  el.textContent = message;
  document.querySelector("#toasts").append(el);
  setTimeout(() => el.remove(), error ? 10000 : 6000);
}
export function confirm(title, content, label = "確認") {
  const dialog = document.querySelector("#confirmation");
  if (dialog.open) return Promise.resolve(false);
  dialog.querySelector("#dialog-content").innerHTML =
    `<h2>${escape(title)}</h2>${content}<div class="actions"><button class="button" id="cancel-dialog">キャンセル</button><button class="button primary" id="accept-dialog">${escape(label)}</button></div>`;
  return new Promise((resolve) => {
    const done = (value) => {
      dialog.close();
      dialog.removeEventListener("cancel", cancel);
      resolve(value);
    };
    const cancel = (event) => {
      event.preventDefault();
      done(false);
    };
    dialog.addEventListener("cancel", cancel);
    dialog.querySelector("#cancel-dialog").onclick = () => done(false);
    dialog.querySelector("#accept-dialog").onclick = () => done(true);
    dialog.showModal();
    dialog.querySelector("#cancel-dialog").focus();
  });
}
export async function action(element, task) {
  if (element.disabled) return;
  const original = element.innerHTML;
  element.disabled = true;
  element.textContent = "処理中…";
  try {
    return await task();
  } catch (error) {
    toast(error.message || String(error), true);
  } finally {
    element.disabled = false;
    element.innerHTML = original;
    element.dispatchEvent(new Event("actioncomplete"));
  }
}
