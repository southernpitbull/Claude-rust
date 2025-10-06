//! Tool Executor
//!
//! Handles tool execution with permissions and validation

use crate::registry::ToolRegistry;
use crate::tool::Tool;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;
use tracing::{debug, info, warn};

/// Tool execution error
#[derive(Debug, Error)]
pub enum ToolExecutionError {
    #[error("Tool '{0}' not found")]
    ToolNotFound(String),

    #[error("Permission denied for tool '{0}'")]
    PermissionDenied(String),

    #[error("Tool '{0}' is not available")]
    ToolNotAvailable(String),

    #[error("Parameter validation failed: {0}")]
    ValidationError(String),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub tool_name: String,
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u128,
}

impl ToolExecutionResult {
    /// Create a success result
    pub fn success(tool_name: String, result: serde_json::Value, execution_time_ms: u128) -> Self {
        Self {
            tool_name,
            success: true,
            result: Some(result),
            error: None,
            execution_time_ms,
        }
    }

    /// Create an error result
    pub fn error(tool_name: String, error: String, execution_time_ms: u128) -> Self {
        Self {
            tool_name,
            success: false,
            result: None,
            error: Some(error),
            execution_time_ms,
        }
    }
}

/// Tool permissions
#[derive(Debug, Clone)]
pub struct ToolPermissions {
    allowed_tools: Option<Vec<String>>,
    blocked_tools: Vec<String>,
    allow_dangerous: bool,
    auto_approve: bool,
}

impl ToolPermissions {
    /// Create permissive permissions (allow all)
    pub fn permissive() -> Self {
        Self {
            allowed_tools: None,
            blocked_tools: Vec::new(),
            allow_dangerous: false,
            auto_approve: true,
        }
    }

    /// Create restrictive permissions (allow none)
    pub fn restrictive() -> Self {
        Self {
            allowed_tools: Some(Vec::new()),
            blocked_tools: Vec::new(),
            allow_dangerous: false,
            auto_approve: false,
        }
    }

    /// Allow specific tools
    pub fn allow_tools(mut self, tools: Vec<String>) -> Self {
        self.allowed_tools = Some(tools);
        self
    }

    /// Block specific tools
    pub fn block_tools(mut self, tools: Vec<String>) -> Self {
        self.blocked_tools = tools;
        self
    }

    /// Allow dangerous tools
    pub fn allow_dangerous(mut self) -> Self {
        self.allow_dangerous = true;
        self
    }

    /// Enable auto-approval
    pub fn auto_approve(mut self) -> Self {
        self.auto_approve = true;
        self
    }

    /// Check if a tool is allowed
    pub fn is_allowed(&self, tool: &Arc<dyn Tool>) -> bool {
        let name = tool.name();

        // Check blocked list
        if self.blocked_tools.contains(&name.to_string()) {
            return false;
        }

        // Check dangerous tools
        if tool.definition().dangerous && !self.allow_dangerous {
            return false;
        }

        // Check allowed list
        if let Some(ref allowed) = self.allowed_tools {
            allowed.contains(&name.to_string())
        } else {
            true
        }
    }
}

impl Default for ToolPermissions {
    fn default() -> Self {
        Self::permissive()
    }
}

/// Tool executor
pub struct ToolExecutor {
    registry: Arc<ToolRegistry>,
    permissions: ToolPermissions,
}

impl ToolExecutor {
    /// Create a new tool executor
    pub fn new(registry: Arc<ToolRegistry>, permissions: ToolPermissions) -> Self {
        Self {
            registry,
            permissions,
        }
    }

    /// Execute a tool
    pub async fn execute(
        &self,
        tool_name: &str,
        params: HashMap<String, serde_json::Value>,
    ) -> Result<ToolExecutionResult, ToolExecutionError> {
        let start = std::time::Instant::now();

        debug!("Executing tool: {}", tool_name);

        // Get tool from registry
        let tool = self.registry.get(tool_name).await
            .ok_or_else(|| ToolExecutionError::ToolNotFound(tool_name.to_string()))?;

        // Check if tool is available
        if !tool.is_available() {
            warn!("Tool '{}' is not available", tool_name);
            return Err(ToolExecutionError::ToolNotAvailable(tool_name.to_string()));
        }

        // Check permissions
        if !self.permissions.is_allowed(&tool) {
            warn!("Permission denied for tool '{}'", tool_name);
            return Err(ToolExecutionError::PermissionDenied(tool_name.to_string()));
        }

        // Validate parameters
        tool.definition()
            .validate_parameters(&params)
            .map_err(ToolExecutionError::ValidationError)?;

        // Execute tool
        match tool.execute(params).await {
            Ok(result) => {
                let execution_time = start.elapsed().as_millis();
                info!("Tool '{}' executed successfully in {}ms", tool_name, execution_time);
                Ok(ToolExecutionResult::success(
                    tool_name.to_string(),
                    result,
                    execution_time,
                ))
            }
            Err(e) => {
                let execution_time = start.elapsed().as_millis();
                warn!("Tool '{}' execution failed: {}", tool_name, e);
                Ok(ToolExecutionResult::error(
                    tool_name.to_string(),
                    e,
                    execution_time,
                ))
            }
        }
    }

    /// Execute multiple tools in sequence
    pub async fn execute_batch(
        &self,
        executions: Vec<(String, HashMap<String, serde_json::Value>)>,
    ) -> Vec<ToolExecutionResult> {
        let mut results = Vec::new();

        for (tool_name, params) in executions {
            match self.execute(&tool_name, params).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    results.push(ToolExecutionResult::error(
                        tool_name,
                        e.to_string(),
                        0,
                    ));
                }
            }
        }

        results
    }

    /// Check if a tool can be executed
    pub async fn can_execute(&self, tool_name: &str) -> bool {
        if let Some(tool) = self.registry.get(tool_name).await {
            tool.is_available() && self.permissions.is_allowed(&tool)
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool::{ToolDefinition, ToolCategory, ToolParameter, ToolParameterType};
    use async_trait::async_trait;

    struct TestTool {
        definition: ToolDefinition,
    }

    #[async_trait]
    impl Tool for TestTool {
        fn definition(&self) -> &ToolDefinition {
            &self.definition
        }

        async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
            Ok(serde_json::json!({
                "params": params,
                "status": "success"
            }))
        }
    }

    #[tokio::test]
    async fn test_tool_execution() {
        let registry = Arc::new(ToolRegistry::new());

        let tool = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool", ToolCategory::Custom)
                .parameter(ToolParameter::required("input", "Input", ToolParameterType::String)),
        });

        registry.register(tool).await.unwrap();

        let executor = ToolExecutor::new(registry, ToolPermissions::permissive());

        let mut params = HashMap::new();
        params.insert("input".to_string(), serde_json::json!("hello"));

        let result = executor.execute("test-tool", params).await.unwrap();
        assert!(result.success);
        assert!(result.result.is_some());
    }

    #[tokio::test]
    async fn test_permission_denied() {
        let registry = Arc::new(ToolRegistry::new());

        let tool = Arc::new(TestTool {
            definition: ToolDefinition::new("blocked-tool", "Blocked tool", ToolCategory::Custom),
        });

        registry.register(tool).await.unwrap();

        let permissions = ToolPermissions::restrictive();
        let executor = ToolExecutor::new(registry, permissions);

        let params = HashMap::new();
        let result = executor.execute("blocked-tool", params).await;

        assert!(result.is_err());
        assert!(matches!(result, Err(ToolExecutionError::PermissionDenied(_))));
    }

    #[tokio::test]
    async fn test_validation_error() {
        let registry = Arc::new(ToolRegistry::new());

        let tool = Arc::new(TestTool {
            definition: ToolDefinition::new("test-tool", "Test tool", ToolCategory::Custom)
                .parameter(ToolParameter::required("input", "Input", ToolParameterType::String)),
        });

        registry.register(tool).await.unwrap();

        let executor = ToolExecutor::new(registry, ToolPermissions::permissive());

        // Missing required parameter
        let params = HashMap::new();
        let result = executor.execute("test-tool", params).await;

        assert!(result.is_err());
        assert!(matches!(result, Err(ToolExecutionError::ValidationError(_))));
    }
}
