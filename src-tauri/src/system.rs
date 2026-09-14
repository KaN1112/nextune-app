use crate::{models::AppResult, platform};
use serde_json::{json, Value};
use sysinfo::{Disks, System};

pub fn info() -> AppResult<Value> {
    let mut sys = System::new();
    sys.refresh_cpu_all();
    sys.refresh_memory();
    let details = platform::powershell(r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $gpu=@(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name); $p=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()); @{gpu=$gpu; administrator=$p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)} | ConvertTo-Json -Compress"#, &[]).ok();
    let disks = Disks::new_with_refreshed_list();
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
    let disk = disks.list().iter().find(|d| {
        d.mount_point()
            .to_string_lossy()
            .to_lowercase()
            .starts_with(&system_drive.to_lowercase())
    });
    Ok(
        json!({ "cpu": sys.cpus().first().map(|c| c.brand()), "logicalCores": sys.cpus().len(), "physicalCores": sys.physical_core_count(),
        "ramTotal": sys.total_memory(), "windows": System::long_os_version(), "architecture": std::env::consts::ARCH,
        "gpu": details.as_ref().and_then(|v| v.get("gpu")), "administrator": details.as_ref().and_then(|v| v.get("administrator")),
        "diskTotal": disk.map(|d| d.total_space()), "diskAvailable": disk.map(|d| d.available_space()) }),
    )
}
