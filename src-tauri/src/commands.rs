use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State, Window};

use crate::config::{AppConfig, PairedDevice};
use crate::engine::{chrono_like_now, DiscoveredPeer, EngineState, EngineStatus, HistoryEntry};
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
    let mut autostart_changed: Option<bool> = None;
    let mut cfg = state.config.write().await;
    if let Ok(incoming) = serde_json::from_value::<AppConfig>(config.clone()) {
        if cfg.auto_start != incoming.auto_start {
            autostart_changed = Some(incoming.auto_start);
        }
        *cfg = incoming;
    } else if let serde_json::Value::Object(map) = config {
        if let Some(val) = map.get("targetFolder").and_then(|v| v.as_str()) {
            cfg.target_folder = val.to_string();
        }
        if let Some(val) = map.get("autoStart").and_then(|v| v.as_bool()) {
            if cfg.auto_start != val {
                autostart_changed = Some(val);
            }
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
    if let Some(enable) = autostart_changed {
        let _ = crate::autostart::set_system_autostart(enable);
    }
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
    let ips = crate::net_utils::get_local_network_ips();
    let primary_ip = ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string());

    let url = format!("http://{}:{}/mobile?token={}", primary_ip, cfg.api_port, token);

    Ok(serde_json::json!({
        "ips": ips,
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
    let _ = state.regenerate_mobile_session_token().await;
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
    crate::discovery::trigger_manual_scan(state.inner().clone()).await;
    get_discovered_peers(state).await
}

#[tauri::command]
pub async fn respond_pairing_request(
    state: State<'_, Arc<EngineState>>,
    request_id: String,
    approved: bool,
) -> Result<bool, String> {
    let tx = {
        let mut map = state.pending_pairing_requests.lock().await;
        map.remove(&request_id)
    };
    if let Some(sender) = tx {
        let _ = sender.send(approved);
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn pair_device(
    state: State<'_, Arc<EngineState>>,
    input: String,
) -> Result<Value, String> {
    let raw = input.trim();
    if raw.is_empty() {
        return Ok(serde_json::json!({
            "success": false,
            "error": "Введите IP-адрес или имя устройства"
        }));
    }

    // Strip http:// or https:// prefix
    let clean = raw
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('/')
        .trim();

    let has_explicit_port = clean.contains(':');
    let mut target_ip = String::new();
    let mut target_port: u16 = 52520;

    // Check if input is formatted as IP or IP:port
    if has_explicit_port {
        let parts: Vec<&str> = clean.split(':').collect();
        if let Ok(ip) = parts[0].parse::<std::net::IpAddr>() {
            target_ip = ip.to_string();
            if parts.len() > 1 {
                if let Ok(p) = parts[1].parse::<u16>() {
                    target_port = p;
                }
            }
        }
    } else if let Ok(ip) = clean.parse::<std::net::IpAddr>() {
        target_ip = ip.to_string();
    } else if clean.eq_ignore_ascii_case("localhost") {
        target_ip = "127.0.0.1".to_string();
    }

    // If port was NOT explicitly specified, check if this IP is known in discovered_peers or paired_devices!
    if !has_explicit_port && !target_ip.is_empty() {
        let peers = state.discovered_peers.read().await;
        if let Some(p) = peers.values().find(|p| p.ip == target_ip) {
            target_port = p.port;
        } else {
            let cfg = state.config.read().await;
            if let Some(p) = cfg.paired_devices.iter().find(|d| d.ip == target_ip) {
                target_port = p.port;
            }
        }
    }

    // If not direct IP, look up peer in discovered_peers
    if target_ip.is_empty() {
        let peers = state.discovered_peers.read().await;
        let matched = peers.values().find(|p| {
            p.device_id.eq_ignore_ascii_case(clean)
                || p.id.eq_ignore_ascii_case(clean)
                || p.device_name.eq_ignore_ascii_case(clean)
                || p.name.eq_ignore_ascii_case(clean)
                || p.ip == clean
        });

        if let Some(p) = matched {
            target_ip = p.ip.clone();
            target_port = p.port;
        } else {
            let cfg = state.config.read().await;
            if let Some(p) = cfg.paired_devices.iter().find(|d| {
                d.id.eq_ignore_ascii_case(clean)
                    || d.custom_name.eq_ignore_ascii_case(clean)
                    || d.original_name.eq_ignore_ascii_case(clean)
                    || d.ip == clean
            }) {
                target_ip = p.ip.clone();
                target_port = p.port;
            }
        }
    }

    // If not in cache, actively trigger fast subnet probe (matching Electron)
    if target_ip.is_empty() {
        state.logger.info("Pairing", &format!("Device \"{}\" not in UDP discovery cache. Scanning local subnet...", clean), None);
        crate::discovery::probe_subnet(state.inner().clone()).await;

        let peers = state.discovered_peers.read().await;
        let clean_upper = clean.to_uppercase();
        let matched = peers.values().find(|p| {
            let p_id = p.device_id.to_uppercase();
            p.device_id.eq_ignore_ascii_case(clean)
                || p.id.eq_ignore_ascii_case(clean)
                || p.device_name.eq_ignore_ascii_case(clean)
                || p.name.eq_ignore_ascii_case(clean)
                || p.ip == clean
                || p_id.ends_with(&format!("-{}", clean_upper))
                || p_id.replace("MAC-", "").replace("PC-", "") == clean_upper
        });

        if let Some(p) = matched {
            target_ip = p.ip.clone();
            target_port = p.port;
        }
    }

    if target_ip.is_empty() {
        return Ok(serde_json::json!({
            "success": false,
            "error": format!("Устройство \"{}\" не найдено в сети. Убедитесь, что оба устройства подключены к одной сети, или введите IP-адрес напрямую.", clean)
        }));
    }

    let (device_id, device_name, our_port, wan_ip) = {
        let cfg = state.config.read().await;
        (cfg.device_id.clone(), cfg.device_name.clone(), cfg.api_port, cfg.wan_ip.clone())
    };

    let local_token: String = {
        use rand::Rng;
        let mut rng = rand::rng();
        let token_bytes: Vec<u8> = (0..24).map(|_| rng.random()).collect();
        token_bytes.iter().map(|b| format!("{:02x}", b)).collect()
    };

    let our_ip = crate::net_utils::get_local_network_ips()
        .first()
        .cloned()
        .or_else(|| local_ip_address::local_ip().ok().map(|ip| ip.to_string()))
        .unwrap_or_default();

    let payload = serde_json::json!({
        "deviceId": device_id,
        "deviceName": device_name,
        "authToken": local_token,
        "ip": our_ip,
        "port": our_port,
        "wanIp": wan_ip,
        "remotePort": our_port,
        "platform": if cfg!(target_os = "macos") { "darwin" } else { "win32" }
    });

    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(35))
        .build()
        .map_err(|e| e.to_string())?;

    let mut actual_port = target_port;
    let url = format!("http://{}:{}/api/pair", target_ip, actual_port);
    state.logger.info("Pairing", &format!("Initiating pairing handshake with {}:{}", target_ip, actual_port), None);

    let mut resp = client.post(&url).json(&payload).send().await;

    // Retry up to 2 times with 350ms delay if connection failed and was not a timeout
    if resp.is_err() && !resp.as_ref().err().map(|e| e.is_timeout()).unwrap_or(false) {
        for attempt in 1..=2 {
            tokio::time::sleep(Duration::from_millis(350)).await;
            state.logger.info("Pairing", &format!("Retrying handshake with {}:{} (attempt {})", target_ip, actual_port, attempt + 1), None);
            let retry_res = client.post(&url).json(&payload).send().await;
            if retry_res.is_ok() {
                resp = retry_res;
                break;
            }
        }
    }

    // Automatic fallback between standard ports 52520 <-> 8384 if initial connection failed and was not a timeout
    if resp.is_err() && !resp.as_ref().err().map(|e| e.is_timeout()).unwrap_or(false) {
        if actual_port == 52520 || actual_port == 8384 {
            let fallback_port = if actual_port == 52520 { 8384 } else { 52520 };
            let fallback_url = format!("http://{}:{}/api/pair", target_ip, fallback_port);
            state.logger.info("Pairing", &format!("Handshake on port {} failed, attempting fallback port {}:{}", actual_port, target_ip, fallback_port), None);
            let fb_res = client.post(&fallback_url).json(&payload).send().await;
            if fb_res.is_ok() {
                actual_port = fallback_port;
                resp = fb_res;
            }
        }
    }

    let resp = match resp {
        Ok(r) => r,
        Err(err) => {
            let msg = if err.is_timeout() {
                "Таймаут подключения: удаленное устройство не ответило вовремя или отклонило запрос".to_string()
            } else {
                let source_msg = std::error::Error::source(&err)
                    .map(|s| format!(" | cause: {}", s))
                    .unwrap_or_default();
                format!(
                    "Не удалось подключиться к {}:{}. Убедитесь, что MacDrop запущен на удалённом устройстве и Windows Firewall не блокирует порты 52520/8384 (TCP) и 8385 (UDP). ({}{})",
                    target_ip, actual_port, err, source_msg
                )
            };
            state.logger.error("Pairing", &msg, None);
            return Ok(serde_json::json!({
                "success": false,
                "error": msg
            }));
        }
    };

    let status = resp.status();
    if status.is_success() {
        let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let peer_device_id = body.get("deviceId").and_then(|v| v.as_str()).unwrap_or(clean).to_string();
        let peer_device_name = body.get("deviceName").and_then(|v| v.as_str()).unwrap_or("Устройство").to_string();
        let shared_token = body.get("authToken").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap_or(local_token);

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let mut paired_peer = PairedDevice {
            id: peer_device_id.clone(),
            original_name: peer_device_name.clone(),
            custom_name: peer_device_name.clone(),
            ip: target_ip.clone(),
            port: actual_port,
            remote_ip: None,
            remote_port: None,
            paired_at: chrono_like_now(),
            last_seen: now,
            receive_enabled: Some(true),
            connection_mode: Some("local".to_string()),
            auth_token: Some(shared_token),
            platform: None,
        };

        {
            let mut cfg = state.config.write().await;
            if let Some(existing) = cfg.paired_devices.iter_mut().find(|d| d.id == peer_device_id) {
                existing.ip = target_ip.clone();
                existing.port = actual_port;
                existing.original_name = peer_device_name.clone();
                existing.auth_token = paired_peer.auth_token.clone();
                existing.last_seen = now;
                existing.connection_mode = Some("local".to_string());
                paired_peer = existing.clone();
            } else {
                paired_peer.port = actual_port;
                cfg.paired_devices.push(paired_peer.clone());
            }
            crate::config::save_config(&cfg);
        }

        state.logger.info("Pairing", &format!("Successfully paired with device \"{}\" ({}:{})", peer_device_name, target_ip, actual_port), None);

        state.emit_status_changed().await;

        Ok(serde_json::json!({
            "success": true,
            "peer": paired_peer
        }))
    } else if status == reqwest::StatusCode::FORBIDDEN {
        let mut err_msg = "Сопряжение отклонено пользователем на удаленном устройстве".to_string();
        if let Ok(body) = resp.json::<serde_json::Value>().await {
            if let Some(e) = body.get("error").and_then(|v| v.as_str()) {
                err_msg = e.to_string();
            }
        }
        state.logger.warn("Pairing", &err_msg, None);
        Ok(serde_json::json!({
            "success": false,
            "error": err_msg
        }))
    } else if status == reqwest::StatusCode::REQUEST_TIMEOUT {
        state.logger.warn("Pairing", "Pairing request timed out", None);
        Ok(serde_json::json!({
            "success": false,
            "error": "Время ожидания подтверждения сопряжения истекло"
        }))
    } else {
        let err_msg = format!("Сервер вернул ошибку: HTTP {}", status);
        state.logger.error("Pairing", &err_msg, None);
        Ok(serde_json::json!({
            "success": false,
            "error": err_msg
        }))
    }
}

#[tauri::command]
pub async fn unpair_device(
    state: State<'_, Arc<EngineState>>,
    device_id: Option<String>,
) -> Result<bool, String> {
    {
        let mut cfg = state.config.write().await;
        if let Some(id) = &device_id {
            cfg.paired_devices.retain(|d| &d.id != id);
            crate::config::save_config(&cfg);
            state.logger.info("Pairing", "Device unpaired", Some(id.clone()));
        } else {
            cfg.paired_devices.clear();
            crate::config::save_config(&cfg);
            state.logger.info("Pairing", "All devices unpaired", None);
        }
    }
    state.emit_status_changed().await;
    Ok(true)
}

#[tauri::command]
pub async fn update_device_name(
    state: State<'_, Arc<EngineState>>,
    device_id: String,
    new_name: String,
) -> Result<bool, String> {
    let mut updated = false;
    {
        let mut cfg = state.config.write().await;
        if let Some(device) = cfg.paired_devices.iter_mut().find(|d| d.id == device_id) {
            device.custom_name = new_name;
            crate::config::save_config(&cfg);
            updated = true;
        }
    }
    if updated {
        state.emit_status_changed().await;
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
    let mut updated = false;
    {
        let mut cfg = state.config.write().await;
        if let Some(device) = cfg.paired_devices.iter_mut().find(|d| d.id == device_id) {
            device.receive_enabled = Some(enabled);
            crate::config::save_config(&cfg);
            updated = true;
        }
    }
    if updated {
        state.emit_status_changed().await;
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
    drop(cfg);

    let _ = crate::autostart::set_system_autostart(enable);
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
