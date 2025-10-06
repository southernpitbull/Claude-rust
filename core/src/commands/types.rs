//! Command types and definitions for the command processing system.
//!
//! This module defines all command types, contexts, results, and metadata
//! used throughout the command processing pipeline.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

/// Represents all possible commands that can be executed
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    /// File operation commands
    FileOperation(FileOperationCommand),
    /// Code analysis commands
    CodeAnalysis(CodeAnalysisCommand),
    /// Git operation commands
    Git(GitCommand),
    /// System/shell command execution
    System(SystemCommand),
    /// AI-powered commands
    AI(AICommand),
}

/// File operation command variants
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum FileOperationCommand {
    /// Read file contents
    Read {
        path: PathBuf,
        #[serde(default)]
        encoding: Option<String>,
    },
    /// Write content to file
    Write {
        path: PathBuf,
        content: String,
        #[serde(default)]
        create_dirs: bool,
    },
    /// Edit existing file
    Edit {
        path: PathBuf,
        /// Search pattern for replacement
        search: String,
        /// Replacement text
        replace: String,
        #[serde(default)]
        all_occurrences: bool,
    },
    /// Delete file or directory
    Delete {
        path: PathBuf,
        #[serde(default)]
        recursive: bool,
    },
    /// Copy file or directory
    Copy {
        from: PathBuf,
        to: PathBuf,
        #[serde(default)]
        overwrite: bool,
    },
    /// Move/rename file or directory
    Move {
        from: PathBuf,
        to: PathBuf,
        #[serde(default)]
        overwrite: bool,
    },
    /// List directory contents
    List {
        path: PathBuf,
        #[serde(default)]
        recursive: bool,
        #[serde(default)]
        show_hidden: bool,
    },
}

/// Code analysis command variants
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum CodeAnalysisCommand {
    /// Analyze codebase structure
    Analyze {
        path: PathBuf,
        #[serde(default)]
        depth: Option<usize>,
    },
    /// Search for pattern in code
    Search {
        pattern: String,
        #[serde(default)]
        path: Option<PathBuf>,
        #[serde(default)]
        case_sensitive: bool,
        #[serde(default)]
        regex: bool,
    },
    /// Index codebase for fast searching
    Index {
        path: PathBuf,
        #[serde(default)]
        exclude_patterns: Vec<String>,
    },
    /// Find symbol definitions
    FindSymbol {
        symbol: String,
        #[serde(default)]
        path: Option<PathBuf>,
    },
    /// Get code metrics
    Metrics {
        path: PathBuf,
    },
}

/// Git operation command variants
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum GitCommand {
    /// Get repository status
    Status {
        #[serde(default)]
        path: Option<PathBuf>,
    },
    /// Commit changes
    Commit {
        message: String,
        #[serde(default)]
        all: bool,
    },
    /// Push to remote
    Push {
        #[serde(default)]
        remote: Option<String>,
        #[serde(default)]
        branch: Option<String>,
    },
    /// Pull from remote
    Pull {
        #[serde(default)]
        remote: Option<String>,
        #[serde(default)]
        branch: Option<String>,
    },
    /// Create new branch
    Branch {
        name: String,
        #[serde(default)]
        checkout: bool,
    },
    /// Show diff
    Diff {
        #[serde(default)]
        staged: bool,
    },
    /// Add files to staging
    Add {
        paths: Vec<PathBuf>,
    },
}

/// System/shell command execution
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SystemCommand {
    /// Command to execute
    pub command: String,
    /// Command arguments
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory
    #[serde(default)]
    pub working_dir: Option<PathBuf>,
    /// Environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Execution timeout
    #[serde(default)]
    pub timeout: Option<Duration>,
}

/// AI-powered command variants
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum AICommand {
    /// Query AI with a question
    Query {
        question: String,
        #[serde(default)]
        context: Option<String>,
    },
    /// Explain code
    Explain {
        code: String,
        #[serde(default)]
        language: Option<String>,
    },
    /// Generate code from description
    Generate {
        description: String,
        #[serde(default)]
        language: Option<String>,
    },
    /// Review code for issues
    Review {
        code: String,
        #[serde(default)]
        language: Option<String>,
    },
    /// Refactor code
    Refactor {
        code: String,
        instructions: String,
        #[serde(default)]
        language: Option<String>,
    },
}

/// Context information for command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContext {
    /// Current working directory
    pub working_dir: PathBuf,
    /// User preferences
    #[serde(default)]
    pub preferences: HashMap<String, String>,
    /// Available environment variables
    #[serde(default)]
    pub environment: HashMap<String, String>,
    /// Workspace root (if in a workspace)
    #[serde(default)]
    pub workspace_root: Option<PathBuf>,
    /// Current git branch (if in a git repository)
    #[serde(default)]
    pub git_branch: Option<String>,
    /// Execution timestamp
    #[serde(default = "SystemTime::now")]
    pub timestamp: SystemTime,
}

impl CommandContext {
    /// Create a new command context with default values
    pub fn new(working_dir: PathBuf) -> Self {
        Self {
            working_dir,
            preferences: HashMap::new(),
            environment: std::env::vars().collect(),
            workspace_root: None,
            git_branch: None,
            timestamp: SystemTime::now(),
        }
    }

    /// Create a builder for constructing a command context
    pub fn builder(working_dir: PathBuf) -> CommandContextBuilder {
        CommandContextBuilder::new(working_dir)
    }
}

/// Builder for constructing command contexts
#[derive(Debug)]
pub struct CommandContextBuilder {
    working_dir: PathBuf,
    preferences: HashMap<String, String>,
    environment: HashMap<String, String>,
    workspace_root: Option<PathBuf>,
    git_branch: Option<String>,
}

impl CommandContextBuilder {
    /// Create a new builder
    pub fn new(working_dir: PathBuf) -> Self {
        Self {
            working_dir,
            preferences: HashMap::new(),
            environment: std::env::vars().collect(),
            workspace_root: None,
            git_branch: None,
        }
    }

    /// Set user preferences
    pub fn preferences(mut self, preferences: HashMap<String, String>) -> Self {
        self.preferences = preferences;
        self
    }

    /// Add a single preference
    pub fn preference(mut self, key: String, value: String) -> Self {
        self.preferences.insert(key, value);
        self
    }

    /// Set environment variables
    pub fn environment(mut self, environment: HashMap<String, String>) -> Self {
        self.environment = environment;
        self
    }

    /// Set workspace root
    pub fn workspace_root(mut self, workspace_root: PathBuf) -> Self {
        self.workspace_root = Some(workspace_root);
        self
    }

    /// Set git branch
    pub fn git_branch(mut self, git_branch: String) -> Self {
        self.git_branch = Some(git_branch);
        self
    }

    /// Build the command context
    pub fn build(self) -> CommandContext {
        CommandContext {
            working_dir: self.working_dir,
            preferences: self.preferences,
            environment: self.environment,
            workspace_root: self.workspace_root,
            git_branch: self.git_branch,
            timestamp: SystemTime::now(),
        }
    }
}

/// Result of command execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CommandResult {
    /// Command succeeded
    Success {
        /// Output message or data
        output: String,
        /// Additional metadata
        #[serde(default)]
        metadata: CommandMetadata,
    },
    /// Command failed
    Failure {
        /// Error message
        error: String,
        /// Error code (if applicable)
        #[serde(default)]
        error_code: Option<i32>,
        /// Additional metadata
        #[serde(default)]
        metadata: CommandMetadata,
    },
    /// Command is still running (for async operations)
    Running {
        /// Progress message
        #[serde(default)]
        progress: Option<String>,
        /// Progress percentage (0-100)
        #[serde(default)]
        percentage: Option<f32>,
    },
    /// Command was cancelled
    Cancelled {
        /// Cancellation reason
        #[serde(default)]
        reason: Option<String>,
    },
}

impl CommandResult {
    /// Create a success result
    pub fn success(output: impl Into<String>) -> Self {
        Self::Success {
            output: output.into(),
            metadata: CommandMetadata::default(),
        }
    }

    /// Create a success result with metadata
    pub fn success_with_metadata(output: impl Into<String>, metadata: CommandMetadata) -> Self {
        Self::Success {
            output: output.into(),
            metadata,
        }
    }

    /// Create a failure result
    pub fn failure(error: impl Into<String>) -> Self {
        Self::Failure {
            error: error.into(),
            error_code: None,
            metadata: CommandMetadata::default(),
        }
    }

    /// Create a failure result with error code
    pub fn failure_with_code(error: impl Into<String>, error_code: i32) -> Self {
        Self::Failure {
            error: error.into(),
            error_code: Some(error_code),
            metadata: CommandMetadata::default(),
        }
    }

    /// Check if the result is a success
    pub fn is_success(&self) -> bool {
        matches!(self, Self::Success { .. })
    }

    /// Check if the result is a failure
    pub fn is_failure(&self) -> bool {
        matches!(self, Self::Failure { .. })
    }

    /// Check if the result is running
    pub fn is_running(&self) -> bool {
        matches!(self, Self::Running { .. })
    }

    /// Check if the result is cancelled
    pub fn is_cancelled(&self) -> bool {
        matches!(self, Self::Cancelled { .. })
    }

    /// Get the output if success
    pub fn output(&self) -> Option<&str> {
        match self {
            Self::Success { output, .. } => Some(output),
            _ => None,
        }
    }

    /// Get the error if failure
    pub fn error(&self) -> Option<&str> {
        match self {
            Self::Failure { error, .. } => Some(error),
            _ => None,
        }
    }
}

/// Metadata about command execution
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CommandMetadata {
    /// Execution duration
    #[serde(default)]
    pub duration: Option<Duration>,
    /// Number of retries attempted
    #[serde(default)]
    pub retry_count: u32,
    /// Whether this was a dry run
    #[serde(default)]
    pub dry_run: bool,
    /// Command start time
    #[serde(default)]
    pub started_at: Option<SystemTime>,
    /// Command end time
    #[serde(default)]
    pub ended_at: Option<SystemTime>,
    /// Additional custom metadata
    #[serde(default)]
    pub custom: HashMap<String, String>,
}

impl CommandMetadata {
    /// Create a new metadata instance
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the execution duration
    pub fn with_duration(mut self, duration: Duration) -> Self {
        self.duration = Some(duration);
        self
    }

    /// Set the retry count
    pub fn with_retry_count(mut self, count: u32) -> Self {
        self.retry_count = count;
        self
    }

    /// Mark as dry run
    pub fn as_dry_run(mut self) -> Self {
        self.dry_run = true;
        self
    }

    /// Set start time
    pub fn with_start_time(mut self, time: SystemTime) -> Self {
        self.started_at = Some(time);
        self
    }

    /// Set end time
    pub fn with_end_time(mut self, time: SystemTime) -> Self {
        self.ended_at = Some(time);
        self
    }

    /// Add custom metadata
    pub fn with_custom(mut self, key: String, value: String) -> Self {
        self.custom.insert(key, value);
        self
    }
}

/// Intent detected from natural language input
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CommandIntent {
    /// Read file operation
    ReadFile,
    /// Write file operation
    WriteFile,
    /// Edit file operation
    EditFile,
    /// Delete operation
    Delete,
    /// Copy operation
    Copy,
    /// Move operation
    Move,
    /// List directory
    List,
    /// Analyze code
    Analyze,
    /// Search in code
    Search,
    /// Index codebase
    Index,
    /// Find symbol
    FindSymbol,
    /// Get metrics
    Metrics,
    /// Git status
    GitStatus,
    /// Git commit
    GitCommit,
    /// Git push
    GitPush,
    /// Git pull
    GitPull,
    /// Git branch
    GitBranch,
    /// Git diff
    GitDiff,
    /// Git add
    GitAdd,
    /// Execute shell command
    Execute,
    /// Query AI
    Query,
    /// Explain code
    Explain,
    /// Generate code
    Generate,
    /// Review code
    Review,
    /// Refactor code
    Refactor,
    /// Unknown intent
    Unknown,
}

/// Confidence level for intent detection
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd, Serialize, Deserialize)]
pub struct Confidence(f64);

impl Confidence {
    /// Create a new confidence level
    ///
    /// # Panics
    ///
    /// Panics if the value is not between 0.0 and 1.0
    pub fn new(value: f64) -> Self {
        assert!(
            (0.0..=1.0).contains(&value),
            "Confidence must be between 0.0 and 1.0"
        );
        Self(value)
    }

    /// Get the confidence value
    pub fn value(&self) -> f64 {
        self.0
    }

    /// Check if confidence is high (>= 0.8)
    pub fn is_high(&self) -> bool {
        self.0 >= 0.8
    }

    /// Check if confidence is medium (>= 0.5 and < 0.8)
    pub fn is_medium(&self) -> bool {
        self.0 >= 0.5 && self.0 < 0.8
    }

    /// Check if confidence is low (< 0.5)
    pub fn is_low(&self) -> bool {
        self.0 < 0.5
    }
}

impl Default for Confidence {
    fn default() -> Self {
        Self(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_context_builder() {
        let context = CommandContext::builder(PathBuf::from("/tmp"))
            .preference("key".to_string(), "value".to_string())
            .workspace_root(PathBuf::from("/workspace"))
            .git_branch("main".to_string())
            .build();

        assert_eq!(context.working_dir, PathBuf::from("/tmp"));
        assert_eq!(context.preferences.get("key"), Some(&"value".to_string()));
        assert_eq!(
            context.workspace_root,
            Some(PathBuf::from("/workspace"))
        );
        assert_eq!(context.git_branch, Some("main".to_string()));
    }

    #[test]
    fn test_command_result_success() {
        let result = CommandResult::success("Operation completed");
        assert!(result.is_success());
        assert_eq!(result.output(), Some("Operation completed"));
    }

    #[test]
    fn test_command_result_failure() {
        let result = CommandResult::failure("Operation failed");
        assert!(result.is_failure());
        assert_eq!(result.error(), Some("Operation failed"));
    }

    #[test]
    fn test_confidence_levels() {
        let high = Confidence::new(0.9);
        assert!(high.is_high());
        assert!(!high.is_medium());
        assert!(!high.is_low());

        let medium = Confidence::new(0.6);
        assert!(!medium.is_high());
        assert!(medium.is_medium());
        assert!(!medium.is_low());

        let low = Confidence::new(0.3);
        assert!(!low.is_high());
        assert!(!low.is_medium());
        assert!(low.is_low());
    }

    #[test]
    #[should_panic(expected = "Confidence must be between 0.0 and 1.0")]
    fn test_confidence_invalid() {
        Confidence::new(1.5);
    }

    #[test]
    fn test_command_metadata_builder() {
        let metadata = CommandMetadata::new()
            .with_duration(Duration::from_secs(5))
            .with_retry_count(2)
            .as_dry_run()
            .with_custom("key".to_string(), "value".to_string());

        assert_eq!(metadata.duration, Some(Duration::from_secs(5)));
        assert_eq!(metadata.retry_count, 2);
        assert!(metadata.dry_run);
        assert_eq!(metadata.custom.get("key"), Some(&"value".to_string()));
    }
}
