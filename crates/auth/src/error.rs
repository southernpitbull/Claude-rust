use claude_rust_core::types::ProviderType;
use thiserror::Error;

pub type AuthResult<T> = std::result::Result<T, AuthError>;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("OAuth flow failed: {0}")]
    OAuthFailed(String),

    #[error("Token expired")]
    TokenExpired,

    #[error("Invalid token: {0}")]
    InvalidToken(String),

    #[error("Provider not found: {0}")]
    ProviderNotFound(String),

    #[error("Configuration error: {0}")]
    ConfigurationError(String),

    #[error("Account already exists: {0}")]
    AccountAlreadyExists(String),

    #[error("Account not found: {0}")]
    AccountNotFound(String),

    #[error("No accounts available for provider: {0}")]
    NoAccountsAvailable(ProviderType),

    #[error("No accounts ready for provider: {0}")]
    NoAccountsReady(ProviderType),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Keyring error: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Authentication cancelled by user")]
    Cancelled,

    #[error("Not authenticated")]
    NotAuthenticated,

    #[error("Provider error: {0}")]
    ProviderError(String),
}
