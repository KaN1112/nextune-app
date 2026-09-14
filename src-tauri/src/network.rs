use crate::{
    models::{AppError, AppResult},
    platform,
};
use serde_json::{json, Value};
use std::net::IpAddr;

pub fn connection() -> AppResult<Value> {
    platform::powershell(
        r#"$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $a=Get-NetIPConfiguration | Where-Object {$_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up'} | Select-Object -First 1; if($null -eq $a){ @{adapter=$null;connectionType=$null;ipv4=$null;dns=@()} | ConvertTo-Json -Compress } else { @{adapter=$a.InterfaceAlias;connectionType=[string]$a.NetAdapter.PhysicalMediaType;ipv4=@($a.IPv4Address.IPAddress);dns=@($a.DNSServer.ServerAddresses)} | ConvertTo-Json -Compress }"#,
        &[],
    )
}
pub fn ping(target: String) -> AppResult<Value> {
    let ip: IpAddr = target.parse().map_err(|_| {
        AppError::new(
            "invalid_ip",
            "有効なIPv4またはIPv6アドレスを入力してください。ポートやホスト名は指定できません。",
        )
    })?;
    if ip.is_unspecified() || ip.is_multicast() {
        return Err(AppError::new(
            "invalid_ip",
            "ユニキャストIPアドレスを指定してください。",
        ));
    }
    let values = platform::powershell(
        r#"$ErrorActionPreference='Stop'; $p=[Net.NetworkInformation.Ping]::new(); try { $samples=@(for($i=0;$i -lt 20;$i++){try{$r=$p.Send($env:NEXTUNE_PING,1000);if($r.Status -eq 'Success'){[double]$r.RoundtripTime}else{$null}}catch{$null};Start-Sleep -Milliseconds 200}); ConvertTo-Json -InputObject $samples -Compress } finally {$p.Dispose()}"#,
        &[("NEXTUNE_PING", ip.to_string())],
    )?;
    let samples: Vec<Option<f64>> = serde_json::from_value(values)?;
    Ok(summarize(&samples, &ip.to_string()))
}
pub fn summarize(samples: &[Option<f64>], target: &str) -> Value {
    let ok: Vec<f64> = samples.iter().flatten().copied().collect();
    // Mean absolute difference of adjacent successful probes. A timeout breaks adjacency.
    let diffs: Vec<f64> = samples
        .windows(2)
        .filter_map(|w| Some((w[1]? - w[0]?).abs()))
        .collect();
    json!({ "target": target, "samples": samples, "sent": samples.len(), "received": ok.len(),
        "average": if ok.is_empty() { None } else { Some(ok.iter().sum::<f64>() / ok.len() as f64) },
        "minimum": ok.iter().copied().reduce(f64::min), "maximum": ok.iter().copied().reduce(f64::max),
        "jitter": if diffs.is_empty() { None } else { Some(diffs.iter().sum::<f64>() / diffs.len() as f64) },
        "packetLoss": if samples.is_empty() { None } else { Some(100.0 * (samples.len() - ok.len()) as f64 / samples.len() as f64) },
        "measuredAt": chrono::Utc::now().to_rfc3339() })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn loss_and_jitter() {
        let v = summarize(&[Some(10.), Some(20.), None, Some(50.)], "1.1.1.1");
        assert_eq!(v["packetLoss"], 25.);
        assert_eq!(v["jitter"], 10.);
    }
    #[test]
    fn missing_is_not_zero() {
        let v = summarize(&[None, None], "1.1.1.1");
        assert!(v["average"].is_null());
        assert_eq!(v["packetLoss"], 100.);
    }
}
