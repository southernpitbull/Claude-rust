//! Command execution engine.
//!
//! This module provides the core command execution functionality with support
//! for async execution, timeouts, dry-run mode, and command history.

use super::types::{Command, CommandContext, CommandMetadata, CommandResult};
use async_trait::async_trait;
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tokio::time::timeout;

/// Maximum number of commands to keep in history
const MAX_HISTORY_SIZE: usize = 100;

/// Trait for executing commands
#[async_trait]
pub trait CommandHandler: Send + Sync {
    /// Execute a command and return the result
    async fn execute(
        &self,
        command: &Command,
        context: &CommandContext,
    ) -> Result<CommandResult, ExecutorError>;

    /// Check if this handler can execute the given command
    fn can_handle(&self, command: &Command) -> bool;

    /// Get the handler name
    fn name(&self) -> &str;
}

/// Command executor with history and configuration
pub struct CommandExecutor {
    /// Registered command handlers
    handlers: Vec<Arc<dyn CommandHandler>>,
    /// Command execution history
    history: Arc<RwLock<VecDeque<HistoryEntry>>>,
    /// Configuration options
    config: ExecutorConfig,
}

/// Configuration for command executor
#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    /// Enable dry-run mode (don't actually execute)
    pub dry_run: bool,
    /// Default timeout for commands
    pub default_timeout: Option<Duration>,
    /// Maximum number of retries on failure
    pub max_retries: u32,
    /// Enable command history tracking
    pub enable_history: bool,
    /// Enable progress reporting
    pub enable_progress: bool,
}

impl Default for ExecutorConfig {
    fn default() -> Self {
        Self {
            dry_run: false,
            default_timeout: Some(Duration::from_secs(300)), // 5 minutes
            max_retries: 0,
            enable_history: true,
            enable_progress: true,
        }
    }
}

/// Entry in command history
#[derive(Debug, Clone)]
pub struct HistoryEntry {
    /// The command that was executed
    pub command: Command,
    /// Execution context
    pub context: CommandContext,
    /// Result of execution
    pub result: CommandResult,
    /// Timestamp of execution
    pub timestamp: SystemTime,
    /// Handler that executed the command
    pub handler_name: String,
}

/// Errors that can occur during command execution
#[derive(Debug, thiserror::Error)]
pub enum ExecutorError {
    /// No handler available for the command
    #[error("No handler available for command: {0}")]
    NoHandler(String),

    /// Command execution timeout
    #[error("Command execution timed out after {0:?}")]
    Timeout(Duration),

    /// Command execution failed
    #[error("Command execution failed: {0}")]
    ExecutionFailed(String),

    /// Invalid command
    #[error("Invalid command: {0}")]
    InvalidCommand(String),

    /// Handler error
    #[error("Handler error: {0}")]
    HandlerError(String),

    /// Retry limit exceeded
    #[error("Retry limit exceeded after {0} attempts")]
    RetryLimitExceeded(u32),
}

impl CommandExecutor {
    /// Create a new command executor with default configuration
    pub fn new() -> Self {
        Self {
            handlers: Vec::new(),
            history: Arc::new(RwLock::new(VecDeque::new())),
            config: ExecutorConfig::default(),
        }
    }

    /// Create a new command executor with custom configuration
    pub fn with_config(config: ExecutorConfig) -> Self {
        Self {
            handlers: Vec::new(),
            history: Arc::new(RwLock::new(VecDeque::new())),
            config,
        }
    }

    /// Register a command handler
    pub fn register_handler(&mut self, handler: Arc<dyn CommandHandler>) {
        self.handlers.push(handler);
    }

    /// Execute a command
    pub async fn execute(
        &self,
        command: Command,
        context: CommandContext,
    ) -> Result<CommandResult, ExecutorError> {
        let start_time = SystemTime::now();

        // Find appropriate handler
        let handler = self
            .find_handler(&command)
            .ok_or_else(|| ExecutorError::NoHandler(format!("{:?}", command)))?;

        // Execute with retry logic
        let mut retry_count = 0;
        let result = loop {
            match self
                .execute_with_handler(&command, &context, handler.as_ref(), retry_count)
                .await
            {
                Ok(result) => break Ok(result),
                Err(e) => {
                    if retry_count >= self.config.max_retries {
                        break Err(ExecutorError::RetryLimitExceeded(retry_count));
                    }
                    retry_count += 1;
                    tracing::warn!(
                        "Command execution failed (attempt {}), retrying: {}",
                        retry_count,
                        e
                    );
                    // Exponential backoff
                    tokio::time::sleep(Duration::from_millis(100 * 2_u64.pow(retry_count))).await;
                }
            }
        };

        // Add metadata
        let result = match result {
            Ok(mut result) => {
                if let CommandResult::Success { metadata, .. }
                | CommandResult::Failure { metadata, .. } = &mut result
                {
                    metadata.started_at = Some(start_time);
                    metadata.ended_at = Some(SystemTime::now());
                    metadata.duration = SystemTime::now().duration_since(start_time).ok();
                    metadata.retry_count = retry_count;
                    if self.config.dry_run {
                        *metadata = metadata.clone().as_dry_run();
                    }
                }
                result
            }
            Err(e) => {
                let metadata = CommandMetadata::new()
                    .with_start_time(start_time)
                    .with_end_time(SystemTime::now())
                    .with_retry_count(retry_count);
                CommandResult::Failure {
                    error: e.to_string(),
                    error_code: None,
                    metadata,
                }
            }
        };

        // Add to history
        if self.config.enable_history {
            self.add_to_history(HistoryEntry {
                command: command.clone(),
                context: context.clone(),
                result: result.clone(),
                timestamp: SystemTime::now(),
                handler_name: handler.name().to_string(),
            })
            .await;
        }

        Ok(result)
    }

    /// Execute command with a specific handler
    async fn execute_with_handler(
        &self,
        command: &Command,
        context: &CommandContext,
        handler: &dyn CommandHandler,
        retry_count: u32,
    ) -> Result<CommandResult, ExecutorError> {
        // Dry-run mode
        if self.config.dry_run {
            tracing::info!("DRY RUN: Would execute command: {:?}", command);
            return Ok(CommandResult::success("Dry run - command not executed"));
        }

        // Progress reporting
        if self.config.enable_progress {
            tracing::info!(
                "Executing command with handler '{}' (attempt {})",
                handler.name(),
                retry_count + 1
            );
        }

        // Execute with timeout
        let execution = handler.execute(command, context);

        let result = if let Some(timeout_duration) = self.config.default_timeout {
            match timeout(timeout_duration, execution).await {
                Ok(result) => result,
                Err(_) => return Err(ExecutorError::Timeout(timeout_duration)),
            }
        } else {
            execution.await
        };

        result.map_err(|e| ExecutorError::ExecutionFailed(e.to_string()))
    }

    /// Find a handler that can execute the command
    fn find_handler(&self, command: &Command) -> Option<Arc<dyn CommandHandler>> {
        self.handlers
            .iter()
            .find(|h| h.can_handle(command))
            .cloned()
    }

    /// Add entry to history
    async fn add_to_history(&self, entry: HistoryEntry) {
        let mut history = self.history.write().await;
        history.push_back(entry);

        // Keep history size under limit
        while history.len() > MAX_HISTORY_SIZE {
            history.pop_front();
        }
    }

    /// Get command history
    pub async fn get_history(&self) -> Vec<HistoryEntry> {
        self.history.read().await.iter().cloned().collect()
    }

    /// Clear command history
    pub async fn clear_history(&self) {
        self.history.write().await.clear();
    }

    /// Get the last command from history
    pub async fn last_command(&self) -> Option<HistoryEntry> {
        self.history.read().await.back().cloned()
    }

    /// Undo the last command (if supported)
    pub async fn undo(&self) -> Result<CommandResult, ExecutorError> {
        let last_entry = self
            .last_command()
            .await
            .ok_or_else(|| ExecutorError::ExecutionFailed("No command to undo".to_string()))?;

        // Try to undo based on command type
        match &last_entry.command {
            Command::FileOperation(_) => {
                // File operations might be undoable
                // This would require keeping backup information
                Err(ExecutorError::ExecutionFailed(
                    "Undo not yet implemented for file operations".to_string(),
                ))
            }
            Command::Git(_) => {
                // Git operations might be undoable (e.g., revert commit)
                Err(ExecutorError::ExecutionFailed(
                    "Undo not yet implemented for git operations".to_string(),
                ))
            }
            _ => Err(ExecutorError::ExecutionFailed(
                "This command type cannot be undone".to_string(),
            )),
        }
    }

    /// Get executor configuration
    pub fn config(&self) -> &ExecutorConfig {
        &self.config
    }

    /// Update executor configuration
    pub fn set_config(&mut self, config: ExecutorConfig) {
        self.config = config;
    }

    /// Enable dry-run mode
    pub fn enable_dry_run(&mut self) {
        self.config.dry_run = true;
    }

    /// Disable dry-run mode
    pub fn disable_dry_run(&mut self) {
        self.config.dry_run = false;
    }

    /// Set default timeout
    pub fn set_default_timeout(&mut self, timeout: Option<Duration>) {
        self.config.default_timeout = timeout;
    }
}

impl Default for CommandExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for command executor
pub struct CommandExecutorBuilder {
    handlers: Vec<Arc<dyn CommandHandler>>,
    config: ExecutorConfig,
}

impl CommandExecutorBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            handlers: Vec::new(),
            config: ExecutorConfig::default(),
        }
    }

    /// Add a handler
    pub fn with_handler(mut self, handler: Arc<dyn CommandHandler>) -> Self {
        self.handlers.push(handler);
        self
    }

    /// Set configuration
    pub fn with_config(mut self, config: ExecutorConfig) -> Self {
        self.config = config;
        self
    }

    /// Enable dry-run mode
    pub fn dry_run(mut self) -> Self {
        self.config.dry_run = true;
        self
    }

    /// Set default timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.config.default_timeout = Some(timeout);
        self
    }

    /// Set maximum retries
    pub fn max_retries(mut self, max_retries: u32) -> Self {
        self.config.max_retries = max_retries;
        self
    }

    /// Build the executor
    pub fn build(self) -> CommandExecutor {
        let mut executor = CommandExecutor::with_config(self.config);
        for handler in self.handlers {
            executor.register_handler(handler);
        }
        executor
    }
}

impl Default for CommandExecutorBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::types::{FileOperationCommand, SystemCommand};
    use std::path::PathBuf;

    // Mock handler for testing
    struct MockHandler;

    #[async_trait]
    impl CommandHandler for MockHandler {
        async fn execute(
            &self,
            _command: &Command,
            _context: &CommandContext,
        ) -> Result<CommandResult, ExecutorError> {
            Ok(CommandResult::success("Mock execution"))
        }

        fn can_handle(&self, command: &Command) -> bool {
            matches!(command, Command::System(_))
        }

        fn name(&self) -> &str {
            "MockHandler"
        }
    }

    #[tokio::test]
    async fn test_executor_with_handler() {
        let executor = CommandExecutorBuilder::new()
            .with_handler(Arc::new(MockHandler))
            .build();

        let command = Command::System(SystemCommand {
            command: "test".to_string(),
            args: vec![],
            working_dir: None,
            env: Default::default(),
            timeout: None,
        });

        let context = CommandContext::new(PathBuf::from("/tmp"));
        let result = executor.execute(command, context).await;

        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.is_success());
    }

    #[tokio::test]
    async fn test_executor_no_handler() {
        let executor = CommandExecutor::new();

        let command = Command::FileOperation(FileOperationCommand::Read {
            path: PathBuf::from("test.txt"),
            encoding: None,
        });

        let context = CommandContext::new(PathBuf::from("/tmp"));
        let result = executor.execute(command, context).await;

        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.is_failure());
    }

    #[tokio::test]
    async fn test_executor_history() {
        let executor = CommandExecutorBuilder::new()
            .with_handler(Arc::new(MockHandler))
            .build();

        let command = Command::System(SystemCommand {
            command: "test".to_string(),
            args: vec![],
            working_dir: None,
            env: Default::default(),
            timeout: None,
        });

        let context = CommandContext::new(PathBuf::from("/tmp"));
        let _ = executor.execute(command, context).await;

        let history = executor.get_history().await;
        assert_eq!(history.len(), 1);
    }

    #[tokio::test]
    async fn test_executor_dry_run() {
        let executor = CommandExecutorBuilder::new()
            .with_handler(Arc::new(MockHandler))
            .dry_run()
            .build();

        let command = Command::System(SystemCommand {
            command: "test".to_string(),
            args: vec![],
            working_dir: None,
            env: Default::default(),
            timeout: None,
        });

        let context = CommandContext::new(PathBuf::from("/tmp"));
        let result = executor.execute(command, context).await;

        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(result.is_success());
        assert!(result.output().unwrap().contains("Dry run"));
    }

    #[tokio::test]
    async fn test_clear_history() {
        let executor = CommandExecutorBuilder::new()
            .with_handler(Arc::new(MockHandler))
            .build();

        let command = Command::System(SystemCommand {
            command: "test".to_string(),
            args: vec![],
            working_dir: None,
            env: Default::default(),
            timeout: None,
        });

        let context = CommandContext::new(PathBuf::from("/tmp"));
        let _ = executor.execute(command, context).await;

        assert_eq!(executor.get_history().await.len(), 1);

        executor.clear_history().await;
        assert_eq!(executor.get_history().await.len(), 0);
    }
}
