use thiserror::Error;

#[derive(Error, Debug)]
pub enum AIError {
    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Network error: {0}")]
    NetworkError(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Generic error: {0}")]
    GenericError(String),
}

pub type Result<T> = std::result::Result<T, AIError>;
