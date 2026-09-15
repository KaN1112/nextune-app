use serde::Serialize;
use std::time::Instant;
use sysinfo::{Networks, System};

pub struct Monitor {
    pub system: System,
    sampled_at: Instant,
    ready: bool,
    networks: Networks,
    disk_counter: Option<crate::counters::DiskCounter>,
    disk_rate: Option<u64>,
    network_rate: Option<u64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub cpu: Option<f32>,
    pub ram_used: u64,
    pub ram_total: u64,
    pub ram_available: u64,
    pub gpu: Option<f32>,
    pub vram: Option<u64>,
    pub disk: Option<u64>,
    pub network: Option<u64>,
}
impl Monitor {
    pub fn new() -> Self {
        let mut system = System::new();
        system.refresh_cpu_all();
        system.refresh_memory();
        let networks = Networks::new_with_refreshed_list();
        let disk_counter = crate::counters::DiskCounter::new();
        Self {
            system,
            sampled_at: Instant::now(),
            ready: false,
            networks,
            disk_counter,
            disk_rate: None,
            network_rate: None,
        }
    }
    pub fn snapshot(&mut self) -> Snapshot {
        if self.sampled_at.elapsed() >= std::time::Duration::from_millis(250) {
            let seconds = self.sampled_at.elapsed().as_secs_f64();
            self.networks.refresh(true);
            self.network_rate = (!self.networks.is_empty()).then(|| {
                (self
                    .networks
                    .values()
                    .map(|n| n.received().saturating_add(n.transmitted()))
                    .sum::<u64>() as f64
                    / seconds) as u64
            });
            self.disk_rate = self
                .disk_counter
                .as_mut()
                .and_then(|counter| counter.sample());
            self.system.refresh_cpu_usage();
            self.sampled_at = Instant::now();
            self.ready = true;
        }
        self.system.refresh_memory();
        Snapshot {
            cpu: self.ready.then(|| self.system.global_cpu_usage()),
            ram_used: self.system.used_memory(),
            ram_total: self.system.total_memory(),
            ram_available: self.system.available_memory(),
            gpu: None,
            vram: None,
            disk: self.disk_rate,
            network: self.network_rate,
        }
    }
}
