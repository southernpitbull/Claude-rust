//! Error Handling Module
//!
//! Provides a comprehensive, hierarchical error system for the Claude-Rust application.
//! This module defines all error types, error conversion, and error context management.
//!
//! # Design Philosophy
//!
//! - **Hierarchical**: Errors are organized by domain (Auth, AI, Network, etc.)
//! - **Contextual**: Errors carry rich context for debugging
//! - **User-friendly**: Display messages are clear and actionable
//! - **Retryable**: Errors indicate whether operations can be retried
//! - **Chainable**: Supports error cause chains with `#[from]`
//!
//! # Examples
//!
//! ```rust
//! use claude_rust_core::error::{AppError, AppResult, ErrorContext};
//!
//! fn authenticate() -> AppResult<String> {
//!     // Authentication logic that may fail
//!     Err(AppError::AuthenticationFailed {
//!         reason: "Invalid credentials".to_string(),
//!         provider: "claude".to_string(),
//!     })
//! }
//!
//! fn main_flow() -> AppResult<()> {
//!     let token = authenticate()
//!         .context("Failed to authenticate user")?;
//!     Ok(())
//! }
//! ```

use std::fmt;
use std::io;
use std::path::PathBuf;
use thiserror::Error;

/// Primary error type for the Claude-Rust application.
///
/// This enum represents all possible errors that can occur across different
/// subsystems. Each variant includes relevant context and implements Display
/// for user-friendly error messages.
#[derive(Debug, Error)]
pub enum AppError {
    // ============================================================================
    // Authentication Errors
    // ============================================================================

    /// Authentication failed with the AI provider
    #[error("Authentication failed: {reason}")]
    AuthenticationFailed {
        reason: String,
        provider: String,
    },

    /// OAuth flow failed or was cancelled
    #[error("OAuth authentication failed: {reason}")]
    OAuthFailed {
        reason: String,
        provider: String,
    },

    /// Token is invalid, expired, or revoked
    #[error("Invalid or expired token for provider '{provider}'")]
    InvalidToken {
        provider: String,
    },

    /// Failed to store or retrieve credentials
    #[error("Credential storage error: {reason}")]
    CredentialStorageError {
        reason: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// User is not authenticated
    #[error("Not authenticated. Please run authentication flow first")]
    NotAuthenticated,

    /// Session expired
    #[error("Session expired. Please re-authenticate")]
    SessionExpired {
        expired_at: chrono::DateTime<chrono::Utc>,
    },

    // ============================================================================
    // AI Provider Errors
    // ============================================================================

    /// AI provider API error
    #[error("AI provider error ({provider}): {message}")]
    AiProviderError {
        provider: String,
        message: String,
        status_code: Option<u16>,
    },

    /// Rate limit exceeded
    #[error("Rate limit exceeded for {provider}. Retry after {retry_after:?}")]
    RateLimitExceeded {
        provider: String,
        retry_after: Option<std::time::Duration>,
    },

    /// Model not available or not supported
    #[error("Model '{model}' not available for provider '{provider}'")]
    ModelNotAvailable {
        provider: String,
        model: String,
    },

    /// Invalid model response
    #[error("Invalid response from AI model: {reason}")]
    InvalidModelResponse {
        reason: String,
        provider: String,
    },

    /// Context length exceeded
    #[error("Context length exceeded: {current} tokens exceeds maximum of {maximum}")]
    ContextLengthExceeded {
        current: usize,
        maximum: usize,
    },

    /// Streaming error
    #[error("Stream error from {provider}: {reason}")]
    StreamError {
        provider: String,
        reason: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    // ============================================================================
    // Network Errors
    // ============================================================================

    /// Network request failed
    #[error("Network request failed: {message}")]
    NetworkError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Connection timeout
    #[error("Connection timeout after {duration:?}")]
    ConnectionTimeout {
        duration: std::time::Duration,
        endpoint: String,
    },

    /// DNS resolution failed
    #[error("DNS resolution failed for '{host}'")]
    DnsResolutionFailed {
        host: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// TLS/SSL error
    #[error("TLS/SSL error: {message}")]
    TlsError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Proxy error
    #[error("Proxy error: {message}")]
    ProxyError {
        message: String,
    },

    // ============================================================================
    // Configuration Errors
    // ============================================================================

    /// Configuration file not found
    #[error("Configuration file not found: {}", path.display())]
    ConfigNotFound {
        path: PathBuf,
    },

    /// Invalid configuration
    #[error("Invalid configuration: {reason}")]
    InvalidConfig {
        reason: String,
        field: Option<String>,
    },

    /// Configuration parse error
    #[error("Failed to parse configuration file: {}", path.display())]
    ConfigParseError {
        path: PathBuf,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    /// Missing required configuration
    #[error("Missing required configuration: {field}")]
    MissingConfig {
        field: String,
    },

    // ============================================================================
    // IO Errors
    // ============================================================================

    /// File not found
    #[error("File not found: {}", path.display())]
    FileNotFound {
        path: PathBuf,
    },

    /// Permission denied
    #[error("Permission denied accessing: {}", path.display())]
    PermissionDenied {
        path: PathBuf,
        operation: String,
    },

    /// File read error
    #[error("Failed to read file: {}", path.display())]
    FileReadError {
        path: PathBuf,
        #[source]
        source: io::Error,
    },

    /// File write error
    #[error("Failed to write file: {}", path.display())]
    FileWriteError {
        path: PathBuf,
        #[source]
        source: io::Error,
    },

    /// Directory creation error
    #[error("Failed to create directory: {}", path.display())]
    DirectoryCreationError {
        path: PathBuf,
        #[source]
        source: io::Error,
    },

    /// Generic IO error
    #[error("IO error: {message}")]
    IoError {
        message: String,
        #[source]
        source: io::Error,
    },

    // ============================================================================
    // Terminal Errors
    // ============================================================================

    /// Terminal initialization failed
    #[error("Failed to initialize terminal: {reason}")]
    TerminalInitError {
        reason: String,
    },

    /// Terminal not supported
    #[error("Terminal not supported: {reason}")]
    TerminalNotSupported {
        reason: String,
    },

    /// Terminal size detection failed
    #[error("Failed to detect terminal size")]
    TerminalSizeError,

    /// Terminal input error
    #[error("Terminal input error: {reason}")]
    TerminalInputError {
        reason: String,
    },

    /// Terminal output error
    #[error("Terminal output error: {reason}")]
    TerminalOutputError {
        reason: String,
    },

    // ============================================================================
    // Validation Errors
    // ============================================================================

    /// Invalid input provided
    #[error("Invalid input: {message}")]
    InvalidInput {
        message: String,
        field: Option<String>,
    },

    /// Validation failed
    #[error("Validation failed for '{field}': {reason}")]
    ValidationFailed {
        field: String,
        reason: String,
    },

    /// JSON parsing error
    #[error("JSON parsing error: {message}")]
    JsonParseError {
        message: String,
        #[source]
        source: serde_json::Error,
    },

    /// Serialization error
    #[error("Serialization error: {message}")]
    SerializationError {
        message: String,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },

    // ============================================================================
    // Command Execution Errors
    // ============================================================================

    /// Command execution failed
    #[error("Command execution failed: {command}")]
    CommandExecutionFailed {
        command: String,
        exit_code: Option<i32>,
        stderr: String,
    },

    /// Command not found
    #[error("Command not found: {command}")]
    CommandNotFound {
        command: String,
    },

    /// Command timeout
    #[error("Command timed out after {duration:?}: {command}")]
    CommandTimeout {
        command: String,
        duration: std::time::Duration,
    },

    // ============================================================================
    // Application Errors
    // ============================================================================

    /// Feature not implemented
    #[error("Feature not yet implemented: {feature}")]
    NotImplemented {
        feature: String,
    },

    /// Internal error (should not happen)
    #[error("Internal error: {message}")]
    Internal {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Operation cancelled by user
    #[error("Operation cancelled")]
    Cancelled,

    /// Resource not found
    #[error("Resource not found: {resource}")]
    ResourceNotFound {
        resource: String,
    },

    /// Resource already exists
    #[error("Resource already exists: {resource}")]
    ResourceAlreadyExists {
        resource: String,
    },

    /// Initialization error
    #[error("Initialization failed: {component}")]
    InitializationFailed {
        component: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl AppError {
    /// Returns true if this error represents a transient failure that can be retried.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use claude_rust_core::error::AppError;
    ///
    /// let error = AppError::ConnectionTimeout {
    ///     duration: std::time::Duration::from_secs(30),
    ///     endpoint: "api.anthropic.com".to_string(),
    /// };
    /// assert!(error.is_retryable());
    /// ```
    pub fn is_retryable(&self) -> bool {
        match self {
            // Network errors are generally retryable
            Self::NetworkError { .. }
            | Self::ConnectionTimeout { .. }
            | Self::DnsResolutionFailed { .. } => true,

            // Rate limits are retryable after waiting
            Self::RateLimitExceeded { .. } => true,

            // Some AI provider errors are retryable (5xx status codes)
            Self::AiProviderError { status_code: Some(code), .. } => {
                *code >= 500 && *code < 600
            }

            // Timeouts are retryable
            Self::CommandTimeout { .. } => true,

            // Session expiry requires re-auth but is recoverable
            Self::SessionExpired { .. } => true,

            // All other errors are not retryable by default
            _ => false,
        }
    }

    /// Returns the error category for classification and metrics.
    ///
    /// This is useful for aggregating errors by type in monitoring systems.
    pub fn category(&self) -> ErrorCategory {
        match self {
            Self::AuthenticationFailed { .. }
            | Self::OAuthFailed { .. }
            | Self::InvalidToken { .. }
            | Self::CredentialStorageError { .. }
            | Self::NotAuthenticated
            | Self::SessionExpired { .. } => ErrorCategory::Authentication,

            Self::AiProviderError { .. }
            | Self::RateLimitExceeded { .. }
            | Self::ModelNotAvailable { .. }
            | Self::InvalidModelResponse { .. }
            | Self::ContextLengthExceeded { .. }
            | Self::StreamError { .. } => ErrorCategory::AiProvider,

            Self::NetworkError { .. }
            | Self::ConnectionTimeout { .. }
            | Self::DnsResolutionFailed { .. }
            | Self::TlsError { .. }
            | Self::ProxyError { .. } => ErrorCategory::Network,

            Self::ConfigNotFound { .. }
            | Self::InvalidConfig { .. }
            | Self::ConfigParseError { .. }
            | Self::MissingConfig { .. } => ErrorCategory::Configuration,

            Self::FileNotFound { .. }
            | Self::PermissionDenied { .. }
            | Self::FileReadError { .. }
            | Self::FileWriteError { .. }
            | Self::DirectoryCreationError { .. }
            | Self::IoError { .. } => ErrorCategory::Io,

            Self::TerminalInitError { .. }
            | Self::TerminalNotSupported { .. }
            | Self::TerminalSizeError
            | Self::TerminalInputError { .. }
            | Self::TerminalOutputError { .. } => ErrorCategory::Terminal,

            Self::InvalidInput { .. }
            | Self::ValidationFailed { .. }
            | Self::JsonParseError { .. }
            | Self::SerializationError { .. } => ErrorCategory::Validation,

            Self::CommandExecutionFailed { .. }
            | Self::CommandNotFound { .. }
            | Self::CommandTimeout { .. } => ErrorCategory::CommandExecution,

            Self::NotImplemented { .. }
            | Self::Internal { .. }
            | Self::Cancelled
            | Self::ResourceNotFound { .. }
            | Self::ResourceAlreadyExists { .. }
            | Self::InitializationFailed { .. } => ErrorCategory::Application,
        }
    }

    /// Returns a user-friendly error message with suggested actions.
    ///
    /// This provides actionable guidance for users to resolve the error.
    pub fn user_message(&self) -> String {
        match self {
            Self::AuthenticationFailed { provider, .. } => {
                format!("Failed to authenticate with {}. Please check your credentials and try again.", provider)
            }
            Self::NotAuthenticated => {
                "You are not authenticated. Please run the authentication flow.".to_string()
            }
            Self::SessionExpired { .. } => {
                "Your session has expired. Please re-authenticate.".to_string()
            }
            Self::RateLimitExceeded { provider, retry_after } => {
                if let Some(duration) = retry_after {
                    format!(
                        "Rate limit exceeded for {}. Please wait {} seconds and try again.",
                        provider,
                        duration.as_secs()
                    )
                } else {
                    format!("Rate limit exceeded for {}. Please wait and try again.", provider)
                }
            }
            Self::ConnectionTimeout { endpoint, .. } => {
                format!("Connection to {} timed out. Please check your internet connection and try again.", endpoint)
            }
            Self::FileNotFound { path } => {
                format!("File not found: {}. Please check the file path.", path.display())
            }
            Self::PermissionDenied { path, operation } => {
                format!("Permission denied to {} {}. Please check file permissions.", operation, path.display())
            }
            Self::ConfigNotFound { path } => {
                format!("Configuration file not found: {}. Please create the configuration file.", path.display())
            }
            Self::InvalidConfig { reason, .. } => {
                format!("Invalid configuration: {}. Please check your configuration file.", reason)
            }
            Self::CommandNotFound { command } => {
                format!("Command '{}' not found. Please ensure it is installed and in your PATH.", command)
            }
            _ => self.to_string(),
        }
    }

    /// Returns suggested resolution steps for this error.
    pub fn resolution_steps(&self) -> Vec<String> {
        match self {
            Self::AuthenticationFailed { provider, .. } => vec![
                format!("1. Verify your {} API credentials", provider),
                "2. Check your internet connection".to_string(),
                "3. Try re-authenticating with the login command".to_string(),
            ],
            Self::NotAuthenticated => vec![
                "1. Run the authentication command to log in".to_string(),
                "2. Follow the OAuth flow in your browser".to_string(),
            ],
            Self::RateLimitExceeded { retry_after, .. } => {
                let wait_time = retry_after
                    .map(|d| format!("{} seconds", d.as_secs()))
                    .unwrap_or_else(|| "a few minutes".to_string());
                vec![
                    format!("1. Wait {} before retrying", wait_time),
                    "2. Consider upgrading your API plan for higher limits".to_string(),
                ]
            }
            Self::ConnectionTimeout { .. } => vec![
                "1. Check your internet connection".to_string(),
                "2. Verify firewall settings".to_string(),
                "3. Try again in a few moments".to_string(),
            ],
            Self::FileNotFound { path } => vec![
                format!("1. Verify the file exists at: {}", path.display()),
                "2. Check the file path for typos".to_string(),
                "3. Ensure you have the correct working directory".to_string(),
            ],
            Self::PermissionDenied { path, .. } => vec![
                format!("1. Check file permissions for: {}", path.display()),
                "2. Run with appropriate privileges if needed".to_string(),
                "3. Verify file ownership".to_string(),
            ],
            _ => vec!["Please check the error message for details".to_string()],
        }
    }
}

/// Error category for classification and metrics
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCategory {
    Authentication,
    AiProvider,
    Network,
    Configuration,
    Io,
    Terminal,
    Validation,
    CommandExecution,
    Application,
}

impl fmt::Display for ErrorCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Authentication => write!(f, "Authentication"),
            Self::AiProvider => write!(f, "AI Provider"),
            Self::Network => write!(f, "Network"),
            Self::Configuration => write!(f, "Configuration"),
            Self::Io => write!(f, "I/O"),
            Self::Terminal => write!(f, "Terminal"),
            Self::Validation => write!(f, "Validation"),
            Self::CommandExecution => write!(f, "Command Execution"),
            Self::Application => write!(f, "Application"),
        }
    }
}

/// Result type alias for operations that can fail with an `AppError`.
///
/// This is the primary result type used throughout the application.
///
/// # Examples
///
/// ```rust
/// use claude_rust_core::error::AppResult;
///
/// fn do_something() -> AppResult<String> {
///     Ok("success".to_string())
/// }
/// ```
pub type AppResult<T> = Result<T, AppError>;

// ============================================================================
// Error Conversions
// ============================================================================

impl From<io::Error> for AppError {
    fn from(err: io::Error) -> Self {
        match err.kind() {
            io::ErrorKind::NotFound => {
                // Try to extract path from error message if possible
                Self::IoError {
                    message: "File or resource not found".to_string(),
                    source: err,
                }
            }
            io::ErrorKind::PermissionDenied => {
                Self::IoError {
                    message: "Permission denied".to_string(),
                    source: err,
                }
            }
            io::ErrorKind::TimedOut => {
                Self::IoError {
                    message: "Operation timed out".to_string(),
                    source: err,
                }
            }
            _ => Self::IoError {
                message: "IO operation failed".to_string(),
                source: err,
            },
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        Self::JsonParseError {
            message: err.to_string(),
            source: err,
        }
    }
}

impl From<std::string::FromUtf8Error> for AppError {
    fn from(err: std::string::FromUtf8Error) -> Self {
        Self::ValidationFailed {
            field: "utf8_string".to_string(),
            reason: err.to_string(),
        }
    }
}

// ============================================================================
// Error Context Extension
// ============================================================================

/// Extension trait for adding context to errors.
///
/// This trait allows chaining context information to errors, making them
/// more informative for debugging.
///
/// # Examples
///
/// ```rust
/// use claude_rust_core::error::{AppError, AppResult, ErrorContext};
///
/// fn read_config() -> AppResult<String> {
///     std::fs::read_to_string("config.toml")
///         .map_err(AppError::from)
///         .context("Failed to read configuration file")?;
///     Ok("config".to_string())
/// }
/// ```
pub trait ErrorContext<T> {
    /// Add context to an error.
    fn context<C>(self, context: C) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static;

    /// Add context to an error using a lazy evaluation function.
    fn with_context<C, F>(self, f: F) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static,
        F: FnOnce() -> C;
}

impl<T, E> ErrorContext<T> for Result<T, E>
where
    E: Into<AppError>,
{
    fn context<C>(self, context: C) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static,
    {
        self.map_err(|e| {
            let app_error = e.into();
            AppError::Internal {
                message: format!("{}: {}", context, app_error),
                source: Some(Box::new(app_error)),
            }
        })
    }

    fn with_context<C, F>(self, f: F) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static,
        F: FnOnce() -> C,
    {
        self.map_err(|e| {
            let app_error = e.into();
            let context = f();
            AppError::Internal {
                message: format!("{}: {}", context, app_error),
                source: Some(Box::new(app_error)),
            }
        })
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Create an IO error with a specific path context.
pub fn io_error_with_path(err: io::Error, path: PathBuf) -> AppError {
    match err.kind() {
        io::ErrorKind::NotFound => AppError::FileNotFound { path },
        io::ErrorKind::PermissionDenied => AppError::PermissionDenied {
            path,
            operation: "access".to_string(),
        },
        _ => AppError::IoError {
            message: format!("IO error for path: {}", path.display()),
            source: err,
        },
    }
}

/// Create a network error from a generic error source.
pub fn network_error<E>(message: impl Into<String>, source: E) -> AppError
where
    E: std::error::Error + Send + Sync + 'static,
{
    AppError::NetworkError {
        message: message.into(),
        source: Some(Box::new(source)),
    }
}

/// Helper functions for creating common errors
impl AppError {
    /// Create a file not found error
    pub fn file_not_found<P: AsRef<std::path::Path>>(path: P) -> Self {
        Self::FileNotFound {
            path: path.as_ref().to_path_buf(),
        }
    }

    /// Create a generic IO error
    pub fn io_error(message: impl Into<String>) -> Self {
        let msg = message.into();
        Self::IoError {
            message: msg.clone(),
            source: std::io::Error::new(std::io::ErrorKind::Other, msg),
        }
    }

    /// Create a validation error
    pub fn validation_error(message: impl Into<String>) -> Self {
        Self::InvalidInput {
            message: message.into(),
            field: None,
        }
    }

    /// Create a parse error
    pub fn parse_error(message: impl Into<String>) -> Self {
        Self::InvalidInput {
            message: message.into(),
            field: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_category() {
        let error = AppError::AuthenticationFailed {
            reason: "Invalid token".to_string(),
            provider: "claude".to_string(),
        };
        assert_eq!(error.category(), ErrorCategory::Authentication);

        let error = AppError::NetworkError {
            message: "Connection failed".to_string(),
            source: None,
        };
        assert_eq!(error.category(), ErrorCategory::Network);
    }

    #[test]
    fn test_is_retryable() {
        let error = AppError::ConnectionTimeout {
            duration: std::time::Duration::from_secs(30),
            endpoint: "api.example.com".to_string(),
        };
        assert!(error.is_retryable());

        let error = AppError::AuthenticationFailed {
            reason: "Invalid credentials".to_string(),
            provider: "claude".to_string(),
        };
        assert!(!error.is_retryable());

        let error = AppError::RateLimitExceeded {
            provider: "claude".to_string(),
            retry_after: Some(std::time::Duration::from_secs(60)),
        };
        assert!(error.is_retryable());
    }

    #[test]
    fn test_error_display() {
        let error = AppError::FileNotFound {
            path: PathBuf::from("/tmp/config.toml"),
        };
        let message = format!("{}", error);
        assert!(message.contains("File not found"));
        assert!(message.contains("/tmp/config.toml"));
    }

    #[test]
    fn test_user_message() {
        let error = AppError::NotAuthenticated;
        let message = error.user_message();
        assert!(message.contains("not authenticated"));
        assert!(message.contains("authentication flow"));
    }

    #[test]
    fn test_resolution_steps() {
        let error = AppError::ConnectionTimeout {
            duration: std::time::Duration::from_secs(30),
            endpoint: "api.example.com".to_string(),
        };
        let steps = error.resolution_steps();
        assert!(!steps.is_empty());
        assert!(steps.iter().any(|s| s.contains("internet connection")));
    }

    #[test]
    fn test_error_context() {
        fn inner_function() -> AppResult<()> {
            Err(AppError::FileNotFound {
                path: PathBuf::from("test.txt"),
            })
        }

        fn outer_function() -> AppResult<()> {
            inner_function().context("Failed to process file")?;
            Ok(())
        }

        let result = outer_function();
        assert!(result.is_err());
        let err = result.unwrap_err();
        let message = format!("{}", err);
        assert!(message.contains("Failed to process file"));
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let app_err = AppError::from(io_err);
        assert!(matches!(app_err, AppError::IoError { .. }));
    }

    #[test]
    fn test_json_error_conversion() {
        let json_err = serde_json::from_str::<serde_json::Value>("invalid json").unwrap_err();
        let app_err = AppError::from(json_err);
        assert!(matches!(app_err, AppError::JsonParseError { .. }));
    }

    #[test]
    fn test_error_category_display() {
        assert_eq!(ErrorCategory::Authentication.to_string(), "Authentication");
        assert_eq!(ErrorCategory::Network.to_string(), "Network");
        assert_eq!(ErrorCategory::AiProvider.to_string(), "AI Provider");
    }
}
