//! Command routing system with dynamic dispatch

use super::{CliError, CliResult, CommandContext, Commands};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, instrument};

/// Command handler trait
#[async_trait]
pub trait CommandHandler: Send + Sync {
    /// Execute the command
    async fn execute(&self, ctx: &CommandContext) -> CliResult<CommandResult>;

    /// Get command name
    fn name(&self) -> &str;

    /// Get command description
    fn description(&self) -> &str {
        ""
    }
}

/// Command execution result
#[derive(Debug, Clone)]
pub struct CommandResult {
    pub success: bool,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
    pub exit_code: i32,
}

impl CommandResult {
    pub fn success() -> Self {
        Self {
            success: true,
            message: None,
            data: None,
            exit_code: 0,
        }
    }

    pub fn success_with_message(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: Some(message.into()),
            data: None,
            exit_code: 0,
        }
    }

    pub fn success_with_data(data: serde_json::Value) -> Self {
        Self {
            success: true,
            message: None,
            data: Some(data),
            exit_code: 0,
        }
    }

    pub fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: Some(message.into()),
            data: None,
            exit_code: 1,
        }
    }

    pub fn error_with_code(message: impl Into<String>, exit_code: i32) -> Self {
        Self {
            success: false,
            message: Some(message.into()),
            data: None,
            exit_code,
        }
    }
}

/// Command router for dispatching commands to handlers
pub struct CommandRouter {
    handlers: HashMap<String, Arc<dyn CommandHandler>>,
}

impl CommandRouter {
    /// Create a new command router
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    /// Register a command handler
    pub fn register<H: CommandHandler + 'static>(&mut self, handler: H) -> &mut Self {
        let name = handler.name().to_string();
        self.handlers.insert(name, Arc::new(handler));
        self
    }

    /// Route and execute command
    #[instrument(skip(self, ctx))]
    pub async fn route(&self, ctx: &CommandContext) -> CliResult<CommandResult> {
        let command_name = self.get_command_name(&ctx.cli.command);
        info!("Routing command: {}", command_name);

        let handler = self.handlers.get(&command_name).ok_or_else(|| {
            CliError::RoutingError(format!(
                "No handler registered for command: {}",
                command_name
            ))
        })?;

        debug!("Executing handler: {}", handler.name());
        handler.execute(ctx).await
    }

    /// Get command name from CLI
    fn get_command_name(&self, command: &Option<Commands>) -> String {
        match command {
            Some(Commands::Chat { .. }) => "chat".to_string(),
            Some(Commands::Plan { .. }) => "plan".to_string(),
            Some(Commands::Work { .. }) => "work".to_string(),
            Some(Commands::Providers { .. }) => "providers".to_string(),
            Some(Commands::Creds { .. }) => "creds".to_string(),
            Some(Commands::Memory { .. }) => "memory".to_string(),
            Some(Commands::Agents { .. }) => "agents".to_string(),
            Some(Commands::Checkpoint { .. }) => "checkpoint".to_string(),
            Some(Commands::Config { .. }) => "config".to_string(),
            None => "default".to_string(),
        }
    }

    /// List registered handlers
    pub fn list_handlers(&self) -> Vec<&str> {
        self.handlers.keys().map(|s| s.as_str()).collect()
    }
}

impl Default for CommandRouter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::Cli;

    struct TestHandler {
        name: String,
    }

    #[async_trait]
    impl CommandHandler for TestHandler {
        async fn execute(&self, _ctx: &CommandContext) -> CliResult<CommandResult> {
            Ok(CommandResult::success_with_message("Test executed"))
        }

        fn name(&self) -> &str {
            &self.name
        }

        fn description(&self) -> &str {
            "Test handler"
        }
    }

    #[test]
    fn test_router_creation() {
        let router = CommandRouter::new();
        assert_eq!(router.list_handlers().len(), 0);
    }

    #[test]
    fn test_router_register() {
        let mut router = CommandRouter::new();
        router.register(TestHandler {
            name: "test".to_string(),
        });
        assert_eq!(router.list_handlers().len(), 1);
        assert!(router.list_handlers().contains(&"test"));
    }

    #[tokio::test]
    async fn test_router_execute() {
        let mut router = CommandRouter::new();
        router.register(TestHandler {
            name: "chat".to_string(),
        });

        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let ctx = CommandContext::new(cli);

        let result = router.route(&ctx).await.unwrap();
        assert!(result.success);
        assert_eq!(result.message, Some("Test executed".to_string()));
    }

    #[tokio::test]
    async fn test_router_missing_handler() {
        let router = CommandRouter::new();
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let ctx = CommandContext::new(cli);

        let result = router.route(&ctx).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_command_result_success() {
        let result = CommandResult::success();
        assert!(result.success);
        assert_eq!(result.exit_code, 0);
    }

    #[test]
    fn test_command_result_error() {
        let result = CommandResult::error("Test error");
        assert!(!result.success);
        assert_eq!(result.exit_code, 1);
        assert_eq!(result.message, Some("Test error".to_string()));
    }
}
