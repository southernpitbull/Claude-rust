//! OAuth 2.0 Authentication Module
//!
//! This module provides a complete OAuth 2.0 implementation with PKCE support
//! for secure authentication with various AI providers.
//!
//! # Components
//!
//! - **oauth**: Core OAuth 2.0 flow implementation
//! - **pkce**: PKCE (Proof Key for Code Exchange) utilities
//! - **server**: Local HTTP callback server for OAuth redirects
//! - **providers**: Provider-specific OAuth configurations
//!
//! # Security Features
//!
//! - PKCE with S256 challenge method (RFC 7636)
//! - CSRF protection via state parameter validation
//! - Secure token storage
//! - Automatic token refresh
//! - Token revocation support
//!
//! # Example
//!
//! ```no_run
//! use claude_rust_auth::oauth::providers::ClaudeOAuth;
//!
//! # async fn example() -> Result<(), Box<dyn std::error::Error>> {
//! // Initialize OAuth flow for Claude
//! let oauth = ClaudeOAuth::new("your_client_id".to_string())
//!     .with_scopes(vec!["read".to_string(), "write".to_string()]);
//!
//! // Run the authentication flow
//! let token = oauth.authenticate().await?;
//!
//! println!("Access token: {}", token.access_token);
//! # Ok(())
//! # }
//! ```

mod oauth;
mod pkce;
mod providers;
mod server;

// Re-export core types
pub use oauth::{OAuthConfig, OAuthError, OAuthFlow, TokenResponse};
pub use pkce::{
    generate_code_challenge, generate_code_verifier, verify_challenge, ChallengeMethod, PkceParams,
};
pub use providers::{
    claude_endpoints, gemini_endpoints, openai_endpoints, qwen_endpoints, ClaudeOAuth, GeminiOAuth,
    OpenAIOAuth, QwenOAuth, OllamaProvider, LMStudioProvider, OAuthProvider,
};
pub use server::{CallbackResult, CallbackServer, ServerConfig};
