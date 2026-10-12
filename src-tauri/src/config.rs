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
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(&content) {
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
        api_port: 8384,
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
