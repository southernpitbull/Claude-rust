//! MCP Protocol Messages

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::{Resource, Tool, Prompt, ToolCall, ToolResult, ServerInfo};

/// MCP Request Message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "params")]
pub enum McpRequest {
    /// Initialize connection
    #[serde(rename = "initialize")]
    Initialize {
        /// Protocol version
        protocol_version: String,

        /// Client info
        client_info: ClientInfo,
    },

    /// List available resources
    #[serde(rename = "resources/list")]
    ListResources,

    /// Read a resource
    #[serde(rename = "resources/read")]
    ReadResource {
        /// Resource URI
        uri: String,
    },

    /// List available tools
    #[serde(rename = "tools/list")]
    ListTools,

    /// Call a tool
    #[serde(rename = "tools/call")]
    CallTool(ToolCall),

    /// List available prompts
    #[serde(rename = "prompts/list")]
    ListPrompts,

    /// Get a prompt
    #[serde(rename = "prompts/get")]
    GetPrompt {
        /// Prompt name
        name: String,

        /// Prompt arguments
        arguments: Option<Value>,
    },

    /// Ping server
    #[serde(rename = "ping")]
    Ping,
}

/// MCP Response Message
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum McpResponse {
    /// Initialize response
    #[serde(rename = "initialized")]
    Initialized {
        /// Server info
        server_info: ServerInfo,
    },

    /// Resource list response
    #[serde(rename = "resources")]
    Resources {
        /// List of resources
        resources: Vec<Resource>,
    },

    /// Resource content response
    #[serde(rename = "resource")]
    Resource(Resource),

    /// Tool list response
    #[serde(rename = "tools")]
    Tools {
        /// List of tools
        tools: Vec<Tool>,
    },

    /// Tool call result
    #[serde(rename = "tool_result")]
    ToolResult(ToolResult),

    /// Prompt list response
    #[serde(rename = "prompts")]
    Prompts {
        /// List of prompts
        prompts: Vec<Prompt>,
    },

    /// Prompt response
    #[serde(rename = "prompt")]
    Prompt(Prompt),

    /// Pong response
    #[serde(rename = "pong")]
    Pong,

    /// Error response
    #[serde(rename = "error")]
    Error {
        /// Error code
        code: i32,

        /// Error message
        message: String,
    },
}

/// Client Information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    /// Client name
    pub name: String,

    /// Client version
    pub version: String,
}

impl Default for ClientInfo {
    fn default() -> Self {
        Self {
            name: "claude-code".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

/// MCP Message wrapper (for JSON-RPC style communication)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// JSON-RPC version
    pub jsonrpc: String,

    /// Message ID (for request/response matching)
    pub id: Option<u64>,

    /// Request or response data
    #[serde(flatten)]
    pub data: MessageData,
}

/// Message data (request or response)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageData {
    /// Request message
    Request(McpRequest),

    /// Response message
    Response { result: McpResponse },
}

impl Message {
    /// Create a new request message
    pub fn request(id: u64, request: McpRequest) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            data: MessageData::Request(request),
        }
    }

    /// Create a new response message
    pub fn response(id: u64, response: McpResponse) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            data: MessageData::Response { result: response },
        }
    }
}
