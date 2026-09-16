import { invoke, isDesktop } from "../tauri-api.js";
import { heading, panel, button, escape, action } from "../ui.js";

let noticeResult = null;

function invokeWithTimeout(command) {
  return Promise.race([
    invoke(command),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("更新情報の確認がタイムアウトしました。しばらくしてから再度お試しください。")),
        20000,
      ),
    ),
  ]);
}

export function render() {
  return (
    heading(
      "お知らせ",
      "NexTune運営からの最新情報を確認できます。",
      button("最新情報を確認", "refresh-announcements", true),
    ) +
    panel(
      "運営からのお知らせ",
      '<div id="notice-result" aria-live="polite"><p>お知らせを読み込んでいます…</p></div>',
      '<span class="badge">公式</span>',
    )
  );
}

function displayNotices(root, result) {
  const target = root.querySelector("#notice-result");
  const notices = Array.isArray(result?.notices) ? result.notices : [];
  if (!notices.length) {
    target.innerHTML = '<p class="muted">現在、新しいお知らせはありません。</p>';
    return;
  }
  target.innerHTML = notices.map((notice, index) => {
    const date = notice.publishedAt
      ? new Date(`${notice.publishedAt}T00:00:00`).toLocaleDateString("ja-JP")
      : "";
    return `<article class="announcement-item ${notice.important ? "important" : ""}">
      <div class="announcement-heading"><h3>${escape(notice.title)}</h3>${notice.important ? '<span class="badge">重要</span>' : ""}</div>
      ${date ? `<p class="muted">${escape(date)}</p>` : ""}
      <div class="announcement-body">${escape(notice.body)}</div>
      ${notice.link ? `<button class="button primary announcement-link" data-notice-index="${index}">${escape(notice.linkLabel || "リンクを開く")}</button>` : ""}
    </article>`;
  }).join("");
  target.querySelectorAll(".announcement-link").forEach((element) => {
    element.onclick = () => {
      const notice = notices[Number(element.dataset.noticeIndex)];
      return action(element, () => invoke("open_announcement_link", { url: notice.link }));
    };
  });
}

export async function mount(root, active) {
  const refresh = async () => {
    const noticeTarget = root.querySelector("#notice-result");
    if (!isDesktop) {
      noticeTarget.innerHTML =
        '<div class="notice">お知らせの取得はデスクトップ版で利用できます。</div>';
      return;
    }
    noticeTarget.innerHTML = "<p>運営からのお知らせを読み込んでいます…</p>";
    const notices = await Promise.resolve(invokeWithTimeout("get_announcements"))
      .then((value) => ({ status: "fulfilled", value }))
      .catch((reason) => ({ status: "rejected", reason }));
    if (!active()) return;
    if (notices.status === "fulfilled") {
      noticeResult = notices.value;
      displayNotices(root, noticeResult);
    } else {
      noticeTarget.innerHTML = `<div class="notice warning"><strong>お知らせを取得できませんでした。</strong><p>${escape(notices.reason?.message || "インターネット接続を確認して、もう一度お試しください。")}</p></div>`;
    }
  };
  root.querySelector("#refresh-announcements").onclick = () =>
    action(root.querySelector("#refresh-announcements"), refresh);
  if (noticeResult) displayNotices(root, noticeResult);
  else await refresh();
}
