//! Tool Execution Integration
//!
//! Handles tool calls from AI responses and executes them safely

use anyhow::{bail, Context, Result};
use claude_code_tools::{BashTool, FileReadTool, FileWriteTool, Tool};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Represents a tool call request from AI
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ToolCall {
    pub id: String,
    pub function: FunctionCall,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct FunctionCall {
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Result of tool execution
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct ToolResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// Tool executor that manages available tools and executes calls
pub struct ToolExecutor {
    tools: Arc<RwLock<HashMap<String, Box<dyn Tool>>>>,
    permission_manager: Arc<RwLock<PermissionManager>>,
}

/// Manages tool execution permissions
pub struct PermissionManager {
    /// Always-allowed tools (no confirmation needed)
    allowed: Vec<String>,
    /// Always-denied tools
    denied: Vec<String>,
    /// One-time approvals for current session
    session_approvals: HashMap<String, bool>,
}

impl PermissionManager {
    pub fn new() -> Self {
        Self {
            allowed: vec!["read_file".to_string()], // Read-only operations safe by default
            denied: Vec::new(),
            session_approvals: HashMap::new(),
        }
    }

    /// Check if a tool is allowed to execute
    pub async fn is_allowed(&self, tool_name: &str) -> bool {
        // Check explicit deny list
        if self.denied.contains(&tool_name.to_string()) {
            return false;
        }

        // Check always-allowed list
        if self.allowed.contains(&tool_name.to_string()) {
            return true;
        }

        // Check session approvals
        self.session_approvals.get(tool_name).copied().unwrap_or(false)
    }

    /// Request permission for a tool (in real impl, would prompt user)
    pub async fn request_permission(&mut self, tool_name: &str, _description: &str) -> Result<bool> {
        // TODO: Integrate with terminal UI to prompt user
        // For now, auto-approve non-destructive tools
        let approved = match tool_name {
            "read_file" | "bash" => true,
            "write_file" | "delete_file" => false, // Require explicit approval
            _ => false,
        };

        if approved {
            self.session_approvals.insert(tool_name.to_string(), true);
        }

        Ok(approved)
    }

    pub fn approve_tool(&mut self, tool_name: &str) {
        self.allowed.push(tool_name.to_string());
    }

    pub fn deny_tool(&mut self, tool_name: &str) {
        self.denied.push(tool_name.to_string());
    }
}

impl ToolExecutor {
    pub fn new() -> Self {
        let mut tools: HashMap<String, Box<dyn Tool>> = HashMap::new();

        // Register built-in tools
        tools.insert("bash".to_string(), Box::new(BashTool::new()));
        tools.insert("file-read".to_string(), Box::new(FileReadTool::new()));
        tools.insert("file-write".to_string(), Box::new(FileWriteTool::new()));

        Self {
            tools: Arc::new(RwLock::new(tools)),
            permission_manager: Arc::new(RwLock::new(PermissionManager::new())),
        }
    }

    /// Execute a tool call from AI response
    pub async fn execute(&self, tool_call: &ToolCall) -> Result<ToolResult> {
        let tool_name = &tool_call.function.name;

        debug!("Executing tool: {}", tool_name);

        // Check permissions
        let mut permission_mgr = self.permission_manager.write().await;
        if !permission_mgr.is_allowed(tool_name).await {
            // Request permission
            let approved = permission_mgr
                .request_permission(tool_name, &tool_call.function.arguments.to_string())
                .await?;

            if !approved {
                return Ok(ToolResult {
                    success: false,
                    output: None,
                    error: Some("Permission denied by user".to_string()),
                });
            }
        }
        drop(permission_mgr);

        // Get tool
        let tools = self.tools.read().await;
        let tool = tools.get(tool_name)
            .with_context(|| format!("Unknown tool: {}", tool_name))?;

        // Convert arguments to HashMap
        let params: HashMap<String, serde_json::Value> = if let Some(obj) = tool_call.function.arguments.as_object() {
            obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
        } else {
            HashMap::new()
        };

        // Execute tool
        let result = match tool.execute(params).await {
            Ok(output) => ToolResult {
                success: true,
                output: Some(output.to_string()),
                error: None,
            },
            Err(e) => ToolResult {
                success: false,
                output: None,
                error: Some(e),
            },
        };

        info!("Tool {} executed: success={}", tool_name, result.success);

        Ok(result)
    }

    /// Execute multiple tool calls
    pub async fn execute_all(&self, tool_calls: &[ToolCall]) -> Result<Vec<ToolResult>> {
        let mut results = Vec::new();

        for call in tool_calls {
            let result = self.execute(call).await?;

            // Stop on first failure if critical
            if !result.success && call.function.name.starts_with("critical_") {
                bail!("Critical tool failed: {}", call.function.name);
            }

            results.push(result);
        }

        Ok(results)
    }

    /// Get permission manager for external configuration
    pub fn permission_manager(&self) -> Arc<RwLock<PermissionManager>> {
        self.permission_manager.clone()
    }

    /// Register a custom tool
    pub async fn register_tool(&self, name: String, tool: Box<dyn Tool>) {
        let mut tools = self.tools.write().await;
        tools.insert(name, tool);
    }

    /// List available tools
    pub async fn list_tools(&self) -> Vec<String> {
        let tools = self.tools.read().await;
        tools.keys().cloned().collect()
    }
}

impl Default for ToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_permission_manager() {
        let mut mgr = PermissionManager::new();

        // Read file should be auto-allowed
        assert!(mgr.is_allowed("read_file").await);

        // Write file should require approval
        assert!(!mgr.is_allowed("write_file").await);

        // Approve it
        mgr.approve_tool("write_file");
        assert!(mgr.is_allowed("write_file").await);
    }

    #[tokio::test]
    async fn test_tool_executor_creation() {
        let executor = ToolExecutor::new();
        let tools = executor.list_tools().await;

        assert!(tools.contains(&"bash".to_string()));
        assert!(tools.contains(&"read_file".to_string()));
        assert!(tools.contains(&"write_file".to_string()));
    }
}
