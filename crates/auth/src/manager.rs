use crate::error::{AuthError, AuthResult};
use crate::oauth::TokenResponse;
use crate::oauth_manager::OAuthManager;
use crate::storage::CredentialStore;
use crate::tokens::AuthToken;
use chrono::Utc;
use claude_rust_core::types::ProviderType;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Authentication manager
pub struct AuthManager {
    storage: Arc<CredentialStore>,
    oauth_manager: Arc<OAuthManager>,
}

impl AuthManager {
    pub fn new(storage: CredentialStore) -> AuthResult<Self> {
        Ok(Self {
            storage: Arc::new(storage),
            oauth_manager: Arc::new(OAuthManager::new()),
        })
    }

    pub fn with_defaults() -> Self {
        Self {
            storage: Arc::new(CredentialStore::new()),
            oauth_manager: Arc::new(OAuthManager::new()),
        }
    }

    /// Get a valid token for a provider
    pub async fn get_token(&self, provider: ProviderType, account: &str) -> AuthResult<Option<AuthToken>> {
        self.storage.get_token(provider, account)
    }

    /// Save a token
    pub async fn save_token(&self, provider: ProviderType, account: &str, token: &AuthToken) -> AuthResult<()> {
        self.storage.save_token(provider, account, token)
    }

    /// Delete a token
    pub async fn delete_token(&self, provider: ProviderType, account: &str) -> AuthResult<()> {
        self.storage.delete_token(provider, account)
    }

    /// Check if authenticated
    pub async fn is_authenticated(&self, provider: ProviderType, account: &str) -> bool {
        if let Ok(Some(token)) = self.get_token(provider, account).await {
            !token.is_expired()
        } else {
            false
        }
    }

    /// Authenticate with a provider using OAuth flow
    pub async fn start_oauth_flow(&self, provider: ProviderType, client_id: &str) -> AuthResult<TokenResponse> {
        debug!("Starting OAuth flow for provider: {:?}", provider);
        self.oauth_manager.authenticate(provider, client_id).await
    }

    /// Refresh token for a provider
    pub async fn refresh_token(&self, provider: ProviderType, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing token for provider: {:?}", provider);
        self.oauth_manager.refresh_token(provider, refresh_token).await
    }

    /// Get cached token if it's still valid
    pub async fn get_cached_token(&self, provider: ProviderType, account: &str) -> AuthResult<Option<AuthToken>> {
        debug!("Getting cached token for provider: {:?}, account: {}", provider, account);
        let token = self.get_token(provider, account).await?;
        
        match token {
            Some(token) if !token.is_expired() => {
                info!("Returning valid cached token for provider: {:?}", provider);
                Ok(Some(token))
            }
            Some(token) => {
                warn!("Cached token expired, needs refresh for provider: {:?}", provider);
                Ok(Some(token))
            }
            None => {
                debug!("No cached token found for provider: {:?}", provider);
                Ok(None)
            }
        }
    }

    /// Cache token for a provider and account
    pub async fn cache_token(&self, provider: ProviderType, account: &str, token: &TokenResponse) -> AuthResult<()> {
        debug!("Caching token for provider: {:?}, account: {}", provider, account);

        let expires_at = token.expires_at()
            .map(|dt| dt.timestamp())
            .unwrap_or_else(|| Utc::now().timestamp() + 3600); // Default to 1 hour if not specified

        let auth_token = AuthToken {
            access_token: token.access_token.clone(),
            refresh_token: token.refresh_token.clone(),
            expires_at,
            token_type: token.token_type.clone(),
            scope: token.scope.clone().unwrap_or_default(),
        };

        self.save_token(provider, account, &auth_token).await?;
        info!("Token cached successfully for provider: {:?}, account: {}", provider, account);

        Ok(())
    }

    /// Add automatic token refresh logic
    pub async fn authenticate_with_refresh(&self, provider: ProviderType, account: &str, client_id: &str) -> AuthResult<String> {
        debug!("Authenticating with automatic refresh for provider: {:?}, account: {}", provider, account);

        // Try to get cached token first
        if let Ok(Some(token)) = self.get_cached_token(provider, account).await {
            if !token.is_expired() {
                info!("Using valid cached token for provider: {:?}", provider);
                return Ok(token.access_token);
            } else if let Some(refresh_token) = &token.refresh_token {
                // Try to refresh the token
                match self.refresh_token(provider, refresh_token).await {
                    Ok(refreshed) => {
                        // Cache the refreshed token
                        self.cache_token(provider, account, &refreshed).await?;
                        info!("Successfully refreshed token for provider: {:?}", provider);
                        return Ok(refreshed.access_token);
                    }
                    Err(e) => {
                        warn!("Token refresh failed: {}. Starting new OAuth flow: {}", e, provider);
                    }
                }
            }
        }

        // If no valid token or refresh failed, start new OAuth flow
        let token_response = self.start_oauth_flow(provider, client_id).await?;
        self.cache_token(provider, account, &token_response).await?;

        info!("Successfully authenticated with new OAuth flow for provider: {:?}", provider);
        Ok(token_response.access_token)
    }

    /// Check if credentials exist for a provider
    pub async fn has_credentials(&self, provider: &str) -> bool {
        let provider_type = Self::parse_provider_str(provider);
        if let Ok(Some(_)) = self.storage.get_token(provider_type, "default") {
            true
        } else {
            false
        }
    }

    /// Store API key for a provider
    pub async fn store_api_key(&self, provider: &str, api_key: &str) -> AuthResult<()> {
        let provider_type = Self::parse_provider_str(provider);
        let token = AuthToken {
            access_token: api_key.to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + (365 * 24 * 60 * 60), // 1 year
            token_type: "Bearer".to_string(),
            scope: String::new(),
        };
        self.storage.save_token(provider_type, "default", &token)
    }

    /// Authenticate using OAuth flow
    pub async fn authenticate_oauth(&self, provider: &str) -> AuthResult<TokenResponse> {
        let provider_type = Self::parse_provider_str(provider);
        let client_id = "claude-rust-cli"; // Default client ID
        self.start_oauth_flow(provider_type, client_id).await
    }

    /// Check if provider has an API key
    pub async fn has_api_key(&self, provider: &str) -> bool {
        let provider_type = Self::parse_provider_str(provider);
        if let Ok(Some(token)) = self.storage.get_token(provider_type, "default") {
            token.refresh_token.is_none() // API keys typically don't have refresh tokens
        } else {
            false
        }
    }

    /// Clear credentials for a provider
    pub async fn clear_credentials(&self, provider: &str) -> AuthResult<()> {
        let provider_type = Self::parse_provider_str(provider);
        self.storage.delete_token(provider_type, "default")
    }

    /// Get token by provider string
    pub async fn get_token_str(&self, provider: &str) -> AuthResult<Option<AuthToken>> {
        let provider_type = Self::parse_provider_str(provider);
        self.storage.get_token(provider_type, "default")
    }

    /// Parse provider string to ProviderType
    fn parse_provider_str(provider: &str) -> ProviderType {
        match provider.to_lowercase().as_str() {
            "claude" => ProviderType::Claude,
            "openai" => ProviderType::OpenAI,
            "gemini" => ProviderType::Gemini,
            "qwen" => ProviderType::Qwen,
            "ollama" => ProviderType::Ollama,
            "lmstudio" => ProviderType::LMStudio,
            _ => ProviderType::Claude, // Default fallback
        }
    }
}

impl Default for AuthManager {
    fn default() -> Self {
        Self::with_defaults()
    }
}
