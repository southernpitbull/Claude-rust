//! Interactive mode handler
//!
//! Orchestrates the interactive REPL session

use anyhow::Result;
use claude_code_ai::AiClient;
use claude_code_auth::{AuthManager, CredentialStore};
use claude_code_core::session::SessionStore;
use std::sync::Arc;
use tracing::info;

use crate::commands::Cli;
use crate::interactive::InteractiveSession;

/// Handle interactive mode
pub async fn handle_interactive(cli: Cli) -> Result<()> {
    info!("Starting interactive mode");

    // Initialize authentication with credential store
    let credential_store = CredentialStore::new();
    let auth_manager = Arc::new(AuthManager::new(credential_store)?);

    // Check for credentials (checking for "default" provider)
    if !auth_manager.has_credentials("default").await {
        eprintln!("⚠️  No API credentials found. Please run: claude auth login");
        std::process::exit(2);
    }

    // Initialize AI client
    let ai_client = Arc::new(AiClient::new());

    // Initialize session store
    let session_store = Arc::new(SessionStore::new(None)?);

    // Create and run interactive session
    let mut session = InteractiveSession::new(
        auth_manager,
        ai_client,
        session_store,
        cli,
    ).await?;

    session.run().await?;

    Ok(())
}
