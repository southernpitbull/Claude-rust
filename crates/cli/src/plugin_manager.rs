//! Plugin System
//!
//! Provides a comprehensive plugin system for extending Claude Code functionality

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::slash_commands::{CommandContext, CommandResult, SlashCommand};

/// Plugin manifest structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Plugin name
    pub name: String,
    
    /// Plugin version
    pub version: String,
    
    /// Plugin description
    pub description: String,
    
    /// Plugin author
    pub author: Option<String>,
    
    /// Plugin homepage
    pub homepage: Option<String>,
    
    /// Plugin license
    pub license: Option<String>,
    
    /// Required Claude Code version
    pub claude_code_version: Option<String>,
    
    /// Plugin entry points
    pub entry_points: Vec<PluginEntryPoint>,
    
    /// Plugin dependencies
    pub dependencies: Option<Vec<PluginDependency>>,
    
    /// Plugin configuration schema
    pub config_schema: Option<serde_json::Value>,
}

/// Plugin entry point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEntryPoint {
    /// Entry point type (command, hook, agent, etc.)
    pub r#type: EntryPointType,
    
    /// Entry point name
    pub name: String,
    
    /// Entry point file path
    pub file: String,
    
    /// Entry point description
    pub description: Option<String>,
}

/// Entry point type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EntryPointType {
    /// Slash command
    Command,
    
    /// Hook
    Hook,
    
    /// Agent
    Agent,
    
    /// Tool
    Tool,
    
    /// Web UI component
    WebComponent,
}

/// Plugin dependency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDependency {
    /// Dependency name
    pub name: String,
    
    /// Dependency version requirement
    pub version: String,
    
    /// Dependency type (plugin, crate, npm, etc.)
    pub r#type: DependencyType,
}

/// Dependency type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DependencyType {
    /// Claude Code plugin
    Plugin,
    
    /// Rust crate
    Crate,
    
    /// NPM package
    Npm,
    
    /// System package
    System,
}

/// Plugin configuration
#[derive(Debug, Clone)]
pub struct PluginConfig {
    /// Plugin enabled status
    pub enabled: bool,
    
    /// Plugin configuration values
    pub values: HashMap<String, serde_json::Value>,
}

/// Plugin manager
pub struct PluginManager {
    /// Loaded plugins
    plugins: Arc<RwLock<HashMap<String, PluginInstance>>>,
    
    /// Plugin configurations
    configs: Arc<RwLock<HashMap<String, PluginConfig>>>,
    
    /// Plugin directory
    plugin_dir: PathBuf,
}

/// Plugin instance
#[derive(Clone)]
pub struct PluginInstance {
    /// Plugin manifest
    pub manifest: PluginManifest,

    /// Plugin commands
    pub commands: Vec<Arc<dyn SlashCommand>>,

    /// Plugin hooks
    pub hooks: Vec<Arc<dyn PluginHook>>,

    /// Plugin agents
    pub agents: Vec<Arc<dyn PluginAgent>>,

    /// Plugin tools
    pub tools: Vec<Arc<dyn PluginTool>>,
}

/// Plugin hook trait
#[async_trait::async_trait]
pub trait PluginHook: Send + Sync {
    /// Get hook name
    fn name(&self) -> &str;
    
    /// Execute hook
    async fn execute(&self, context: &HookContext) -> Result<HookResult>;
}

/// Hook context
#[derive(Debug, Clone)]
pub struct HookContext {
    /// Hook type
    pub hook_type: String,
    
    /// Hook data
    pub data: HashMap<String, serde_json::Value>,
}

/// Hook result
#[derive(Debug, Clone)]
pub struct HookResult {
    /// Success flag
    pub success: bool,
    
    /// Result data
    pub data: Option<serde_json::Value>,
    
    /// Error message
    pub error: Option<String>,
}

/// Plugin agent trait
#[async_trait::async_trait]
pub trait PluginAgent: Send + Sync {
    /// Get agent name
    fn name(&self) -> &str;
    
    /// Execute agent task
    async fn execute(&self, task: &AgentTask) -> Result<AgentResult>;
}

/// Agent task
#[derive(Debug, Clone)]
pub struct AgentTask {
    /// Task ID
    pub id: String,
    
    /// Task type
    pub task_type: String,
    
    /// Task data
    pub data: HashMap<String, serde_json::Value>,
}

/// Agent result
#[derive(Debug, Clone)]
pub struct AgentResult {
    /// Success flag
    pub success: bool,
    
    /// Result data
    pub data: Option<serde_json::Value>,
    
    /// Error message
    pub error: Option<String>,
}

/// Plugin tool trait
#[async_trait::async_trait]
pub trait PluginTool: Send + Sync {
    /// Get tool name
    fn name(&self) -> &str;
    
    /// Get tool description
    fn description(&self) -> &str;
    
    /// Execute tool
    async fn execute(&self, params: &HashMap<String, serde_json::Value>) -> Result<ToolResult>;
}

/// Tool result
#[derive(Debug, Clone)]
pub struct ToolResult {
    /// Success flag
    pub success: bool,
    
    /// Result data
    pub data: Option<serde_json::Value>,
    
    /// Error message
    pub error: Option<String>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new(plugin_dir: PathBuf) -> Self {
        Self {
            plugins: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
            plugin_dir,
        }
    }
    
    /// Load all plugins from plugin directory
    pub async fn load_plugins(&self) -> Result<()> {
        if !self.plugin_dir.exists() {
            debug!("Plugin directory does not exist: {}", self.plugin_dir.display());
            return Ok(());
        }
        
        // Iterate through plugin directories
        for entry in fs::read_dir(&self.plugin_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.is_dir() {
                match self.load_plugin(&path).await {
                    Ok(plugin) => {
                        let plugin_name = plugin.manifest.name.clone();
                        self.plugins.write().await.insert(plugin_name.clone(), plugin);
                        info!("Loaded plugin: {}", plugin_name);
                    }
                    Err(e) => {
                        warn!("Failed to load plugin from {}: {}", path.display(), e);
                    }
                }
            }
        }
        
        Ok(())
    }
    
    /// Load a single plugin from directory
    async fn load_plugin(&self, plugin_dir: &PathBuf) -> Result<PluginInstance> {
        // Load plugin manifest
        let manifest_path = plugin_dir.join("plugin.json");
        let manifest_content = fs::read_to_string(&manifest_path)
            .map_err(|e| anyhow::anyhow!("Failed to read plugin manifest {}: {}", manifest_path.display(), e))?;
        let manifest: PluginManifest = serde_json::from_str(&manifest_content)
            .map_err(|e| anyhow::anyhow!("Failed to parse plugin manifest {}: {}", manifest_path.display(), e))?;
        
        // Load plugin entry points
        let mut commands: Vec<Arc<dyn SlashCommand>> = Vec::new();
        let mut hooks: Vec<Arc<dyn PluginHook>> = Vec::new();
        let mut agents: Vec<Arc<dyn PluginAgent>> = Vec::new();
        let mut tools: Vec<Arc<dyn PluginTool>> = Vec::new();
        
        // Process entry points
        for entry_point in &manifest.entry_points {
            match entry_point.r#type {
                EntryPointType::Command => {
                    // Load command from file
                    let command_file = plugin_dir.join(&entry_point.file);
                    if command_file.exists() {
                        match self.load_command_from_file(&command_file).await {
                            Ok(command) => {
                                commands.push(command);
                            }
                            Err(e) => {
                                warn!("Failed to load command from {}: {}", command_file.display(), e);
                            }
                        }
                    }
                }
                EntryPointType::Hook => {
                    // Load hook from file
                    let hook_file = plugin_dir.join(&entry_point.file);
                    if hook_file.exists() {
                        match self.load_hook_from_file(&hook_file).await {
                            Ok(hook) => {
                                hooks.push(hook);
                            }
                            Err(e) => {
                                warn!("Failed to load hook from {}: {}", hook_file.display(), e);
                            }
                        }
                    }
                }
                EntryPointType::Agent => {
                    // Load agent from file
                    let agent_file = plugin_dir.join(&entry_point.file);
                    if agent_file.exists() {
                        match self.load_agent_from_file(&agent_file).await {
                            Ok(agent) => {
                                agents.push(agent);
                            }
                            Err(e) => {
                                warn!("Failed to load agent from {}: {}", agent_file.display(), e);
                            }
                        }
                    }
                }
                EntryPointType::Tool => {
                    // Load tool from file
                    let tool_file = plugin_dir.join(&entry_point.file);
                    if tool_file.exists() {
                        match self.load_tool_from_file(&tool_file).await {
                            Ok(tool) => {
                                tools.push(tool);
                            }
                            Err(e) => {
                                warn!("Failed to load tool from {}: {}", tool_file.display(), e);
                            }
                        }
                    }
                }
                EntryPointType::WebComponent => {
                    // Web components are handled separately
                    debug!("Web component entry point found: {}", entry_point.name);
                }
            }
        }
        
        Ok(PluginInstance {
            manifest,
            commands,
            hooks,
            agents,
            tools,
        })
    }
    
    /// Load command from file
    async fn load_command_from_file(&self, file_path: &PathBuf) -> Result<Arc<dyn SlashCommand>> {
        // For now, we'll create a placeholder command
        // In a full implementation, this would load and execute the command script
        let content = fs::read_to_string(file_path)?;
        let command_name = file_path.file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        Ok(Arc::new(PluginCommand {
            name: command_name,
            description: "Plugin command".to_string(),
            content,
        }))
    }
    
    /// Load hook from file
    async fn load_hook_from_file(&self, file_path: &PathBuf) -> Result<Arc<dyn PluginHook>> {
        // For now, we'll create a placeholder hook
        // In a full implementation, this would load and execute the hook script
        let content = fs::read_to_string(file_path)?;
        let hook_name = file_path.file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        Ok(Arc::new(PluginHookImpl {
            name: hook_name,
            content,
        }))
    }
    
    /// Load agent from file
    async fn load_agent_from_file(&self, file_path: &PathBuf) -> Result<Arc<dyn PluginAgent>> {
        // For now, we'll create a placeholder agent
        // In a full implementation, this would load and execute the agent script
        let content = fs::read_to_string(file_path)?;
        let agent_name = file_path.file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        Ok(Arc::new(PluginAgentImpl {
            name: agent_name,
            content,
        }))
    }
    
    /// Load tool from file
    async fn load_tool_from_file(&self, file_path: &PathBuf) -> Result<Arc<dyn PluginTool>> {
        // For now, we'll create a placeholder tool
        // In a full implementation, this would load and execute the tool script
        let content = fs::read_to_string(file_path)?;
        let tool_name = file_path.file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        Ok(Arc::new(PluginToolImpl {
            name: tool_name,
            description: "Plugin tool".to_string(),
            content,
        }))
    }
    
    /// Get all loaded plugins
    pub async fn get_plugins(&self) -> Vec<PluginInstance> {
        let plugins = self.plugins.read().await;
        plugins.values().cloned().collect()
    }
    
    /// Get plugin by name
    pub async fn get_plugin(&self, name: &str) -> Option<PluginInstance> {
        let plugins = self.plugins.read().await;
        plugins.get(name).cloned()
    }
    
    /// Enable plugin
    pub async fn enable_plugin(&self, name: &str) -> Result<()> {
        let mut configs = self.configs.write().await;
        let config = configs.entry(name.to_string()).or_insert_with(|| PluginConfig {
            enabled: false,
            values: HashMap::new(),
        });
        config.enabled = true;
        Ok(())
    }
    
    /// Disable plugin
    pub async fn disable_plugin(&self, name: &str) -> Result<()> {
        let mut configs = self.configs.write().await;
        let config = configs.entry(name.to_string()).or_insert_with(|| PluginConfig {
            enabled: true,
            values: HashMap::new(),
        });
        config.enabled = false;
        Ok(())
    }
    
    /// Check if plugin is enabled
    pub async fn is_plugin_enabled(&self, name: &str) -> bool {
        let configs = self.configs.read().await;
        configs.get(name).map(|c| c.enabled).unwrap_or(true)
    }
    
    /// Get plugin configuration
    pub async fn get_plugin_config(&self, name: &str) -> Option<PluginConfig> {
        let configs = self.configs.read().await;
        configs.get(name).cloned()
    }
    
    /// Set plugin configuration
    pub async fn set_plugin_config(&self, name: &str, config: PluginConfig) -> Result<()> {
        let mut configs = self.configs.write().await;
        configs.insert(name.to_string(), config);
        Ok(())
    }
}

/// Plugin command implementation
struct PluginCommand {
    name: String,
    description: String,
    content: String,
}

#[async_trait::async_trait]
impl SlashCommand for PluginCommand {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        &self.description
    }
    
    fn usage(&self) -> &str {
        "Plugin command"
    }
    
    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        Ok(CommandResult::MessageAndContinue(
            format!("📝 Executing plugin command '{}' with args: {}\n\nContent:\n{}", self.name, args, self.content)
        ))
    }
}

/// Plugin hook implementation
struct PluginHookImpl {
    name: String,
    content: String,
}

#[async_trait::async_trait]
impl PluginHook for PluginHookImpl {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn execute(&self, context: &HookContext) -> Result<HookResult> {
        Ok(HookResult {
            success: true,
            data: Some(serde_json::json!({
                "hook": self.name,
                "context": context.hook_type,
                "content": self.content
            })),
            error: None,
        })
    }
}

/// Plugin agent implementation
struct PluginAgentImpl {
    name: String,
    content: String,
}

#[async_trait::async_trait]
impl PluginAgent for PluginAgentImpl {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn execute(&self, task: &AgentTask) -> Result<AgentResult> {
        Ok(AgentResult {
            success: true,
            data: Some(serde_json::json!({
                "agent": self.name,
                "task": task.task_type,
                "content": self.content
            })),
            error: None,
        })
    }
}

/// Plugin tool implementation
struct PluginToolImpl {
    name: String,
    description: String,
    content: String,
}

#[async_trait::async_trait]
impl PluginTool for PluginToolImpl {
    fn name(&self) -> &str {
        &self.name
    }
    
    fn description(&self) -> &str {
        &self.description
    }
    
    async fn execute(&self, params: &HashMap<String, serde_json::Value>) -> Result<ToolResult> {
        Ok(ToolResult {
            success: true,
            data: Some(serde_json::json!({
                "tool": self.name,
                "params": params,
                "content": self.content
            })),
            error: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_plugin_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = PluginManager::new(temp_dir.path().to_path_buf());
        assert_eq!(manager.plugin_dir, temp_dir.path());
    }

    #[tokio::test]
    async fn test_plugin_manifest_serialization() {
        let manifest = PluginManifest {
            name: "test-plugin".to_string(),
            version: "1.0.0".to_string(),
            description: "A test plugin".to_string(),
            author: Some("Test Author".to_string()),
            homepage: Some("https://example.com".to_string()),
            license: Some("MIT".to_string()),
            claude_code_version: Some(">=0.1.0".to_string()),
            entry_points: vec![
                PluginEntryPoint {
                    r#type: EntryPointType::Command,
                    name: "test-command".to_string(),
                    file: "commands/test.rs".to_string(),
                    description: Some("A test command".to_string()),
                }
            ],
            dependencies: Some(vec![
                PluginDependency {
                    name: "other-plugin".to_string(),
                    version: "^1.0.0".to_string(),
                    r#type: DependencyType::Plugin,
                }
            ]),
            config_schema: Some(serde_json::json!({
                "type": "object",
                "properties": {
                    "setting": {
                        "type": "string"
                    }
                }
            })),
        };

        let json = serde_json::to_string_pretty(&manifest).unwrap();
        let parsed: PluginManifest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(parsed.name, "test-plugin");
        assert_eq!(parsed.entry_points.len(), 1);
        assert_eq!(parsed.dependencies.as_ref().unwrap().len(), 1);
    }
}