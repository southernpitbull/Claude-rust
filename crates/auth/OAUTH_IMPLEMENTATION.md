# OAuth 2.0 Implementation with PKCE Support

This document describes the OAuth 2.0 authorization code flow implementation with Proof Key for Code Exchange (PKCE) support in the `claude-code-auth` crate.

## Overview

The implementation provides a complete OAuth 2.0 authorization code flow with:

- **PKCE Support** (RFC 7636) - Proof Key for Code Exchange for enhanced security
- **Local Callback Server** - Built-in HTTP server for OAuth redirects
- **Token Management** - Automatic token refresh and expiration handling
- **State Validation** - CSRF protection via state parameter
- **Multiple Providers** - Configurable for any OAuth 2.0 provider

## Architecture

### Core Components

1. **`pkce.rs`** - PKCE implementation
   - Code verifier generation (random string)
   - Code challenge generation (SHA256 hash)
   - Challenge method support (S256, plain)

2. **`server.rs`** - Local HTTP callback server
   - Lightweight HTTP server for OAuth callbacks
   - Automatic shutdown after receiving callback
   - Customizable success/error pages

3. **`oauth.rs`** - Main OAuth flow coordinator
   - Authorization URL building
   - Token exchange handling
   - Token refresh logic
   - State parameter validation

## Usage

### Basic OAuth Flow

```rust
use claude_code_auth::{OAuthConfig, OAuthFlow};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Configure OAuth for your provider
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.provider.com/authorize".to_string(),
        "https://auth.provider.com/token".to_string(),
    )
    .with_scopes(vec!["read".to_string(), "write".to_string()])
    .with_pkce(true);

    // Create OAuth flow
    let mut flow = OAuthFlow::new(config);

    // Run complete flow (opens browser, waits for callback, exchanges code)
    let token = flow.run_flow().await?;

    println!("Access Token: {}", token.access_token);
    println!("Token Type: {}", token.token_type);

    Ok(())
}
```

### Manual Flow (More Control)

```rust
use claude_code_auth::{OAuthConfig, OAuthFlow, ServerConfig, CallbackServer};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.provider.com/authorize".to_string(),
        "https://auth.provider.com/token".to_string(),
    );

    let mut flow = OAuthFlow::new(config);

    // Step 1: Generate authorization URL
    let auth_url = flow.build_authorization_url()?;
    println!("Visit: {}", auth_url);

    // Step 2: Start callback server
    let mut server = CallbackServer::new(ServerConfig::default())?;
    server.start()?;

    // Step 3: Wait for callback
    let callback = server.wait_for_callback()?;

    // Step 4: Exchange code for token
    let token = flow.exchange_code(&callback.code).await?;

    println!("Access Token: {}", token.access_token);

    Ok(())
}
```

### Token Refresh

```rust
use claude_code_auth::{OAuthConfig, OAuthFlow};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = OAuthConfig::new(
        "client_id".to_string(),
        "https://auth.provider.com/authorize".to_string(),
        "https://auth.provider.com/token".to_string(),
    );

    let flow = OAuthFlow::new(config);

    // Refresh an existing token
    let refresh_token = "existing_refresh_token";
    let new_token = flow.refresh_token(refresh_token).await?;

    println!("New Access Token: {}", new_token.access_token);

    Ok(())
}
```

## PKCE Implementation

### What is PKCE?

PKCE (Proof Key for Code Exchange) is an extension to OAuth 2.0 that provides additional security for public clients (like mobile apps and SPAs) by preventing authorization code interception attacks.

### How It Works

1. **Code Verifier Generation**: A cryptographically random string (43-128 characters)
2. **Code Challenge Creation**: SHA256 hash of the verifier, base64-url-encoded
3. **Authorization Request**: Include code_challenge and code_challenge_method
4. **Token Exchange**: Include code_verifier to prove possession

### Example

```rust
use claude_code_auth::pkce::{PkceParams, ChallengeMethod};

// Generate PKCE parameters with S256 method
let pkce = PkceParams::new(64);

println!("Code Verifier: {}", pkce.code_verifier);
println!("Code Challenge: {}", pkce.code_challenge);
println!("Method: {}", pkce.challenge_method);

// Generate with plain method (not recommended)
let pkce_plain = PkceParams::new_with_method(64, ChallengeMethod::Plain);
```

## Callback Server

### Configuration

```rust
use claude_code_auth::ServerConfig;
use std::time::Duration;

let config = ServerConfig::new(8080)  // Specific port, or 0 for random
    .with_timeout(Duration::from_secs(300))  // 5 minutes
    .with_success_html("<html>Success!</html>".to_string())
    .with_error_html("<html>Error!</html>".to_string());
```

### Features

- **Auto Port Selection**: Use port 0 to bind to any available port
- **Timeout Support**: Configurable timeout for waiting for callbacks
- **Custom HTML**: Customize success and error pages
- **Graceful Shutdown**: Automatically stops after receiving callback

## Provider Examples

### Claude (Anthropic)

```rust
let config = OAuthConfig::new(
    "claude_client_id".to_string(),
    "https://auth.anthropic.com/oauth/authorize".to_string(),
    "https://auth.anthropic.com/oauth/token".to_string(),
)
.with_scopes(vec!["api.read".to_string(), "api.write".to_string()])
.with_pkce(true);
```

### GitHub

```rust
let config = OAuthConfig::new(
    "github_client_id".to_string(),
    "https://github.com/login/oauth/authorize".to_string(),
    "https://github.com/login/oauth/access_token".to_string(),
)
.with_scopes(vec!["user".to_string(), "repo".to_string()])
.with_pkce(true);
```

### Google

```rust
let config = OAuthConfig::new(
    "google_client_id".to_string(),
    "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
    "https://oauth2.googleapis.com/token".to_string(),
)
.with_scopes(vec![
    "https://www.googleapis.com/auth/userinfo.email".to_string(),
    "https://www.googleapis.com/auth/userinfo.profile".to_string(),
])
.with_param("access_type".to_string(), "offline".to_string())
.with_pkce(true);
```

### Microsoft

```rust
let config = OAuthConfig::new(
    "microsoft_client_id".to_string(),
    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize".to_string(),
    "https://login.microsoftonline.com/common/oauth2/v2.0/token".to_string(),
)
.with_scopes(vec![
    "openid".to_string(),
    "profile".to_string(),
    "email".to_string(),
])
.with_pkce(true);
```

## Token Management

### Token Response

```rust
use claude_code_auth::TokenResponse;

// Token response contains:
struct TokenResponse {
    access_token: String,        // Access token for API requests
    token_type: String,          // Usually "Bearer"
    expires_in: Option<i64>,     // Token expiration in seconds
    refresh_token: Option<String>, // For refreshing tokens
    scope: Option<String>,       // Granted scopes
    id_token: Option<String>,    // OpenID Connect ID token
    // ... additional fields
}
```

### Checking Token Expiration

```rust
use chrono::Duration;

let token = /* ... obtain token ... */;

// Check if expired
if token.is_expired() {
    println!("Token has expired");
}

// Check if expires within 5 minutes
if token.expires_within(Duration::minutes(5)) {
    println!("Token will expire soon");
    // Refresh token
}

// Get expiration time
if let Some(expires_at) = token.expires_at() {
    println!("Token expires at: {}", expires_at);
}
```

## Security Considerations

### PKCE

- **Always use PKCE** for public clients (mobile apps, SPAs)
- **Use S256 method** instead of plain (more secure)
- **Never reuse verifiers** - generate new ones for each flow

### State Parameter

- Automatically generated UUID for CSRF protection
- Validated on callback to prevent state manipulation
- Unique per authorization request

### Client Secret

- Only use for confidential clients (server-side apps)
- Never expose in client-side code
- Store securely (environment variables, secret management)

### Redirect URI

- Use `http://localhost` or `http://127.0.0.1` for local development
- Use HTTPS in production
- Register exact redirect URIs with OAuth provider

## Error Handling

```rust
use claude_code_auth::{OAuthFlow, AuthError};

match flow.run_flow().await {
    Ok(token) => {
        // Success
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
        eprintln!("Other error: {}", e);
    }
}
```

## Testing

### Unit Tests

All modules include comprehensive unit tests:

```bash
cargo test --package claude-code-auth
```

### Integration Tests

```bash
cargo test --package claude-code-auth --test oauth_integration_tests
```

### Examples

```bash
cargo run --package claude-code-auth --example oauth_flow_example
```

## RFC Compliance

This implementation follows:

- **RFC 6749**: The OAuth 2.0 Authorization Framework
- **RFC 7636**: Proof Key for Code Exchange by OAuth Public Clients

## Dependencies

- `reqwest` - HTTP client for token requests
- `sha2` - SHA256 hashing for PKCE
- `base64` - Base64 encoding for PKCE challenges
- `rand` - Cryptographic random generation
- `uuid` - State parameter generation
- `url` - URL parsing and manipulation
- `chrono` - Token expiration handling
- `tokio` - Async runtime

## Performance

- **Lightweight**: Minimal dependencies
- **Async**: Non-blocking operations with tokio
- **Fast**: Efficient PKCE generation and validation
- **Memory Efficient**: Streams HTTP responses

## Future Enhancements

- [ ] OpenID Connect support
- [ ] Device authorization grant (RFC 8628)
- [ ] Client credentials flow
- [ ] Token introspection (RFC 7662)
- [ ] Token revocation (RFC 7009)
- [ ] JWT token validation
- [ ] Multi-provider session management

## License

MIT License - See LICENSE file for details
