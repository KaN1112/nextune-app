import { icon, errorHTML } from "./ui.js";
import * as dashboard from "./pages/dashboard.js";
import * as boost from "./pages/game-boost.js";
import * as performance from "./pages/performance.js";
import * as network from "./pages/network.js";
import * as cleaner from "./pages/cleaner.js";
import * as restore from "./pages/restore.js";
import * as settings from "./pages/settings.js";
import * as applications from "./pages/applications.js";
import * as announcements from "./pages/announcements.js";
const routes = {
  dashboard: ["ダッシュボード", dashboard],
  "game-boost": ["ゲームブースト", boost],
  applications: ["アプリ管理", applications],
  performance: ["パフォーマンス", performance],
  network: ["ネットワーク", network],
  cleaner: ["クリーナー", cleaner],
  restore: ["復元", restore],
  announcements: ["お知らせ", announcements],
  settings: ["設定", settings],
};
let active = null,
  generation = 0;
export async function route() {
  const id =
    location.hash.slice(1) in routes ? location.hash.slice(1) : "dashboard";
  const token = ++generation;
  active?.unmount?.();
  active = routes[id][1];
  document.querySelectorAll(".nav-item").forEach((el) => {
    const selected = el.dataset.page === id;
    el.classList.toggle("active", selected);
    selected
      ? el.setAttribute("aria-current", "page")
      : el.removeAttribute("aria-current");
  });
  const main = document.querySelector("#main");
  main.innerHTML = active.render();
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  try {
    await active.mount?.(main, () => token === generation);
  } catch (error) {
    if (token === generation)
      main.insertAdjacentHTML("afterbegin", errorHTML(error));
  }
}
export function initRouter() {
  document.querySelector("#navigation").innerHTML = Object.entries(routes)
    .map(
      ([id, [name]]) =>
        `<a class="nav-item" data-page="${id}" href="#${id}">${icon(id)}<span>${name}</span></a>`,
    )
    .join("");
  window.addEventListener("hashchange", route);
  window.addEventListener("nextune:sample", () => active?.update?.());
  window.addEventListener("resize", () => active?.update?.());
  route();
}
