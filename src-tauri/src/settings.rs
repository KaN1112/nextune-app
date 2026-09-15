use crate::models::{AppError, AppResult, Settings};
use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::Path,
};

pub fn atomic_json(path: &Path, value: &impl Serialize) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::new("invalid_path", "データの保存先が正しくありません。"))?;
    fs::create_dir_all(parent)?;
    let temporary = parent.join(format!("{}.tmp", uuid::Uuid::new_v4()));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    file.write_all(&serde_json::to_vec_pretty(value)?)?;
    file.sync_all()?;
    drop(file);
    // Windows MoveFileExW replaces atomically, preserving the previous file on failure.
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(old: *const u16, new: *const u16, flags: u32) -> i32;
        }
        let old: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
        let new: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        if unsafe { MoveFileExW(old.as_ptr(), new.as_ptr(), 0x1 | 0x8) } == 0 {
            let e = std::io::Error::last_os_error();
            let _ = fs::remove_file(&temporary);
            return Err(e.into());
        }
    }
    #[cfg(not(windows))]
    fs::rename(&temporary, path)?;
    Ok(())
}
pub fn load(root: &Path) -> AppResult<Settings> {
    let path = root.join("settings.json");
    if !path.exists() {
        return Ok(Settings::default());
    }
    let settings = serde_json::from_slice(&fs::read(path)?)?;
    validate(&settings)?;
    Ok(settings)
}
pub fn validate(settings: &Settings) -> AppResult<()> {
    if !["dark", "light", "system"].contains(&settings.theme.as_str())
        || settings.exclusions.len() > 100
        || settings
            .exclusions
            .iter()
            .any(|s| s.len() > 100 || s.is_empty() || s.contains(['/', '\\', ':', '\n', '\r']))
    {
        return Err(AppError::new(
            "invalid_settings",
            "テーマまたはプロセスの除外設定が正しくありません。",
        ));
    }
    Ok(())
}
pub fn save(root: &Path, settings: &Settings) -> AppResult<()> {
    validate(settings)?;
    atomic_json(&root.join("settings.json"), settings)
}

pub fn log(root: &Path, event: &str) {
    // Fixed event labels only: no usernames, paths, process details or IP addresses.
    let path = root.join("activity.log");
    if fs::metadata(&path)
        .map(|m| m.len() > 1_000_000)
        .unwrap_or(false)
    {
        let _ = fs::remove_file(&path);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{} {}", chrono::Utc::now().to_rfc3339(), event);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn settings_roundtrip_and_atomic_replace() {
        let root = std::env::current_dir()
            .unwrap()
            .join("target")
            .join("settings-fixtures")
            .join(uuid::Uuid::new_v4().to_string());
        let mut settings = Settings::default();
        save(&root, &settings).unwrap();
        settings.theme = "light".into();
        save(&root, &settings).unwrap();
        assert_eq!(load(&root).unwrap().theme, "light");
        fs::remove_file(root.join("settings.json")).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn older_settings_default_startup_features_to_off() {
        let old: Settings = serde_json::from_str(r#"{"theme":"dark","exclusions":[]}"#).unwrap();
        assert!(!old.auto_start && !old.start_minimized && !old.minimize_to_tray);
    }
    #[test]
    fn rejects_paths_in_process_exclusions() {
        let mut s = Settings::default();
        s.exclusions.push("C:\\Windows\\System32\\test.exe".into());
        assert!(validate(&s).is_err());
    }
}
