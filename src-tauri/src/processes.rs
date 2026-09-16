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
                title: name.into(),
                start_ticks: ticks.into(),
                memory,
            });
        }
    }
    Ok(result)
}
pub fn close(p: &ProcessCandidate) -> AppResult<Value> {
    // Verify the exact process instance, then send WM_CLOSE to every top-level window
    // owned by it. This covers apps whose primary window is not MainWindowHandle.
    platform::powershell(
        r#"$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class NexTuneWindows {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static IntPtr[] ForProcess(uint target) {
    var windows = new List<IntPtr>();
    EnumWindows((window, unused) => {
      uint owner;
      GetWindowThreadProcessId(window, out owner);
      if (owner == target) windows.Add(window);
      return true;
    }, IntPtr.Zero);
    return windows.ToArray();
  }
}
'@
$p=$null
try {
 $p=[Diagnostics.Process]::GetProcessById([int]$env:NEXTUNE_PID); $handle=$p.Handle
 if(([string]$p.StartTime.ToUniversalTime().Ticks -ne $env:NEXTUNE_TICKS) -or ($p.ProcessName+'.exe' -ne $env:NEXTUNE_NAME)){throw 'Identity changed'}
 $sent=0
 foreach($window in [NexTuneWindows]::ForProcess([uint32]$p.Id)){if([NexTuneWindows]::PostMessage($window,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)){$sent++}}
 if($sent -eq 0 -and $p.MainWindowHandle -ne 0){if($p.CloseMainWindow()){$sent=1}}
 $closed=$p.WaitForExit(3000)
 @{requested=($sent -gt 0);closed=$closed} | ConvertTo-Json -Compress
} finally {if($p){$p.Dispose()}}"#,
        &[
            ("NEXTUNE_PID", p.pid.to_string()),
            ("NEXTUNE_TICKS", p.start_ticks.clone()),
            ("NEXTUNE_NAME", p.name.clone()),
        ],
    )
}

pub fn force_close(p: &ProcessCandidate) -> AppResult<Value> {
    platform::powershell(
        r#"$ErrorActionPreference='Stop'; $p=$null; try { $p=[Diagnostics.Process]::GetProcessById([int]$env:NEXTUNE_PID); $handle=$p.Handle; if(([string]$p.StartTime.ToUniversalTime().Ticks -ne $env:NEXTUNE_TICKS) -or ($p.ProcessName+'.exe' -ne $env:NEXTUNE_NAME)){throw 'Identity changed'}; $p.Kill(); $closed=$p.WaitForExit(5000); @{closed=$closed} | ConvertTo-Json -Compress } finally {if($p){$p.Dispose()}}"#,
        &[
            ("NEXTUNE_PID", p.pid.to_string()),
            ("NEXTUNE_TICKS", p.start_ticks.clone()),
            ("NEXTUNE_NAME", p.name.clone()),
        ],
    )
}

/// Visible top-level applications in the current Windows session.
pub fn applications() -> AppResult<Vec<ProcessCandidate>> {
    let values = platform::powershell(
        r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $session=(Get-Process -Id $PID).SessionId; $protected=@('nextune','explorer','Taskmgr','SecurityHealthSystray','MsMpEng','dwm','winlogon','csrss','sihost','ShellExperienceHost','StartMenuExperienceHost'); $items=@(Get-Process | Where-Object {$_.SessionId -eq $session -and $_.MainWindowHandle -ne 0 -and $_.ProcessName -notin $protected} | ForEach-Object {try {@{pid=$_.Id;name=$_.ProcessName+'.exe';title=[string]$_.MainWindowTitle;startTicks=[string]$_.StartTime.ToUniversalTime().Ticks;memory=$_.WorkingSet64}}catch{}}); ConvertTo-Json -InputObject $items -Compress"#,
        &[],
    )?;
    let mut result: Vec<ProcessCandidate> = serde_json::from_value(values).map_err(|_| {
        crate::models::AppError::new("process_list", "アプリ一覧を読み取れませんでした。")
    })?;
    result.sort_by(|a, b| b.memory.cmp(&a.memory));
    Ok(result)
}

