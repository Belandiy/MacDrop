use axum::{
    body::Body,
    extract::{ConnectInfo, Path as AxumPath, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

use crate::config::{save_config, AppConfig, PairedDevice};
use crate::logger::AppLogger;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub filename: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed_bps: f64,
    pub direction: String, // "incoming" | "outgoing"
    pub peer_device_id: String,
    pub peer_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub filename: String,
    pub size: u64,
    pub timestamp: i64,
    pub direction: String,
    pub status: String, // "completed" | "failed" | "cancelled"
    pub peer_device_id: String,
    pub peer_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub is_discoverable: bool,
    pub active_transfers: u32,
    pub ip: String,
    pub port: u16,
    pub device_name: String,
    pub device_id: String,
    pub paired_devices: Vec<PairedDevice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPeer {
    pub id: String,
    pub name: String,
    pub device_id: String,
    pub device_name: String,
    pub ip: String,
    pub port: u16,
    pub platform: Option<String>,
    pub last_seen: i64,
    pub is_paired: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MobileFileQueueItem {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub mtime_ms: i64,
}

#[derive(Clone)]
pub struct EngineState {
    pub config: Arc<RwLock<AppConfig>>,
    pub logger: AppLogger,
    pub current_progress: Arc<RwLock<Option<TransferProgress>>>,
    pub history: Arc<RwLock<Vec<HistoryEntry>>>,
    pub mobile_token: Arc<RwLock<String>>,
    pub mobile_queue: Arc<RwLock<Vec<MobileFileQueueItem>>>,
    pub last_mobile_seen: Arc<RwLock<i64>>,
    pub discovered_peers: Arc<RwLock<HashMap<String, DiscoveredPeer>>>,
    pub pending_pairing_requests: Arc<tokio::sync::Mutex<HashMap<String, tokio::sync::oneshot::Sender<bool>>>>,
    pub app_handle: Arc<RwLock<Option<tauri::AppHandle>>>,
}

impl EngineState {
    pub fn new(config: AppConfig, logger: AppLogger) -> Self {
        use rand::Rng;
        let mut rng = rand::rng();
        let token_bytes: Vec<u8> = (0..16).map(|_| rng.random()).collect();
        let token_hex: String = token_bytes.iter().map(|b| format!("{:02x}", b)).collect();

        Self {
            config: Arc::new(RwLock::new(config)),
            logger,
            current_progress: Arc::new(RwLock::new(None)),
            history: Arc::new(RwLock::new(Vec::new())),
            mobile_token: Arc::new(RwLock::new(token_hex)),
            mobile_queue: Arc::new(RwLock::new(Vec::new())),
            last_mobile_seen: Arc::new(RwLock::new(0)),
            discovered_peers: Arc::new(RwLock::new(HashMap::new())),
            pending_pairing_requests: Arc::new(tokio::sync::Mutex::new(HashMap::new())),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        if let Ok(mut h) = self.app_handle.try_write() {
            *h = Some(handle);
        }
    }

    pub async fn is_mobile_session_active(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        let last = *self.last_mobile_seen.read().await;
        let has_files = !self.mobile_queue.read().await.is_empty();
        (last > 0 && (now - last) < 60_000) || has_files
    }

    pub async fn mark_mobile_activity(&self) {
        let was_active = self.is_mobile_session_active().await;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        *self.last_mobile_seen.write().await = now;
        if !was_active {
            self.emit_status_changed().await;
        }
    }

    pub async fn regenerate_mobile_session_token(&self) -> String {
        let token_hex = {
            use rand::Rng;
            let mut rng = rand::rng();
            let token_bytes: Vec<u8> = (0..16).map(|_| rng.random()).collect();
            token_bytes.iter().map(|b| format!("{:02x}", b)).collect::<String>()
        };

        {
            let mut t = self.mobile_token.write().await;
            *t = token_hex.clone();
        }
        {
            let mut q = self.mobile_queue.write().await;
            q.clear();
        }
        {
            let mut l = self.last_mobile_seen.write().await;
            *l = 0;
        }

        self.emit_status_changed().await;
        token_hex
    }

    pub async fn emit_status_changed(&self) {
        if let Some(handle) = self.app_handle.read().await.as_ref() {
            let status = self.get_status().await;
            let _ = handle.emit("status-update", &status);
            let _ = handle.emit("status-changed", &status);
        }
    }

    pub async fn get_status(&self) -> EngineStatus {
        let cfg = self.config.read().await;
        let active = if self.current_progress.read().await.is_some() { 1 } else { 0 };
        let ips = crate::net_utils::get_local_network_ips();
        let local_ip = ips.first().cloned().unwrap_or_else(|| "127.0.0.1".to_string());

        let is_mobile_active = self.is_mobile_session_active().await;
        let mut paired = cfg.paired_devices.clone();

        if is_mobile_active {
            let last_seen_val = {
                let l = *self.last_mobile_seen.read().await;
                if l > 0 {
                    l
                } else {
                    SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as i64
                }
            };

            paired.push(PairedDevice {
                id: "mobile-web".to_string(),
                original_name: "Телефон (Web Drop)".to_string(),
                custom_name: "Телефон (Web Drop)".to_string(),
                ip: "127.0.0.1".to_string(),
                port: cfg.api_port,
                remote_ip: None,
                remote_port: None,
                paired_at: "2026-10-14T00:00:00.000Z".to_string(),
                last_seen: last_seen_val,
                receive_enabled: Some(true),
                connection_mode: Some("local".to_string()),
                auth_token: None,
                platform: Some("mobile".to_string()),
            });
        }

        EngineStatus {
            is_discoverable: true,
            active_transfers: active,
            ip: local_ip,
            port: cfg.api_port,
            device_name: cfg.device_name.clone(),
            device_id: cfg.device_id.clone(),
            paired_devices: paired,
        }
    }
}

// -----------------------------------------------------------------------------
// Path Resolution and Conflict Prevention Helpers
// -----------------------------------------------------------------------------

pub fn get_safe_resolved_path(target_folder: &str, rel_path: &str, filename: &str) -> Option<PathBuf> {
    let raw_name = Path::new(filename)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let sanitized_filename: String = raw_name
        .chars()
        .map(|c| if ['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>'].contains(&c) { '_' } else { c })
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized_filename.is_empty() || sanitized_filename == "." || sanitized_filename == ".." {
        return None;
    }

    let base = PathBuf::from(target_folder);
    let candidate = if !rel_path.is_empty() {
        let p = Path::new(rel_path);
        if p.file_name().and_then(|s| s.to_str()) == Some(&sanitized_filename) {
            base.join(rel_path)
        } else {
            base.join(rel_path).join(&sanitized_filename)
        }
    } else {
        base.join(&sanitized_filename)
    };

    // Check for traversal components like ".."
    for component in candidate.components() {
        if let std::path::Component::ParentDir = component {
            return None;
        }
    }

    Some(candidate)
}

pub fn get_non_conflicting_path(target_path: PathBuf) -> PathBuf {
    if !target_path.exists() {
        return target_path;
    }

    let parent = target_path.parent().unwrap_or_else(|| Path::new("."));
    let file_stem = target_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
    let ext = target_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e))
        .unwrap_or_default();

    let mut counter = 1;
    loop {
        let new_name = format!("{} ({}){}", file_stem, counter, ext);
        let new_path = parent.join(new_name);
        if !new_path.exists() {
            return new_path;
        }
        counter += 1;
        if counter > 9999 {
            return target_path;
        }
    }
}

// -----------------------------------------------------------------------------
// Axum HTTP Server Handlers
// -----------------------------------------------------------------------------

#[derive(Deserialize)]
struct PairingPayload {
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "deviceName")]
    device_name: String,
    ip: Option<String>,
    port: Option<u16>,
    #[serde(rename = "authToken")]
    auth_token: Option<String>,
    #[serde(rename = "wanIp")]
    wan_ip: Option<String>,
    #[serde(rename = "remotePort")]
    remote_port: Option<u16>,
    platform: Option<String>,
}

async fn handle_status(State(state): State<Arc<EngineState>>) -> impl IntoResponse {
    let status = state.get_status().await;
    let cfg = state.config.read().await;

    Json(serde_json::json!({
        "status": "ok",
        "deviceId": status.device_id,
        "deviceName": status.device_name,
        "platform": if cfg!(target_os = "macos") { "darwin" } else { "win32" },
        "wanIp": cfg.wan_ip,
        "remotePort": cfg.api_port
    }))
}

async fn handle_pair(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<EngineState>>,
    Json(payload): Json<PairingPayload>,
) -> impl IntoResponse {
    let clean_ip = match addr.ip() {
        std::net::IpAddr::V4(v4) => v4.to_string(),
        std::net::IpAddr::V6(v6) => {
            if let Some(v4) = v6.to_ipv4_mapped() {
                v4.to_string()
            } else {
                v6.to_string()
            }
        }
    };
    let effective_ip = if (clean_ip == "127.0.0.1" || clean_ip == "::1") && payload.ip.is_some() {
        payload.ip.clone().unwrap()
    } else {
        clean_ip
    };

    let is_already_paired = {
        let cfg = state.config.read().await;
        cfg.paired_devices.iter().any(|d| d.id == payload.device_id)
    };

    if is_already_paired {
        let token = payload.auth_token.clone().unwrap_or_else(|| {
            use rand::Rng;
            let mut rng = rand::rng();
            let bytes: Vec<u8> = (0..24).map(|_| rng.random()).collect();
            bytes.iter().map(|b| format!("{:02x}", b)).collect()
        });

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let (resp_device_id, resp_device_name) = {
            let mut cfg = state.config.write().await;
            if let Some(existing) = cfg.paired_devices.iter_mut().find(|d| d.id == payload.device_id) {
                existing.original_name = payload.device_name.clone();
                existing.ip = effective_ip.clone();
                existing.port = payload.port.unwrap_or(52520);
                existing.auth_token = Some(token.clone());
                existing.last_seen = now;
                existing.connection_mode = Some("local".to_string());
            }
            save_config(&cfg);
            (cfg.device_id.clone(), cfg.device_name.clone())
        };

        // Keep discovered_peers in sync so the device is immediately visible on radar / pairing UI
        {
            let mut peers = state.discovered_peers.write().await;
            peers.insert(
                payload.device_id.clone(),
                DiscoveredPeer {
                    id: payload.device_id.clone(),
                    name: payload.device_name.clone(),
                    device_id: payload.device_id.clone(),
                    device_name: payload.device_name.clone(),
                    ip: effective_ip.clone(),
                    port: payload.port.unwrap_or(52520),
                    platform: payload.platform.clone().or_else(|| Some(crate::discovery::guess_platform_from_name(&payload.device_name).to_string())),
                    last_seen: now,
                    is_paired: true,
                },
            );
        }

        if let Some(handle) = state.app_handle.read().await.as_ref() {
            let all_peers: Vec<DiscoveredPeer> = {
                let peers = state.discovered_peers.read().await;
                peers.values().cloned().collect()
            };
            let _ = handle.emit("peers-update", &all_peers);
        }

        // Reciprocal ping: notify the remote device that we are reachable and active
        let ping_ip = effective_ip.clone();
        let ping_port = payload.port.unwrap_or(52520);
        tokio::spawn(async move {
            let client = reqwest::Client::builder()
                .no_proxy()
                .timeout(std::time::Duration::from_millis(500))
                .build();
            if let Ok(c) = client {
                let url = format!("http://{}:{}/api/ping", ping_ip, ping_port);
                let _ = c.get(&url).send().await;
            }
        });

        state.logger.info("Pairing", &format!("Re-paired with existing device \"{}\" ({})", payload.device_name, effective_ip), None);

        state.emit_status_changed().await;

        return (StatusCode::OK, Json(serde_json::json!({
            "success": true,
            "deviceId": resp_device_id,
            "deviceName": resp_device_name,
            "authToken": token,
        }))).into_response();
    }

    // New device: request user approval in UI
    let request_id = uuid::Uuid::new_v4().to_string();
    let (tx, rx) = tokio::sync::oneshot::channel::<bool>();

    {
        let mut map = state.pending_pairing_requests.lock().await;
        map.insert(request_id.clone(), tx);
    }

    let peer_port = payload.port.unwrap_or(52520);
    state.logger.info(
        "Security",
        &format!("Incoming pairing request [{}] from \"{}\" ({}:{}). Awaiting user approval...",
            request_id, payload.device_name, effective_ip, peer_port
        ),
        None
    );

    // Also register peer immediately in discovered_peers so UI radar sees it
    {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        let mut peers = state.discovered_peers.write().await;
        peers.insert(
            payload.device_id.clone(),
            DiscoveredPeer {
                id: payload.device_id.clone(),
                name: payload.device_name.clone(),
                device_id: payload.device_id.clone(),
                device_name: payload.device_name.clone(),
                ip: effective_ip.clone(),
                port: peer_port,
                platform: payload.platform.clone().or_else(|| Some(crate::discovery::guess_platform_from_name(&payload.device_name).to_string())),
                last_seen: now,
                is_paired: false,
            },
        );
    }

    if let Some(handle) = state.app_handle.read().await.as_ref() {
        let event = serde_json::json!({
            "requestId": request_id.clone(),
            "deviceId": payload.device_id.clone(),
            "deviceName": payload.device_name.clone(),
            "ip": effective_ip.clone(),
            "port": peer_port,
        });

        // Unminimize, show and focus window so the user clearly sees the incoming approval dialog
        if let Some(win) = handle.get_webview_window("main") {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
            let _ = win.emit("pairing-request", &event);
        }
        let _ = handle.emit("pairing-request", &event);

        // Update radar peer list in UI
        let all_peers: Vec<DiscoveredPeer> = {
            let peers = state.discovered_peers.read().await;
            peers.values().cloned().collect()
        };
        let _ = handle.emit("peers-update", &all_peers);
    }

    let device_id = payload.device_id.clone();
    let device_name = payload.device_name.clone();
    let auth_token = payload.auth_token.clone();

    match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
        Ok(Ok(true)) => {
            let token = auth_token.unwrap_or_else(|| {
                use rand::Rng;
                let mut rng = rand::rng();
                let bytes: Vec<u8> = (0..24).map(|_| rng.random()).collect();
                bytes.iter().map(|b| format!("{:02x}", b)).collect()
            });
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;

            let paired = PairedDevice {
                id: device_id.clone(),
                original_name: device_name.clone(),
                custom_name: device_name.clone(),
                ip: effective_ip.clone(),
                port: peer_port,
                remote_ip: payload.wan_ip,
                remote_port: payload.remote_port,
                paired_at: chrono_like_now(),
                last_seen: now,
                receive_enabled: Some(true),
                connection_mode: Some("local".to_string()),
                auth_token: Some(token.clone()),
                platform: None,
            };

            let (resp_device_id, resp_device_name) = {
                let mut cfg = state.config.write().await;
                cfg.paired_devices.retain(|d| d.id != device_id);
                cfg.paired_devices.push(paired);
                save_config(&cfg);
                (cfg.device_id.clone(), cfg.device_name.clone())
            };

            // Keep discovered_peers in sync
            {
                let mut peers = state.discovered_peers.write().await;
                peers.insert(
                    device_id.clone(),
                    DiscoveredPeer {
                        id: device_id.clone(),
                        name: device_name.clone(),
                        device_id: device_id.clone(),
                        device_name: device_name.clone(),
                        ip: effective_ip.clone(),
                        port: peer_port,
                        platform: Some(crate::discovery::guess_platform_from_name(&device_name).to_string()),
                        last_seen: now,
                        is_paired: true,
                    },
                );
            }

            if let Some(handle) = state.app_handle.read().await.as_ref() {
                let all_peers: Vec<DiscoveredPeer> = {
                    let peers = state.discovered_peers.read().await;
                    peers.values().cloned().collect()
                };
                let _ = handle.emit("peers-update", &all_peers);
            }

            state.logger.info("Pairing", &format!("Device \"{}\" successfully paired and saved", device_name), None);

            state.emit_status_changed().await;

            (StatusCode::OK, Json(serde_json::json!({
                "success": true,
                "deviceId": resp_device_id,
                "deviceName": resp_device_name,
                "authToken": token,
            }))).into_response()
        }
        Ok(Ok(false)) => {
            state.logger.warn("Security", &format!("Pairing request [{}] rejected by user", request_id), None);
            (StatusCode::FORBIDDEN, Json(serde_json::json!({
                "error": "Сопряжение отклонено пользователем"
            }))).into_response()
        }
        _ => {
            state.logger.warn("Security", &format!("Pairing request [{}] timed out waiting for approval", request_id), None);
            let mut map = state.pending_pairing_requests.lock().await;
            map.remove(&request_id);
            (StatusCode::REQUEST_TIMEOUT, Json(serde_json::json!({
                "error": "Время ожидания подтверждения сопряжения истекло"
            }))).into_response()
        }
    }
}

pub fn chrono_like_now() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("timestamp-{}", now)
}

async fn handle_upload(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    body: Body,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let sender_id = headers
        .get("x-device-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    let auth_token = headers
        .get("x-auth-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    // Verify paired device & token
    let (peer_name, target_folder) = {
        let cfg = state.config.read().await;
        let peer = cfg.paired_devices.iter().find(|d| d.id == sender_id);
        if peer.is_none() {
            state.logger.warn("Security", "Blocked upload from unpaired device", Some(sender_id.to_string()));
            return Err((StatusCode::UNAUTHORIZED, "Устройство не сопряжено".to_string()));
        }

        let peer = peer.unwrap();
        if peer.receive_enabled == Some(false) {
            return Err((StatusCode::FORBIDDEN, "Прием файлов отключен".to_string()));
        }

        if let Some(expected_token) = &peer.auth_token {
            if expected_token != auth_token {
                state.logger.warn("Security", "Invalid auth token in upload", Some(sender_id.to_string()));
                return Err((StatusCode::UNAUTHORIZED, "Неверный auth токен".to_string()));
            }
        }
        (peer.custom_name.clone(), cfg.target_folder.clone())
    };

    let raw_filename = headers
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("uploaded_file");

    let filename = urlencoding_decode(raw_filename);
    let rel_path = headers
        .get("x-relative-path")
        .and_then(|v| v.to_str().ok())
        .map(urlencoding_decode)
        .unwrap_or_default();

    let safe_target = get_safe_resolved_path(&target_folder, &rel_path, &filename)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Недопустимый путь файла".to_string()))?;

    let final_path = get_non_conflicting_path(safe_target);
    if let Some(parent) = final_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Stream body directly to disk
    let mut file = File::create(&final_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create file: {}", e)))?;

    let mut stream = body.into_data_stream();
    let mut bytes_transferred: u64 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| {
            let _ = fs::remove_file(&final_path);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Stream error: {}", e))
        })?;

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&final_path);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Write error: {}", e))
        })?;

        bytes_transferred += chunk.len() as u64;
    }

    let actual_name = final_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&filename)
        .to_string();

    // Add to history
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let history_entry = HistoryEntry {
        id: format!("{}-{}", now, bytes_transferred),
        filename: actual_name.clone(),
        size: bytes_transferred,
        timestamp: now,
        direction: "incoming".to_string(),
        status: "completed".to_string(),
        peer_device_id: sender_id.to_string(),
        peer_name,
    };

    state.history.write().await.push(history_entry);
    state.logger.info("Engine", &format!("Received file: {} ({} bytes)", actual_name, bytes_transferred), None);

    // Show native notification if enabled
    let cfg = state.config.read().await;
    if cfg.notifications {
        let _ = notify_rust::Notification::new()
            .summary("MacDrop: Файл получен!")
            .body(&format!("{} сохранён в папку", actual_name))
            .show();
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "filename": actual_name,
        "bytesReceived": bytes_transferred
    })))
}

fn urlencoding_decode(s: &str) -> String {
    let with_spaces = s.replace('+', " ");
    urlencoding::decode(&with_spaces)
        .map(|c| c.into_owned())
        .unwrap_or_else(|_| with_spaces)
}

// -----------------------------------------------------------------------------
// Mobile Web Drop Endpoints
// -----------------------------------------------------------------------------

#[derive(Deserialize)]
struct MobileQuery {
    token: Option<String>,
}

async fn handle_mobile_page(
    State(state): State<Arc<EngineState>>,
    Query(query): Query<MobileQuery>,
) -> Response {
    let current_token = state.mobile_token.read().await.clone();
    let is_authorized = query.token.as_ref() == Some(&current_token);

    if !is_authorized {
        return (
            StatusCode::UNAUTHORIZED,
            Html("<!DOCTYPE html><html><body style=\"background:#121214;color:#fff;font-family:sans-serif;padding:30px;text-align:center;\"><h2>401 Доступ запрещен</h2><p style=\"color:#a1a1aa;\">Недействительный или устаревший токен сессии MacDrop.<br>Отсканируйте QR-код в приложении заново.</p></body></html>".to_string())
        ).into_response();
    }

    state.mark_mobile_activity().await;

    let cfg = state.config.read().await;
    let html = crate::mobile_web::get_mobile_web_html(&cfg.device_name, &current_token);
    Html(html).into_response()
}

async fn handle_mobile_logo() -> impl IntoResponse {
    let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="M18 42 L24 22 L32 34 L40 22 L46 42" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>"##;
    ([(header::CONTENT_TYPE, "image/svg+xml")], svg)
}

async fn handle_mobile_status(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    Query(query): Query<MobileQuery>,
) -> Response {
    let current_token = state.mobile_token.read().await.clone();
    let token_header = headers.get("x-mobile-token").and_then(|v| v.to_str().ok());
    let is_authorized = query.token.as_deref() == Some(&current_token)
        || token_header == Some(&current_token);

    if !is_authorized {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    state.mark_mobile_activity().await;

    let cfg = state.config.read().await;
    Json(serde_json::json!({
        "status": "ok",
        "computerName": cfg.device_name,
        "deviceId": cfg.device_id
    })).into_response()
}

async fn handle_mobile_upload(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    Query(query): Query<MobileQuery>,
    body: Body,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let current_token = state.mobile_token.read().await.clone();
    let token_header = headers.get("x-mobile-token").and_then(|v| v.to_str().ok());
    let is_authorized = query.token.as_deref() == Some(&current_token)
        || token_header == Some(&current_token);

    if !is_authorized {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
    }

    let raw_filename = headers
        .get("x-filename")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("mobile_upload");

    let filename = urlencoding_decode(raw_filename);
    let cfg = state.config.read().await;
    let target_folder = cfg.target_folder.clone();
    drop(cfg);

    let safe_target = get_safe_resolved_path(&target_folder, "", &filename)
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Недопустимое имя файла".to_string()))?;

    let final_path = get_non_conflicting_path(safe_target);
    let mut file = File::create(&final_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("File create error: {}", e)))?;

    let mut stream = body.into_data_stream();
    let mut bytes_transferred: u64 = 0;

    while let Some(chunk_res) = stream.next().await {
        let chunk = chunk_res.map_err(|e| {
            let _ = fs::remove_file(&final_path);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Stream error: {}", e))
        })?;

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&final_path);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Write error: {}", e))
        })?;

        bytes_transferred += chunk.len() as u64;
    }

    let actual_name = final_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&filename)
        .to_string();

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    let history_entry = HistoryEntry {
        id: format!("{}-{}", now, bytes_transferred),
        filename: actual_name.clone(),
        size: bytes_transferred,
        timestamp: now,
        direction: "incoming".to_string(),
        status: "completed".to_string(),
        peer_device_id: "mobile-web".to_string(),
        peer_name: "Телефон (Web Drop)".to_string(),
    };

    state.history.write().await.push(history_entry);
    state.logger.info("Engine", &format!("Mobile uploaded file: {}", actual_name), None);
    state.mark_mobile_activity().await;
    state.emit_status_changed().await;

    Ok(Json(serde_json::json!({
        "success": true,
        "filename": actual_name
    })))
}

async fn handle_mobile_files(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    Query(query): Query<MobileQuery>,
) -> Response {
    let current_token = state.mobile_token.read().await.clone();
    let token_header = headers.get("x-mobile-token").and_then(|v| v.to_str().ok());
    let is_authorized = query.token.as_deref() == Some(&current_token)
        || token_header == Some(&current_token);

    if !is_authorized {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }

    state.mark_mobile_activity().await;

    let queue = state.mobile_queue.read().await;
    let files: Vec<serde_json::Value> = queue.iter().map(|item| {
        let secs = (item.mtime_ms / 1000) % 86400;
        let hours = (secs / 3600) % 24;
        let mins = (secs / 60) % 60;
        serde_json::json!({
            "name": item.filename,
            "size": item.size,
            "mtime": item.mtime_ms,
            "time": format!("{:02}:{:02}", hours, mins)
        })
    }).collect();

    Json(serde_json::json!({ "files": files })).into_response()
}

async fn handle_mobile_download(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    Query(query): Query<MobileQuery>,
    AxumPath(filename): AxumPath<String>,
) -> Result<Response, (StatusCode, String)> {
    let current_token = state.mobile_token.read().await.clone();
    let token_header = headers.get("x-mobile-token").and_then(|v| v.to_str().ok());
    let is_authorized = query.token.as_deref() == Some(&current_token)
        || token_header == Some(&current_token);

    if !is_authorized {
        return Err((StatusCode::UNAUTHORIZED, "Unauthorized".to_string()));
    }

    state.mark_mobile_activity().await;

    let decoded = urlencoding_decode(&filename);
    let queue = state.mobile_queue.read().await;
    let item = queue.iter().find(|i| i.filename == decoded);

    if let Some(entry) = item {
        let path = PathBuf::from(&entry.path);
        if !path.exists() {
            return Err((StatusCode::NOT_FOUND, "Файл не найден".to_string()));
        }

        let (content, dl_filename) = if path.is_dir() {
            let folder_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("folder");
            let temp_zip = std::env::temp_dir().join(format!("{}_{}.zip", folder_name, SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()));
            crate::transfer::zip_directory(&path, &temp_zip)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Zip error: {}", e)))?;
            let data = fs::read(&temp_zip)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Read error: {}", e)))?;
            let _ = fs::remove_file(&temp_zip);
            (data, format!("{}.zip", folder_name))
        } else {
            let data = fs::read(&path)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Read error: {}", e)))?;
            (data, decoded.clone())
        };

        let body = Body::from(content);
        let mut res = Response::new(body);
        let cd_header = format!("attachment; filename=\"{}\"", dl_filename.replace('"', "\\\""));
        if let Ok(val) = cd_header.parse() {
            res.headers_mut().insert(header::CONTENT_DISPOSITION, val);
        }
        res.headers_mut().insert(
            header::CONTENT_TYPE,
            "application/octet-stream".parse().unwrap(),
        );
        Ok(res)
    } else {
        Err((StatusCode::NOT_FOUND, "Файл не в очереди мобильной раздачи".to_string()))
    }
}

// -----------------------------------------------------------------------------
// HTTP Server Starter
// -----------------------------------------------------------------------------

pub async fn start_http_server(state: Arc<EngineState>) {
    let port = {
        let cfg = state.config.read().await;
        cfg.api_port
    };

    let app = Router::new()
        .route("/api/status", get(handle_status))
        .route("/api/ping", get(handle_status))
        .route("/api/pair", post(handle_pair))
        .route("/api/upload", post(handle_upload))
        .route("/mobile", get(handle_mobile_page))
        .route("/api/mobile/logo", get(handle_mobile_logo))
        .route("/api/mobile/status", get(handle_mobile_status))
        .route("/api/mobile/upload", post(handle_mobile_upload))
        .route("/api/mobile/files", get(handle_mobile_files))
        .route("/api/mobile/download/{filename}", get(handle_mobile_download))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    state.logger.info("Engine", &format!("Starting HTTP engine on port {}", port), None);

    let main_app = app.clone();
    let main_state = state.clone();
    tokio::spawn(async move {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                main_state.logger.info("Engine", &format!("HTTP engine listening on http://0.0.0.0:{}", port), None);
                let make_service = main_app.into_make_service_with_connect_info::<SocketAddr>();
                if let Err(err) = axum::serve(listener, make_service).await {
                    main_state.logger.error("Engine", &format!("HTTP server stopped with error: {}", err), None);
                }
            }
            Err(err) => {
                main_state.logger.error("Engine", &format!("Failed to bind TCP port {}: {}", port, err), None);
            }
        }
    });

    // Dual-port listening: if main port is not 8384, also listen on legacy port 8384 for backward compatibility
    if port != 8384 {
        let legacy_addr = SocketAddr::from(([0, 0, 0, 0], 8384));
        let legacy_app = app.clone();
        let legacy_state = state.clone();
        tokio::spawn(async move {
            match tokio::net::TcpListener::bind(legacy_addr).await {
                Ok(listener) => {
                    legacy_state.logger.info("Engine", "Legacy HTTP compatibility engine listening on http://0.0.0.0:8384", None);
                    let make_service = legacy_app.into_make_service_with_connect_info::<SocketAddr>();
                    let _ = axum::serve(listener, make_service).await;
                }
                Err(_) => {
                    // Port 8384 might already be in use by another instance or service; silently ignore
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_blocked() {
        let target = "/tmp/MacDrop";
        // Attempt relative path traversal
        assert!(get_safe_resolved_path(target, "../../../etc", "passwd").is_none());
        assert!(get_safe_resolved_path(target, "..", "secret.txt").is_none());
    }

    #[test]
    fn test_valid_path_resolution() {
        let target = "/tmp/MacDrop";
        let resolved = get_safe_resolved_path(target, "subfolder", "photo.jpg");
        assert!(resolved.is_some());
        let path = resolved.unwrap();
        assert!(path.to_string_lossy().contains("subfolder"));
        assert!(path.to_string_lossy().ends_with("photo.jpg"));
    }

    #[test]
    fn test_non_conflicting_path() {
        let temp_dir = std::env::temp_dir().join("macdrop_test_conflict");
        let _ = fs::create_dir_all(&temp_dir);
        let orig_file = temp_dir.join("document.pdf");
        let _ = fs::write(&orig_file, b"test");

        // First conflict should become document (1).pdf
        let conflict1 = get_non_conflicting_path(orig_file.clone());
        assert_eq!(conflict1.file_name().unwrap(), "document (1).pdf");
        let _ = fs::write(&conflict1, b"test2");

        // Second conflict should become document (2).pdf
        let conflict2 = get_non_conflicting_path(orig_file);
        assert_eq!(conflict2.file_name().unwrap(), "document (2).pdf");

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_urlencoding_decode() {
        assert_eq!(urlencoding_decode("hello%20world.txt"), "hello world.txt");
        assert_eq!(urlencoding_decode("file+name.pdf"), "file name.pdf");
        assert_eq!(urlencoding_decode("normal.png"), "normal.png");

        let cyrillic_raw = "Документ [версия 2.0] & правки.docx";
        let encoded = urlencoding::encode(cyrillic_raw);
        assert_eq!(urlencoding_decode(&encoded), cyrillic_raw);
    }

    #[tokio::test]
    async fn test_mobile_session_and_virtual_device() {
        let cfg = AppConfig {
            target_folder: "/tmp/MacDrop".to_string(),
            auto_start: false,
            notifications: true,
            language: Some("ru".to_string()),
            device_id: "MAC-TEST1".to_string(),
            device_name: "Test Mac".to_string(),
            paired_devices: vec![],
            api_port: 52520,
            api_key: "test_key".to_string(),
            upnp_enabled: Some(false),
            wan_ip: None,
            custom_remote_host: None,
        };
        let logger = AppLogger::new();
        let state = EngineState::new(cfg, logger);

        // Initially inactive
        assert!(!state.is_mobile_session_active().await);
        let status = state.get_status().await;
        assert!(status.paired_devices.iter().all(|d| d.id != "mobile-web"));

        // Activity marked
        state.mark_mobile_activity().await;
        assert!(state.is_mobile_session_active().await);
        let status_active = state.get_status().await;
        let mobile_dev = status_active.paired_devices.iter().find(|d| d.id == "mobile-web");
        assert!(mobile_dev.is_some());
        assert_eq!(mobile_dev.unwrap().custom_name, "Телефон (Web Drop)");
        assert_eq!(mobile_dev.unwrap().port, 52520);

        // Regenerate token resets activity
        state.regenerate_mobile_session_token().await;
        assert!(!state.is_mobile_session_active().await);
        let status_reset = state.get_status().await;
        assert!(status_reset.paired_devices.iter().all(|d| d.id != "mobile-web"));
    }
}

