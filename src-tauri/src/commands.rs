use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{State, Window};

use crate::config::AppConfig;
use crate::engine::{DiscoveredPeer, EngineState, EngineStatus, HistoryEntry};
use crate::logger::LogEntry;

#[tauri::command]
pub async fn get_config(state: State<'_, Arc<EngineState>>) -> Result<AppConfig, String> {
    let cfg = state.config.read().await;
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn save_config(
    state: State<'_, Arc<EngineState>>,
    config: AppConfig,
) -> Result<AppConfig, String> {
    let mut cfg = state.config.write().await;
    *cfg = config.clone();
    crate::config::save_config(&cfg);
    state.logger.info("Config", "Configuration saved", None);
    Ok(config)
}

#[tauri::command]
pub async fn get_status(state: State<'_, Arc<EngineState>>) -> Result<EngineStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn select_folder() -> Result<String, String> {
    let res = rfd::AsyncFileDialog::new().pick_folder().await;
    if let Some(folder) = res {
        Ok(folder.path().to_string_lossy().to_string())
    } else {
        Ok("".to_string())
    }
}

#[tauri::command]
pub async fn open_folder(state: State<'_, Arc<EngineState>>) -> Result<bool, String> {
    let target = {
        let cfg = state.config.read().await;
        cfg.target_folder.clone()
    };
    if let Err(e) = open::that(&target) {
        state.logger.warn("System", "Failed to open target folder", Some(e.to_string()));
        return Ok(false);
    }
    Ok(true)
}

#[tauri::command]
pub async fn open_file(
    state: State<'_, Arc<EngineState>>,
    filename: String,
) -> Result<bool, String> {
    let target = {
        let cfg = state.config.read().await;
        let mut path = PathBuf::from(&cfg.target_folder);
        path.push(&filename);
        path
    };
    if let Err(e) = open::that(&target) {
        state.logger.warn("System", "Failed to open file", Some(e.to_string()));
        return Ok(false);
    }
    Ok(true)
}

#[tauri::command]
pub async fn get_logs(
    state: State<'_, Arc<EngineState>>,
    limit: Option<usize>,
) -> Result<Vec<LogEntry>, String> {
    Ok(state.logger.get_logs(limit))
}

#[tauri::command]
pub async fn clear_logs(state: State<'_, Arc<EngineState>>) -> Result<bool, String> {
    Ok(state.logger.clear_logs())
}

#[tauri::command]
pub async fn open_logs_folder(state: State<'_, Arc<EngineState>>) -> Result<bool, String> {
    let dir = state.logger.get_log_dir();
    if let Err(e) = open::that(&dir) {
        state.logger.warn("System", "Failed to open log folder", Some(e.to_string()));
        return Ok(false);
    }
    Ok(true)
}

#[tauri::command]
pub async fn get_mobile_share_info(
    state: State<'_, Arc<EngineState>>,
) -> Result<Value, String> {
    let cfg = state.config.read().await;
    let token = state.mobile_token.read().await.clone();
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());

    let url = format!("http://{}:{}/mobile?token={}", local_ip, cfg.api_port, token);

    Ok(serde_json::json!({
        "ips": [local_ip],
        "port": cfg.api_port,
        "token": token,
        "url": url,
        "computerName": cfg.device_name
    }))
}

#[tauri::command]
pub async fn regenerate_mobile_token(
    state: State<'_, Arc<EngineState>>,
) -> Result<Value, String> {
    let token_hex = {
        use rand::Rng;
        let mut rng = rand::rng();
        let token_bytes: Vec<u8> = (0..16).map(|_| rng.random()).collect();
        token_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
    };

    {
        let mut t = state.mobile_token.write().await;
        *t = token_hex;
    }

    get_mobile_share_info(state).await
}

#[tauri::command]
pub async fn get_discovered_peers(
    state: State<'_, Arc<EngineState>>,
) -> Result<Vec<DiscoveredPeer>, String> {
    let peers = state.discovered_peers.read().await;
    Ok(peers.values().cloned().collect())
}

#[tauri::command]
pub async fn scan_nearby_peers(
    state: State<'_, Arc<EngineState>>,
) -> Result<Vec<DiscoveredPeer>, String> {
    // Phase 2 will implement active UDP scan; for Phase 1 return current known peers
    get_discovered_peers(state).await
}

#[tauri::command]
pub async fn pair_device(
    state: State<'_, Arc<EngineState>>,
    input: String,
) -> Result<Value, String> {
    // Attempt to pair with peer by IP:port or ID
    state.logger.info("Pairing", "Pairing initiated with peer", Some(input.clone()));
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn unpair_device(
    state: State<'_, Arc<EngineState>>,
    device_id: Option<String>,
) -> Result<bool, String> {
    if let Some(id) = device_id {
        let mut cfg = state.config.write().await;
        cfg.paired_devices.retain(|d| d.id != id);
        crate::config::save_config(&cfg);
        state.logger.info("Pairing", "Device unpaired", Some(id));
    }
    Ok(true)
}

#[tauri::command]
pub async fn update_device_name(
    state: State<'_, Arc<EngineState>>,
    device_id: String,
    new_name: String,
) -> Result<bool, String> {
    let mut cfg = state.config.write().await;
    if let Some(device) = cfg.paired_devices.iter_mut().find(|d| d.id == device_id) {
        device.custom_name = new_name;
        crate::config::save_config(&cfg);
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn remove_device(
    state: State<'_, Arc<EngineState>>,
    device_id: String,
) -> Result<bool, String> {
    unpair_device(state, Some(device_id)).await
}

#[tauri::command]
pub async fn toggle_device_receive(
    state: State<'_, Arc<EngineState>>,
    device_id: String,
    enabled: bool,
) -> Result<bool, String> {
    let mut cfg = state.config.write().await;
    if let Some(device) = cfg.paired_devices.iter_mut().find(|d| d.id == device_id) {
        device.receive_enabled = Some(enabled);
        crate::config::save_config(&cfg);
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn get_device_history(
    state: State<'_, Arc<EngineState>>,
    device_id: String,
) -> Result<Vec<HistoryEntry>, String> {
    let history = state.history.read().await;
    let filtered: Vec<HistoryEntry> = history
        .iter()
        .filter(|h| h.peer_device_id == device_id)
        .cloned()
        .collect();
    Ok(filtered)
}

#[tauri::command]
pub async fn toggle_autostart(
    state: State<'_, Arc<EngineState>>,
    enable: bool,
) -> Result<bool, String> {
    let mut cfg = state.config.write().await;
    cfg.auto_start = enable;
    crate::config::save_config(&cfg);
    Ok(true)
}

#[tauri::command]
pub async fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn maximize_window(window: Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resize_window(
    window: Window,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let size = tauri::LogicalSize::new(width, height);
    window.set_size(size).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_and_send_files(
    state: State<'_, Arc<EngineState>>,
    target_device_id: Option<String>,
) -> Result<bool, String> {
    let files = rfd::AsyncFileDialog::new().pick_files().await;
    if let Some(file_handles) = files {
        let paths: Vec<String> = file_handles
            .into_iter()
            .map(|h| h.path().to_string_lossy().to_string())
            .collect();
        send_dropped_files(state, paths, target_device_id).await.map(|_| true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn pick_and_send_folder(
    state: State<'_, Arc<EngineState>>,
    target_device_id: Option<String>,
) -> Result<bool, String> {
    let folder = rfd::AsyncFileDialog::new().pick_folder().await;
    if let Some(h) = folder {
        let path = h.path().to_string_lossy().to_string();
        send_dropped_files(state, vec![path], target_device_id).await.map(|_| true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn send_dropped_files(
    state: State<'_, Arc<EngineState>>,
    file_paths: Vec<String>,
    target_device_id: Option<String>,
) -> Result<Value, String> {
    state.logger.info(
        "Engine",
        &format!("Sending {} file(s)", file_paths.len()),
        target_device_id.clone(),
    );

    // Queue files for mobile transfer as well
    for p in &file_paths {
        let path_obj = std::path::Path::new(p);
        if let Ok(meta) = std::fs::metadata(path_obj) {
            let fname = path_obj
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("file")
                .to_string();
            let mut q = state.mobile_queue.write().await;
            q.retain(|i| i.filename != fname);
            q.push(crate::engine::MobileFileQueueItem {
                filename: fname,
                path: p.clone(),
                size: meta.len(),
                mtime_ms: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64,
            });
        }
    }

    Ok(serde_json::json!({ "success": true, "count": file_paths.len() }))
}

#[tauri::command]
pub async fn cancel_transfer(state: State<'_, Arc<EngineState>>) -> Result<bool, String> {
    let mut prog = state.current_progress.write().await;
    *prog = None;
    state.logger.info("Engine", "Active transfer cancelled", None);
    Ok(true)
}
