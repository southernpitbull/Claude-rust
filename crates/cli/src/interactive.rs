//! Interactive session handler
//!
//! Provides an interactive REPL session with the AI assistant

use anyhow::Result;
use claude_rust_ai::{AiClient, CompletionRequest, Message, MessageRole};
use claude_rust_auth::AuthManager;
use claude_rust_core::session::{Session, SessionStore};
use claude_rust_core::checkpoint::CheckpointStore;
use claude_rust_terminal::Formatter;
use rustyline::completion::{Completer, Pair};
use rustyline::error::ReadlineError;
use rustyline::highlight::Highlighter;
use rustyline::hint::Hinter;
use rustyline::validate::{Validator, ValidationResult, ValidationContext};
use rustyline::{Context as RustyContext, Editor, Helper, Result as RustyResult};
use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

use crate::commands::Cli;
use crate::slash_commands::{CommandContext, CommandRegistry, CommandResult, load_custom_commands};
use crate::claude_memory::ClaudeMemory;

/// Rustyline helper for tab completion and input validation
struct ClaudeHelper {
    commands: Vec<String>,
}

impl ClaudeHelper {
    fn new(commands: Vec<String>) -> Self {
        Self { commands }
    }
}

impl Completer for ClaudeHelper {
    type Candidate = Pair;

    fn complete(
        &self,
        line: &str,
        pos: usize,
        _ctx: &RustyContext<'_>,
    ) -> RustyResult<(usize, Vec<Pair>)> {
        let line = &line[..pos];

        // Only complete slash commands
        if !line.starts_with('/') {
            return Ok((pos, vec![]));
        }

        let mut candidates = Vec::new();
        for cmd in &self.commands {
            let cmd_with_slash = format!("/{}", cmd);
            if cmd_with_slash.starts_with(line) {
                candidates.push(Pair {
                    display: cmd_with_slash.clone(),
                    replacement: cmd_with_slash,
                });
            }
        }

        Ok((0, candidates))
    }
}

impl Hinter for ClaudeHelper {
    type Hint = String;

    fn hint(&self, line: &str, pos: usize, _ctx: &RustyContext<'_>) -> Option<String> {
        if pos < line.len() || !line.starts_with('/') {
            return None;
        }

        for cmd in &self.commands {
            let cmd_with_slash = format!("/{}", cmd);
            if cmd_with_slash.starts_with(line) && cmd_with_slash.len() > line.len() {
                return Some(cmd_with_slash[line.len()..].to_string());
            }
        }

        None
    }
}

impl Highlighter for ClaudeHelper {
    fn highlight<'l>(&self, line: &'l str, _pos: usize) -> Cow<'l, str> {
        // Add syntax highlighting for slash commands
        if line.starts_with('/') {
            Cow::Owned(format!("\x1b[36m{}\x1b[0m", line)) // Cyan for commands
        } else {
            Cow::Borrowed(line)
        }
    }

    fn highlight_char(&self, _line: &str, _pos: usize, _forced: bool) -> bool {
        true
    }
}

impl Validator for ClaudeHelper {
    fn validate(&self, ctx: &mut ValidationContext) -> RustyResult<ValidationResult> {
        let input = ctx.input();

        // Multi-line support: if line ends with backslash, it's incomplete
        if input.ends_with('\\') {
            Ok(ValidationResult::Incomplete)
        } else {
            Ok(ValidationResult::Valid(None))
        }
    }
}

impl Helper for ClaudeHelper {}

/// Interactive session with the AI assistant
pub struct InteractiveSession {
    auth_manager: Arc<AuthManager>,
    ai_client: Arc<AiClient>,
    formatter: Arc<Formatter>,
    model: String,
    history: Vec<Message>,
    session_store: Arc<SessionStore>,
    checkpoint_store: Arc<CheckpointStore>,
    claude_memory: ClaudeMemory,
    session_id: Option<String>,
    command_registry: CommandRegistry,
    cli_args: Cli,
}

impl InteractiveSession {
    /// Create a new interactive session
    pub async fn new(
        auth_manager: Arc<AuthManager>,
        ai_client: Arc<AiClient>,
        session_store: Arc<SessionStore>,
        cli_args: Cli,
    ) -> Result<Self> {
        let model = cli_args.config.as_ref().map(|_| "claude-3-5-sonnet-20241022".to_string()).unwrap_or_else(|| "claude-3-5-sonnet-20241022".to_string());

        // Initialize checkpoint store
        let checkpoint_store = Arc::new(CheckpointStore::new(None, true)?);
        info!("Checkpoint store initialized");

        // Load CLAUDE.md memory files from hierarchy
        let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let claude_memory = ClaudeMemory::load_from_hierarchy(&current_dir)
            .unwrap_or_else(|_| ClaudeMemory::new());

        if !claude_memory.is_empty() {
            info!("Loaded {} CLAUDE.md file(s)", claude_memory.len());
        }

        // Load custom commands
        let mut command_registry = CommandRegistry::new();
        let commands_dir = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
            .join("commands");

        if let Ok(custom_commands) = load_custom_commands(&commands_dir) {
            for cmd in custom_commands {
                command_registry.register(cmd);
            }
        }

        // Also load project commands
        let project_commands_dir = PathBuf::from(".claude").join("commands");
        if let Ok(project_commands) = load_custom_commands(&project_commands_dir) {
            for cmd in project_commands {
                command_registry.register(cmd);
            }
        }

        let mut session = Self {
            auth_manager,
            ai_client,
            formatter: Arc::new(Formatter::new(true)), // colors enabled
            model,
            history: Vec::new(),
            session_store: session_store.clone(),
            checkpoint_store,
            claude_memory,
            session_id: cli_args.resume.clone(),
            command_registry,
            cli_args,
        };

        // Load existing session if session_id provided
        if let Some(sid) = &session.session_id {
            if let Ok(loaded_session) = session_store.load(sid) {
                // Convert stored JSON values back to Message type
                session.history = loaded_session.messages
                    .iter()
                    .filter_map(|value| {
                        Session::value_to_message::<Message>(value)
                            .ok()
                    })
                    .collect();
                info!("Loaded session {} with {} messages", sid, session.history.len());
            }
        }

        Ok(session)
    }

    /// Save current session
    async fn save_session(&self) -> Result<()> {
        let mut session = Session::new(self.model.clone(), "claude".to_string());

        // Convert messages to JSON values
        session.messages = self.history
            .iter()
            .map(|msg| Session::message_to_value(msg))
            .collect::<Result<Vec<_>>>()?;

        if let Some(sid) = &self.session_id {
            session.metadata.id = sid.clone();
        }

        self.session_store.save(&session)?;
        debug!("Session saved: {}", session.metadata.id);
        Ok(())
    }

    /// Display welcome message with ASCII art
    fn display_welcome(&self) {
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
        println!("🤖 Welcome to Claude-Rust Interactive Mode!");
        println!();
        
        // Check authentication status
        match self.check_auth_status() {
            Ok(status) => {
                if status {
                    println!("✅ You are authenticated and ready to chat!");
                } else {
                    println!("⚠️  You are not authenticated. Use /login to authenticate.");
                }
            },
            Err(_) => {
                println!("⚠️  Could not check authentication status.");
            }
        }
        
        println!();
        println!("Type /help for available commands, or start chatting!");
        println!("Type /quit or press Ctrl+C to exit.");
        println!();
    }
    
    /// Check authentication status
    fn check_auth_status(&self) -> Result<bool> {
        // Check if any provider is authenticated
        // Note: has_credentials is async, so we'll check synchronously via keyring
        // For now, assume authenticated (will be properly implemented with async runtime)
        Ok(true)
    }

    /// Create an automatic checkpoint
    async fn create_auto_checkpoint(&self, description: &str) -> Option<String> {
        // Convert conversation history to JSON values
        let conversation: Vec<serde_json::Value> = self.history
            .iter()
            .map(|msg| serde_json::to_value(msg).ok())
            .filter_map(|v| v)
            .collect();

        // For now, we'll create checkpoints without file snapshots (files would be too slow)
        // In a full implementation, we'd track modified files only
        let files = HashMap::new();

        match self.checkpoint_store.create_checkpoint(
            Some(description.to_string()),
            files,
            conversation,
        ) {
            Ok(checkpoint) => {
                debug!("Auto-checkpoint created: {}", checkpoint.id);
                Some(checkpoint.id)
            }
            Err(e) => {
                warn!("Failed to create auto-checkpoint: {}", e);
                None
            }
        }
    }

    /// Create a manual checkpoint with optional description
    async fn create_manual_checkpoint(&self, description: Option<String>) -> Result<String> {
        // Convert conversation history to JSON values
        let conversation: Vec<serde_json::Value> = self.history
            .iter()
            .map(|msg| serde_json::to_value(msg).ok())
            .filter_map(|v| v)
            .collect();

        // Create empty file snapshot for manual checkpoints
        // (Full file snapshotting would be added in a complete implementation)
        let files = HashMap::new();

        let desc = description.unwrap_or_else(|| "Manual checkpoint".to_string());

        let checkpoint = self.checkpoint_store.create_checkpoint(
            Some(desc),
            files,
            conversation,
        )?;

        info!("Manual checkpoint created: {}", checkpoint.id);
        Ok(checkpoint.id)
    }

    /// Show initial help/tips
    fn show_initial_help(&self) {
        println!("💡 Quick Tips:");
        println!("  • Type natural language questions to get AI responses");
        println!("  • Use /help to see all commands");
        println!("  • Use /model to switch between AI models");
        println!("  • Use /save and /load to manage conversations");
        println!("  • Use /clear to start a fresh conversation");
        println!();
    }

    /// Run the interactive session REPL
    pub async fn run(&mut self) -> Result<()> {
        // Display welcome message
        self.display_welcome();
        self.show_initial_help();

        // Add system message to set the context
        let system_message = Message {
            role: MessageRole::System,
            content: "You are an AI coding assistant. Help the user with programming tasks, code review, debugging, and explanations. Be concise but thorough in your responses.".to_string(),
            name: None,
            extra: HashMap::new(),
        };
        self.history.push(system_message);

        // Handle initial prompt if provided
        if let Some(prompt) = self.cli_args.prompt.clone() {
            println!("claude> {}", prompt);

            // Add user message to history
            let user_message = Message {
                role: MessageRole::User,
                content: prompt.clone(),
                name: None,
                extra: HashMap::new(),
            };
            self.history.push(user_message);

            // Process the initial prompt as if it came from the REPL
            self.process_user_input(&prompt).await?;
        }

        // Set up Ctrl+C handler for graceful exit
        let running = Arc::new(std::sync::atomic::AtomicBool::new(true));
        let r = running.clone();
        
        ctrlc::set_handler(move || {
            r.store(false, Ordering::SeqCst);
        })?;

        loop {
            // Check if we should exit due to Ctrl+C
            if !running.load(Ordering::SeqCst) {
                println!("\n\n👋 Goodbye!");
                break;
            }

            // Read user input with rustyline for better REPL experience
            let readline = self.read_input();
            match readline {
                Ok(Some(input)) => {
                    let input = input.trim();
                    
                    // Handle empty input
                    if input.is_empty() {
                        continue;
                    }
                    
                    // Handle slash commands
                    if input.starts_with('/') {
                        match self.handle_slash_command(input).await {
                            Ok(should_continue) => {
                                if !should_continue {
                                    break;
                                }
                            }
                            Err(e) => {
                                println!("❌ Command error: {}", e);
                                continue;
                            }
                        }
                    } else {
                        // Process regular user input
                        self.process_user_input(input).await?;
                    }
                }
                Ok(None) => {
                    // EOF (Ctrl+D) - exit gracefully
                    println!("\n\n👋 Goodbye!");
                    break;
                }
                Err(e) => {
                    println!("❌ Input error: {}", e);
                    continue;
                }
            }
        }

        // Save session on exit
        self.save_session().await?;

        Ok(())
    }
    
    /// Read input from user with enhanced rustyline
    fn read_input(&self) -> Result<Option<String>> {
        // Get list of available commands for tab completion
        let command_names: Vec<String> = self.command_registry
            .list_commands()
            .iter()
            .map(|(name, _)| name.to_string())
            .collect();

        let helper = ClaudeHelper::new(command_names);
        let mut rl = Editor::new()?;
        rl.set_helper(Some(helper));

        // Try to load history from file
        let history_path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".claude")
            .join("history.txt");

        if history_path.exists() {
            let _ = rl.load_history(&history_path);
        }

        // Create colored prompt with context
        let prompt = if self.session_id.is_some() {
            format!("\x1b[32mclaude\x1b[0m[\x1b[33m{}\x1b[0m]> ",
                self.session_id.as_ref().map(|s| &s[..8]).unwrap_or("session"))
        } else {
            "\x1b[32mclaude\x1b[0m> ".to_string()
        };

        let readline = rl.readline(&prompt);

        match readline {
            Ok(line) => {
                // Handle multi-line input
                let mut full_input = line;
                while full_input.ends_with('\\') {
                    // Remove trailing backslash
                    full_input.pop();

                    // Read continuation line
                    match rl.readline("\x1b[90m... \x1b[0m") {
                        Ok(continuation) => {
                            full_input.push('\n');
                            full_input.push_str(&continuation);
                        }
                        Err(_) => break,
                    }
                }

                let _ = rl.add_history_entry(full_input.as_str());

                // Save history to file
                let _ = rl.save_history(&history_path);

                Ok(Some(full_input))
            }
            Err(ReadlineError::Interrupted) => {
                // Ctrl+C pressed
                println!();
                println!("👋 Goodbye!");
                Ok(None) // Signal to exit
            }
            Err(ReadlineError::Eof) => {
                // Ctrl+D pressed
                println!();
                Ok(None) // Signal to exit
            }
            Err(err) => {
                warn!("Readline error: {}", err);
                Err(anyhow::anyhow!("Readline error: {}", err))
            }
        }
    }
    
    /// Handle slash commands
    async fn handle_slash_command(&mut self, input: &str) -> Result<bool> {
        let mut context = CommandContext {
            history: self.history.clone(),
            model: self.model.clone(),
            session_store: Some(self.session_store.clone()),
            checkpoint_store: Some(self.checkpoint_store.clone()),
            session_id: self.session_id.clone(),
            working_dir: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            metadata: HashMap::new(),
        };

        match self.command_registry.execute(input, &mut context) {
            Ok(CommandResult::Continue) => Ok(true),
            Ok(CommandResult::Exit) => Ok(false), // Signal to exit
            Ok(CommandResult::Message(msg)) => {
                println!("{}", msg);
                Ok(true)
            }
            Ok(CommandResult::MessageAndContinue(msg)) => {
                println!("{}", msg);
                Ok(true)
            }
            Ok(CommandResult::ClearHistory) => {
                self.history.retain(|m| m.role == MessageRole::System);
                println!("✨ Conversation history cleared");
                Ok(true)
            }
            Ok(CommandResult::SwitchModel(new_model)) => {
                let old_model = self.model.clone();
                self.model = new_model.clone();
                println!("🔄 Switched model: {} → {}", old_model, new_model);
                Ok(true)
            }
            Err(e) => Err(e),
        }
    }
    
    /// Process regular user input (non-slash command) with retry logic
    async fn process_user_input(&mut self, input: &str) -> Result<()> {
        // Check if user is authenticated
        if !self.check_auth_status()? {
            println!("⚠️  You need to be authenticated to use the AI. Use /login to authenticate.");
            return Ok(());
        }

        // Create auto-checkpoint before AI interaction
        let checkpoint_id = self.create_auto_checkpoint("Before AI response").await;
        if let Some(id) = &checkpoint_id {
            debug!("Created auto-checkpoint: {}", &id[..8]);
        }

        // Add user message to history
        let user_message = Message {
            role: MessageRole::User,
            content: input.to_string(),
            name: None,
            extra: HashMap::new(),
        };
        self.history.push(user_message.clone());

        // Build message history with CLAUDE.md context if available
        let mut messages = Vec::new();

        // Add system message with CLAUDE.md context if available
        if !self.claude_memory.is_empty() {
            let mut system_content = "You are Claude, a helpful AI assistant.".to_string();
            system_content.push_str("\n\n");
            system_content.push_str(self.claude_memory.get_combined_context());

            messages.push(Message {
                role: MessageRole::System,
                content: system_content,
                name: None,
                extra: HashMap::new(),
            });
        }

        // Add conversation history
        messages.extend(self.history.clone());

        // Create AI request with conversation history
        let request = CompletionRequest::new(messages, self.model.clone());

        // Retry logic with exponential backoff
        let max_retries = 3;
        let mut retry_count = 0;

        loop {
            // Show thinking indicator with dots animation
            let indicator = match retry_count {
                0 => "🤔 Thinking",
                1 => "🔄 Retrying",
                _ => "⏳ Retrying",
            };

            print!("{}", indicator);
            std::io::stdout().flush()?;

            // Simulate streaming dots
            for _ in 0..3 {
                std::thread::sleep(std::time::Duration::from_millis(200));
                print!(".");
                std::io::stdout().flush()?;
            }

            // Get AI response
            match self.ai_client.complete_with_default(&request).await {
                Ok(response) => {
                    // Clear thinking indicator
                    print!("\r");
                    print!("\x1B[2K"); // Clear the line

                    // Extract token usage if available
                    let tokens_used = response.message.extra.get("tokens")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0);

                    // Print AI response with formatting
                    println!("\n\x1b[36m🤖 Assistant:\x1b[0m");
                    println!("{}", response.message.content);

                    // Show token usage if available
                    if tokens_used > 0 {
                        println!("\n\x1b[90m[Tokens: {}]\x1b[0m", tokens_used);
                    }
                    println!();

                    // Add AI response to history
                    self.history.push(response.message);

                    // Auto-save session
                    if let Err(e) = self.save_session().await {
                        debug!("Failed to auto-save session: {}", e);
                    }

                    break;
                }
                Err(e) => {
                    print!("\r");
                    print!("\x1B[2K"); // Clear the line

                    retry_count += 1;

                    if retry_count >= max_retries {
                        println!("❌ Error after {} retries: {}", max_retries, e);
                        println!("💡 Tip: Check your internet connection or API key");
                        // Remove the user message since we didn't get a response
                        self.history.pop();
                        break;
                    } else {
                        warn!("API error (attempt {}/{}): {}", retry_count, max_retries, e);
                        // Exponential backoff
                        let wait_time = std::time::Duration::from_millis(1000 * 2_u64.pow(retry_count));
                        tokio::time::sleep(wait_time).await;
                    }
                }
            }
        }

        Ok(())
    }
}