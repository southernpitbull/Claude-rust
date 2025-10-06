use thiserror::Error;

pub type TerminalResult<T> = std::result::Result<T, TerminalError>;

#[derive(Debug, Error)]
pub enum TerminalError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Terminal error: {0}")]
    Terminal(String),

    #[error("Core error: {0}")]
    Core(#[from] claude_rust_core::AppError),
}
