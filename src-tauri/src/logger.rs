use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::get_config_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Debug,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
            LogLevel::Debug => "debug",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogEntry {
    pub id: String,
    pub timestamp: i64,
    pub level: LogLevel,
    pub tag: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

#[derive(Clone)]
pub struct AppLogger {
    buffer: Arc<Mutex<Vec<LogEntry>>>,
    counter: Arc<AtomicU64>,
    max_buffer_size: usize,
    max_file_size_bytes: u64,
}

impl AppLogger {
    pub fn new() -> Self {
        let logger = Self {
            buffer: Arc::new(Mutex::new(Vec::with_capacity(1000))),
            counter: Arc::new(AtomicU64::new(0)),
            max_buffer_size: 1000,
            max_file_size_bytes: 5 * 1024 * 1024,
        };
        logger.ensure_log_dir();
        logger
    }

    pub fn get_log_dir(&self) -> PathBuf {
        let mut dir = get_config_dir();
        dir.push("logs");
        dir
    }

    pub fn get_log_file_path(&self) -> PathBuf {
        let mut path = self.get_log_dir();
        path.push("macdrop.log");
        path
    }

    fn ensure_log_dir(&self) {
        let dir = self.get_log_dir();
        if !dir.exists() {
            let _ = fs::create_dir_all(&dir);
        }
    }

    pub fn log(
        &self,
        level: LogLevel,
        tag: &str,
        message: &str,
        details: Option<String>,
    ) -> LogEntry {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let seq = self.counter.fetch_add(1, Ordering::Relaxed);
        let id = format!("{}-{}", now, seq);

        let formatted_tag = if tag.starts_with('[') {
            tag.to_string()
        } else {
            format!("[{}]", tag)
        };

        let entry = LogEntry {
            id,
            timestamp: now,
            level,
            tag: formatted_tag,
            message: message.to_string(),
            details,
        };

        // Ring-buffer
        if let Ok(mut buf) = self.buffer.lock() {
            buf.push(entry.clone());
            if buf.len() > self.max_buffer_size {
                buf.remove(0);
            }
        }

        // Append to file
        self.append_to_file(&entry);

        entry
    }

    pub fn info(&self, tag: &str, message: &str, details: Option<String>) -> LogEntry {
        self.log(LogLevel::Info, tag, message, details)
    }

    pub fn warn(&self, tag: &str, message: &str, details: Option<String>) -> LogEntry {
        self.log(LogLevel::Warn, tag, message, details)
    }

    pub fn error(&self, tag: &str, message: &str, details: Option<String>) -> LogEntry {
        self.log(LogLevel::Error, tag, message, details)
    }

    pub fn debug(&self, tag: &str, message: &str, details: Option<String>) -> LogEntry {
        self.log(LogLevel::Debug, tag, message, details)
    }

    pub fn get_logs(&self, limit: Option<usize>) -> Vec<LogEntry> {
        if let Ok(buf) = self.buffer.lock() {
            if let Some(lim) = limit {
                if lim > 0 && lim < buf.len() {
                    return buf[buf.len() - lim..].to_vec();
                }
            }
            return buf.clone();
        }
        Vec::new()
    }

    pub fn clear_logs(&self) -> bool {
        if let Ok(mut buf) = self.buffer.lock() {
            buf.clear();
        }
        let file_path = self.get_log_file_path();
        if file_path.exists() {
            let _ = fs::write(file_path, "");
        }
        true
    }

    fn append_to_file(&self, entry: &LogEntry) {
        self.ensure_log_dir();
        self.rotate_if_needed();

        let path = self.get_log_file_path();
        if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
            let det = match &entry.details {
                Some(d) => format!(" | Details: {}", d),
                None => String::new(),
            };
            let line = format!(
                "[{}] [{}] {} {}{}\n",
                entry.timestamp,
                entry.level.as_str().to_uppercase(),
                entry.tag,
                entry.message,
                det
            );
            let _ = file.write_all(line.as_bytes());
        }
    }

    fn rotate_if_needed(&self) {
        let path = self.get_log_file_path();
        if let Ok(meta) = fs::metadata(&path) {
            if meta.len() >= self.max_file_size_bytes {
                let mut backup = self.get_log_dir();
                backup.push("macdrop.1.log");
                let _ = fs::remove_file(&backup);
                let _ = fs::rename(&path, backup);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_logger_buffer_and_filtering() {
        let logger = AppLogger::new();
        logger.clear_logs();

        logger.info("Test", "Message 1", None);
        logger.warn("Test", "Message 2", Some("detail".to_string()));
        logger.error("Test", "Message 3", None);

        let logs = logger.get_logs(None);
        assert!(logs.len() >= 3);

        let limited = logger.get_logs(Some(2));
        assert_eq!(limited.len(), 2);
        assert_eq!(limited.last().unwrap().message, "Message 3");
    }

    #[test]
    fn test_logger_clear() {
        let logger = AppLogger::new();
        logger.info("Test", "Will be cleared", None);
        assert!(logger.get_logs(None).len() > 0);

        logger.clear_logs();
        assert_eq!(logger.get_logs(None).len(), 0);
    }
}

