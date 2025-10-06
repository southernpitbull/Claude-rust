//! MCP Server Configuration and Management

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Server Configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// Server name/identifier
    pub name: String,

    /// Server command to execute
    pub command: String,

    /// Command arguments
    #[serde(default)]
    pub args: Vec<String>,

    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,

    /// Working directory
    pub cwd: Option<PathBuf>,

    /// Whether server is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Server priority (higher = higher priority)
    #[serde(default)]
    pub priority: i32,
}

fn default_true() -> bool {
    true
}

/// MCP Servers Configuration File
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct McpConfig {
    /// MCP protocol version
    #[serde(default = "default_mcp_version")]
    pub version: String,

    /// Configured servers
    #[serde(default)]
    pub servers: Vec<ServerConfig>,
}

fn default_mcp_version() -> String {
    crate::MCP_VERSION.to_string()
}

impl McpConfig {
    /// Load MCP configuration from file
    pub fn load(path: &PathBuf) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read MCP config from {}", path.display()))?;

        let config: McpConfig = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse MCP config from {}", path.display()))?;

        Ok(config)
    }

    /// Save MCP configuration to file
    pub fn save(&self, path: &PathBuf) -> Result<()> {
        let content = serde_json::to_string_pretty(self)
            .context("Failed to serialize MCP config")?;

        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory {}", parent.display()))?;
        }

        std::fs::write(path, content)
            .with_context(|| format!("Failed to write MCP config to {}", path.display()))?;

        Ok(())
    }

    /// Get enabled servers sorted by priority
    pub fn enabled_servers(&self) -> Vec<&ServerConfig> {
        let mut servers: Vec<&ServerConfig> = self
            .servers
            .iter()
            .filter(|s| s.enabled)
            .collect();

        servers.sort_by(|a, b| b.priority.cmp(&a.priority));
        servers
    }

    /// Find server by name
    pub fn find_server(&self, name: &str) -> Option<&ServerConfig> {
        self.servers.iter().find(|s| s.name == name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_config_defaults() {
        let config = ServerConfig {
            name: "test".to_string(),
            command: "test-server".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            enabled: true,
            priority: 0,
        };

        assert_eq!(config.name, "test");
        assert!(config.enabled);
    }

    #[test]
    fn test_mcp_config_enabled_servers() {
        let mut config = McpConfig::default();
        config.servers.push(ServerConfig {
            name: "server1".to_string(),
            command: "cmd1".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            enabled: true,
            priority: 10,
        });
        config.servers.push(ServerConfig {
            name: "server2".to_string(),
            command: "cmd2".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            enabled: false,
            priority: 5,
        });
        config.servers.push(ServerConfig {
            name: "server3".to_string(),
            command: "cmd3".to_string(),
            args: vec![],
            env: HashMap::new(),
            cwd: None,
            enabled: true,
            priority: 15,
        });

        let enabled = config.enabled_servers();
        assert_eq!(enabled.len(), 2);
        assert_eq!(enabled[0].name, "server3"); // Highest priority
        assert_eq!(enabled[1].name, "server1");
    }
}
