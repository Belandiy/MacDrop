use axum::{
    body::Body,
    extract::{Path as AxumPath, Query, State},
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPeer {
    pub id: String,
    pub name: String,
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
    pub discovered_peers: Arc<RwLock<HashMap<String, DiscoveredPeer>>>,
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
            discovered_peers: Arc::new(RwLock::new(HashMap::new())),
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: tauri::AppHandle) {
        if let Ok(mut h) = self.app_handle.try_write() {
            *h = Some(handle);
        }
    }

    pub async fn get_status(&self) -> EngineStatus {
        let cfg = self.config.read().await;
        let active = if self.current_progress.read().await.is_some() { 1 } else { 0 };
        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        EngineStatus {
            is_discoverable: true,
            active_transfers: active,
            ip: local_ip,
            port: cfg.api_port,
            device_name: cfg.device_name.clone(),
            device_id: cfg.device_id.clone(),
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
    port: Option<u16>,
    #[serde(rename = "authToken")]
    auth_token: Option<String>,
}

#[derive(Serialize)]
struct PairingResponse {
    success: bool,
    #[serde(rename = "deviceId")]
    device_id: String,
    #[serde(rename = "deviceName")]
    device_name: String,
    #[serde(rename = "authToken")]
    auth_token: String,
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
    State(state): State<Arc<EngineState>>,
    Json(payload): Json<PairingPayload>,
) -> impl IntoResponse {
    let mut cfg = state.config.write().await;
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

    // Check if peer is already paired
    if let Some(existing) = cfg.paired_devices.iter_mut().find(|d| d.id == payload.device_id) {
        existing.original_name = payload.device_name.clone();
        existing.port = payload.port.unwrap_or(8384);
        existing.auth_token = Some(token.clone());
        existing.last_seen = now;
    } else {
        cfg.paired_devices.push(PairedDevice {
            id: payload.device_id.clone(),
            original_name: payload.device_name.clone(),
            custom_name: payload.device_name.clone(),
            ip: "127.0.0.1".to_string(), // Will be updated on actual socket ping
            port: payload.port.unwrap_or(8384),
            remote_ip: None,
            remote_port: None,
            paired_at: chrono_like_now(),
            last_seen: now,
            receive_enabled: Some(true),
            connection_mode: Some("local".to_string()),
            auth_token: Some(token.clone()),
            platform: None,
        });
    }

    save_config(&cfg);

    Json(PairingResponse {
        success: true,
        device_id: cfg.device_id.clone(),
        device_name: cfg.device_name.clone(),
        auth_token: token,
    })
}

fn chrono_like_now() -> String {
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
    // Simple decoding or percent_encoding
    let mut res = String::with_capacity(s.len());
    let mut bytes = s.bytes();
    while let Some(b) = bytes.next() {
        if b == b'%' {
            let h1 = bytes.next().unwrap_or(b'0');
            let h2 = bytes.next().unwrap_or(b'0');
            let hex_str = format!("{}{}", h1 as char, h2 as char);
            if let Ok(num) = u8::from_str_radix(&hex_str, 16) {
                res.push(num as char);
            }
        } else if b == b'+' {
            res.push(' ');
        } else {
            res.push(b as char);
        }
    }
    res
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

    let cfg = state.config.read().await;
    let html = get_mobile_html(&cfg.device_name, &current_token);
    Html(html).into_response()
}

async fn handle_mobile_status(
    State(state): State<Arc<EngineState>>,
) -> impl IntoResponse {
    let cfg = state.config.read().await;
    Json(serde_json::json!({
        "status": "ok",
        "computerName": cfg.device_name,
        "deviceId": cfg.device_id
    }))
}

async fn handle_mobile_upload(
    State(state): State<Arc<EngineState>>,
    headers: HeaderMap,
    body: Body,
) -> Result<impl IntoResponse, (StatusCode, String)> {
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

    Ok(Json(serde_json::json!({
        "success": true,
        "filename": actual_name
    })))
}

async fn handle_mobile_files(
    State(state): State<Arc<EngineState>>,
) -> impl IntoResponse {
    let queue = state.mobile_queue.read().await;
    let files: Vec<serde_json::Value> = queue.iter().map(|item| {
        serde_json::json!({
            "name": item.filename,
            "size": item.size,
            "mtime": item.mtime_ms,
            "time": format!("{}:{:02}", (item.mtime_ms / 3600000) % 24, (item.mtime_ms / 60000) % 60)
        })
    }).collect();

    Json(serde_json::json!({ "files": files }))
}

async fn handle_mobile_download(
    State(state): State<Arc<EngineState>>,
    AxumPath(filename): AxumPath<String>,
) -> Result<Response, (StatusCode, String)> {
    let decoded = urlencoding_decode(&filename);
    let queue = state.mobile_queue.read().await;
    let item = queue.iter().find(|i| i.filename == decoded);

    if let Some(entry) = item {
        let path = PathBuf::from(&entry.path);
        if !path.exists() {
            return Err((StatusCode::NOT_FOUND, "Файл не найден".to_string()));
        }

        let content = fs::read(&path)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Read error: {}", e)))?;

        let body = Body::from(content);
        let mut res = Response::new(body);
        res.headers_mut().insert(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", decoded).parse().unwrap(),
        );
        res.headers_mut().insert(
            header::CONTENT_TYPE,
            "application/octet-stream".parse().unwrap(),
        );
        Ok(res)
    } else {
        Err((StatusCode::NOT_FOUND, "Файл не в очереди мобильной раздачи".to_string()))
    }
}

fn get_mobile_html(device_name: &str, token: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>MacDrop Mobile - {device_name}</title>
  <style>
    body {{ background:#0e1017; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,sans-serif; margin:0; padding:20px; }}
    .card {{ background:#161922; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; text-align:center; }}
    .btn {{ background:linear-gradient(135deg,#6366f1,#3b82f6); color:#fff; border:none; padding:14px 24px; border-radius:12px; font-weight:600; font-size:16px; cursor:pointer; width:100%; box-sizing:border-box; margin-top:16px; }}
    h1 {{ font-size:20px; margin:0 0 8px 0; }}
    p {{ color:#94a3b8; font-size:14px; margin:0 0 20px 0; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>MacDrop Web Drop</h1>
    <p>Подключено к: <strong>{device_name}</strong></p>
    <input type="file" id="fileInput" multiple style="display:none;" onchange="uploadFiles(this.files)">
    <button class="btn" onclick="document.getElementById('fileInput').click()">Отправить файлы на Mac</button>
    <div id="status" style="margin-top:15px; font-size:14px; color:#60a5fa;"></div>
  </div>
  <script>
    async function uploadFiles(files) {{
      if (!files || files.length === 0) return;
      const statusDiv = document.getElementById('status');
      for (const file of files) {{
        statusDiv.innerText = 'Отправка ' + file.name + '...';
        try {{
          const res = await fetch('/api/mobile/upload', {{
            method: 'POST',
            headers: {{
              'x-filename': encodeURIComponent(file.name),
              'x-mobile-token': '{token}'
            }},
            body: file
          }});
          if (res.ok) {{
            statusDiv.innerText = '✓ ' + file.name + ' отправлен!';
          }} else {{
            statusDiv.innerText = 'Ошибка отправки: ' + res.statusText;
          }}
        }} catch (err) {{
          statusDiv.innerText = 'Сбой сети: ' + err.message;
        }}
      }}
    }}
  </script>
</body>
</html>"#,
        device_name = device_name,
        token = token
    )
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
        .route("/api/mobile/status", get(handle_mobile_status))
        .route("/api/mobile/upload", post(handle_mobile_upload))
        .route("/api/mobile/files", get(handle_mobile_files))
        .route("/api/mobile/download/{filename}", get(handle_mobile_download))
        .layer(CorsLayer::permissive())
        .with_state(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    state.logger.info("Engine", &format!("Starting HTTP engine on port {}", port), None);

    tokio::spawn(async move {
        match tokio::net::TcpListener::bind(addr).await {
            Ok(listener) => {
                state.logger.info("Engine", &format!("HTTP engine listening on http://0.0.0.0:{}", port), None);
                if let Err(err) = axum::serve(listener, app).await {
                    state.logger.error("Engine", &format!("HTTP server stopped with error: {}", err), None);
                }
            }
            Err(err) => {
                state.logger.error("Engine", &format!("Failed to bind TCP port {}: {}", port, err), None);
            }
        }
    });
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
    }
}

