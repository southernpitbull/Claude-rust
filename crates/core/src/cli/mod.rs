//! CLI parsing, command routing, and middleware pipeline
//!
//! This module provides a comprehensive CLI framework with:
//! - Hierarchical command structure using Clap
//! - Middleware pipeline for pre/post processing
//! - Event system for command lifecycle hooks
//! - Input validation and sanitization
//! - Colored help output with examples

use clap::{CommandFactory, Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

pub mod middleware;
pub mod router;
pub mod validator;

pub use middleware::{Middleware, MiddlewareChain};
pub use router::CommandRouter;
pub use validator::InputValidator;

/// CLI Error types
#[derive(Error, Debug)]
pub enum CliError {
    #[error("Invalid command: {0}")]
    InvalidCommand(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Routing error: {0}")]
    RoutingError(String),

    #[error("Middleware error: {0}")]
    MiddlewareError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

pub type CliResult<T> = Result<T, CliError>;

/// AIrchitect CLI - Advanced AI-powered development assistant
#[derive(Parser, Debug, Clone)]
#[command(
    name = "ai",
    version = "1.0.0",
    author = "AIrchitect Team",
    about = "Advanced AI-powered development assistant",
    long_about = "AIrchitect CLI provides intelligent code generation, project planning, \
                  and automated development assistance using state-of-the-art AI models."
)]
pub struct Cli {
    /// Enable verbose output (use multiple times for more verbosity)
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    pub verbose: u8,

    /// Configuration file path
    #[arg(short, long, value_name = "FILE", global = true, env = "AI_CONFIG")]
    pub config: Option<String>,

    /// Disable colored output
    #[arg(long, global = true)]
    pub no_color: bool,

    /// Output format (json, yaml, text)
    #[arg(long, default_value = "text", global = true)]
    pub format: OutputFormat,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

/// Output format options
#[derive(Debug, Clone, Serialize, Deserialize, clap::ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum OutputFormat {
    Json,
    Yaml,
    Text,
}

/// Top-level commands
#[derive(Subcommand, Debug, Clone)]
pub enum Commands {
    /// Start an interactive AI chat session
    #[command(alias = "c")]
    Chat {
        /// Set initial mode (planning or work)
        #[arg(short, long, default_value = "planning")]
        mode: String,

        /// Specify AI provider to use
        #[arg(short, long, env = "AI_PROVIDER")]
        provider: Option<String>,

        /// Model to use
        #[arg(short, long)]
        model: Option<String>,

        /// System prompt override
        #[arg(long)]
        system_prompt: Option<String>,
    },

    /// Start a planning session
    #[command(alias = "p")]
    Plan {
        /// Planning template to use
        #[arg(short, long)]
        template: Option<String>,

        /// Output file for the plan
        #[arg(short, long)]
        output: Option<String>,

        /// Interactive mode
        #[arg(short, long)]
        interactive: bool,
    },

    /// Start a work session
    #[command(alias = "w")]
    Work {
        /// Project to work on
        #[arg(short, long)]
        project: Option<String>,

        /// Task to focus on
        #[arg(short, long)]
        task: Option<String>,

        /// Auto-commit changes
        #[arg(long)]
        auto_commit: bool,
    },

    /// List available AI providers
    #[command(alias = "prov")]
    Providers {
        /// Show all providers including unavailable ones
        #[arg(short, long)]
        all: bool,

        /// Test provider connectivity
        #[arg(short, long)]
        test: bool,
    },

    /// Manage credentials
    #[command(alias = "cr")]
    Creds {
        #[command(subcommand)]
        subcommand: CredsCommands,
    },

    /// Manage project memory
    #[command(alias = "mem")]
    Memory {
        #[command(subcommand)]
        subcommand: MemoryCommands,
    },

    /// Manage agents
    #[command(alias = "ag")]
    Agents {
        #[command(subcommand)]
        subcommand: AgentCommands,
    },

    /// Manage checkpoints
    #[command(alias = "cp")]
    Checkpoint {
        #[command(subcommand)]
        subcommand: CheckpointCommands,
    },

    /// Show configuration
    Config {
        #[command(subcommand)]
        subcommand: ConfigCommands,
    },
}

/// Credential management commands
#[derive(Subcommand, Debug, Clone)]
pub enum CredsCommands {
    /// List configured credentials
    List {
        /// Show sensitive information
        #[arg(long)]
        show_secrets: bool,
    },

    /// Add a new credential
    Add {
        /// Provider name
        provider: String,

        /// API key (omit for interactive input)
        #[arg(long)]
        key: Option<String>,

        /// Set as default provider
        #[arg(short, long)]
        default: bool,
    },

    /// Remove a credential
    Remove {
        /// Provider name
        provider: String,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Validate credentials
    Validate {
        /// Specific provider to validate
        provider: Option<String>,
    },
}

/// Memory management commands
#[derive(Subcommand, Debug, Clone)]
pub enum MemoryCommands {
    /// List memory entries
    List {
        /// Filter by project
        #[arg(short, long)]
        project: Option<String>,

        /// Limit number of results
        #[arg(short, long, default_value = "10")]
        limit: usize,
    },

    /// Search memory
    Search {
        /// Search query
        query: String,

        /// Similarity threshold (0.0-1.0)
        #[arg(short, long, default_value = "0.7")]
        threshold: f32,
    },

    /// Clear memory
    Clear {
        /// Project to clear (all if not specified)
        project: Option<String>,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Export memory
    Export {
        /// Output file
        file: String,

        /// Export format
        #[arg(short, long, default_value = "json")]
        format: String,
    },

    /// Import memory
    Import {
        /// Input file
        file: String,

        /// Merge with existing memory
        #[arg(short, long)]
        merge: bool,
    },
}

/// Agent management commands
#[derive(Subcommand, Debug, Clone)]
pub enum AgentCommands {
    /// List available agents
    List {
        /// Show detailed information
        #[arg(short, long)]
        detailed: bool,
    },

    /// Create a new agent
    Create {
        /// Agent name
        name: String,

        /// Agent capabilities
        #[arg(short, long)]
        capabilities: Vec<String>,

        /// Agent description
        #[arg(short, long)]
        description: Option<String>,
    },

    /// Remove an agent
    Remove {
        /// Agent name
        name: String,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Execute agent task
    Execute {
        /// Agent name
        agent: String,

        /// Task to execute
        task: String,

        /// Task parameters (JSON)
        #[arg(short, long)]
        params: Option<String>,
    },

    /// Show agent status
    Status {
        /// Agent name (all if not specified)
        agent: Option<String>,
    },
}

/// Checkpoint management commands
#[derive(Subcommand, Debug, Clone)]
pub enum CheckpointCommands {
    /// List checkpoints
    List {
        /// Show all checkpoints
        #[arg(short, long)]
        all: bool,

        /// Limit number of results
        #[arg(short, long, default_value = "10")]
        limit: usize,
    },

    /// Create a new checkpoint
    Create {
        /// Checkpoint name
        name: String,

        /// Checkpoint description
        #[arg(short, long)]
        description: Option<String>,

        /// Include uncommitted changes
        #[arg(long)]
        include_dirty: bool,
    },

    /// Restore a checkpoint
    Restore {
        /// Checkpoint name or ID
        name: String,

        /// Create backup before restore
        #[arg(short, long)]
        backup: bool,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Remove a checkpoint
    Remove {
        /// Checkpoint name or ID
        name: String,

        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Show checkpoint diff
    Diff {
        /// First checkpoint
        from: String,

        /// Second checkpoint (current if not specified)
        to: Option<String>,
    },
}

/// Configuration commands
#[derive(Subcommand, Debug, Clone)]
pub enum ConfigCommands {
    /// Show current configuration
    Show {
        /// Show specific key
        key: Option<String>,
    },

    /// Set configuration value
    Set {
        /// Configuration key
        key: String,

        /// Configuration value
        value: String,
    },

    /// Reset configuration to defaults
    Reset {
        /// Skip confirmation
        #[arg(short, long)]
        force: bool,
    },

    /// Validate configuration
    Validate,
}

/// CLI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CliConfig {
    /// Default command to run when none provided
    pub default_command: Option<String>,

    /// History file path
    pub history_file: Option<String>,

    /// Maximum history entries
    pub max_history: usize,

    /// Enable auto-completion
    pub auto_completion: bool,

    /// Color support
    pub colors: bool,

    /// Default output format
    pub default_format: OutputFormat,
}

impl Default for CliConfig {
    fn default() -> Self {
        CliConfig {
            default_command: None,
            history_file: Some(".ai_history".to_string()),
            max_history: 1000,
            auto_completion: true,
            colors: true,
            default_format: OutputFormat::Text,
        }
    }
}

impl Cli {
    /// Parse CLI arguments
    pub fn parse_args() -> Self {
        Self::parse()
    }

    /// Generate help text with colors
    pub fn print_help() -> CliResult<()> {
        let mut cmd = Self::command();
        cmd.print_help()
            .map_err(|e| CliError::ConfigError(e.to_string()))?;
        Ok(())
    }

    /// Validate CLI arguments
    pub fn validate(&self) -> CliResult<()> {
        // Validate verbose level
        if self.verbose > 5 {
            return Err(CliError::ValidationError(
                "Verbose level cannot exceed 5".to_string(),
            ));
        }

        // Validate config file if specified
        if let Some(config_path) = &self.config {
            if !std::path::Path::new(config_path).exists() {
                return Err(CliError::ValidationError(format!(
                    "Config file not found: {}",
                    config_path
                )));
            }
        }

        Ok(())
    }

    /// Get log level based on verbose flag
    pub fn log_level(&self) -> tracing::Level {
        match self.verbose {
            0 => tracing::Level::WARN,
            1 => tracing::Level::INFO,
            2 => tracing::Level::DEBUG,
            _ => tracing::Level::TRACE,
        }
    }
}

/// Command context shared across middleware
#[derive(Debug, Clone)]
pub struct CommandContext {
    pub cli: Cli,
    pub start_time: std::time::Instant,
    pub metadata: Arc<RwLock<std::collections::HashMap<String, String>>>,
}

impl CommandContext {
    pub fn new(cli: Cli) -> Self {
        Self {
            cli,
            start_time: std::time::Instant::now(),
            metadata: Arc::new(RwLock::new(std::collections::HashMap::new())),
        }
    }

    pub async fn set_metadata(&self, key: String, value: String) {
        let mut metadata = self.metadata.write().await;
        metadata.insert(key, value);
    }

    pub async fn get_metadata(&self, key: &str) -> Option<String> {
        let metadata = self.metadata.read().await;
        metadata.get(key).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parse_basic() {
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        assert!(matches!(cli.command, Some(Commands::Chat { .. })));
    }

    #[test]
    fn test_cli_parse_with_verbose() {
        let cli = Cli::try_parse_from(&["ai", "-vvv", "chat"]).unwrap();
        assert_eq!(cli.verbose, 3);
    }

    #[test]
    fn test_cli_parse_with_config() {
        let cli = Cli::try_parse_from(&["ai", "--config", "test.toml", "chat"]).unwrap();
        assert_eq!(cli.config, Some("test.toml".to_string()));
    }

    #[test]
    fn test_cli_log_level() {
        let cli = Cli::try_parse_from(&["ai", "-vv", "chat"]).unwrap();
        assert_eq!(cli.log_level(), tracing::Level::DEBUG);
    }

    #[test]
    fn test_cli_validate_excessive_verbose() {
        let cli = Cli {
            verbose: 10,
            config: None,
            no_color: false,
            format: OutputFormat::Text,
            command: None,
        };
        assert!(cli.validate().is_err());
    }

    #[test]
    fn test_output_format_serialization() {
        let format = OutputFormat::Json;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, r#""json""#);
    }

    #[test]
    fn test_command_context_creation() {
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let ctx = CommandContext::new(cli);
        assert!(ctx.start_time.elapsed().as_secs() < 1);
    }

    #[tokio::test]
    async fn test_command_context_metadata() {
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let ctx = CommandContext::new(cli);

        ctx.set_metadata("key".to_string(), "value".to_string())
            .await;
        let value = ctx.get_metadata("key").await;
        assert_eq!(value, Some("value".to_string()));
    }

    #[test]
    fn test_cli_config_default() {
        let config = CliConfig::default();
        assert_eq!(config.max_history, 1000);
        assert!(config.auto_completion);
        assert!(config.colors);
    }

    #[test]
    fn test_cli_subcommand_aliases() {
        let cli = Cli::try_parse_from(&["ai", "c"]).unwrap();
        assert!(matches!(cli.command, Some(Commands::Chat { .. })));

        let cli = Cli::try_parse_from(&["ai", "p"]).unwrap();
        assert!(matches!(cli.command, Some(Commands::Plan { .. })));
    }
}
