#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod cleaner;
mod commands;
mod counters;
mod desktop;
mod hardware;
mod known_folders;
mod models;
mod network;
mod optimizer;
mod performance;
mod platform;
mod processes;
mod restore;
mod settings;
mod system;
use std::sync::Mutex;
use tauri::Manager;
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            std::fs::create_dir_all(&root)?;
            settings::log(&root, "startup");
            app.manage(commands::AppState {
                root,
                monitor: Mutex::new(performance::Monitor::new()),
                operations: Mutex::new(()),
                cleanup: Mutex::new(None),
                optimization: Mutex::new(None),
                ping: Mutex::new(()),
                memory_last: Mutex::new(None),
            });
            desktop::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::get_performance_snapshot,
            commands::get_network_info,
            commands::get_process_list,
            commands::list_applications,
            commands::close_application,
            commands::quick_cleanup,
            commands::get_hardware_sensors,
            commands::open_windows_settings,
            commands::check_updates,
            commands::run_ping_test,
            commands::scan_cleaner,
            commands::run_cleaner,
            commands::scan_optimization,
            commands::apply_optimization,
            commands::get_restore_history,
            commands::restore_session,
            commands::load_settings,
            commands::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("NexTuneを起動できませんでした");
}

#[cfg(test)]
mod smoke_tests {
    #[test]
    #[ignore = "Read-only Windows integration test; run explicitly on the target OS"]
    fn windows_read_only() {
        let info = crate::system::info().unwrap();
        assert!(info["ramTotal"].as_u64().unwrap() > 0);
        let mut monitor = crate::performance::Monitor::new();
        assert!(monitor.snapshot().cpu.is_none());
        std::thread::sleep(std::time::Duration::from_millis(300));
        assert!(monitor.snapshot().cpu.is_some());
        let _ = crate::network::connection().unwrap();
        let scan = crate::optimizer::scan(&crate::models::Settings::default()).unwrap();
        assert!(scan.power_plan.is_some());
        let _ = crate::cleaner::scan().unwrap();
        let ping = crate::network::ping("127.0.0.1".into()).unwrap();
        assert_eq!(ping["sent"], 20);
        assert_eq!(ping["received"], 20);
    }
}
