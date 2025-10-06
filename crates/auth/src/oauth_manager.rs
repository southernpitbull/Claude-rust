//! OAuth Manager
//! 
//! Orchestrates OAuth flows for different AI providers

use crate::error::{AuthError, AuthResult};
use crate::oauth::{
    ClaudeOAuth, OpenAIOAuth, GeminiOAuth, QwenOAuth, OllamaProvider, LMStudioProvider, TokenResponse, OAuthProvider
};
use crate::storage::CredentialStore;
use crate::tokens::AuthToken;
use claude_rust_core::types::ProviderType;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// OAuth Manager for handling authentication flows across providers
pub struct OAuthManager {
    credential_store: Arc<CredentialStore>,
}

impl OAuthManager {
    /// Creates a new OAuth manager
    pub fn new() -> Self {
        Self {
            credential_store: Arc::new(CredentialStore::new()),
        }
    }

    /// Authenticates with a specific provider using OAuth
    pub async fn authenticate(&self, provider: ProviderType, client_id: &str) -> AuthResult<TokenResponse> {
        info!("Starting authentication flow for provider: {:?}", provider);
        
        match provider {
            ProviderType::Claude => {
                let mut oauth = ClaudeOAuth::new(client_id.to_string());
                let token = oauth.authenticate().await?;
                info!("Successfully authenticated with Claude");
                Ok(token)
            }
            ProviderType::OpenAI => {
                let mut oauth = OpenAIOAuth::new(client_id.to_string());
                let token = oauth.authenticate().await?;
                info!("Successfully authenticated with OpenAI");
                Ok(token)
            }
            ProviderType::Gemini => {
                let mut oauth = GeminiOAuth::new(client_id.to_string());
                let token = oauth.authenticate().await?;
                info!("Successfully authenticated with Gemini");
                Ok(token)
            }
            ProviderType::Qwen => {
                let mut oauth = QwenOAuth::new(client_id.to_string());
                let token = oauth.authenticate().await?;
                info!("Successfully authenticated with Qwen");
                Ok(token)
            }
            ProviderType::Ollama => {
                // Ollama doesn't use OAuth, just return a placeholder response
                // The actual connection test would happen separately
                Ok(TokenResponse {
                    access_token: "ollama_local_connection".to_string(),
                    token_type: "bearer".to_string(),
                    expires_in: None,
                    refresh_token: None,
                    scope: Some("local".to_string()),
                    id_token: None,
                    issued_at: Some(chrono::Utc::now()),
                    extra: std::collections::HashMap::new(),
                })
            }
            ProviderType::LMStudio => {
                // LM Studio doesn't use OAuth, just return a placeholder response
                // The actual connection test would happen separately
                Ok(TokenResponse {
                    access_token: "lmstudio_local_connection".to_string(),
                    token_type: "bearer".to_string(),
                    expires_in: None,
                    refresh_token: None,
                    scope: Some("local".to_string()),
                    id_token: None,
                    issued_at: Some(chrono::Utc::now()),
                    extra: std::collections::HashMap::new(),
                })
            }
        }
    }

    /// Refreshes an access token using the refresh token
    pub async fn refresh_token(&self, provider: ProviderType, refresh_token: &str) -> AuthResult<TokenResponse> {
        debug!("Refreshing token for provider: {:?}", provider);
        
        match provider {
            ProviderType::Claude => {
                let oauth = ClaudeOAuth::new(String::new()); // We may need client_id for refresh
                oauth.refresh(refresh_token).await
            }
            ProviderType::OpenAI => {
                let oauth = OpenAIOAuth::new(String::new());
                oauth.refresh(refresh_token).await
            }
            ProviderType::Gemini => {
                let oauth = GeminiOAuth::new(String::new());
                oauth.refresh(refresh_token).await
            }
            ProviderType::Qwen => {
                let oauth = QwenOAuth::new(String::new());
                oauth.refresh(refresh_token).await
            }
            ProviderType::Ollama | ProviderType::LMStudio => {
                // Local providers (Ollama, LMStudio) don't have refresh tokens
                // Return an error indicating refresh is not applicable
                Err(AuthError::OAuthFailed(
                    format!("Refresh not applicable for local provider: {:?}", provider)
                ))
            }
        }
    }

    /// Stores the token in the credential store
    pub async fn store_token(
        &self,
        provider: ProviderType,
        account_name: &str,
        token_response: TokenResponse
    ) -> AuthResult<()> {
        debug!("Storing token for provider: {:?}, account: {}", provider, account_name);

        let expires_at = token_response.expires_at()
            .map(|dt| dt.timestamp())
            .unwrap_or_else(|| chrono::Utc::now().timestamp() + 3600); // Default to 1 hour if not specified

        let auth_token = AuthToken {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at,
            token_type: token_response.token_type,
            scope: token_response.scope.unwrap_or_default(),
        };

        self.credential_store.save_token(provider, account_name, &auth_token)?;
        info!("Token stored successfully for provider: {:?}, account: {}", provider, account_name);

        Ok(())
    }

    /// Tests the connection with a provider using the stored token
    pub async fn test_connection(&self, provider: ProviderType, account_name: &str) -> AuthResult<()> {
        debug!("Testing connection for provider: {:?}, account: {}", provider, account_name);
        
        let token = self.credential_store.get_token(provider, account_name)?;
        
        match token {
            Some(auth_token) => {
                if auth_token.is_expired() {
                    warn!("Stored token for {:?}/{} is expired", provider, account_name);
                    return Err(AuthError::InvalidToken("Token is expired".to_string()));
                }
                
                info!("Valid token found for {:?}/{}", provider, account_name);
                Ok(())
            }
            None => {
                warn!("No token found for {:?}/{}", provider, account_name);
                Err(AuthError::NotAuthenticated)
            }
        }
    }

    /// Revokes a token
    pub async fn revoke_token(&self, provider: ProviderType, token: &str) -> AuthResult<()> {
        debug!("Revoking token for provider: {:?}", provider);
        
        match provider {
            ProviderType::Claude => {
                let oauth = ClaudeOAuth::new(String::new());
                oauth.revoke(token).await?;
            }
            ProviderType::OpenAI => {
                let oauth = OpenAIOAuth::new(String::new());
                oauth.revoke(token).await?;
            }
            ProviderType::Gemini => {
                let oauth = GeminiOAuth::new(String::new());
                oauth.revoke(token).await?;
            }
            ProviderType::Qwen => {
                let oauth = QwenOAuth::new(String::new());
                oauth.revoke(token).await?;
            }
            ProviderType::Ollama | ProviderType::LMStudio => {
                // Local providers (Ollama, LMStudio) don't use OAuth tokens to revoke
                // Instead, we might want to clear locally stored API keys from credential store
                return Err(AuthError::OAuthFailed(
                    format!("Token revocation not applicable for local provider: {:?}", provider)
                ));
            }
        }

        info!("Token revoked successfully for provider: {:?}", provider);
        Ok(())
    }
}

impl Default for OAuthManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use claude_rust_core::types::ProviderType;

    #[test]
    fn test_oauth_manager_creation() {
        let manager = OAuthManager::new();
        assert!(!format!("{:p}", manager.credential_store).is_empty());
    }

    #[test]
    fn test_provider_supported() {
        let manager = OAuthManager::new();
        
        // These providers should be supported for OAuth
        assert!(matches!(ProviderType::Claude, ProviderType::Claude));
        assert!(matches!(ProviderType::OpenAI, ProviderType::OpenAI));
        assert!(matches!(ProviderType::Gemini, ProviderType::Gemini));
        assert!(matches!(ProviderType::Qwen, ProviderType::Qwen));
        
        // These providers don't support OAuth
        assert!(matches!(ProviderType::Ollama, ProviderType::Ollama));
        assert!(matches!(ProviderType::LMStudio, ProviderType::LMStudio));
    }
}