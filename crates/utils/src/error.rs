use thiserror::Error;

pub type UtilsResult<T> = std::result::Result<T, UtilsError>;

#[derive(Debug, Error)]
pub enum UtilsError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Core error: {0}")]
    Core(#[from] claude_code_core::AppError),

    #[error("Utility error: {0}")]
    Utility(String),
}
