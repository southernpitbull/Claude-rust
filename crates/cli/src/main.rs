//! Main CLI Entry Point
//!
//! Application bootstrapping and entry point

use clap::Parser;
use std::process;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use claude_code_cli::{Cli, CommandHandler};

#[tokio::main]
async fn main() {
    // Initialize logging
    setup_logging();

    info!("Starting Claude Code CLI v{}", env!("CARGO_PKG_VERSION"));

    // Parse command line arguments
    let cli = Cli::parse();

    // Handle the command
    if let Err(e) = CommandHandler::handle_command(cli).await {
        error!("Command failed: {}", e);
        process::exit(1);
    }
}

/// Set up logging based on verbosity level
fn setup_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,claude_code=debug"));

    let subscriber = FmtSubscriber::builder()
        .with_env_filter(filter)
        .finish();

    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set global tracing subscriber");
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_constants() {
        let version = env!("CARGO_PKG_VERSION");
        assert!(!version.is_empty());
    }
}