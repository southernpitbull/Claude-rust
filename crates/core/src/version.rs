//! Version Management
//!
//! Handles version checking and update notifications

use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};

/// Current version from Cargo.toml
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// GitHub repository for updates
pub const REPO: &str = "anthropic/claude-code-rust";

/// Version information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    /// Current version
    pub current: String,
    /// Latest available version
    pub latest: Option<String>,
    /// Whether an update is available
    pub update_available: bool,
    /// Release notes URL
    pub release_url: Option<String>,
}

impl VersionInfo {
    /// Create version info for current version
    pub fn current() -> Self {
        Self {
            current: VERSION.to_string(),
            latest: None,
            update_available: false,
            release_url: None,
        }
    }

    /// Check if update is available
    pub fn with_latest(mut self, latest: String, release_url: String) -> Self {
        self.update_available = is_newer_version(&latest, &self.current);
        self.latest = Some(latest);
        self.release_url = Some(release_url);
        self
    }
}

/// Version check cache
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionCheckCache {
    /// Cached version info
    pub info: VersionInfo,
    /// Last check timestamp
    pub checked_at: SystemTime,
}

impl VersionCheckCache {
    /// Create new cache entry
    pub fn new(info: VersionInfo) -> Self {
        Self {
            info,
            checked_at: SystemTime::now(),
        }
    }

    /// Check if cache is still valid (24 hours)
    pub fn is_valid(&self) -> bool {
        if let Ok(elapsed) = self.checked_at.elapsed() {
            elapsed < Duration::from_secs(24 * 60 * 60)
        } else {
            false
        }
    }
}

/// Compare two semantic version strings
/// Returns true if `new` is newer than `current`
pub fn is_newer_version(new: &str, current: &str) -> bool {
    let new_parts: Vec<u32> = parse_version(new);
    let current_parts: Vec<u32> = parse_version(current);

    for i in 0..3 {
        let new_part = new_parts.get(i).copied().unwrap_or(0);
        let current_part = current_parts.get(i).copied().unwrap_or(0);

        if new_part > current_part {
            return true;
        } else if new_part < current_part {
            return false;
        }
    }

    false
}

/// Parse version string into major, minor, patch
fn parse_version(version: &str) -> Vec<u32> {
    version
        .trim_start_matches('v')
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect()
}

/// Get latest version from GitHub releases
pub async fn fetch_latest_version() -> Result<VersionInfo, Box<dyn std::error::Error>> {
    let url = format!("https://api.github.com/repos/{}/releases/latest", REPO);

    let client = reqwest::Client::builder()
        .user_agent("claude-code-rust")
        .timeout(Duration::from_secs(5))
        .build()?;

    let response = client.get(&url).send().await?;

    if !response.status().is_success() {
        return Ok(VersionInfo::current());
    }

    let release: GitHubRelease = response.json().await?;

    Ok(VersionInfo::current().with_latest(
        release.tag_name.trim_start_matches('v').to_string(),
        release.html_url,
    ))
}

/// GitHub release API response
#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_parsing() {
        assert_eq!(parse_version("1.2.3"), vec![1, 2, 3]);
        assert_eq!(parse_version("v1.2.3"), vec![1, 2, 3]);
        assert_eq!(parse_version("0.1.0"), vec![0, 1, 0]);
    }

    #[test]
    fn test_version_comparison() {
        assert!(is_newer_version("1.2.3", "1.2.2"));
        assert!(is_newer_version("1.3.0", "1.2.9"));
        assert!(is_newer_version("2.0.0", "1.9.9"));

        assert!(!is_newer_version("1.2.2", "1.2.3"));
        assert!(!is_newer_version("1.2.3", "1.2.3"));
        assert!(!is_newer_version("1.0.0", "2.0.0"));
    }

    #[test]
    fn test_current_version() {
        let info = VersionInfo::current();
        assert_eq!(info.current, VERSION);
        assert!(!info.update_available);
        assert!(info.latest.is_none());
    }

    #[test]
    fn test_version_info_with_update() {
        let info = VersionInfo::current()
            .with_latest("99.0.0".to_string(), "https://example.com".to_string());

        assert!(info.update_available);
        assert_eq!(info.latest, Some("99.0.0".to_string()));
    }

    #[test]
    fn test_cache_validity() {
        let cache = VersionCheckCache::new(VersionInfo::current());
        assert!(cache.is_valid());
    }
}
