/// Multi-Account Management
///
/// Handles multiple accounts per provider with rotation and pooling

use crate::error::{AuthError, AuthResult};
use crate::types::AuthState;
use claude_code_core::types::ProviderType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// Account identifier (email, username, etc.)
    pub id: String,

    /// Human-readable name for the account
    pub name: String,

    /// Provider type
    pub provider: ProviderType,

    /// Current authentication state
    pub state: AuthState,

    /// Last used timestamp (Unix timestamp)
    pub last_used: i64,

    /// Request count (for tracking usage)
    pub request_count: u64,

    /// Metadata (custom fields)
    pub metadata: HashMap<String, String>,
}

/// Lightweight account information for listing and display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    /// Account identifier
    pub id: String,

    /// Account name
    pub name: String,

    /// Provider type
    pub provider: ProviderType,

    /// Current state
    pub state: AuthState,

    /// Last used timestamp
    pub last_used: i64,

    /// Request count
    pub request_count: u64,
}

impl From<Account> for AccountInfo {
    fn from(account: Account) -> Self {
        Self {
            id: account.id,
            name: account.name,
            provider: account.provider,
            state: account.state,
            last_used: account.last_used,
            request_count: account.request_count,
        }
    }
}

impl From<&Account> for AccountInfo {
    fn from(account: &Account) -> Self {
        Self {
            id: account.id.clone(),
            name: account.name.clone(),
            provider: account.provider,
            state: account.state,
            last_used: account.last_used,
            request_count: account.request_count,
        }
    }
}

impl Account {
    /// Create a new account
    pub fn new(id: impl Into<String>, provider: ProviderType) -> Self {
        Self {
            id: id.into(),
            name: String::new(),
            provider,
            state: AuthState::Initial,
            last_used: 0,
            request_count: 0,
            metadata: HashMap::new(),
        }
    }

    /// Set account name
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    /// Set metadata field
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    /// Mark account as used
    pub fn mark_used(&mut self) {
        self.last_used = chrono::Utc::now().timestamp();
        self.request_count += 1;
    }

    /// Check if account is ready to use
    pub fn is_ready(&self) -> bool {
        matches!(self.state, AuthState::Authenticated)
    }

    /// Get usage score for rotation (lower is better)
    pub fn usage_score(&self) -> u64 {
        self.request_count
    }
}

/// Account pool for managing multiple accounts
pub struct AccountPool {
    accounts: Arc<Mutex<HashMap<ProviderType, Vec<Account>>>>,
    rotation_strategy: RotationStrategy,
}

impl AccountPool {
    /// Create a new account pool
    pub fn new(rotation_strategy: RotationStrategy) -> Self {
        Self {
            accounts: Arc::new(Mutex::new(HashMap::new())),
            rotation_strategy,
        }
    }

    /// Add an account to the pool
    pub fn add_account(&self, account: Account) -> AuthResult<()> {
        let mut accounts = self.accounts.lock().unwrap();
        let provider_accounts = accounts.entry(account.provider).or_default();

        // Check for duplicate
        if provider_accounts.iter().any(|a| a.id == account.id) {
            return Err(AuthError::AccountAlreadyExists(account.id));
        }

        provider_accounts.push(account);
        Ok(())
    }

    /// Remove an account from the pool
    pub fn remove_account(&self, provider: ProviderType, account_id: &str) -> AuthResult<()> {
        let mut accounts = self.accounts.lock().unwrap();

        if let Some(provider_accounts) = accounts.get_mut(&provider) {
            provider_accounts.retain(|a| a.id != account_id);
            Ok(())
        } else {
            Err(AuthError::AccountNotFound(account_id.to_string()))
        }
    }

    /// Get all accounts for a provider
    pub fn get_accounts(&self, provider: ProviderType) -> Vec<Account> {
        let accounts = self.accounts.lock().unwrap();
        accounts.get(&provider).cloned().unwrap_or_default()
    }

    /// Get the next account to use based on rotation strategy
    pub fn get_next_account(&self, provider: ProviderType) -> AuthResult<Account> {
        let mut accounts = self.accounts.lock().unwrap();
        let provider_accounts = accounts
            .get_mut(&provider)
            .ok_or_else(|| AuthError::NoAccountsAvailable(provider))?;

        if provider_accounts.is_empty() {
            return Err(AuthError::NoAccountsAvailable(provider));
        }

        // Filter to only ready accounts
        let ready_accounts: Vec<_> = provider_accounts
            .iter()
            .enumerate()
            .filter(|(_, a)| a.is_ready())
            .collect();

        if ready_accounts.is_empty() {
            return Err(AuthError::NoAccountsReady(provider));
        }

        // Select account based on strategy
        let selected_idx = match self.rotation_strategy {
            RotationStrategy::RoundRobin => {
                // Use the least recently used account
                ready_accounts
                    .iter()
                    .min_by_key(|(_, a)| a.last_used)
                    .map(|(idx, _)| *idx)
                    .unwrap()
            }
            RotationStrategy::LeastUsed => {
                // Use account with lowest usage count
                ready_accounts
                    .iter()
                    .min_by_key(|(_, a)| a.usage_score())
                    .map(|(idx, _)| *idx)
                    .unwrap()
            }
            RotationStrategy::Random => {
                // Random selection
                use rand::Rng;
                let rand_idx = rand::thread_rng().gen_range(0..ready_accounts.len());
                ready_accounts[rand_idx].0
            }
            RotationStrategy::Weighted => {
                // Weighted by inverse usage (less used = higher weight)
                // For now, same as LeastUsed
                ready_accounts
                    .iter()
                    .min_by_key(|(_, a)| a.usage_score())
                    .map(|(idx, _)| *idx)
                    .unwrap()
            }
        };

        // Mark as used
        provider_accounts[selected_idx].mark_used();

        Ok(provider_accounts[selected_idx].clone())
    }

    /// Update account state
    pub fn update_account_state(
        &self,
        provider: ProviderType,
        account_id: &str,
        state: AuthState,
    ) -> AuthResult<()> {
        let mut accounts = self.accounts.lock().unwrap();
        let provider_accounts = accounts
            .get_mut(&provider)
            .ok_or_else(|| AuthError::NoAccountsAvailable(provider))?;

        if let Some(account) = provider_accounts.iter_mut().find(|a| a.id == account_id) {
            account.state = state;
            Ok(())
        } else {
            Err(AuthError::AccountNotFound(account_id.to_string()))
        }
    }

    /// Get account count for a provider
    pub fn account_count(&self, provider: ProviderType) -> usize {
        let accounts = self.accounts.lock().unwrap();
        accounts.get(&provider).map(|a| a.len()).unwrap_or(0)
    }

    /// Get total account count across all providers
    pub fn total_account_count(&self) -> usize {
        let accounts = self.accounts.lock().unwrap();
        accounts.values().map(|v| v.len()).sum()
    }
}

/// Account rotation strategy
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RotationStrategy {
    /// Round-robin rotation
    RoundRobin,
    /// Use least used account
    LeastUsed,
    /// Random selection
    Random,
    /// Weighted selection (inverse of usage)
    Weighted,
}

impl Default for RotationStrategy {
    fn default() -> Self {
        Self::RoundRobin
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_creation() {
        let account = Account::new("test@example.com", ProviderType::Claude)
            .with_name("Test Account")
            .with_metadata("team", "engineering");

        assert_eq!(account.id, "test@example.com");
        assert_eq!(account.name, "Test Account");
        assert_eq!(account.metadata.get("team"), Some(&"engineering".to_string()));
    }

    #[test]
    fn test_account_pool_add_remove() {
        let pool = AccountPool::new(RotationStrategy::RoundRobin);
        let account = Account::new("test@example.com", ProviderType::Claude);

        assert!(pool.add_account(account).is_ok());
        assert_eq!(pool.account_count(ProviderType::Claude), 1);

        assert!(pool
            .remove_account(ProviderType::Claude, "test@example.com")
            .is_ok());
        assert_eq!(pool.account_count(ProviderType::Claude), 0);
    }

    #[test]
    fn test_duplicate_account() {
        let pool = AccountPool::new(RotationStrategy::RoundRobin);
        let account1 = Account::new("test@example.com", ProviderType::Claude);
        let account2 = Account::new("test@example.com", ProviderType::Claude);

        assert!(pool.add_account(account1).is_ok());
        assert!(pool.add_account(account2).is_err());
    }

    #[test]
    fn test_rotation_least_used() {
        let pool = AccountPool::new(RotationStrategy::LeastUsed);

        let mut account1 = Account::new("account1", ProviderType::Claude);
        account1.state = AuthState::Authenticated;
        account1.request_count = 10;

        let mut account2 = Account::new("account2", ProviderType::Claude);
        account2.state = AuthState::Authenticated;
        account2.request_count = 5;

        pool.add_account(account1).unwrap();
        pool.add_account(account2).unwrap();

        let next = pool.get_next_account(ProviderType::Claude).unwrap();
        assert_eq!(next.id, "account2"); // Should select account with lower usage
    }

    #[test]
    fn test_account_info_from_account() {
        let account = Account::new("test@example.com", ProviderType::Claude)
            .with_name("Test Account")
            .with_metadata("team", "engineering");

        let info: AccountInfo = account.clone().into();
        assert_eq!(info.id, "test@example.com");
        assert_eq!(info.name, "Test Account");
        assert_eq!(info.provider, ProviderType::Claude);
        assert_eq!(info.state, AuthState::Initial);
    }

    #[test]
    fn test_account_info_from_ref() {
        let account = Account::new("test@example.com", ProviderType::Claude)
            .with_name("Test Account");

        let info: AccountInfo = (&account).into();
        assert_eq!(info.id, account.id);
        assert_eq!(info.name, account.name);
    }

    #[test]
    fn test_account_info_serialization() {
        let info = AccountInfo {
            id: "test@example.com".to_string(),
            name: "Test".to_string(),
            provider: ProviderType::Claude,
            state: AuthState::Authenticated,
            last_used: 123456789,
            request_count: 42,
        };

        let json = serde_json::to_string(&info).unwrap();
        let deserialized: AccountInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, info.id);
        assert_eq!(deserialized.request_count, info.request_count);
    }

    #[test]
    fn test_account_mark_used() {
        let mut account = Account::new("test", ProviderType::Claude);
        let initial_count = account.request_count;

        account.mark_used();

        assert_eq!(account.request_count, initial_count + 1);
        assert!(account.last_used > 0);
    }

    #[test]
    fn test_account_is_ready() {
        let mut account = Account::new("test", ProviderType::Claude);
        assert!(!account.is_ready());

        account.state = AuthState::Authenticated;
        assert!(account.is_ready());

        account.state = AuthState::Failed;
        assert!(!account.is_ready());
    }

    #[test]
    fn test_rotation_strategy_serialization() {
        let strategies = vec![
            RotationStrategy::RoundRobin,
            RotationStrategy::LeastUsed,
            RotationStrategy::Random,
            RotationStrategy::Weighted,
        ];

        for strategy in strategies {
            let json = serde_json::to_string(&strategy).unwrap();
            let deserialized: RotationStrategy = serde_json::from_str(&json).unwrap();
            // We can't directly compare due to Random, but ensure it deserializes
            let _ = deserialized;
        }
    }

    #[test]
    fn test_account_pool_update_state() {
        let pool = AccountPool::new(RotationStrategy::RoundRobin);
        let mut account = Account::new("test", ProviderType::Claude);
        account.state = AuthState::Authenticated;

        pool.add_account(account).unwrap();

        pool.update_account_state(
            ProviderType::Claude,
            "test",
            AuthState::Expired,
        )
        .unwrap();

        let accounts = pool.get_accounts(ProviderType::Claude);
        assert_eq!(accounts[0].state, AuthState::Expired);
    }

    #[test]
    fn test_account_pool_counts() {
        let pool = AccountPool::new(RotationStrategy::RoundRobin);

        pool.add_account(Account::new("user1", ProviderType::Claude))
            .unwrap();
        pool.add_account(Account::new("user2", ProviderType::Claude))
            .unwrap();
        pool.add_account(Account::new("user3", ProviderType::OpenAI))
            .unwrap();

        assert_eq!(pool.account_count(ProviderType::Claude), 2);
        assert_eq!(pool.account_count(ProviderType::OpenAI), 1);
        assert_eq!(pool.total_account_count(), 3);
    }
}
