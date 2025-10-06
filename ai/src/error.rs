use thiserror::Error;

pub type AIResult<T> = std::result::Result<T, AIError>;

/// Comprehensive AI error types
#[derive(Debug, Error)]
pub enum AIError {
    /// Provider-specific error
    #[error("Provider error: {0}")]
    Provider(String),

    /// API error with status code and message
    #[error("API error [{status}]: {message}")]
    Api {
        status: u16,
        message: String,
        provider: String,
    },

    /// Network/HTTP error
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    /// Serialization/deserialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Invalid response format
    #[error("Invalid response: {0}")]
    InvalidResponse(String),

    /// Rate limit exceeded with retry information
    #[error("Rate limit exceeded. Retry after {retry_after:?} seconds")]
    RateLimitExceeded {
        retry_after: Option<u64>,
        provider: String,
    },

    /// Authentication error
    #[error("Authentication error: {0}")]
    Auth(String),

    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Model not found or not available
    #[error("Model not found: {0}")]
    ModelNotFound(String),

    /// Request timeout
    #[error("Request timeout after {0} seconds")]
    Timeout(u64),

    /// Invalid request parameters
    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    /// Streaming error
    #[error("Streaming error: {0}")]
    Stream(String),

    /// Token limit exceeded
    #[error("Token limit exceeded: requested {requested}, max {max}")]
    TokenLimitExceeded { requested: u32, max: u32 },

    /// Content filtering/moderation error
    #[error("Content filtered: {0}")]
    ContentFiltered(String),

    /// Service unavailable
    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),

    /// Core error from workspace
    #[error("Core error: {0}")]
    Core(#[from] claude_code_core::AppError),

    /// Auth error from workspace
    #[error("Auth error: {0}")]
    AuthError(#[from] claude_code_auth::AuthError),

    /// URL parse error
    #[error("URL parse error: {0}")]
    UrlParse(#[from] url::ParseError),

    /// IO error
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl AIError {
    /// Create a provider error
    pub fn provider(msg: impl Into<String>) -> Self {
        Self::Provider(msg.into())
    }

    /// Create an API error
    pub fn api(status: u16, message: impl Into<String>, provider: impl Into<String>) -> Self {
        Self::Api {
            status,
            message: message.into(),
            provider: provider.into(),
        }
    }

    /// Create a rate limit error
    pub fn rate_limit(retry_after: Option<u64>, provider: impl Into<String>) -> Self {
        Self::RateLimitExceeded {
            retry_after,
            provider: provider.into(),
        }
    }

    /// Create an auth error
    pub fn auth(msg: impl Into<String>) -> Self {
        Self::Auth(msg.into())
    }

    /// Create an invalid config error
    pub fn invalid_config(msg: impl Into<String>) -> Self {
        Self::InvalidConfig(msg.into())
    }

    /// Create a model not found error
    pub fn model_not_found(model: impl Into<String>) -> Self {
        Self::ModelNotFound(model.into())
    }

    /// Create a timeout error
    pub fn timeout(seconds: u64) -> Self {
        Self::Timeout(seconds)
    }

    /// Create an invalid request error
    pub fn invalid_request(msg: impl Into<String>) -> Self {
        Self::InvalidRequest(msg.into())
    }

    /// Create a stream error
    pub fn stream(msg: impl Into<String>) -> Self {
        Self::Stream(msg.into())
    }

    /// Create a token limit error
    pub fn token_limit(requested: u32, max: u32) -> Self {
        Self::TokenLimitExceeded { requested, max }
    }

    /// Create a content filtered error
    pub fn content_filtered(msg: impl Into<String>) -> Self {
        Self::ContentFiltered(msg.into())
    }

    /// Create a service unavailable error
    pub fn service_unavailable(msg: impl Into<String>) -> Self {
        Self::ServiceUnavailable(msg.into())
    }

    /// Create an internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Network(_) => true,
            Self::Timeout(_) => true,
            Self::ServiceUnavailable(_) => true,
            Self::RateLimitExceeded { .. } => true,
            Self::Api { status, .. } if *status >= 500 => true,
            _ => false,
        }
    }

    /// Get retry delay in seconds
    pub fn retry_delay(&self) -> Option<u64> {
        match self {
            Self::RateLimitExceeded { retry_after, .. } => *retry_after,
            Self::ServiceUnavailable(_) => Some(5),
            Self::Api { status, .. } if *status >= 500 => Some(2),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = AIError::provider("test error");
        assert!(matches!(err, AIError::Provider(_)));

        let err = AIError::api(404, "not found", "claude");
        assert!(matches!(err, AIError::Api { status: 404, .. }));

        let err = AIError::rate_limit(Some(60), "openai");
        assert!(matches!(
            err,
            AIError::RateLimitExceeded {
                retry_after: Some(60),
                ..
            }
        ));
    }

    #[test]
    fn test_is_retryable() {
        let err = AIError::timeout(30);
        assert!(err.is_retryable());

        let err = AIError::api(500, "server error", "claude");
        assert!(err.is_retryable());

        let err = AIError::api(400, "bad request", "claude");
        assert!(!err.is_retryable());

        let err = AIError::auth("invalid key");
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_retry_delay() {
        let err = AIError::rate_limit(Some(60), "openai");
        assert_eq!(err.retry_delay(), Some(60));

        let err = AIError::service_unavailable("maintenance");
        assert_eq!(err.retry_delay(), Some(5));

        let err = AIError::auth("invalid key");
        assert_eq!(err.retry_delay(), None);
    }
}
