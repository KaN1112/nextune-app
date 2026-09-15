use crate::{models::{AppResult, AppError}, platform};
use tauri::Manager;

pub fn set_autostart(enabled: bool) -> AppResult<()> {
    use winreg::{enums::*, RegKey};
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Run")?;
    if enabled {
        let path = std::env::current_exe()?;
        let value = format!("\"{}\"", path.display());
        key.set_value("NexTune", &value)?;
    } else {
        match key.delete_value("NexTune") {
            Ok(()) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(e.into()),
        }
    }
    Ok(())
}
pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
    use tauri::{menu::{Menu, MenuItem}, tray::TrayIconBuilder};
    let show = MenuItem::with_id(app, "show", "NexTuneを開く", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut builder = TrayIconBuilder::with_id("nextune-tray").tooltip("NexTune").menu(&menu);
    if let Some(icon) = app.default_window_icon() { builder = builder.icon(icon.clone()); }
    builder.on_menu_event(|app, event| match event.id.as_ref() {
        "show" => if let Some(w) = app.get_webview_window("main") {
            let _ = w.show(); let _ = w.unminimize(); let _ = w.set_focus();
        },
        "quit" => app.exit(0),
        _ => (),
    }).build(app)?;
    if let Some(w) = app.get_webview_window("main") {
        let root = app.state::<crate::commands::AppState>().root.clone();
        let initial = crate::settings::load(&root).unwrap_or_default();
        if initial.start_minimized { w.minimize()?; }
        let target = w.clone();
        w.on_window_event(move |event| {
            let to_tray = crate::settings::load(&root).map(|s| s.minimize_to_tray).unwrap_or(false);
            if !to_tray { return; }
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => { api.prevent_close(); let _ = target.hide(); },
                tauri::WindowEvent::Resized(_) if target.is_minimized().unwrap_or(false) => { let _ = target.hide(); },
                _ => (),
            }
        });
        if initial.start_minimized && initial.minimize_to_tray { w.hide()?; }
    }
    Ok(())
}
pub fn open_uri(uri: &str) -> AppResult<()> {
    platform::powershell(r#"$ErrorActionPreference='Stop'; Start-Process -FilePath $env:NEXTUNE_URI; 'null'"#, &[("NEXTUNE_URI", uri.into())])?;
    Ok(())
}
fn version(value: &str) -> Option<(u64,u64,u64)> {
    let parts: Vec<_> = value.strip_prefix('v').unwrap_or(value).split('.').collect();
    if parts.len() != 3 { return None; }
    Some((parts[0].parse().ok()?,parts[1].parse().ok()?,parts[2].parse().ok()?))
}
pub fn check_updates() -> AppResult<serde_json::Value> {
    let response = platform::powershell(r#"
$ErrorActionPreference='Stop'
try {
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $r=Invoke-RestMethod -Uri 'https://api.github.com/repos/KaN1112/nextune-app/releases/latest' -Headers @{'User-Agent'='NexTune';'Accept'='application/vnd.github+json'} -TimeoutSec 15
 @{status='ok';tag=[string]$r.tag_name} | ConvertTo-Json -Compress
} catch {
 $code=0; if($_.Exception.Response){$code=[int]$_.Exception.Response.StatusCode}
 @{status='error';code=$code} | ConvertTo-Json -Compress
}
"#, &[])?;
    if response["status"] != "ok" {
        if response["code"] == 404 { return Ok(serde_json::json!({"status":"unpublished"})); }
        return Err(AppError::new("update_network", "更新情報を取得できませんでした。接続状態やGitHubのアクセス制限を確認してください。"));
    }
    let tag = response["tag"].as_str().unwrap_or("");
    let latest = version(tag).ok_or_else(|| AppError::new("update_version", "公開タグは v1.1.0 の形式にしてください。"))?;
    Ok(serde_json::json!({"status":if latest > version(env!("CARGO_PKG_VERSION")).unwrap() {"available"} else {"current"},"latest":tag,"current":env!("CARGO_PKG_VERSION")}))
}
#[cfg(test)]
mod tests {
    #[test]
    fn release_version_order_and_invalid_tags() {
        assert!(super::version("v1.10.0") > super::version("v1.9.0"));
        assert!(super::version("v1.2.3-beta").is_none());
        assert!(super::version("1.2").is_none());
    }
}
