use serde::{Deserialize, Serialize};

pub type AppResult<T> = Result<T, AppError>;
#[derive(Debug, Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
}
impl AppError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        if matches!(e.raw_os_error(), Some(32) | Some(33)) {
            return Self::new("file_in_use", "ファイルが使用中のため、スキップしました。");
        }
        match e.kind() {
            std::io::ErrorKind::PermissionDenied => Self::new(
                "access_denied",
                "アクセスが拒否されました。管理者権限が必要な場合があります。",
            ),
            _ => Self::new("io_error", "OSが処理を完了できませんでした。"),
        }
    }
}
impl From<serde_json::Error> for AppError {
    fn from(_: serde_json::Error) -> Self {
        Self::new(
            "invalid_data",
            "保存データまたはシステム情報を読み取れませんでした。変更は適用していません。",
        )
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct Settings {
    pub welcome_complete: bool,
    pub auto_start: bool,
    pub start_minimized: bool,
    pub minimize_to_tray: bool,
    pub theme: String,
    pub close_background_apps: bool,
    pub clean_temporary_files: bool,
    pub change_power_plan: bool,
    pub enable_game_mode: bool,
    pub exclusions: Vec<String>,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            welcome_complete: false,
            auto_start: false,
            start_minimized: false,
            minimize_to_tray: false,
            theme: "dark".into(),
            close_background_apps: false,
            clean_temporary_files: false,
            change_power_plan: true,
            enable_game_mode: true,
            exclusions: vec![
                "Discord.exe".into(),
                "obs64.exe".into(),
                "Spotify.exe".into(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreSession {
    pub id: String,
    pub created_at: String,
    pub version: String,
    pub changes: Vec<Change>,
    pub status: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub kind: String,
    pub before: String,
    pub after: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessCandidate {
    pub pid: u32,
    pub name: String,
    pub start_ticks: String,
    pub memory: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessSelection {
    pub pid: u32,
    pub start_ticks: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationScan {
    pub token: String,
    pub power_plan: Option<String>,
    pub high_performance_available: bool,
    pub game_mode: Option<bool>,
    pub processes: Vec<ProcessCandidate>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OptimizationSelection {
    pub token: String,
    pub power_plan: bool,
    pub processes: Vec<ProcessSelection>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub session_id: Option<String>,
    pub results: Vec<String>,
}
