# OAuth Quick Start Guide

## Overview

The `claude-rust-auth` OAuth module provides secure, production-ready OAuth 2.0 implementations for Claude, OpenAI, Gemini, and Qwen providers.

## Features

✅ OAuth 2.0 Authorization Code Flow with PKCE
✅ CSRF Protection (State Parameter)
✅ Automatic Token Refresh
✅ Token Revocation
✅ HTTPS Enforcement
✅ Builder Pattern API

## Quick Examples

### Claude Authentication

```rust
use claude_code_auth::ClaudeOAuth;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Simple authentication
    let oauth = ClaudeOAuth::new("your_client_id".to_string());
    let token = oauth.authenticate().await?;

    println!("Access token: {}", token.access_token);
    Ok(())
}
```

### OpenAI Authentication

```rust
use claude_code_auth::OpenAIOAuth;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let oauth = OpenAIOAuth::new("your_client_id".to_string())
        .with_scopes(vec!["api.read".to_string(), "api.write".to_string()]);

    let token = oauth.authenticate().await?;
    Ok(())
}
```

### Gemini Authentication

```rust
use claude_code_auth::GeminiOAuth;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let oauth = GeminiOAuth::new("your_client_id".to_string())
        .with_scopes(vec![
            "https://www.googleapis.com/auth/generative-language.retriever".to_string()
        ]);

    let token = oauth.authenticate().await?;
    Ok(())
}
```

### Qwen Authentication

```rust
use claude_code_auth::QwenOAuth;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let oauth = QwenOAuth::new("your_client_id".to_string())
        .with_scopes(vec!["qwen.read".to_string(), "qwen.write".to_string()]);

    let token = oauth.authenticate().await?;
    Ok(())
}
```

## Advanced Usage

### Custom Configuration

```rust
use claude_code_auth::ClaudeOAuth;

let oauth = ClaudeOAuth::new("client_id".to_string())
    .with_scopes(vec!["read".to_string()])
    .with_redirect_uri("http://localhost:8080/callback".to_string())
    .with_client_secret("secret".to_string())  // Optional
    .with_param("prompt".to_string(), "consent".to_string());

let token = oauth.authenticate().await?;
```

### Token Refresh

```rust
use claude_code_auth::ClaudeOAuth;

let oauth = ClaudeOAuth::new("client_id".to_string());

// Refresh expired token
if let Some(refresh_token) = token.refresh_token {
    let new_token = oauth.refresh(&refresh_token).await?;
    println!("Refreshed access token: {}", new_token.access_token);
}
```

### Token Revocation

```rust
use claude_code_auth::ClaudeOAuth;

let oauth = ClaudeOAuth::new("client_id".to_string());

// Revoke token when done
oauth.revoke(&token.access_token).await?;
println!("Token revoked");
```

### Check Token Expiration

```rust
use chrono::Duration;

// Check if token is expired
if token.is_expired() {
    println!("Token is expired, refreshing...");
    let new_token = oauth.refresh(&token.refresh_token.unwrap()).await?;
}

// Check if token expires within 5 minutes
if token.expires_within(Duration::minutes(5)) {
    println!("Token expires soon, refreshing proactively...");
    let new_token = oauth.refresh(&token.refresh_token.unwrap()).await?;
}
```

### Custom HTTP Client

```rust
use claude_code_auth::ClaudeOAuth;
use reqwest::Client;
use std::time::Duration;

// Create custom HTTP client with timeout
let http_client = Client::builder()
    .timeout(Duration::from_secs(30))
    .build()?;

let oauth = ClaudeOAuth::with_client("client_id".to_string(), http_client);
let token = oauth.authenticate().await?;
```

## Error Handling

```rust
use claude_code_auth::{ClaudeOAuth, AuthError};

let oauth = ClaudeOAuth::new("client_id".to_string());

match oauth.authenticate().await {
    Ok(token) => {
        println!("Successfully authenticated!");
        println!("Access token: {}", token.access_token);
    }
    Err(AuthError::OAuthFailed(msg)) => {
        eprintln!("OAuth failed: {}", msg);
    }
    Err(AuthError::Network(msg)) => {
        eprintln!("Network error: {}", msg);
    }
    Err(AuthError::Cancelled) => {
        eprintln!("User cancelled authentication");
    }
    Err(e) => {
        eprintln!("Unexpected error: {}", e);
    }
}
```

## Provider Endpoints

### Claude
- **Authorization**: `https://auth.anthropic.com/oauth/authorize`
- **Token**: `https://auth.anthropic.com/oauth/token`
- **Revoke**: `https://auth.anthropic.com/oauth/revoke`
- **Default Scopes**: `["read", "write"]`

### OpenAI
- **Authorization**: `https://auth.openai.com/authorize`
- **Token**: `https://auth.openai.com/oauth/token`
- **Revoke**: `https://auth.openai.com/oauth/revoke`
- **Default Scopes**: `["api.read", "api.write"]`

### Gemini
- **Authorization**: `https://accounts.google.com/o/oauth2/v2/auth`
- **Token**: `https://oauth2.googleapis.com/token`
- **Revoke**: `https://oauth2.googleapis.com/revoke`
- **Default Scopes**: `["https://www.googleapis.com/auth/generative-language.retriever", "https://www.googleapis.com/auth/cloud-platform"]`

### Qwen
- **Authorization**: `https://oauth.aliyun.com/oauth/authorize`
- **Token**: `https://oauth.aliyun.com/oauth/token`
- **Revoke**: `https://oauth.aliyun.com/oauth/revoke`
- **Default Scopes**: `["qwen.read", "qwen.write"]`

## Security Best Practices

### ✅ DO

- Use PKCE (enabled by default)
- Validate tokens before use
- Refresh tokens proactively before expiration
- Revoke tokens when no longer needed
- Store tokens securely (use platform keyring)
- Use HTTPS for all communications
- Verify redirect URIs match registered URIs

### ❌ DON'T

- Disable PKCE
- Store tokens in plain text
- Share client secrets in code
- Ignore token expiration
- Use HTTP for redirect URIs
- Log access tokens
- Commit credentials to version control

## Token Response Fields

```rust
pub struct TokenResponse {
    pub access_token: String,        // Use for API requests
    pub token_type: String,           // Usually "Bearer"
    pub expires_in: Option<i64>,      // Seconds until expiration
    pub refresh_token: Option<String>, // Use to get new access token
    pub scope: Option<String>,        // Granted scopes
    pub id_token: Option<String>,     // OpenID Connect ID token
    pub issued_at: Option<DateTime<Utc>>, // When token was issued
}
```

## Common Issues

### Issue: Browser doesn't open automatically

**Solution**: The authorization URL is printed to console. Copy and paste it into your browser manually.

```rust
let oauth = ClaudeOAuth::new("client_id".to_string());
let token = oauth.authenticate().await?;
// If browser doesn't open, check console for URL
```

### Issue: Callback timeout

**Solution**: Increase timeout in server configuration or ensure browser is not blocked.

```rust
use claude_code_auth::{ServerConfig, CallbackServer};
use std::time::Duration;

let config = ServerConfig::default()
    .with_timeout(Duration::from_secs(600)); // 10 minutes

let mut server = CallbackServer::new(config)?;
```

### Issue: State parameter mismatch

**Cause**: Possible CSRF attack or session issue.

**Solution**: This is a security feature. Ensure you're using the same OAuth flow instance for the entire authentication process.

### Issue: Token expired

**Solution**: Use refresh token to get a new access token.

```rust
if token.is_expired() {
    let new_token = oauth.refresh(&token.refresh_token.unwrap()).await?;
}
```

## Testing

### Unit Tests

Run all OAuth tests:
```bash
cargo test --package claude-rust-auth --lib oauth
```

Run provider-specific tests:
```bash
cargo test --package claude-rust-auth --lib oauth::providers
```

### Example Usage

Run the OAuth providers example:
```bash
cargo run --example oauth_providers
```

## Dependencies

Add to your `Cargo.toml`:

```toml
[dependencies]
claude-rust-auth = { path = "../auth" }
tokio = { version = "1", features = ["full"] }
```

## Additional Resources

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
- [Security Audit Report](./OAUTH_SECURITY_AUDIT.md)
- [Full API Documentation](https://docs.rs/claude-rust-auth)

## Support

For issues or questions:
- Check the [Security Audit Report](./OAUTH_SECURITY_AUDIT.md)
- Review the [Phase 7 Completion Report](../../PHASE_7_COMPLETION_REPORT.md)
- See examples in `examples/oauth_providers.rs`

## License

See project LICENSE file for details.
