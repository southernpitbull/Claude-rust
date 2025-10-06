//! Built-in Tools
//!
//! Standard tools provided by Claude-Rust

use crate::registry::ToolRegistry;
use crate::tool::{Tool, ToolCategory, ToolDefinition, ToolParameter, ToolParameterType};
use async_trait::async_trait;
use claude_rust_core::{FileOps, CommandExecutor, CommandOptions};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

/// File read tool
pub struct FileReadTool {
    definition: ToolDefinition,
}

impl FileReadTool {
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "file-read",
            "Read contents of a file",
            ToolCategory::FileOperations,
        )
        .parameter(ToolParameter::required("file_path", "Path to the file", ToolParameterType::String))
        .parameter(ToolParameter::optional("offset", "Line offset to start reading", ToolParameterType::Number))
        .parameter(ToolParameter::optional("limit", "Maximum number of lines to read", ToolParameterType::Number));

        Self { definition }
    }
}

impl Default for FileReadTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileReadTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }

    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
        let file_path = params.get("file_path")
            .and_then(|v| v.as_str())
            .ok_or("file_path is required")?;

        let content = FileOps::read_file(file_path).await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Apply offset and limit if provided
        let offset = params.get("offset")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;

        let limit = params.get("limit")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize);

        let lines: Vec<&str> = content.lines().collect();
        let selected_lines = if let Some(limit) = limit {
            lines.iter().skip(offset).take(limit).copied().collect::<Vec<_>>()
        } else {
            lines.iter().skip(offset).copied().collect::<Vec<_>>()
        };

        Ok(serde_json::json!({
            "content": selected_lines.join("\n"),
            "lines": selected_lines.len(),
            "total_lines": lines.len(),
        }))
    }
}

/// File write tool
pub struct FileWriteTool {
    definition: ToolDefinition,
}

impl FileWriteTool {
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "file-write",
            "Write content to a file",
            ToolCategory::FileOperations,
        )
        .parameter(ToolParameter::required("file_path", "Path to the file", ToolParameterType::String))
        .parameter(ToolParameter::required("content", "Content to write", ToolParameterType::String))
        .requires_permission()
        .dangerous();

        Self { definition }
    }
}

impl Default for FileWriteTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileWriteTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }

    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
        let file_path = params.get("file_path")
            .and_then(|v| v.as_str())
            .ok_or("file_path is required")?;

        let content = params.get("content")
            .and_then(|v| v.as_str())
            .ok_or("content is required")?;

        FileOps::write_file(file_path, content).await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(serde_json::json!({
            "status": "success",
            "path": file_path,
            "bytes_written": content.len(),
        }))
    }
}

/// File edit tool
pub struct FileEditTool {
    definition: ToolDefinition,
}

impl FileEditTool {
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "file-edit",
            "Edit a file by replacing text",
            ToolCategory::FileOperations,
        )
        .parameter(ToolParameter::required("file_path", "Path to the file", ToolParameterType::String))
        .parameter(ToolParameter::required("old_string", "Text to replace", ToolParameterType::String))
        .parameter(ToolParameter::required("new_string", "Replacement text", ToolParameterType::String))
        .parameter(ToolParameter::optional("replace_all", "Replace all occurrences", ToolParameterType::Boolean))
        .requires_permission()
        .dangerous();

        Self { definition }
    }
}

impl Default for FileEditTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for FileEditTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }

    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
        let file_path = params.get("file_path")
            .and_then(|v| v.as_str())
            .ok_or("file_path is required")?;

        let old_string = params.get("old_string")
            .and_then(|v| v.as_str())
            .ok_or("old_string is required")?;

        let new_string = params.get("new_string")
            .and_then(|v| v.as_str())
            .ok_or("new_string is required")?;

        let replace_all = params.get("replace_all")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Read file
        let content = FileOps::read_file(file_path).await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Replace text
        let new_content = if replace_all {
            content.replace(old_string, new_string)
        } else {
            content.replacen(old_string, new_string, 1)
        };

        // Write back
        FileOps::write_file(file_path, &new_content).await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(serde_json::json!({
            "status": "success",
            "path": file_path,
            "replacements": if replace_all {
                content.matches(old_string).count()
            } else {
                1
            },
        }))
    }
}

/// Bash execution tool
pub struct BashTool {
    definition: ToolDefinition,
}

impl BashTool {
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "bash",
            "Execute a bash command",
            ToolCategory::Execution,
        )
        .parameter(ToolParameter::required("command", "Command to execute", ToolParameterType::String))
        .parameter(ToolParameter::optional("working_dir", "Working directory", ToolParameterType::String))
        .parameter(ToolParameter::optional("timeout_ms", "Timeout in milliseconds", ToolParameterType::Number))
        .requires_permission()
        .dangerous();

        Self { definition }
    }
}

impl Default for BashTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for BashTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }

    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
        let command = params.get("command")
            .and_then(|v| v.as_str())
            .ok_or("command is required")?;

        let working_dir = params.get("working_dir")
            .and_then(|v| v.as_str())
            .map(PathBuf::from);

        let timeout_ms = params.get("timeout_ms")
            .and_then(|v| v.as_u64())
            .map(|ms| std::time::Duration::from_millis(ms));

        let executor = CommandExecutor::new();
        let mut options = CommandOptions::default();

        if let Some(dir) = working_dir {
            options.working_directory = Some(dir.to_string_lossy().to_string());
        }

        if let Some(timeout) = timeout_ms {
            options.timeout = timeout;
        }

        let output = executor.execute_with_options(command, options).await
            .map_err(|e| format!("Command execution failed: {}", e))?;

        Ok(serde_json::json!({
            "status": if output.success { "success" } else { "error" },
            "exit_code": output.exit_code,
            "stdout": output.stdout,
            "stderr": output.stderr,
        }))
    }
}

/// Web search tool (placeholder)
pub struct WebSearchTool {
    definition: ToolDefinition,
}

impl WebSearchTool {
    pub fn new() -> Self {
        let definition = ToolDefinition::new(
            "web-search",
            "Search the web (placeholder)",
            ToolCategory::Web,
        )
        .parameter(ToolParameter::required("query", "Search query", ToolParameterType::String))
        .parameter(ToolParameter::optional("max_results", "Maximum results", ToolParameterType::Number));

        Self { definition }
    }
}

impl Default for WebSearchTool {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Tool for WebSearchTool {
    fn definition(&self) -> &ToolDefinition {
        &self.definition
    }

    async fn execute(&self, params: HashMap<String, serde_json::Value>) -> Result<serde_json::Value, String> {
        let query = params.get("query")
            .and_then(|v| v.as_str())
            .ok_or("query is required")?;

        // Placeholder implementation
        Ok(serde_json::json!({
            "status": "not_implemented",
            "query": query,
            "message": "Web search not yet implemented",
        }))
    }

    fn is_available(&self) -> bool {
        false // Not yet implemented
    }
}

/// Register all built-in tools
pub async fn register_builtin_tools(registry: &ToolRegistry) -> Result<(), Box<dyn std::error::Error>> {
    registry.register(Arc::new(FileReadTool::new())).await?;
    registry.register(Arc::new(FileWriteTool::new())).await?;
    registry.register(Arc::new(FileEditTool::new())).await?;
    registry.register(Arc::new(BashTool::new())).await?;
    registry.register(Arc::new(WebSearchTool::new())).await?;

    Ok(())
}
