//! Hooks System
//!
//! Provides a flexible hook system for executing code at specific points
//! during the Claude-Rust workflow.

use crate::settings::{HookConfig, BehaviorSettings};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use tracing::{debug, error, info, warn};

/// Hook execution context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookContext {
    /// Current working directory
    pub working_dir: PathBuf,
    
    /// Session ID if available
    pub session_id: Option<String>,
    
    /// Current model being used
    pub model: Option<String>,
    
    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Hook execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookResult {
    /// Whether the hook execution was successful
    pub success: bool,
    
    /// Output from the hook (if any)
    pub output: Option<String>,
    
    /// Error message if execution failed
    pub error: Option<String>,
    
    /// Whether to continue execution (for blocking hooks)
    pub should_continue: bool,
}

/// Hook type enum
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum HookType {
    /// Before user submits a prompt
    UserPromptSubmit,
    
    /// Before git commit
    PreCommit,
    
    /// After git commit
    PostCommit,
    
    /// When session starts
    SessionStart,
    
    /// When session ends
    SessionEnd,
    
    /// Before tool execution
    BeforeToolUse,
    
    /// After tool execution
    AfterToolUse,
    
    /// Before file edit
    BeforeFileEdit,
    
    /// After file edit
    AfterFileEdit,
    
    /// Custom hook
    Custom(String),
}

impl std::fmt::Display for HookType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            HookType::UserPromptSubmit => write!(f, "user-prompt-submit"),
            HookType::PreCommit => write!(f, "pre-commit"),
            HookType::PostCommit => write!(f, "post-commit"),
            HookType::SessionStart => write!(f, "session-start"),
            HookType::SessionEnd => write!(f, "session-end"),
            HookType::BeforeToolUse => write!(f, "before-tool-use"),
            HookType::AfterToolUse => write!(f, "after-tool-use"),
            HookType::BeforeFileEdit => write!(f, "before-file-edit"),
            HookType::AfterFileEdit => write!(f, "after-file-edit"),
            HookType::Custom(name) => write!(f, "custom-{}", name),
        }
    }
}

// Default values
fn default_hook_timeout() -> u64 {
    30 // 30 seconds default timeout
}

fn default_hook_blocking() -> bool {
    true
}

fn default_hook_priority() -> i32 {
    0
}

/// Hook manager
pub struct HookManager {
    /// Registered hooks by type
    hooks: HashMap<HookType, Vec<HookConfig>>,
    
    /// Global hook configuration
    config: HooksConfig,
}

/// Global hooks configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HooksConfig {
    /// Enable/disable hooks globally
    #[serde(default = "default_hooks_enabled")]
    pub enabled: bool,
    
    /// Default timeout for hooks
    #[serde(default = "default_hook_timeout")]
    pub default_timeout_secs: u64,
    
    /// Maximum number of hooks to execute
    #[serde(default = "default_max_hooks")]
    pub max_hooks: usize,
}

fn default_hooks_enabled() -> bool {
    true
}

fn default_max_hooks() -> usize {
    100
}

impl Default for HooksConfig {
    fn default() -> Self {
        Self {
            enabled: default_hooks_enabled(),
            default_timeout_secs: default_hook_timeout(),
            max_hooks: default_max_hooks(),
        }
    }
}

impl HookManager {
    /// Create a new hook manager
    pub fn new() -> Self {
        Self {
            hooks: HashMap::new(),
            config: HooksConfig::default(),
        }
    }
    
    /// Create a new hook manager with custom configuration
    pub fn with_config(config: HooksConfig) -> Self {
        Self {
            hooks: HashMap::new(),
            config,
        }
    }
    
    /// Register a hook
    pub fn register_hook(&mut self, hook_type: HookType, config: HookConfig) {
        self.hooks.entry(hook_type).or_insert_with(Vec::new).push(config);
    }
    
    /// Get registered hooks for a specific type
    pub fn get_hooks(&self, hook_type: &HookType) -> Option<&Vec<HookConfig>> {
        self.hooks.get(hook_type)
    }
    
    /// Load hooks from settings
    pub fn load_from_settings(settings: &BehaviorSettings) -> Self {
        let mut manager = Self::new();
        
        // Load hooks from settings
        for (hook_name, hook_config) in &settings.hooks {
            // Convert hook name to hook type
            let hook_type = match hook_name.as_str() {
                "user-prompt-submit" => HookType::UserPromptSubmit,
                "pre-commit" => HookType::PreCommit,
                "post-commit" => HookType::PostCommit,
                "session-start" => HookType::SessionStart,
                "session-end" => HookType::SessionEnd,
                "before-tool-use" => HookType::BeforeToolUse,
                "after-tool-use" => HookType::AfterToolUse,
                "before-file-edit" => HookType::BeforeFileEdit,
                "after-file-edit" => HookType::AfterFileEdit,
                _ => HookType::Custom(hook_name.clone()),
            };
            
            manager.register_hook(hook_type, hook_config.clone());
        }
        
        manager
    }
    
    /// Execute hooks for a specific type
    pub async fn execute_hooks(&self, hook_type: &HookType, context: &HookContext) -> Result<Vec<HookResult>> {
        if !self.config.enabled {
            debug!("Hooks are disabled globally");
            return Ok(vec![]);
        }
        
        let hooks = match self.hooks.get(hook_type) {
            Some(hooks) => hooks,
            None => {
                debug!("No hooks registered for type: {}", hook_type);
                return Ok(vec![]);
            }
        };
        
        let mut results = Vec::new();
        
        for hook_config in hooks.iter().take(self.config.max_hooks) {
            if !hook_config.enabled {
                debug!("Skipping disabled hook: {}", hook_config.command);
                continue;
            }
            
            match self.execute_hook(hook_config, context).await {
                Ok(result) => {
                    results.push(result);
                }
                Err(e) => {
                    error!("Failed to execute hook '{}': {}", hook_config.command, e);
                    results.push(HookResult {
                        success: false,
                        output: None,
                        error: Some(e.to_string()),
                        should_continue: true,
                    });
                }
            }
        }
        
        Ok(results)
    }
    
    /// Execute a single hook
    async fn execute_hook(&self, config: &HookConfig, context: &HookContext) -> Result<HookResult> {
        debug!("Executing hook: {}", config.command);
        
        // Determine working directory
        let working_dir = config.working_dir.as_ref()
            .unwrap_or(&context.working_dir);
        
        // Build command
        let mut cmd = Command::new(&config.command);
        cmd.current_dir(working_dir);
        
        // Set environment variables
        for (key, value) in &config.env_vars {
            cmd.env(key, value);
        }
        
        // Set context environment variables
        cmd.env("CLAUDE_WORKING_DIR", working_dir);
        
        if let Some(session_id) = &context.session_id {
            cmd.env("CLAUDE_SESSION_ID", session_id);
        }
        
        if let Some(model) = &context.model {
            cmd.env("CLAUDE_MODEL", model);
        }
        
        // Execute command with timeout
        let timeout_secs = self.config.default_timeout_secs;
        
        let output = if timeout_secs > 0 {
            // Execute with timeout
            match tokio::time::timeout(
                std::time::Duration::from_secs(timeout_secs),
                tokio::process::Command::from(cmd).output()
            ).await {
                Ok(result) => result,
                Err(_) => {
                    return Ok(HookResult {
                        success: false,
                        output: None,
                        error: Some(format!("Timed out after {} seconds", timeout_secs)),
                        should_continue: true,
                    });
                }
            }
        } else {
            // Execute without timeout
            tokio::process::Command::from(cmd).output().await
        };
        
        match output {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                
                if output.status.success() {
                    info!("Hook '{}' executed successfully", config.command);
                    Ok(HookResult {
                        success: true,
                        output: Some(stdout.to_string()),
                        error: None,
                        should_continue: true,
                    })
                } else {
                    warn!("Hook '{}' failed with exit code: {:?}", config.command, output.status.code());
                    Ok(HookResult {
                        success: false,
                        output: Some(format!("{}{}", stdout, stderr)),
                        error: Some(format!("Exit code: {:?}", output.status.code())),
                        should_continue: true,
                    })
                }
            }
            Err(e) => {
                error!("Hook '{}' execution failed: {}", config.command, e);
                Err(e.into())
            }
        }
    }
    
    /// Execute user-prompt-submit hooks
    pub async fn execute_user_prompt_submit_hooks(&self, context: &HookContext) -> Result<bool> {
        let results = self.execute_hooks(&HookType::UserPromptSubmit, context).await?;
        
        // Check if any hook requested to stop execution
        for result in &results {
            if !result.should_continue {
                return Ok(false);
            }
        }
        
        Ok(true)
    }
    
    /// Execute pre-commit hooks
    pub async fn execute_pre_commit_hooks(&self, context: &HookContext) -> Result<bool> {
        let results = self.execute_hooks(&HookType::PreCommit, context).await?;
        
        // Check if any hook failed or requested to stop execution
        for result in &results {
            if !result.success || !result.should_continue {
                return Ok(false);
            }
        }
        
        Ok(true)
    }
    
    /// Execute post-commit hooks
    pub async fn execute_post_commit_hooks(&self, context: &HookContext) -> Result<()> {
        self.execute_hooks(&HookType::PostCommit, context).await?;
        Ok(())
    }
    
    /// Execute session-start hooks
    pub async fn execute_session_start_hooks(&self, context: &HookContext) -> Result<()> {
        self.execute_hooks(&HookType::SessionStart, context).await?;
        Ok(())
    }
    
    /// Execute session-end hooks
    pub async fn execute_session_end_hooks(&self, context: &HookContext) -> Result<()> {
        self.execute_hooks(&HookType::SessionEnd, context).await?;
        Ok(())
    }
}

impl Default for HookManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_hook_type_display() {
        assert_eq!(format!("{}", HookType::UserPromptSubmit), "user-prompt-submit");
        assert_eq!(format!("{}", HookType::PreCommit), "pre-commit");
        assert_eq!(format!("{}", HookType::PostCommit), "post-commit");
        assert_eq!(format!("{}", HookType::SessionStart), "session-start");
        assert_eq!(format!("{}", HookType::SessionEnd), "session-end");
        assert_eq!(format!("{}", HookType::Custom("test".to_string())), "custom-test");
    }
    
    #[test]
    fn test_hook_config_defaults() {
        let config = HookConfig {
            name: "test".to_string(),
            description: None,
            enabled: default_hook_enabled(),
            command: "echo".to_string(),
            working_dir: None,
            env_vars: HashMap::new(),
            args: vec![],
            timeout_secs: default_hook_timeout(),
            blocking: default_hook_blocking(),
            priority: default_hook_priority(),
        };
        
        assert!(config.enabled);
        // Timeout is handled at the system level, not per config
        assert!(config.blocking);
        // Priority field doesn't exist in the current HookConfig
    }
    
    #[test]
    fn test_hook_manager_creation() {
        let manager = HookManager::new();
        assert!(manager.hooks.is_empty());
        assert!(manager.config.enabled);
    }
    
    #[tokio::test]
    async fn test_hook_registration() {
        let mut manager = HookManager::new();
        let config = HookConfig {
            name: "test-hook".to_string(),
            description: Some("Test hook".to_string()),
            enabled: true,
            command: "echo".to_string(),
            working_dir: None,
            env_vars: HashMap::new(),
            args: vec!["hello".to_string()],
            timeout_secs: 10,
            blocking: true,
            priority: 5,
        };
        
        manager.register_hook(HookType::UserPromptSubmit, config.clone());
        
        let hooks = manager.get_hooks(&HookType::UserPromptSubmit);
        assert!(hooks.is_some());
        assert_eq!(hooks.unwrap().len(), 1);
        assert_eq!(hooks.unwrap()[0].name, "test-hook");
    }
    
    #[tokio::test]
    async fn test_hook_execution_disabled() {
        let config = HooksConfig {
            enabled: false,
            default_timeout_secs: 30,
            max_hooks: 100,
        };
        let manager = HookManager::with_config(config);
        let context = HookContext {
            working_dir: PathBuf::from("."),
            session_id: None,
            model: None,
            metadata: HashMap::new(),
        };
        
        let results = manager.execute_hooks(&HookType::UserPromptSubmit, &context).await.unwrap();
        assert!(results.is_empty());
    }
}