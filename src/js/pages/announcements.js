import { invoke, isDesktop } from "../tauri-api.js";
import { heading, panel, button, escape, action } from "../ui.js";

let latestResult = null;
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
      "NexTuneの最新正式版と更新内容を確認できます。",
      button("最新情報を確認", "refresh-announcements", true),
    ) +
    panel(
      "運営からのお知らせ",
      '<div id="notice-result" aria-live="polite"><p>お知らせを読み込んでいます…</p></div>',
      '<span class="badge">公式</span>',
    ) +
    panel(
      "アップデート",
      '<div id="announcement-result" aria-live="polite"><p>GitHub Releasesの最新情報を確認しています…</p></div>',
      '<span class="badge">手動インストール</span>',
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
  target.innerHTML = notices.map((notice) => {
    const date = notice.publishedAt
      ? new Date(`${notice.publishedAt}T00:00:00`).toLocaleDateString("ja-JP")
      : "";
    return `<article class="announcement-item ${notice.important ? "important" : ""}">
      <div class="announcement-heading"><h3>${escape(notice.title)}</h3>${notice.important ? '<span class="badge">重要</span>' : ""}</div>
      ${date ? `<p class="muted">${escape(date)}</p>` : ""}
      <div class="announcement-body">${escape(notice.body)}</div>
    </article>`;
  }).join("");
}

function display(root, result) {
  const target = root.querySelector("#announcement-result");
  if (result.status === "unpublished") {
    target.innerHTML = '<div class="notice">公開中の正式リリースはまだありません。</div>';
    return;
  }
  const available = result.status === "available";
  const date = result.publishedAt
    ? new Date(result.publishedAt).toLocaleDateString("ja-JP")
    : "—";
  target.innerHTML = `
    <div class="notice ${available ? "warning" : ""}">
      <strong>${available ? `最新版 ${escape(result.latest)} をインストールしてください。` : "最新の正式版を使用しています。"}</strong>
      <p>使用中：${escape(result.current)} ／ 公開版：${escape(result.latest)} ／ 公開日：${escape(date)}</p>
    </div>
    ${result.name ? `<h3 class="section-space">${escape(result.name)}</h3>` : ""}
    ${result.notes ? `<div class="release-notes">${escape(result.notes)}</div>` : '<p class="muted section-space">更新内容は配布ページで確認してください。</p>'}
    <div class="notice section-space">
      <strong>インストール方法</strong>
      <ol><li>配布ページを開き、最新版の <code>setup.exe</code> をダウンロードします。</li><li>NexTuneを終了します。</li><li>ダウンロードしたインストーラーを実行します。設定と履歴は引き継がれます。</li></ol>
    </div>
    <button class="button primary" id="open-latest-release">最新版の配布ページを開く</button>`;
  target.querySelector("#open-latest-release").onclick = () =>
    action(target.querySelector("#open-latest-release"), () =>
      invoke("open_windows_settings", { page: "release" }),
    );
}

export async function mount(root, active) {
  const refresh = async () => {
    const target = root.querySelector("#announcement-result");
    const noticeTarget = root.querySelector("#notice-result");
    if (!isDesktop) {
      target.innerHTML =
        '<div class="notice">更新確認はデスクトップ版で利用できます。</div>';
      noticeTarget.innerHTML =
        '<div class="notice">お知らせの取得はデスクトップ版で利用できます。</div>';
      return;
    }
    target.innerHTML = "<p>GitHub Releasesの最新情報を確認しています…</p>";
    noticeTarget.innerHTML = "<p>運営からのお知らせを読み込んでいます…</p>";
    const [notices, update] = await Promise.allSettled([
      invokeWithTimeout("get_announcements"),
      invokeWithTimeout("check_updates"),
    ]);
    if (!active()) return;
    if (notices.status === "fulfilled") {
      noticeResult = notices.value;
      displayNotices(root, noticeResult);
    } else {
      noticeTarget.innerHTML = `<div class="notice warning"><strong>お知らせを取得できませんでした。</strong><p>${escape(notices.reason?.message || "インターネット接続を確認して、もう一度お試しください。")}</p></div>`;
    }
    if (update.status === "fulfilled") {
      latestResult = update.value;
      display(root, latestResult);
    } else {
      target.innerHTML = `<div class="notice warning"><strong>最新情報を取得できませんでした。</strong><p>${escape(update.reason?.message || "インターネット接続を確認して、もう一度お試しください。")}</p></div>`;
    }
  };
  root.querySelector("#refresh-announcements").onclick = () =>
    action(root.querySelector("#refresh-announcements"), refresh);
  if (noticeResult) displayNotices(root, noticeResult);
  if (latestResult) display(root, latestResult);
  if (!noticeResult || !latestResult) await refresh();
}
