use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::engine::{EngineState, HistoryEntry, TransferProgress};

pub fn zip_directory(src_dir: &Path, dst_file: &Path) -> Result<u64, String> {
    let file = File::create(dst_file).map_err(|e| format!("Failed to create zip: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut buffer = Vec::new();

    fn add_dir_to_zip(
        dir: &Path,
        prefix: &Path,
        zip: &mut ZipWriter<File>,
        options: SimpleFileOptions,
        buffer: &mut Vec<u8>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            let name = path.strip_prefix(prefix).map_err(|e| e.to_string())?;

            if path.is_file() {
                let name_str = name.to_string_lossy().to_string();
                zip.start_file(name_str, options).map_err(|e| e.to_string())?;
                let mut f = File::open(&path).map_err(|e| e.to_string())?;
                buffer.clear();
                f.read_to_end(buffer).map_err(|e| e.to_string())?;
                zip.write_all(buffer).map_err(|e| e.to_string())?;
            } else if path.is_dir() {
                let name_str = format!("{}/", name.to_string_lossy());
                zip.add_directory(name_str, options).map_err(|e| e.to_string())?;
                add_dir_to_zip(&path, prefix, zip, options, buffer)?;
            }
        }
        Ok(())
    }

    add_dir_to_zip(src_dir, src_dir, &mut zip, options, &mut buffer)?;
    zip.finish().map_err(|e| e.to_string())?;

    let meta = fs::metadata(dst_file).map_err(|e| e.to_string())?;
    Ok(meta.len())
}

pub async fn execute_peer_transfer(
    state: Arc<EngineState>,
    file_paths: Vec<String>,
    target_device_id: Option<String>,
) -> Result<bool, String> {
    if target_device_id.as_deref() == Some("mobile-web") {
        for path_str in file_paths {
            let path = PathBuf::from(&path_str);
            if !path.exists() {
                continue;
            }

            let is_dir = path.is_dir();
            let (send_path, send_filename) = if is_dir {
                let folder_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("folder");
                let temp_zip = std::env::temp_dir().join(format!("{}_{}.zip", folder_name, SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()));
                zip_directory(&path, &temp_zip)?;
                let zip_name = format!("{}.zip", folder_name);
                (temp_zip, zip_name)
            } else {
                let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("file").to_string();
                (path.clone(), name)
            };

            let file_meta = fs::metadata(&send_path).map_err(|e| e.to_string())?;
            let total_size = file_meta.len();

            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;

            // Add to mobile queue for immediate download from phone
            {
                let mut queue = state.mobile_queue.write().await;
                queue.insert(0, crate::engine::MobileFileQueueItem {
                    filename: send_filename.clone(),
                    path: send_path.to_string_lossy().to_string(),
                    size: total_size,
                    mtime_ms: now,
                });
            }

            // Simulate progress update for UI feedback
            {
                let mut prog = state.current_progress.write().await;
                *prog = Some(TransferProgress::new(
                    send_filename.clone(),
                    total_size,
                    total_size,
                    total_size as f64,
                    "outgoing".to_string(),
                    "mobile-web".to_string(),
                    "Телефон (Web Drop)".to_string(),
                ));
            }

            if let Some(handle) = state.app_handle.read().await.as_ref() {
                let prog = state.current_progress.read().await.clone();
                let _ = handle.emit("progress-update", &prog);
            }

            // Record in history
            let entry = HistoryEntry {
                id: format!("{}-{}", now, total_size),
                filename: send_filename,
                size: total_size,
                timestamp: now,
                direction: "outgoing".to_string(),
                status: "completed".to_string(),
                peer_device_id: "mobile-web".to_string(),
                peer_name: "Телефон (Web Drop)".to_string(),
            };

            state.history.write().await.push(entry);
            state.mark_mobile_activity().await;

            // Clear progress after brief feedback
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            {
                let mut prog = state.current_progress.write().await;
                *prog = None;
            }
            if let Some(handle) = state.app_handle.read().await.as_ref() {
                let _ = handle.emit("progress-update", &None::<TransferProgress>);
            }
        }

        state.emit_status_changed().await;
        return Ok(true);
    }
fn format_error_chain(e: &(dyn std::error::Error + 'static)) -> String {
    let mut parts = vec![e.to_string()];
    let mut curr = e.source();
    while let Some(src) = curr {
        parts.push(src.to_string());
        curr = src.source();
    }
    parts.join(" -> ")
}

    let (target_ip, target_port, auth_token, peer_name, peer_id, remote_ip, remote_port) = {
        let cfg = state.config.read().await;
        let discovered = state.discovered_peers.read().await;

        if let Some(ref tid) = target_device_id {
            if let Some(paired) = cfg.paired_devices.iter().find(|d| &d.id == tid) {
                // If peer is actively discovered, prefer latest live IP and port
                let (ip, port) = if let Some(disc) = discovered.get(tid) {
                    (disc.ip.clone(), disc.port)
                } else {
                    (paired.ip.clone(), paired.port)
                };
                (ip, port, paired.auth_token.clone(), paired.custom_name.clone(), paired.id.clone(), paired.remote_ip.clone(), paired.remote_port)
            } else if let Some(peer) = discovered.get(tid) {
                (peer.ip.clone(), peer.port, None, peer.name.clone(), peer.id.clone(), None, None)
            } else {
                return Err("Целевое устройство не найдено".to_string());
            }
        } else if let Some(first_paired) = cfg.paired_devices.first() {
            let (ip, port) = if let Some(disc) = discovered.get(&first_paired.id) {
                (disc.ip.clone(), disc.port)
            } else {
                (first_paired.ip.clone(), first_paired.port)
            };
            (ip, port, first_paired.auth_token.clone(), first_paired.custom_name.clone(), first_paired.id.clone(), first_paired.remote_ip.clone(), first_paired.remote_port)
        } else {
            return Err("Нет подключенных устройств для передачи".to_string());
        }
    };

    let client = reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(3600))
        .build()
        .map_err(|e| e.to_string())?;

    let our_device_id = {
        let cfg = state.config.read().await;
        cfg.device_id.clone()
    };

    for path_str in file_paths {
        let path = PathBuf::from(&path_str);
        if !path.exists() {
            continue;
        }

        let is_dir = path.is_dir();
        let (send_path, send_filename, is_temp) = if is_dir {
            let folder_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("folder");
            let temp_zip = std::env::temp_dir().join(format!("{}_{}.zip", folder_name, SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()));
            zip_directory(&path, &temp_zip)?;
            let zip_name = format!("{}.zip", folder_name);
            (temp_zip, zip_name, true)
        } else {
            let name = path.file_name().and_then(|s| s.to_str()).unwrap_or("file").to_string();
            (path.clone(), name, false)
        };

        let file_meta = fs::metadata(&send_path).map_err(|e| e.to_string())?;
        let total_size = file_meta.len();

        let mut file = File::open(&send_path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;

        // Update initial progress
        {
            let mut prog = state.current_progress.write().await;
            *prog = Some(TransferProgress::new(
                send_filename.clone(),
                0,
                total_size,
                0.0,
                "outgoing".to_string(),
                peer_id.clone(),
                peer_name.clone(),
            ));
        }

        if let Some(handle) = state.app_handle.read().await.as_ref() {
            let prog = state.current_progress.read().await.clone();
            let _ = handle.emit("progress-update", &prog);
        }

        let alt_port = if target_port == 52520 { 8384 } else { 52520 };

        // Progressive retry attempts across all candidate endpoints:
        // (ip, port, delay_before_attempt_ms, label)
        let mut attempts = Vec::new();
        attempts.push((target_ip.clone(), target_port, 0u64, "primary_initial"));
        attempts.push((target_ip.clone(), target_port, 500u64, "primary_retry"));
        attempts.push((target_ip.clone(), alt_port, 700u64, "alt_port"));
        if let Some(ref rip) = remote_ip {
            if rip != &target_ip && !rip.is_empty() {
                let rport = remote_port.unwrap_or(target_port);
                attempts.push((rip.clone(), rport, 800u64, "remote_ip"));
            }
        }
        attempts.push((target_ip.clone(), target_port, 1000u64, "primary_final"));

        let mut upload_success = false;
        let mut last_err_desc = String::new();

        for (attempt_idx, (curr_ip, curr_port, delay_ms, label)) in attempts.into_iter().enumerate() {
            if delay_ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }

            // Check if peer announced a newer live IP while we were retrying
            let effective_ip = {
                let discovered = state.discovered_peers.read().await;
                if let Some(disc) = discovered.get(&peer_id) {
                    disc.ip.clone()
                } else {
                    curr_ip
                }
            };

            let url = format!("http://{}:{}/api/upload", effective_ip, curr_port);
            let mut req = client
                .post(&url)
                .header("x-device-id", &our_device_id)
                .header("x-filename", urlencoding::encode(&send_filename).as_ref())
                .body(buffer.clone());

            if let Some(ref tok) = auth_token {
                req = req.header("x-auth-token", tok);
            }

            match req.send().await {
                Ok(resp) => {
                    let st = resp.status();
                    if st.is_success() {
                        upload_success = true;
                        state.logger.info(
                            "Transfer",
                            &format!("File \"{}\" sent successfully to {}:{} ({})", send_filename, effective_ip, curr_port, label),
                            Some(format!("Target: {}:{}", effective_ip, curr_port)),
                        );

                        // If working port or IP changed, persist to config
                        let mut cfg = state.config.write().await;
                        if let Some(p) = cfg.paired_devices.iter_mut().find(|d| d.id == peer_id) {
                            if p.ip != effective_ip || p.port != curr_port {
                                p.ip = effective_ip.clone();
                                p.port = curr_port;
                                crate::config::save_config(&cfg);
                            }
                        }
                        break;
                    } else {
                        let err_body = resp.text().await.unwrap_or_default();
                        last_err_desc = format!("HTTP {} ({})", st, err_body);
                        state.logger.warn(
                            "Transfer",
                            &format!("Upload attempt #{} ({}) to {}:{} rejected: {}", attempt_idx + 1, label, effective_ip, curr_port, last_err_desc),
                            Some(format!("Target: {}:{}", effective_ip, curr_port)),
                        );
                    }
                }
                Err(e) => {
                    last_err_desc = format_error_chain(&e);
                    state.logger.warn(
                        "Transfer",
                        &format!("Upload attempt #{} ({}) to {}:{} failed: {}", attempt_idx + 1, label, effective_ip, curr_port, last_err_desc),
                        Some(format!("Target: {}:{}", effective_ip, curr_port)),
                    );
                }
            }
        }

        if is_temp {
            let _ = fs::remove_file(&send_path);
        }

        let success = upload_success;
        if !success {
            state.logger.error(
                "Transfer",
                &format!("Failed to send file \"{}\": {}", send_filename, last_err_desc),
                Some(format!("Target: {}:{}", target_ip, target_port)),
            );
        }

        if success {
            {
                let mut prog = state.current_progress.write().await;
                *prog = Some(TransferProgress::new(
                    send_filename.clone(),
                    total_size,
                    total_size,
                    0.0,
                    "outgoing".to_string(),
                    peer_id.clone(),
                    peer_name.clone(),
                ));
            }
            if let Some(handle) = state.app_handle.read().await.as_ref() {
                let prog = state.current_progress.read().await.clone();
                let _ = handle.emit("progress-update", &prog);
            }
            tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        }

        // Show native notification if enabled in settings
        {
            let cfg = state.config.read().await;
            if cfg.notifications {
                if success {
                    crate::engine::show_desktop_notification(
                        "MacDrop: Файл отправлен",
                        &format!("\"{}\" успешно передан на {}", send_filename, peer_name),
                    );
                } else {
                    crate::engine::show_desktop_notification(
                        "MacDrop: Ошибка передачи",
                        &format!("Не удалось отправить \"{}\" на {}. Проверьте, что приложение включено.", send_filename, peer_name),
                    );
                }
            }
        }

        // Clear progress
        {
            let mut prog = state.current_progress.write().await;
            *prog = None;
        }

        if let Some(handle) = state.app_handle.read().await.as_ref() {
            let _ = handle.emit("progress-update", &None::<TransferProgress>);
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let entry = HistoryEntry {
            id: format!("{}-{}", now, total_size),
            filename: send_filename,
            size: total_size,
            timestamp: now,
            direction: "outgoing".to_string(),
            status: if success { "completed".to_string() } else { "failed".to_string() },
            peer_device_id: peer_id.clone(),
            peer_name: peer_name.clone(),
        };

        state.history.write().await.push(entry);
        state.emit_status_changed().await;

        if is_temp {
            let _ = fs::remove_file(&send_path);
        }
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zip_directory() {
        let temp_base = std::env::temp_dir().join("macdrop_test_zip_src");
        let _ = fs::create_dir_all(&temp_base);
        let sub = temp_base.join("nested");
        let _ = fs::create_dir_all(&sub);

        fs::write(temp_base.join("hello.txt"), b"Hello World").expect("write");
        fs::write(sub.join("nested.txt"), b"Nested content").expect("write");

        let zip_out = std::env::temp_dir().join("macdrop_test_out.zip");
        let res = zip_directory(&temp_base, &zip_out);
        assert!(res.is_ok());
        let size = res.unwrap();
        assert!(size > 0);
        assert!(zip_out.exists());

        // Clean up
        let _ = fs::remove_dir_all(&temp_base);
        let _ = fs::remove_file(&zip_out);
    }

    #[tokio::test]
    async fn test_transfer_to_mobile_web() {
        let temp_dir = std::env::temp_dir().join("macdrop_test_mobile_transfer");
        let _ = fs::create_dir_all(&temp_dir);
        let test_file = temp_dir.join("sample.pdf");
        fs::write(&test_file, b"Dummy PDF content").expect("write");

        let cfg = crate::config::AppConfig {
            target_folder: temp_dir.to_string_lossy().to_string(),
            auto_start: false,
            notifications: false,
            language: None,
            device_id: "MAC-TEST-X".to_string(),
            device_name: "MacBook Test".to_string(),
            paired_devices: vec![],
            api_port: 52520,
            api_key: "key".to_string(),
            upnp_enabled: None,
            wan_ip: None,
            custom_remote_host: None,
        };
        let logger = crate::logger::AppLogger::new();
        let state = Arc::new(EngineState::new(cfg, logger));

        let res = execute_peer_transfer(
            state.clone(),
            vec![test_file.to_string_lossy().to_string()],
            Some("mobile-web".to_string()),
        ).await;

        assert!(res.is_ok());
        assert!(res.unwrap());

        // Check mobile queue item
        let queue = state.mobile_queue.read().await;
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].filename, "sample.pdf");

        // Check history
        let hist = state.history.read().await;
        assert_eq!(hist.len(), 1);
        assert_eq!(hist[0].peer_device_id, "mobile-web");
        assert_eq!(hist[0].status, "completed");

        // Clean up
        let _ = fs::remove_dir_all(&temp_dir);
    }
}

