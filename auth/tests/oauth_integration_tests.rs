//! Integration tests for OAuth 2.0 implementation
//!
//! These tests demonstrate the usage of the OAuth flow implementation
//! with PKCE support.

use claude_code_auth::{
    ChallengeMethod, OAuthConfig, OAuthFlow, PkceParams, CallbackServer, ServerConfig,
};

#[test]
fn test_pkce_generation() {
    // Test PKCE parameter generation with S256
    let pkce = PkceParams::new(64);

    assert_eq!(pkce.code_verifier.len(), 64);
    assert!(!pkce.code_challenge.is_empty());
    assert_eq!(pkce.challenge_method, ChallengeMethod::S256);
    assert_ne!(pkce.code_verifier, pkce.code_challenge);
}

#[test]
fn test_pkce_plain_method() {
    // Test PKCE with plain method
    let pkce = PkceParams::new_with_method(64, ChallengeMethod::Plain);

    assert_eq!(pkce.code_verifier, pkce.code_challenge);
    assert_eq!(pkce.challenge_method, ChallengeMethod::Plain);
}

#[test]
fn test_oauth_config_creation() {
    // Create OAuth configuration for a typical provider
    let config = OAuthConfig::new(
        "test_client_id".to_string(),
        "https://auth.provider.com/authorize".to_string(),
        "https://auth.provider.com/token".to_string(),
    )
    .with_scopes(vec![
        "read".to_string(),
        "write".to_string(),
    ])
    .with_pkce(true);

    assert_eq!(config.client_id, "test_client_id");
    assert_eq!(config.scopes, vec!["read", "write"]);
    assert!(config.use_pkce);
}

#[test]
fn test_oauth_config_with_client_secret() {
    // Create confidential client configuration
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.provider.com/authorize".to_string(),
        "https://auth.provider.com/token".to_string(),
    )
    .with_client_secret("client_secret".to_string())
    .with_pkce(false); // Confidential clients may not need PKCE

    assert_eq!(config.client_secret, Some("client_secret".to_string()));
    assert!(!config.use_pkce);
}

#[test]
fn test_authorization_url_generation() {
    // Test authorization URL generation with PKCE
    let config = OAuthConfig::new(
        "test_client".to_string(),
        "https://oauth.example.com/authorize".to_string(),
        "https://oauth.example.com/token".to_string(),
    )
    .with_scopes(vec!["profile".to_string(), "email".to_string()]);

    let mut flow = OAuthFlow::new(config);
    let auth_url = flow.build_authorization_url().unwrap();

    // Verify URL contains required parameters
    assert!(auth_url.starts_with("https://oauth.example.com/authorize?"));
    assert!(auth_url.contains("client_id=test_client"));
    assert!(auth_url.contains("response_type=code"));
    assert!(auth_url.contains("code_challenge="));
    assert!(auth_url.contains("code_challenge_method=S256"));
    assert!(auth_url.contains("state="));
    assert!(auth_url.contains("scope="));
}

#[test]
fn test_authorization_url_without_pkce() {
    // Test authorization URL without PKCE
    let config = OAuthConfig::new(
        "test_client".to_string(),
        "https://oauth.example.com/authorize".to_string(),
        "https://oauth.example.com/token".to_string(),
    )
    .with_pkce(false);

    let mut flow = OAuthFlow::new(config);
    let auth_url = flow.build_authorization_url().unwrap();

    // Verify PKCE parameters are not present
    assert!(!auth_url.contains("code_challenge"));
    assert!(!auth_url.contains("code_challenge_method"));
}

#[test]
fn test_callback_server_creation() {
    // Test callback server creation
    let config = ServerConfig::default();
    let server = CallbackServer::new(config);

    assert!(server.is_ok());
}

#[test]
fn test_callback_server_port_binding() {
    // Test that server can bind to a random port
    let config = ServerConfig::new(0);
    let mut server = CallbackServer::new(config).unwrap();

    let port = server.start();
    assert!(port.is_ok());
    assert!(port.unwrap() > 0);
}

#[test]
fn test_callback_server_redirect_uri() {
    // Test redirect URI generation
    let config = ServerConfig::new(0);
    let mut server = CallbackServer::new(config).unwrap();

    server.start().unwrap();
    let redirect_uri = server.redirect_uri().unwrap();

    assert!(redirect_uri.starts_with("http://127.0.0.1:"));
    assert!(redirect_uri.ends_with("/callback"));
}

#[test]
fn test_server_config_customization() {
    // Test server configuration customization
    use std::time::Duration;

    let config = ServerConfig::new(8080)
        .with_timeout(Duration::from_secs(60))
        .with_success_html("<html>Success!</html>".to_string())
        .with_error_html("<html>Error!</html>".to_string());

    assert_eq!(config.port, 8080);
    assert_eq!(config.timeout, Duration::from_secs(60));
    assert_eq!(config.success_html, "<html>Success!</html>");
    assert_eq!(config.error_html, "<html>Error!</html>");
}

#[tokio::test]
async fn test_oauth_flow_with_mock_config() {
    // Test OAuth flow creation with realistic configuration
    let config = OAuthConfig::new(
        "claude_code_client".to_string(),
        "https://auth.anthropic.com/oauth/authorize".to_string(),
        "https://auth.anthropic.com/oauth/token".to_string(),
    )
    .with_scopes(vec![
        "api.read".to_string(),
        "api.write".to_string(),
    ])
    .with_redirect_uri("http://localhost:8080/callback".to_string());

    let mut flow = OAuthFlow::new(config);

    // Generate authorization URL
    let auth_url = flow.start_flow().unwrap();

    assert!(auth_url.contains("claude_code_client"));
    assert!(auth_url.contains("api.read"));
    assert!(auth_url.contains("api.write"));
}

#[test]
fn test_pkce_verifier_length_boundaries() {
    // Test minimum length
    let pkce_min = PkceParams::new(43);
    assert_eq!(pkce_min.code_verifier.len(), 43);

    // Test maximum length
    let pkce_max = PkceParams::new(128);
    assert_eq!(pkce_max.code_verifier.len(), 128);
}

#[test]
#[should_panic(expected = "Code verifier length must be between 43 and 128 characters")]
fn test_pkce_verifier_too_short() {
    // This should panic as per RFC 7636
    PkceParams::new(42);
}

#[test]
#[should_panic(expected = "Code verifier length must be between 43 and 128 characters")]
fn test_pkce_verifier_too_long() {
    // This should panic as per RFC 7636
    PkceParams::new(129);
}

#[test]
fn test_oauth_config_additional_params() {
    // Test adding custom parameters to OAuth config
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    )
    .with_param("prompt".to_string(), "consent".to_string())
    .with_param("access_type".to_string(), "offline".to_string());

    assert_eq!(
        config.additional_params.get("prompt"),
        Some(&"consent".to_string())
    );
    assert_eq!(
        config.additional_params.get("access_type"),
        Some(&"offline".to_string())
    );
}

#[test]
fn test_multiple_authorization_urls() {
    // Test that multiple authorization URLs have different state parameters
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    );

    let mut flow1 = OAuthFlow::new(config.clone());
    let mut flow2 = OAuthFlow::new(config);

    let url1 = flow1.build_authorization_url().unwrap();
    let url2 = flow2.build_authorization_url().unwrap();

    // Extract state parameters
    let state1 = url1.split("state=").nth(1).and_then(|s| s.split('&').next());
    let state2 = url2.split("state=").nth(1).and_then(|s| s.split('&').next());

    // States should be different for CSRF protection
    assert_ne!(state1, state2);
}

/// Example: Complete OAuth flow setup for Claude API
#[test]
fn example_claude_oauth_setup() {
    let config = OAuthConfig::new(
        "my_client_id".to_string(),
        "https://auth.anthropic.com/oauth/authorize".to_string(),
        "https://auth.anthropic.com/oauth/token".to_string(),
    )
    .with_scopes(vec![
        "api.read".to_string(),
        "api.write".to_string(),
    ])
    .with_pkce(true);

    let mut flow = OAuthFlow::new(config);
    let auth_url = flow.build_authorization_url().unwrap();

    println!("Authorization URL: {}", auth_url);

    // In a real application:
    // 1. Open this URL in a browser
    // 2. User authenticates and authorizes
    // 3. Browser redirects to callback server
    // 4. Extract authorization code
    // 5. Exchange code for tokens
}

/// Example: OAuth flow with custom callback server
#[test]
fn example_custom_callback_server() {
    use std::time::Duration;

    // Configure callback server with custom settings
    let server_config = ServerConfig::new(0)
        .with_timeout(Duration::from_secs(120))
        .with_success_html(r#"
            <html>
                <body>
                    <h1>Successfully authenticated!</h1>
                    <p>You can now close this window.</p>
                </body>
            </html>
        "#.to_string());

    let mut server = CallbackServer::new(server_config).unwrap();
    let _port = server.start().unwrap();

    // Server is now listening for OAuth callbacks
}

/// Example: Confidential client (with client secret)
#[test]
fn example_confidential_client() {
    let config = OAuthConfig::new(
        "confidential_client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    )
    .with_client_secret("my_client_secret".to_string())
    .with_scopes(vec!["api.full_access".to_string()])
    .with_pkce(true); // Still recommended even with client secret

    let _flow = OAuthFlow::new(config);
}

/// Example: Public client (no client secret, PKCE required)
#[test]
fn example_public_client() {
    let config = OAuthConfig::new(
        "public_client_id".to_string(),
        "https://auth.example.com/authorize".to_string(),
        "https://auth.example.com/token".to_string(),
    )
    .with_scopes(vec!["read".to_string(), "write".to_string()])
    .with_pkce(true); // Required for public clients

    assert_eq!(config.client_secret, None);
    assert!(config.use_pkce);
}
