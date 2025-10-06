//! Settings Management System
//!
//! Provides a layered settings system with:
//! - Global settings (~/.claude/settings.json)
//! - Project settings (.claude/settings.json)  
//! - Local settings (.claude/settings.local.json)
//! - Environment variable overrides
//! - CLI argument overrides

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// Settings configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// AI model settings
    #[serde(default)]
    pub ai: AISettings,
    
    /// UI/UX settings
    #[serde(default)]
    pub ui: UISettings,
    
    /// Behavior settings
    #[serde(default)]
    pub behavior: BehaviorSettings,
    
    /// Directory settings
    #[serde(default)]
    pub directories: DirectorySettings,
    
    /// Custom user settings
    #[serde(default)]
    pub custom: HashMap<String, serde_json::Value>,
}

/// AI model settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AISettings {
    /// Default AI model to use
    #[serde(default = "default_model")]
    pub default_model: String,
    
    /// Maximum tokens for responses
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
    
    /// Sampling temperature (0.0 to 1.0)
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    
    /// Top-p sampling parameter
    #[serde(default = "default_top_p")]
    pub top_p: f32,
    
    /// Enable/disable streaming responses
    #[serde(default = "default_streaming")]
    pub streaming: bool,
}

/// UI/UX settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISettings {
    /// Color scheme for terminal
    #[serde(default = "default_color_scheme")]
    pub color_scheme: String,
    
    /// Prompt format string
    #[serde(default = "default_prompt_format")]
    pub prompt_format: String,
    
    /// Enable/disable line wrapping
    #[serde(default = "default_line_wrapping")]
    pub line_wrapping: bool,
    
    /// Enable/disable syntax highlighting
    #[serde(default = "default_syntax_highlighting")]
    pub syntax_highlighting: bool,
    
    /// Show token usage information
    #[serde(default = "default_show_token_usage")]
    pub show_token_usage: bool,
}

/// Behavior settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BehaviorSettings {
    /// Auto-save conversations
    #[serde(default = "default_auto_save")]
    pub auto_save: bool,
    
    /// Session retention period in days
    #[serde(default = "default_session_retention")]
    pub session_retention_days: u32,
    
    /// Checkpoint creation frequency
    #[serde(default = "default_checkpoint_frequency")]
    pub checkpoint_frequency: u32,
    
    /// Allowed tool permissions
    #[serde(default)]
    pub tool_permissions: Vec<String>,
    
    /// Hook configurations
    #[serde(default)]
    pub hooks: HashMap<String, HookConfig>,
}

/// Hook configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HookConfig {
    /// Enable/disable the hook
    #[serde(default)]
    pub enabled: bool,
    
    /// Hook command/script to execute
    #[serde(default)]
    pub command: String,
    
    /// Working directory for hook execution
    #[serde(default)]
    pub working_dir: Option<PathBuf>,
    
    /// Environment variables for hook execution
    #[serde(default)]
    pub env_vars: HashMap<String, String>,
}

/// Directory settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DirectorySettings {
    /// Working directories to monitor/include
    #[serde(default)]
    pub working_dirs: Vec<PathBuf>,
    
    /// File patterns to include
    #[serde(default = "default_include_patterns")]
    pub include_patterns: Vec<String>,
    
    /// File patterns to exclude
    #[serde(default = "default_exclude_patterns")]
    pub exclude_patterns: Vec<String>,
    
    /// File type filters
    #[serde(default)]
    pub file_types: Vec<String>,
    
    /// Maximum file size in bytes
    #[serde(default = "default_max_file_size")]
    pub max_file_size: u64,
    
    /// How to handle binary files
    #[serde(default = "default_binary_handling")]
    pub binary_handling: String,
}

// Default values
fn default_model() -> String {
    "claude-3-5-sonnet-20241022".to_string()
}

fn default_max_tokens() -> u32 {
    1024
}

fn default_temperature() -> f32 {
    0.7
}

fn default_top_p() -> f32 {
    0.9
}

fn default_streaming() -> bool {
    true
}

fn default_color_scheme() -> String {
    "default".to_string()
}

fn default_prompt_format() -> String {
    "claude>".to_string()
}

fn default_line_wrapping() -> bool {
    true
}

fn default_syntax_highlighting() -> bool {
    true
}

fn default_show_token_usage() -> bool {
    true
}

fn default_auto_save() -> bool {
    true
}

fn default_session_retention() -> u32 {
    30
}

fn default_checkpoint_frequency() -> u32 {
    5
}

fn default_include_patterns() -> Vec<String> {
    vec!["**/*".to_string()]
}

fn default_exclude_patterns() -> Vec<String> {
    vec![
        "**/node_modules/**".to_string(),
        "**/.git/**".to_string(),
        "**/target/**".to_string(),
        "**/build/**".to_string(),
        "**/dist/**".to_string(),
        "**/*.min.js".to_string(),
        "**/*.bundle.js".to_string(),
    ]
}

fn default_max_file_size() -> u64 {
    1024 * 1024 // 1 MB
}

fn default_binary_handling() -> String {
    "skip".to_string()
}

impl Default for AISettings {
    fn default() -> Self {
        Self {
            default_model: default_model(),
            max_tokens: default_max_tokens(),
            temperature: default_temperature(),
            top_p: default_top_p(),
            streaming: default_streaming(),
        }
    }
}

impl Default for UISettings {
    fn default() -> Self {
        Self {
            color_scheme: default_color_scheme(),
            prompt_format: default_prompt_format(),
            line_wrapping: default_line_wrapping(),
            syntax_highlighting: default_syntax_highlighting(),
            show_token_usage: default_show_token_usage(),
        }
    }
}

impl Default for BehaviorSettings {
    fn default() -> Self {
        Self {
            auto_save: default_auto_save(),
            session_retention_days: default_session_retention(),
            checkpoint_frequency: default_checkpoint_frequency(),
            tool_permissions: Vec::new(),
            hooks: HashMap::new(),
        }
    }
}

impl Default for DirectorySettings {
    fn default() -> Self {
        Self {
            working_dirs: Vec::new(),
            include_patterns: default_include_patterns(),
            exclude_patterns: default_exclude_patterns(),
            file_types: Vec::new(),
            max_file_size: default_max_file_size(),
            binary_handling: default_binary_handling(),
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            ai: AISettings::default(),
            ui: UISettings::default(),
            behavior: BehaviorSettings::default(),
            directories: DirectorySettings::default(),
            custom: HashMap::new(),
        }
    }
}

/// Settings manager
pub struct SettingsManager {
    /// Global settings path
    global_settings_path: PathBuf,
    
    /// Project settings path
    project_settings_path: Option<PathBuf>,
    
    /// Local settings path
    local_settings_path: Option<PathBuf>,
    
    /// Current settings (merged from all sources)
    settings: Settings,
}

impl SettingsManager {
    /// Create a new settings manager
    pub fn new() -> Result<Self> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?;
        
        let global_settings_path = home_dir.join(".claude").join("settings.json");
        
        // Ensure global settings directory exists
        if let Some(parent) = global_settings_path.parent() {
            fs::create_dir_all(parent)
                .context("Failed to create global settings directory")?;
        }
        
        let mut manager = Self {
            global_settings_path,
            project_settings_path: None,
            local_settings_path: None,
            settings: Settings::default(),
        };
        
        // Load settings from all sources
        manager.load_settings()?;
        
        Ok(manager)
    }
    
    /// Set project settings path
    pub fn with_project_path(mut self, project_path: &Path) -> Self {
        self.project_settings_path = Some(project_path.join(".claude").join("settings.json"));
        
        // Ensure project settings directory exists
        if let Some(parent) = self.project_settings_path.as_ref().and_then(|p| p.parent()) {
            if let Err(e) = fs::create_dir_all(parent) {
                warn!("Failed to create project settings directory: {}", e);
            }
        }
        
        self
    }
    
    /// Set local settings path
    pub fn with_local_path(mut self, local_path: &Path) -> Self {
        self.local_settings_path = Some(local_path.join(".claude").join("settings.local.json"));
        
        // Ensure local settings directory exists
        if let Some(parent) = self.local_settings_path.as_ref().and_then(|p| p.parent()) {
            if let Err(e) = fs::create_dir_all(parent) {
                warn!("Failed to create local settings directory: {}", e);
            }
        }
        
        self
    }
    
    /// Load settings from all sources in priority order
    fn load_settings(&mut self) -> Result<()> {
        debug!("Loading settings from all sources");
        
        // Start with defaults
        let mut settings = Settings::default();
        
        // Load global settings
        if self.global_settings_path.exists() {
            match self.load_settings_file(&self.global_settings_path) {
                Ok(global_settings) => {
                    settings = self.merge_settings(settings, global_settings);
                    info!("Loaded global settings from {}", self.global_settings_path.display());
                }
                Err(e) => {
                    warn!("Failed to load global settings: {}", e);
                }
            }
        }
        
        // Load project settings
        if let Some(ref project_path) = self.project_settings_path {
            if project_path.exists() {
                match self.load_settings_file(project_path) {
                    Ok(project_settings) => {
                        settings = self.merge_settings(settings, project_settings);
                        info!("Loaded project settings from {}", project_path.display());
                    }
                    Err(e) => {
                        warn!("Failed to load project settings: {}", e);
                    }
                }
            }
        }
        
        // Load local settings (highest priority)
        if let Some(ref local_path) = self.local_settings_path {
            if local_path.exists() {
                match self.load_settings_file(local_path) {
                    Ok(local_settings) => {
                        settings = self.merge_settings(settings, local_settings);
                        info!("Loaded local settings from {}", local_path.display());
                    }
                    Err(e) => {
                        warn!("Failed to load local settings: {}", e);
                    }
                }
            }
        }
        
        // Apply environment variable overrides
        settings = self.apply_env_overrides(settings);
        
        self.settings = settings;
        Ok(())
    }
    
    /// Load settings from a JSON file
    fn load_settings_file(&self, path: &Path) -> Result<Settings> {
        let content = fs::read_to_string(path)
            .with_context(|| format!("Failed to read settings file: {}", path.display()))?;
        
        let settings: Settings = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse settings file: {}", path.display()))?;
        
        Ok(settings)
    }
    
    /// Apply environment variable overrides
    fn apply_env_overrides(&self, mut settings: Settings) -> Settings {
        // Override default model
        if let Ok(model) = std::env::var("CLAUDE_DEFAULT_MODEL") {
            settings.ai.default_model = model;
        }
        
        // Override max tokens
        if let Ok(tokens) = std::env::var("CLAUDE_MAX_TOKENS") {
            if let Ok(tokens_u32) = tokens.parse::<u32>() {
                settings.ai.max_tokens = tokens_u32;
            }
        }
        
        // Override temperature
        if let Ok(temp) = std::env::var("CLAUDE_TEMPERATURE") {
            if let Ok(temp_f32) = temp.parse::<f32>() {
                settings.ai.temperature = temp_f32.clamp(0.0, 1.0);
            }
        }
        
        settings
    }
    
    /// Merge two settings objects (new settings override base settings)
    fn merge_settings(&self, base: Settings, new: Settings) -> Settings {
        // For now, we'll do a simple merge where new values override base values
        // In a more sophisticated implementation, we might want to merge collections
        // rather than replacing them entirely
        Settings {
            ai: if new.ai != AISettings::default() { new.ai } else { base.ai },
            ui: if new.ui != UISettings::default() { new.ui } else { base.ui },
            behavior: if new.behavior != BehaviorSettings::default() { new.behavior } else { base.behavior },
            directories: if new.directories != DirectorySettings::default() { new.directories } else { base.directories },
            custom: {
                let mut merged = base.custom;
                merged.extend(new.custom);
                merged
            },
        }
    }
    
    /// Get current settings
    pub fn get_settings(&self) -> &Settings {
        &self.settings
    }
    
    /// Get mutable reference to settings
    pub fn get_settings_mut(&mut self) -> &mut Settings {
        &mut self.settings
    }
    
    /// Save global settings
    pub fn save_global_settings(&self) -> Result<()> {
        self.save_settings_file(&self.global_settings_path, &self.settings)
    }
    
    /// Save project settings
    pub fn save_project_settings(&self) -> Result<()> {
        if let Some(ref project_path) = self.project_settings_path {
            self.save_settings_file(project_path, &self.settings)
        } else {
            Err(anyhow::anyhow!("Project settings path not set"))
        }
    }
    
    /// Save local settings
    pub fn save_local_settings(&self) -> Result<()> {
        if let Some(ref local_path) = self.local_settings_path {
            self.save_settings_file(local_path, &self.settings)
        } else {
            Err(anyhow::anyhow!("Local settings path not set"))
        }
    }
    
    /// Save settings to a JSON file
    fn save_settings_file(&self, path: &Path, settings: &Settings) -> Result<()> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create settings directory: {}", parent.display()))?;
        }
        
        let json = serde_json::to_string_pretty(settings)
            .with_context(|| "Failed to serialize settings")?;
        
        fs::write(path, json)
            .with_context(|| format!("Failed to write settings file: {}", path.display()))?;
        
        info!("Saved settings to {}", path.display());
        Ok(())
    }
    
    /// Set a setting value by path (e.g., "ai.default_model")
    pub fn set_setting(&mut self, path: &str, value: serde_json::Value) -> Result<()> {
        // For simplicity, we'll just update the in-memory settings
        // A more sophisticated implementation might parse the path and update nested values
        self.settings.custom.insert(path.to_string(), value);
        Ok(())
    }
    
    /// Get a setting value by path
    pub fn get_setting(&self, path: &str) -> Option<&serde_json::Value> {
        self.settings.custom.get(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_settings_default_values() {
        let settings = Settings::default();
        
        assert_eq!(settings.ai.default_model, "claude-3-5-sonnet-20241022");
        assert_eq!(settings.ai.max_tokens, 1024);
        assert_eq!(settings.ai.temperature, 0.7);
        assert_eq!(settings.ai.top_p, 0.9);
        assert_eq!(settings.ai.streaming, true);
        
        assert_eq!(settings.ui.color_scheme, "default");
        assert_eq!(settings.ui.prompt_format, "claude>");
        assert_eq!(settings.ui.line_wrapping, true);
        assert_eq!(settings.ui.syntax_highlighting, true);
        assert_eq!(settings.ui.show_token_usage, true);
        
        assert_eq!(settings.behavior.auto_save, true);
        assert_eq!(settings.behavior.session_retention_days, 30);
        assert_eq!(settings.behavior.checkpoint_frequency, 5);
    }
    
    #[test]
    fn test_settings_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let settings_dir = temp_dir.path().join(".claude");
        fs::create_dir_all(&settings_dir).unwrap();
        
        let global_settings_path = settings_dir.join("settings.json");
        let settings_content = r#"{
            "ai": {
                "default_model": "claude-3-opus-20240229",
                "max_tokens": 2048,
                "temperature": 0.8
            },
            "ui": {
                "color_scheme": "dark",
                "prompt_format": "claude-dark>"
            }
        }"#;
        
        fs::write(&global_settings_path, settings_content).unwrap();
        
        // Temporarily change home directory
        std::env::set_var("HOME", temp_dir.path().to_str().unwrap());
        
        let manager = SettingsManager::new().unwrap();
        let settings = manager.get_settings();
        
        assert_eq!(settings.ai.default_model, "claude-3-opus-20240229");
        assert_eq!(settings.ai.max_tokens, 2048);
        assert_eq!(settings.ai.temperature, 0.8);
        assert_eq!(settings.ui.color_scheme, "dark");
        assert_eq!(settings.ui.prompt_format, "claude-dark>");
        
        // Clean up
        std::env::remove_var("HOME");
    }
    
    #[test]
    fn test_settings_saving() {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("test-settings.json");
        
        let manager = SettingsManager::new().unwrap();
        let result = manager.save_settings_file(&settings_path, manager.get_settings());
        assert!(result.is_ok());
        assert!(settings_path.exists());
        
        let saved_content = fs::read_to_string(&settings_path).unwrap();
        assert!(saved_content.contains("\"ai\""));
        assert!(saved_content.contains("\"default_model\""));
    }
    
    #[test]
    fn test_environment_overrides() {
        // Set environment variables
        std::env::set_var("CLAUDE_DEFAULT_MODEL", "test-model");
        std::env::set_var("CLAUDE_MAX_TOKENS", "4096");
        std::env::set_var("CLAUDE_TEMPERATURE", "0.9");
        
        let manager = SettingsManager::new().unwrap();
        let settings = manager.get_settings();
        
        assert_eq!(settings.ai.default_model, "test-model");
        assert_eq!(settings.ai.max_tokens, 4096);
        assert_eq!(settings.ai.temperature, 0.9);
        
        // Clean up
        std::env::remove_var("CLAUDE_DEFAULT_MODEL");
        std::env::remove_var("CLAUDE_MAX_TOKENS");
        std::env::remove_var("CLAUDE_TEMPERATURE");
    }
    
    #[test]
    fn test_settings_merge() {
        let base = Settings::default();
        let mut override_settings = Settings::default();
        override_settings.ai.default_model = "override-model".to_string();
        override_settings.ui.color_scheme = "override-scheme".to_string();
        
        let manager = SettingsManager::new().unwrap();
        let merged = manager.merge_settings(base, override_settings);
        
        assert_eq!(merged.ai.default_model, "override-model");
        assert_eq!(merged.ui.color_scheme, "override-scheme");
        // Other values should remain default
        assert_eq!(merged.ai.max_tokens, 1024);
        assert_eq!(merged.ui.prompt_format, "claude>");
    }
}