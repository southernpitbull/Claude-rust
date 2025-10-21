//! AIrchitect CLI - Main Entry Point
//!
//! This is the main entry point for the Rust-based core components
//! of the AIrchitect CLI system.

use ai_cli_core::{cli::Cli, AICli, AppConfig};
use clap::Parser;
use std::process;

/// Main entry point for the AIrchitect CLI
#[tokio::main]
async fn main() {
    // Parse command line arguments
    let cli = Cli::parse();

    // Set up logging based on verbose level
    setup_logging(cli.verbose);

    // Create default configuration
    let config = AppConfig::default();

    // Create the AIrchitect CLI application
    let app = AICli::new(config);

    // Run the application
    match app.run().await {
        Ok(()) => {
            println!("AIrchitect CLI completed successfully");
            process::exit(0);
        }
        Err(e) => {
            eprintln!("Error: {}", e);
            process::exit(1);
        }
    }
}

/// Set up logging based on verbose level
fn setup_logging(verbose_level: u8) {
    match verbose_level {
        0 => std::env::set_var("RUST_LOG", "info"),
        1 => std::env::set_var("RUST_LOG", "debug"),
        _ => std::env::set_var("RUST_LOG", "trace"),
    }

    // Initialize the logger
    env_logger::init();
}
