//! Filesystem MCP Server
//!
//! An MCP server that provides filesystem operations through the Model Context Protocol

use crate::types::{Tool, ToolCall, ToolResult, ServerInfo, ServerCapabilities};

/// Filesystem MCP Server
pub struct FilesystemMcpServer {
    name: String,
    version: String,
    root_path: String,
}

impl FilesystemMcpServer {
    /// Create a new filesystem MCP server
    pub fn new(root_path: String) -> Self {
        Self {
            name: "filesystem-mcp-server".to_string(),
            version: "1.0.0".to_string(),
            root_path,
        }
    }

    /// Get server info
    pub fn server_info(&self) -> ServerInfo {
        ServerInfo {
            name: self.name.clone(),
            version: self.version.clone(),
            capabilities: ServerCapabilities {
                resources: true,
                tools: true,
                prompts: false,
            },
        }
    }

    /// List tools supported by this server
    pub fn list_tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "filesystem.read".to_string(),
                description: Some("Read a file from the filesystem".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to read"
                        }
                    },
                    "required": ["path"]
                }),
                output_type: Some("string".to_string()),
            },
            Tool {
                name: "filesystem.write".to_string(),
                description: Some("Write content to a file".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the file to write"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write to the file"
                        }
                    },
                    "required": ["path", "content"]
                }),
                output_type: Some("boolean".to_string()),
            },
            Tool {
                name: "filesystem.list".to_string(),
                description: Some("List files in a directory".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to the directory to list"
                        }
                    },
                    "required": ["path"]
                }),
                output_type: Some("array".to_string()),
            },
        ]
    }

    /// Execute a tool call
    pub async fn call_tool(&self, tool_call: ToolCall) -> ToolResult {
        match tool_call.name.as_str() {
            "filesystem.read" => {
                let path = tool_call.arguments.get("path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if path.is_empty() {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is required".to_string()),
                    };
                }

                // Ensure path is within allowed root
                let full_path = std::path::Path::new(&self.root_path).join(&path);
                if !full_path.starts_with(&self.root_path) {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is outside allowed root".to_string()),
                    };
                }

                match tokio::fs::read_to_string(&full_path).await {
                    Ok(content) => ToolResult {
                        success: true,
                        result: Some(serde_json::json!(content)),
                        error: None,
                    },
                    Err(e) => ToolResult {
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "filesystem.write" => {
                let path = tool_call.arguments.get("path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                let content = tool_call.arguments.get("content")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if path.is_empty() {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is required".to_string()),
                    };
                }

                // Ensure path is within allowed root
                let full_path = std::path::Path::new(&self.root_path).join(&path);
                if !full_path.starts_with(&self.root_path) {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is outside allowed root".to_string()),
                    };
                }

                // Create parent directories if they don't exist
                if let Some(parent) = full_path.parent() {
                    if let Err(e) = tokio::fs::create_dir_all(parent).await {
                        return ToolResult {
                            success: false,
                            result: None,
                            error: Some(format!("Failed to create directories: {}", e)),
                        };
                    }
                }

                match tokio::fs::write(&full_path, &content).await {
                    Ok(()) => ToolResult {
                        success: true,
                        result: Some(serde_json::json!(true)),
                        error: None,
                    },
                    Err(e) => ToolResult {
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "filesystem.list" => {
                let path = tool_call.arguments.get("path")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if path.is_empty() {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is required".to_string()),
                    };
                }

                // Ensure path is within allowed root
                let full_path = std::path::Path::new(&self.root_path).join(&path);
                if !full_path.starts_with(&self.root_path) {
                    return ToolResult {
                        success: false,
                        result: None,
                        error: Some("Path is outside allowed root".to_string()),
                    };
                }

                match tokio::fs::read_dir(&full_path).await {
                    Ok(mut dir) => {
                        let mut entries = Vec::new();
                        while let Ok(Some(entry)) = dir.next_entry().await {
                            entries.push(serde_json::json!({
                                "name": entry.file_name().to_string_lossy().to_string(),
                                "path": entry.path().to_string_lossy().to_string(),
                                "is_dir": entry.file_type().await.map(|ft| ft.is_dir()).unwrap_or(false),
                                "size": entry.metadata().await.ok().map(|m| m.len()),
                            }));
                        }

                        ToolResult {
                            success: true,
                            result: Some(serde_json::json!(entries)),
                            error: None,
                        }
                    }
                    Err(e) => ToolResult {
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            _ => ToolResult {
                success: false,
                result: None,
                error: Some(format!("Unknown tool: {}", tool_call.name)),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_filesystem_server_creation() {
        let server = FilesystemMcpServer::new("/tmp".to_string());
        assert_eq!(server.name, "filesystem-mcp-server");
    }

    #[tokio::test]
    async fn test_list_tools() {
        let server = FilesystemMcpServer::new("/tmp".to_string());
        let tools = server.list_tools();
        assert_eq!(tools.len(), 3);
        assert_eq!(tools[0].name, "filesystem.read");
    }
}