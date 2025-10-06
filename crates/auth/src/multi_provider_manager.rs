//! Multi-Provider Manager
//! 
//! Manages authentication across multiple providers and accounts

use crate::error::{AuthError, AuthResult};
use crate::manager::AuthManager;
use crate::oauth::TokenResponse;
use crate::storage::{CredentialStore, TokenInfo};
use crate::tokens::AuthToken;
use crate::types::{AuthState};
use claude_rust_core::types::ProviderType;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info, warn};

/// Account rotation strategies
#[derive(Debug, Clone, PartialEq)]
pub enum RotationStrategy {
    RoundRobin,
    LeastUsed,
    Random,
    Weighted { weights: HashMap<ProviderType, f64> },
}

/// Multi-Provider Manager for handling multiple providers and accounts
pub struct MultiProviderManager {
    auth_manager: Arc<AuthManager>,
    credential_store: Arc<CredentialStore>,
    rotation_strategy: RotationStrategy,
    current_account_index: std::sync::atomic::AtomicUsize,
}

impl MultiProviderManager {
    /// Create a new multi-provider manager
    pub fn new() -> Self {
        Self {
            auth_manager: Arc::new(AuthManager::with_defaults()),
            credential_store: Arc::new(CredentialStore::new()),
            rotation_strategy: RotationStrategy::RoundRobin,
            current_account_index: std::sync::atomic::AtomicUsize::new(0),
        }
    }

    /// Create with a specific rotation strategy
    pub fn with_strategy(strategy: RotationStrategy) -> Self {
        Self {
            auth_manager: Arc::new(AuthManager::with_defaults()),
            credential_store: Arc::new(CredentialStore::new()),
            rotation_strategy: strategy,
            current_account_index: std::sync::atomic::AtomicUsize::new(0),
        }
    }

    /// Set the rotation strategy
    pub fn set_rotation_strategy(&mut self, strategy: RotationStrategy) {
        self.rotation_strategy = strategy;
    }

    /// Authenticate with a provider using the best available account
    pub async fn authenticate(&self, provider: ProviderType) -> AuthResult<String> {
        debug!("Authenticating with provider: {:?}", provider);
        
        // Get all accounts for this provider
        let accounts = self.list_accounts_for_provider(provider).await?;
        
        if accounts.is_empty() {
            return Err(AuthError::NotAuthenticated);
        }

        // Select account based on rotation strategy
        let selected_account = self.select_account(provider, &accounts)?;
        
        // Authenticate with the selected account
        match self.auth_manager.get_cached_token(provider, &selected_account.account).await {
            Ok(Some(token)) if !token.is_expired() => {
                info!("Using cached token for account: {}, provider: {:?}", selected_account.account, provider);
                Ok(token.access_token)
            }
            _ => {
                // In a real implementation, we'd have the client_id and other parameters
                // For now, we'll return an error indicating that authentication is needed
                Err(AuthError::NotAuthenticated)
            }
        }
    }

    /// Get account based on rotation strategy
    fn select_account<'a>(&self, provider: ProviderType, accounts: &'a [TokenInfo]) -> AuthResult<&'a TokenInfo> {
        if accounts.is_empty() {
            return Err(AuthError::NoAccountsAvailable(provider));
        }

        match &self.rotation_strategy {
            RotationStrategy::RoundRobin => {
                let index = self.current_account_index
                    .fetch_add(1, std::sync::atomic::Ordering::SeqCst)
                    % accounts.len();
                Ok(&accounts[index])
            }
            RotationStrategy::LeastUsed => {
                // For now, just return the first account
                // In a real implementation, we'd track usage counts
                Ok(&accounts[0])
            }
            RotationStrategy::Random => {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let index = rng.gen_range(0..accounts.len());
                Ok(&accounts[index])
            }
            RotationStrategy::Weighted { weights } => {
                // For now, just return the first account
                // In a real implementation, we'd use weighted selection
                Ok(&accounts[0])
            }
        }
    }

    /// List all accounts for a provider
    pub async fn list_accounts_for_provider(&self, provider: ProviderType) -> AuthResult<Vec<TokenInfo>> {
        debug!("Listing accounts for provider: {:?}", provider);
        
        let all_tokens = self.credential_store.list_tokens()?;
        let provider_tokens: Vec<TokenInfo> = all_tokens
            .into_iter()
            .filter(|token| token.provider == provider)
            .collect();
        
        Ok(provider_tokens)
    }

    /// List all accounts across all providers
    pub async fn list_all_accounts(&self) -> AuthResult<Vec<TokenInfo>> {
        debug!("Listing all accounts");
        self.credential_store.list_tokens()
    }

    /// Test connection for all accounts of a provider
    pub async fn test_provider_connections(&self, provider: ProviderType) -> AuthResult<()> {
        debug!("Testing connections for provider: {:?}", provider);
        
        let accounts = self.list_accounts_for_provider(provider).await?;
        for account in accounts {
            if self.auth_manager.is_authenticated(provider, &account.account).await {
                info!("Connection test passed for account: {}, provider: {:?}",
                      account.account, provider);
            } else {
                warn!("Connection test failed for account: {}, provider: {:?}",
                      account.account, provider);
            }
        }
        
        Ok(())
    }

    /// Add rate limit aware account switching
    pub async fn get_account_with_rate_limit_handling(&self, provider: ProviderType) -> AuthResult<String> {
        debug!("Getting account with rate limit handling for provider: {:?}", provider);
        
        // In a real implementation, we'd check rate limits and select an appropriate account
        self.authenticate(provider).await
    }

    /// Get auth token for a specific account
    pub async fn get_token_for_account(&self, provider: ProviderType, account: &str) -> AuthResult<Option<AuthToken>> {
        self.auth_manager.get_token(provider, account).await
    }

    /// Refresh all expired tokens for a provider
    pub async fn refresh_all_tokens_for_provider(&self, provider: ProviderType) -> AuthResult<()> {
        debug!("Refreshing all tokens for provider: {:?}", provider);
        
        let accounts = self.list_accounts_for_provider(provider).await?;
        
        for account in accounts {
            if let Ok(Some(token)) = self.auth_manager.get_token(provider, &account.account).await {
                if token.is_expired() {
                    if let Some(refresh_token) = &token.refresh_token {
                        // In a real implementation, we'd have the refresh logic
                        warn!("Token expired for account: {}, refresh needed", account.account);
                    }
                }
            }
        }
        
        Ok(())
    }
}

impl Default for MultiProviderManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_provider_manager_creation() {
        let manager = MultiProviderManager::new();
        assert!(!format!("{:p}", manager.auth_manager).is_empty());
    }

    #[test]
    fn test_rotation_strategies() {
        // Test that all rotation strategies can be created
        let _round_robin = RotationStrategy::RoundRobin;
        let _least_used = RotationStrategy::LeastUsed;
        let _random = RotationStrategy::Random;
        
        let mut weights = HashMap::new();
        weights.insert(ProviderType::Claude, 0.5);
        let _weighted = RotationStrategy::Weighted { weights };
    }

    #[test]
    fn test_multi_provider_manager_with_strategy() {
        let weights = [(ProviderType::Claude, 0.8), (ProviderType::OpenAI, 0.2)]
            .iter()
            .cloned()
            .collect();
        let manager = MultiProviderManager::with_strategy(
            RotationStrategy::Weighted { weights }
        );
        assert!(!format!("{:p}", manager.auth_manager).is_empty());
    }
}