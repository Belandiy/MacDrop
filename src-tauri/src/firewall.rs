use crate::logger::AppLogger;
use std::os::windows::process::CommandExt;
use std::process::Command;

const RULE_NAME_TCP: &str = "MacDrop TCP";
const RULE_NAME_UDP: &str = "MacDrop UDP";

/// Ensures Windows Firewall allows inbound TCP (ports 52520, 8384) and UDP (port 8385).
/// Uses `netsh advfirewall` — runs silently, idempotent (checks before adding).
/// If rules already exist, does nothing. Does not require elevation for check,
/// but adding rules requires admin. Failures are logged but non-fatal.
pub fn ensure_firewall_rules(logger: &AppLogger) {
    if rule_exists(RULE_NAME_TCP) && rule_exists(RULE_NAME_UDP) {
        logger.info(
            "Firewall",
            "Windows Firewall rules already configured",
            None,
        );
        return;
    }

    logger.info(
        "Firewall",
        "Configuring Windows Firewall rules for MacDrop...",
        None,
    );

    if !rule_exists(RULE_NAME_TCP) {
        add_rule(
            logger,
            RULE_NAME_TCP,
            "TCP",
            "52520,8384",
            "Allow MacDrop HTTP API (local network file transfer)",
        );
    }

    if !rule_exists(RULE_NAME_UDP) {
        add_rule(
            logger,
            RULE_NAME_UDP,
            "UDP",
            "8385",
            "Allow MacDrop UDP peer discovery",
        );
    }
}

/// Check whether a firewall rule with the given name already exists.
fn rule_exists(name: &str) -> bool {
    let output = Command::new("netsh")
        .args(["advfirewall", "firewall", "show", "rule", &format!("name={}", name)])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // If the rule exists, netsh prints its details; if not, it says "No rules match"
            !stdout.contains("No rules match") && stdout.contains(name)
        }
        Err(_) => false,
    }
}

/// Add a firewall rule via netsh. Failures are logged but don't crash the app.
fn add_rule(logger: &AppLogger, name: &str, protocol: &str, ports: &str, description: &str) {
    let result = Command::new("netsh")
        .args([
            "advfirewall",
            "firewall",
            "add",
            "rule",
            &format!("name={}", name),
            "dir=in",
            "action=allow",
            &format!("protocol={}", protocol),
            &format!("localport={}", ports),
            &format!("description={}", description),
            "profile=private,public",
            "enable=yes",
        ])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                logger.info(
                    "Firewall",
                    &format!("Firewall rule \"{}\" added successfully ({} {})", name, protocol, ports),
                    None,
                );
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                let stdout = String::from_utf8_lossy(&output.stdout);
                logger.warn(
                    "Firewall",
                    &format!(
                        "Failed to add firewall rule \"{}\": {}{}. The app may require running as Administrator once, or manually allowing it through Windows Firewall.",
                        name,
                        stdout.trim(),
                        if !stderr.is_empty() { format!(" | {}", stderr.trim()) } else { String::new() }
                    ),
                    None,
                );
            }
        }
        Err(e) => {
            logger.warn(
                "Firewall",
                &format!("Could not execute netsh to add firewall rule \"{}\": {}", name, e),
                None,
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rule_names_are_consistent() {
        assert!(RULE_NAME_TCP.contains("MacDrop"));
        assert!(RULE_NAME_UDP.contains("MacDrop"));
        assert_ne!(RULE_NAME_TCP, RULE_NAME_UDP);
    }
}
