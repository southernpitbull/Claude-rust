//! CLI command definitions and argument parsing.

use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;

/// Claude Code CLI - AI-powered coding assistant
///
/// A Rust implementation of the Claude Code CLI tool providing AI-powered
/// code generation, analysis, and interactive assistance.
#[derive(Parser, Debug)]
#[command(
    name = "claude-code",
    version,
    about = "Claude Code CLI - AI-powered coding assistant",
    long_about = "A powerful CLI tool for AI-assisted software development.\n\
                  Provides code generation, analysis, refactoring, and interactive assistance\n\
                  powered by multiple AI providers including Claude, OpenAI, Gemini, and more.",
    author,
    after_help = "EXAMPLES:\n  \
                  # Start interactive session\n  \
                  claude-code interactive\n\n  \
                  # Query AI with a question\n  \
                  claude-code query \"How do I implement a binary search tree in Rust?\"\n\n  \
                  # Analyze current codebase\n  \
                  claude-code analyze --path ./src\n\n  \
                  # Login with OAuth\n  \
                  claude-code auth login --provider claude\n\n  \
                  # Initialize new project\n  \
                  claude-code init --name my-project --template rust-cli\n\n\
                  For more information, visit: https://github.com/anthropic/claude-code"
)]
pub struct Cli {
    /// Subcommand to execute
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Enable verbose logging output
    #[arg(short, long, global = true, help = "Enable verbose logging")]
    pub verbose: bool,

    /// Suppress all non-essential output
    #[arg(short, long, global = true, help = "Quiet mode - minimal output")]
    pub quiet: bool,

    /// Disable colored output
    #[arg(long, global = true, help = "Disable colored output")]
    pub no_color: bool,

    /// Path to workspace directory
    #[arg(short = 'w', long, global = true, value_name = "PATH", help = "Workspace directory path")]
    pub workspace: Option<PathBuf>,

    /// Configuration file path
    #[arg(short = 'c', long, global = true, value_name = "FILE", help = "Path to config file")]
    pub config: Option<PathBuf>,
}

/// Available CLI subcommands
#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Initialize a new project or configure existing one
    #[command(
        name = "init",
        about = "Initialize a new project",
        long_about = "Initialize a new project with Claude Code support or configure\n\
                      an existing project with templates and configurations."
    )]
    Init {
        /// Project name
        #[arg(short, long, help = "Project name")]
        name: Option<String>,

        /// Project template to use
        #[arg(short, long, value_enum, help = "Project template")]
        template: Option<ProjectTemplate>,

        /// Target directory for the project
        #[arg(short, long, value_name = "PATH", help = "Target directory")]
        path: Option<PathBuf>,

        /// Skip interactive prompts
        #[arg(short = 'y', long, help = "Skip interactive prompts")]
        yes: bool,
    },

    /// Authentication management
    #[command(
        name = "auth",
        about = "Manage authentication",
        long_about = "Manage authentication for AI providers.\n\
                      Supports OAuth flows and API key authentication."
    )]
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
    },

    /// Query the AI with a question or request
    #[command(
        name = "query",
        about = "Query AI with a question",
        long_about = "Send a query to the AI assistant and receive a response.\n\
                      Supports streaming output and conversation context.",
        alias = "q"
    )]
    Query {
        /// The query or question to ask
        #[arg(value_name = "TEXT", help = "Query text")]
        query: String,

        /// AI provider to use
        #[arg(short, long, value_enum, help = "AI provider")]
        provider: Option<AiProvider>,

        /// Model to use for the query
        #[arg(short, long, help = "Model name")]
        model: Option<String>,

        /// Stream the response in real-time
        #[arg(short, long, help = "Stream response")]
        stream: bool,

        /// Include codebase context
        #[arg(short = 'C', long, help = "Include codebase context")]
        context: bool,

        /// Maximum tokens in response
        #[arg(long, value_name = "NUM", help = "Maximum response tokens")]
        max_tokens: Option<u32>,
    },

    /// Analyze codebase or specific files
    #[command(
        name = "analyze",
        about = "Analyze codebase",
        long_about = "Analyze your codebase for patterns, issues, and insights.\n\
                      Provides code quality metrics, complexity analysis, and suggestions.",
        alias = "a"
    )]
    Analyze {
        /// Path to analyze
        #[arg(short, long, value_name = "PATH", help = "Path to analyze")]
        path: Option<PathBuf>,

        /// Analysis type to perform
        #[arg(short, long, value_enum, help = "Analysis type")]
        analysis_type: Option<AnalysisType>,

        /// Output format
        #[arg(short = 'f', long, value_enum, default_value = "table", help = "Output format")]
        format: OutputFormat,

        /// Rebuild codebase index before analyzing
        #[arg(short, long, help = "Rebuild index")]
        rebuild: bool,

        /// Include hidden files in analysis
        #[arg(long, help = "Include hidden files")]
        include_hidden: bool,
    },

    /// Configuration management
    #[command(
        name = "config",
        about = "Manage configuration",
        long_about = "View and modify configuration settings.\n\
                      Supports global and project-specific configurations."
    )]
    Config {
        #[command(subcommand)]
        command: ConfigCommands,
    },

    /// Start interactive mode
    #[command(
        name = "interactive",
        about = "Start interactive session",
        long_about = "Start an interactive REPL session with the AI assistant.\n\
                      Maintains conversation context and supports special commands.",
        alias = "i"
    )]
    Interactive {
        /// AI provider to use
        #[arg(short, long, value_enum, help = "AI provider")]
        provider: Option<AiProvider>,

        /// Model to use for the session
        #[arg(short, long, help = "Model name")]
        model: Option<String>,

        /// Load conversation history
        #[arg(short = 'l', long, value_name = "FILE", help = "Load conversation from file")]
        load: Option<PathBuf>,
    },

    /// Search codebase
    #[command(
        name = "search",
        about = "Search codebase",
        long_about = "Search through your codebase using various filters and patterns.\n\
                      Supports regex patterns, file type filtering, and semantic search.",
        alias = "s"
    )]
    Search {
        /// Search query or pattern
        #[arg(value_name = "PATTERN", help = "Search pattern")]
        pattern: String,

        /// Path to search in
        #[arg(short, long, value_name = "PATH", help = "Path to search")]
        path: Option<PathBuf>,

        /// Use regex pattern
        #[arg(short, long, help = "Use regex pattern")]
        regex: bool,

        /// Case insensitive search
        #[arg(short, long, help = "Case insensitive")]
        ignore_case: bool,

        /// File type filter (e.g., rs, py, js)
        #[arg(short, long, help = "File type filter")]
        file_type: Option<String>,

        /// Maximum number of results
        #[arg(short = 'n', long, value_name = "NUM", help = "Maximum results")]
        max_results: Option<usize>,
    },

    /// Build and manage codebase index
    #[command(
        name = "index",
        about = "Manage codebase index",
        long_about = "Build and manage the codebase index for faster searches and analysis.\n\
                      The index enables semantic search and context-aware AI assistance."
    )]
    Index {
        #[command(subcommand)]
        command: IndexCommands,
    },

    /// Display version information
    #[command(name = "version", about = "Display version information")]
    Version,

    /// Check system status
    #[command(
        name = "status",
        about = "Check system status",
        long_about = "Check the status of Claude Code installation, configuration,\n\
                      and connected services."
    )]
    Status {
        /// Show detailed status information
        #[arg(short, long, help = "Show detailed information")]
        detailed: bool,
    },
}

/// Authentication subcommands
#[derive(Subcommand, Debug)]
pub enum AuthCommands {
    /// Login to an AI provider
    #[command(about = "Login to AI provider")]
    Login {
        /// AI provider to authenticate with
        #[arg(short, long, value_enum, help = "AI provider")]
        provider: AiProvider,

        /// Use API key instead of OAuth
        #[arg(short, long, help = "Use API key authentication")]
        api_key: bool,

        /// API key value (if not provided, will prompt)
        #[arg(short, long, value_name = "KEY", help = "API key")]
        key: Option<String>,
    },

    /// Logout from an AI provider
    #[command(about = "Logout from AI provider")]
    Logout {
        /// AI provider to logout from
        #[arg(short, long, value_enum, help = "AI provider")]
        provider: Option<AiProvider>,

        /// Logout from all providers
        #[arg(short, long, help = "Logout from all providers")]
        all: bool,
    },

    /// Show authentication status
    #[command(about = "Show authentication status")]
    Status {
        /// Show detailed authentication information
        #[arg(short, long, help = "Show detailed information")]
        detailed: bool,
    },

    /// List authenticated accounts
    #[command(about = "List authenticated accounts")]
    Accounts {
        /// Output format
        #[arg(short, long, value_enum, default_value = "table", help = "Output format")]
        format: OutputFormat,
    },
}

/// Configuration subcommands
#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Show configuration
    #[command(about = "Show configuration")]
    Show {
        /// Configuration key to show
        #[arg(value_name = "KEY", help = "Configuration key")]
        key: Option<String>,

        /// Output format
        #[arg(short, long, value_enum, default_value = "yaml", help = "Output format")]
        format: OutputFormat,
    },

    /// Set configuration value
    #[command(about = "Set configuration value")]
    Set {
        /// Configuration key
        #[arg(value_name = "KEY", help = "Configuration key")]
        key: String,

        /// Configuration value
        #[arg(value_name = "VALUE", help = "Configuration value")]
        value: String,

        /// Set in global config (default is project)
        #[arg(short, long, help = "Set in global config")]
        global: bool,
    },

    /// Unset configuration value
    #[command(about = "Unset configuration value")]
    Unset {
        /// Configuration key
        #[arg(value_name = "KEY", help = "Configuration key")]
        key: String,

        /// Unset in global config
        #[arg(short, long, help = "Unset in global config")]
        global: bool,
    },

    /// List all configuration
    #[command(about = "List all configuration")]
    List {
        /// Include global configuration
        #[arg(short, long, help = "Include global config")]
        global: bool,

        /// Output format
        #[arg(short, long, value_enum, default_value = "yaml", help = "Output format")]
        format: OutputFormat,
    },

    /// Reset configuration to defaults
    #[command(about = "Reset configuration to defaults")]
    Reset {
        /// Reset global configuration
        #[arg(short, long, help = "Reset global config")]
        global: bool,

        /// Skip confirmation prompt
        #[arg(short, long, help = "Skip confirmation")]
        yes: bool,
    },
}

/// Index management subcommands
#[derive(Subcommand, Debug)]
pub enum IndexCommands {
    /// Build or rebuild the index
    #[command(about = "Build codebase index")]
    Build {
        /// Path to index
        #[arg(short, long, value_name = "PATH", help = "Path to index")]
        path: Option<PathBuf>,

        /// Force rebuild even if index exists
        #[arg(short, long, help = "Force rebuild")]
        force: bool,
    },

    /// Show index statistics
    #[command(about = "Show index statistics")]
    Stats {
        /// Show detailed statistics
        #[arg(short, long, help = "Show detailed statistics")]
        detailed: bool,
    },

    /// Clear the index
    #[command(about = "Clear codebase index")]
    Clear {
        /// Skip confirmation prompt
        #[arg(short, long, help = "Skip confirmation")]
        yes: bool,
    },

    /// Update the index incrementally
    #[command(about = "Update index incrementally")]
    Update {
        /// Watch for changes and auto-update
        #[arg(short, long, help = "Watch for changes")]
        watch: bool,
    },
}

/// Supported AI providers
#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum AiProvider {
    /// Anthropic Claude
    #[value(name = "claude", help = "Anthropic Claude")]
    Claude,

    /// OpenAI GPT models
    #[value(name = "openai", help = "OpenAI GPT")]
    OpenAI,

    /// Google Gemini
    #[value(name = "gemini", help = "Google Gemini")]
    Gemini,

    /// Alibaba Qwen
    #[value(name = "qwen", help = "Alibaba Qwen")]
    Qwen,

    /// Local Ollama
    #[value(name = "ollama", help = "Local Ollama")]
    Ollama,

    /// Local LM Studio
    #[value(name = "lmstudio", help = "LM Studio")]
    LMStudio,
}

impl std::fmt::Display for AiProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AiProvider::Claude => write!(f, "claude"),
            AiProvider::OpenAI => write!(f, "openai"),
            AiProvider::Gemini => write!(f, "gemini"),
            AiProvider::Qwen => write!(f, "qwen"),
            AiProvider::Ollama => write!(f, "ollama"),
            AiProvider::LMStudio => write!(f, "lmstudio"),
        }
    }
}

/// Project templates
#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum ProjectTemplate {
    /// Rust CLI application
    #[value(name = "rust-cli")]
    RustCli,

    /// Rust library
    #[value(name = "rust-lib")]
    RustLib,

    /// Rust web server
    #[value(name = "rust-web")]
    RustWeb,

    /// Python application
    #[value(name = "python")]
    Python,

    /// Node.js application
    #[value(name = "nodejs")]
    NodeJs,

    /// Empty project
    #[value(name = "empty")]
    Empty,
}

/// Analysis types
#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum AnalysisType {
    /// Code quality analysis
    #[value(name = "quality")]
    Quality,

    /// Complexity analysis
    #[value(name = "complexity")]
    Complexity,

    /// Security analysis
    #[value(name = "security")]
    Security,

    /// Dependencies analysis
    #[value(name = "dependencies")]
    Dependencies,

    /// Full comprehensive analysis
    #[value(name = "full")]
    Full,
}

/// Output formats
#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum OutputFormat {
    /// Human-readable table
    #[value(name = "table")]
    Table,

    /// JSON format
    #[value(name = "json")]
    Json,

    /// YAML format
    #[value(name = "yaml")]
    Yaml,

    /// Plain text
    #[value(name = "text")]
    Text,
}

impl Cli {
    /// Parse CLI arguments from environment
    pub fn parse_args() -> Self {
        Self::parse()
    }

    /// Validate CLI arguments
    pub fn validate(&self) -> anyhow::Result<()> {
        // Validate that verbose and quiet are not both set
        if self.verbose && self.quiet {
            anyhow::bail!("Cannot specify both --verbose and --quiet");
        }

        // Validate workspace path exists if provided
        if let Some(ref workspace) = self.workspace {
            if !workspace.exists() {
                anyhow::bail!("Workspace path does not exist: {}", workspace.display());
            }
            if !workspace.is_dir() {
                anyhow::bail!("Workspace path is not a directory: {}", workspace.display());
            }
        }

        // Validate config file exists if provided
        if let Some(ref config) = self.config {
            if !config.exists() {
                anyhow::bail!("Config file does not exist: {}", config.display());
            }
            if !config.is_file() {
                anyhow::bail!("Config path is not a file: {}", config.display());
            }
        }

        Ok(())
    }
}
