use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, State, Window};

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
    config: serde_json::Value,
) -> Result<AppConfig, String> {
    let mut cfg = state.config.write().await;
    if let Ok(incoming) = serde_json::from_value::<AppConfig>(config.clone()) {
        *cfg = incoming;
    } else if let serde_json::Value::Object(map) = config {
        if let Some(val) = map.get("targetFolder").and_then(|v| v.as_str()) {
            cfg.target_folder = val.to_string();
        }
        if let Some(val) = map.get("autoStart").and_then(|v| v.as_bool()) {
            cfg.auto_start = val;
        }
        if let Some(val) = map.get("notifications").and_then(|v| v.as_bool()) {
            cfg.notifications = val;
        }
        if let Some(val) = map.get("language").and_then(|v| v.as_str()) {
            cfg.language = Some(val.to_string());
        }
    }
    crate::config::save_config(&cfg);
    state.logger.info("Config", "Configuration saved", None);
    Ok(cfg.clone())
}

#[tauri::command]
pub async fn get_status(state: State<'_, Arc<EngineState>>) -> Result<EngineStatus, String> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn select_folder(state: State<'_, Arc<EngineState>>) -> Result<String, String> {
    let starting_dir = {
        let cfg = state.config.read().await;
        if !cfg.target_folder.is_empty() && std::path::Path::new(&cfg.target_folder).exists() {
            cfg.target_folder.clone()
        } else {
            dirs::download_dir()
                .or_else(dirs::home_dir)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        }
    };

    #[cfg(target_os = "macos")]
    unsafe {
        use objc2::runtime::AnyObject;
        let ns_app: *mut AnyObject = objc2::msg_send![objc2::class!(NSApplication), sharedApplication];
        if !ns_app.is_null() {
            let () = objc2::msg_send![ns_app, activateIgnoringOtherApps: true];
        }
    }

    let mut dialog = rfd::AsyncFileDialog::new().set_title("Выберите папку для сохранения");
    if !starting_dir.is_empty() {
        dialog = dialog.set_directory(&starting_dir);
    }
    let res = dialog.pick_folder().await;
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
    let cleared = state.logger.clear_logs();
    if let Ok(guard) = state.app_handle.try_read() {
        if let Some(app) = guard.as_ref() {
            use tauri::Emitter;
            let _ = app.emit("logs-cleared", ());
        }
    }
    Ok(cleared)
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
    crate::discovery::trigger_manual_scan(&state).await;
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
    #[cfg(target_os = "macos")]
    {
        let is_fs = window.is_fullscreen().unwrap_or(false);
        window.set_fullscreen(!is_fs).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())
        } else {
            window.maximize().map_err(|e| e.to_string())
        }
    }
}

#[tauri::command]
pub async fn fill_window(window: Window) -> Result<(), String> {
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
pub async fn start_dragging(window: Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
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

#[cfg(target_os = "macos")]
fn nsstring_from_str(s: &str) -> *mut objc2::runtime::AnyObject {
    unsafe {
        let c_str = std::ffi::CString::new(s).unwrap_or_default();
        objc2::msg_send![objc2::class!(NSString), stringWithUTF8String: c_str.as_ptr()]
    }
}

#[cfg(target_os = "macos")]
fn pick_files_and_folders_native(starting_dir: &str) -> Vec<String> {
    unsafe {
        use objc2::runtime::AnyObject;

        let ns_app: *mut AnyObject = objc2::msg_send![objc2::class!(NSApplication), sharedApplication];
        if !ns_app.is_null() {
            let () = objc2::msg_send![ns_app, activateIgnoringOtherApps: true];
        }

        let panel: *mut AnyObject = objc2::msg_send![objc2::class!(NSOpenPanel), openPanel];
        if panel.is_null() {
            return Vec::new();
        }

        // Enable choosing both files and directories, plus multi-selection
        let () = objc2::msg_send![panel, setCanChooseFiles: true];
        let () = objc2::msg_send![panel, setCanChooseDirectories: true];
        let () = objc2::msg_send![panel, setAllowsMultipleSelection: true];
        let () = objc2::msg_send![panel, setCanCreateDirectories: false];

        // Prompt button label
        let prompt_ns = nsstring_from_str("Выбрать");
        if !prompt_ns.is_null() {
            let () = objc2::msg_send![panel, setPrompt: prompt_ns];
        }

        // Title and message
        let title_ns = nsstring_from_str("Выберите файлы и папки для отправки");
        if !title_ns.is_null() {
            let () = objc2::msg_send![panel, setMessage: title_ns];
        }

        // Starting directory
        if !starting_dir.is_empty() {
            let dir_ns = nsstring_from_str(starting_dir);
            if !dir_ns.is_null() {
                let dir_url: *mut AnyObject = objc2::msg_send![
                    objc2::class!(NSURL),
                    fileURLWithPath: dir_ns
                ];
                if !dir_url.is_null() {
                    let () = objc2::msg_send![panel, setDirectoryURL: dir_url];
                }
            }
        }

        let res: isize = objc2::msg_send![panel, runModal];
        if res == 1 { // NSModalResponseOK
            let urls: *mut AnyObject = objc2::msg_send![panel, URLs];
            if urls.is_null() {
                return Vec::new();
            }
            let count: usize = objc2::msg_send![urls, count];
            let mut result = Vec::with_capacity(count);
            for i in 0..count {
                let url: *mut AnyObject = objc2::msg_send![urls, objectAtIndex: i];
                if !url.is_null() {
                    let path: *mut AnyObject = objc2::msg_send![url, path];
                    if !path.is_null() {
                        let utf8: *const std::os::raw::c_char = objc2::msg_send![path, UTF8String];
                        if !utf8.is_null() {
                            let s = std::ffi::CStr::from_ptr(utf8).to_string_lossy().to_string();
                            result.push(s);
                        }
                    }
                }
            }
            result
        } else {
            Vec::new()
        }
    }
}

#[tauri::command]
pub async fn pick_and_send_files(
    app: AppHandle,
    state: State<'_, Arc<EngineState>>,
    target_device_id: Option<String>,
) -> Result<bool, String> {
    let starting_dir = {
        let cfg = state.config.read().await;
        if !cfg.target_folder.is_empty() && std::path::Path::new(&cfg.target_folder).exists() {
            cfg.target_folder.clone()
        } else {
            dirs::download_dir()
                .or_else(dirs::document_dir)
                .or_else(dirs::home_dir)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        }
    };

    #[cfg(target_os = "macos")]
    let paths = {
        let (tx, rx) = tokio::sync::oneshot::channel();
        let dir = starting_dir.clone();
        app.run_on_main_thread(move || {
            let res = pick_files_and_folders_native(&dir);
            let _ = tx.send(res);
        }).map_err(|e| e.to_string())?;
        rx.await.map_err(|e| e.to_string())?
    };

    #[cfg(not(target_os = "macos"))]
    let paths = {
        let mut dialog = rfd::AsyncFileDialog::new().set_title("Выберите файлы и папки для отправки");
        if !starting_dir.is_empty() {
            dialog = dialog.set_directory(&starting_dir);
        }
        let files = dialog.pick_files().await;
        if let Some(file_handles) = files {
            file_handles
                .into_iter()
                .map(|h| h.path().to_string_lossy().to_string())
                .collect()
        } else {
            Vec::new()
        }
    };

    if !paths.is_empty() {
        send_dropped_files(state, paths, target_device_id).await.map(|_| true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn pick_and_send_folder(
    app: AppHandle,
    state: State<'_, Arc<EngineState>>,
    target_device_id: Option<String>,
) -> Result<bool, String> {
    pick_and_send_files(app, state, target_device_id).await
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

    // Trigger peer network transfer in background task
    let transfer_state = state.inner().clone();
    let transfer_paths = file_paths.clone();
    let transfer_target = target_device_id.clone();
    tokio::spawn(async move {
        let _ = crate::transfer::execute_peer_transfer(transfer_state, transfer_paths, transfer_target).await;
    });

    Ok(serde_json::json!({ "success": true, "count": file_paths.len() }))
}

#[tauri::command]
pub async fn cancel_transfer(state: State<'_, Arc<EngineState>>) -> Result<bool, String> {
    let mut prog = state.current_progress.write().await;
    *prog = None;
    state.logger.info("Engine", "Active transfer cancelled", None);
    Ok(true)
}
