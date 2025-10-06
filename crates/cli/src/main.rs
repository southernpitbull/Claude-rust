//! Main CLI Entry Point
//!
//! Application bootstrapping and entry point

use clap::Parser;
use std::process;
use tracing::{error, info};
use tracing_subscriber::{EnvFilter, FmtSubscriber};

use claude_code_cli::{Cli, CommandHandler, is_first_run, run_first_time_setup};

#[tokio::main]
async fn main() {
    // Initialize logging
    setup_logging();

    info!("Starting Claude Code CLI v{}", env!("CARGO_PKG_VERSION"));

    // Check for first run (only if no command specified)
    let cli = Cli::parse();

    // Run first-time setup if this is the first run and no explicit command given
    if cli.command.is_none() {
        if let Ok(true) = is_first_run().await {
            if let Err(e) = run_first_time_setup().await {
                error!("First-time setup failed: {}", e);
                eprintln!("\n⚠️  Setup incomplete. You can run 'claude-code auth login' to set up providers manually.");
            }
            return;
        }
    }

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