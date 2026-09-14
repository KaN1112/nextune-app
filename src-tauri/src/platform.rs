use crate::models::{AppError, AppResult};
use std::process::{Command, Output, Stdio};

pub fn command(program: &str) -> Command {
    // Absolute system paths avoid executing an executable planted in PATH / CWD.
    let root = crate::known_folders::windows().unwrap_or_else(|| "C:\\Windows".into());
    let mut cmd = Command::new(
        std::path::PathBuf::from(root)
            .join("System32")
            .join(program),
    );
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd
}
pub fn output(mut cmd: Command) -> AppResult<Output> {
    use std::{
        io::Read,
        thread,
        time::{Duration, Instant},
    };
    let mut child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let out_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        stdout.read_to_end(&mut bytes).map(|_| bytes)
    });
    let err_reader = thread::spawn(move || {
        let mut bytes = Vec::new();
        stderr.read_to_end(&mut bytes).map(|_| bytes)
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if started.elapsed() > Duration::from_secs(40) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AppError::new(
                "timeout",
                "Windowsの処理がタイムアウトしました。もう一度お試しください。",
            ));
        }
        thread::sleep(Duration::from_millis(50));
    };
    let result = Output {
        status,
        stdout: out_reader
            .join()
            .map_err(|_| AppError::new("read_failed", "Windowsからの応答を読み取れません。"))??,
        stderr: err_reader
            .join()
            .map_err(|_| AppError::new("read_failed", "Windowsからの応答を読み取れません。"))??,
    };
    if !result.status.success() {
        return Err(AppError::new(
            "os_operation_failed",
            "Windowsが処理を完了できませんでした。権限や対応状況をご確認ください。",
        ));
    }
    Ok(result)
}
pub fn powershell(script: &'static str, env: &[(&str, String)]) -> AppResult<serde_json::Value> {
    let mut cmd = command("WindowsPowerShell\\v1.0\\powershell.exe");
    cmd.args([
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        script,
    ]);
    for (key, value) in env {
        cmd.env(key, value);
    }
    let result = output(cmd)?;
    Ok(serde_json::from_slice(&result.stdout)?)
}
