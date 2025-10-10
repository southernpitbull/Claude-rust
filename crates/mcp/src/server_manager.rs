//! MCP Server Manager
//!
//! Manages multiple MCP server instances

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::{FilesystemMcpServer, GitMcpServer};
use crate::types::{ToolCall, ToolResult};

/// MCP Server Type
#[derive(Debug, Clone)]
pub enum McpServerType {
    Filesystem,
    Git,
    WebSearch,
}

/// Enum wrapper for different MCP server types
pub enum McpServer {
    Filesystem(FilesystemMcpServer),
    Git(GitMcpServer),
}

impl McpServer {
    /// Call a tool on the server
    pub async fn call_tool(&self, tool_call: ToolCall) -> ToolResult {
        match self {
            McpServer::Filesystem(server) => server.call_tool(tool_call).await,
            McpServer::Git(server) => server.call_tool(tool_call).await,
        }
    }
}

/// MCP Server Manager
pub struct McpServerManager {
    /// Map of server names to server instances
    servers: Arc<RwLock<HashMap<String, Arc<McpServer>>>>,
}

impl McpServerManager {
    /// Create a new server manager
    pub fn new() -> Self {
        Self {
            servers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a filesystem server
    pub async fn register_filesystem_server(&self, name: &str, root_path: String) -> Result<(), String> {
        let server = Arc::new(McpServer::Filesystem(FilesystemMcpServer::new(root_path)));
        let mut servers = self.servers.write().await;
        servers.insert(name.to_string(), server);
        Ok(())
    }

    /// Register a git server
    pub async fn register_git_server(&self, name: &str, repo_path: String) -> Result<(), String> {
        let server = Arc::new(McpServer::Git(GitMcpServer::new(repo_path)));
        let mut servers = self.servers.write().await;
        servers.insert(name.to_string(), server);
        Ok(())
    }

    /// Call a tool on one of the registered servers
    pub async fn call_tool(&self, server_name: &str, tool_call: ToolCall) -> ToolResult {
        let servers = self.servers.read().await;
        if let Some(server) = servers.get(server_name) {
            server.call_tool(tool_call).await
        } else {
            ToolResult {
                success: false,
                result: None,
                error: Some(format!("Server '{}' not found", server_name)),
            }
        }
    }

    /// Get all registered server names
    pub async fn get_server_names(&self) -> Vec<String> {
        let servers = self.servers.read().await;
        servers.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_manager() {
        let manager = McpServerManager::new();
        assert_eq!(manager.get_server_names().await.len(), 0);

        // Register a filesystem server (if we can)
        // Note: Skip this test if the root path doesn't exist
        if std::path::Path::new(".").exists() {
            let result = manager.register_filesystem_server("test-fs", ".".to_string()).await;
            assert!(result.is_ok());
            assert_eq!(manager.get_server_names().await, vec!["test-fs"]);
        }
    }
}