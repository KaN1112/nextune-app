export const isDesktop = !!window.__TAURI__?.core;
export async function invoke(command, args = {}) {
  if (!isDesktop)
    throw {
      code: "desktop_required",
      message:
        "デスクトップアプリが必要です。ブラウザープレビューではPC情報の取得や設定変更はできません。",
    };
  try {
    return await window.__TAURI__.core.invoke(command, args);
  } catch (error) {
    throw typeof error === "object" && error
      ? error
      : { code: "unknown", message: String(error) };
  }
}
