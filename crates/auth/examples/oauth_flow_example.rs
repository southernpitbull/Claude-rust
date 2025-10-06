//! OAuth 2.0 Flow Example
//!
//! This example demonstrates how to use the OAuth 2.0 implementation
//! with PKCE support to authenticate users.
//!
//! Run with: cargo run --example oauth_flow_example

use claude_rust_auth::{OAuthConfig, OAuthFlow, ServerConfig, CallbackServer};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing for logging
    tracing_subscriber::fmt::init();

    println!("OAuth 2.0 Flow Example");
    println!("=====================\n");

    // Example 1: Complete OAuth flow with automatic browser opening
    example_complete_flow().await?;

    // Example 2: Manual OAuth flow (for environments without browser)
    // example_manual_flow().await?;

    Ok(())
}

/// Example of complete OAuth flow with automatic browser opening
async fn example_complete_flow() -> Result<(), Box<dyn std::error::Error>> {
    println!("Example 1: Complete OAuth Flow");
    println!("-------------------------------\n");

    // Configure OAuth for your provider
    let config = OAuthConfig::new(
        "your_client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    )
    .with_scopes(vec![
        "read".to_string(),
        "write".to_string(),
    ])
    .with_pkce(true);

    // Create OAuth flow
    let mut flow = OAuthFlow::new(config);

    println!("Starting OAuth flow...");

    // Run the complete flow (starts server, opens browser, waits for callback)
    match flow.run_flow().await {
        Ok(token) => {
            println!("\nAuthentication successful!");
            println!("Access Token: {}", mask_token(&token.access_token));
            println!("Token Type: {}", token.token_type);

            if let Some(expires_in) = token.expires_in {
                println!("Expires In: {} seconds", expires_in);
            }

            if let Some(refresh_token) = &token.refresh_token {
                println!("Refresh Token: {}", mask_token(refresh_token));
            }

            if let Some(scope) = &token.scope {
                println!("Granted Scopes: {}", scope);
            }

            // You can now use the access token to make API requests
            println!("\nToken can now be used for API requests!");
        }
        Err(e) => {
            eprintln!("Authentication failed: {}", e);
        }
    }

    Ok(())
}

/// Example of manual OAuth flow (without automatic browser opening)
#[allow(dead_code)]
async fn example_manual_flow() -> Result<(), Box<dyn std::error::Error>> {
    println!("\nExample 2: Manual OAuth Flow");
    println!("----------------------------\n");

    // Configure OAuth
    let config = OAuthConfig::new(
        "your_client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    )
    .with_scopes(vec!["api.access".to_string()])
    .with_pkce(true);

    let mut flow = OAuthFlow::new(config);

    // Step 1: Generate authorization URL
    let auth_url = flow.build_authorization_url()?;
    println!("Please visit the following URL to authorize:");
    println!("{}\n", auth_url);

    // Step 2: Start callback server
    let server_config = ServerConfig::default();
    let mut server = CallbackServer::new(server_config)?;
    let port = server.start()?;

    println!("Callback server listening on port {}", port);
    println!("Waiting for callback...\n");

    // Step 3: Wait for callback
    let callback = server.wait_for_callback()?;

    // Step 4: Exchange code for token
    if callback.is_error() {
        eprintln!("Authentication error: {:?}", callback.error_message());
        return Ok(());
    }

    println!("Received authorization code, exchanging for token...");

    let token = flow.exchange_code(&callback.code).await?;

    println!("Successfully obtained access token!");
    println!("Access Token: {}", mask_token(&token.access_token));

    Ok(())
}

/// Example of token refresh
#[allow(dead_code)]
async fn example_token_refresh() -> Result<(), Box<dyn std::error::Error>> {
    println!("\nExample 3: Token Refresh");
    println!("------------------------\n");

    let config = OAuthConfig::new(
        "your_client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    );

    let flow = OAuthFlow::new(config);

    // Assume we have a refresh token from previous authentication
    let refresh_token = "your_refresh_token";

    println!("Refreshing access token...");

    match flow.refresh_token(refresh_token).await {
        Ok(token) => {
            println!("Token refreshed successfully!");
            println!("New Access Token: {}", mask_token(&token.access_token));

            if let Some(expires_in) = token.expires_in {
                println!("Expires In: {} seconds", expires_in);
            }
        }
        Err(e) => {
            eprintln!("Token refresh failed: {}", e);
        }
    }

    Ok(())
}

/// Example for different provider configurations
#[allow(dead_code)]
fn example_provider_configs() {
    println!("\nExample Provider Configurations");
    println!("================================\n");

    // Example: GitHub OAuth
    println!("1. GitHub OAuth Configuration:");
    let _github_config = OAuthConfig::new(
        "github_client_id".to_string(),
        "https://github.com/login/oauth/authorize".to_string(),
        "https://github.com/login/oauth/access_token".to_string(),
    )
    .with_scopes(vec!["user".to_string(), "repo".to_string()]);
    println!("   - Authorization: https://github.com/login/oauth/authorize");
    println!("   - Token: https://github.com/login/oauth/access_token\n");

    // Example: Google OAuth
    println!("2. Google OAuth Configuration:");
    let _google_config = OAuthConfig::new(
        "google_client_id".to_string(),
        "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
        "https://oauth2.googleapis.com/token".to_string(),
    )
    .with_scopes(vec![
        "https://www.googleapis.com/auth/userinfo.email".to_string(),
        "https://www.googleapis.com/auth/userinfo.profile".to_string(),
    ])
    .with_param("access_type".to_string(), "offline".to_string());
    println!("   - Authorization: https://accounts.google.com/o/oauth2/v2/auth");
    println!("   - Token: https://oauth2.googleapis.com/token\n");

    // Example: Microsoft OAuth
    println!("3. Microsoft OAuth Configuration:");
    let _microsoft_config = OAuthConfig::new(
        "microsoft_client_id".to_string(),
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
        "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
    )
    .with_scopes(vec![
        "openid".to_string(),
        "profile".to_string(),
        "email".to_string(),
    ]);
    println!("   - Authorization: https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    println!("   - Token: https://login.microsoftonline.com/common/oauth2/v2.0/token\n");
}

/// Masks a token for display (shows first and last 4 characters)
fn mask_token(token: &str) -> String {
    if token.len() <= 8 {
        return "*".repeat(token.len());
    }

    let start = &token[..4];
    let end = &token[token.len() - 4..];
    format!("{}...{}", start, end)
}
