//! Git MCP Server
//!
//! An MCP server that provides Git operations through the Model Context Protocol

use std::process::Stdio;
use tokio::process::Command;

use crate::types::{Tool, ToolCall, ToolResult, ServerInfo, ServerCapabilities};

/// Git MCP Server
pub struct GitMcpServer {
    name: String,
    version: String,
    repo_path: String,
}

impl GitMcpServer {
    /// Create a new git MCP server
    pub fn new(repo_path: String) -> Self {
        Self {
            name: "git-mcp-server".to_string(),
            version: "1.0.0".to_string(),
            repo_path,
        }
    }

    /// Get server info
    pub fn server_info(&self) -> ServerInfo {
        ServerInfo {
            name: self.name.clone(),
            version: self.version.clone(),
            capabilities: ServerCapabilities {
                resources: false, // Git server primarily offers tools
                tools: true,
                prompts: false,
            },
        }
    }

    /// List tools supported by this server
    pub fn list_tools(&self) -> Vec<Tool> {
        vec![
            Tool {
                name: "git.status".to_string(),
                description: Some("Get git status information".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {}
                }),
                output_type: Some("string".to_string()),
            },
            Tool {
                name: "git.commit".to_string(),
                description: Some("Create a git commit".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "message": {
                            "type": "string",
                            "description": "Commit message"
                        },
                        "all": {
                            "type": "boolean",
                            "description": "Whether to stage all changes before committing"
                        }
                    },
                    "required": ["message"]
                }),
                output_type: Some("string".to_string()),
            },
            Tool {
                name: "git.log".to_string(),
                description: Some("Get git log information".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "limit": {
                            "type": "integer",
                            "description": "Number of commits to return"
                        }
                    }
                }),
                output_type: Some("array".to_string()),
            },
            Tool {
                name: "git.diff".to_string(),
                description: Some("Get git diff information".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "staged": {
                            "type": "boolean",
                            "description": "Whether to show staged changes only"
                        }
                    }
                }),
                output_type: Some("string".to_string()),
            },
        ]
    }

    /// Execute a tool call
    pub async fn call_tool(&self, tool_call: ToolCall) -> ToolResult {
        match tool_call.name.as_str() {
            "git.status" => {
                match self.git_command(&["status", "--porcelain", "--branch"], Vec::new()).await {
                    Ok(output) => ToolResult {
                        success: true,
                        result: Some(serde_json::json!(output)),
                        error: None,
                    },
                    Err(e) => ToolResult {
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "git.commit" => {
                let message = tool_call.arguments.get("message")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                let all = tool_call.arguments.get("all")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                let mut args = vec!["commit"];
                
                if all {
                    args.push("-a");
                }
                
                args.push("-m");
                args.push(&message);

                match self.git_command(&args, Vec::new()).await {
                    Ok(output) => ToolResult {
                        success: true,
                        result: Some(serde_json::json!(output)),
                        error: None,
                    },
                    Err(e) => ToolResult {
                        success: false,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "git.log" => {
                let limit = tool_call.arguments.get("limit")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(10) as i32;

                let limit_str = limit.to_string();
                let args = vec!["log", "--oneline", "-n", &limit_str];

                match self.git_command(&args, Vec::new()).await {
                    Ok(output) => {
                        let lines: Vec<String> = output.lines().map(|s| s.to_string()).collect();
                        ToolResult {
                            success: true,
                            result: Some(serde_json::json!(lines)),
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
            "git.diff" => {
                let staged = tool_call.arguments.get("staged")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);

                let args = if staged {
                    vec!["diff", "--cached"]
                } else {
                    vec!["diff"]
                };

                match self.git_command(&args, Vec::new()).await {
                    Ok(output) => ToolResult {
                        success: true,
                        result: Some(serde_json::json!(output)),
                        error: None,
                    },
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

    /// Execute a git command
    async fn git_command(&self, args: &[&str], envs: Vec<(&str, &str)>) -> Result<String, String> {
        let mut cmd = Command::new("git");
        
        cmd.current_dir(&self.repo_path)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        for (key, value) in envs {
            cmd.env(key, value);
        }

        let output = cmd.spawn()
            .map_err(|e| format!("Failed to start git command: {}", e))?
            .wait_with_output()
            .await
            .map_err(|e| format!("Failed to wait for git command: {}", e))?;

        if output.status.success() {
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_git_server_creation() {
        let server = GitMcpServer::new(".".to_string());
        assert_eq!(server.name, "git-mcp-server");
    }

    #[tokio::test]
    async fn test_list_git_tools() {
        let server = GitMcpServer::new(".".to_string());
        let tools = server.list_tools();
        assert_eq!(tools.len(), 4);
        assert_eq!(tools[0].name, "git.status");
    }
}