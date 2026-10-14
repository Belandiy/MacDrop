use local_ip_address::list_afinet_netifas;

/// Discovers active network IPv4 addresses with smart interface prioritization.
/// Priority ranking:
/// 1. en0 (default Wi-Fi or primary Ethernet on macOS)
/// 2. en1
/// 3. Other en* interfaces
/// 4. eth* / wlan* interfaces
/// Filters out loopback (127.*), APIPA (169.254.*), and virtual/tunnel adapters
/// (utun*, bridge*, vmnet*, vboxnet*, p2p*, awdl*, llw*, gif*, stf*).
pub fn get_local_network_ips() -> Vec<String> {
    let interfaces = match list_afinet_netifas() {
        Ok(ifaces) => ifaces,
        Err(_) => {
            return fallback_single_ip();
        }
    };

    let mut candidates: Vec<(String, String, u32)> = Vec::new();

    for (name, ip) in interfaces {
        if let std::net::IpAddr::V4(ipv4) = ip {
            let ip_str = ipv4.to_string();

            // Ignore loopback and link-local auto-config
            if ip_str.starts_with("127.") || ip_str.starts_with("169.254.") {
                continue;
            }

            let name_lower = name.to_lowercase();

            // Ignore VPN, bridges, virtualization and direct link interfaces
            if name_lower.starts_with("utun")
                || name_lower.starts_with("bridge")
                || name_lower.starts_with("vmnet")
                || name_lower.starts_with("vboxnet")
                || name_lower.starts_with("p2p")
                || name_lower.starts_with("awdl")
                || name_lower.starts_with("llw")
                || name_lower.starts_with("gif")
                || name_lower.starts_with("stf")
            {
                continue;
            }

            // Scoring system for preferred physical Wi-Fi/Ethernet adapters
            let mut score: u32 = 10;
            if name_lower == "en0" {
                score += 100;
            } else if name_lower == "en1" {
                score += 90;
            } else if name_lower.starts_with("en") {
                score += 80;
            } else if name_lower.starts_with("eth") || name_lower.starts_with("wlan") {
                score += 70;
            }

            // Common private network address blocks
            if ip_str.starts_with("192.168.") {
                score += 15;
            } else if ip_str.starts_with("10.") {
                score += 12;
            } else if ip_str.starts_with("172.") {
                score += 8;
            }

            candidates.push((name, ip_str, score));
        }
    }

    // Sort descending by calculated score
    candidates.sort_by(|a, b| b.2.cmp(&a.2));

    let mut result: Vec<String> = candidates.into_iter().map(|(_, ip, _)| ip).collect();
    result.dedup();

    if result.is_empty() {
        fallback_single_ip()
    } else {
        result
    }
}

fn fallback_single_ip() -> Vec<String> {
    if let Ok(ip) = local_ip_address::local_ip() {
        let s = ip.to_string();
        if !s.starts_with("127.") && !s.starts_with("169.254.") {
            return vec![s];
        }
    }
    vec!["127.0.0.1".to_string()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_local_network_ips_not_empty() {
        let ips = get_local_network_ips();
        assert!(!ips.is_empty(), "Local IPs should never be empty");
        // Ensure no 169.254 APIPA addresses
        for ip in &ips {
            assert!(!ip.starts_with("169.254."));
        }
    }
}
