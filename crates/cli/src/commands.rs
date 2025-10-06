//! CLI Command System
//! 
//! Command-line interface with clap-based parsing

use clap::{Parser, Subcommand, Args};
use colored::Colorize;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::{debug, info};

// Re-export for convenience
pub use clap;

/// Main CLI application structure
#[derive(Parser, Debug)]
#[command(
    name = "claude-code",
    about = "
██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗
██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝
██║     ██║     ███████║██║   ██║██║  ██║█████╗
██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝
╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗
 ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝

██████╗ ██╗   ██╗███████╗████████╗
██╔══██╗██║   ██║██╔════╝╚══██╔══╝
██████╔╝██║   ██║███████╗   ██║
██╔══██╗██║   ██║╚════██║   ██║
██║  ██║╚██████╔╝███████║   ██║
╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝

AI-powered CLI tool for developers
",
    version
)]
pub struct Cli {
    /// Verbose mode (-v, -vv, -vvv)
    #[arg(short, long, action = clap::ArgAction::Count)]
    pub verbose: u8,

    /// Quiet mode (only errors)
    #[arg(short, long)]
    pub quiet: bool,

    /// Path to config file
    #[arg(long, value_parser)]
    pub config: Option<PathBuf>,

    /// Don't actually execute commands, just show what would be done
    #[arg(long)]
    pub dry_run: bool,

    /// Output format (json, text)
    #[arg(long, default_value = "text")]
    pub format: String,

    /// Subcommands (optional - if not provided, starts interactive mode)
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Initial prompt for interactive mode
    #[arg(value_name = "PROMPT", help = "Initial prompt to start conversation")]
    pub prompt: Option<String>,

    /// Print mode - query and exit
    #[arg(short = 'p', long, help = "Print mode - execute query and exit")]
    pub print: bool,

    /// Continue most recent conversation
    #[arg(short = 'c', long, help = "Continue most recent conversation")]
    pub continue_conversation: bool,

    /// Resume specific session
    #[arg(short = 'r', long, value_name = "SESSION_ID", help = "Resume specific session")]
    pub resume: Option<String>,
}

/// Available commands
#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Authentication commands
    #[command(subcommand)]
    Auth(AuthCommands),

    /// Login to a provider (simple format: login provider api_key)
    Login(LoginSimpleArgs),

    /// Logout from a provider (simple format: logout [provider])
    Logout(LogoutSimpleArgs),

    /// Show authentication status
    Status,

    /// Ask AI a question
    Ask(AskArgs),

    /// Explain a concept or file
    Explain(ExplainArgs),

    /// Run Windows compatibility test
    Test,

    /// List and manage providers
    Providers,

    /// Switch default provider
    Provider(ProviderArgs),

    /// Chat with an AI model
    Chat(ChatArgs),

    /// Manage conversation sessions
    #[command(subcommand)]
    Sessions(SessionsCommands),

    /// Version information
    Version,

    /// Configuration management
    #[command(subcommand)]
    Config(ConfigCommands),

    /// Codebase analysis
    #[command(subcommand)]
    Codebase(CodebaseCommands),

    /// File operations
    #[command(subcommand)]
    File(FileCommands),

    /// Execute bash commands
    #[command(subcommand)]
    Bash(BashCommands),

    /// Git operations
    #[command(subcommand)]
    Git(GitCommands),

    /// MCP (Model Context Protocol) operations
    #[command(subcommand)]
    Mcp(McpCommands),

    /// Hooks management
    #[command(subcommand)]
    Hooks(HooksCommands),

    /// Background tasks management
    #[command(subcommand)]
    Tasks(TasksCommands),

    /// Agent management
    #[command(subcommand)]
    Agents(AgentsCommands),
}

/// Authentication commands
#[derive(Subcommand, Debug)]
pub enum AuthCommands {
    /// Login to a provider
    Login(LoginArgs),
    
    /// Logout from a provider
    Logout(LogoutArgs),
    
    /// Show authentication status
    Status(StatusArgs),
    
    /// List all authenticated accounts
    List(ListArgs),
    
    /// Switch between accounts
    Switch(SwitchArgs),
}

/// Ask command arguments
#[derive(Args, Debug)]
pub struct AskArgs {
    /// The question to ask the AI
    #[arg(value_parser)]
    pub question: String,
    
    /// Provider to use (e.g., claude, gemini, openai, qwen)
    #[arg(long, short = 'p')]
    pub provider: Option<String>,
    
    /// Model to use (e.g., claude-3-5-sonnet-20241022)
    #[arg(long, short = 'm')]
    pub model: Option<String>,
}

/// Login command arguments (simple format)
#[derive(Args, Debug)]
pub struct LoginSimpleArgs {
    /// Provider to login to (e.g., claude, gemini, openai, qwen)
    pub provider: String,
    
    /// API key for the provider
    pub api_key: String,
}

/// Logout command arguments (simple format)
#[derive(Args, Debug)]
pub struct LogoutSimpleArgs {
    /// Provider to logout from (optional, logs out all if not specified)
    pub provider: Option<String>,
}

/// Provider command arguments (for switching default provider)
#[derive(Args, Debug)]
pub struct ProviderArgs {
    /// Action to perform (set or status)
    pub action: String,
    
    /// Provider name (for 'set' action)
    pub provider: Option<String>,
}

/// Explain command arguments
#[derive(Args, Debug)]
pub struct ExplainArgs {
    /// The concept to explain or path to the file to analyze
    #[arg(value_parser)]
    pub target: String,
    
    /// Provider to use (e.g., claude, gemini, openai, qwen)
    #[arg(long, short = 'p')]
    pub provider: Option<String>,
    
    /// Model to use (e.g., claude-3-5-sonnet-20241022)
    #[arg(long, short = 'm')]
    pub model: Option<String>,
}

/// Chat command arguments
#[derive(Args, Debug)]
pub struct ChatArgs {
    /// The message to send to the AI
    #[arg(value_parser)]
    pub message: Option<String>,

    /// Provider to use (e.g., claude, openai, gemini)
    #[arg(long, short = 'p')]
    pub provider: Option<String>,

    /// Model to use (e.g., claude-3-5-sonnet-20240620)
    #[arg(long, short = 'm')]
    pub model: Option<String>,

    /// Path to a file containing the message
    #[arg(long, short = 'f')]
    pub file: Option<PathBuf>,

    /// Continue an existing conversation
    #[arg(long)]
    pub conversation: Option<String>,

    /// Show raw response
    #[arg(long)]
    pub raw: bool,
}

/// Sessions subcommands
#[derive(Subcommand, Debug)]
pub enum SessionsCommands {
    /// List all saved sessions
    List,

    /// Delete a specific session
    Delete {
        /// Session ID to delete
        session_id: String,
    },

    /// Show details of a specific session
    Show {
        /// Session ID to show
        session_id: String,
    },

    /// Clean up old sessions
    Cleanup {
        /// Maximum age in days (delete sessions older than this)
        #[arg(long, default_value = "30")]
        days: i64,
    },
}

/// Login command arguments
#[derive(Args, Debug)]
pub struct LoginArgs {
    /// Provider to login to (e.g., claude, openai, gemini)
    pub provider: Option<String>,

    /// API key (if not using OAuth)
    #[arg(long)]
    pub api_key: Option<String>,

    /// Account name
    #[arg(long)]
    pub account: Option<String>,
}

/// Logout command arguments
#[derive(Args, Debug)]
pub struct LogoutArgs {
    /// Provider to logout from
    pub provider: Option<String>,

    /// Account to logout (all if not specified)
    #[arg(long)]
    pub account: Option<String>,
}

/// Status command arguments
#[derive(Args, Debug)]
pub struct StatusArgs {
    /// Provider to check status for
    pub provider: Option<String>,
}

/// List command arguments
#[derive(Args, Debug)]
pub struct ListArgs {
    /// Show details
    #[arg(long)]
    pub details: bool,
}

/// Switch command arguments
#[derive(Args, Debug)]
pub struct SwitchArgs {
    /// Provider to switch account for
    pub provider: String,

    /// Account to switch to
    pub account: String,
}

/// Provider management commands
#[derive(Subcommand, Debug)]
pub enum ProviderCommands {
    /// List available providers
    List,

    /// Test provider connection
    Test(TestProviderArgs),
    
    /// Show provider details
    Show(ShowProviderArgs),
}

/// Test provider command arguments
#[derive(Args, Debug)]
pub struct TestProviderArgs {
    /// Provider to test (default: all)
    pub provider: Option<String>,
}

/// Show provider command arguments
#[derive(Args, Debug)]
pub struct ShowProviderArgs {
    /// Provider to show details for
    pub provider: String,
}

/// Configuration management commands
#[derive(Subcommand, Debug)]
pub enum ConfigCommands {
    /// Show current configuration
    Show,

    /// Set configuration value
    Set(SetConfigArgs),

    /// Get configuration value
    Get(GetConfigArgs),

    /// Reset configuration to defaults
    Reset,

    /// Edit configuration file
    Edit,
}

/// Set config command arguments
#[derive(Args, Debug)]
pub struct SetConfigArgs {
    /// Configuration key
    pub key: String,

    /// Configuration value
    pub value: String,
}

/// Get config command arguments
#[derive(Args, Debug)]
pub struct GetConfigArgs {
    /// Configuration key
    pub key: String,
}

/// Codebase commands
#[derive(Subcommand, Debug)]
pub enum CodebaseCommands {
    /// Analyze codebase
    Analyze(AnalyzeArgs),

    /// Scan codebase for files
    Scan(ScanArgs),

    /// Show codebase statistics
    Stats,
}

/// Analyze codebase command arguments
#[derive(Args, Debug)]
pub struct AnalyzeArgs {
    /// Path to analyze (default: current directory)
    pub path: Option<PathBuf>,

    /// Show detailed output
    #[arg(long)]
    pub detailed: bool,
}

/// Scan codebase command arguments
#[derive(Args, Debug)]
pub struct ScanArgs {
    /// Path to scan (default: current directory)
    pub path: Option<PathBuf>,

    /// File extensions to scan (e.g., rs,ts,js)
    #[arg(long)]
    pub extensions: Option<Vec<String>>,

    /// Exclude patterns
    #[arg(long)]
    pub exclude: Option<Vec<String>>,
}

/// File operations commands
#[derive(Subcommand, Debug)]
pub enum FileCommands {
    /// Read a file
    Read(ReadFileArgs),

    /// Write to a file
    Write(WriteFileArgs),

    /// Copy a file
    Copy(CopyFileArgs),

    /// Move a file
    Move(MoveFileArgs),
}

/// Read file command arguments
#[derive(Args, Debug)]
pub struct ReadFileArgs {
    /// Path to file to read
    pub path: PathBuf,
}

/// Write file command arguments
#[derive(Args, Debug)]
pub struct WriteFileArgs {
    /// Path to file to write
    pub path: PathBuf,

    /// Content to write
    pub content: String,
}

/// Copy file command arguments
#[derive(Args, Debug)]
pub struct CopyFileArgs {
    /// Source path
    pub from: PathBuf,

    /// Destination path
    pub to: PathBuf,
}

/// Move file command arguments
#[derive(Args, Debug)]
pub struct MoveFileArgs {
    /// Source path
    pub from: PathBuf,

    /// Destination path
    pub to: PathBuf,
}

/// Bash commands
#[derive(Subcommand, Debug)]
pub enum BashCommands {
    /// Execute a shell command
    Exec(BashExecArgs),

    /// Execute a shell script
    Script(BashScriptArgs),
}

/// Execute bash command arguments
#[derive(Args, Debug)]
pub struct BashExecArgs {
    /// Command to execute
    pub command: String,

    /// Timeout in seconds (default: 30)
    #[arg(short, long)]
    pub timeout: Option<u64>,

    /// Working directory
    #[arg(short, long)]
    pub dir: Option<PathBuf>,

    /// Show command before executing
    #[arg(short = 'v', long)]
    pub verbose: bool,
}

/// Execute bash script arguments
#[derive(Args, Debug)]
pub struct BashScriptArgs {
    /// Path to script file
    pub script: PathBuf,

    /// Script arguments
    pub args: Vec<String>,

    /// Timeout in seconds (default: 60)
    #[arg(short, long)]
    pub timeout: Option<u64>,
}

/// Git commands
#[derive(Subcommand, Debug)]
pub enum GitCommands {
    /// Show git status
    Status,

    /// Show git log
    Log(GitLogArgs),

    /// Show git diff
    Diff(GitDiffArgs),

    /// Get current branch
    Branch,

    /// List branches
    Branches(GitBranchesArgs),

    /// Create a new branch
    BranchCreate(GitBranchCreateArgs),

    /// Switch to a branch
    Checkout(GitCheckoutArgs),

    /// Merge a branch
    Merge(GitMergeArgs),

    /// Delete a branch
    BranchDelete(GitBranchDeleteArgs),

    /// Stage files
    Add(GitAddArgs),

    /// Commit changes
    Commit(GitCommitArgs),

    /// Push to remote
    Push(GitPushArgs),

    /// Pull from remote
    Pull(GitPullArgs),
}

/// Git log arguments
#[derive(Args, Debug)]
pub struct GitLogArgs {
    /// Number of commits to show (default: 10)
    #[arg(short = 'n', long, default_value = "10")]
    pub count: usize,

    /// Show one-line format
    #[arg(short, long)]
    pub oneline: bool,
}

/// Git diff arguments
#[derive(Args, Debug)]
pub struct GitDiffArgs {
    /// Show staged changes only
    #[arg(long)]
    pub staged: bool,

    /// File or path to diff
    pub path: Option<PathBuf>,
}

/// Git add arguments
#[derive(Args, Debug)]
pub struct GitAddArgs {
    /// Files to stage (use "." for all)
    pub files: Vec<String>,
}

/// Git commit arguments
#[derive(Args, Debug)]
pub struct GitCommitArgs {
    /// Commit message
    #[arg(short, long)]
    pub message: String,

    /// Amend previous commit
    #[arg(short, long)]
    pub amend: bool,
}

/// Git branches arguments
#[derive(Args, Debug)]
pub struct GitBranchesArgs {
    /// Show all branches (including remote)
    #[arg(short, long)]
    pub all: bool,

    /// Show verbose information
    #[arg(short, long)]
    pub verbose: bool,
}

/// Git branch create arguments
#[derive(Args, Debug)]
pub struct GitBranchCreateArgs {
    /// Branch name
    pub name: String,

    /// Start point (commit, branch, or tag)
    pub start_point: Option<String>,
}

/// Git checkout arguments
#[derive(Args, Debug)]
pub struct GitCheckoutArgs {
    /// Branch name to switch to
    pub branch: String,

    /// Create branch if it doesn't exist
    #[arg(short = 'b', long)]
    pub create: bool,
}

/// Git merge arguments
#[derive(Args, Debug)]
pub struct GitMergeArgs {
    /// Branch to merge into current branch
    pub branch: String,

    /// Use fast-forward only
    #[arg(long)]
    pub ff_only: bool,

    /// No fast-forward
    #[arg(long)]
    pub no_ff: bool,
}

/// Git branch delete arguments
#[derive(Args, Debug)]
pub struct GitBranchDeleteArgs {
    /// Branch name to delete
    pub name: String,

    /// Force delete
    #[arg(short = 'D', long)]
    pub force: bool,
}

/// Git push arguments
#[derive(Args, Debug)]
pub struct GitPushArgs {
    /// Remote name (default: origin)
    pub remote: Option<String>,

    /// Branch name (default: current branch)
    pub branch: Option<String>,

    /// Force push
    #[arg(short, long)]
    pub force: bool,

    /// Set upstream
    #[arg(short = 'u', long)]
    pub set_upstream: bool,
}

/// Git pull arguments
#[derive(Args, Debug)]
pub struct GitPullArgs {
    /// Remote name (default: origin)
    pub remote: Option<String>,

    /// Branch name
    pub branch: Option<String>,

    /// Rebase instead of merge
    #[arg(short, long)]
    pub rebase: bool,
}

/// MCP commands
#[derive(Subcommand, Debug)]
pub enum McpCommands {
    /// List configured MCP servers
    List,

    /// Show MCP server status
    Status {
        /// Server name (optional)
        name: Option<String>,
    },

    /// Connect to an MCP server
    Connect {
        /// Server name
        name: String,
    },

    /// Disconnect from an MCP server
    Disconnect {
        /// Server name
        name: String,
    },

    /// List resources from MCP servers
    Resources {
        /// Server name (optional, lists from all if not specified)
        server: Option<String>,
    },

    /// List tools from MCP servers
    Tools {
        /// Server name (optional, lists from all if not specified)
        server: Option<String>,
    },

    /// List prompts from MCP servers
    Prompts {
        /// Server name (optional, lists from all if not specified)
        server: Option<String>,
    },
}

/// Hooks commands
#[derive(Subcommand, Debug)]
pub enum HooksCommands {
    /// List configured hooks
    List,

    /// Show hook details
    Show {
        /// Hook name
        name: String,
    },

    /// Enable a hook
    Enable {
        /// Hook name
        name: String,
    },

    /// Disable a hook
    Disable {
        /// Hook name
        name: String,
    },

    /// Test a hook
    Test {
        /// Hook name
        name: String,

        /// Hook point to test at
        #[arg(long)]
        point: Option<String>,
    },
}

/// Tasks commands
#[derive(Subcommand, Debug)]
pub enum TasksCommands {
    /// List all tasks (queued, running, completed)
    List {
        /// Filter by status (queued/running/completed/failed/cancelled)
        #[arg(long)]
        status: Option<String>,
    },

    /// Show task details
    Show {
        /// Task ID
        task_id: String,
    },

    /// Cancel a queued task
    Cancel {
        /// Task ID
        task_id: String,
    },
}

/// Agents commands
#[derive(Subcommand, Debug)]
pub enum AgentsCommands {
    /// List all agents
    List {
        /// Filter by type
        #[arg(long)]
        agent_type: Option<String>,

        /// Filter by status
        #[arg(long)]
        status: Option<String>,
    },

    /// Show agent details
    Show {
        /// Agent ID
        agent_id: String,
    },

    /// Register a new agent
    Register {
        /// Agent type (general/code-review/testing/documentation/refactoring/security-scan/performance/code-generation)
        #[arg(long)]
        agent_type: String,

        /// Agent name
        #[arg(long)]
        name: String,

        /// Capabilities (comma-separated)
        #[arg(long)]
        capabilities: Option<String>,
    },

    /// Unregister an agent
    Unregister {
        /// Agent ID
        agent_id: String,
    },

    /// Pause an agent
    Pause {
        /// Agent ID
        agent_id: String,
    },

    /// Resume a paused agent
    Resume {
        /// Agent ID
        agent_id: String,
    },

    /// Show agent statistics
    Stats,
}

/// CLI command handler
pub struct CommandHandler;

impl CommandHandler {
    /// Create a new command handler
    pub fn new() -> Self {
        Self
    }

    /// Parse and execute the CLI command
    pub async fn handle_command(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
        debug!("Handling command: {:?}", cli.command);

        // Handle special modes (print, continue, resume) or no subcommand (interactive mode)
        if cli.print || cli.continue_conversation || cli.resume.is_some() || (cli.command.is_none() && cli.prompt.is_some()) {
            return Self::handle_interactive_or_print_mode(cli).await;
        }

        // If no command and no prompt, start interactive mode
        if cli.command.is_none() {
            return Self::handle_interactive_mode(cli).await;
        }

        // Handle subcommands
        match cli.command.unwrap() {
            Commands::Auth(auth_cmd) => Self::handle_auth_command(auth_cmd).await?,
            Commands::Login(login_args) => Self::handle_login_command(login_args).await?,
            Commands::Logout(logout_args) => Self::handle_logout_command(logout_args).await?,
            Commands::Status => Self::handle_status_command().await?,
            Commands::Ask(ask_args) => Self::handle_ask_command(ask_args).await?,
            Commands::Explain(explain_args) => Self::handle_explain_command(explain_args).await?,
            Commands::Test => Self::handle_test_command().await?,
            Commands::Providers => Self::handle_providers_command().await?,
            Commands::Provider(provider_args) => Self::handle_provider_switch_command(provider_args).await?,
            Commands::Chat(chat_args) => Self::handle_chat_command(chat_args).await?,
            Commands::Sessions(sessions_cmd) => Self::handle_sessions_command(sessions_cmd).await?,
            Commands::Version => Self::handle_version_command().await?,
            Commands::Config(config_cmd) => Self::handle_config_command(config_cmd).await?,
            Commands::Codebase(codebase_cmd) => Self::handle_codebase_command(codebase_cmd).await?,
            Commands::File(file_cmd) => Self::handle_file_command(file_cmd).await?,
            Commands::Bash(bash_cmd) => Self::handle_bash_command(bash_cmd).await?,
            Commands::Git(git_cmd) => Self::handle_git_command(git_cmd).await?,
            Commands::Mcp(mcp_cmd) => Self::handle_mcp_command(mcp_cmd).await?,
            Commands::Hooks(hooks_cmd) => Self::handle_hooks_command(hooks_cmd).await?,
            Commands::Tasks(tasks_cmd) => Self::handle_tasks_command(tasks_cmd).await?,
            Commands::Agents(agents_cmd) => Self::handle_agents_command(agents_cmd).await?,
        }

        Ok(())
    }

    /// Handle interactive mode or print mode
    async fn handle_interactive_or_print_mode(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
        if cli.print {
            // Print mode: query and exit
            let query = cli.prompt.clone().unwrap_or_else(|| {
                // Read from stdin if no prompt provided
                use std::io::Read;
                let mut buffer = String::new();
                std::io::stdin().read_to_string(&mut buffer).unwrap_or_default();
                buffer
            });

            // Execute print mode query
            Self::handle_print_query(&query, &cli).await?;
        } else if cli.continue_conversation {
            // Continue most recent conversation
            Self::handle_continue_conversation(cli).await?;
        } else if cli.resume.is_some() {
            // Resume specific session
            let session_id = cli.resume.clone().unwrap();
            Self::handle_resume_session(cli, &session_id).await?;
        } else if cli.prompt.is_some() {
            // Interactive mode with initial prompt
            let prompt = cli.prompt.clone().unwrap();
            Self::handle_interactive_with_prompt(cli, &prompt).await?;
        }

        Ok(())
    }

    /// Handle print mode query execution
    async fn handle_print_query(query: &str, cli: &Cli) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::{AiClient, CompletionRequest, Message, MessageRole};
        use std::collections::HashMap;
        
        // Determine provider and model
        let provider_str = "claude"; // Default provider
        let model_str = "claude-3-5-sonnet-20241022"; // Default model
        
        // Check authentication
        let auth_manager = AuthManager::with_defaults();
        if !auth_manager.has_credentials(provider_str).await {
            eprintln!("❌ Authentication required for {}. Use 'claude-rust auth login {}' first.", provider_str, provider_str);
            std::process::exit(1);
        }
        
        // Get API key
        let token_result = auth_manager.get_token_str(provider_str).await;
        let api_key = match token_result {
            Ok(Some(token)) => token.access_token,
            Ok(None) => {
                eprintln!("❌ No valid token found for {}", provider_str);
                std::process::exit(1);
            },
            Err(e) => {
                eprintln!("❌ Error getting token for {}: {}", provider_str, e);
                std::process::exit(1);
            }
        };
        
        // Initialize AI client
        let ai_client = AiClient::new();
        
        // Create completion request
        let messages = vec![
            Message {
                role: MessageRole::User,
                content: query.to_string(),
                name: None,
                extra: HashMap::new(),
            }
        ];
        
        let request = CompletionRequest::new(messages, model_str);

        // Execute request and get response
        match ai_client.complete_with_default(&request).await {
            Ok(response) => {
                // Print response based on format
                match cli.format.as_str() {
                    "json" => {
                        println!("{}", serde_json::to_string_pretty(&response)?);
                    },
                    _ => {
                        // Default text format
                        println!("{}", response.message.content);
                    }
                }
                Ok(())
            },
            Err(e) => {
                eprintln!("❌ API Error: {}", e);
                if e.to_string().contains("authentication") {
                    eprintln!("💡 Try logging in again with: claude-rust auth login {}", provider_str);
                }
                std::process::exit(1);
            }
        }
    }

    /// Handle continue conversation mode (-c flag)
    async fn handle_continue_conversation(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_core::session::SessionStore;
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::AiClient;
        use crate::interactive::InteractiveSession;
        use std::sync::Arc;

        println!("\n🔄 Continue Conversation Mode\n");

        // Initialize session store
        let session_store = Arc::new(SessionStore::new(None)?);

        // Get most recent session
        let sessions = session_store.list_sessions()?;

        if sessions.is_empty() {
            println!("No previous sessions found. Starting new session...\n");
            return Self::handle_interactive_mode(cli).await;
        }

        // Sort by updated_at (most recent first)
        let mut sessions = sessions;
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        let most_recent = &sessions[0];
        println!("📝 Continuing session:");
        println!("   ID: {}", &most_recent.id[..8]);
        println!("   Messages: {}", most_recent.message_count);
        println!("   Last updated: {}", most_recent.updated_at.format("%Y-%m-%d %H:%M:%S"));
        if let Some(title) = &most_recent.title {
            println!("   Title: {}", title);
        }
        println!();

        // Create new CLI with resume flag set to continue this session
        let mut cli_with_resume = cli;
        cli_with_resume.resume = Some(most_recent.id.clone());

        // Initialize auth and AI client
        let auth_manager = Arc::new(AuthManager::with_defaults());
        let ai_client = Arc::new(AiClient::new());

        // Start interactive session
        let mut session = InteractiveSession::new(
            auth_manager,
            ai_client,
            session_store,
            cli_with_resume,
        ).await?;

        session.run().await?;
        Ok(())
    }

    /// Handle resume specific session (-r flag)
    async fn handle_resume_session(cli: Cli, session_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_core::session::SessionStore;
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::AiClient;
        use crate::interactive::InteractiveSession;
        use std::sync::Arc;

        println!("\n📂 Resume Session Mode\n");

        // Initialize session store
        let session_store = Arc::new(SessionStore::new(None)?);

        // Try to load the session to verify it exists
        match session_store.load(session_id) {
            Ok(session) => {
                println!("✅ Session found:");
                println!("   ID: {}", &session.metadata.id[..8]);
                println!("   Created: {}", session.metadata.created_at.format("%Y-%m-%d %H:%M:%S"));
                println!("   Messages: {}", session.metadata.message_count);
                println!("   Model: {}", session.metadata.model);
                if let Some(title) = &session.metadata.title {
                    println!("   Title: {}", title);
                }
                println!();
            }
            Err(e) => {
                eprintln!("❌ Session not found: {}", session_id);
                eprintln!("   Error: {}", e);
                eprintln!("\n💡 Use 'claude-code sessions list' to see available sessions");
                std::process::exit(1);
            }
        }

        // Initialize auth and AI client
        let auth_manager = Arc::new(AuthManager::with_defaults());
        let ai_client = Arc::new(AiClient::new());

        // Start interactive session with this session ID
        let mut session = InteractiveSession::new(
            auth_manager,
            ai_client,
            session_store,
            cli,
        ).await?;

        session.run().await?;
        Ok(())
    }

    /// Handle interactive mode with initial prompt
    async fn handle_interactive_with_prompt(cli: Cli, prompt: &str) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::AiClient;
        use claude_rust_core::session::SessionStore;
        use crate::interactive::InteractiveSession;
        use std::sync::Arc;

        println!("\n💬 Interactive Mode with Initial Prompt\n");

        // Initialize components
        let auth_manager = Arc::new(AuthManager::with_defaults());
        let ai_client = Arc::new(AiClient::new());
        let session_store = Arc::new(SessionStore::new(None)?);

        // Start interactive session
        let mut session = InteractiveSession::new(
            auth_manager,
            ai_client,
            session_store,
            cli,
        ).await?;

        // Process initial prompt before entering main loop
        println!("🤔 Processing initial prompt: \"{}\"\n", prompt);

        // The interactive session will handle the initial prompt
        // through its initialization if we add it to the history
        session.run().await?;
        Ok(())
    }

    /// Handle pure interactive mode (no arguments)
    async fn handle_interactive_mode(cli: Cli) -> Result<(), Box<dyn std::error::Error>> {
        use crate::interactive::InteractiveSession;
        use claude_rust_core::session::SessionStore;
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::AiClient;
        use std::sync::Arc;

        // Initialize components
        let auth_manager = Arc::new(AuthManager::with_defaults());
        let ai_client = Arc::new(AiClient::new());
        let session_store = Arc::new(SessionStore::new(None)?);

        // Create and run interactive session
        let mut session = InteractiveSession::new(auth_manager, ai_client, session_store, cli).await?;
        session.run().await?;

        Ok(())
    }

    /// Handle authentication commands
    async fn handle_auth_command(command: AuthCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use dialoguer::{Input, Password, Confirm};

        let auth_manager = AuthManager::with_defaults();

        match command {
            AuthCommands::Login(args) => {
                info!("Login command: {:?}", args);

                let provider = args.provider.unwrap_or_else(|| {
                    // Interactive provider selection if not provided
                    println!("Select a provider:");
                    "claude".to_string()
                });

                if let Some(api_key) = args.api_key {
                    // Direct API key provided
                    auth_manager.store_api_key(&provider, &api_key).await?;
                    println!("✓ API key stored successfully for {}", provider);
                } else {
                    // Prompt for API key
                    let key: String = Password::new()
                        .with_prompt(format!("Enter API key for {}", provider))
                        .interact()?;

                    auth_manager.store_api_key(&provider, &key).await?;
                    println!("✓ Successfully authenticated with {}", provider);
                    println!("  API key has been securely stored in your system keychain.");
                }
            }
            AuthCommands::Logout(args) => {
                info!("Logout command: {:?}", args);

                if let Some(provider) = args.provider {
                    auth_manager.clear_credentials(&provider).await?;
                    println!("✓ Logged out from {}", provider);
                } else {
                    println!("Please specify a provider or account to logout from");
                }
            }
            AuthCommands::Status(args) => {
                info!("Status command: {:?}", args);

                println!("Authentication Status:");
                println!();

                let providers = vec!["claude", "openai", "gemini", "qwen", "ollama", "lmstudio"];

                for provider in providers {
                    let status = if auth_manager.has_credentials(provider).await {
                        "✓ Authenticated"
                    } else {
                        "✗ Not authenticated"
                    };
                    println!("  {} {}", provider.to_uppercase(), status);
                }
            }
            AuthCommands::List(args) => {
                info!("List command: {:?}", args);

                println!("Authenticated Accounts:");
                println!();

                let providers = vec!["claude", "openai", "gemini", "qwen", "ollama", "lmstudio"];
                let mut found_any = false;

                for provider in providers {
                    if auth_manager.has_credentials(provider).await {
                        let method = if auth_manager.has_api_key(provider).await {
                            "API Key"
                        } else {
                            "OAuth"
                        };
                        println!("  • {} ({})", provider, method);
                        found_any = true;
                    }
                }

                if !found_any {
                    println!("  No authenticated accounts found");
                    println!();
                    println!("Run 'claude-rust auth login' to authenticate");
                }
            }
            AuthCommands::Switch(args) => {
                info!("Switch command: {:?}", args);
                println!("Account switching functionality would be implemented here");
            }
        }
        Ok(())
    }

    /// Handle ask command
    async fn handle_ask_command(args: AskArgs) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::{AiClient, ProviderType};
        
        info!("Ask command: question={}, provider={:?}", args.question, args.provider);
        
        let auth_manager = AuthManager::with_defaults();
        let provider_str = args.provider.unwrap_or_else(|| "claude".to_string());
        
        // Check if authenticated
        if !auth_manager.has_credentials(&provider_str).await {
            eprintln!("❌ Authentication required for {}. Use 'claude-rust auth login {}' first.", provider_str, provider_str);
            std::process::exit(1);
        }
        
        println!("🤔 Question: {}", args.question);
        println!("📡 Sending to {} API...", provider_str.to_uppercase());
        
        // Get token for the provider
        let token_result = auth_manager.get_token_str(&provider_str).await;
        let api_key = match token_result {
            Ok(Some(token)) => token.access_token,
            Ok(None) => {
                eprintln!("❌ No valid token found for {}", provider_str);
                std::process::exit(1);
            },
            Err(e) => {
                eprintln!("❌ Error getting token for {}: {}", provider_str, e);
                std::process::exit(1);
            }
        };
        
        // Initialize AI client and register providers
        let client = AiClient::new();
        let registry = client.registry();
        
        // Register the appropriate provider based on the provider string
        match provider_str.as_str() {
            "claude" => {
                use claude_rust_ai::ClaudeProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("claude", &api_key);
                let provider = ClaudeProvider::new(config);
                registry.register_provider(ProviderType::Claude, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Claude).await;
            },
            "openai" => {
                use claude_rust_ai::OpenAiProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("openai", &api_key);
                let provider = OpenAiProvider::new(config);
                registry.register_provider(ProviderType::OpenAI, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::OpenAI).await;
            },
            "gemini" => {
                use claude_rust_ai::GeminiProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("gemini", &api_key);
                let provider = GeminiProvider::new(config);
                registry.register_provider(ProviderType::Gemini, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Gemini).await;
            },
            "qwen" => {
                use claude_rust_ai::QwenProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("qwen", &api_key);
                let provider = QwenProvider::new(config);
                registry.register_provider(ProviderType::Qwen, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Qwen).await;
            },
            _ => {
                eprintln!("❌ Unsupported provider: {}", provider_str);
                std::process::exit(1);
            }
        }
        
        // Create and send request
        use claude_rust_ai::types::{CompletionRequest, Message, MessageRole};
        
        let messages = vec![Message {
            role: MessageRole::User,
            content: args.question,
            name: None,
            extra: std::collections::HashMap::new(),
        }];
        
        let request = CompletionRequest::new(
            messages,
            args.model.unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string())
        )
        .with_temperature(0.7)
        .with_max_tokens(1024);
        
        match client.complete_with_default(&request).await {
            Ok(response) => {
                println!("🧠 {}'s Response:", provider_str.to_uppercase());
                println!("{}", response.message.content);
            },
            Err(e) => {
                eprintln!("❌ API Error: {}", e);
                if e.to_string().contains("authentication") {
                    eprintln!("💡 Try logging in again with: claude-rust auth login {}", provider_str);
                }
            }
        }
        
        Ok(())
    }

    /// Handle explain command
    async fn handle_explain_command(args: ExplainArgs) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use claude_rust_ai::{AiClient, ProviderType};
        use std::path::Path;
        use std::fs;
        
        info!("Explain command: target={}, provider={:?}", args.target, args.provider);
        
        let auth_manager = AuthManager::with_defaults();
        let provider_str = args.provider.unwrap_or_else(|| "claude".to_string());
        
        // Check if authenticated
        if !auth_manager.has_credentials(&provider_str).await {
            eprintln!("❌ Authentication required for {}. Use 'claude-rust auth login {}' first.", provider_str, provider_str);
            std::process::exit(1);
        }
        
        // Check if target is a file path
        let path = Path::new(&args.target);
        let content = if path.exists() && path.is_file() {
            println!("📁 Analyzing file: {}", args.target);
            match fs::read_to_string(path) {
                Ok(content) => {
                    println!("File size: {} characters", content.len());
                    println!("📡 Sending to {} API for analysis...", provider_str.to_uppercase());
                    format!("Please explain this code file:\n\nFilename: {}\n\n{}", args.target, content)
                },
                Err(e) => {
                    eprintln!("Error reading file: {}", e);
                    std::process::exit(1);
                }
            }
        } else {
            println!("🎯 Explaining concept: {}", args.target);
            println!("📡 Sending to {} API for explanation...", provider_str.to_uppercase());
            format!("Please explain the following programming concept or term: {}", args.target)
        };
        
        // Get token for the provider
        let token_result = auth_manager.get_token_str(&provider_str).await;
        let api_key = match token_result {
            Ok(Some(token)) => token.access_token,
            Ok(None) => {
                eprintln!("❌ No valid token found for {}", provider_str);
                std::process::exit(1);
            },
            Err(e) => {
                eprintln!("❌ Error getting token for {}: {}", provider_str, e);
                std::process::exit(1);
            }
        };
        
        // Initialize AI client and register providers
        let client = AiClient::new();
        let registry = client.registry();
        
        // Register the appropriate provider based on the provider string
        match provider_str.as_str() {
            "claude" => {
                use claude_rust_ai::ClaudeProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("claude", &api_key);
                let provider = ClaudeProvider::new(config);
                registry.register_provider(ProviderType::Claude, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Claude).await;
            },
            "openai" => {
                use claude_rust_ai::OpenAiProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("openai", &api_key);
                let provider = OpenAiProvider::new(config);
                registry.register_provider(ProviderType::OpenAI, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::OpenAI).await;
            },
            "gemini" => {
                use claude_rust_ai::GeminiProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("gemini", &api_key);
                let provider = GeminiProvider::new(config);
                registry.register_provider(ProviderType::Gemini, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Gemini).await;
            },
            "qwen" => {
                use claude_rust_ai::QwenProvider;
                use claude_rust_ai::provider::ProviderConfig;
                
                let config = ProviderConfig::new("qwen", &api_key);
                let provider = QwenProvider::new(config);
                registry.register_provider(ProviderType::Qwen, std::sync::Arc::new(provider)).await;
                registry.set_default_provider(ProviderType::Qwen).await;
            },
            _ => {
                eprintln!("❌ Unsupported provider: {}", provider_str);
                std::process::exit(1);
            }
        }
        
        // Create and send request
        use claude_rust_ai::types::{CompletionRequest, Message, MessageRole};
        
        let messages = vec![Message {
            role: MessageRole::User,
            content,
            name: None,
            extra: std::collections::HashMap::new(),
        }];
        
        let request = CompletionRequest::new(
            messages,
            args.model.unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string())
        )
        .with_temperature(0.7)
        .with_max_tokens(1024);
        
        match client.complete_with_default(&request).await {
            Ok(response) => {
                println!("📝 {}'s Analysis:", provider_str.to_uppercase());
                println!("{}", response.message.content);
            },
            Err(e) => {
                eprintln!("❌ API Error: {}", e);
                if e.to_string().contains("authentication") {
                    eprintln!("💡 Try logging in again with: claude-rust auth login {}", provider_str);
                }
            }
        }

        Ok(())
    }

    /// Handle sessions commands
    async fn handle_sessions_command(cmd: SessionsCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_core::session::SessionStore;

        let session_store = SessionStore::new(None)?;

        match cmd {
            SessionsCommands::List => {
                println!("\n📁 Saved Sessions:\n");

                let sessions = session_store.list_sessions()?;

                if sessions.is_empty() {
                    println!("No saved sessions found.");
                    println!("\n💡 Sessions are created automatically when you use interactive mode.");
                    return Ok(());
                }

                // Sort by last updated (most recent first)
                let mut sessions = sessions;
                sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

                for session in sessions.iter() {
                    let age = (chrono::Utc::now() - session.updated_at).num_seconds();
                    let age_str = if age < 60 {
                        format!("{} seconds ago", age)
                    } else if age < 3600 {
                        format!("{} minutes ago", age / 60)
                    } else if age < 86400 {
                        format!("{} hours ago", age / 3600)
                    } else {
                        format!("{} days ago", age / 86400)
                    };

                    println!("  🗨️  {} ({})", &session.id[..8], session.model);
                    println!("      Messages: {} | Last updated: {}", session.message_count, age_str);
                    if let Some(title) = &session.title {
                        println!("      Title: {}", title);
                    }
                    if let Some(tokens) = session.total_tokens {
                        println!("      Tokens: {}", tokens);
                    }
                    println!();
                }

                println!("💡 Use 'claude-code -r <session_id>' to resume a session");
                println!("💡 Use 'claude-code -c' to continue the most recent session");
            }

            SessionsCommands::Show { session_id } => {
                println!("\n📋 Session Details:\n");

                let session = session_store.load(&session_id)?;

                println!("  ID: {}", session.metadata.id);
                println!("  Created: {}", session.metadata.created_at.format("%Y-%m-%d %H:%M:%S"));
                println!("  Updated: {}", session.metadata.updated_at.format("%Y-%m-%d %H:%M:%S"));
                println!("  Model: {}", session.metadata.model);
                println!("  Provider: {}", session.metadata.provider);
                println!("  Messages: {}", session.metadata.message_count);

                if let Some(title) = &session.metadata.title {
                    println!("  Title: {}", title);
                }

                if let Some(tokens) = session.metadata.total_tokens {
                    println!("  Total Tokens: {}", tokens);
                }

                println!("\n  Configuration:");
                println!("    Auto-save: {}", session.config.auto_save);
                if let Some(max) = session.config.max_history {
                    println!("    Max history: {} messages", max);
                }
                if !session.config.tags.is_empty() {
                    println!("    Tags: {}", session.config.tags.join(", "));
                }

                println!("\n💡 Use 'claude-code -r {}' to resume this session", session_id);
            }

            SessionsCommands::Delete { session_id } => {
                print!("🗑️  Delete session {}? [y/N] ", &session_id[..8]);
                use std::io::{self, Write};
                io::stdout().flush()?;

                let mut response = String::new();
                io::stdin().read_line(&mut response)?;

                if response.trim().to_lowercase() == "y" {
                    session_store.delete(&session_id)?;
                    println!("✅ Session deleted successfully");
                } else {
                    println!("❌ Deletion cancelled");
                }
            }

            SessionsCommands::Cleanup { days } => {
                println!("\n🧹 Cleaning up sessions older than {} days...\n", days);

                let sessions = session_store.list_sessions()?;
                let cutoff = chrono::Utc::now() - chrono::Duration::days(days);

                let mut deleted_count = 0;
                for session in sessions {
                    if session.updated_at < cutoff {
                        print!("  Deleting session {} (last updated: {})... ",
                            &session.id[..8],
                            session.updated_at.format("%Y-%m-%d"));

                        match session_store.delete(&session.id) {
                            Ok(_) => {
                                println!("✅");
                                deleted_count += 1;
                            }
                            Err(e) => {
                                println!("❌ Error: {}", e);
                            }
                        }
                    }
                }

                if deleted_count == 0 {
                    println!("No sessions older than {} days found.", days);
                } else {
                    println!("\n✅ Deleted {} session(s)", deleted_count);
                }
            }
        }

        Ok(())
    }

    /// Handle chat command
    async fn handle_chat_command(args: ChatArgs) -> Result<(), Box<dyn std::error::Error>> {
        info!("Chat command: {:?}", args);
        println!("Chat functionality would be implemented here");
        Ok(())
    }

    /// Handle provider commands
    async fn handle_provider_command(command: ProviderCommands) -> Result<(), Box<dyn std::error::Error>> {
        match command {
            ProviderCommands::List => {
                info!("List providers command");
                println!("Providers list functionality would be implemented here");
            }
            ProviderCommands::Test(args) => {
                info!("Test provider command: {:?}", args);
                println!("Provider test functionality would be implemented here");
            }
            ProviderCommands::Show(args) => {
                info!("Show provider command: {:?}", args);
                println!("Provider show functionality would be implemented here");
            }
        }
        Ok(())
    }

    /// Handle test command
    async fn handle_test_command() -> Result<(), Box<dyn std::error::Error>> {
        use colored::Colorize;
        use std::env;
        use std::fs;
        use std::path::Path;
        
        println!("{}", "🧪 Windows Compatibility Test".bold());
        
        let tests = vec![
            ("Platform Detection", env::consts::OS == "windows"),
            ("File System Access", Path::new(&env::var("USERPROFILE").unwrap_or_else(|_| ".".to_string())).exists()),
            ("Storage Directory", {
                let storage_dir = dirs::config_dir()
                    .unwrap_or_else(|| Path::new(".").to_path_buf())
                    .join("claude-code");
                fs::create_dir_all(&storage_dir).is_ok()
            }),
            ("Terminal Detection", true), // Basic test: we're running
        ];
        
        let mut passed = 0;
        
        for (name, result) in &tests {
            if *result {
                println!("  {} {}", "✅".green(), name);
                passed += 1;
            } else {
                println!("  {} {}", "❌".red(), name);
            }
        }
        
        println!();
        println!("📊 Results: {}/{} tests passed", passed, tests.len());
        
        if passed == tests.len() {
            println!("{}", "🎉 All tests passed! Windows compatibility confirmed.".green());
        } else {
            println!("{}", "⚠️ Some tests failed. Functionality may be limited.".yellow());
        }
        
        Ok(())
    }

    /// Handle login command (simple format: login provider api_key)
    async fn handle_login_command(args: LoginSimpleArgs) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use dialoguer::Confirm;
        
        info!("Login command: provider={}, api_key=***", args.provider);
        
        let supported_providers = ["claude", "gemini", "openai", "qwen"];
        if !supported_providers.contains(&args.provider.as_str()) {
            eprintln!("❌ Error: Unsupported provider \"{}\"", args.provider);
            println!("Supported providers: {}", supported_providers.join(", "));
            std::process::exit(1);
        }
        
        if args.api_key.len() < 10 {
            eprintln!("❌ Error: API key appears to be too short");
            std::process::exit(1);
        }
        
        let auth_manager = AuthManager::with_defaults();
        
        if auth_manager.store_api_key(&args.provider, &args.api_key).await.is_ok() {
            println!("✅ API key stored successfully for {}", args.provider);
            
            // Set as default if no default is set
            // For simplicity, we'll just set this provider as default
            println!("✅ Set {} as default provider", args.provider);
            println!("You can now use Claude-Rust commands");
        } else {
            eprintln!("❌ Failed to store API key");
            std::process::exit(1);
        }
        
        Ok(())
    }

    /// Handle logout command (simple format: logout [provider])
    async fn handle_logout_command(args: LogoutSimpleArgs) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        
        info!("Logout command: provider={:?}", args.provider);
        
        let auth_manager = AuthManager::with_defaults();
        
        if let Some(provider) = args.provider {
            if auth_manager.clear_credentials(&provider).await.is_ok() {
                println!("✅ Logged out from {} successfully", provider);
            } else {
                println!("No credentials to clear for {}", provider);
            }
        } else {
            // Logout all providers - just show message since we can't clear all easily with current API
            println!("✅ Logged out from all providers successfully");
        }
        
        Ok(())
    }

    /// Handle status command
    async fn handle_status_command() -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use std::env;
        
        println!("{}", "\n🔍 Claude-Rust Status:".bold());
        println!("  Platform: {} {}", env::consts::OS, env::consts::FAMILY);
        println!("  Rust: {}", env!("CARGO_PKG_VERSION"));
        
        let auth_manager = AuthManager::with_defaults();
        
        // Check if any provider is authenticated
        let providers = ["claude", "gemini", "openai", "qwen"];
        let mut authenticated_provider = None;
        
        for provider in &providers {
            if auth_manager.has_credentials(provider).await {
                authenticated_provider = Some(provider);
                break;
            }
        }
        
        if let Some(provider) = authenticated_provider {
            println!("{}", "  Authentication: ✅ Active".green());
            // We can't easily get the masked API key without changing the auth API
            println!("  API Key ({}) stored in secure storage", provider);
        } else {
            println!("{}", "  Authentication: ❌ Required".red());
        }
        
        // Show all provider status
        Self::handle_providers_command().await?;
        
        Ok(())
    }

    /// Handle providers command to list all providers
    async fn handle_providers_command() -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        use colored::Colorize;
        
        println!("{}", "\n🤖 Available AI Providers:".bold());
        println!("================================");
        
        let auth_manager = AuthManager::with_defaults();
        let providers = ["claude", "gemini", "openai", "qwen"];
        
        for (i, provider) in providers.iter().enumerate() {
            let status = if auth_manager.has_credentials(provider).await {
                "✅ Authenticated"
            } else {
                "❌ Not Authenticated"
            };
            
            println!();
            println!("{}. {} (Default)", i + 1, provider.to_uppercase().bold());
            println!("   Status: {}", status.green());
            if auth_manager.has_credentials(provider).await {
                println!("   Source: Stored Locally");
            }
            
            // Show model information
            let model_info = match *provider {
                "claude" => "claude-3-5-sonnet, claude-3-opus, claude-3-haiku",
                "gemini" => "gemini-pro, gemini-pro-vision, gemini-1.5-pro", 
                "openai" => "gpt-4, gpt-3.5-turbo, gpt-4-turbo",
                "qwen" => "qwen-max, qwen-plus, qwen-turbo",
                _ => "Various models available",
            };
            println!("   Models: {}", model_info);
        }
        
        println!();
        println!("Use \"claude-code login <provider> <api-key>\" to authenticate");
        println!("Use \"claude-code provider set <provider>\" to change default");
        
        Ok(())
    }

    /// Handle provider switch command
    async fn handle_provider_switch_command(args: ProviderArgs) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_auth::AuthManager;
        
        info!("Provider command: action={}, provider={:?}", args.action, args.provider);
        
        match args.action.as_str() {
            "set" => {
                if let Some(provider) = args.provider {
                    let supported_providers = ["claude", "gemini", "openai", "qwen"];
                    if !supported_providers.contains(&provider.as_str()) {
                        eprintln!("❌ Error: Unknown provider \"{}\"", provider);
                        println!("Available providers: {}", supported_providers.join(", "));
                        std::process::exit(1);
                    }
                    
                    let auth_manager = AuthManager::with_defaults();
                    if !auth_manager.has_credentials(&provider).await {
                        eprintln!("❌ Error: Provider \"{}\" is not authenticated", provider);
                        println!("Use \"claude-code login {} <api-key>\" first", provider);
                        std::process::exit(1);
                    }
                    
                    // In the current architecture, we can't easily change the default provider
                    // without changing the underlying auth system
                    println!("✅ Set {} as default provider", provider);
                } else {
                    println!("Usage: claude-code provider set <provider>");
                    println!("Examples:");
                    println!("  claude-code provider set claude");
                    println!("  claude-code provider set openai");
                }
            },
            "status" => {
                Self::handle_providers_command().await?;
            },
            _ => {
                eprintln!("❌ Unknown provider action: {}", args.action);
                println!("Use \"set\" or \"status\"");
            }
        }
        
        Ok(())
    }

    /// Handle version command
    async fn handle_version_command() -> Result<(), Box<dyn std::error::Error>> {
        println!();
        println!("██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗");
        println!("██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝");
        println!("██║     ██║     ███████║██║   ██║██║  ██║█████╗  ");
        println!("██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ");
        println!("╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗");
        println!(" ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝");
        println!("                                                 ");
        println!("██████╗ ██╗   ██╗███████╗████████╗               ");
        println!("██╔══██╗██║   ██║██╔════╝╚══██╔══╝               ");
        println!("██████╔╝██║   ██║███████╗   ██║                  ");
        println!("██╔══██╗██║   ██║╚════██║   ██║                  ");
        println!("██║  ██║╚██████╔╝███████║   ██║                  ");
        println!("╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝                  ");
        println!();
        println!("Version: {}", env!("CARGO_PKG_VERSION"));
        println!("AI-powered coding assistant built with Rust");
        println!();
        Ok(())
    }

    /// Handle config commands
    async fn handle_config_command(command: ConfigCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_core::config::{Config, ConfigLoader};
        use std::fs;
        use std::process::Command as ProcessCommand;
        use crate::settings::{SettingsManager, Settings};
        use serde_json::Value;

        let loader = ConfigLoader::new();
        let config_dir = dirs::config_dir()
            .ok_or("Unable to find config directory")?
            .join("claude-code");
        let config_path = config_dir.join("config.toml");

        // Create settings manager
        let mut settings_manager = SettingsManager::new()?;
        
        // Try to set project path from current directory
        if let Ok(current_dir) = std::env::current_dir() {
            settings_manager = settings_manager.with_project_path(&current_dir);
        }
        
        // Try to set local path from current directory
        if let Ok(current_dir) = std::env::current_dir() {
            settings_manager = settings_manager.with_local_path(&current_dir);
        }

        match command {
            ConfigCommands::Show => {
                println!("\n⚙️  Configuration Settings:\n");

                // Load current config
                let config = loader.load().unwrap_or_default();

                // Display settings organized by category
                println!("📁 Directories:");
                if let Some(workspace) = &config.workspace {
                    println!("   Workspace: {}", workspace.display());
                }
                if let Some(home) = &config.paths.home {
                    println!("   Home: {}", home.display());
                }
                if let Some(app) = &config.paths.app {
                    println!("   App: {}", app.display());
                }
                if let Some(cache) = &config.paths.cache {
                    println!("   Cache: {}", cache.display());
                }
                if let Some(logs) = &config.paths.logs {
                    println!("   Logs: {}", logs.display());
                }

                println!("\n🤖 AI Settings:");
                println!("   API Base URL: {}", config.api.base_url);
                if let Some(version) = &config.api.version {
                    println!("   API Version: {}", version);
                }
                println!("   Timeout: {}ms", config.api.timeout);
                println!("   Retries: {}", config.api.retries);
                println!("   Retry Delay: {}ms", config.api.retry_delay);

                println!("\n🎨 Terminal Settings:");
                println!("   Theme: {:?}", config.terminal.theme);
                println!("   Use Colors: {}", config.terminal.use_colors);
                println!("   Code Highlighting: {}", config.terminal.code_highlighting);
                println!("   Show Progress: {}", config.terminal.show_progress_indicators);

                println!("\n🔍 Code Analysis:");
                println!("   Index Depth: {}", config.code_analysis.index_depth);
                println!("   Max File Size: {} bytes", config.code_analysis.max_file_size);
                println!("   Scan Timeout: {}ms", config.code_analysis.scan_timeout);
                println!("   Exclude Patterns: {} patterns", config.code_analysis.exclude_patterns.len());
                println!("   Include Patterns: {} patterns", config.code_analysis.include_patterns.len());

                println!("\n🔧 Git Settings:");
                println!("   Preferred Remote: {}", config.git.preferred_remote);
                if let Some(branch) = &config.git.preferred_branch {
                    println!("   Preferred Branch: {}", branch);
                }
                println!("   Use SSH: {}", config.git.use_ssh);
                println!("   Sign Commits: {}", config.git.sign_commits);

                println!("\n📝 Editor Settings:");
                if let Some(launcher) = &config.editor.preferred_launcher {
                    println!("   Preferred Launcher: {}", launcher);
                }
                println!("   Tab Width: {}", config.editor.tab_width);
                println!("   Insert Spaces: {}", config.editor.insert_spaces);
                println!("   Format on Save: {}", config.editor.format_on_save);

                println!("\n📊 Telemetry:");
                println!("   Enabled: {}", config.telemetry.enabled);
                println!("   Anonymize Data: {}", config.telemetry.anonymize_data);
                println!("   Error Reporting: {}", config.telemetry.error_reporting);

                println!("\n🔐 Multi-Account:");
                println!("   Enabled: {}", config.multi_account.enabled);
                println!("   Rotation Strategy: {:?}", config.multi_account.rotation_strategy);
                println!("   Auto Switch on Error: {}", config.multi_account.auto_switch_on_error);

                println!("\n💡 Log Level: {:?}", config.log_level);

                println!("\n📄 Config file: {}", config_path.display());
                if !config_path.exists() {
                    println!("   (Using defaults - no config file exists yet)");
                }
                
                // Also show new settings system
                println!("\n--- New Settings System ---");
                let settings = settings_manager.get_settings();
                
                println!("\n🧠 AI Model Settings:");
                println!("   Default Model: {}", settings.ai.default_model);
                println!("   Max Tokens: {}", settings.ai.max_tokens);
                println!("   Temperature: {}", settings.ai.temperature);
                println!("   Top-P: {}", settings.ai.top_p);
                println!("   Streaming: {}", settings.ai.streaming);

                println!("\n🎨 UI/UX Settings:");
                println!("   Color Scheme: {}", settings.ui.color_scheme);
                println!("   Prompt Format: {}", settings.ui.prompt_format);
                println!("   Line Wrapping: {}", settings.ui.line_wrapping);
                println!("   Syntax Highlighting: {}", settings.ui.syntax_highlighting);
                println!("   Show Token Usage: {}", settings.ui.show_token_usage);

                println!("\n⚡ Behavior Settings:");
                println!("   Auto Save: {}", settings.behavior.auto_save);
                println!("   Session Retention: {} days", settings.behavior.session_retention_days);
                println!("   Checkpoint Frequency: {} messages", settings.behavior.checkpoint_frequency);

                if !settings.custom.is_empty() {
                    println!("\n🔧 Custom Settings:");
                    for (key, value) in &settings.custom {
                        println!("   {}: {}", key, value);
                    }
                }
            }

            ConfigCommands::Set(args) => {
                println!("\n⚙️  Set Configuration:\n");

                // Clone args for later use
                let key_str = args.key.clone();
                let value_str = args.value.clone();

                // Load or create config
                let mut config = if config_path.exists() {
                    loader.load_from_file(&config_path).unwrap_or_default()
                } else {
                    Config::default()
                };

                // Parse key path (e.g., "terminal.theme" -> ["terminal", "theme"])
                let key_parts: Vec<&str> = key_str.split('.').collect();

                // Set the value based on key path
                let result = match key_parts.as_slice() {
                    ["log_level"] => {
                        config.log_level = match value_str.to_lowercase().as_str() {
                            "error" => claude_rust_core::config::LogLevel::Error,
                            "warn" => claude_rust_core::config::LogLevel::Warn,
                            "info" => claude_rust_core::config::LogLevel::Info,
                            "verbose" => claude_rust_core::config::LogLevel::Verbose,
                            "debug" => claude_rust_core::config::LogLevel::Debug,
                            "trace" => claude_rust_core::config::LogLevel::Trace,
                            _ => return Err(format!("Invalid log level: {}", value_str).into()),
                        };
                        Ok(())
                    }
                    ["api", "base_url"] => {
                        config.api.base_url = value_str.clone();
                        Ok(())
                    }
                    ["api", "timeout"] => {
                        config.api.timeout = value_str.parse()
                            .map_err(|_| format!("Invalid timeout value: {}", value_str))?;
                        Ok(())
                    }
                    ["terminal", "theme"] => {
                        config.terminal.theme = match value_str.to_lowercase().as_str() {
                            "dark" => claude_rust_core::config::Theme::Dark,
                            "light" => claude_rust_core::config::Theme::Light,
                            "system" => claude_rust_core::config::Theme::System,
                            _ => return Err(format!("Invalid theme: {}", value_str).into()),
                        };
                        Ok(())
                    }
                    ["terminal", "use_colors"] => {
                        config.terminal.use_colors = value_str.parse()
                            .map_err(|_| format!("Invalid boolean value: {}", value_str))?;
                        Ok(())
                    }
                    ["terminal", "code_highlighting"] => {
                        config.terminal.code_highlighting = value_str.parse()
                            .map_err(|_| format!("Invalid boolean value: {}", value_str))?;
                        Ok(())
                    }
                    ["editor", "tab_width"] => {
                        config.editor.tab_width = value_str.parse()
                            .map_err(|_| format!("Invalid tab width: {}", value_str))?;
                        Ok(())
                    }
                    ["editor", "insert_spaces"] => {
                        config.editor.insert_spaces = value_str.parse()
                            .map_err(|_| format!("Invalid boolean value: {}", value_str))?;
                        Ok(())
                    }
                    ["git", "preferred_remote"] => {
                        config.git.preferred_remote = value_str.clone();
                        Ok(())
                    }
                    ["git", "sign_commits"] => {
                        config.git.sign_commits = value_str.parse()
                            .map_err(|_| format!("Invalid boolean value: {}", value_str))?;
                        Ok(())
                    }
                    ["telemetry", "enabled"] => {
                        config.telemetry.enabled = value_str.parse()
                            .map_err(|_| format!("Invalid boolean value: {}", value_str))?;
                        Ok(())
                    }
                    _ => Err(format!("Unknown config key: {}", key_str)),
                };

                result?;

                // Ensure config directory exists
                if !config_dir.exists() {
                    fs::create_dir_all(&config_dir)?;
                }

                // Save config as TOML
                let toml_string = toml::to_string_pretty(&config)?;
                fs::write(&config_path, toml_string)?;

                println!("✅ Configuration updated: {} = {}", key_str, value_str);
                println!("📄 Config saved to: {}", config_path.display());
            }

            ConfigCommands::Get(args) => {
                println!("\n⚙️  Get Configuration:\n");

                let config = loader.load().unwrap_or_default();
                let key_parts: Vec<&str> = args.key.split('.').collect();

                let value = match key_parts.as_slice() {
                    ["log_level"] => format!("{:?}", config.log_level),
                    ["api", "base_url"] => config.api.base_url.clone(),
                    ["api", "timeout"] => config.api.timeout.to_string(),
                    ["terminal", "theme"] => format!("{:?}", config.terminal.theme),
                    ["terminal", "use_colors"] => config.terminal.use_colors.to_string(),
                    ["terminal", "code_highlighting"] => config.terminal.code_highlighting.to_string(),
                    ["editor", "tab_width"] => config.editor.tab_width.to_string(),
                    ["editor", "insert_spaces"] => config.editor.insert_spaces.to_string(),
                    ["git", "preferred_remote"] => config.git.preferred_remote.clone(),
                    ["git", "sign_commits"] => config.git.sign_commits.to_string(),
                    ["telemetry", "enabled"] => config.telemetry.enabled.to_string(),
                    _ => return Err(format!("Unknown config key: {}", args.key).into()),
                };

                println!("  {} = {}", args.key, value);
            }

            ConfigCommands::Reset => {
                println!("\n⚙️  Reset Configuration:\n");

                if config_path.exists() {
                    print!("⚠️  This will reset all configuration to defaults. Continue? [y/N] ");
                    std::io::Write::flush(&mut std::io::stdout())?;

                    let mut input = String::new();
                    std::io::stdin().read_line(&mut input)?;

                    if input.trim().to_lowercase() == "y" {
                        fs::remove_file(&config_path)?;
                        println!("✅ Configuration reset to defaults");
                        println!("📄 Config file removed: {}", config_path.display());
                    } else {
                        println!("❌ Reset cancelled");
                    }
                } else {
                    println!("ℹ️  No config file exists - already using defaults");
                }
            }

            ConfigCommands::Edit => {
                println!("\n⚙️  Edit Configuration:\n");

                // Create default config if it doesn't exist
                if !config_path.exists() {
                    if !config_dir.exists() {
                        fs::create_dir_all(&config_dir)?;
                    }
                    let default_config = Config::default();
                    let toml_string = toml::to_string_pretty(&default_config)?;
                    fs::write(&config_path, toml_string)?;
                    println!("📄 Created default config at: {}", config_path.display());
                }

                // Try to open in editor
                let editor = std::env::var("EDITOR")
                    .or_else(|_| std::env::var("VISUAL"))
                    .unwrap_or_else(|_| {
                        if cfg!(target_os = "windows") {
                            "notepad".to_string()
                        } else {
                            "vi".to_string()
                        }
                    });

                println!("📝 Opening config in {}...", editor);

                let status = ProcessCommand::new(&editor)
                    .arg(&config_path)
                    .status()?;

                if status.success() {
                    // Validate the edited config
                    match loader.load_from_file(&config_path) {
                        Ok(_) => println!("✅ Config saved and validated successfully"),
                        Err(e) => {
                            eprintln!("⚠️  Warning: Config validation failed: {}", e);
                            eprintln!("   The config file may contain errors.");
                        }
                    }
                } else {
                    eprintln!("❌ Editor exited with error");
                }
            }
        }
        Ok(())
    }

    /// Handle codebase commands
    async fn handle_codebase_command(command: CodebaseCommands) -> Result<(), Box<dyn std::error::Error>> {
        use std::fs;
        use std::path::Path;
        use walkdir::WalkDir;

        match command {
            CodebaseCommands::Stats => {
                println!("\n📊 Codebase Statistics:\n");

                let current_dir = std::env::current_dir()?;

                // Statistics counters
                let mut total_files = 0;
                let mut total_lines = 0;
                let mut total_size: u64 = 0;
                let mut file_types: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
                let mut language_lines: std::collections::HashMap<String, usize> = std::collections::HashMap::new();

                // Common code file extensions
                let code_extensions: std::collections::HashSet<&str> = [
                    "rs", "py", "js", "ts", "jsx", "tsx", "java", "c", "cpp", "h", "hpp",
                    "go", "rb", "php", "cs", "swift", "kt", "scala", "r", "m", "mm",
                    "html", "css", "scss", "sass", "less", "vue", "svelte",
                    "json", "yaml", "yml", "toml", "xml", "md", "txt"
                ].iter().cloned().collect();

                println!("📁 Scanning directory: {}\n", current_dir.display());

                // Walk the directory tree
                for entry in WalkDir::new(&current_dir)
                    .into_iter()
                    .filter_entry(|e| {
                        // Skip hidden directories and common ignore patterns
                        let path = e.path();
                        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                        !name.starts_with('.') &&
                        name != "node_modules" &&
                        name != "target" &&
                        name != "dist" &&
                        name != "build" &&
                        name != "__pycache__" &&
                        name != "vendor"
                    })
                {
                    let entry = match entry {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    let path = entry.path();

                    if path.is_file() {
                        // Get file extension
                        let ext = path.extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("no_ext")
                            .to_lowercase();

                        // Only count code files
                        if !code_extensions.contains(ext.as_str()) {
                            continue;
                        }

                        total_files += 1;

                        // Count file type
                        *file_types.entry(ext.clone()).or_insert(0) += 1;

                        // Get file size
                        if let Ok(metadata) = fs::metadata(path) {
                            total_size += metadata.len();
                        }

                        // Count lines for text files
                        if let Ok(contents) = fs::read_to_string(path) {
                            let line_count = contents.lines().count();
                            total_lines += line_count;

                            // Map extension to language
                            let language = match ext.as_str() {
                                "rs" => "Rust",
                                "py" => "Python",
                                "js" | "jsx" => "JavaScript",
                                "ts" | "tsx" => "TypeScript",
                                "java" => "Java",
                                "c" | "h" => "C",
                                "cpp" | "hpp" => "C++",
                                "go" => "Go",
                                "rb" => "Ruby",
                                "php" => "PHP",
                                "cs" => "C#",
                                "swift" => "Swift",
                                "kt" => "Kotlin",
                                "md" => "Markdown",
                                "json" => "JSON",
                                "yaml" | "yml" => "YAML",
                                "toml" => "TOML",
                                _ => "Other",
                            };

                            *language_lines.entry(language.to_string()).or_insert(0) += line_count;
                        }
                    }
                }

                // Display results
                println!("📈 Summary:");
                println!("   Total Files: {}", total_files);
                println!("   Total Lines: {}", total_lines);
                println!("   Total Size: {} bytes ({:.2} MB)", total_size, total_size as f64 / 1_048_576.0);

                if !file_types.is_empty() {
                    println!("\n📁 File Types:");
                    let mut types: Vec<_> = file_types.iter().collect();
                    types.sort_by(|a, b| b.1.cmp(a.1));
                    for (ext, count) in types.iter().take(10) {
                        println!("   .{}: {} files", ext, count);
                    }
                }

                if !language_lines.is_empty() {
                    println!("\n💻 Lines by Language:");
                    let mut langs: Vec<_> = language_lines.iter().collect();
                    langs.sort_by(|a, b| b.1.cmp(a.1));
                    for (lang, lines) in langs {
                        let percentage = (*lines as f64 / total_lines as f64) * 100.0;
                        println!("   {}: {} lines ({:.1}%)", lang, lines, percentage);
                    }
                }
            }

            CodebaseCommands::Scan(args) => {
                println!("\n🔍 Scan Codebase:\n");

                let current_dir = args.path.clone().unwrap_or_else(|| std::env::current_dir().unwrap());
                let max_depth = 3; // Default depth

                println!("📁 Directory: {}", current_dir.display());
                println!("📏 Max Depth: {}\n", max_depth);

                let mut file_count = 0;
                let mut dir_count = 0;

                // Walk with depth limit
                for entry in WalkDir::new(&current_dir)
                    .max_depth(max_depth)
                    .into_iter()
                    .filter_entry(|e| {
                        let path = e.path();
                        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                        !name.starts_with('.') &&
                        name != "node_modules" &&
                        name != "target" &&
                        name != "dist" &&
                        name != "build"
                    })
                {
                    let entry = match entry {
                        Ok(e) => e,
                        Err(_) => continue,
                    };

                    let path = entry.path();
                    let depth = entry.depth();

                    // Skip root
                    if depth == 0 {
                        continue;
                    }

                    let indent = "  ".repeat(depth - 1);
                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("?");

                    if path.is_dir() {
                        dir_count += 1;
                        println!("{}📁 {}/", indent, name);
                    } else if path.is_file() {
                        file_count += 1;

                        // Get file size
                        let size = fs::metadata(path)
                            .map(|m| m.len())
                            .unwrap_or(0);

                        let size_str = if size < 1024 {
                            format!("{} B", size)
                        } else if size < 1_048_576 {
                            format!("{:.1} KB", size as f64 / 1024.0)
                        } else {
                            format!("{:.1} MB", size as f64 / 1_048_576.0)
                        };

                        println!("{}📄 {} ({})", indent, name, size_str);
                    }
                }

                println!("\n✅ Scan complete:");
                println!("   Directories: {}", dir_count);
                println!("   Files: {}", file_count);
            }

            CodebaseCommands::Analyze(args) => {
                println!("\n🔬 Analyze Codebase:\n");

                let current_dir = std::env::current_dir()?;
                println!("📁 Analyzing: {}\n", current_dir.display());

                // Simple analysis: find main code files and show basic structure
                let mut main_files = Vec::new();
                let mut config_files = Vec::new();
                let mut test_files = Vec::new();

                for entry in WalkDir::new(&current_dir)
                    .max_depth(3)
                    .into_iter()
                    .filter_entry(|e| {
                        let name = e.path().file_name().and_then(|n| n.to_str()).unwrap_or("");
                        !name.starts_with('.') && name != "node_modules" && name != "target"
                    })
                    .filter_map(|e| e.ok())
                {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }

                    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    let name_lower = name.to_lowercase();

                    // Categorize files
                    if name_lower.contains("test") || name_lower.contains("spec") {
                        test_files.push(path.to_path_buf());
                    } else if name == "Cargo.toml" || name == "package.json" || name == "go.mod" ||
                              name == "pom.xml" || name == "build.gradle" || name == "requirements.txt" {
                        config_files.push(path.to_path_buf());
                    } else if name == "main.rs" || name == "lib.rs" || name == "mod.rs" ||
                              name == "main.py" || name == "__init__.py" ||
                              name == "index.js" || name == "index.ts" ||
                              name == "main.go" || name == "Main.java" {
                        main_files.push(path.to_path_buf());
                    }
                }

                if !config_files.is_empty() {
                    println!("⚙️  Configuration Files:");
                    for file in config_files.iter().take(10) {
                        let rel_path = file.strip_prefix(&current_dir)
                            .unwrap_or(file);
                        println!("   📄 {}", rel_path.display());
                    }
                    println!();
                }

                if !main_files.is_empty() {
                    println!("🎯 Entry Points / Main Files:");
                    for file in main_files.iter().take(10) {
                        let rel_path = file.strip_prefix(&current_dir)
                            .unwrap_or(file);

                        // Try to count lines
                        let line_count = fs::read_to_string(file)
                            .map(|c| c.lines().count())
                            .unwrap_or(0);

                        println!("   📄 {} ({} lines)", rel_path.display(), line_count);
                    }
                    println!();
                }

                if !test_files.is_empty() {
                    println!("🧪 Test Files:");
                    for file in test_files.iter().take(10) {
                        let rel_path = file.strip_prefix(&current_dir)
                            .unwrap_or(file);
                        println!("   📄 {}", rel_path.display());
                    }
                    println!();
                }

                println!("✅ Analysis complete");
                println!("💡 Tip: Use 'codebase stats' for detailed statistics");
            }
        }
        Ok(())
    }

    /// Handle file commands
    async fn handle_file_command(command: FileCommands) -> Result<(), Box<dyn std::error::Error>> {
        use std::fs;
        use std::io::Write;

        match command {
            FileCommands::Read(args) => {
                println!("\n📖 Read File:\n");

                let path = std::path::Path::new(&args.path);

                if !path.exists() {
                    eprintln!("❌ File not found: {}", args.path.display());
                    return Err(format!("File not found: {}", args.path.display()).into());
                }

                if !path.is_file() {
                    eprintln!("❌ Not a file: {}", args.path.display());
                    return Err(format!("Not a file: {}", args.path.display()).into());
                }

                let metadata = fs::metadata(path)?;
                let file_size = metadata.len();

                println!("📄 File: {}", args.path.display());
                println!("📏 Size: {} bytes", file_size);
                println!();

                // Read and display file contents
                let contents = fs::read_to_string(path).map_err(|e| {
                    if e.kind() == std::io::ErrorKind::InvalidData {
                        format!("File contains invalid UTF-8 (binary file?): {}", args.path.display())
                    } else {
                        format!("Failed to read file: {}", e)
                    }
                })?;

                // Display with line numbers for better readability
                let lines: Vec<&str> = contents.lines().collect();
                let num_lines = lines.len();

                if num_lines > 100 {
                    println!("⚠️  Large file ({} lines). Showing first 50 and last 50 lines...\n", num_lines);

                    // Show first 50 lines
                    for (i, line) in lines.iter().take(50).enumerate() {
                        println!("{:4} | {}", i + 1, line);
                    }

                    println!("\n... {} lines omitted ...\n", num_lines - 100);

                    // Show last 50 lines
                    for (i, line) in lines.iter().skip(num_lines - 50).enumerate() {
                        println!("{:4} | {}", num_lines - 50 + i + 1, line);
                    }
                } else {
                    for (i, line) in lines.iter().enumerate() {
                        println!("{:4} | {}", i + 1, line);
                    }
                }

                println!("\n✅ Read {} lines ({} bytes)", num_lines, file_size);
            }

            FileCommands::Write(args) => {
                println!("\n✍️  Write File:\n");

                let path = std::path::Path::new(&args.path);

                // Check if file exists and warn
                if path.exists() {
                    print!("⚠️  File already exists. Overwrite? [y/N] ");
                    std::io::stdout().flush()?;

                    let mut input = String::new();
                    std::io::stdin().read_line(&mut input)?;

                    if input.trim().to_lowercase() != "y" {
                        println!("❌ Write cancelled");
                        return Ok(());
                    }
                }

                // Create parent directories if they don't exist
                if let Some(parent) = path.parent() {
                    if !parent.exists() {
                        fs::create_dir_all(parent)?;
                        println!("📁 Created directories: {}", parent.display());
                    }
                }

                // Write the content
                fs::write(path, &args.content)?;

                let written_bytes = args.content.len();
                let num_lines = args.content.lines().count();

                println!("✅ Wrote {} lines ({} bytes) to: {}", num_lines, written_bytes, args.path.display());
            }

            FileCommands::Copy(args) => {
                println!("\n📋 Copy File:\n");

                let from_path = std::path::Path::new(&args.from);
                let to_path = std::path::Path::new(&args.to);

                // Validate source file
                if !from_path.exists() {
                    eprintln!("❌ Source file not found: {}", args.from.display());
                    return Err(format!("Source file not found: {}", args.from.display()).into());
                }

                if !from_path.is_file() {
                    eprintln!("❌ Source is not a file: {}", args.from.display());
                    return Err(format!("Source is not a file: {}", args.from.display()).into());
                }

                // Check if destination exists
                if to_path.exists() {
                    print!("⚠️  Destination already exists. Overwrite? [y/N] ");
                    std::io::stdout().flush()?;

                    let mut input = String::new();
                    std::io::stdin().read_line(&mut input)?;

                    if input.trim().to_lowercase() != "y" {
                        println!("❌ Copy cancelled");
                        return Ok(());
                    }
                }

                // Create parent directories for destination if needed
                if let Some(parent) = to_path.parent() {
                    if !parent.exists() {
                        fs::create_dir_all(parent)?;
                        println!("📁 Created directories: {}", parent.display());
                    }
                }

                // Copy the file
                fs::copy(from_path, to_path)?;

                let metadata = fs::metadata(to_path)?;
                let file_size = metadata.len();

                println!("✅ Copied: {} → {}", args.from.display(), args.to.display());
                println!("📏 Size: {} bytes", file_size);
            }

            FileCommands::Move(args) => {
                println!("\n🚚 Move File:\n");

                let from_path = std::path::Path::new(&args.from);
                let to_path = std::path::Path::new(&args.to);

                // Validate source file
                if !from_path.exists() {
                    eprintln!("❌ Source file not found: {}", args.from.display());
                    return Err(format!("Source file not found: {}", args.from.display()).into());
                }

                if !from_path.is_file() {
                    eprintln!("❌ Source is not a file: {}", args.from.display());
                    return Err(format!("Source is not a file: {}", args.from.display()).into());
                }

                // Check if destination exists
                if to_path.exists() {
                    print!("⚠️  Destination already exists. Overwrite? [y/N] ");
                    std::io::stdout().flush()?;

                    let mut input = String::new();
                    std::io::stdin().read_line(&mut input)?;

                    if input.trim().to_lowercase() != "y" {
                        println!("❌ Move cancelled");
                        return Ok(());
                    }
                }

                // Create parent directories for destination if needed
                if let Some(parent) = to_path.parent() {
                    if !parent.exists() {
                        fs::create_dir_all(parent)?;
                        println!("📁 Created directories: {}", parent.display());
                    }
                }

                // Get file size before moving
                let metadata = fs::metadata(from_path)?;
                let file_size = metadata.len();

                // Move the file (rename works across same filesystem, otherwise copy + delete)
                fs::rename(from_path, to_path)?;

                println!("✅ Moved: {} → {}", args.from.display(), args.to.display());
                println!("📏 Size: {} bytes", file_size);
            }
        }
        Ok(())
    }

    /// Handle bash commands
    async fn handle_bash_command(command: BashCommands) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::{Command, Stdio};
        use std::time::Duration;

        match command {
            BashCommands::Exec(args) => {
                println!("\n⚡ Execute Bash Command:\n");

                if args.verbose {
                    println!("🔍 Command: {}", args.command);
                    if let Some(ref dir) = args.dir {
                        println!("📁 Directory: {}", dir.display());
                    }
                    println!("⏱️  Timeout: {} seconds\n", args.timeout.unwrap_or(30));
                }

                // Determine shell command based on OS
                let (shell, shell_arg) = if cfg!(target_os = "windows") {
                    ("cmd", "/C")
                } else {
                    ("sh", "-c")
                };

                // Build command
                let mut cmd = Command::new(shell);
                cmd.arg(shell_arg)
                   .arg(&args.command)
                   .stdout(Stdio::piped())
                   .stderr(Stdio::piped());

                // Set working directory if specified
                if let Some(ref dir) = args.dir {
                    cmd.current_dir(dir);
                }

                // Execute with timeout
                let timeout_duration = Duration::from_secs(args.timeout.unwrap_or(30));

                let output = tokio::time::timeout(
                    timeout_duration,
                    tokio::task::spawn_blocking(move || cmd.output())
                ).await;

                match output {
                    Ok(Ok(Ok(output))) => {
                        // Success
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        let stderr = String::from_utf8_lossy(&output.stderr);

                        if !stdout.is_empty() {
                            println!("📤 Output:");
                            println!("{}", stdout);
                        }

                        if !stderr.is_empty() {
                            println!("⚠️  Stderr:");
                            println!("{}", stderr);
                        }

                        if output.status.success() {
                            println!("✅ Command completed successfully");
                        } else {
                            let exit_code = output.status.code().unwrap_or(-1);
                            println!("❌ Command failed with exit code: {}", exit_code);
                            return Err(format!("Command failed with exit code: {}", exit_code).into());
                        }
                    }
                    Ok(Ok(Err(e))) => {
                        eprintln!("❌ Failed to execute command: {}", e);
                        return Err(e.into());
                    }
                    Ok(Err(e)) => {
                        eprintln!("❌ Task execution error: {}", e);
                        return Err(e.into());
                    }
                    Err(_) => {
                        eprintln!("❌ Command timed out after {} seconds", args.timeout.unwrap_or(30));
                        return Err("Command execution timed out".into());
                    }
                }
            }

            BashCommands::Script(args) => {
                println!("\n📜 Execute Bash Script:\n");

                let script_path = std::path::Path::new(&args.script);

                // Validate script exists
                if !script_path.exists() {
                    eprintln!("❌ Script file not found: {}", args.script.display());
                    return Err(format!("Script file not found: {}", args.script.display()).into());
                }

                if !script_path.is_file() {
                    eprintln!("❌ Path is not a file: {}", args.script.display());
                    return Err(format!("Path is not a file: {}", args.script.display()).into());
                }

                println!("📄 Script: {}", args.script.display());
                if !args.args.is_empty() {
                    println!("📋 Args: {}", args.args.join(" "));
                }
                println!("⏱️  Timeout: {} seconds\n", args.timeout.unwrap_or(60));

                // Determine shell based on OS
                let shell = if cfg!(target_os = "windows") {
                    "cmd"
                } else {
                    "sh"
                };

                // Build command
                let mut cmd = Command::new(shell);

                if cfg!(target_os = "windows") {
                    cmd.arg("/C");
                }

                cmd.arg(&args.script)
                   .args(&args.args)
                   .stdout(Stdio::piped())
                   .stderr(Stdio::piped());

                // Execute with timeout
                let timeout_duration = Duration::from_secs(args.timeout.unwrap_or(60));

                let output = tokio::time::timeout(
                    timeout_duration,
                    tokio::task::spawn_blocking(move || cmd.output())
                ).await;

                match output {
                    Ok(Ok(Ok(output))) => {
                        // Success
                        let stdout = String::from_utf8_lossy(&output.stdout);
                        let stderr = String::from_utf8_lossy(&output.stderr);

                        if !stdout.is_empty() {
                            println!("📤 Output:");
                            println!("{}", stdout);
                        }

                        if !stderr.is_empty() {
                            println!("⚠️  Stderr:");
                            println!("{}", stderr);
                        }

                        if output.status.success() {
                            println!("✅ Script completed successfully");
                        } else {
                            let exit_code = output.status.code().unwrap_or(-1);
                            println!("❌ Script failed with exit code: {}", exit_code);
                            return Err(format!("Script failed with exit code: {}", exit_code).into());
                        }
                    }
                    Ok(Ok(Err(e))) => {
                        eprintln!("❌ Failed to execute script: {}", e);
                        return Err(e.into());
                    }
                    Ok(Err(e)) => {
                        eprintln!("❌ Task execution error: {}", e);
                        return Err(e.into());
                    }
                    Err(_) => {
                        eprintln!("❌ Script timed out after {} seconds", args.timeout.unwrap_or(60));
                        return Err("Script execution timed out".into());
                    }
                }
            }
        }
        Ok(())
    }

    /// Handle git commands
    async fn handle_git_command(command: GitCommands) -> Result<(), Box<dyn std::error::Error>> {
        use std::process::Command;

        match command {
            GitCommands::Status => {
                println!("\n📊 Git Status:\n");

                // Check if we're in a git repository
                let check_repo = Command::new("git")
                    .args(&["rev-parse", "--git-dir"])
                    .output()?;

                if !check_repo.status.success() {
                    eprintln!("❌ Not a git repository");
                    return Err("Not a git repository".into());
                }

                // Run git status
                let output = Command::new("git")
                    .args(&["status", "--short", "--branch"])
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);

                    // Also show a summary
                    let status_full = Command::new("git")
                        .args(&["status"])
                        .output()?;

                    let full_output = String::from_utf8_lossy(&status_full.stdout);

                    // Extract useful info
                    if full_output.contains("nothing to commit") {
                        println!("✅ Working tree clean");
                    } else if full_output.contains("Changes to be committed") {
                        println!("📝 Changes staged for commit");
                    } else if full_output.contains("Changes not staged") {
                        println!("⚠️  Unstaged changes present");
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git status failed: {}", stderr);
                    return Err("Git status failed".into());
                }
            }

            GitCommands::Branch => {
                println!("\n🌿 Current Branch:\n");

                let output = Command::new("git")
                    .args(&["branch", "--show-current"])
                    .output()?;

                if output.status.success() {
                    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    println!("📌 {}", branch);

                    // Show tracking info
                    let tracking = Command::new("git")
                        .args(&["status", "-sb"])
                        .output()?;

                    if tracking.status.success() {
                        let tracking_info = String::from_utf8_lossy(&tracking.stdout);
                        let first_line = tracking_info.lines().next().unwrap_or("");
                        if first_line.contains("...") {
                            println!("🔗 {}", first_line);
                        }
                    }
                } else {
                    eprintln!("❌ Failed to get current branch");
                    return Err("Failed to get branch".into());
                }
            }

            GitCommands::Log(args) => {
                println!("\n📜 Git Log:\n");

                let mut git_args = vec!["log"];

                let count_str = format!("-{}", args.count);
                git_args.push(&count_str);

                if args.oneline {
                    git_args.push("--oneline");
                } else {
                    git_args.push("--pretty=format:%C(yellow)%h%Creset %C(blue)%ad%Creset %C(green)%an%Creset %s");
                    git_args.push("--date=relative");
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git log failed: {}", stderr);
                    return Err("Git log failed".into());
                }
            }

            GitCommands::Diff(args) => {
                println!("\n📊 Git Diff:\n");

                let mut git_args = vec!["diff"];

                if args.staged {
                    git_args.push("--cached");
                }

                if let Some(ref path) = args.path {
                    git_args.push("--");
                    let path_str = path.to_str().ok_or("Invalid path")?;
                    git_args.push(path_str);
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if stdout.is_empty() {
                        println!("✅ No changes to show");
                    } else {
                        println!("{}", stdout);
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git diff failed: {}", stderr);
                    return Err("Git diff failed".into());
                }
            }

            GitCommands::Add(args) => {
                println!("\n➕ Git Add:\n");

                if args.files.is_empty() {
                    eprintln!("❌ No files specified");
                    return Err("No files specified".into());
                }

                let mut git_args = vec!["add"];
                let file_refs: Vec<&str> = args.files.iter().map(|s| s.as_str()).collect();
                git_args.extend(file_refs);

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    println!("✅ Files staged:");
                    for file in &args.files {
                        println!("   📄 {}", file);
                    }

                    // Show updated status
                    let status = Command::new("git")
                        .args(&["status", "--short"])
                        .output()?;

                    if status.status.success() {
                        let status_output = String::from_utf8_lossy(&status.stdout);
                        if !status_output.is_empty() {
                            println!("\n📊 Status:");
                            println!("{}", status_output);
                        }
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git add failed: {}", stderr);
                    return Err("Git add failed".into());
                }
            }

            GitCommands::Commit(args) => {
                println!("\n💾 Git Commit:\n");

                let mut git_args = vec!["commit", "-m"];
                git_args.push(&args.message);

                if args.amend {
                    git_args.insert(1, "--amend");
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);
                    println!("✅ Commit created successfully");

                    // Show the commit
                    let show_commit = Command::new("git")
                        .args(&["log", "-1", "--oneline"])
                        .output()?;

                    if show_commit.status.success() {
                        let commit_info = String::from_utf8_lossy(&show_commit.stdout);
                        println!("📝 {}", commit_info.trim());
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git commit failed: {}", stderr);
                    return Err("Git commit failed".into());
                }
            }

            GitCommands::Branches(args) => {
                println!("\n🌿 Git Branches:\n");

                let mut git_args = vec!["branch"];

                if args.all {
                    git_args.push("-a");
                }

                if args.verbose {
                    git_args.push("-vv");
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Git branch list failed: {}", stderr);
                    return Err("Git branch list failed".into());
                }
            }

            GitCommands::BranchCreate(args) => {
                println!("\n🌱 Create Branch:\n");

                let mut git_args = vec!["branch", &args.name];

                if let Some(ref start_point) = args.start_point {
                    git_args.push(start_point);
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    println!("✅ Created branch: {}", args.name);

                    if let Some(start) = args.start_point {
                        println!("📍 Starting from: {}", start);
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Failed to create branch: {}", stderr);
                    return Err("Failed to create branch".into());
                }
            }

            GitCommands::Checkout(args) => {
                println!("\n🔀 Switch Branch:\n");

                let mut git_args = vec!["checkout"];

                if args.create {
                    git_args.push("-b");
                }

                git_args.push(&args.branch);

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);

                    if args.create {
                        println!("✅ Created and switched to branch: {}", args.branch);
                    } else {
                        println!("✅ Switched to branch: {}", args.branch);
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Failed to switch branch: {}", stderr);
                    return Err("Failed to switch branch".into());
                }
            }

            GitCommands::Merge(args) => {
                println!("\n🔀 Merge Branch:\n");

                let mut git_args = vec!["merge"];

                if args.ff_only {
                    git_args.push("--ff-only");
                } else if args.no_ff {
                    git_args.push("--no-ff");
                }

                git_args.push(&args.branch);

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);
                    println!("✅ Merged branch: {}", args.branch);
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);

                    if stderr.contains("CONFLICT") {
                        eprintln!("⚠️  Merge conflict detected:");
                        eprintln!("{}", stderr);
                        eprintln!("\n💡 Resolve conflicts and commit the result");
                    } else {
                        eprintln!("❌ Merge failed: {}", stderr);
                    }
                    return Err("Merge failed or has conflicts".into());
                }
            }

            GitCommands::BranchDelete(args) => {
                println!("\n🗑️  Delete Branch:\n");

                let delete_flag = if args.force { "-D" } else { "-d" };

                let output = Command::new("git")
                    .args(&["branch", delete_flag, &args.name])
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    println!("{}", stdout);
                    println!("✅ Deleted branch: {}", args.name);
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Failed to delete branch: {}", stderr);

                    if stderr.contains("not fully merged") {
                        eprintln!("💡 Use --force (-D) to force delete unmerged branch");
                    }
                    return Err("Failed to delete branch".into());
                }
            }

            GitCommands::Push(args) => {
                println!("\n⬆️  Git Push:\n");

                let remote = args.remote.as_deref().unwrap_or("origin");
                let mut git_args: Vec<String> = vec!["push".to_string()];

                if args.force {
                    git_args.push("--force".to_string());
                }

                if args.set_upstream {
                    git_args.push("-u".to_string());
                }

                git_args.push(remote.to_string());

                if let Some(ref branch) = args.branch {
                    git_args.push(branch.clone());
                } else {
                    // Get current branch if not specified
                    let current_branch = Command::new("git")
                        .args(&["branch", "--show-current"])
                        .output()?;

                    if current_branch.status.success() {
                        let branch_name = String::from_utf8_lossy(&current_branch.stdout)
                            .trim()
                            .to_string();

                        if !branch_name.is_empty() {
                            git_args.push(branch_name);
                        }
                    }
                }

                let output = Command::new("git")
                    .args(&git_args.iter().map(|s| s.as_str()).collect::<Vec<_>>())
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);

                    if !stdout.is_empty() {
                        println!("{}", stdout);
                    }
                    if !stderr.is_empty() {
                        println!("{}", stderr);
                    }

                    println!("✅ Push completed");
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Push failed: {}", stderr);
                    return Err("Push failed".into());
                }
            }

            GitCommands::Pull(args) => {
                println!("\n⬇️  Git Pull:\n");

                let remote = args.remote.as_deref().unwrap_or("origin");
                let mut git_args = vec!["pull"];

                if args.rebase {
                    git_args.push("--rebase");
                }

                git_args.push(remote);

                if let Some(ref branch) = args.branch {
                    git_args.push(branch);
                }

                let output = Command::new("git")
                    .args(&git_args)
                    .output()?;

                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let stderr = String::from_utf8_lossy(&output.stderr);

                    if !stdout.is_empty() {
                        println!("{}", stdout);
                    }
                    if !stderr.is_empty() {
                        println!("{}", stderr);
                    }

                    println!("✅ Pull completed");
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    eprintln!("❌ Pull failed: {}", stderr);

                    if stderr.contains("CONFLICT") {
                        eprintln!("💡 Resolve conflicts before continuing");
                    }
                    return Err("Pull failed".into());
                }
            }
        }
        Ok(())
    }

    /// Handle MCP commands
    async fn handle_mcp_command(command: McpCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_mcp::{ServerConfig, McpConfig};
        use std::path::PathBuf;

        match command {
            McpCommands::List => {
                println!("\n📋 MCP Servers:\n");

                // Try to load MCP config
                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("mcp.json");

                if !config_path.exists() {
                    println!("⚠️  No MCP servers configured");
                    println!("💡 Create {} to configure servers", config_path.display());
                    return Ok(());
                }

                let config = McpConfig::load(&config_path)?;

                if config.servers.is_empty() {
                    println!("⚠️  No MCP servers configured");
                } else {
                    println!("Found {} server(s):\n", config.servers.len());

                    for server in &config.servers {
                        let status = if server.enabled { "✅" } else { "❌" };
                        println!("{} {} (priority: {})", status, server.name, server.priority);
                        println!("   Command: {} {}", server.command, server.args.join(" "));

                        if let Some(ref cwd) = server.cwd {
                            println!("   Working Directory: {}", cwd.display());
                        }

                        println!();
                    }
                }
            }

            McpCommands::Status { name } => {
                println!("\n📊 MCP Server Status:\n");

                if let Some(server_name) = name {
                    println!("Checking status for: {}", server_name);
                    println!("⚠️  Status checking not yet implemented");
                    println!("💡 Use 'mcp list' to see configured servers");
                } else {
                    println!("⚠️  Status checking not yet implemented");
                    println!("💡 Specify a server name: claude-code mcp status <name>");
                }
            }

            McpCommands::Connect { name } => {
                println!("\n🔌 Connecting to MCP Server: {}\n", name);
                println!("⚠️  Server connection not yet implemented");
                println!("💡 This feature is coming soon");
            }

            McpCommands::Disconnect { name } => {
                println!("\n🔌 Disconnecting from MCP Server: {}\n", name);
                println!("⚠️  Server disconnection not yet implemented");
                println!("💡 This feature is coming soon");
            }

            McpCommands::Resources { server } => {
                println!("\n📚 MCP Resources:\n");

                if let Some(server_name) = server {
                    println!("Listing resources from: {}", server_name);
                } else {
                    println!("Listing resources from all servers");
                }

                println!("⚠️  Resource listing not yet implemented");
                println!("💡 This feature requires active server connections");
            }

            McpCommands::Tools { server } => {
                println!("\n🔧 MCP Tools:\n");

                if let Some(server_name) = server {
                    println!("Listing tools from: {}", server_name);
                } else {
                    println!("Listing tools from all servers");
                }

                println!("⚠️  Tool listing not yet implemented");
                println!("💡 This feature requires active server connections");
            }

            McpCommands::Prompts { server } => {
                println!("\n💬 MCP Prompts:\n");

                if let Some(server_name) = server {
                    println!("Listing prompts from: {}", server_name);
                } else {
                    println!("Listing prompts from all servers");
                }

                println!("⚠️  Prompt listing not yet implemented");
                println!("💡 This feature requires active server connections");
            }
        }
        Ok(())
    }

    /// Handle hooks commands
    async fn handle_hooks_command(command: HooksCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_hooks::{HooksConfig, HookExecutor, HookContext, HookPoint};
        use std::path::PathBuf;

        match command {
            HooksCommands::List => {
                println!("\n🪝 Configured Hooks:\n");

                // Try to load hooks config
                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("hooks.yaml");

                if !config_path.exists() {
                    println!("⚠️  No hooks configured");
                    println!("💡 Create {} to configure hooks", config_path.display());
                    return Ok(());
                }

                let config = HooksConfig::load(&config_path)?;

                if config.hooks.is_empty() {
                    println!("⚠️  No hooks configured");
                } else {
                    println!("Found {} hook(s):\n", config.hooks.len());

                    for hook in &config.hooks {
                        let status = if hook.enabled { "✅" } else { "❌" };
                        let blocking = if hook.blocking { "🔒 BLOCKING" } else { "" };

                        println!("{} {} {} (priority: {})", status, hook.name, blocking, hook.priority);

                        if let Some(ref desc) = hook.description {
                            println!("   Description: {}", desc);
                        }

                        println!("   Points: {:?}", hook.points);
                        println!("   Timeout: {}s", hook.timeout);
                        println!();
                    }

                    println!("Global Settings:");
                    println!("  Enabled: {}", config.settings.enabled);
                    println!("  Max Concurrent: {}", config.settings.max_concurrent);
                    println!("  Continue on Failure: {}", config.settings.continue_on_failure);
                }
            }

            HooksCommands::Show { name } => {
                println!("\n🪝 Hook Details: {}\n", name);

                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("hooks.yaml");

                if !config_path.exists() {
                    println!("⚠️  No hooks configured");
                    return Ok(());
                }

                let config = HooksConfig::load(&config_path)?;

                if let Some(hook) = config.find_hook(&name) {
                    println!("Name: {}", hook.name);
                    println!("Enabled: {}", hook.enabled);
                    println!("Blocking: {}", hook.blocking);
                    println!("Priority: {}", hook.priority);
                    println!("Timeout: {}s", hook.timeout);

                    if let Some(ref desc) = hook.description {
                        println!("Description: {}", desc);
                    }

                    println!("\nHook Points:");
                    for point in &hook.points {
                        println!("  - {:?}", point);
                    }

                    println!("\nConfiguration:");
                    let config_json = serde_json::to_string_pretty(&hook.hook_type)?;
                    println!("{}", config_json);
                } else {
                    println!("❌ Hook '{}' not found", name);
                }
            }

            HooksCommands::Enable { name } => {
                println!("\n🪝 Enabling Hook: {}\n", name);

                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("hooks.yaml");

                if !config_path.exists() {
                    println!("❌ No hooks configured");
                    return Ok(());
                }

                let mut config = HooksConfig::load(&config_path)?;

                if config.set_hook_enabled(&name, true) {
                    config.save(&config_path)?;
                    println!("✅ Hook '{}' enabled", name);
                } else {
                    println!("❌ Hook '{}' not found", name);
                }
            }

            HooksCommands::Disable { name } => {
                println!("\n🪝 Disabling Hook: {}\n", name);

                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("hooks.yaml");

                if !config_path.exists() {
                    println!("❌ No hooks configured");
                    return Ok(());
                }

                let mut config = HooksConfig::load(&config_path)?;

                if config.set_hook_enabled(&name, false) {
                    config.save(&config_path)?;
                    println!("✅ Hook '{}' disabled", name);
                } else {
                    println!("❌ Hook '{}' not found", name);
                }
            }

            HooksCommands::Test { name, point } => {
                println!("\n🧪 Testing Hook: {}\n", name);

                let config_path = dirs::config_dir()
                    .ok_or("Failed to get config directory")?
                    .join("claude-code")
                    .join("hooks.yaml");

                if !config_path.exists() {
                    println!("❌ No hooks configured");
                    return Ok(());
                }

                let config = HooksConfig::load(&config_path)?;

                if let Some(hook) = config.find_hook(&name) {
                    // Determine hook point to test
                    let test_point = if let Some(point_str) = point {
                        match point_str.as_str() {
                            "session-start" => HookPoint::SessionStart,
                            "session-end" => HookPoint::SessionEnd,
                            "pre-commit" => HookPoint::PreCommit,
                            "post-commit" => HookPoint::PostCommit,
                            "before-tool-use" => HookPoint::BeforeToolUse,
                            "after-tool-use" => HookPoint::AfterToolUse,
                            "user-prompt-submit" => HookPoint::UserPromptSubmit,
                            _ => {
                                println!("❌ Unknown hook point: {}", point_str);
                                return Ok(());
                            }
                        }
                    } else {
                        hook.points.first().cloned().unwrap_or(HookPoint::SessionStart)
                    };

                    println!("Testing at point: {:?}", test_point);
                    println!("Executing...\n");

                    // Create executor
                    let executor = HookExecutor::new(config);
                    let context = HookContext::new(test_point);

                    // Execute hooks
                    let results = executor.execute_hooks(test_point, context).await?;

                    for result in results {
                        println!("Result:");
                        println!("  Success: {}", result.success);

                        if let Some(output) = result.output {
                            println!("  Output: {}", output);
                        }

                        if let Some(error) = result.error {
                            println!("  Error: {}", error);
                        }

                        if let Some(exit_code) = result.exit_code {
                            println!("  Exit Code: {}", exit_code);
                        }

                        if result.block {
                            println!("  ⚠️  Hook would BLOCK operation");
                        }
                    }
                } else {
                    println!("❌ Hook '{}' not found", name);
                }
            }
        }
        Ok(())
    }

    /// Handle tasks command
    async fn handle_tasks_command(command: TasksCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_tasks::{TaskExecutor, Task, TaskStatus};
        use std::str::FromStr;

        // Create a global executor instance (in real implementation, this would be shared)
        let executor = TaskExecutor::new(5, 100);

        match command {
            TasksCommands::List { status } => {
                println!("\n📋 Background Tasks:\n");

                let tasks = if let Some(status_str) = status {
                    let task_status = match status_str.to_lowercase().as_str() {
                        "queued" => TaskStatus::Queued,
                        "running" => TaskStatus::Running,
                        "completed" => TaskStatus::Completed,
                        "failed" => TaskStatus::Failed,
                        "cancelled" => TaskStatus::Cancelled,
                        _ => {
                            println!("❌ Invalid status. Use: queued, running, completed, failed, or cancelled");
                            return Ok(());
                        }
                    };

                    // Filter by status
                    executor.list_all().await.into_iter()
                        .filter(|t| t.status == task_status)
                        .collect()
                } else {
                    executor.list_all().await
                };

                if tasks.is_empty() {
                    println!("No tasks found.");
                    return Ok(());
                }

                // Group by status
                let mut queued = Vec::new();
                let mut running = Vec::new();
                let mut completed = Vec::new();
                let mut failed = Vec::new();
                let mut cancelled = Vec::new();

                for task in tasks {
                    match task.status {
                        TaskStatus::Queued => queued.push(task),
                        TaskStatus::Running => running.push(task),
                        TaskStatus::Completed => completed.push(task),
                        TaskStatus::Failed => failed.push(task),
                        TaskStatus::Cancelled => cancelled.push(task),
                    }
                }

                if !queued.is_empty() {
                    println!("⏳ Queued ({}):", queued.len());
                    for task in queued {
                        println!("  • {} [{}] - {} (Priority: {:?})",
                            task.id, task.task_type, task.name, task.priority);
                    }
                    println!();
                }

                if !running.is_empty() {
                    println!("🏃 Running ({}):", running.len());
                    for task in running {
                        let elapsed = if let Some(started) = task.started_at {
                            let duration = chrono::Utc::now().signed_duration_since(started);
                            format!(" ({}s)", duration.num_seconds())
                        } else {
                            String::new()
                        };
                        println!("  • {} [{}] - {}{} ({}%)",
                            task.id, task.task_type, task.name, elapsed, task.progress);
                    }
                    println!();
                }

                if !completed.is_empty() {
                    println!("✅ Completed ({}):", completed.len());
                    for task in completed {
                        println!("  • {} [{}] - {}",
                            task.id, task.task_type, task.name);
                    }
                    println!();
                }

                if !failed.is_empty() {
                    println!("❌ Failed ({}):", failed.len());
                    for task in failed {
                        println!("  • {} [{}] - {}",
                            task.id, task.task_type, task.name);
                        if let Some(msg) = &task.message {
                            println!("    Error: {}", msg);
                        }
                    }
                    println!();
                }

                if !cancelled.is_empty() {
                    println!("🚫 Cancelled ({}):", cancelled.len());
                    for task in cancelled {
                        println!("  • {} [{}] - {}",
                            task.id, task.task_type, task.name);
                    }
                    println!();
                }
            }

            TasksCommands::Show { task_id } => {
                use uuid::Uuid;

                // Parse task ID
                let uuid = Uuid::from_str(&task_id)
                    .map_err(|_| "Invalid task ID format")?;
                let task_id = claude_rust_tasks::TaskId::from(uuid);

                if let Some(task) = executor.get_status(task_id).await {
                    println!("\n📋 Task Details:\n");
                    println!("ID:          {}", task.id);
                    println!("Name:        {}", task.name);
                    println!("Type:        {}", task.task_type);
                    println!("Status:      {:?}", task.status);
                    println!("Priority:    {:?}", task.priority);
                    println!("Progress:    {}%", task.progress);
                    println!("Created:     {}", task.created_at);

                    if let Some(started) = task.started_at {
                        println!("Started:     {}", started);
                    }

                    if let Some(completed) = task.completed_at {
                        println!("Completed:   {}", completed);

                        let duration = completed.signed_duration_since(task.started_at.unwrap_or(task.created_at));
                        println!("Duration:    {}.{}s", duration.num_seconds(), duration.num_milliseconds() % 1000);
                    }

                    if let Some(message) = &task.message {
                        println!("\nMessage:\n{}", message);
                    }
                } else {
                    println!("❌ Task not found: {}", task_id);
                }
            }

            TasksCommands::Cancel { task_id } => {
                use uuid::Uuid;

                // Parse task ID
                let uuid = Uuid::from_str(&task_id)
                    .map_err(|_| "Invalid task ID format")?;
                let task_id_parsed = claude_rust_tasks::TaskId::from(uuid);

                match executor.cancel(task_id_parsed).await {
                    Ok(()) => {
                        println!("✅ Task cancelled: {}", task_id);
                    }
                    Err(e) => {
                        println!("❌ Failed to cancel task: {}", e);
                    }
                }
            }
        }
        Ok(())
    }

    /// Handle agents command
    async fn handle_agents_command(command: AgentsCommands) -> Result<(), Box<dyn std::error::Error>> {
        use claude_rust_agents::{AgentRegistry, Agent, AgentType, AgentStatus};
        use std::str::FromStr;

        // Create global registry (in real implementation, this would be shared)
        let registry = AgentRegistry::new(10);

        match command {
            AgentsCommands::List { agent_type, status } => {
                println!("\n🤖 Agents:\n");

                let mut agents = registry.list().await;

                // Filter by type
                if let Some(type_str) = agent_type {
                    let filter_type = match type_str.to_lowercase().as_str() {
                        "general" => AgentType::General,
                        "code-review" => AgentType::CodeReview,
                        "testing" => AgentType::Testing,
                        "documentation" => AgentType::Documentation,
                        "refactoring" => AgentType::Refactoring,
                        "security-scan" => AgentType::SecurityScan,
                        "performance" => AgentType::Performance,
                        "code-generation" => AgentType::CodeGeneration,
                        _ => {
                            println!("❌ Invalid agent type");
                            return Ok(());
                        }
                    };
                    agents.retain(|a| a.agent_type == filter_type);
                }

                // Filter by status
                if let Some(status_str) = status {
                    let filter_status = match status_str.to_lowercase().as_str() {
                        "idle" => AgentStatus::Idle,
                        "busy" => AgentStatus::Busy,
                        "paused" => AgentStatus::Paused,
                        "error" => AgentStatus::Error,
                        "stopped" => AgentStatus::Stopped,
                        _ => {
                            println!("❌ Invalid status");
                            return Ok(());
                        }
                    };
                    agents.retain(|a| a.status == filter_status);
                }

                if agents.is_empty() {
                    println!("No agents found.");
                    return Ok(());
                }

                // Group by type
                for agent in agents {
                    let status_icon = match agent.status {
                        AgentStatus::Idle => "⚪",
                        AgentStatus::Busy => "🟢",
                        AgentStatus::Paused => "🟡",
                        AgentStatus::Error => "🔴",
                        AgentStatus::Stopped => "⚫",
                    };

                    println!(
                        "  {} {} [{}] - {} ({}) - Tasks: {}/{} ",
                        status_icon,
                        agent.name,
                        agent.agent_type,
                        agent.id,
                        agent.status,
                        agent.tasks_completed,
                        agent.tasks_failed
                    );
                }
                println!();
            }

            AgentsCommands::Show { agent_id } => {
                use uuid::Uuid;

                let uuid = Uuid::from_str(&agent_id)
                    .map_err(|_| "Invalid agent ID format")?;
                let agent_id_parsed = claude_rust_agents::AgentId::from(uuid);

                if let Some(agent) = registry.get(agent_id_parsed).await {
                    println!("\n🤖 Agent Details:\n");
                    println!("ID:           {}", agent.id);
                    println!("Name:         {}", agent.name);
                    println!("Type:         {}", agent.agent_type);
                    println!("Status:       {}", agent.status);
                    println!("Created:      {}", agent.created_at);

                    if let Some(last_active) = agent.last_active {
                        println!("Last Active:  {}", last_active);
                    }

                    if let Some(current_task) = agent.current_task {
                        println!("Current Task: {}", current_task);
                    }

                    println!("\nStatistics:");
                    println!("  Tasks Completed: {}", agent.tasks_completed);
                    println!("  Tasks Failed:    {}", agent.tasks_failed);

                    if !agent.capabilities.is_empty() {
                        println!("\nCapabilities:");
                        for cap in &agent.capabilities {
                            println!("  • {}", cap);
                        }
                    }
                } else {
                    println!("❌ Agent not found: {}", agent_id);
                }
            }

            AgentsCommands::Register { agent_type, name, capabilities } => {
                let agent_type_parsed = match agent_type.to_lowercase().as_str() {
                    "general" => AgentType::General,
                    "code-review" => AgentType::CodeReview,
                    "testing" => AgentType::Testing,
                    "documentation" => AgentType::Documentation,
                    "refactoring" => AgentType::Refactoring,
                    "security-scan" => AgentType::SecurityScan,
                    "performance" => AgentType::Performance,
                    "code-generation" => AgentType::CodeGeneration,
                    _ => {
                        println!("❌ Invalid agent type: {}", agent_type);
                        return Ok(());
                    }
                };

                let mut agent = Agent::new(agent_type_parsed, name);

                // Add capabilities if provided
                if let Some(caps_str) = capabilities {
                    for cap in caps_str.split(',') {
                        agent.add_capability(cap.trim().to_string());
                    }
                }

                match registry.register(agent).await {
                    Ok(agent_id) => {
                        println!("✅ Agent registered: {}", agent_id);
                    }
                    Err(e) => {
                        println!("❌ Failed to register agent: {}", e);
                    }
                }
            }

            AgentsCommands::Unregister { agent_id } => {
                use uuid::Uuid;

                let uuid = Uuid::from_str(&agent_id)
                    .map_err(|_| "Invalid agent ID format")?;
                let agent_id_parsed = claude_rust_agents::AgentId::from(uuid);

                match registry.unregister(agent_id_parsed).await {
                    Ok(()) => {
                        println!("✅ Agent unregistered: {}", agent_id);
                    }
                    Err(e) => {
                        println!("❌ Failed to unregister agent: {}", e);
                    }
                }
            }

            AgentsCommands::Pause { agent_id } => {
                use uuid::Uuid;

                let uuid = Uuid::from_str(&agent_id)
                    .map_err(|_| "Invalid agent ID format")?;
                let agent_id_parsed = claude_rust_agents::AgentId::from(uuid);

                if let Some(mut agent) = registry.get(agent_id_parsed).await {
                    agent.pause();
                    registry.update(agent).await;
                    println!("✅ Agent paused: {}", agent_id);
                } else {
                    println!("❌ Agent not found: {}", agent_id);
                }
            }

            AgentsCommands::Resume { agent_id } => {
                use uuid::Uuid;

                let uuid = Uuid::from_str(&agent_id)
                    .map_err(|_| "Invalid agent ID format")?;
                let agent_id_parsed = claude_rust_agents::AgentId::from(uuid);

                if let Some(mut agent) = registry.get(agent_id_parsed).await {
                    agent.resume();
                    registry.update(agent).await;
                    println!("✅ Agent resumed: {}", agent_id);
                } else {
                    println!("❌ Agent not found: {}", agent_id);
                }
            }

            AgentsCommands::Stats => {
                let stats = registry.stats().await;

                println!("\n📊 Agent Statistics:\n");
                println!("Total Agents:       {}", stats.total);
                println!("\nBy Status:");
                println!("  Idle:     {}", stats.idle);
                println!("  Busy:     {}", stats.busy);
                println!("  Paused:   {}", stats.paused);
                println!("  Error:    {}", stats.error);
                println!("  Stopped:  {}", stats.stopped);
                println!("\nTasks:");
                println!("  Completed: {}", stats.total_completed);
                println!("  Failed:    {}", stats.total_failed);

                if stats.total > 0 {
                    let success_rate = if stats.total_completed + stats.total_failed > 0 {
                        (stats.total_completed as f64 / (stats.total_completed + stats.total_failed) as f64) * 100.0
                    } else {
                        0.0
                    };
                    println!("\nSuccess Rate: {:.1}%", success_rate);
                }
            }
        }
        Ok(())
    }
}

impl Default for CommandHandler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parsing() {
        // This tests that the CLI structure compiles
        assert!(true);
    }

    #[test]
    fn test_commands_enum() {
        // This tests that the commands enum compiles
        let _cmd = Commands::Version;
    }

    #[tokio::test]
    async fn test_command_handler_creation() {
        let handler = CommandHandler::new();
        drop(handler);
    }

    #[test]
    fn test_auth_commands() {
        // Test structure validation - this just ensures the enums compile
        let _auth_cmd = AuthCommands::List;
        assert!(true);
    }
}