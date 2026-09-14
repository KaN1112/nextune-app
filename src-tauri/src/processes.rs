use crate::{
    models::{AppResult, ProcessCandidate},
    platform,
};
use serde_json::Value;

pub fn candidates(exclusions: &[String]) -> AppResult<Vec<ProcessCandidate>> {
    // Strict allowlist: settings can exclude more apps, never add executable targets.
    let values = platform::powershell(
        r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $items=@(Get-Process | Where-Object {$_.ProcessName -in @('Spotify','Teams','ms-teams','chrome','Creative Cloud') -and $_.MainWindowHandle -ne 0} | ForEach-Object {try {@{pid=$_.Id;name=$_.ProcessName+'.exe';startTicks=[string]$_.StartTime.ToUniversalTime().Ticks;memory=$_.WorkingSet64}}catch{}}); ConvertTo-Json -InputObject $items -Compress"#,
        &[],
    )?;
    let mut result = Vec::new();
    for p in values.as_array().into_iter().flatten() {
        let name = p["name"].as_str().unwrap_or("");
        if exclusions.iter().any(|e| e.eq_ignore_ascii_case(name)) {
            continue;
        }
        if let (Some(pid), Some(ticks), Some(memory)) = (
            p["pid"].as_u64(),
            p["startTicks"].as_str(),
            p["memory"].as_u64(),
        ) {
            result.push(ProcessCandidate {
                pid: pid as u32,
                name: name.into(),
                start_ticks: ticks.into(),
                memory,
            });
        }
    }
    Ok(result)
}
pub fn close(p: &ProcessCandidate) -> AppResult<Value> {
    // Hold a process handle before checking identity; only request normal window close.
    // No force-kill, no child termination. Unsaved-work prompts remain under app control.
    platform::powershell(
        r#"$ErrorActionPreference='Stop'; try { $p=[Diagnostics.Process]::GetProcessById([int]$env:NEXTUNE_PID); $handle=$p.Handle; if(([string]$p.StartTime.ToUniversalTime().Ticks -ne $env:NEXTUNE_TICKS) -or ($p.ProcessName+'.exe' -ne $env:NEXTUNE_NAME)){throw 'Identity changed'}; @{requested=$p.CloseMainWindow()} | ConvertTo-Json -Compress } finally {if($p){$p.Dispose()}}"#,
        &[
            ("NEXTUNE_PID", p.pid.to_string()),
            ("NEXTUNE_TICKS", p.start_ticks.clone()),
            ("NEXTUNE_NAME", p.name.clone()),
        ],
    )
}

/// Visible apps in this Windows session. Exclusions remain effective for manual close.
pub fn applications(exclusions: &[String]) -> AppResult<Vec<ProcessCandidate>> {
    let values = platform::powershell(
        r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $session=(Get-Process -Id $PID).SessionId; $items=@(Get-Process | Where-Object {$_.SessionId -eq $session -and $_.MainWindowHandle -ne 0 -and $_.ProcessName -notin @('nextune','explorer','ApplicationFrameHost','SystemSettings','Taskmgr','SecurityHealthSystray','MsMpEng','dwm','winlogon','csrss','sihost','ShellExperienceHost','StartMenuExperienceHost')} | ForEach-Object {try {@{pid=$_.Id;name=$_.ProcessName+'.exe';startTicks=[string]$_.StartTime.ToUniversalTime().Ticks;memory=$_.WorkingSet64}}catch{}}); ConvertTo-Json -InputObject $items -Compress"#,
        &[],
    )?;
    let mut result: Vec<ProcessCandidate> = serde_json::from_value(values).map_err(|_| {
        crate::models::AppError::new("process_list", "アプリ一覧を読み取れませんでした。")
    })?;
    result.retain(|p| !exclusions.iter().any(|e| e.eq_ignore_ascii_case(&p.name)));
    result.sort_by(|a, b| b.memory.cmp(&a.memory));
    Ok(result)
}

/// Only minimized, explicitly supported desktop apps; never scan/trim all processes.
pub fn tidy_memory(exclusions: &[String]) -> AppResult<Value> {
    platform::powershell(
        r#"
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class NexTuneMemory { [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h); }'
$excluded=@(ConvertFrom-Json -InputObject $env:NEXTUNE_EXCLUSIONS)
$session=(Get-Process -Id $PID).SessionId
$done=0; $skipped=0; [long]$reduced=0
Get-Process | Where-Object {$_.SessionId -eq $session -and $_.ProcessName -in @('chrome','msedge','firefox','Spotify','Teams','ms-teams','Creative Cloud') -and $_.MainWindowHandle -ne 0} | ForEach-Object {
 $p=$_
 try {
  if(($p.ProcessName+'.exe') -in $excluded){return}
  $handle=$p.Handle
  if(-not [NexTuneMemory]::IsIconic($p.MainWindowHandle)){return}
  $p.Refresh(); [long]$before=$p.WorkingSet64
  if([NexTuneMemory]::EmptyWorkingSet($handle)){$p.Refresh(); $reduced += [Math]::Max([long]0,($before-$p.WorkingSet64)); $done++}else{$skipped++}
 } catch {$skipped++} finally {$p.Dispose()}
}
@{processed=$done;skipped=$skipped;reduced=$reduced} | ConvertTo-Json -Compress
"#,
        &[(
            "NEXTUNE_EXCLUSIONS",
            serde_json::to_string(exclusions).unwrap_or_else(|_| "[]".into()),
        )],
    )
}
