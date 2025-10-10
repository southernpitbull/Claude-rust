pub mod app;
pub mod claude_memory;
pub mod cli;
pub mod commands;
pub mod handlers;
pub mod hooks;
pub mod interactive;
pub mod plugin_manager;
pub mod print_mode;
pub mod settings;
pub mod settings_commands;
pub mod slash_commands;
pub mod tool_executor;

// Re-export from cli module
pub use cli::{Cli, Commands, AuthCommands, AiProvider, OutputFormat, AnalysisType, IndexCommands, ProjectTemplate};

// Re-export from commands module for compatibility
pub use commands::CommandHandler;

// Re-export from print_mode module
pub use print_mode::{PrintMode, PrintModeConfig};

// Re-export from settings module
pub use settings::HookConfig;

// Re-export from hooks module
pub use hooks::{HookType, HookContext, HookResult};

// Re-export from tool_executor module
pub use tool_executor::{ToolExecutor, PermissionManager};