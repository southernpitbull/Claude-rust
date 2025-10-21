//! Middleware pipeline for command pre/post processing

use super::router::CommandResult;
use super::{CliError, CliResult, CommandContext};
use async_trait::async_trait;
use clap::Parser;
use std::sync::Arc;
use tracing::{debug, instrument};

/// Middleware trait for command processing
#[async_trait]
pub trait Middleware: Send + Sync {
    /// Execute before command
    async fn before(&self, ctx: &mut CommandContext) -> CliResult<()> {
        let _ = ctx;
        Ok(())
    }

    /// Execute after command
    async fn after(&self, ctx: &mut CommandContext, result: &CommandResult) -> CliResult<()> {
        let _ = (ctx, result);
        Ok(())
    }

    /// Get middleware name
    fn name(&self) -> &str;
}

/// Middleware chain executor
pub struct MiddlewareChain {
    middlewares: Vec<Arc<dyn Middleware>>,
}

impl MiddlewareChain {
    /// Create a new middleware chain
    pub fn new() -> Self {
        Self {
            middlewares: Vec::new(),
        }
    }

    /// Add middleware to the chain
    pub fn add<M: Middleware + 'static>(mut self, middleware: M) -> Self {
        self.middlewares.push(Arc::new(middleware));
        self
    }

    /// Execute before middlewares
    #[instrument(skip(self, ctx))]
    pub async fn execute_before(&self, ctx: &mut CommandContext) -> CliResult<()> {
        for middleware in &self.middlewares {
            debug!("Executing before middleware: {}", middleware.name());
            middleware.before(ctx).await.map_err(|e| {
                CliError::MiddlewareError(format!("{} failed: {}", middleware.name(), e))
            })?;
        }
        Ok(())
    }

    /// Execute after middlewares (in reverse order)
    #[instrument(skip(self, ctx, result))]
    pub async fn execute_after(
        &self,
        ctx: &mut CommandContext,
        result: &CommandResult,
    ) -> CliResult<()> {
        for middleware in self.middlewares.iter().rev() {
            debug!("Executing after middleware: {}", middleware.name());
            middleware.after(ctx, result).await.map_err(|e| {
                CliError::MiddlewareError(format!("{} failed: {}", middleware.name(), e))
            })?;
        }
        Ok(())
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}

/// Logging middleware
pub struct LoggingMiddleware;

#[async_trait]
impl Middleware for LoggingMiddleware {
    async fn before(&self, ctx: &mut CommandContext) -> CliResult<()> {
        ctx.set_metadata("start_time".to_string(), format!("{:?}", ctx.start_time))
            .await;
        debug!("Command execution started");
        Ok(())
    }

    async fn after(&self, ctx: &mut CommandContext, result: &CommandResult) -> CliResult<()> {
        let elapsed = ctx.start_time.elapsed();
        debug!(
            "Command execution completed in {:?} with status: {}",
            elapsed,
            if result.success { "success" } else { "failure" }
        );
        Ok(())
    }

    fn name(&self) -> &str {
        "logging"
    }
}

/// Metrics middleware
pub struct MetricsMiddleware {
    command_counter: Arc<parking_lot::RwLock<u64>>,
}

impl MetricsMiddleware {
    pub fn new() -> Self {
        Self {
            command_counter: Arc::new(parking_lot::RwLock::new(0)),
        }
    }

    pub fn get_count(&self) -> u64 {
        *self.command_counter.read()
    }
}

impl Default for MetricsMiddleware {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Middleware for MetricsMiddleware {
    async fn before(&self, _ctx: &mut CommandContext) -> CliResult<()> {
        *self.command_counter.write() += 1;
        Ok(())
    }

    fn name(&self) -> &str {
        "metrics"
    }
}

/// Validation middleware
pub struct ValidationMiddleware;

#[async_trait]
impl Middleware for ValidationMiddleware {
    async fn before(&self, ctx: &mut CommandContext) -> CliResult<()> {
        ctx.cli.validate()?;
        Ok(())
    }

    fn name(&self) -> &str {
        "validation"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cli::Cli;

    #[tokio::test]
    async fn test_middleware_chain_creation() {
        let chain = MiddlewareChain::new();
        assert_eq!(chain.middlewares.len(), 0);
    }

    #[tokio::test]
    async fn test_middleware_chain_add() {
        let chain = MiddlewareChain::new()
            .add(LoggingMiddleware)
            .add(MetricsMiddleware::new());
        assert_eq!(chain.middlewares.len(), 2);
    }

    #[tokio::test]
    async fn test_middleware_chain_execute_before() {
        let chain = MiddlewareChain::new().add(LoggingMiddleware);
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let mut ctx = CommandContext::new(cli);

        let result = chain.execute_before(&mut ctx).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_middleware_chain_execute_after() {
        let chain = MiddlewareChain::new().add(LoggingMiddleware);
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let mut ctx = CommandContext::new(cli);
        let result = CommandResult::success();

        let res = chain.execute_after(&mut ctx, &result).await;
        assert!(res.is_ok());
    }

    #[tokio::test]
    async fn test_logging_middleware() {
        let middleware = LoggingMiddleware;
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let mut ctx = CommandContext::new(cli);

        assert!(middleware.before(&mut ctx).await.is_ok());

        let result = CommandResult::success();
        assert!(middleware.after(&mut ctx, &result).await.is_ok());
    }

    #[tokio::test]
    async fn test_metrics_middleware() {
        let middleware = MetricsMiddleware::new();
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let mut ctx = CommandContext::new(cli);

        assert_eq!(middleware.get_count(), 0);
        middleware.before(&mut ctx).await.unwrap();
        assert_eq!(middleware.get_count(), 1);
    }

    #[tokio::test]
    async fn test_validation_middleware() {
        let middleware = ValidationMiddleware;
        let cli = Cli::try_parse_from(&["ai", "chat"]).unwrap();
        let mut ctx = CommandContext::new(cli);

        assert!(middleware.before(&mut ctx).await.is_ok());
    }

    #[tokio::test]
    async fn test_validation_middleware_fails() {
        let middleware = ValidationMiddleware;
        let cli = Cli {
            verbose: 10, // Invalid value
            config: None,
            no_color: false,
            format: crate::cli::OutputFormat::Text,
            command: None,
        };
        let mut ctx = CommandContext::new(cli);

        assert!(middleware.before(&mut ctx).await.is_err());
    }
}
