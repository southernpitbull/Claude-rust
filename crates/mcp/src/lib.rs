//! Model Context Protocol (MCP) Implementation
//!
//! This module provides MCP client functionality for connecting to and
//! communicating with MCP servers.

pub mod client;
pub mod protocol;
pub mod server;
pub mod types;

pub use client::McpClient;
pub use protocol::{McpRequest, McpResponse};
pub use server::{ServerConfig, McpConfig};
pub use types::{Resource, Tool, Prompt};

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
