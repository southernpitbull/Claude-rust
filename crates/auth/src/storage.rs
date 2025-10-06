use crate::error::{AuthError, AuthResult};
use crate::tokens::AuthToken;
use claude_code_core::types::ProviderType;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const SERVICE_NAME: &str = "claude-code";
const INDEX_KEY: &str = "token-index";

/// Token metadata for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub provider: ProviderType,
    pub account: String,
    pub token_type: String,
    pub scope: String,
    pub expires_at: i64,
    pub is_expired: bool,
}

/// Credential storage using OS keyring
pub struct CredentialStore;

impl CredentialStore {
    pub fn new() -> Self {
        Self
    }

    /// Save a token to the keyring
    pub fn save_token(&self, provider: ProviderType, account: &str, token: &AuthToken) -> AuthResult<()> {
        let key = format!("{}-{}", provider, account);
        let entry = Entry::new(SERVICE_NAME, &key)?;
        let json = serde_json::to_string(token)?;
        entry.set_password(&json)?;

        // Update index
        self.update_index(provider, account, true)?;

        Ok(())
    }

    /// Get a token from the keyring
    pub fn get_token(&self, provider: ProviderType, account: &str) -> AuthResult<Option<AuthToken>> {
        let key = format!("{}-{}", provider, account);
        let entry = Entry::new(SERVICE_NAME, &key)?;

        match entry.get_password() {
            Ok(json) => {
                let token = serde_json::from_str(&json)?;
                Ok(Some(token))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Delete a token from the keyring
    pub fn delete_token(&self, provider: ProviderType, account: &str) -> AuthResult<()> {
        let key = format!("{}-{}", provider, account);
        let entry = Entry::new(SERVICE_NAME, &key)?;

        match entry.delete_password() {
            Ok(()) => {
                // Update index
                self.update_index(provider, account, false)?;
                Ok(())
            }
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.into()),
        }
    }

    /// List all stored tokens with metadata
    pub fn list_tokens(&self) -> AuthResult<Vec<TokenInfo>> {
        let index = self.get_index()?;
        let mut tokens = Vec::new();

        for (provider, accounts) in index {
            for account in accounts {
                if let Some(token) = self.get_token(provider, &account)? {
                    tokens.push(TokenInfo {
                        provider,
                        account,
                        token_type: token.token_type.clone(),
                        scope: token.scope.clone(),
                        expires_at: token.expires_at,
                        is_expired: token.is_expired(),
                    });
                }
            }
        }

        Ok(tokens)
    }

    /// Get the token index from keyring
    fn get_index(&self) -> AuthResult<HashMap<ProviderType, Vec<String>>> {
        let entry = Entry::new(SERVICE_NAME, INDEX_KEY)?;

        match entry.get_password() {
            Ok(json) => {
                let index = serde_json::from_str(&json)?;
                Ok(index)
            }
            Err(keyring::Error::NoEntry) => Ok(HashMap::new()),
            Err(e) => Err(e.into()),
        }
    }

    /// Update the token index
    fn update_index(&self, provider: ProviderType, account: &str, add: bool) -> AuthResult<()> {
        let mut index = self.get_index()?;
        let accounts = index.entry(provider).or_default();

        if add {
            if !accounts.contains(&account.to_string()) {
                accounts.push(account.to_string());
            }
        } else {
            accounts.retain(|a| a != account);
        }

        let entry = Entry::new(SERVICE_NAME, INDEX_KEY)?;
        let json = serde_json::to_string(&index)?;
        entry.set_password(&json)?;

        Ok(())
    }

    /// Clear all tokens
    pub fn clear_all(&self) -> AuthResult<()> {
        let tokens = self.list_tokens()?;

        for token_info in tokens {
            self.delete_token(token_info.provider, &token_info.account)?;
        }

        // Clear index
        let entry = Entry::new(SERVICE_NAME, INDEX_KEY)?;
        let _ = entry.delete_password();

        Ok(())
    }
}

impl Default for CredentialStore {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_token(expires_in_seconds: i64) -> AuthToken {
        AuthToken {
            access_token: "test_access_token".to_string(),
            refresh_token: Some("test_refresh_token".to_string()),
            expires_at: Utc::now().timestamp() + expires_in_seconds,
            token_type: "Bearer".to_string(),
            scope: "read write".to_string(),
        }
    }

    #[test]
    fn test_credential_store_new() {
        let store = CredentialStore::new();
        assert!(store.list_tokens().is_ok());
    }

    #[test]
    fn test_save_and_get_token() {
        let store = CredentialStore::new();
        let token = create_test_token(3600);

        // Save token
        let result = store.save_token(ProviderType::Claude, "test@example.com", &token);
        assert!(result.is_ok());

        // Get token
        let retrieved = store.get_token(ProviderType::Claude, "test@example.com").unwrap();
        assert!(retrieved.is_some());

        let retrieved_token = retrieved.unwrap();
        assert_eq!(retrieved_token.access_token, "test_access_token");
        assert_eq!(retrieved_token.token_type, "Bearer");

        // Cleanup
        let _ = store.delete_token(ProviderType::Claude, "test@example.com");
    }

    #[test]
    fn test_delete_token() {
        let store = CredentialStore::new();
        let token = create_test_token(3600);

        // Save and then delete
        store.save_token(ProviderType::Claude, "delete@example.com", &token).unwrap();
        let result = store.delete_token(ProviderType::Claude, "delete@example.com");
        assert!(result.is_ok());

        // Verify deleted
        let retrieved = store.get_token(ProviderType::Claude, "delete@example.com").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_list_tokens() {
        let store = CredentialStore::new();
        let token1 = create_test_token(3600);
        let token2 = create_test_token(7200);

        // Save multiple tokens
        store.save_token(ProviderType::Claude, "user1@example.com", &token1).unwrap();
        store.save_token(ProviderType::OpenAI, "user2@example.com", &token2).unwrap();

        // List tokens
        let tokens = store.list_tokens().unwrap();
        assert!(tokens.len() >= 2);

        // Find our tokens
        let claude_token = tokens.iter().find(|t| t.account == "user1@example.com");
        let openai_token = tokens.iter().find(|t| t.account == "user2@example.com");

        assert!(claude_token.is_some());
        assert!(openai_token.is_some());

        // Cleanup
        let _ = store.delete_token(ProviderType::Claude, "user1@example.com");
        let _ = store.delete_token(ProviderType::OpenAI, "user2@example.com");
    }

    #[test]
    fn test_get_nonexistent_token() {
        let store = CredentialStore::new();
        let result = store.get_token(ProviderType::Claude, "nonexistent@example.com").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_nonexistent_token() {
        let store = CredentialStore::new();
        let result = store.delete_token(ProviderType::Claude, "nonexistent@example.com");
        assert!(result.is_ok()); // Should not error
    }
}
