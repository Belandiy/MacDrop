use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairedDevice {
    pub id: String,
    pub original_name: String,
    pub custom_name: String,
    pub ip: String,
    pub port: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_port: Option<u16>,
    pub paired_at: String,
    pub last_seen: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub receive_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connection_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub target_folder: String,
    pub auto_start: bool,
    pub notifications: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    pub device_id: String,
    pub device_name: String,
    #[serde(default)]
    pub paired_devices: Vec<PairedDevice>,
    pub api_port: u16,
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upnp_enabled: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wan_ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_remote_host: Option<String>,
}

pub fn get_config_dir() -> PathBuf {
    // 1. Try system data directory (e.g. ~/Library/Application Support/MacDrop on macOS)
    if let Some(mut dir) = dirs::data_dir() {
        dir.push("MacDrop");
        return dir;
    }
    // 2. Fallback to ~/.macdrop
    if let Some(mut home) = dirs::home_dir() {
        home.push(".macdrop");
        return home;
    }
    PathBuf::from("./macdrop_config")
}

pub fn get_config_file_path() -> PathBuf {
    let mut path = get_config_dir();
    path.push("settings.json");
    path
}

pub fn get_default_folder() -> String {
    #[cfg(target_os = "windows")]
    {
        if Path::new("E:\\").exists() {
            return "E:\\MacDrop".to_string();
        }
        if let Some(mut home) = dirs::home_dir() {
            home.push("MacDrop");
            return home.to_string_lossy().to_string();
        }
        "C:\\MacDrop".to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Some(mut home) = dirs::home_dir() {
            home.push("MacDrop");
            return home.to_string_lossy().to_string();
        }
        "./MacDrop".to_string()
    }
}

pub fn generate_random_key(len: usize) -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    let bytes: Vec<u8> = (0..len).map(|_| rng.random()).collect();
    let hex_chars: Vec<String> = bytes.iter().map(|b| format!("{:02x}", b)).collect();
    let full = hex_chars.join("");
    full[..len.min(full.len())].to_string()
}

pub fn generate_short_device_id() -> String {
    use rand::Rng;
    let mut rng = rand::rng();
    let num: u32 = rng.random_range(1000..9999);
    let prefix = if cfg!(target_os = "macos") { "MAC" } else { "PC" };
    format!("{}-{}", prefix, num)
}

pub fn get_default_device_name() -> String {
    let hostname = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_default();

    if !hostname.trim().is_empty() {
        return hostname;
    }

    if cfg!(target_os = "macos") {
        "MacDrop Mac".to_string()
    } else {
        "MacDrop PC".to_string()
    }
}

pub fn load_config() -> AppConfig {
    let dir = get_config_dir();
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }

    let file_path = get_config_file_path();
    if file_path.exists() {
        if let Ok(content) = fs::read_to_string(&file_path) {
            if let Ok(mut cfg) = serde_json::from_str::<AppConfig>(&content) {
                // Migrate legacy 8384 port to 52520
                let mut migrated = false;
                if cfg.api_port == 8384 {
                    cfg.api_port = 52520;
                    migrated = true;
                }
                if migrated {
                    save_config(&cfg);
                }

                // Ensure target folder exists
                if !Path::new(&cfg.target_folder).exists() {
                    let _ = fs::create_dir_all(&cfg.target_folder);
                }
                return cfg;
            }
        }
    }

    // Default configuration if no valid settings.json found
    let default_target = get_default_folder();
    if !Path::new(&default_target).exists() {
        let _ = fs::create_dir_all(&default_target);
    }

    let config = AppConfig {
        target_folder: default_target,
        auto_start: true,
        notifications: true,
        language: Some("ru".to_string()),
        device_id: generate_short_device_id(),
        device_name: get_default_device_name(),
        paired_devices: Vec::new(),
        api_port: 52520,
        api_key: generate_random_key(32),
        upnp_enabled: Some(true),
        wan_ip: None,
        custom_remote_host: None,
    };

    save_config(&config);
    config
}

pub fn save_config(config: &AppConfig) {
    let dir = get_config_dir();
    if !dir.exists() {
        let _ = fs::create_dir_all(&dir);
    }
    let file_path = get_config_file_path();
    if let Ok(json) = serde_json::to_string_pretty(config) {
        let _ = fs::write(file_path, json);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_random_key_length() {
        let key = generate_random_key(32);
        assert_eq!(key.len(), 32);
        let key2 = generate_random_key(32);
        assert_ne!(key, key2);
    }

    #[test]
    fn test_generate_short_device_id_format() {
        let id = generate_short_device_id();
        assert!(id.starts_with("MAC-") || id.starts_with("PC-"));
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 2);
        let num: Result<u32, _> = parts[1].parse();
        assert!(num.is_ok());
    }

    #[test]
    fn test_config_json_serialization_roundtrip() {
        let cfg = AppConfig {
            target_folder: "/tmp/MacDrop".to_string(),
            auto_start: false,
            notifications: true,
            language: Some("ru".to_string()),
            device_id: "MAC-9999".to_string(),
            device_name: "Test Mac".to_string(),
            paired_devices: vec![PairedDevice {
                id: "PC-1111".to_string(),
                original_name: "Desktop".to_string(),
                custom_name: "My PC".to_string(),
                ip: "192.168.1.100".to_string(),
                port: 52520,
                remote_ip: None,
                remote_port: None,
                paired_at: "2026-10-12".to_string(),
                last_seen: 123456789,
                receive_enabled: Some(true),
                connection_mode: Some("local".to_string()),
                auth_token: Some("secret".to_string()),
                platform: Some("win32".to_string()),
            }],
            api_port: 52520,
            api_key: "abc123".to_string(),
            upnp_enabled: Some(true),
            wan_ip: None,
            custom_remote_host: None,
        };

        let json = serde_json::to_string(&cfg).expect("Serialize error");
        assert!(json.contains("targetFolder"));
        assert!(json.contains("pairedDevices"));
        let deserialized: AppConfig = serde_json::from_str(&json).expect("Deserialize error");
        assert_eq!(deserialized.device_id, "MAC-9999");
        assert_eq!(deserialized.paired_devices.len(), 1);
        assert_eq!(deserialized.paired_devices[0].custom_name, "My PC");
    }
}

