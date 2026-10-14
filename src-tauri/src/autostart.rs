use std::path::PathBuf;

/// Registers or unregisters the application from macOS LaunchAgents for auto-start on user login.
/// Uses ~/Library/LaunchAgents/com.macdrop.desktop.plist.
#[cfg(target_os = "macos")]
pub fn set_system_autostart(enable: bool) -> Result<(), String> {
    let home = dirs::home_dir().ok_or_else(|| "Failed to find home directory".to_string())?;
    let launch_agents_dir = home.join("Library").join("LaunchAgents");
    let plist_path = launch_agents_dir.join("com.macdrop.desktop.plist");

    if enable {
        if !launch_agents_dir.exists() {
            std::fs::create_dir_all(&launch_agents_dir).map_err(|e| e.to_string())?;
        }

        let exe_path = match std::env::current_exe() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => "/Applications/MacDrop.app/Contents/MacOS/MacDrop".to_string(),
        };

        let plist_content = generate_launch_agent_plist(&exe_path);
        std::fs::write(&plist_path, plist_content).map_err(|e| e.to_string())?;
    } else if plist_path.exists() {
        let _ = std::fs::remove_file(&plist_path);
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn set_system_autostart(_enable: bool) -> Result<(), String> {
    Ok(())
}

/// Generates valid launchd plist content for LaunchAgent.
pub fn generate_launch_agent_plist(exe_path: &str) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.macdrop.desktop</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
"#,
        exe_path
    )
}

/// Checks whether the system launch agent plist currently exists.
pub fn is_launch_agent_installed() -> bool {
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = dirs::home_dir() {
            let plist_path: PathBuf = home.join("Library").join("LaunchAgents").join("com.macdrop.desktop.plist");
            return plist_path.exists();
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_launch_agent_plist() {
        let plist = generate_launch_agent_plist("/Applications/MacDrop.app/Contents/MacOS/MacDrop");
        assert!(plist.contains("<string>com.macdrop.desktop</string>"));
        assert!(plist.contains("<string>/Applications/MacDrop.app/Contents/MacOS/MacDrop</string>"));
        assert!(plist.contains("<key>RunAtLoad</key>"));
        assert!(plist.contains("<true/>"));
    }
}
