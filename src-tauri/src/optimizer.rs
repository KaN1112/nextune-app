use crate::{models::*, platform, processes};

pub const HIGH: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
pub const BALANCED: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
pub fn active_plan() -> AppResult<String> {
    let mut cmd = platform::command("powercfg.exe");
    cmd.arg("/getactivescheme");
    let out = platform::output(cmd)?;
    String::from_utf8_lossy(&out.stdout)
        .split_whitespace()
        .find_map(|s| uuid::Uuid::parse_str(s).ok())
        .map(|id| id.to_string())
        .ok_or_else(|| AppError::new("unsupported", "現在の電源プランを取得できません。"))
}
pub fn set_plan(id: &str) -> AppResult<()> {
    let id = uuid::Uuid::parse_str(id)
        .map_err(|_| AppError::new("invalid_plan", "電源プランの識別子が正しくありません。"))?;
    let mut cmd = platform::command("powercfg.exe");
    cmd.args(["/setactive", &id.to_string()]);
    platform::output(cmd)?;
    if active_plan()? != id.to_string() {
        return Err(AppError::new(
            "verification_failed",
            "指定した電源プランをWindowsが有効にできませんでした。",
        ));
    }
    Ok(())
}
pub fn game_mode() -> Option<bool> {
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\GameBar")
            .ok()?;
        return key
            .get_value::<u32, _>("AutoGameModeEnabled")
            .ok()
            .and_then(|v| match v {
                0 => Some(false),
                1 => Some(true),
                _ => None,
            });
    }
    #[cfg(not(windows))]
    None
}
pub fn scan(settings: &Settings) -> AppResult<OptimizationScan> {
    let mut cmd = platform::command("powercfg.exe");
    cmd.arg("/list");
    let available = platform::output(cmd)
        .map(|o| {
            String::from_utf8_lossy(&o.stdout)
                .to_lowercase()
                .contains(HIGH)
        })
        .unwrap_or(false);
    Ok(OptimizationScan {
        token: uuid::Uuid::new_v4().to_string(),
        power_plan: active_plan().ok(),
        high_performance_available: available,
        game_mode: game_mode(),
        processes: processes::candidates(&settings.exclusions)?,
    })
}
