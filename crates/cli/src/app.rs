//! Application context and lifecycle management.

use anyhow::{Context, Result};
use claude_rust_ai::{AIClient, ProviderConfig};
use claude_rust_auth::{AuthManager, CredentialStore};
use claude_rust_core::config::Config;
use claude_rust_terminal::{Formatter, TerminalConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};

use crate::cli::{AiProvider, Cli};

/// Application context holding all shared state and resources.
///
/// This structure maintains the application's runtime state including
/// configuration, AI clients, authentication, and terminal formatting.
/// It implements the RAII pattern for proper resource cleanup.
pub struct App {
    /// Application configuration
    config: Config,

    /// AI client for interacting with providers
    ai_client: Arc<RwLock<Option<AIClient>>>,

    /// Authentication manager
    auth_manager: Arc<AuthManager>,

    /// Terminal formatter for styled output
    formatter: Arc<Formatter>,

    /// Current workspace path
    workspace: PathBuf,

    /// CLI arguments
    cli_args: Cli,
}

impl App {
    /// Create a new application instance.
    ///
    /// Initializes all components including configuration loading,
    /// authentication setup, and terminal formatting.
    pub async fn new(cli_args: Cli) -> Result<Self> {
        info!("Initializing Claude-Rust CLI application");

        // Determine workspace directory
        let workspace = if let Some(ref ws) = cli_args.workspace {
            ws.clone()
        } else {
            std::env::current_dir().context("Failed to get current directory")?
        };

        debug!("Workspace: {}", workspace.display());

        // Load configuration
        let config = Self::load_config(&cli_args, &workspace).await?;
        debug!("Configuration loaded successfully");

        // Initialize terminal formatter
        let formatter = Self::create_formatter(&cli_args, &config)?;
        debug!("Terminal formatter initialized");

        // Initialize authentication manager
        let auth_manager = Self::create_auth_manager(&config).await?;
        debug!("Authentication manager initialized");

        // Create AI client (lazy initialization)
        let ai_client = Arc::new(RwLock::new(None));

        Ok(Self {
            config,
            ai_client,
            auth_manager: Arc::new(auth_manager),
            formatter: Arc::new(formatter),
            workspace,
            cli_args,
        })
    }

    /// Load application configuration from files and environment.
    async fn load_config(cli_args: &Cli, workspace: &PathBuf) -> Result<Config> {
        let config_path = if let Some(ref path) = cli_args.config {
            Some(path.clone())
        } else {
            // Try to find config in workspace or home directory
            let workspace_config = workspace.join(".claude-rust.toml");
            if workspace_config.exists() {
                Some(workspace_config)
            } else {
                dirs::config_dir().map(|d| d.join("claude-rust").join("config.toml"))
            }
        };

        let mut config = if let Some(path) = config_path {
            if path.exists() {
                // Load config from file using ConfigLoader
                let loader = claude_rust_core::config::ConfigLoader::new();
                loader.load_from_file(&path)
                    .context(format!("Failed to load config from {}", path.display()))?
            } else {
                debug!("Config file not found, using defaults");
                Config::default()
            }
        } else {
            Config::default()
        };

        // Override with CLI flags
        if cli_args.verbose {
            config.log_level = claude_rust_core::types::LogLevel::Debug;
        } else if cli_args.quiet {
            config.log_level = claude_rust_core::types::LogLevel::Error;
        }

        Ok(config)
    }

    /// Create terminal formatter based on configuration.
    fn create_formatter(cli_args: &Cli, config: &Config) -> Result<Formatter> {
        let mut terminal_config = TerminalConfig::default();

        // Apply no-color flag
        if cli_args.no_color {
            terminal_config.disable_colors();
        }

        // Apply quiet mode
        if cli_args.quiet {
            terminal_config.set_minimal_output(true);
        }

        Formatter::new(terminal_config)
    }

    /// Create authentication manager.
    async fn create_auth_manager(config: &Config) -> Result<AuthManager> {
        let credential_store = CredentialStore::new()
            .context("Failed to create credential store")?;

        let auth_manager = AuthManager::new(credential_store)
            .context("Failed to create authentication manager")?;

        Ok(auth_manager)
    }

    /// Get or initialize AI client for the specified provider.
    ///
    /// This performs lazy initialization of the AI client on first use.
    pub async fn get_ai_client(&self, provider: Option<AiProvider>) -> Result<Arc<RwLock<AIClient>>> {
        let mut client_lock = self.ai_client.write().await;

        if client_lock.is_none() {
            // Determine which provider to use
            let provider = provider
                .or_else(|| self.config.providers.default_provider.as_ref().and_then(|p| Self::parse_provider(p)))
                .unwrap_or(AiProvider::Claude);

            debug!("Initializing AI client for provider: {}", provider);

            // Get authentication token
            let auth_token = self.auth_manager
                .get_token(&provider.to_string())
                .await
                .context("No authentication token found. Please run 'claude-rust auth login' first.")?;

            // Create provider configuration
            let provider_config = ProviderConfig::new(
                provider.to_string(),
                auth_token.access_token().to_string(),
            );

            // Initialize AI client
            let client = AIClient::new(provider_config)
                .context("Failed to create AI client")?;

            *client_lock = Some(client);
        }

        // Clone the Arc for shared access
        Ok(Arc::clone(&self.ai_client))
    }

    /// Parse provider string to enum.
    fn parse_provider(provider: &str) -> Option<AiProvider> {
        match provider.to_lowercase().as_str() {
            "claude" => Some(AiProvider::Claude),
            "openai" => Some(AiProvider::OpenAI),
            "gemini" => Some(AiProvider::Gemini),
            "qwen" => Some(AiProvider::Qwen),
            "ollama" => Some(AiProvider::Ollama),
            "lmstudio" => Some(AiProvider::LMStudio),
            _ => None,
        }
    }

    /// Get the authentication manager.
    pub fn auth_manager(&self) -> Arc<AuthManager> {
        Arc::clone(&self.auth_manager)
    }

    /// Get the terminal formatter.
    pub fn formatter(&self) -> Arc<Formatter> {
        Arc::clone(&self.formatter)
    }

    /// Get the application configuration.
    pub fn config(&self) -> &Config {
        &self.config
    }

    /// Get the workspace path.
    pub fn workspace(&self) -> &PathBuf {
        &self.workspace
    }

    /// Get CLI arguments.
    pub fn cli_args(&self) -> &Cli {
        &self.cli_args
    }

    /// Check if verbose mode is enabled.
    pub fn is_verbose(&self) -> bool {
        self.cli_args.verbose
    }

    /// Check if quiet mode is enabled.
    pub fn is_quiet(&self) -> bool {
        self.cli_args.quiet
    }

    /// Run the application with the given command.
    ///
    /// This is the main entry point for command execution.
    pub async fn run(&mut self) -> Result<i32> {
        use crate::cli::Commands;
        use crate::handlers;

        match &self.cli_args.command {
            Some(Commands::Init { .. }) => {
                handlers::init::handle(self).await?;
            }
            Some(Commands::Auth { command }) => {
                handlers::auth::handle(self, command).await?;
            }
            Some(Commands::Query { .. }) => {
                handlers::query::handle(self).await?;
            }
            Some(Commands::Analyze { .. }) => {
                handlers::analyze::handle(self).await?;
            }
            Some(Commands::Config { command }) => {
                handlers::config::handle(self, command).await?;
            }
            Some(Commands::Interactive { .. }) => {
                handlers::query::handle_interactive(self).await?;
            }
            Some(Commands::Search { .. }) => {
                handlers::analyze::handle_search(self).await?;
            }
            Some(Commands::Index { command }) => {
                handlers::analyze::handle_index(self, command).await?;
            }
            Some(Commands::Version) => {
                self.print_version();
            }
            Some(Commands::Status { detailed }) => {
                self.print_status(*detailed).await?;
            }
            None => {
                self.print_default_message();
            }
        }

        Ok(0)
    }

    /// Print version information.
    fn print_version(&self) {
        let formatter = &self.formatter;

        formatter.print_success(&format!(
            "Claude-Rust CLI v{}",
            env!("CARGO_PKG_VERSION")
        ));

        println!("Build: {}", env!("CARGO_PKG_VERSION"));
        println!("Authors: {}", env!("CARGO_PKG_AUTHORS"));
        println!("License: {}", env!("CARGO_PKG_LICENSE"));
    }

    /// Print system status.
    async fn print_status(&self, detailed: bool) -> Result<()> {
        let formatter = &self.formatter;

        formatter.print_header("Claude-Rust Status");
        println!();

        // Check authentication status
        println!("Authentication:");
        let providers = vec!["claude", "openai", "gemini", "qwen", "ollama", "lmstudio"];

        for provider in providers {
            let status = if self.auth_manager.has_credentials(provider).await {
                formatter.style_success("Authenticated")
            } else {
                formatter.style_dim("Not authenticated")
            };
            println!("  {} {}", provider, status);
        }

        println!();
        println!("Workspace: {}", self.workspace.display());
        println!("Config: ~/.config/claude-rust/config.toml"); // Using a placeholder since we don't have a method to get the config path

        if detailed {
            println!();
            formatter.print_header("Detailed Information");
            println!("Verbose: {}", self.is_verbose());
            println!("Quiet: {}", self.is_quiet());
            println!("Colors: {}", !self.cli_args.no_color);
        }

        Ok(())
    }

    /// Print default message when no command is provided.
    fn print_default_message(&self) {
        let formatter = &self.formatter;

        formatter.print_header(&format!(
            "Claude-Rust CLI v{}",
            env!("CARGO_PKG_VERSION")
        ));

        println!();
        println!("AI-powered coding assistant for Rust and beyond.");
        println!();
        println!("Run 'claude-rust --help' for usage information.");
        println!("Run 'claude-rust interactive' to start an interactive session.");
        println!("Run 'claude-rust auth login' to authenticate with an AI provider.");
    }

    /// Perform cleanup on application shutdown.
    pub async fn shutdown(&self) -> Result<()> {
        info!("Shutting down Claude-Rust CLI");

        // Close AI client if initialized
        let mut client_lock = self.ai_client.write().await;
        if let Some(client) = client_lock.take() {
            drop(client);
            debug!("AI client cleaned up");
        }

        Ok(())
    }
}

impl Drop for App {
    fn drop(&mut self) {
        debug!("App dropped");
    }
}

/// Builder for creating App instances with custom configuration.
pub struct AppBuilder {
    cli_args: Option<Cli>,
    workspace: Option<PathBuf>,
    config_override: Option<Config>,
}

impl AppBuilder {
    /// Create a new AppBuilder.
    pub fn new() -> Self {
        Self {
            cli_args: None,
            workspace: None,
            config_override: None,
        }
    }

    /// Set CLI arguments.
    pub fn with_cli_args(mut self, cli_args: Cli) -> Self {
        self.cli_args = Some(cli_args);
        self
    }

    /// Set workspace directory.
    pub fn with_workspace(mut self, workspace: PathBuf) -> Self {
        self.workspace = Some(workspace);
        self
    }

    /// Override configuration.
    pub fn with_config(mut self, config: Config) -> Self {
        self.config_override = Some(config);
        self
    }

    /// Build the App instance.
    pub async fn build(self) -> Result<App> {
        let mut cli_args = self.cli_args.unwrap_or_else(|| Cli::parse_args());

        if let Some(workspace) = self.workspace {
            cli_args.workspace = Some(workspace);
        }

        let mut app = App::new(cli_args).await?;

        if let Some(config) = self.config_override {
            app.config = config;
        }

        Ok(app)
    }
}

impl Default for AppBuilder {
    fn default() -> Self {
        Self::new()
    }
}
