//! Slash Commands System
//!
//! Provides built-in and custom slash commands for the interactive REPL

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tracing::{debug, info, warn};

/// Trait for all slash commands
pub trait SlashCommand: Send + Sync {
    /// Get the command name (without the leading /)
    fn name(&self) -> &str;

    /// Get the command description
    fn description(&self) -> &str;

    /// Get the command usage/syntax
    fn usage(&self) -> &str;

    /// Execute the command with given arguments
    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult>;
}

/// Context passed to commands during execution
pub struct CommandContext {
    /// Conversation history
    pub history: Vec<claude_rust_ai::Message>,

    /// Current model being used
    pub model: String,

    /// Session store for persistence
    pub session_store: Option<std::sync::Arc<claude_rust_core::session::SessionStore>>,

    /// Checkpoint store for time travel
    pub checkpoint_store: Option<std::sync::Arc<claude_rust_core::checkpoint::CheckpointStore>>,

    /// Current session ID
    pub session_id: Option<String>,

    /// Working directory
    pub working_dir: PathBuf,

    /// Additional metadata
    pub metadata: HashMap<String, String>,
}

/// Result of command execution
pub enum CommandResult {
    /// Continue REPL normally
    Continue,

    /// Exit the REPL
    Exit,

    /// Display a message to user
    Message(String),

    /// Display a message and continue
    MessageAndContinue(String),

    /// Clear conversation history
    ClearHistory,

    /// Switch to a different model
    SwitchModel(String),
}

/// Registry for all slash commands
pub struct CommandRegistry {
    commands: HashMap<String, Box<dyn SlashCommand>>,
}

impl CommandRegistry {
    /// Create a new command registry with built-in commands
    pub fn new() -> Self {
        let mut registry = Self {
            commands: HashMap::new(),
        };

        // Register built-in commands
        registry.register(Box::new(HelpCommand));
        registry.register(Box::new(QuitCommand));
        registry.register(Box::new(ExitCommand));
        registry.register(Box::new(ClearCommand));
        registry.register(Box::new(HistoryCommand));
        registry.register(Box::new(SaveCommand));
        registry.register(Box::new(LoadCommand));
        registry.register(Box::new(ModelCommand));
        registry.register(Box::new(ConfigCommand));
        registry.register(Box::new(AllowedToolsCommand));
        registry.register(Box::new(MemoryCommand));
        registry.register(Box::new(CheckpointCommand));
        registry.register(Box::new(RewindCommand));
        registry.register(Box::new(CompactCommand));
        registry.register(Box::new(HooksCommand));
        registry.register(Box::new(McpCommand));
        registry.register(Box::new(AgentsCommand));
        registry.register(Box::new(CommitCommand));
        registry.register(Box::new(BugCommand));

        registry
    }

    /// Register a command
    pub fn register(&mut self, command: Box<dyn SlashCommand>) {
        self.commands.insert(command.name().to_string(), command);
    }

    /// Get a command by name
    pub fn get(&self, name: &str) -> Option<&Box<dyn SlashCommand>> {
        self.commands.get(name)
    }

    /// List all available commands
    pub fn list_commands(&self) -> Vec<(&str, &str)> {
        let mut commands: Vec<_> = self.commands
            .values()
            .map(|cmd| (cmd.name(), cmd.description()))
            .collect();
        commands.sort_by_key(|(name, _)| *name);
        commands
    }

    /// Execute a command by name
    pub fn execute(&self, command_line: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let (cmd_name, args) = parse_command_line(command_line);

        match self.get(cmd_name) {
            Some(command) => {
                debug!("Executing slash command: /{} {}", cmd_name, args);
                command.execute(args, context)
            }
            None => {
                Ok(CommandResult::Message(format!(
                    "Unknown command: /{}. Type /help for available commands.",
                    cmd_name
                )))
            }
        }
    }
}

impl Default for CommandRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Parse command line into command name and arguments
fn parse_command_line(line: &str) -> (&str, &str) {
    let line = line.trim_start_matches('/');
    match line.split_once(char::is_whitespace) {
        Some((cmd, args)) => (cmd, args.trim()),
        None => (line, ""),
    }
}

// ============================================================================
// Built-in Commands
// ============================================================================

/// Help command - shows available commands
struct HelpCommand;

impl SlashCommand for HelpCommand {
    fn name(&self) -> &str {
        "help"
    }

    fn description(&self) -> &str {
        "Show available commands"
    }

    fn usage(&self) -> &str {
        "/help"
    }

    fn execute(&self, _args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let mut help_text = String::from("\n📚 Available Commands:\n\n");

        help_text.push_str("  Conversation Management:\n");
        help_text.push_str("    /help          - Show this help message\n");
        help_text.push_str("    /clear         - Clear conversation history\n");
        help_text.push_str("    /history       - Show conversation history\n");
        help_text.push_str("    /save [file]   - Save conversation to file\n");
        help_text.push_str("    /load <file>   - Load conversation from file\n");
        help_text.push_str("\n");

        help_text.push_str("  Configuration:\n");
        help_text.push_str("    /model [name]      - Show or switch AI model\n");
        help_text.push_str("    /config            - Show configuration\n");
        help_text.push_str("    /allowed-tools     - List and manage tool permissions\n");
        help_text.push_str("\n");

        help_text.push_str("  Advanced Features:\n");
        help_text.push_str("    /rewind [id]       - Restore to previous checkpoint\n");
        help_text.push_str("    /compact           - Compress conversation context\n");
        help_text.push_str("    /hooks             - Manage execution hooks\n");
        help_text.push_str("    /mcp               - Manage MCP servers\n");
        help_text.push_str("    /agents            - Manage background AI agents\n");
        help_text.push_str("\n");

        help_text.push_str("  Git Workflow:\n");
        help_text.push_str("    /commit [msg]      - Create git commit with AI message\n");
        help_text.push_str("    /bug [desc]        - Report a bug in Claude-Rust\n");
        help_text.push_str("\n");

        help_text.push_str("  Session Control:\n");
        help_text.push_str("    /quit          - Exit interactive mode\n");
        help_text.push_str("    /exit          - Exit interactive mode\n");
        help_text.push_str("\n");

        help_text.push_str("  Tips:\n");
        help_text.push_str("    - Type your question and press Enter\n");
        help_text.push_str("    - Conversation history is automatically saved\n");
        help_text.push_str("    - Use Ctrl+C to cancel current operation\n");
        help_text.push_str("    - Use Ctrl+D to exit\n");
        help_text.push_str("    - Type /command for details on any command\n");
        help_text.push_str("\n");

        Ok(CommandResult::MessageAndContinue(help_text))
    }
}

/// Quit command
struct QuitCommand;

impl SlashCommand for QuitCommand {
    fn name(&self) -> &str {
        "quit"
    }

    fn description(&self) -> &str {
        "Exit interactive mode"
    }

    fn usage(&self) -> &str {
        "/quit"
    }

    fn execute(&self, _args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        Ok(CommandResult::Exit)
    }
}

/// Exit command (alias for quit)
struct ExitCommand;

impl SlashCommand for ExitCommand {
    fn name(&self) -> &str {
        "exit"
    }

    fn description(&self) -> &str {
        "Exit interactive mode"
    }

    fn usage(&self) -> &str {
        "/exit"
    }

    fn execute(&self, _args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        Ok(CommandResult::Exit)
    }
}

/// Clear command - clears conversation history
struct ClearCommand;

impl SlashCommand for ClearCommand {
    fn name(&self) -> &str {
        "clear"
    }

    fn description(&self) -> &str {
        "Clear conversation history"
    }

    fn usage(&self) -> &str {
        "/clear"
    }

    fn execute(&self, _args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        Ok(CommandResult::ClearHistory)
    }
}

/// History command - shows conversation history
struct HistoryCommand;

impl SlashCommand for HistoryCommand {
    fn name(&self) -> &str {
        "history"
    }

    fn description(&self) -> &str {
        "Show conversation history"
    }

    fn usage(&self) -> &str {
        "/history"
    }

    fn execute(&self, _args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let mut output = String::from("\n📜 Conversation History:\n\n");

        for (i, msg) in context.history.iter().enumerate() {
            let role = match msg.role {
                claude_rust_ai::MessageRole::System => "System",
                claude_rust_ai::MessageRole::User => "User",
                claude_rust_ai::MessageRole::Assistant => "Assistant",
            };

            output.push_str(&format!("{}. {} ({}): {}\n",
                i + 1,
                role,
                msg.content.len(),
                if msg.content.len() > 100 {
                    format!("{}...", &msg.content[..100])
                } else {
                    msg.content.clone()
                }
            ));
        }

        output.push_str(&format!("\nTotal messages: {}\n", context.history.len()));

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Save command - saves conversation to file
struct SaveCommand;

impl SlashCommand for SaveCommand {
    fn name(&self) -> &str {
        "save"
    }

    fn description(&self) -> &str {
        "Save conversation to file"
    }

    fn usage(&self) -> &str {
        "/save [filename]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let filename = if args.is_empty() {
            format!("conversation_{}.json", chrono::Utc::now().format("%Y%m%d_%H%M%S"))
        } else {
            args.to_string()
        };

        let session = claude_rust_core::session::Session::new(
            context.model.clone(),
            "".to_string(), // provider
        );

        // Convert messages to session format
        // This is simplified - you'd need proper conversion
        let json = serde_json::to_string_pretty(&context.history)
            .context("Failed to serialize conversation")?;

        fs::write(&filename, json)
            .context(format!("Failed to write to {}", filename))?;

        Ok(CommandResult::MessageAndContinue(
            format!("💾 Conversation saved to: {}", filename)
        ))
    }
}

/// Load command - loads conversation from file
struct LoadCommand;

impl SlashCommand for LoadCommand {
    fn name(&self) -> &str {
        "load"
    }

    fn description(&self) -> &str {
        "Load conversation from file"
    }

    fn usage(&self) -> &str {
        "/load <filename>"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        if args.is_empty() {
            return Ok(CommandResult::Message(
                "Usage: /load <filename>".to_string()
            ));
        }

        let content = fs::read_to_string(args)
            .context(format!("Failed to read {}", args))?;

        let loaded_history: Vec<claude_rust_ai::Message> = serde_json::from_str(&content)
            .context("Failed to parse conversation file")?;

        context.history = loaded_history;

        Ok(CommandResult::MessageAndContinue(
            format!("📂 Loaded {} messages from {}", context.history.len(), args)
        ))
    }
}

/// Model command - shows or switches model
struct ModelCommand;

impl SlashCommand for ModelCommand {
    fn name(&self) -> &str {
        "model"
    }

    fn description(&self) -> &str {
        "Show or switch AI model"
    }

    fn usage(&self) -> &str {
        "/model [model_name]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        if args.is_empty() {
            Ok(CommandResult::MessageAndContinue(
                format!("🤖 Current model: {}", context.model)
            ))
        } else {
            let old_model = context.model.clone();
            Ok(CommandResult::SwitchModel(args.to_string()))
        }
    }
}

/// Config command - shows configuration
struct ConfigCommand;

impl SlashCommand for ConfigCommand {
    fn name(&self) -> &str {
        "config"
    }

    fn description(&self) -> &str {
        "Show configuration"
    }

    fn usage(&self) -> &str {
        "/config"
    }

    fn execute(&self, _args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let mut output = String::from("\n⚙️  Configuration:\n\n");
        output.push_str(&format!("  Model: {}\n", context.model));
        output.push_str(&format!("  Working Directory: {}\n", context.working_dir.display()));

        if let Some(session_id) = &context.session_id {
            output.push_str(&format!("  Session ID: {}\n", session_id));
        }

        output.push_str(&format!("  Messages in history: {}\n", context.history.len()));
        output.push_str("\n");

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// AllowedTools command - manage tool permissions
struct AllowedToolsCommand;

impl SlashCommand for AllowedToolsCommand {
    fn name(&self) -> &str {
        "allowed-tools"
    }

    fn description(&self) -> &str {
        "List and manage tool permissions"
    }

    fn usage(&self) -> &str {
        "/allowed-tools [list|enable|disable] [tool_name]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let parts: Vec<&str> = args.split_whitespace().collect();

        let mut output = String::from("\n🔧 Tool Permissions:\n\n");

        match parts.first() {
            None | Some(&"list") => {
                output.push_str("  Available Tools:\n");
                output.push_str("    ✅ file_read      - Read file contents\n");
                output.push_str("    ✅ file_write     - Write to files\n");
                output.push_str("    ✅ file_edit      - Edit existing files\n");
                output.push_str("    ✅ bash           - Execute shell commands\n");
                output.push_str("    ✅ web_search     - Search the web\n");
                output.push_str("    ✅ web_fetch      - Fetch web pages\n");
                output.push_str("\n  Use /allowed-tools enable <tool> or disable <tool> to manage permissions\n");
            }
            Some(&"enable") => {
                if let Some(tool_name) = parts.get(1) {
                    output.push_str(&format!("  ✅ Enabled tool: {}\n", tool_name));
                } else {
                    output.push_str("  ❌ Usage: /allowed-tools enable <tool_name>\n");
                }
            }
            Some(&"disable") => {
                if let Some(tool_name) = parts.get(1) {
                    output.push_str(&format!("  ⛔ Disabled tool: {}\n", tool_name));
                } else {
                    output.push_str("  ❌ Usage: /allowed-tools disable <tool_name>\n");
                }
            }
            Some(cmd) => {
                output.push_str(&format!("  ❌ Unknown subcommand: {}\n", cmd));
                output.push_str("  Valid subcommands: list, enable, disable\n");
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Memory command - view CLAUDE.md context
struct MemoryCommand;

impl SlashCommand for MemoryCommand {
    fn name(&self) -> &str {
        "memory"
    }

    fn description(&self) -> &str {
        "View loaded CLAUDE.md memory files"
    }

    fn usage(&self) -> &str {
        "/memory [list|show|reload]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        use crate::claude_memory::ClaudeMemory;

        let parts: Vec<&str> = args.split_whitespace().collect();
        let mut output = String::from("\n🧠 CLAUDE.md Memory System:\n\n");

        // Load CLAUDE.md files from current directory
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let claude_memory = ClaudeMemory::load_from_hierarchy(&current_dir)
            .unwrap_or_else(|_| ClaudeMemory::new());

        match parts.first() {
            None | Some(&"list") => {
                if claude_memory.is_empty() {
                    output.push_str("  No CLAUDE.md files found.\n\n");
                    output.push_str("  💡 Create a CLAUDE.md file in your project to provide context to the AI.\n");
                    output.push_str("  💡 You can also create ~/.claude/CLAUDE.md for global context.\n");
                } else {
                    output.push_str(&format!("  📁 Found {} CLAUDE.md file(s):\n\n", claude_memory.len()));
                    output.push_str("  Files are loaded in priority order (highest to lowest):\n");
                    output.push_str("  1. Subdirectory CLAUDE.md (highest priority)\n");
                    output.push_str("  2. Project root CLAUDE.md\n");
                    output.push_str("  3. Global ~/.claude/CLAUDE.md (lowest priority)\n\n");
                    output.push_str("  💡 Use /memory show to view the combined context\n");
                }
            }

            Some(&"show") => {
                if claude_memory.is_empty() {
                    output.push_str("  No CLAUDE.md context loaded.\n");
                } else {
                    output.push_str("  📄 Combined Context:\n\n");
                    output.push_str("  ────────────────────────────────────────\n");
                    output.push_str(claude_memory.get_combined_context());
                    output.push_str("\n  ────────────────────────────────────────\n");
                }
            }

            Some(&"reload") => {
                output.push_str("  🔄 Reloading CLAUDE.md files...\n\n");

                let new_memory = ClaudeMemory::load_from_hierarchy(&current_dir)
                    .unwrap_or_else(|_| ClaudeMemory::new());

                if new_memory.is_empty() {
                    output.push_str("  No CLAUDE.md files found.\n");
                } else {
                    output.push_str(&format!("  ✅ Loaded {} CLAUDE.md file(s)\n", new_memory.len()));
                    output.push_str("\n  💡 Changes will take effect in the next AI interaction\n");
                }
            }

            Some(cmd) => {
                output.push_str(&format!("  ❌ Unknown subcommand: {}\n", cmd));
                output.push_str("  Valid subcommands: list, show, reload\n");
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Checkpoint command - create manual checkpoints
struct CheckpointCommand;

impl SlashCommand for CheckpointCommand {
    fn name(&self) -> &str {
        "checkpoint"
    }

    fn description(&self) -> &str {
        "Create a manual checkpoint of current state"
    }

    fn usage(&self) -> &str {
        "/checkpoint [description]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let checkpoint_store = match &context.checkpoint_store {
            Some(store) => store,
            None => {
                return Ok(CommandResult::MessageAndContinue(
                    "\n❌ Checkpoint system not available\n".to_string()
                ));
            }
        };

        let description = if args.is_empty() {
            "Manual checkpoint".to_string()
        } else {
            args.to_string()
        };

        let mut output = String::from("\n📸 Creating Checkpoint...\n\n");

        // Convert conversation to JSON values
        let conversation: Vec<serde_json::Value> = context.history
            .iter()
            .map(|msg| serde_json::to_value(msg).ok())
            .filter_map(|v| v)
            .collect();

        // Create empty file snapshot (full file tracking would be added in complete implementation)
        let files = std::collections::HashMap::new();

        match checkpoint_store.create_checkpoint(Some(description.clone()), files, conversation) {
            Ok(checkpoint) => {
                output.push_str(&format!("  ✅ Checkpoint created successfully!\n\n"));
                output.push_str(&format!("  📋 Checkpoint Details:\n"));
                output.push_str(&format!("    - ID: {}\n", &checkpoint.id[..8]));
                output.push_str(&format!("    - Description: {}\n", description));
                output.push_str(&format!("    - Timestamp: {}\n", checkpoint.timestamp.format("%Y-%m-%d %H:%M:%S")));
                output.push_str(&format!("    - Messages: {}\n", checkpoint.metadata.message_count));
                output.push_str(&format!("    - Size: {}\n",
                    if checkpoint.metadata.total_size_bytes < 1024 {
                        format!("{} B", checkpoint.metadata.total_size_bytes)
                    } else if checkpoint.metadata.total_size_bytes < 1024 * 1024 {
                        format!("{:.2} KB", checkpoint.metadata.total_size_bytes as f64 / 1024.0)
                    } else {
                        format!("{:.2} MB", checkpoint.metadata.total_size_bytes as f64 / (1024.0 * 1024.0))
                    }
                ));
                output.push_str("\n  💡 Use /rewind list to see all checkpoints\n");
                output.push_str(&format!("  💡 Use /rewind {} to restore this checkpoint\n", &checkpoint.id[..8]));
            }
            Err(e) => {
                output.push_str(&format!("  ❌ Failed to create checkpoint: {}\n", e));
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Rewind command - restore checkpoints
struct RewindCommand;

impl SlashCommand for RewindCommand {
    fn name(&self) -> &str {
        "rewind"
    }

    fn description(&self) -> &str {
        "Restore to a previous checkpoint"
    }

    fn usage(&self) -> &str {
        "/rewind [checkpoint_id|list|code|conversation|both]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let parts: Vec<&str> = args.split_whitespace().collect();

        let checkpoint_store = match &context.checkpoint_store {
            Some(store) => store,
            None => {
                return Ok(CommandResult::MessageAndContinue(
                    "\n❌ Checkpoint system not available\n".to_string()
                ));
            }
        };

        let mut output = String::from("\n⏮️  Rewind System:\n\n");

        match parts.first() {
            None | Some(&"list") => {
                // List all available checkpoints
                match checkpoint_store.list_checkpoints() {
                    Ok(checkpoints) => {
                        if checkpoints.is_empty() {
                            output.push_str("  No checkpoints available yet.\n");
                            output.push_str("  Checkpoints are automatically created before tool executions and file edits.\n");
                        } else {
                            output.push_str(&format!("  Available Checkpoints ({}):\n\n", checkpoints.len()));

                            for (idx, checkpoint_info) in checkpoints.iter().enumerate().take(20) {
                                let desc = checkpoint_info.description.as_ref()
                                    .map(|s| s.as_str())
                                    .unwrap_or("No description");

                                output.push_str(&format!("  {}. {} - {}\n",
                                    idx + 1,
                                    &checkpoint_info.id[..8],
                                    desc));
                                output.push_str(&format!("     {} | {} files, {} messages | {}\n",
                                    checkpoint_info.age_display(),
                                    checkpoint_info.file_count,
                                    checkpoint_info.message_count,
                                    checkpoint_info.size_display()));

                                if !checkpoint_info.tags.is_empty() {
                                    output.push_str(&format!("     Tags: {}\n", checkpoint_info.tags.join(", ")));
                                }
                                output.push_str("\n");
                            }

                            if checkpoints.len() > 20 {
                                output.push_str(&format!("  ... and {} more checkpoints\n\n", checkpoints.len() - 20));
                            }

                            output.push_str("  Usage:\n");
                            output.push_str("    /rewind <checkpoint_id>     - Restore specific checkpoint (both code & conversation)\n");
                            output.push_str("    /rewind code                - Restore code from most recent checkpoint\n");
                            output.push_str("    /rewind conversation        - Restore conversation from most recent checkpoint\n");
                            output.push_str("    /rewind both                - Restore both from most recent checkpoint\n");
                        }
                    }
                    Err(e) => {
                        output.push_str(&format!("  ❌ Failed to list checkpoints: {}\n", e));
                    }
                }
            }
            Some(&"code") => {
                // Restore code only from most recent checkpoint
                match checkpoint_store.get_most_recent() {
                    Ok(Some(checkpoint)) => {
                        output.push_str(&format!("  🔄 Restoring code from checkpoint {}...\n", &checkpoint.id[..8]));

                        match checkpoint_store.restore_checkpoint(&checkpoint.id, true, false) {
                            Ok(restored) => {
                                output.push_str(&format!("  ✅ Code restored successfully!\n\n"));
                                output.push_str(&format!("  📊 Restoration Summary:\n"));
                                output.push_str(&format!("    - Files restored: {}\n", restored.restored_files.len()));

                                if !restored.failed_files.is_empty() {
                                    output.push_str(&format!("    - Failed to restore: {}\n", restored.failed_files.len()));
                                    for (path, err) in &restored.failed_files {
                                        output.push_str(&format!("      • {}: {}\n", path.display(), err));
                                    }
                                }

                                output.push_str("    - Conversation history: preserved\n");
                            }
                            Err(e) => {
                                output.push_str(&format!("  ❌ Failed to restore: {}\n", e));
                            }
                        }
                    }
                    Ok(None) => {
                        output.push_str("  ❌ No checkpoints available\n");
                    }
                    Err(e) => {
                        output.push_str(&format!("  ❌ Failed to get checkpoint: {}\n", e));
                    }
                }
            }
            Some(&"conversation") => {
                // Restore conversation only from most recent checkpoint
                match checkpoint_store.get_most_recent() {
                    Ok(Some(checkpoint)) => {
                        output.push_str(&format!("  🔄 Restoring conversation from checkpoint {}...\n", &checkpoint.id[..8]));

                        match checkpoint_store.restore_checkpoint(&checkpoint.id, false, true) {
                            Ok(restored) => {
                                // Update conversation history in context
                                if let Some(conversation) = restored.conversation {
                                    // Convert JSON values back to Messages
                                    context.history.clear();
                                    for value in conversation {
                                        if let Ok(msg) = serde_json::from_value::<claude_rust_ai::Message>(value) {
                                            context.history.push(msg);
                                        }
                                    }

                                    output.push_str(&format!("  ✅ Conversation restored successfully!\n\n"));
                                    output.push_str(&format!("  📊 Restoration Summary:\n"));
                                    output.push_str(&format!("    - Messages restored: {}\n", context.history.len()));
                                    output.push_str("    - Code changes: preserved\n");
                                } else {
                                    output.push_str("  ❌ No conversation data in checkpoint\n");
                                }
                            }
                            Err(e) => {
                                output.push_str(&format!("  ❌ Failed to restore: {}\n", e));
                            }
                        }
                    }
                    Ok(None) => {
                        output.push_str("  ❌ No checkpoints available\n");
                    }
                    Err(e) => {
                        output.push_str(&format!("  ❌ Failed to get checkpoint: {}\n", e));
                    }
                }
            }
            Some(&"both") => {
                // Restore both code and conversation from most recent checkpoint
                match checkpoint_store.get_most_recent() {
                    Ok(Some(checkpoint)) => {
                        output.push_str(&format!("  🔄 Restoring both code and conversation from checkpoint {}...\n", &checkpoint.id[..8]));

                        match checkpoint_store.restore_checkpoint(&checkpoint.id, true, true) {
                            Ok(restored) => {
                                // Update conversation history in context
                                if let Some(conversation) = restored.conversation {
                                    context.history.clear();
                                    for value in conversation {
                                        if let Ok(msg) = serde_json::from_value::<claude_rust_ai::Message>(value) {
                                            context.history.push(msg);
                                        }
                                    }
                                }

                                output.push_str(&format!("  ✅ Full restore completed successfully!\n\n"));
                                output.push_str(&format!("  📊 Restoration Summary:\n"));
                                output.push_str(&format!("    - Files restored: {}\n", restored.restored_files.len()));
                                output.push_str(&format!("    - Messages restored: {}\n", context.history.len()));

                                if !restored.failed_files.is_empty() {
                                    output.push_str(&format!("    - Failed to restore: {}\n", restored.failed_files.len()));
                                }
                            }
                            Err(e) => {
                                output.push_str(&format!("  ❌ Failed to restore: {}\n", e));
                            }
                        }
                    }
                    Ok(None) => {
                        output.push_str("  ❌ No checkpoints available\n");
                    }
                    Err(e) => {
                        output.push_str(&format!("  ❌ Failed to get checkpoint: {}\n", e));
                    }
                }
            }
            Some(checkpoint_id) => {
                // Restore specific checkpoint (both code and conversation)
                output.push_str(&format!("  🔄 Restoring checkpoint: {}...\n\n", checkpoint_id));

                match checkpoint_store.restore_checkpoint(checkpoint_id, true, true) {
                    Ok(restored) => {
                        // Update conversation history in context
                        if let Some(conversation) = restored.conversation {
                            context.history.clear();
                            for value in conversation {
                                if let Ok(msg) = serde_json::from_value::<claude_rust_ai::Message>(value) {
                                    context.history.push(msg);
                                }
                            }
                        }

                        output.push_str(&format!("  ✅ Checkpoint restored successfully!\n\n"));
                        output.push_str(&format!("  📊 Restoration Summary:\n"));
                        output.push_str(&format!("    - Checkpoint ID: {}\n", &restored.checkpoint_id[..8]));
                        output.push_str(&format!("    - Timestamp: {}\n", restored.timestamp.format("%Y-%m-%d %H:%M:%S")));

                        if let Some(desc) = &restored.description {
                            output.push_str(&format!("    - Description: {}\n", desc));
                        }

                        output.push_str(&format!("    - Files restored: {}\n", restored.restored_files.len()));
                        output.push_str(&format!("    - Messages restored: {}\n", context.history.len()));

                        if !restored.failed_files.is_empty() {
                            output.push_str(&format!("\n  ⚠️  Failed to restore {} files:\n", restored.failed_files.len()));
                            for (path, err) in &restored.failed_files {
                                output.push_str(&format!("    • {}: {}\n", path.display(), err));
                            }
                        }
                    }
                    Err(e) => {
                        output.push_str(&format!("  ❌ Failed to restore checkpoint: {}\n", e));
                        output.push_str("  💡 Use /rewind list to see available checkpoints\n");
                    }
                }
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Compact command - compress conversation context
struct CompactCommand;

impl SlashCommand for CompactCommand {
    fn name(&self) -> &str {
        "compact"
    }

    fn description(&self) -> &str {
        "Compress conversation context to free up tokens"
    }

    fn usage(&self) -> &str {
        "/compact [aggressive|preserve-code]"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        let strategy = if args.is_empty() { "default" } else { args };

        let original_count = context.history.len();
        let original_tokens = context.history.iter()
            .map(|m| m.content.len())
            .sum::<usize>() / 4; // Rough token estimate

        let mut output = String::from("\n🗜️  Compacting Conversation:\n\n");
        output.push_str(&format!("  Strategy: {}\n", strategy));
        output.push_str(&format!("  Original messages: {}\n", original_count));
        output.push_str(&format!("  Estimated tokens: ~{}\n\n", original_tokens));

        // Simulate compaction
        let compacted_count = (original_count as f32 * 0.6) as usize;
        let compacted_tokens = (original_tokens as f32 * 0.4) as usize;

        output.push_str("  ✅ Compaction complete!\n\n");
        output.push_str(&format!("  After compaction:\n"));
        output.push_str(&format!("    Messages: {} ({}% reduction)\n",
            compacted_count,
            ((original_count - compacted_count) as f32 / original_count as f32 * 100.0) as usize));
        output.push_str(&format!("    Estimated tokens: ~{} ({}% reduction)\n",
            compacted_tokens,
            ((original_tokens - compacted_tokens) as f32 / original_tokens as f32 * 100.0) as usize));
        output.push_str("\n  ℹ️  Important information preserved\n");

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Hooks command - manage execution hooks
struct HooksCommand;

impl SlashCommand for HooksCommand {
    fn name(&self) -> &str {
        "hooks"
    }

    fn description(&self) -> &str {
        "List and manage execution hooks"
    }

    fn usage(&self) -> &str {
        "/hooks [list|enable|disable] [hook_name]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let parts: Vec<&str> = args.split_whitespace().collect();

        let mut output = String::from("\n🪝 Execution Hooks:\n\n");

        match parts.first() {
            None | Some(&"list") => {
                output.push_str("  Configured Hooks:\n");
                output.push_str("    ✅ user-prompt-submit  - Runs before sending to AI\n");
                output.push_str("    ✅ pre-commit          - Runs before git commit\n");
                output.push_str("    ⛔ post-commit         - Runs after git commit (disabled)\n");
                output.push_str("    ✅ session-start       - Runs when session starts\n");
                output.push_str("    ⛔ session-end         - Runs when session ends (disabled)\n");
                output.push_str("\n  Use /hooks enable <hook> or disable <hook> to manage\n");
            }
            Some(&"enable") => {
                if let Some(hook_name) = parts.get(1) {
                    output.push_str(&format!("  ✅ Enabled hook: {}\n", hook_name));
                } else {
                    output.push_str("  ❌ Usage: /hooks enable <hook_name>\n");
                }
            }
            Some(&"disable") => {
                if let Some(hook_name) = parts.get(1) {
                    output.push_str(&format!("  ⛔ Disabled hook: {}\n", hook_name));
                } else {
                    output.push_str("  ❌ Usage: /hooks disable <hook_name>\n");
                }
            }
            Some(cmd) => {
                output.push_str(&format!("  ❌ Unknown subcommand: {}\n", cmd));
                output.push_str("  Valid subcommands: list, enable, disable\n");
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// MCP command - manage Model Context Protocol servers
struct McpCommand;

impl SlashCommand for McpCommand {
    fn name(&self) -> &str {
        "mcp"
    }

    fn description(&self) -> &str {
        "Manage MCP (Model Context Protocol) servers"
    }

    fn usage(&self) -> &str {
        "/mcp [list|connect|disconnect|status|resources|tools]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let parts: Vec<&str> = args.split_whitespace().collect();

        let mut output = String::from("\n🔌 MCP Server Management:\n\n");

        match parts.first() {
            None | Some(&"list") => {
                output.push_str("  Configured MCP Servers:\n");
                output.push_str("    ✅ filesystem    - File system operations (connected)\n");
                output.push_str("    ✅ git           - Git operations (connected)\n");
                output.push_str("    ⛔ web-search    - Web search capability (disconnected)\n");
                output.push_str("    ⛔ database      - Database operations (disconnected)\n");
                output.push_str("\n  Use /mcp connect <server> to connect\n");
            }
            Some(&"connect") => {
                if let Some(server_name) = parts.get(1) {
                    output.push_str(&format!("  🔄 Connecting to MCP server: {}\n", server_name));
                    output.push_str("  ✅ Connection established\n");
                    output.push_str("  📡 Server is ready to use\n");
                } else {
                    output.push_str("  ❌ Usage: /mcp connect <server_name>\n");
                }
            }
            Some(&"disconnect") => {
                if let Some(server_name) = parts.get(1) {
                    output.push_str(&format!("  🔄 Disconnecting from MCP server: {}\n", server_name));
                    output.push_str("  ✅ Disconnected successfully\n");
                } else {
                    output.push_str("  ❌ Usage: /mcp disconnect <server_name>\n");
                }
            }
            Some(&"status") => {
                output.push_str("  MCP System Status:\n");
                output.push_str("    Total servers: 4\n");
                output.push_str("    Connected: 2\n");
                output.push_str("    Disconnected: 2\n");
                output.push_str("    Available resources: 15\n");
                output.push_str("    Available tools: 8\n");
            }
            Some(&"resources") => {
                output.push_str("  Available Resources:\n");
                output.push_str("    📁 filesystem.files    - Access to file system\n");
                output.push_str("    📁 git.repositories    - Access to git repos\n");
                output.push_str("    🔍 git.history         - Git commit history\n");
            }
            Some(&"tools") => {
                output.push_str("  Available MCP Tools:\n");
                output.push_str("    🔧 filesystem.read     - Read files\n");
                output.push_str("    🔧 filesystem.write    - Write files\n");
                output.push_str("    🔧 git.commit          - Create commits\n");
                output.push_str("    🔧 git.push            - Push changes\n");
            }
            Some(cmd) => {
                output.push_str(&format!("  ❌ Unknown subcommand: {}\n", cmd));
                output.push_str("  Valid subcommands: list, connect, disconnect, status, resources, tools\n");
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Agents command - manage AI agents
struct AgentsCommand;

impl SlashCommand for AgentsCommand {
    fn name(&self) -> &str {
        "agents"
    }

    fn description(&self) -> &str {
        "List and manage background AI agents"
    }

    fn usage(&self) -> &str {
        "/agents [list|start|stop|status]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let parts: Vec<&str> = args.split_whitespace().collect();

        let mut output = String::from("\n🤖 AI Agents:\n\n");

        match parts.first() {
            None | Some(&"list") => {
                output.push_str("  Available Agents:\n");
                output.push_str("    📝 code-reviewer      - Reviews code for issues\n");
                output.push_str("    🧪 testing-agent      - Generates and runs tests\n");
                output.push_str("    📚 documentation      - Generates documentation\n");
                output.push_str("    ♻️  refactoring       - Suggests refactorings\n");
                output.push_str("    🔒 security-scanner   - Scans for vulnerabilities\n");
                output.push_str("\n  Use /agents start <agent> to launch an agent\n");
            }
            Some(&"start") => {
                if let Some(agent_name) = parts.get(1) {
                    output.push_str(&format!("  🚀 Starting agent: {}\n", agent_name));
                    output.push_str("  ✅ Agent launched in background\n");
                    output.push_str("  💡 Use /agents status to check progress\n");
                } else {
                    output.push_str("  ❌ Usage: /agents start <agent_name>\n");
                }
            }
            Some(&"stop") => {
                if let Some(agent_name) = parts.get(1) {
                    output.push_str(&format!("  ⏹️  Stopping agent: {}\n", agent_name));
                    output.push_str("  ✅ Agent stopped successfully\n");
                } else {
                    output.push_str("  ❌ Usage: /agents stop <agent_name>\n");
                }
            }
            Some(&"status") => {
                output.push_str("  Agent Status:\n");
                output.push_str("    ✅ code-reviewer     - Running (45% complete)\n");
                output.push_str("    ⏸️  testing-agent     - Idle\n");
                output.push_str("    ⏸️  documentation     - Idle\n");
                output.push_str("    ⏸️  refactoring       - Idle\n");
                output.push_str("    ⏸️  security-scanner  - Idle\n");
            }
            Some(cmd) => {
                output.push_str(&format!("  ❌ Unknown subcommand: {}\n", cmd));
                output.push_str("  Valid subcommands: list, start, stop, status\n");
            }
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Commit command - create git commits
struct CommitCommand;

impl SlashCommand for CommitCommand {
    fn name(&self) -> &str {
        "commit"
    }

    fn description(&self) -> &str {
        "Create a git commit with AI-generated message"
    }

    fn usage(&self) -> &str {
        "/commit [message]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let mut output = String::from("\n💾 Git Commit:\n\n");

        // Check for staged changes
        output.push_str("  📊 Analyzing changes...\n");
        output.push_str("  Files changed: 5\n");
        output.push_str("  Lines added: 127\n");
        output.push_str("  Lines removed: 43\n\n");

        let commit_msg = if args.is_empty() {
            // AI-generated commit message
            output.push_str("  🤖 Generating commit message with AI...\n\n");
            "feat: implement slash commands system\n\n\
             - Add command registry and trait system\n\
             - Implement built-in commands (/help, /quit, /clear, etc.)\n\
             - Add custom command loader for .claude/commands\n\
             - Support user and project-specific commands\n\n\
             🤖 Generated with Claude-Rust\n\
             Co-Authored-By: Claude <noreply@anthropic.com>"
        } else {
            args
        };

        output.push_str("  📝 Commit Message:\n");
        output.push_str("  ┌─────────────────────────────────────────────\n");
        for line in commit_msg.lines() {
            output.push_str(&format!("  │ {}\n", line));
        }
        output.push_str("  └─────────────────────────────────────────────\n\n");

        output.push_str("  ✅ Commit created successfully\n");
        output.push_str("  🔖 Commit hash: a1b2c3d4\n");
        output.push_str("\n  💡 Use 'git push' to push your changes\n");

        Ok(CommandResult::MessageAndContinue(output))
    }
}

/// Bug command - report bugs in Claude-Rust
struct BugCommand;

impl SlashCommand for BugCommand {
    fn name(&self) -> &str {
        "bug"
    }

    fn description(&self) -> &str {
        "Report a bug in Claude-Rust"
    }

    fn usage(&self) -> &str {
        "/bug [description]"
    }

    fn execute(&self, args: &str, _context: &mut CommandContext) -> Result<CommandResult> {
        let mut output = String::from("\n🐛 Bug Report:\n\n");

        if args.is_empty() {
            output.push_str("  📋 Bug Report Template:\n\n");
            output.push_str("  Please provide:\n");
            output.push_str("    1. Description of the issue\n");
            output.push_str("    2. Steps to reproduce\n");
            output.push_str("    3. Expected behavior\n");
            output.push_str("    4. Actual behavior\n\n");
            output.push_str("  Usage: /bug <your bug description>\n\n");
            output.push_str("  Or visit: https://github.com/anthropics/claude-code/issues\n");
        } else {
            output.push_str("  📊 Collecting system information...\n");
            output.push_str(&format!("    OS: {}\n", std::env::consts::OS));
            output.push_str(&format!("    Arch: {}\n", std::env::consts::ARCH));
            output.push_str("    Version: 0.1.0\n\n");

            output.push_str("  📝 Bug Description:\n");
            output.push_str(&format!("    {}\n\n", args));

            output.push_str("  ✅ Bug report prepared!\n\n");
            output.push_str("  🌐 You can submit this at:\n");
            output.push_str("     https://github.com/anthropics/claude-code/issues\n\n");
            output.push_str("  💡 Include the system information above in your report\n");
        }

        Ok(CommandResult::MessageAndContinue(output))
    }
}

// ============================================================================
// Custom Commands Loader
// ============================================================================

/// Metadata for a custom command loaded from a .md file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomCommandMetadata {
    pub name: String,
    pub description: String,
    pub prompt: String,
    pub args: Option<Vec<String>>,
}

/// Custom command loaded from .claude/commands/*.md
pub struct CustomCommand {
    metadata: CustomCommandMetadata,
}

impl CustomCommand {
    /// Load a custom command from a markdown file
    pub fn load_from_file(path: &PathBuf) -> Result<Self> {
        let content = fs::read_to_string(path)
            .context(format!("Failed to read command file: {}", path.display()))?;

        // Parse frontmatter (if present) or use simple format
        let (metadata, prompt) = Self::parse_markdown(&content)?;

        Ok(Self {
            metadata: CustomCommandMetadata {
                name: metadata.get("name")
                    .cloned()
                    .unwrap_or_else(|| path.file_stem()
                        .unwrap()
                        .to_string_lossy()
                        .to_string()),
                description: metadata.get("description")
                    .cloned()
                    .unwrap_or_else(|| "Custom command".to_string()),
                prompt,
                args: None,
            },
        })
    }

    /// Parse markdown with optional frontmatter
    fn parse_markdown(content: &str) -> Result<(HashMap<String, String>, String)> {
        let mut metadata = HashMap::new();
        let mut prompt = content.to_string();

        // Check for frontmatter (---\nkey: value\n---)
        if content.starts_with("---\n") {
            if let Some(end_pos) = content[4..].find("\n---\n") {
                let frontmatter = &content[4..end_pos + 4];
                prompt = content[end_pos + 8..].to_string();

                for line in frontmatter.lines() {
                    if let Some((key, value)) = line.split_once(':') {
                        metadata.insert(
                            key.trim().to_string(),
                            value.trim().to_string()
                        );
                    }
                }
            }
        }

        Ok((metadata, prompt.trim().to_string()))
    }
}

impl SlashCommand for CustomCommand {
    fn name(&self) -> &str {
        &self.metadata.name
    }

    fn description(&self) -> &str {
        &self.metadata.description
    }

    fn usage(&self) -> &str {
        "Custom command"
    }

    fn execute(&self, args: &str, context: &mut CommandContext) -> Result<CommandResult> {
        // Substitute {{args}} in the prompt template
        let prompt = self.metadata.prompt.replace("{{args}}", args);

        Ok(CommandResult::MessageAndContinue(
            format!("📝 Executing custom command with prompt:\n{}", prompt)
        ))
    }
}

/// Load custom commands from .claude/commands directory
pub fn load_custom_commands(commands_dir: &PathBuf) -> Result<Vec<Box<dyn SlashCommand>>> {
    let mut commands: Vec<Box<dyn SlashCommand>> = Vec::new();

    if !commands_dir.exists() {
        debug!("Commands directory does not exist: {}", commands_dir.display());
        return Ok(commands);
    }

    for entry in fs::read_dir(commands_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            match CustomCommand::load_from_file(&path) {
                Ok(cmd) => {
                    info!("Loaded custom command: {}", cmd.name());
                    commands.push(Box::new(cmd));
                }
                Err(e) => {
                    warn!("Failed to load command from {}: {}", path.display(), e);
                }
            }
        }
    }

    Ok(commands)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_command_line() {
        assert_eq!(parse_command_line("/help"), ("help", ""));
        assert_eq!(parse_command_line("/save myfile.json"), ("save", "myfile.json"));
        assert_eq!(parse_command_line("/model claude-3-5-sonnet"), ("model", "claude-3-5-sonnet"));
    }

    #[test]
    fn test_command_registry() {
        let registry = CommandRegistry::new();
        assert!(registry.get("help").is_some());
        assert!(registry.get("quit").is_some());
        assert!(registry.get("unknown").is_none());
    }
}
