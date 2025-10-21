//! Error types for AIrchitect CLI

use thiserror::Error;

/// AIrchitect CLI error types
#[derive(Error, Debug)]
pub enum AICliError {
    /// Configuration error
    #[error("Configuration error: {0}")]
    ConfigError(String),

    /// Provider error
    #[error("Provider error: {0}")]
    ProviderError(String),

    /// Credential error
    #[error("Credential error: {0}")]
    CredentialError(String),

    /// Memory error
    #[error("Memory error: {0}")]
    MemoryError(String),

    /// Agent error
    #[error("Agent error: {0}")]
    AgentError(String),

    /// Checkpoint error
    #[error("Checkpoint error: {0}")]
    CheckpointError(String),

    /// IO error
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    /// JSON error
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    /// HTTP error
    #[error("HTTP error: {0}")]
    HttpError(#[from] reqwest::Error),

    /// Generic error
    #[error("Generic error: {0}")]
    GenericError(String),
}

impl AICliError {
    /// Create a new configuration error
    pub fn config(msg: impl Into<String>) -> Self {
        AICliError::ConfigError(msg.into())
    }

    /// Create a new provider error
    pub fn provider(msg: impl Into<String>) -> Self {
        AICliError::ProviderError(msg.into())
    }

    /// Create a new credential error
    pub fn credential(msg: impl Into<String>) -> Self {
        AICliError::CredentialError(msg.into())
    }

    /// Create a new memory error
    pub fn memory(msg: impl Into<String>) -> Self {
        AICliError::MemoryError(msg.into())
    }

    /// Create a new agent error
    pub fn agent(msg: impl Into<String>) -> Self {
        AICliError::AgentError(msg.into())
    }

    /// Create a new checkpoint error
    pub fn checkpoint(msg: impl Into<String>) -> Self {
        AICliError::CheckpointError(msg.into())
    }

    /// Create a new generic error
    pub fn generic(msg: impl Into<String>) -> Self {
        AICliError::GenericError(msg.into())
    }
}
