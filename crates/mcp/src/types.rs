//! MCP Protocol Types

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// MCP Resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resource {
    /// Resource URI
    pub uri: String,

    /// Resource name
    pub name: String,

    /// Resource description
    pub description: Option<String>,

    /// Resource MIME type
    pub mime_type: Option<String>,

    /// Resource content
    pub content: Option<String>,
}

/// MCP Tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    /// Tool name
    pub name: String,

    /// Tool description
    pub description: Option<String>,

    /// Input schema (JSON Schema)
    pub input_schema: serde_json::Value,

    /// Tool output type
    pub output_type: Option<String>,
}

/// MCP Prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompt {
    /// Prompt name
    pub name: String,

    /// Prompt description
    pub description: Option<String>,

    /// Prompt arguments
    pub arguments: Option<Vec<PromptArgument>>,

    /// Prompt template
    pub template: String,
}

/// Prompt Argument
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptArgument {
    /// Argument name
    pub name: String,

    /// Argument description
    pub description: Option<String>,

    /// Whether argument is required
    pub required: bool,
}

/// Tool Call Request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    /// Tool name to call
    pub name: String,

    /// Tool arguments
    pub arguments: HashMap<String, serde_json::Value>,
}

/// Tool Call Result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    /// Whether the call succeeded
    pub success: bool,

    /// Result data (if successful)
    pub result: Option<serde_json::Value>,

    /// Error message (if failed)
    pub error: Option<String>,
}

/// Server Capabilities
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ServerCapabilities {
    /// Whether server supports resources
    pub resources: bool,

    /// Whether server supports tools
    pub tools: bool,

    /// Whether server supports prompts
    pub prompts: bool,
}

/// Server Info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    /// Server name
    pub name: String,

    /// Server version
    pub version: String,

    /// Server capabilities
    pub capabilities: ServerCapabilities,
}
