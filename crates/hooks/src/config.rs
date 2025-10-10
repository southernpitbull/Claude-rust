//! Hook Configuration

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::types::{HookPoint, HookType};

/// Individual hook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookConfig {
    /// Hook name/identifier
    pub name: String,

    /// Hook point(s) where this hook should execute
    pub points: Vec<HookPoint>,

    /// Hook type and implementation
    #[serde(flatten)]
    pub hook_type: HookType,

    /// Whether the hook is enabled
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Whether the hook can block operations
    #[serde(default)]
    pub blocking: bool,

    /// Hook priority (higher = runs first)
    #[serde(default)]
    pub priority: i32,

    /// Timeout in seconds
    #[serde(default = "default_timeout")]
    pub timeout: u64,

    /// Hook description
    pub description: Option<String>,
}

fn default_true() -> bool {
    true
}

fn default_timeout() -> u64 {
    30
}

/// Hooks configuration file
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HooksConfig {
    /// Version of the hooks config format
    #[serde(default = "default_version")]
    pub version: String,

    /// Global hook settings
    #[serde(default)]
    pub settings: HookSettings,

    /// Configured hooks
    #[serde(default)]
    pub hooks: Vec<HookConfig>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}

/// Global hook settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HookSettings {
    /// Whether hooks are globally enabled
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Maximum concurrent hooks
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: usize,

    /// Default timeout for all hooks
    #[serde(default = "default_timeout")]
    pub default_timeout: u64,

    /// Whether to continue on hook failure
    #[serde(default = "default_true")]
    pub continue_on_failure: bool,
}

fn default_max_concurrent() -> usize {
    5
}

impl HooksConfig {
    /// Load hooks configuration from file
    pub fn load(path: &PathBuf) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read hooks config from {}", path.display()))?;

        // Try YAML first, then JSON
        let config: HooksConfig = if path.extension().and_then(|s| s.to_str()) == Some("yaml")
            || path.extension().and_then(|s| s.to_str()) == Some("yml")
        {
            serde_yaml::from_str(&content)
                .with_context(|| format!("Failed to parse hooks config from {}", path.display()))?
        } else {
            serde_json::from_str(&content)
                .with_context(|| format!("Failed to parse hooks config from {}", path.display()))?
        };

        Ok(config)
    }

    /// Save hooks configuration to file
    pub fn save(&self, path: &PathBuf) -> Result<()> {
        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create directory {}", parent.display()))?;
        }

        // Save based on file extension
        let content = if path.extension().and_then(|s| s.to_str()) == Some("yaml")
            || path.extension().and_then(|s| s.to_str()) == Some("yml")
        {
            serde_yaml::to_string(self).context("Failed to serialize hooks config")?
        } else {
            serde_json::to_string_pretty(self).context("Failed to serialize hooks config")?
        };

        std::fs::write(path, content)
            .with_context(|| format!("Failed to write hooks config to {}", path.display()))?;

        Ok(())
    }

    /// Get hooks for a specific point
    pub fn hooks_for_point(&self, point: HookPoint) -> Vec<&HookConfig> {
        let mut hooks: Vec<&HookConfig> = self
            .hooks
            .iter()
            .filter(|h| h.enabled && h.points.contains(&point))
            .collect();

        // Sort by priority (descending)
        hooks.sort_by(|a, b| b.priority.cmp(&a.priority));
        hooks
    }

    /// Get all enabled hooks
    pub fn enabled_hooks(&self) -> Vec<&HookConfig> {
        self.hooks.iter().filter(|h| h.enabled).collect()
    }

    /// Find hook by name
    pub fn find_hook(&self, name: &str) -> Option<&HookConfig> {
        self.hooks.iter().find(|h| h.name == name)
    }

    /// Add a hook
    pub fn add_hook(&mut self, hook: HookConfig) {
        self.hooks.push(hook);
    }

    /// Remove a hook by name
    pub fn remove_hook(&mut self, name: &str) -> bool {
        let len_before = self.hooks.len();
        self.hooks.retain(|h| h.name != name);
        self.hooks.len() < len_before
    }

    /// Enable/disable a hook
    pub fn set_hook_enabled(&mut self, name: &str, enabled: bool) -> bool {
        if let Some(hook) = self.hooks.iter_mut().find(|h| h.name == name) {
            hook.enabled = enabled;
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_hooks_for_point() {
        let mut config = HooksConfig::default();

        config.hooks.push(HookConfig {
            name: "hook1".to_string(),
            points: vec![HookPoint::PreCommit],
            hook_type: HookType::Shell {
                command: "echo".to_string(),
                args: vec!["test".to_string()],
                cwd: None,
                env: HashMap::new(),
            },
            enabled: true,
            blocking: false,
            priority: 10,
            timeout: 30,
            description: None,
        });

        config.hooks.push(HookConfig {
            name: "hook2".to_string(),
            points: vec![HookPoint::PreCommit, HookPoint::PostCommit],
            hook_type: HookType::Shell {
                command: "echo".to_string(),
                args: vec!["test2".to_string()],
                cwd: None,
                env: HashMap::new(),
            },
            enabled: true,
            blocking: false,
            priority: 5,
            timeout: 30,
            description: None,
        });

        let hooks = config.hooks_for_point(HookPoint::PreCommit);
        assert_eq!(hooks.len(), 2);
        assert_eq!(hooks[0].name, "hook1"); // Higher priority first
        assert_eq!(hooks[1].name, "hook2");
    }

    #[test]
    fn test_add_remove_hook() {
        let mut config = HooksConfig::default();

        let hook = HookConfig {
            name: "test".to_string(),
            points: vec![HookPoint::SessionStart],
            hook_type: HookType::Shell {
                command: "echo".to_string(),
                args: vec![],
                cwd: None,
                env: HashMap::new(),
            },
            enabled: true,
            blocking: false,
            priority: 0,
            timeout: 30,
            description: None,
        };

        config.add_hook(hook);
        assert_eq!(config.hooks.len(), 1);

        assert!(config.remove_hook("test"));
        assert_eq!(config.hooks.len(), 0);
    }
}
