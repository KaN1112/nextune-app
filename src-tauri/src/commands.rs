use crate::{
    cleaner, models::*, network, optimizer, performance::Monitor, processes, restore, settings,
    system,
};
use std::{
    path::PathBuf,
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::State;

pub struct AppState {
    pub root: PathBuf,
    pub monitor: Mutex<Monitor>,
    pub operations: Mutex<()>,
    pub cleanup: Mutex<Option<cleaner::Scan>>,
    pub optimization: Mutex<Option<(OptimizationScan, Instant)>>,
    pub ping: Mutex<()>,
    pub memory_last: Mutex<Option<Instant>>,
}
fn busy() -> AppError {
    AppError::new("busy", "別の処理を実行中です。しばらくお待ちください。")
}
#[tauri::command]
pub async fn get_system_info() -> AppResult<serde_json::Value> {
    blocking(system::info).await
}
#[tauri::command]
pub fn get_performance_snapshot(state: State<AppState>) -> AppResult<crate::performance::Snapshot> {
    Ok(state.monitor.lock().map_err(|_| busy())?.snapshot())
}
#[tauri::command]
pub async fn get_network_info() -> AppResult<serde_json::Value> {
    blocking(network::connection).await
}
#[tauri::command]
pub async fn run_ping_test(
    state: State<'_, AppState>,
    target: String,
) -> AppResult<serde_json::Value> {
    let _guard = state.ping.try_lock().map_err(|_| busy())?;
    // async command runs on the runtime, keeping the webview thread responsive.
    network::ping(target)
}
#[tauri::command]
pub async fn get_process_list(state: State<'_, AppState>) -> AppResult<Vec<ProcessCandidate>> {
    processes::candidates(&settings::load(&state.root)?.exclusions)
}
#[tauri::command]
pub async fn scan_cleaner(state: State<'_, AppState>) -> AppResult<cleaner::ScanResponse> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let scan = cleaner::scan()?;
    let response = scan.response.clone();
    *state.cleanup.lock().map_err(|_| busy())? = Some(scan);
    Ok(response)
}
#[tauri::command]
pub async fn run_cleaner(
    state: State<'_, AppState>,
    token: String,
    categories: Vec<String>,
) -> AppResult<cleaner::CleanupResult> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let mut slot = state.cleanup.lock().map_err(|_| busy())?;
    if slot.as_ref().is_none_or(|s| s.response.token != token) {
        return Err(AppError::new(
            "invalid_scan",
            "削除前に再スキャンしてください。",
        ));
    }
    let result = cleaner::run(slot.take().unwrap(), &categories);
    settings::log(
        &state.root,
        if result.is_ok() {
            "cleaner_completed"
        } else {
            "cleaner_error"
        },
    );
    result
}
#[tauri::command]
pub async fn scan_optimization(state: State<'_, AppState>) -> AppResult<OptimizationScan> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let scan = optimizer::scan(&settings::load(&state.root)?)?;
    *state.optimization.lock().map_err(|_| busy())? = Some((scan.clone(), Instant::now()));
    Ok(scan)
}
#[tauri::command]
pub async fn apply_optimization(
    state: State<'_, AppState>,
    selection: OptimizationSelection,
) -> AppResult<ActionResult> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let (scan, created) = state
        .optimization
        .lock()
        .map_err(|_| busy())?
        .take()
        .ok_or_else(|| AppError::new("invalid_scan", "最適化の前に再スキャンしてください。"))?;
    if scan.token != selection.token || created.elapsed() > Duration::from_secs(600) {
        return Err(AppError::new(
            "expired",
            "スキャン結果が失効しました。再スキャンしてください。",
        ));
    }
    let config = settings::load(&state.root)?;
    if selection.power_plan
        && (!config.change_power_plan
            || !scan.high_performance_available
            || scan.power_plan.as_deref() != Some(optimizer::BALANCED))
    {
        return Err(AppError::new(
            "invalid_selection",
            "電源プランを変更できません。",
        ));
    }
    let mut selected = Vec::new();
    for item in &selection.processes {
        let candidate = scan
            .processes
            .iter()
            .find(|p| p.pid == item.pid && p.start_ticks == item.start_ticks)
            .ok_or_else(|| {
                AppError::new(
                    "invalid_process",
                    "選択したプロセスは今回のスキャン結果にありません。",
                )
            })?;
        if !config.close_background_apps
            || config
                .exclusions
                .iter()
                .any(|e| e.eq_ignore_ascii_case(&candidate.name))
        {
            return Err(AppError::new(
                "excluded",
                "このプロセスは除外されているか、アプリの終了が無効です。",
            ));
        }
        if !selected
            .iter()
            .any(|p: &&ProcessCandidate| p.pid == candidate.pid)
        {
            selected.push(candidate);
        }
    }
    let mut result = ActionResult {
        session_id: None,
        results: Vec::new(),
    };
    if selection.power_plan {
        let current = optimizer::active_plan()?;
        if Some(&current) != scan.power_plan.as_ref() {
            return Err(AppError::new(
                "setting_changed",
                "スキャン後に電源プランが変更されました。再スキャンしてください。",
            ));
        }
        let mut session = restore::prepare(&state.root, current)?;
        result.session_id = Some(session.id.clone());
        match optimizer::set_plan(optimizer::HIGH) {
            Ok(()) => {
                session.status = "applied".into();
                result
                    .results
                    .push("電源プランを高パフォーマンスに変更しました。復元できます。".into());
            }
            Err(e) => {
                session.status = "pending".into();
                result.results.push(format!(
                    "電源プラン：{} 復元用の記録を保存しました。",
                    e.message
                ));
            }
        }
        restore::save(&state.root, &session)?;
    }
    for p in selected {
        match processes::close(p) {
            Ok(v) if v["requested"] == true => result.results.push(format!(
                "{}: 通常の終了を要求しました。アプリ側の未保存データの確認をご確認ください。",
                p.name
            )),
            Ok(_) => result.results.push(format!(
                "{}: 通常の終了を要求できませんでした。アプリは実行中のままです。",
                p.name
            )),
            Err(e) => result.results.push(format!("{}: {}", p.name, e.message)),
        }
    }
    settings::log(&state.root, "optimization_completed");
    Ok(result)
}
#[tauri::command]
pub fn get_restore_history(state: State<AppState>) -> AppResult<Vec<RestoreSession>> {
    restore::history(&state.root)
}
#[tauri::command]
pub async fn restore_session(state: State<'_, AppState>, id: String) -> AppResult<RestoreSession> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let result = restore::restore(&state.root, &id);
    settings::log(
        &state.root,
        if result.is_ok() {
            "restore_completed"
        } else {
            "restore_error"
        },
    );
    result
}
#[tauri::command]
pub fn load_settings(state: State<AppState>) -> AppResult<Settings> {
    settings::load(&state.root)
}
#[tauri::command]
pub fn save_settings(state: State<AppState>, settings: Settings) -> AppResult<()> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    crate::settings::validate(&settings)?;
    let old = crate::settings::load(&state.root)?;
    if old.auto_start != settings.auto_start { crate::desktop::set_autostart(settings.auto_start)?; }
    if let Err(error) = crate::settings::save(&state.root, &settings) {
        if old.auto_start != settings.auto_start { let _ = crate::desktop::set_autostart(old.auto_start); }
        return Err(error);
    }
    Ok(())
}
async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|_| AppError::new("task_failed", "バックグラウンド処理に失敗しました。"))?
}

#[tauri::command]
pub async fn list_applications(state: State<'_, AppState>) -> AppResult<Vec<ProcessCandidate>> {
    processes::applications(&settings::load(&state.root)?.exclusions)
}
#[tauri::command]
pub async fn close_application(
    state: State<'_, AppState>,
    selection: ProcessSelection,
) -> AppResult<serde_json::Value> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let apps = processes::applications(&settings::load(&state.root)?.exclusions)?;
    let app = apps
        .iter()
        .find(|p| p.pid == selection.pid && p.start_ticks == selection.start_ticks)
        .ok_or_else(|| {
            AppError::new(
                "app_changed",
                "アプリが終了したか、一覧が変わりました。更新してください。",
            )
        })?;
    let result = processes::close(app)?;
    settings::log(&state.root, "application_close_requested");
    Ok(result)
}
#[tauri::command]
pub async fn quick_cleanup(state: State<'_, AppState>) -> AppResult<cleaner::CleanupResult> {
    let _guard = state.operations.try_lock().map_err(|_| busy())?;
    let mut last = state.memory_last.lock().map_err(|_| busy())?;
    if last.is_some_and(|t| t.elapsed() < Duration::from_secs(60)) {
        return Err(AppError::new("cooldown", "前回の整理から60秒お待ちください。"));
    }
    let result = cleaner::quick_cleanup()?;
    *last = Some(Instant::now());
    settings::log(&state.root, "quick_cleanup_completed");
    Ok(result)
}
#[tauri::command]
pub async fn get_hardware_sensors() -> AppResult<serde_json::Value> {
    blocking(crate::hardware::read).await
}
#[tauri::command]
pub async fn open_windows_settings(page: String) -> AppResult<()> {
    let uri = match page.as_str() {
        "game" => "ms-settings:gaming-gamemode",
        "storage" => "ms-settings:storagesense",
        "power" => "ms-settings:powersleep",
        "release" => "https://github.com/KaN1112/nextune-app/releases",
        _ => return Err(AppError::new("invalid_page", "指定した設定画面は開けません。")),
    };
    crate::desktop::open_uri(uri)
}
#[tauri::command]
pub async fn check_updates() -> AppResult<serde_json::Value> {
    blocking(crate::desktop::check_updates).await
}
