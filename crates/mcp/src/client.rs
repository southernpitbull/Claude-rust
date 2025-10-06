//! MCP Client Implementation

use anyhow::{Context, Result, bail};
use async_channel::{Sender, Receiver, unbounded};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::{debug, error, info, warn};

use crate::protocol::{McpRequest, McpResponse, Message, MessageData, ClientInfo};
use crate::server::ServerConfig;
use crate::types::{Resource, Tool, Prompt, ToolCall, ToolResult, ServerInfo};

/// MCP Client for communicating with MCP servers
pub struct McpClient {
    /// Server configuration
    config: ServerConfig,

    /// Server process handle
    process: Arc<Mutex<Option<Child>>>,

    /// Request sender
    request_tx: Sender<Message>,

    /// Response receiver
    response_rx: Receiver<Message>,

    /// Next request ID
    next_id: Arc<Mutex<u64>>,

    /// Server information
    server_info: Arc<Mutex<Option<ServerInfo>>>,

    /// Available resources cache
    resources: Arc<Mutex<Vec<Resource>>>,

    /// Available tools cache
    tools: Arc<Mutex<Vec<Tool>>>,

    /// Available prompts cache
    prompts: Arc<Mutex<Vec<Prompt>>>,
}

impl McpClient {
    /// Create a new MCP client
    pub fn new(config: ServerConfig) -> Result<Self> {
        let (request_tx, _request_rx) = unbounded();
        let (response_tx, response_rx) = unbounded();

        Ok(Self {
            config,
            process: Arc::new(Mutex::new(None)),
            request_tx,
            response_rx,
            next_id: Arc::new(Mutex::new(1)),
            server_info: Arc::new(Mutex::new(None)),
            resources: Arc::new(Mutex::new(Vec::new())),
            tools: Arc::new(Mutex::new(Vec::new())),
            prompts: Arc::new(Mutex::new(Vec::new())),
        })
    }

    /// Start the MCP server process
    pub async fn connect(&mut self) -> Result<()> {
        info!("Connecting to MCP server: {}", self.config.name);

        // Build command
        let mut cmd = Command::new(&self.config.command);
        cmd.args(&self.config.args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        // Add environment variables
        for (key, value) in &self.config.env {
            cmd.env(key, value);
        }

        // Set working directory
        if let Some(ref cwd) = self.config.cwd {
            cmd.current_dir(cwd);
        }

        // Spawn process
        let mut child = cmd.spawn()
            .with_context(|| format!("Failed to spawn MCP server: {}", self.config.name))?;

        // Get stdin/stdout
        let stdin = child.stdin.take()
            .context("Failed to get server stdin")?;
        let stdout = child.stdout.take()
            .context("Failed to get server stdout")?;

        // Store process handle
        *self.process.lock().await = Some(child);

        // Start I/O tasks
        self.start_io_tasks(stdin, stdout).await;

        // Initialize connection
        self.initialize().await?;

        Ok(())
    }

    /// Initialize the MCP connection
    async fn initialize(&self) -> Result<ServerInfo> {
        debug!("Initializing MCP connection");

        let request = McpRequest::Initialize {
            protocol_version: crate::MCP_VERSION.to_string(),
            client_info: ClientInfo::default(),
        };

        let response = self.send_request(request).await?;

        match response {
            McpResponse::Initialized { server_info } => {
                info!("MCP server initialized: {}", server_info.name);
                *self.server_info.lock().await = Some(server_info.clone());
                Ok(server_info)
            }
            McpResponse::Error { code, message } => {
                bail!("MCP initialization failed (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to initialize request"),
        }
    }

    /// Disconnect from the server
    pub async fn disconnect(&mut self) -> Result<()> {
        info!("Disconnecting from MCP server: {}", self.config.name);

        if let Some(mut child) = self.process.lock().await.take() {
            child.kill().await.ok();
        }

        Ok(())
    }

    /// List available resources
    pub async fn list_resources(&self) -> Result<Vec<Resource>> {
        debug!("Listing MCP resources");

        let response = self.send_request(McpRequest::ListResources).await?;

        match response {
            McpResponse::Resources { resources } => {
                *self.resources.lock().await = resources.clone();
                Ok(resources)
            }
            McpResponse::Error { code, message } => {
                bail!("Failed to list resources (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to list_resources request"),
        }
    }

    /// Read a resource
    pub async fn read_resource(&self, uri: &str) -> Result<Resource> {
        debug!("Reading MCP resource: {}", uri);

        let request = McpRequest::ReadResource {
            uri: uri.to_string(),
        };

        let response = self.send_request(request).await?;

        match response {
            McpResponse::Resource(resource) => Ok(resource),
            McpResponse::Error { code, message } => {
                bail!("Failed to read resource (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to read_resource request"),
        }
    }

    /// List available tools
    pub async fn list_tools(&self) -> Result<Vec<Tool>> {
        debug!("Listing MCP tools");

        let response = self.send_request(McpRequest::ListTools).await?;

        match response {
            McpResponse::Tools { tools } => {
                *self.tools.lock().await = tools.clone();
                Ok(tools)
            }
            McpResponse::Error { code, message } => {
                bail!("Failed to list tools (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to list_tools request"),
        }
    }

    /// Call a tool
    pub async fn call_tool(&self, tool_call: ToolCall) -> Result<ToolResult> {
        debug!("Calling MCP tool: {}", tool_call.name);

        let response = self.send_request(McpRequest::CallTool(tool_call)).await?;

        match response {
            McpResponse::ToolResult(result) => Ok(result),
            McpResponse::Error { code, message } => {
                bail!("Tool call failed (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to call_tool request"),
        }
    }

    /// List available prompts
    pub async fn list_prompts(&self) -> Result<Vec<Prompt>> {
        debug!("Listing MCP prompts");

        let response = self.send_request(McpRequest::ListPrompts).await?;

        match response {
            McpResponse::Prompts { prompts } => {
                *self.prompts.lock().await = prompts.clone();
                Ok(prompts)
            }
            McpResponse::Error { code, message } => {
                bail!("Failed to list prompts (code {}): {}", code, message)
            }
            _ => bail!("Unexpected response to list_prompts request"),
        }
    }

    /// Send a request and wait for response
    async fn send_request(&self, request: McpRequest) -> Result<McpResponse> {
        let id = {
            let mut next_id = self.next_id.lock().await;
            let id = *next_id;
            *next_id += 1;
            id
        };

        let message = Message::request(id, request);

        self.request_tx.send(message).await
            .context("Failed to send request")?;

        // Wait for response (simplified - in production, match by ID)
        let response_msg = self.response_rx.recv().await
            .context("Failed to receive response")?;

        match response_msg.data {
            MessageData::Response { result } => Ok(result),
            _ => bail!("Received non-response message"),
        }
    }

    /// Start I/O tasks for communication
    async fn start_io_tasks(
        &self,
        stdin: tokio::process::ChildStdin,
        stdout: tokio::process::ChildStdout,
    ) {
        // Create new channels for I/O tasks
        let (io_request_tx, io_request_rx) = unbounded::<Message>();
        let (io_response_tx, io_response_rx) = unbounded::<Message>();

        // Bridge main request channel to I/O request channel
        let request_rx_clone = self.request_tx.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                // This is a simplified version - in production, use proper channel bridging
            }
        });

        // Stdin task: write requests
        tokio::spawn(async move {
            let mut stdin = stdin;
            while let Ok(msg) = io_request_rx.recv().await {
                if let Ok(json) = serde_json::to_string(&msg) {
                    if stdin.write_all(json.as_bytes()).await.is_err() {
                        error!("Failed to write to server stdin");
                        break;
                    }
                    if stdin.write_all(b"\n").await.is_err() {
                        break;
                    }
                    if stdin.flush().await.is_err() {
                        break;
                    }
                }
            }
        });

        // Stdout task: read responses
        let response_tx_clone = self.response_rx.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();

            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(msg) = serde_json::from_str::<Message>(&line) {
                    if io_response_tx.send(msg).await.is_err() {
                        break;
                    }
                }
            }
        });
    }

    /// Get cached resources
    pub async fn cached_resources(&self) -> Vec<Resource> {
        self.resources.lock().await.clone()
    }

    /// Get cached tools
    pub async fn cached_tools(&self) -> Vec<Tool> {
        self.tools.lock().await.clone()
    }

    /// Get cached prompts
    pub async fn cached_prompts(&self) -> Vec<Prompt> {
        self.prompts.lock().await.clone()
    }

    /// Get server info
    pub async fn server_info(&self) -> Option<ServerInfo> {
        self.server_info.lock().await.clone()
    }
}

impl Drop for McpClient {
    fn drop(&mut self) {
        // Best effort cleanup
        if let Ok(mut process) = self.process.try_lock() {
            if let Some(mut child) = process.take() {
                let _ = child.start_kill();
            }
        }
    }
}
