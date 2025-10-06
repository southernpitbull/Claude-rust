//! OAuth 2.0 Flow Implementation
//!
//! Implements OAuth 2.0 authorization code flow with PKCE support according to
//! RFC 6749 (OAuth 2.0) and RFC 7636 (PKCE).

use crate::error::{AuthError, AuthResult};
use super::pkce::{ChallengeMethod, PkceParams};
use super::server::{CallbackResult, CallbackServer, ServerConfig};
use chrono::{DateTime, Duration, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, info, warn};
use url::Url;
use uuid::Uuid;

/// OAuth 2.0 token response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    /// Access token for API requests
    pub access_token: String,

    /// Token type (usually "Bearer")
    pub token_type: String,

    /// Token expiration time in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_in: Option<i64>,

    /// Refresh token for obtaining new access tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,

    /// Granted scopes (space-separated)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,

    /// ID token (for OpenID Connect)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id_token: Option<String>,

    /// Timestamp when token was issued
    #[serde(skip_serializing, skip_deserializing)]
    pub issued_at: Option<DateTime<Utc>>,

    /// Additional custom fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl TokenResponse {
    /// Calculates when the token expires
    pub fn expires_at(&self) -> Option<DateTime<Utc>> {
        let issued_at = self.issued_at.unwrap_or_else(Utc::now);
        self.expires_in
            .map(|seconds| issued_at + Duration::seconds(seconds))
    }

    /// Checks if the token is expired
    pub fn is_expired(&self) -> bool {
        self.expires_at()
            .map(|exp| Utc::now() >= exp)
            .unwrap_or(false)
    }

    /// Checks if the token will expire within the given duration
    pub fn expires_within(&self, duration: Duration) -> bool {
        self.expires_at()
            .map(|exp| Utc::now() + duration >= exp)
            .unwrap_or(true)
    }
}

/// OAuth 2.0 error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthError {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_uri: Option<String>,
}

impl std::fmt::Display for OAuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.error)?;
        if let Some(desc) = &self.error_description {
            write!(f, ": {}", desc)?;
        }
        Ok(())
    }
}

/// OAuth 2.0 flow configuration
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    /// Client ID
    pub client_id: String,

    /// Client secret (optional for public clients with PKCE)
    pub client_secret: Option<String>,

    /// Authorization endpoint URL
    pub authorization_endpoint: String,

    /// Token endpoint URL
    pub token_endpoint: String,

    /// Redirect URI
    pub redirect_uri: String,

    /// Requested scopes
    pub scopes: Vec<String>,

    /// Whether to use PKCE
    pub use_pkce: bool,

    /// PKCE challenge method
    pub pkce_method: ChallengeMethod,

    /// Additional authorization parameters
    pub additional_params: HashMap<String, String>,
}

impl OAuthConfig {
    /// Creates a new OAuth configuration
    pub fn new(
        client_id: String,
        authorization_endpoint: String,
        token_endpoint: String,
    ) -> Self {
        Self {
            client_id,
            client_secret: None,
            authorization_endpoint,
            token_endpoint,
            redirect_uri: "http://localhost:0/callback".to_string(),
            scopes: Vec::new(),
            use_pkce: true,
            pkce_method: ChallengeMethod::S256,
            additional_params: HashMap::new(),
        }
    }

    /// Sets the client secret
    pub fn with_client_secret(mut self, secret: String) -> Self {
        self.client_secret = Some(secret);
        self
    }

    /// Sets the redirect URI
    pub fn with_redirect_uri(mut self, uri: String) -> Self {
        self.redirect_uri = uri;
        self
    }

    /// Sets the scopes
    pub fn with_scopes(mut self, scopes: Vec<String>) -> Self {
        self.scopes = scopes;
        self
    }

    /// Enables or disables PKCE
    pub fn with_pkce(mut self, use_pkce: bool) -> Self {
        self.use_pkce = use_pkce;
        self
    }

    /// Sets the PKCE challenge method
    pub fn with_pkce_method(mut self, method: ChallengeMethod) -> Self {
        self.pkce_method = method;
        self
    }

    /// Adds an additional authorization parameter
    pub fn with_param(mut self, key: String, value: String) -> Self {
        self.additional_params.insert(key, value);
        self
    }
}

/// OAuth 2.0 flow state
struct FlowState {
    /// CSRF state parameter
    state: String,
    /// PKCE parameters (if enabled)
    pkce: Option<PkceParams>,
}

/// OAuth 2.0 flow coordinator
pub struct OAuthFlow {
    config: OAuthConfig,
    client: Client,
    state: Option<FlowState>,
}

impl OAuthFlow {
    /// Creates a new OAuth flow with the given configuration
    pub fn new(config: OAuthConfig) -> Self {
        Self {
            config,
            client: Client::new(),
            state: None,
        }
    }

    /// Creates a new OAuth flow with a custom HTTP client
    pub fn with_client(config: OAuthConfig, client: Client) -> Self {
        Self {
            config,
            client,
            state: None,
        }
    }

    /// Builds the authorization URL for the OAuth flow
    ///
    /// This generates a new state parameter and PKCE parameters (if enabled)
    /// and constructs the authorization URL that the user should visit.
    pub fn build_authorization_url(&mut self) -> AuthResult<String> {
        // Generate state parameter for CSRF protection
        let state = Uuid::new_v4().to_string();

        // Generate PKCE parameters if enabled
        let pkce = if self.config.use_pkce {
            Some(PkceParams::new_with_method(64, self.config.pkce_method))
        } else {
            None
        };

        // Store flow state
        self.state = Some(FlowState {
            state: state.clone(),
            pkce: pkce.clone(),
        });

        // Build authorization URL
        let mut url = Url::parse(&self.config.authorization_endpoint)
            .map_err(|e| AuthError::ConfigurationError(format!("Invalid authorization endpoint: {}", e)))?;

        {
            let mut query = url.query_pairs_mut();

            query.append_pair("response_type", "code");
            query.append_pair("client_id", &self.config.client_id);
            query.append_pair("redirect_uri", &self.config.redirect_uri);
            query.append_pair("state", &state);

            if !self.config.scopes.is_empty() {
                query.append_pair("scope", &self.config.scopes.join(" "));
            }

            // Add PKCE parameters
            if let Some(ref pkce) = pkce {
                query.append_pair("code_challenge", &pkce.code_challenge);
                query.append_pair("code_challenge_method", pkce.challenge_method.as_str());
            }

            // Add additional parameters
            for (key, value) in &self.config.additional_params {
                query.append_pair(key, value);
            }
        }

        Ok(url.to_string())
    }

    /// Validates the state parameter from the callback
    fn validate_state(&self, callback_state: Option<&str>) -> AuthResult<()> {
        let flow_state = self.state.as_ref().ok_or_else(|| {
            AuthError::OAuthFailed("No flow state found".to_string())
        })?;

        let callback_state = callback_state.ok_or_else(|| {
            AuthError::OAuthFailed("No state in callback".to_string())
        })?;

        if flow_state.state != callback_state {
            return Err(AuthError::OAuthFailed(
                "State parameter mismatch (possible CSRF attack)".to_string(),
            ));
        }

        Ok(())
    }

    /// Exchanges an authorization code for an access token
    pub async fn exchange_code(&self, code: &str) -> AuthResult<TokenResponse> {
        let flow_state = self.state.as_ref().ok_or_else(|| {
            AuthError::OAuthFailed("No flow state found".to_string())
        })?;

        let mut params = HashMap::new();
        params.insert("grant_type", "authorization_code".to_string());
        params.insert("code", code.to_string());
        params.insert("redirect_uri", self.config.redirect_uri.clone());
        params.insert("client_id", self.config.client_id.clone());

        // Add client secret if present
        if let Some(ref secret) = self.config.client_secret {
            params.insert("client_secret", secret.clone());
        }

        // Add PKCE code verifier if used
        if let Some(ref pkce) = flow_state.pkce {
            params.insert("code_verifier", pkce.code_verifier.clone());
        }

        debug!("Exchanging authorization code for token");

        let response = self
            .client
            .post(&self.config.token_endpoint)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token request failed: {}", e)))?;

        let status = response.status();

        if status.is_success() {
            let mut token: TokenResponse = response
                .json()
                .await
                .map_err(|e| AuthError::OAuthFailed(format!("Failed to parse token response: {}", e)))?;

            token.issued_at = Some(Utc::now());
            info!("Successfully exchanged code for access token");

            Ok(token)
        } else {
            let error: OAuthError = response
                .json()
                .await
                .map_err(|e| AuthError::OAuthFailed(format!("Failed to parse error response: {}", e)))?;

            Err(AuthError::OAuthFailed(error.to_string()))
        }
    }

    /// Refreshes an access token using a refresh token
    pub async fn refresh_token(&self, refresh_token: &str) -> AuthResult<TokenResponse> {
        let mut params = HashMap::new();
        params.insert("grant_type", "refresh_token".to_string());
        params.insert("refresh_token", refresh_token.to_string());
        params.insert("client_id", self.config.client_id.clone());

        // Add client secret if present
        if let Some(ref secret) = self.config.client_secret {
            params.insert("client_secret", secret.clone());
        }

        debug!("Refreshing access token");

        let response = self
            .client
            .post(&self.config.token_endpoint)
            .form(&params)
            .send()
            .await
            .map_err(|e| AuthError::Network(format!("Token refresh failed: {}", e)))?;

        let status = response.status();

        if status.is_success() {
            let mut token: TokenResponse = response
                .json()
                .await
                .map_err(|e| AuthError::OAuthFailed(format!("Failed to parse token response: {}", e)))?;

            token.issued_at = Some(Utc::now());
            info!("Successfully refreshed access token");

            Ok(token)
        } else {
            let error: OAuthError = response
                .json()
                .await
                .map_err(|e| AuthError::OAuthFailed(format!("Failed to parse error response: {}", e)))?;

            Err(AuthError::OAuthFailed(error.to_string()))
        }
    }

    /// Runs the complete OAuth flow with a local callback server
    ///
    /// This method:
    /// 1. Starts a local HTTP server
    /// 2. Builds the authorization URL
    /// 3. Opens the authorization URL in the browser
    /// 4. Waits for the callback
    /// 5. Exchanges the authorization code for tokens
    pub async fn run_flow(&mut self) -> AuthResult<TokenResponse> {
        // Start callback server
        let server_config = ServerConfig::default();
        let mut server = CallbackServer::new(server_config)?;
        let port = server.start()?;

        // Update redirect URI with actual port
        self.config.redirect_uri = format!("http://127.0.0.1:{}/callback", port);

        // Build authorization URL
        let auth_url = self.build_authorization_url()?;

        info!("Opening authorization URL in browser");
        info!("If the browser doesn't open automatically, please visit:");
        info!("{}", auth_url);

        // Try to open browser
        if let Err(e) = open_browser(&auth_url) {
            warn!("Failed to open browser automatically: {}", e);
        }

        // Wait for callback
        info!("Waiting for OAuth callback...");
        let callback = server.wait_for_callback()?;

        // Check for errors in callback
        if callback.is_error() {
            return Err(AuthError::OAuthFailed(
                callback.error_message().unwrap_or_else(|| "Unknown error".to_string()),
            ));
        }

        // Validate state parameter
        self.validate_state(callback.state.as_deref())?;

        // Exchange code for token
        let token = self.exchange_code(&callback.code).await?;

        Ok(token)
    }

    /// Runs a simplified flow that returns the authorization URL
    /// and expects the callback result to be provided manually
    pub fn start_flow(&mut self) -> AuthResult<String> {
        self.build_authorization_url()
    }

    /// Completes the OAuth flow with a callback result
    pub async fn complete_flow(&self, callback: CallbackResult) -> AuthResult<TokenResponse> {
        // Check for errors in callback
        if callback.is_error() {
            return Err(AuthError::OAuthFailed(
                callback.error_message().unwrap_or_else(|| "Unknown error".to_string()),
            ));
        }

        // Validate state parameter
        self.validate_state(callback.state.as_deref())?;

        // Exchange code for token
        let token = self.exchange_code(&callback.code).await?;

        Ok(token)
    }
}

/// Opens a URL in the system's default browser
fn open_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> OAuthConfig {
        OAuthConfig::new(
            "test_client_id".to_string(),
            "https://auth.example.com/authorize".to_string(),
            "https://auth.example.com/token".to_string(),
        )
    }

    #[test]
    fn test_oauth_config_creation() {
        let config = test_config();
        assert_eq!(config.client_id, "test_client_id");
        assert!(config.use_pkce);
        assert_eq!(config.pkce_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_oauth_config_builder() {
        let config = test_config()
            .with_client_secret("secret".to_string())
            .with_scopes(vec!["read".to_string(), "write".to_string()])
            .with_pkce(false);

        assert_eq!(config.client_secret, Some("secret".to_string()));
        assert_eq!(config.scopes, vec!["read", "write"]);
        assert!(!config.use_pkce);
    }

    #[test]
    fn test_oauth_flow_creation() {
        let config = test_config();
        let flow = OAuthFlow::new(config);
        assert!(flow.state.is_none());
    }

    #[test]
    fn test_build_authorization_url() {
        let config = test_config();
        let mut flow = OAuthFlow::new(config);
        let url = flow.build_authorization_url().unwrap();

        assert!(url.starts_with("https://auth.example.com/authorize?"));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("client_id=test_client_id"));
        assert!(url.contains("code_challenge="));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("state="));
    }

    #[test]
    fn test_build_authorization_url_with_scopes() {
        let config = test_config().with_scopes(vec!["read".to_string(), "write".to_string()]);
        let mut flow = OAuthFlow::new(config);
        let url = flow.build_authorization_url().unwrap();

        assert!(url.contains("scope=read+write") || url.contains("scope=read%20write"));
    }

    #[test]
    fn test_build_authorization_url_without_pkce() {
        let config = test_config().with_pkce(false);
        let mut flow = OAuthFlow::new(config);
        let url = flow.build_authorization_url().unwrap();

        assert!(!url.contains("code_challenge"));
        assert!(!url.contains("code_challenge_method"));
    }

    #[test]
    fn test_token_response_expires_at() {
        let mut token = TokenResponse {
            access_token: "test_token".to_string(),
            token_type: "Bearer".to_string(),
            expires_in: Some(3600),
            refresh_token: None,
            scope: None,
            id_token: None,
            issued_at: Some(Utc::now()),
            extra: HashMap::new(),
        };

        let expires_at = token.expires_at().unwrap();
        let now = Utc::now();
        let expected = now + Duration::seconds(3600);

        // Allow 1 second tolerance
        assert!((expires_at - expected).num_seconds().abs() <= 1);
    }

    #[test]
    fn test_token_response_is_expired() {
        let token = TokenResponse {
            access_token: "test_token".to_string(),
            token_type: "Bearer".to_string(),
            expires_in: Some(-3600), // Already expired
            refresh_token: None,
            scope: None,
            id_token: None,
            issued_at: Some(Utc::now()),
            extra: HashMap::new(),
        };

        assert!(token.is_expired());
    }

    #[test]
    fn test_token_response_expires_within() {
        let token = TokenResponse {
            access_token: "test_token".to_string(),
            token_type: "Bearer".to_string(),
            expires_in: Some(300), // 5 minutes
            refresh_token: None,
            scope: None,
            id_token: None,
            issued_at: Some(Utc::now()),
            extra: HashMap::new(),
        };

        assert!(token.expires_within(Duration::seconds(600))); // Within 10 minutes
        assert!(!token.expires_within(Duration::seconds(60))); // Not within 1 minute
    }

    #[test]
    fn test_oauth_error_display() {
        let error = OAuthError {
            error: "access_denied".to_string(),
            error_description: Some("User denied access".to_string()),
            error_uri: None,
        };

        assert_eq!(error.to_string(), "access_denied: User denied access");
    }

    #[test]
    fn test_oauth_config_with_param() {
        let config = test_config()
            .with_param("custom_param".to_string(), "custom_value".to_string());

        assert_eq!(
            config.additional_params.get("custom_param"),
            Some(&"custom_value".to_string())
        );
    }

    #[test]
    fn test_start_flow() {
        let config = test_config();
        let mut flow = OAuthFlow::new(config);
        let url = flow.start_flow().unwrap();

        assert!(url.starts_with("https://auth.example.com/authorize?"));
        assert!(flow.state.is_some());
    }
}
