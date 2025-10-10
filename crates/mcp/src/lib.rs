//! Model Context Protocol (MCP) Implementation
//!
//! This module provides MCP client functionality for connecting to and
//! communicating with MCP servers.

pub mod client;
pub mod protocol;
pub mod server;
pub mod types;
pub mod filesystem_server;
pub mod git_server;
pub mod server_manager;

pub use client::McpClient;
pub use protocol::{McpRequest, McpResponse};
pub use server::{ServerConfig, McpConfig};
pub use types::{Resource, Tool, Prompt};
pub use filesystem_server::FilesystemMcpServer;
pub use git_server::GitMcpServer;
pub use server_manager::{McpServerManager, McpServer};

use anyhow::Result;

/// MCP protocol version supported
pub const MCP_VERSION: &str = "1.0.0";

/// Initialize MCP subsystem
pub fn init() -> Result<()> {
    tracing::debug!("Initializing MCP subsystem");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init() {
        assert!(init().is_ok());
    }
}
