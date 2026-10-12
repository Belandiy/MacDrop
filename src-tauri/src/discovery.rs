use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tokio::net::UdpSocket;

use crate::engine::{DiscoveredPeer, EngineState};

pub const BROADCAST_PORT: u16 = 8385;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryMessage {
    pub device_id: String,
    pub device_name: String,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(default)]
    pub reply: bool,
}

pub fn guess_platform_from_name(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.contains("mac") || lower.contains("apple") || lower.contains("darwin") {
        "darwin"
    } else if lower.starts_with("desktop-")
        || lower.starts_with("win-")
        || lower.starts_with("laptop-")
        || lower.contains("pc")
        || lower.contains("windows")
    {
        "win32"
    } else {
        if cfg!(target_os = "macos") {
            "darwin"
        } else {
            "win32"
        }
    }
}

pub fn get_broadcast_addrs() -> Vec<SocketAddr> {
    let mut addrs = vec!["255.255.255.255:8385".parse().unwrap()];
    if let Ok(ip) = local_ip_address::local_ip() {
        if let std::net::IpAddr::V4(ipv4) = ip {
            let octets = ipv4.octets();
            let bcast_ip = std::net::Ipv4Addr::new(octets[0], octets[1], octets[2], 255);
            let bcast_sock = SocketAddr::new(std::net::IpAddr::V4(bcast_ip), BROADCAST_PORT);
            if !addrs.contains(&bcast_sock) {
                addrs.push(bcast_sock);
            }
        }
    }
    addrs
}

pub async fn start_peer_discovery(state: Arc<EngineState>) {
    let bind_addr: SocketAddr = "0.0.0.0:8385".parse().unwrap();
    let socket = match UdpSocket::bind(bind_addr).await {
        Ok(s) => {
            let _ = s.set_broadcast(true);
            Arc::new(s)
        }
        Err(e) => {
            state.logger.warn("Discovery", "Failed to bind UDP port 8385", Some(e.to_string()));
            return;
        }
    };

    state.logger.info("Discovery", "UDP Peer Discovery running on port 8385", None);

    // 1. Background task for broadcasting presence
    let broadcast_socket = socket.clone();
    let broadcast_state = state.clone();
    tokio::spawn(async move {
        loop {
            let (device_id, device_name, port) = {
                let cfg = broadcast_state.config.read().await;
                (cfg.device_id.clone(), cfg.device_name.clone(), cfg.api_port)
            };

            let platform_str = if cfg!(target_os = "macos") { "darwin" } else { "win32" };
            let msg = DiscoveryMessage {
                device_id,
                device_name,
                port,
                platform: Some(platform_str.to_string()),
                reply: false,
            };

            if let Ok(json) = serde_json::to_string(&msg) {
                for bcast in get_broadcast_addrs() {
                    let _ = broadcast_socket.send_to(json.as_bytes(), bcast).await;
                }
            }

            tokio::time::sleep(Duration::from_millis(2500)).await;
        }
    });

    // 2. Incoming listener loop
    let mut buf = [0u8; 2048];
    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, remote_addr)) => {
                if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                    if let Ok(msg) = serde_json::from_str::<DiscoveryMessage>(text) {
                        let (our_id, our_name, our_port) = {
                            let cfg = state.config.read().await;
                            (cfg.device_id.clone(), cfg.device_name.clone(), cfg.api_port)
                        };

                        if msg.device_id == our_id {
                            continue;
                        }

                        let platform = msg
                            .platform
                            .unwrap_or_else(|| guess_platform_from_name(&msg.device_name).to_string());

                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;

                        let clean_ip = remote_addr.ip().to_string();
                        let is_paired = {
                            let cfg = state.config.read().await;
                            cfg.paired_devices.iter().any(|d| d.id == msg.device_id)
                        };

                        let peer = DiscoveredPeer {
                            id: msg.device_id.clone(),
                            name: msg.device_name.clone(),
                            device_id: msg.device_id.clone(),
                            device_name: msg.device_name.clone(),
                            ip: clean_ip,
                            port: msg.port,
                            platform: Some(platform),
                            last_seen: now,
                            is_paired,
                        };

                        // Send direct unicast reply immediately if it wasn't a reply
                        if !msg.reply {
                            let platform_str = if cfg!(target_os = "macos") { "darwin" } else { "win32" };
                            let reply_msg = DiscoveryMessage {
                                device_id: our_id,
                                device_name: our_name,
                                port: our_port,
                                platform: Some(platform_str.to_string()),
                                reply: true,
                            };
                            if let Ok(reply_json) = serde_json::to_string(&reply_msg) {
                                let _ = socket.send_to(reply_json.as_bytes(), remote_addr).await;
                            }
                        }

                        // Update in-memory peers map
                        {
                            let mut peers = state.discovered_peers.write().await;
                            peers.insert(msg.device_id.clone(), peer);
                            // Bounded capacity to prevent DoS
                            if peers.len() > 100 {
                                if let Some(oldest) = peers.keys().next().cloned() {
                                    peers.remove(&oldest);
                                }
                            }
                        }

                        // Broadcast to React frontend window
                        let all_peers: Vec<DiscoveredPeer> = {
                            let peers = state.discovered_peers.read().await;
                            peers.values().cloned().collect()
                        };

                        if let Some(handle) = state.app_handle.read().await.as_ref() {
                            let _ = handle.emit("peers-update", &all_peers);
                        }
                    }
                }
            }
            Err(e) => {
                state.logger.warn("Discovery", "Error receiving UDP packet", Some(e.to_string()));
            }
        }
    }
}

pub async fn trigger_manual_scan(state: &EngineState) {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0").await {
        let _ = socket.set_broadcast(true);
        let (device_id, device_name, port) = {
            let cfg = state.config.read().await;
            (cfg.device_id.clone(), cfg.device_name.clone(), cfg.api_port)
        };
        let platform_str = if cfg!(target_os = "macos") { "darwin" } else { "win32" };
        let msg = DiscoveryMessage {
            device_id,
            device_name,
            port,
            platform: Some(platform_str.to_string()),
            reply: false,
        };
        if let Ok(json) = serde_json::to_string(&msg) {
            for bcast in get_broadcast_addrs() {
                let _ = socket.send_to(json.as_bytes(), bcast).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guess_platform() {
        assert_eq!(guess_platform_from_name("Andrey's MacBook Pro"), "darwin");
        assert_eq!(guess_platform_from_name("iMac-LivingRoom"), "darwin");
        assert_eq!(guess_platform_from_name("DESKTOP-ABC123"), "win32");
        assert_eq!(guess_platform_from_name("Gaming-PC"), "win32");
    }

    #[test]
    fn test_discovery_message_serde() {
        let msg = DiscoveryMessage {
            device_id: "MAC-1234".to_string(),
            device_name: "MacBook Air".to_string(),
            port: 8384,
            platform: Some("darwin".to_string()),
            reply: false,
        };
        let json = serde_json::to_string(&msg).expect("Serialize");
        assert!(json.contains("deviceId"));
        assert!(json.contains("MAC-1234"));

        let parsed: DiscoveryMessage = serde_json::from_str(&json).expect("Deserialize");
        assert_eq!(parsed.device_id, "MAC-1234");
        assert_eq!(parsed.port, 8384);
    }
}
