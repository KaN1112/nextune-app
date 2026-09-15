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
fn interpret_game_mode(auto: Option<u32>, allowed: Option<u32>) -> bool {
    // Current Windows versions show Game Mode as on by default even before
    // either per-user override value has been written.
    auto.or(allowed).map_or(true, |value| value != 0)
}

pub fn game_mode() -> Option<bool> {
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        let key = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey("Software\\Microsoft\\GameBar");
        let (auto, allowed) = match key {
            Ok(key) => (
                key.get_value::<u32, _>("AutoGameModeEnabled").ok(),
                key.get_value::<u32, _>("AllowAutoGameMode").ok(),
            ),
            Err(_) => (None, None),
        };
        return Some(interpret_game_mode(auto, allowed));
    }
    #[cfg(not(windows))]
    None
}

#[cfg(test)]
mod tests {
    #[test]
    fn game_mode_uses_override_then_legacy_then_windows_default() {
        assert!(super::interpret_game_mode(Some(1), Some(0)));
        assert!(!super::interpret_game_mode(Some(0), Some(1)));
        assert!(!super::interpret_game_mode(None, Some(0)));
        assert!(super::interpret_game_mode(None, None));
    }
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
