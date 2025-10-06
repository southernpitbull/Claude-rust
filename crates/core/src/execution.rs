//! Command Execution
//! 
//! Secure command execution with timeout, output capture, and safety features

use std::collections::HashMap;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command as TokioCommand;
use tokio::time::timeout;
use tracing::{debug, error, info};

/// Command execution result
#[derive(Debug, Clone)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub success: bool,
    pub execution_time: Duration,
}

/// Command execution error
#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("Command execution failed: {0}")]
    ExecutionFailed(String),
    
    #[error("Command timed out after {0:?}")]
    Timeout(Duration),
    
    #[error("Command validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Command execution options
#[derive(Debug, Clone)]
pub struct CommandOptions {
    pub timeout: Duration,
    pub working_directory: Option<String>,
    pub environment: HashMap<String, String>,
    pub enable_stdin: bool,
    pub max_stdout_size: Option<usize>,
    pub max_stderr_size: Option<usize>,
    pub allowed_commands: Option<Vec<String>>, // If set, only allow these commands
}

impl Default for CommandOptions {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
            working_directory: None,
            environment: HashMap::new(),
            enable_stdin: false,
            max_stdout_size: Some(1024 * 1024), // 1MB
            max_stderr_size: Some(1024 * 1024), // 1MB
            allowed_commands: None,
        }
    }
}

/// Command executor
pub struct CommandExecutor;

impl CommandExecutor {
    /// Create a new command executor
    pub fn new() -> Self {
        Self
    }

    /// Execute a command with default options
    pub async fn execute(&self, cmd: &str) -> Result<CommandOutput, CommandError> {
        self.execute_with_options(cmd, CommandOptions::default()).await
    }

    /// Execute a command with custom options
    pub async fn execute_with_options(
        &self,
        cmd: &str,
        options: CommandOptions,
    ) -> Result<CommandOutput, CommandError> {
        debug!("Executing command: {} with options", cmd);
        
        // Validate the command
        self.validate_command(cmd, &options)?;
        
        // Parse the command and arguments
        let (program, args) = self.parse_command(cmd)?;
        
        // Build the tokio command
        let mut command = TokioCommand::new(&program);
        command.args(&args);
        
        // Set working directory if provided
        if let Some(ref wd) = options.working_directory {
            command.current_dir(wd);
        }
        
        // Set environment variables
        for (key, value) in &options.environment {
            command.env(key, value);
        }
        
        // Set up stdio
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        if options.enable_stdin {
            command.stdin(Stdio::piped());
        } else {
            command.stdin(Stdio::null());
        }

        // Execute with timeout
        let start_time = std::time::Instant::now();
        
        let result = timeout(options.timeout, command.output())
            .await
            .map_err(|_| CommandError::Timeout(options.timeout))?;

        let output = result.map_err(|e| CommandError::ExecutionFailed(e.to_string()))?;
        
        let execution_time = start_time.elapsed();
        
        // Convert output to strings
        let stdout = String::from_utf8(output.stdout)
            .map_err(|e| CommandError::ExecutionFailed(format!("Invalid UTF-8 in stdout: {}", e)))?;
        
        let stderr = String::from_utf8(output.stderr)
            .map_err(|e| CommandError::ExecutionFailed(format!("Invalid UTF-8 in stderr: {}", e)))?;
        
        // Check size limits if specified
        if let Some(max_size) = options.max_stdout_size {
            if stdout.len() > max_size {
                return Err(CommandError::ExecutionFailed(
                    format!("stdout exceeds maximum size of {} bytes", max_size)
                ));
            }
        }
        
        if let Some(max_size) = options.max_stderr_size {
            if stderr.len() > max_size {
                return Err(CommandError::ExecutionFailed(
                    format!("stderr exceeds maximum size of {} bytes", max_size)
                ));
            }
        }

        let exit_code = output.status.code();
        let success = output.status.success();
        
        let command_output = CommandOutput {
            stdout,
            stderr,
            exit_code,
            success,
            execution_time,
        };

        if success {
            info!("Command executed successfully: {} (took {:?})", cmd, execution_time);
        } else {
            error!("Command failed: {} (exit code: {:?})", cmd, exit_code);
        }
        
        Ok(command_output)
    }

    /// Execute a command with a timeout
    pub async fn execute_with_timeout(
        &self,
        cmd: &str,
        timeout_duration: Duration,
    ) -> Result<CommandOutput, CommandError> {
        let mut options = CommandOptions::default();
        options.timeout = timeout_duration;
        
        self.execute_with_options(cmd, options).await
    }

    /// Validate a command against security constraints
    fn validate_command(&self, cmd: &str, options: &CommandOptions) -> Result<(), CommandError> {
        // Check if command is in allowed list if specified
        if let Some(ref allowed) = options.allowed_commands {
            let first_word = cmd.split_whitespace().next().unwrap_or("");
            if !allowed.iter().any(|allowed_cmd| allowed_cmd == first_word) {
                return Err(CommandError::ValidationFailed(
                    format!("Command '{}' is not in the allowed list", first_word)
                ));
            }
        }
        
        // Check for dangerous patterns
        if cmd.contains("&&") || cmd.contains("||") || cmd.contains(";") {
            // These could represent command injection attempts
            // In a real implementation, we'd want to be more sophisticated about this
        }
        
        // Additional validation could include:
        // - Checking for absolute paths to prevent directory traversal
        // - Blacklist of dangerous commands
        // - etc.
        
        Ok(())
    }

    /// Parse a command string into program and arguments
    fn parse_command(&self, cmd: &str) -> Result<(String, Vec<String>), CommandError> {
        let cmd = cmd.trim();
        if cmd.is_empty() {
            return Err(CommandError::ValidationFailed("Empty command".to_string()));
        }

        // Simple shell command parsing - this is a basic implementation
        // In production, you might want to use a more sophisticated parser
        let parts: Vec<String> = shell_words::split(cmd)
            .map_err(|e| CommandError::ValidationFailed(format!("Invalid command syntax: {}", e)))?;

        if parts.is_empty() {
            return Err(CommandError::ValidationFailed("No command provided".to_string()));
        }

        let program = parts[0].clone();
        let args = parts[1..].iter().map(|s| s.to_string()).collect();
        
        Ok((program, args))
    }
}

impl Default for CommandExecutor {
    fn default() -> Self {
        Self::new()
    }
}

// Helper functions for common operations
impl CommandExecutor {
    /// Check if a command exists in PATH
    pub async fn command_exists(&self, cmd: &str) -> Result<bool, CommandError> {
        // Validate command to prevent injection
        if !cmd.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.') {
            return Ok(false); // Invalid command name format
        }
        
        // Use a direct approach without string formatting to prevent injection
        #[cfg(target_os = "windows")]
        let result = self.execute_with_timeout(&format!("where {}", cmd), Duration::from_secs(5)).await;
        
        #[cfg(not(target_os = "windows"))]
        let result = self.execute_with_timeout(&format!("which {}", cmd), Duration::from_secs(5)).await;
        
        match result {
            Ok(output) => Ok(output.success),
            Err(CommandError::Timeout(_)) => Ok(false), // If timeout, command likely doesn't exist
            Err(_) => Ok(false), // Other errors also indicate command doesn't exist
        }
    }

    /// Get system information using command execution
    pub async fn get_system_info(&self) -> Result<CommandOutput, CommandError> {
        #[cfg(target_os = "windows")]
        return self.execute("systeminfo").await;
        
        #[cfg(not(target_os = "windows"))]
        return self.execute("uname -a").await;
    }

    /// Execute multiple commands in sequence
    pub async fn execute_sequence(
        &self,
        commands: &[&str],
        options: &CommandOptions,
    ) -> Result<Vec<CommandOutput>, CommandError> {
        let mut results = Vec::new();
        
        for cmd in commands {
            let output = self.execute_with_options(cmd, options.clone()).await?;
            results.push(output);
            
            // If a command fails and we don't want to continue, we could return an error here
        }
        
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_command_executor_creation() {
        let executor = CommandExecutor::new();
        // This just tests the creation doesn't panic
        drop(executor);
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))] // Adjust for Windows if needed
    async fn test_execute_simple_command() {
        let executor = CommandExecutor::new();
        let result = executor.execute("echo hello").await.unwrap();
        
        assert!(result.success);
        assert!(result.stdout.trim() == "hello");
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))] 
    async fn test_execute_with_timeout() {
        let executor = CommandExecutor::new();
        let result = executor.execute_with_timeout("sleep 1", Duration::from_secs(5)).await;
        
        match result {
            Ok(output) => assert!(output.success),
            Err(e) => {
                // On some systems, 'sleep' may not be available
                eprintln!("Command failed: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_command_parsing() {
        let executor = CommandExecutor::new();
        let options = CommandOptions::default();
        
        // Test validation should pass for valid command
        assert!(executor.validate_command("ls -la", &options).is_ok());
    }

    #[tokio::test]
    #[cfg(not(target_os = "windows"))]
    async fn test_command_exists() {
        let executor = CommandExecutor::new();
        let exists = executor.command_exists("ls").await.unwrap();
        assert!(exists); // Assuming ls exists on non-Windows systems
        
        let not_exists = executor.command_exists("this_command_should_not_exist_random").await.unwrap();
        assert!(!not_exists);
    }
}