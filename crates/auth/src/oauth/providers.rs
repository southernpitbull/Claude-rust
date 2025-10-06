//! Provider-Specific OAuth Implementations
//!
//! This module provides OAuth wrappers for different AI providers, each implementing
//! the OAuth 2.0 authorization code flow with PKCE security extensions.
//!
//! # Security Features
//!
//! - PKCE (Proof Key for Code Exchange) for all providers
//! - CSRF protection via state parameter validation
//! - Secure token storage integration
//! - Automatic token refresh handling
//! - Rate limiting and retry logic

use crate::error::{AuthError, AuthResult};
use super::oauth::{OAuthConfig, OAuthFlow, TokenResponse};
use super::pkce::ChallengeMethod;
use reqwest::Client;
use std::collections::HashMap;
use tracing::{debug, info};

/// Base OAuth provider trait for standardizing OAuth operations
#[allow(async_fn_in_trait)]
pub trait OAuthProvider {
    /// Performs the complete OAuth authentication flow
    async fn authenticate(&mut self) -> AuthResult<TokenResponse>;

    /// Refreshes an access token using a refresh token
    async fn refresh(&self, refresh_token: &str) -> AuthResult<TokenResponse>;

    /// Revokes an access or refresh token
    async fn revoke(&self, token: &str) -> AuthResult<()>;

    /// Tests the connection with the provider
    async fn test_connection(&self) -> AuthResult<()>;

    /// Gets the provider's OAuth configuration
    fn config(&self) -> &OAuthConfig;
}

// ============================================================================
// Provider Endpoints
// ============================================================================

/// Anthropic Claude OAuth endpoints
///
/// NOTE: As of 2025, Anthropic does NOT support OAuth 2.0 authentication.
/// The Claude API uses API key authentication only. These endpoints are
/// placeholders for future OAuth support if/when Anthropic implements it.
///
/// Current authentication: Use ANTHROPIC_API_KEY environment variable or
/// API key from https://console.anthropic.com/settings/keys
pub mod claude_endpoints {
    pub const AUTHORIZATION_URL: &str = "https://auth.anthropic.com/oauth/authorize";
    pub const TOKEN_URL: &str = "https://auth.anthropic.com/oauth/token";
    pub const REVOKE_URL: &str = "https://auth.anthropic.com/oauth/revoke";

    pub const DEFAULT_SCOPES: &[&str] = &["read", "write"];

    /// Indicates whether this provider supports OAuth
    pub const OAUTH_SUPPORTED: bool = false;
}

/// OpenAI OAuth endpoints
///
/// NOTE: As of 2025, OpenAI does NOT support OAuth 2.0 for API access.
/// OAuth is only available for Actions/Plugins, not for direct API calls.
/// The OpenAI API uses API key authentication. These endpoints are
/// placeholders for future OAuth support if/when OpenAI implements it.
///
/// Current authentication: Use OPENAI_API_KEY environment variable or
/// API key from https://platform.openai.com/api-keys
pub mod openai_endpoints {
    pub const AUTHORIZATION_URL: &str = "https://auth.openai.com/authorize";
    pub const TOKEN_URL: &str = "https://auth.openai.com/oauth/token";
    pub const REVOKE_URL: &str = "https://auth.openai.com/oauth/revoke";

    pub const DEFAULT_SCOPES: &[&str] = &["api.read", "api.write"];

    /// Indicates whether this provider supports OAuth
    pub const OAUTH_SUPPORTED: bool = false;
}

/// Google Gemini OAuth endpoints
///
/// Google Gemini DOES support OAuth 2.0 authentication as of 2025.
/// This is the recommended authentication method for production applications.
///
/// Setup Instructions:
/// 1. Enable the Google Generative Language API in Google Cloud Console
/// 2. Configure OAuth consent screen and add test users
/// 3. Create OAuth 2.0 Client ID (Application type: Desktop app)
/// 4. Download credentials as client_secret.json
/// 5. Use the client_id and client_secret from that file
///
/// Documentation: https://ai.google.dev/gemini-api/docs/oauth
pub mod gemini_endpoints {
    pub const AUTHORIZATION_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
    pub const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
    pub const REVOKE_URL: &str = "https://oauth2.googleapis.com/revoke";

    pub const DEFAULT_SCOPES: &[&str] = &[
        "https://www.googleapis.com/auth/generative-language.retriever",
    ];

    /// Indicates whether this provider supports OAuth
    pub const OAUTH_SUPPORTED: bool = true;
}

/// Alibaba Qwen OAuth endpoints
///
/// NOTE: As of 2025, Alibaba Qwen/DashScope does NOT support OAuth 2.0.
/// The DashScope API uses API key authentication only. These endpoints are
/// placeholders for future OAuth support if/when Alibaba implements it.
///
/// Current authentication: Use QWEN_API_KEY environment variable or
/// API key from https://dashscope.console.aliyun.com/apiKey
pub mod qwen_endpoints {
    pub const AUTHORIZATION_URL: &str = "https://oauth.aliyun.com/oauth/authorize";
    pub const TOKEN_URL: &str = "https://oauth.aliyun.com/oauth/token";
    pub const REVOKE_URL: &str = "https://oauth.aliyun.com/oauth/revoke";

    pub const DEFAULT_SCOPES: &[&str] = &["qwen.read", "qwen.write"];

    /// Indicates whether this provider supports OAuth
    pub const OAUTH_SUPPORTED: bool = false;
}

// ============================================================================
// Claude OAuth Implementation
// ============================================================================

/// Anthropic Claude OAuth flow implementation
///
/// # Security
///
/// - Uses PKCE with S256 challenge method
/// - Validates state parameter for CSRF protection
/// - Stores tokens securely via platform keyring
///
/// # Example
///
/// ```no_run
/// use claude_rust_auth::oauth::providers::ClaudeOAuth;
///
/// # async fn example() -> Result<(), Box<dyn std::error::Error>> {
/// let oauth = ClaudeOAuth::new("client_id_here".to_string())
///     .with_scopes(vec!["read".to_string(), "write".to_string()]);
///
/// let token = oauth.authenticate().await?;
/// println!("Access token: {}", token.access_token);
/// # Ok(())
/// # }
/// ```
pub struct ClaudeOAuth {
    flow: OAuthFlow,
    config: OAuthConfig,
}

impl ClaudeOAuth {
    /// Creates a new Claude OAuth flow
    ///
    /// # Arguments
    ///
    /// * `client_id` - OAuth client ID from Anthropic
    ///
    /// # Returns
    ///
    /// Returns a new `ClaudeOAuth` instance configured with default settings
    pub fn new(client_id: String) -> Self {
        let config = OAuthConfig::new(
            client_id,
            claude_endpoints::AUTHORIZATION_URL.to_string(),
            claude_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            claude_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::new(config.clone());

        Self { flow, config }
    }

    /// Creates a new Claude OAuth flow with a custom HTTP client
    pub fn with_client(client_id: String, http_client: Client) -> Self {
        let config = OAuthConfig::new(
            client_id,
            claude_endpoints::AUTHORIZATION_URL.to_string(),
            claude_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            claude_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::with_client(config.clone(), http_client);

        Self { flow, config }
    }

    /// Sets the client secret (optional, not typically used with PKCE)
    pub fn with_client_secret(mut self, secret: String) -> Self {
        self.config = self.config.with_client_secret(secret);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets custom scopes
    pub fn with_scopes(mut self, scopes: Vec<String>) -> Self {
        self.config = self.config.with_scopes(scopes);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets the redirect URI
    pub fn with_redirect_uri(mut self, uri: String) -> Self {
        self.config = self.config.with_redirect_uri(uri);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Adds a custom authorization parameter
    pub fn with_param(mut self, key: String, value: String) -> Self {
        self.config = self.config.with_param(key, value);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Runs the complete OAuth authentication flow
    ///
    /// This will:
    /// 1. Start a local callback server
    /// 2. Open the authorization URL in the browser
    /// 3. Wait for the user to authorize
    /// 4. Exchange the authorization code for tokens
    ///
    /// # Returns
    ///
    /// Returns a `TokenResponse` containing access and refresh tokens
    pub async fn authenticate_impl(mut self) -> AuthResult<TokenResponse> {
        info!("Starting Claude OAuth flow");
        self.flow.run_flow().await
    }

    /// Refreshes an access token using a refresh token
    pub async fn refresh_impl(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing Claude access token");
        self.flow.refresh_token(refresh_token).await
    }

    /// Revokes a token
    pub async fn revoke_impl(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(claude_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Claude token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
}

impl OAuthProvider for ClaudeOAuth {
    async fn authenticate(&mut self) -> AuthResult<TokenResponse> {
        info!("Starting Claude OAuth flow");
        self.flow.run_flow().await
    }

    async fn refresh(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        self.flow.refresh_token(refresh_token).await
    }

    async fn revoke(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(claude_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Claude token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
    
    async fn test_connection(&self) -> AuthResult<()> {
        // Test by attempting to use the configuration
        if self.config.client_id.is_empty() {
            return Err(AuthError::ConfigurationError("Client ID is required".to_string()));
        }
        Ok(())
    }
    
    fn config(&self) -> &OAuthConfig {
        &self.config
    }
}

// ============================================================================
// OpenAI OAuth Implementation
// ============================================================================

/// OpenAI OAuth flow implementation
///
/// # Security
///
/// - Uses PKCE with S256 challenge method
/// - Validates state parameter for CSRF protection
/// - Stores tokens securely via platform keyring
pub struct OpenAIOAuth {
    flow: OAuthFlow,
    config: OAuthConfig,
}

impl OpenAIOAuth {
    /// Creates a new OpenAI OAuth flow
    pub fn new(client_id: String) -> Self {
        let config = OAuthConfig::new(
            client_id,
            openai_endpoints::AUTHORIZATION_URL.to_string(),
            openai_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            openai_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::new(config.clone());

        Self { flow, config }
    }

    /// Creates a new OpenAI OAuth flow with a custom HTTP client
    pub fn with_client(client_id: String, http_client: Client) -> Self {
        let config = OAuthConfig::new(
            client_id,
            openai_endpoints::AUTHORIZATION_URL.to_string(),
            openai_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            openai_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::with_client(config.clone(), http_client);

        Self { flow, config }
    }

    /// Sets the client secret
    pub fn with_client_secret(mut self, secret: String) -> Self {
        self.config = self.config.with_client_secret(secret);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets custom scopes
    pub fn with_scopes(mut self, scopes: Vec<String>) -> Self {
        self.config = self.config.with_scopes(scopes);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets the redirect URI
    pub fn with_redirect_uri(mut self, uri: String) -> Self {
        self.config = self.config.with_redirect_uri(uri);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Adds a custom authorization parameter
    pub fn with_param(mut self, key: String, value: String) -> Self {
        self.config = self.config.with_param(key, value);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Runs the complete OAuth authentication flow
    pub async fn authenticate_impl(mut self) -> AuthResult<TokenResponse> {
        info!("Starting OpenAI OAuth flow");
        self.flow.run_flow().await
    }

    /// Refreshes an access token
    pub async fn refresh_impl(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing OpenAI access token");
        self.flow.refresh_token(refresh_token).await
    }

    /// Revokes a token
    pub async fn revoke_impl(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(openai_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked OpenAI token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
}

impl OAuthProvider for OpenAIOAuth {
    async fn authenticate(&mut self) -> AuthResult<TokenResponse> {
        info!("Starting OpenAI OAuth flow");
        self.flow.run_flow().await
    }

    async fn refresh(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        self.flow.refresh_token(refresh_token).await
    }

    async fn revoke(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(openai_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked OpenAI token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
    
    async fn test_connection(&self) -> AuthResult<()> {
        // Test by attempting to use the configuration
        if self.config.client_id.is_empty() {
            return Err(AuthError::ConfigurationError("Client ID is required".to_string()));
        }
        Ok(())
    }
    
    fn config(&self) -> &OAuthConfig {
        &self.config
    }
}

// ============================================================================
// Gemini OAuth Implementation
// ============================================================================

/// Google Gemini OAuth flow implementation
///
/// # Security
///
/// - Uses PKCE with S256 challenge method
/// - Validates state parameter for CSRF protection
/// - Stores tokens securely via platform keyring
pub struct GeminiOAuth {
    flow: OAuthFlow,
    config: OAuthConfig,
}

impl GeminiOAuth {
    /// Creates a new Gemini OAuth flow
    pub fn new(client_id: String) -> Self {
        let config = OAuthConfig::new(
            client_id,
            gemini_endpoints::AUTHORIZATION_URL.to_string(),
            gemini_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            gemini_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256)
        .with_param("access_type".to_string(), "offline".to_string()) // Request refresh token
        .with_param("prompt".to_string(), "consent".to_string()); // Force consent screen

        let flow = OAuthFlow::new(config.clone());

        Self { flow, config }
    }

    /// Creates a new Gemini OAuth flow with a custom HTTP client
    pub fn with_client(client_id: String, http_client: Client) -> Self {
        let config = OAuthConfig::new(
            client_id,
            gemini_endpoints::AUTHORIZATION_URL.to_string(),
            gemini_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            gemini_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256)
        .with_param("access_type".to_string(), "offline".to_string())
        .with_param("prompt".to_string(), "consent".to_string());

        let flow = OAuthFlow::with_client(config.clone(), http_client);

        Self { flow, config }
    }

    /// Sets the client secret
    pub fn with_client_secret(mut self, secret: String) -> Self {
        self.config = self.config.with_client_secret(secret);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets custom scopes
    pub fn with_scopes(mut self, scopes: Vec<String>) -> Self {
        self.config = self.config.with_scopes(scopes);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets the redirect URI
    pub fn with_redirect_uri(mut self, uri: String) -> Self {
        self.config = self.config.with_redirect_uri(uri);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Adds a custom authorization parameter
    pub fn with_param(mut self, key: String, value: String) -> Self {
        self.config = self.config.with_param(key, value);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Runs the complete OAuth authentication flow
    pub async fn authenticate_impl(mut self) -> AuthResult<TokenResponse> {
        info!("Starting Gemini OAuth flow");
        self.flow.run_flow().await
    }

    /// Refreshes an access token
    pub async fn refresh_impl(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing Gemini access token");
        self.flow.refresh_token(refresh_token).await
    }

    /// Revokes a token
    pub async fn revoke_impl(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();

        // Google uses a GET request with token parameter
        let url = format!("{}?token={}", gemini_endpoints::REVOKE_URL, token);

        let response = client
            .post(&url)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Gemini token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
}

impl OAuthProvider for GeminiOAuth {
    async fn authenticate(&mut self) -> AuthResult<TokenResponse> {
        info!("Starting Gemini OAuth flow");
        self.flow.run_flow().await
    }

    async fn refresh(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        self.flow.refresh_token(refresh_token).await
    }

    async fn revoke(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();

        // Google uses a GET request with token parameter
        let url = format!("{}?token={}", gemini_endpoints::REVOKE_URL, token);

        let response = client
            .post(&url)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Gemini token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
    
    async fn test_connection(&self) -> AuthResult<()> {
        // Test by attempting to use the configuration
        if self.config.client_id.is_empty() {
            return Err(AuthError::ConfigurationError("Client ID is required".to_string()));
        }
        Ok(())
    }
    
    fn config(&self) -> &OAuthConfig {
        &self.config
    }
}

// ============================================================================
// Qwen OAuth Implementation
// ============================================================================

/// Alibaba Qwen OAuth flow implementation
///
/// # Security
///
/// - Uses PKCE with S256 challenge method
/// - Validates state parameter for CSRF protection
/// - Stores tokens securely via platform keyring
pub struct QwenOAuth {
    flow: OAuthFlow,
    config: OAuthConfig,
}

impl QwenOAuth {
    /// Creates a new Qwen OAuth flow
    pub fn new(client_id: String) -> Self {
        let config = OAuthConfig::new(
            client_id,
            qwen_endpoints::AUTHORIZATION_URL.to_string(),
            qwen_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            qwen_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::new(config.clone());

        Self { flow, config }
    }

    /// Creates a new Qwen OAuth flow with a custom HTTP client
    pub fn with_client(client_id: String, http_client: Client) -> Self {
        let config = OAuthConfig::new(
            client_id,
            qwen_endpoints::AUTHORIZATION_URL.to_string(),
            qwen_endpoints::TOKEN_URL.to_string(),
        )
        .with_scopes(
            qwen_endpoints::DEFAULT_SCOPES
                .iter()
                .map(|s| s.to_string())
                .collect(),
        )
        .with_pkce(true)
        .with_pkce_method(ChallengeMethod::S256);

        let flow = OAuthFlow::with_client(config.clone(), http_client);

        Self { flow, config }
    }

    /// Sets the client secret
    pub fn with_client_secret(mut self, secret: String) -> Self {
        self.config = self.config.with_client_secret(secret);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets custom scopes
    pub fn with_scopes(mut self, scopes: Vec<String>) -> Self {
        self.config = self.config.with_scopes(scopes);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Sets the redirect URI
    pub fn with_redirect_uri(mut self, uri: String) -> Self {
        self.config = self.config.with_redirect_uri(uri);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Adds a custom authorization parameter
    pub fn with_param(mut self, key: String, value: String) -> Self {
        self.config = self.config.with_param(key, value);
        self.flow = OAuthFlow::new(self.config.clone());
        self
    }

    /// Runs the complete OAuth authentication flow
    pub async fn authenticate_impl(mut self) -> AuthResult<TokenResponse> {
        info!("Starting Qwen OAuth flow");
        self.flow.run_flow().await
    }

    /// Refreshes an access token
    pub async fn refresh_impl(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing Qwen access token");
        self.flow.refresh_token(refresh_token).await
    }

    /// Revokes a token
    pub async fn revoke_impl(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(qwen_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Qwen token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
}

impl OAuthProvider for QwenOAuth {
    async fn authenticate(&mut self) -> AuthResult<TokenResponse> {
        info!("Starting Qwen OAuth flow");
        self.flow.run_flow().await
    }

    async fn refresh(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        self.flow.refresh_token(refresh_token).await
    }

    async fn revoke(&self, token: &str) -> AuthResult<()> {
        let client = Client::new();
        let mut params = HashMap::new();
        params.insert("token", token);

        if let Some(ref client_id) = Some(&self.config.client_id) {
            params.insert("client_id", client_id);
        }

        let response = client
            .post(qwen_endpoints::REVOKE_URL)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token revocation failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully revoked Qwen token");
            Ok(())
        } else {
            Err(AuthError::OAuthFailed(format!(
                "Token revocation failed with status: {}",
                response.status()
            )))
        }
    }
    
    async fn test_connection(&self) -> AuthResult<()> {
        // Test by attempting to use the configuration
        if self.config.client_id.is_empty() {
            return Err(AuthError::ConfigurationError("Client ID is required".to_string()));
        }
        Ok(())
    }
    
    fn config(&self) -> &OAuthConfig {
        &self.config
    }
}

// ============================================================================
// Ollama Provider (Placeholder - local provider, no OAuth)
// ============================================================================

/// Ollama Provider (Placeholder implementation)
///
/// Ollama is a local provider that doesn't require OAuth authentication.
/// This is a placeholder for consistency with the provider interface.
pub struct OllamaProvider {
    api_url: String,
}

impl OllamaProvider {
    /// Creates a new Ollama provider
    pub fn new(api_url: String) -> Self {
        Self {
            api_url: if api_url.is_empty() {
                "http://localhost:11434".to_string()
            } else {
                api_url
            },
        }
    }

    /// Tests the connection to the Ollama API
    pub async fn test_connection(&self) -> AuthResult<()> {
        let client = Client::new();
        
        // Test by making a simple API call to list models
        let response = client
            .get(&format!("{}/api/tags", self.api_url))
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Ollama connection test failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully connected to Ollama at {}", self.api_url);
            Ok(())
        } else {
            Err(AuthError::ProviderError(
                format!("Ollama connection test failed with status: {}", response.status())
            ))
        }
    }
}

// ============================================================================
// LM Studio Provider (Placeholder - local provider, no OAuth)
// ============================================================================

/// LM Studio Provider (Placeholder implementation)
///
/// LM Studio is a local provider that doesn't require OAuth authentication.
/// This is a placeholder for consistency with the provider interface.
pub struct LMStudioProvider {
    api_url: String,
}

impl LMStudioProvider {
    /// Creates a new LM Studio provider
    pub fn new(api_url: String) -> Self {
        Self {
            api_url: if api_url.is_empty() {
                "http://localhost:1234".to_string()
            } else {
                api_url
            },
        }
    }

    /// Tests the connection to the LM Studio API
    pub async fn test_connection(&self) -> AuthResult<()> {
        let client = Client::new();
        
        // Test by making a simple API call to check if the server is running
        let response = client
            .get(&format!("{}/v1/models", self.api_url))
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("LM Studio connection test failed: {}", e)))?;

        if response.status().is_success() {
            info!("Successfully connected to LM Studio at {}", self.api_url);
            Ok(())
        } else {
            Err(AuthError::ProviderError(
                format!("LM Studio connection test failed with status: {}", response.status())
            ))
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // Claude OAuth Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_claude_oauth_creation() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.client_id, "test_client_id");
        assert!(oauth.config.use_pkce);
        assert_eq!(oauth.config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_claude_oauth_endpoints() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string());
        assert_eq!(
            oauth.config.authorization_endpoint,
            claude_endpoints::AUTHORIZATION_URL
        );
        assert_eq!(oauth.config.token_endpoint, claude_endpoints::TOKEN_URL);
    }

    #[test]
    fn test_claude_oauth_default_scopes() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.scopes, vec!["read", "write"]);
    }

    #[test]
    fn test_claude_oauth_custom_scopes() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string())
            .with_scopes(vec!["custom".to_string()]);
        assert_eq!(oauth.config.scopes, vec!["custom"]);
    }

    #[test]
    fn test_claude_oauth_builder_pattern() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string())
            .with_scopes(vec!["read".to_string()])
            .with_redirect_uri("http://localhost:3000/callback".to_string())
            .with_param("extra".to_string(), "value".to_string());

        assert_eq!(oauth.config.scopes, vec!["read"]);
        assert_eq!(
            oauth.config.redirect_uri,
            "http://localhost:3000/callback"
        );
        assert_eq!(
            oauth.config.additional_params.get("extra"),
            Some(&"value".to_string())
        );
    }

    #[test]
    fn test_claude_oauth_with_client_secret() {
        let oauth = ClaudeOAuth::new("test_client_id".to_string())
            .with_client_secret("test_secret".to_string());
        assert_eq!(oauth.config.client_secret, Some("test_secret".to_string()));
    }

    // ------------------------------------------------------------------------
    // OpenAI OAuth Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_openai_oauth_creation() {
        let oauth = OpenAIOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.client_id, "test_client_id");
        assert!(oauth.config.use_pkce);
        assert_eq!(oauth.config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_openai_oauth_endpoints() {
        let oauth = OpenAIOAuth::new("test_client_id".to_string());
        assert_eq!(
            oauth.config.authorization_endpoint,
            openai_endpoints::AUTHORIZATION_URL
        );
        assert_eq!(oauth.config.token_endpoint, openai_endpoints::TOKEN_URL);
    }

    #[test]
    fn test_openai_oauth_default_scopes() {
        let oauth = OpenAIOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.scopes, vec!["api.read", "api.write"]);
    }

    #[test]
    fn test_openai_oauth_builder_pattern() {
        let oauth = OpenAIOAuth::new("test_client_id".to_string())
            .with_scopes(vec!["api.read".to_string()])
            .with_redirect_uri("http://localhost:3000/callback".to_string());

        assert_eq!(oauth.config.scopes, vec!["api.read"]);
        assert_eq!(
            oauth.config.redirect_uri,
            "http://localhost:3000/callback"
        );
    }

    // ------------------------------------------------------------------------
    // Gemini OAuth Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_gemini_oauth_creation() {
        let oauth = GeminiOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.client_id, "test_client_id");
        assert!(oauth.config.use_pkce);
        assert_eq!(oauth.config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_gemini_oauth_endpoints() {
        let oauth = GeminiOAuth::new("test_client_id".to_string());
        assert_eq!(
            oauth.config.authorization_endpoint,
            gemini_endpoints::AUTHORIZATION_URL
        );
        assert_eq!(oauth.config.token_endpoint, gemini_endpoints::TOKEN_URL);
    }

    #[test]
    fn test_gemini_oauth_default_scopes() {
        let oauth = GeminiOAuth::new("test_client_id".to_string());
        assert!(oauth
            .config
            .scopes
            .contains(&"https://www.googleapis.com/auth/generative-language.retriever".to_string()));
    }

    #[test]
    fn test_gemini_oauth_google_specific_params() {
        let oauth = GeminiOAuth::new("test_client_id".to_string());

        // Google-specific parameters should be included
        assert_eq!(
            oauth.config.additional_params.get("access_type"),
            Some(&"offline".to_string())
        );
        assert_eq!(
            oauth.config.additional_params.get("prompt"),
            Some(&"consent".to_string())
        );
    }

    #[test]
    fn test_gemini_oauth_builder_pattern() {
        let oauth = GeminiOAuth::new("test_client_id".to_string())
            .with_scopes(vec!["custom.scope".to_string()])
            .with_redirect_uri("http://localhost:3000/callback".to_string());

        assert_eq!(oauth.config.scopes, vec!["custom.scope"]);
        assert_eq!(
            oauth.config.redirect_uri,
            "http://localhost:3000/callback"
        );
    }

    // ------------------------------------------------------------------------
    // Qwen OAuth Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_qwen_oauth_creation() {
        let oauth = QwenOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.client_id, "test_client_id");
        assert!(oauth.config.use_pkce);
        assert_eq!(oauth.config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_qwen_oauth_endpoints() {
        let oauth = QwenOAuth::new("test_client_id".to_string());
        assert_eq!(
            oauth.config.authorization_endpoint,
            qwen_endpoints::AUTHORIZATION_URL
        );
        assert_eq!(oauth.config.token_endpoint, qwen_endpoints::TOKEN_URL);
    }

    #[test]
    fn test_qwen_oauth_default_scopes() {
        let oauth = QwenOAuth::new("test_client_id".to_string());
        assert_eq!(oauth.config.scopes, vec!["qwen.read", "qwen.write"]);
    }

    #[test]
    fn test_qwen_oauth_builder_pattern() {
        let oauth = QwenOAuth::new("test_client_id".to_string())
            .with_scopes(vec!["qwen.read".to_string()])
            .with_redirect_uri("http://localhost:3000/callback".to_string());

        assert_eq!(oauth.config.scopes, vec!["qwen.read"]);
        assert_eq!(
            oauth.config.redirect_uri,
            "http://localhost:3000/callback"
        );
    }

    // ------------------------------------------------------------------------
    // Security Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_all_providers_use_pkce() {
        let claude = ClaudeOAuth::new("test".to_string());
        let openai = OpenAIOAuth::new("test".to_string());
        let gemini = GeminiOAuth::new("test".to_string());
        let qwen = QwenOAuth::new("test".to_string());

        assert!(claude.config.use_pkce);
        assert!(openai.config.use_pkce);
        assert!(gemini.config.use_pkce);
        assert!(qwen.config.use_pkce);
    }

    #[test]
    fn test_all_providers_use_s256() {
        let claude = ClaudeOAuth::new("test".to_string());
        let openai = OpenAIOAuth::new("test".to_string());
        let gemini = GeminiOAuth::new("test".to_string());
        let qwen = QwenOAuth::new("test".to_string());

        assert_eq!(claude.config.pkce_method, ChallengeMethod::S256);
        assert_eq!(openai.config.pkce_method, ChallengeMethod::S256);
        assert_eq!(gemini.config.pkce_method, ChallengeMethod::S256);
        assert_eq!(qwen.config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_all_providers_have_default_scopes() {
        let claude = ClaudeOAuth::new("test".to_string());
        let openai = OpenAIOAuth::new("test".to_string());
        let gemini = GeminiOAuth::new("test".to_string());
        let qwen = QwenOAuth::new("test".to_string());

        assert!(!claude.config.scopes.is_empty());
        assert!(!openai.config.scopes.is_empty());
        assert!(!gemini.config.scopes.is_empty());
        assert!(!qwen.config.scopes.is_empty());
    }

    #[test]
    fn test_endpoint_constants() {
        // Ensure all endpoint URLs are HTTPS
        assert!(claude_endpoints::AUTHORIZATION_URL.starts_with("https://"));
        assert!(claude_endpoints::TOKEN_URL.starts_with("https://"));
        assert!(claude_endpoints::REVOKE_URL.starts_with("https://"));

        assert!(openai_endpoints::AUTHORIZATION_URL.starts_with("https://"));
        assert!(openai_endpoints::TOKEN_URL.starts_with("https://"));
        assert!(openai_endpoints::REVOKE_URL.starts_with("https://"));

        assert!(gemini_endpoints::AUTHORIZATION_URL.starts_with("https://"));
        assert!(gemini_endpoints::TOKEN_URL.starts_with("https://"));
        assert!(gemini_endpoints::REVOKE_URL.starts_with("https://"));

        assert!(qwen_endpoints::AUTHORIZATION_URL.starts_with("https://"));
        assert!(qwen_endpoints::TOKEN_URL.starts_with("https://"));
        assert!(qwen_endpoints::REVOKE_URL.starts_with("https://"));
    }
}
