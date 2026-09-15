use crate::{models::{AppResult,AppError}, platform};
use std::sync::Mutex;
static QUERY: Mutex<()> = Mutex::new(());
/// WMI formatted counters work independently of the Windows display language.
pub fn read() -> AppResult<serde_json::Value> {
 let _guard = QUERY.try_lock().map_err(|_| AppError::new("busy", "センサー情報を取得中です。"))?;
 platform::powershell(r#"
$ErrorActionPreference='Stop'
$gpu=$null; $vram=$null
try {
 $engines=@(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -OperationTimeoutSec 3)
 if($engines.Count -gt 0){
  $groups=$engines | Group-Object {$_.Name -replace '^pid_\d+_',''}
  $max=($groups | ForEach-Object {($_.Group | Measure-Object -Property UtilizationPercentage -Sum).Sum} | Measure-Object -Maximum).Maximum
  $gpu=[Math]::Min(100,[double]$max)
 }
} catch {}
try {
 $mem=@(Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -OperationTimeoutSec 3)
 if($mem.Count -gt 0){$vram=[long](($mem | Measure-Object -Property DedicatedUsage -Sum).Sum)}
} catch {}
@{gpu=$gpu;vram=$vram;measuredAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Compress
"#, &[])
}
