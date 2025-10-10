//! MCP Client Implementation
//!
//! Provides a robust client for communicating with Model Context Protocol (MCP) servers.
//! Features include:
//! - Automatic connection management with reconnection logic
//! - Request/response correlation using IDs
//! - Resource, tool, and prompt caching
//! - Graceful error handling and recovery
//! - Process lifecycle management

use anyhow::{Context, Result, bail};
use async_channel::{Sender, unbounded};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, RwLock};
use tokio::time::{sleep, timeout};
use tracing::{debug, error, info, warn};

use crate::protocol::{McpRequest, McpResponse, Message, MessageData, ClientInfo};
use crate::server::ServerConfig;
use crate::types::{Resource, Tool, Prompt, ToolCall, ToolResult, ServerInfo};

/// Connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Failed,
}

/// MCP Client for communicating with MCP servers
pub struct McpClient {
    /// Server configuration
    config: ServerConfig,

    /// Server process handle
    process: Arc<Mutex<Option<Child>>>,

    /// Connection state
    state: Arc<RwLock<ConnectionState>>,

    /// Internal request channel (for I/O task)
    io_request_tx: Arc<Mutex<Option<Sender<Message>>>>,

    /// Pending responses mapped by request ID
    pending_responses: Arc<Mutex<HashMap<u64, tokio::sync::oneshot::Sender<McpResponse>>>>,

    /// Next request ID
    next_id: Arc<AtomicU64>,

    /// Server information
    server_info: Arc<Mutex<Option<ServerInfo>>>,

    /// Available resources cache
    resources: Arc<Mutex<Vec<Resource>>>,

    /// Available tools cache
    tools: Arc<Mutex<Vec<Tool>>>,

    /// Available prompts cache
    prompts: Arc<Mutex<Vec<Prompt>>>,

    /// Connection attempt counter
    connection_attempts: Arc<AtomicU64>,

    /// Maximum reconnection attempts (0 = infinite)
    max_reconnect_attempts: u64,

    /// Reconnection delay in milliseconds
    reconnect_delay_ms: u64,

    /// Whether to enable automatic reconnection
    auto_reconnect: bool,

    /// I/O task handles
    io_tasks: Arc<Mutex<Vec<tokio::task::JoinHandle<()>>>>,
}

impl McpClient {
    /// Create a new MCP client with default settings
    pub fn new(config: ServerConfig) -> Result<Self> {
        Self::with_options(config, true, 5, 2000)
    }

    /// Create a new MCP client with custom reconnection options
    ///
    /// # Arguments
    ///
    /// * `config` - Server configuration
    /// * `auto_reconnect` - Enable automatic reconnection on disconnect
    /// * `max_reconnect_attempts` - Maximum reconnection attempts (0 = infinite)
    /// * `reconnect_delay_ms` - Delay between reconnection attempts in milliseconds
    pub fn with_options(
        config: ServerConfig,
        auto_reconnect: bool,
        max_reconnect_attempts: u64,
        reconnect_delay_ms: u64,
    ) -> Result<Self> {
        Ok(Self {
            config,
            process: Arc::new(Mutex::new(None)),
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            io_request_tx: Arc::new(Mutex::new(None)),
            pending_responses: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(AtomicU64::new(1)),
            server_info: Arc::new(Mutex::new(None)),
            resources: Arc::new(Mutex::new(Vec::new())),
            tools: Arc::new(Mutex::new(Vec::new())),
            prompts: Arc::new(Mutex::new(Vec::new())),
            connection_attempts: Arc::new(AtomicU64::new(0)),
            max_reconnect_attempts,
            reconnect_delay_ms,
            auto_reconnect,
            io_tasks: Arc::new(Mutex::new(Vec::new())),
        })
    }

    /// Get current connection state
    pub async fn state(&self) -> ConnectionState {
        *self.state.read().await
    }

    /// Check if currently connected
    pub async fn is_connected(&self) -> bool {
        matches!(*self.state.read().await, ConnectionState::Connected)
    }

    /// Start the MCP server process
    pub async fn connect(&mut self) -> Result<()> {
        *self.state.write().await = ConnectionState::Connecting;
        info!("Connecting to MCP server: {}", self.config.name);

        // Attempt connection with retries
        let result = self.connect_internal().await;

        match result {
            Ok(_) => {
                self.connection_attempts.store(0, Ordering::SeqCst);
                *self.state.write().await = ConnectionState::Connected;
                info!("Successfully connected to MCP server: {}", self.config.name);
                Ok(())
            }
            Err(e) => {
                *self.state.write().await = ConnectionState::Failed;
                error!("Failed to connect to MCP server: {}", e);
                Err(e)
            }
        }
    }

    /// Internal connection implementation
    async fn connect_internal(&mut self) -> Result<()> {
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

        // Spawn process (synchronous operation)
        let mut child = cmd.spawn()
            .with_context(|| format!("Failed to spawn MCP server: {}", self.config.name))?;

        // Get stdin/stdout
        let stdin = child.stdin.take()
            .context("Failed to get server stdin")?;
        let stdout = child.stdout.take()
            .context("Failed to get server stdout")?;
        let stderr = child.stderr.take()
            .context("Failed to get server stderr")?;

        // Store process handle
        *self.process.lock().await = Some(child);

        // Start I/O tasks
        self.start_io_tasks(stdin, stdout, stderr).await;

        // Initialize connection with timeout
        match timeout(Duration::from_secs(30), self.initialize()).await {
            Ok(Ok(_)) => Ok(()),
            Ok(Err(e)) => Err(e).context("Failed to initialize MCP server"),
            Err(_) => bail!("Timeout initializing MCP server: {}", self.config.name),
        }
    }

    /// Reconnect to the server
    pub async fn reconnect(&mut self) -> Result<()> {
        info!("Reconnecting to MCP server: {}", self.config.name);

        if !self.auto_reconnect {
            bail!("Auto-reconnect is disabled");
        }

        *self.state.write().await = ConnectionState::Reconnecting;

        // Clean up existing connection
        self.cleanup_connection().await;

        // Attempt reconnection with exponential backoff
        let mut attempt = 0u64;
        let attempts = self.connection_attempts.load(Ordering::SeqCst);

        loop {
            attempt += 1;
            let total_attempts = attempts + attempt;

            // Check if we've exceeded max attempts
            if self.max_reconnect_attempts > 0 && total_attempts > self.max_reconnect_attempts {
                *self.state.write().await = ConnectionState::Failed;
                bail!(
                    "Exceeded maximum reconnection attempts ({}) for server: {}",
                    self.max_reconnect_attempts,
                    self.config.name
                );
            }

            info!(
                "Reconnection attempt {} for server: {}",
                total_attempts, self.config.name
            );

            // Attempt connection
            match self.connect_internal().await {
                Ok(_) => {
                    self.connection_attempts.store(0, Ordering::SeqCst);
                    *self.state.write().await = ConnectionState::Connected;
                    info!("Successfully reconnected to MCP server: {}", self.config.name);
                    return Ok(());
                }
                Err(e) => {
                    warn!(
                        "Reconnection attempt {} failed for server {}: {}",
                        total_attempts, self.config.name, e
                    );

                    // Exponential backoff with jitter
                    let delay = self.reconnect_delay_ms * (2_u64.pow((attempt - 1).min(5) as u32));
                    let jitter = rand::random::<u64>() % 1000;
                    sleep(Duration::from_millis(delay + jitter)).await;
                }
            }

            self.connection_attempts.store(total_attempts, Ordering::SeqCst);
        }
    }

    /// Clean up connection resources
    async fn cleanup_connection(&mut self) {
        debug!("Cleaning up MCP connection for server: {}", self.config.name);

        // Abort I/O tasks
        let mut tasks = self.io_tasks.lock().await;
        for task in tasks.drain(..) {
            task.abort();
        }

        // Kill process
        if let Some(mut child) = self.process.lock().await.take() {
            let _ = child.kill().await;
        }

        // Clear pending responses
        self.pending_responses.lock().await.clear();

        // Clear I/O request sender
        *self.io_request_tx.lock().await = None;
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
        // Check connection state
        if !self.is_connected().await {
            bail!("Not connected to MCP server");
        }

        // Generate unique request ID
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);

        // Create oneshot channel for this request's response
        let (response_tx, response_rx) = tokio::sync::oneshot::channel();

        // Register pending response
        self.pending_responses.lock().await.insert(id, response_tx);

        // Build and send message
        let message = Message::request(id, request);

        // Get I/O request sender
        let io_tx = self.io_request_tx.lock().await.clone();
        if let Some(tx) = io_tx {
            tx.send(message).await
                .context("Failed to send request to I/O task")?;
        } else {
            // Clean up pending response on failure
            self.pending_responses.lock().await.remove(&id);
            bail!("I/O channel not available");
        }

        // Wait for response with timeout
        match timeout(Duration::from_secs(60), response_rx).await {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(_)) => {
                // Response channel closed
                self.pending_responses.lock().await.remove(&id);
                bail!("Response channel closed");
            }
            Err(_) => {
                // Timeout
                self.pending_responses.lock().await.remove(&id);
                bail!("Request timeout after 60 seconds");
            }
        }
    }

    /// Start I/O tasks for communication
    async fn start_io_tasks(
        &self,
        stdin: tokio::process::ChildStdin,
        stdout: tokio::process::ChildStdout,
        stderr: tokio::process::ChildStderr,
    ) {
        // Create new channels for I/O tasks
        let (io_request_tx, io_request_rx) = unbounded::<Message>();

        // Store request sender for use by send_request
        *self.io_request_tx.lock().await = Some(io_request_tx);

        // Clone shared state for tasks
        let pending_responses = Arc::clone(&self.pending_responses);
        let server_name = self.config.name.clone();

        // Stdin task: write requests
        let stdin_task = tokio::spawn(async move {
            let mut stdin = stdin;
            debug!("MCP stdin task started");

            while let Ok(msg) = io_request_rx.recv().await {
                match serde_json::to_string(&msg) {
                    Ok(json) => {
                        debug!("Sending MCP request: {}", json);

                        // Write JSON message + newline
                        if let Err(e) = stdin.write_all(json.as_bytes()).await {
                            error!("Failed to write to server stdin: {}", e);
                            break;
                        }
                        if let Err(e) = stdin.write_all(b"\n").await {
                            error!("Failed to write newline: {}", e);
                            break;
                        }
                        if let Err(e) = stdin.flush().await {
                            error!("Failed to flush stdin: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to serialize MCP request: {}", e);
                    }
                }
            }

            debug!("MCP stdin task ended");
        });

        // Stdout task: read responses
        let stdout_task = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            debug!("MCP stdout task started");

            while let Ok(Some(line)) = lines.next_line().await {
                if line.trim().is_empty() {
                    continue;
                }

                debug!("Received MCP response: {}", line);

                match serde_json::from_str::<Message>(&line) {
                    Ok(msg) => {
                        // Extract request ID and response
                        if let MessageData::Response { result } = msg.data {
                            // Find and notify the pending response
                            if let Some(id) = msg.id {
                                if let Some(sender) = pending_responses.lock().await.remove(&id) {
                                    if let Err(e) = sender.send(result) {
                                        warn!("Failed to send response to waiting request: {:?}", e);
                                    }
                                } else {
                                    warn!("Received response for unknown request ID: {}", id);
                                }
                            } else {
                                warn!("Received response with no ID");
                            }
                        } else {
                            warn!("Received non-response message: {:?}", msg);
                        }
                    }
                    Err(e) => {
                        error!("Failed to parse MCP response: {} - Line: {}", e, line);
                    }
                }
            }

            debug!("MCP stdout task ended");
        });

        // Stderr task: log errors
        let server_name_clone = server_name.clone();
        let stderr_task = tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            debug!("MCP stderr task started for server: {}", server_name_clone);

            while let Ok(Some(line)) = lines.next_line().await {
                if !line.trim().is_empty() {
                    warn!("MCP server {} stderr: {}", server_name_clone, line);
                }
            }

            debug!("MCP stderr task ended for server: {}", server_name_clone);
        });

        // Store task handles for cleanup
        let mut tasks = self.io_tasks.lock().await;
        tasks.push(stdin_task);
        tasks.push(stdout_task);
        tasks.push(stderr_task);
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
