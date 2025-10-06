//! Network Utilities
//!
//! Provides network-related utility functions including HTTP client creation,
//! timeout wrappers, retry logic with exponential backoff, and connectivity checks.
//!
//! # Features
//!
//! - Configured HTTP client creation
//! - Timeout wrappers for async operations
//! - Retry logic with exponential backoff
//! - Connectivity checks
//! - Request/response helpers
//!
//! # Examples
//!
//! ```rust
//! use claude_rust_utils::network::*;
//! use std::time::Duration;
//!
//! #[tokio::main]
//! async fn main() {
//!     // Create a client
//!     let client = create_client().unwrap();
//!
//!     // Use with_timeout to add a timeout to any async operation
//!     let result = with_timeout(
//!         Duration::from_secs(5),
//!         async { client.get("https://example.com").send().await }
//!     ).await;
//!
//!     // Use retry_with_backoff for automatic retries
//!     let result = retry_with_backoff(
//!         3,
//!         Duration::from_millis(100),
//!         || async { client.get("https://example.com").send().await }
//!     ).await;
//! }
//! ```

use crate::error::{UtilsError, UtilsResult};
use reqwest::Client;
use std::future::Future;
use std::time::Duration;
use tokio::time::{sleep, timeout};
use tracing::{debug, warn};

/// Default timeout for HTTP requests (30 seconds)
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Default user agent string
pub const DEFAULT_USER_AGENT: &str = concat!("claude-code/", env!("CARGO_PKG_VERSION"));

/// Create a configured HTTP client with default settings
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::create_client;
///
/// let client = create_client().unwrap();
/// ```
pub fn create_client() -> UtilsResult<Client> {
    create_client_with_timeout(DEFAULT_TIMEOUT)
}

/// Create a configured HTTP client with custom timeout
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::create_client_with_timeout;
/// use std::time::Duration;
///
/// let client = create_client_with_timeout(Duration::from_secs(60)).unwrap();
/// ```
pub fn create_client_with_timeout(timeout_duration: Duration) -> UtilsResult<Client> {
    let client = Client::builder()
        .timeout(timeout_duration)
        .user_agent(DEFAULT_USER_AGENT)
        .pool_max_idle_per_host(10)
        .pool_idle_timeout(Duration::from_secs(90))
        .build()?;

    Ok(client)
}

/// Test if a URL is reachable
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::is_reachable;
///
/// #[tokio::main]
/// async fn main() {
///     let reachable = is_reachable("https://example.com").await;
///     println!("Reachable: {}", reachable);
/// }
/// ```
pub async fn is_reachable(url: &str) -> bool {
    match create_client() {
        Ok(client) => client.head(url).send().await.is_ok(),
        Err(_) => false,
    }
}

/// Wrap an async operation with a timeout
///
/// Returns an error if the operation doesn't complete within the specified duration.
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::with_timeout;
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() {
///     let result = with_timeout(
///         Duration::from_secs(5),
///         async {
///             // Some async operation
///             tokio::time::sleep(Duration::from_secs(1)).await;
///             Ok::<_, String>("done")
///         }
///     ).await;
///
///     assert!(result.is_ok());
/// }
/// ```
pub async fn with_timeout<F, T, E>(
    duration: Duration,
    future: F,
) -> Result<T, UtilsError>
where
    F: Future<Output = Result<T, E>>,
    E: std::error::Error + Send + Sync + 'static,
{
    match timeout(duration, future).await {
        Ok(Ok(result)) => Ok(result),
        Ok(Err(e)) => Err(UtilsError::Utility(format!("Operation failed: {}", e))),
        Err(_) => Err(UtilsError::Utility(format!(
            "Operation timed out after {:?}",
            duration
        ))),
    }
}

/// Retry configuration for retry_with_backoff
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: usize,
    /// Initial delay between retries
    pub initial_delay: Duration,
    /// Maximum delay between retries
    pub max_delay: Duration,
    /// Backoff multiplier (e.g., 2.0 for exponential backoff)
    pub backoff_multiplier: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
        }
    }
}

impl RetryConfig {
    /// Create a new retry configuration
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the maximum number of retries
    pub fn with_max_retries(mut self, max_retries: usize) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Set the initial delay
    pub fn with_initial_delay(mut self, delay: Duration) -> Self {
        self.initial_delay = delay;
        self
    }

    /// Set the maximum delay
    pub fn with_max_delay(mut self, delay: Duration) -> Self {
        self.max_delay = delay;
        self
    }

    /// Set the backoff multiplier
    pub fn with_backoff_multiplier(mut self, multiplier: f64) -> Self {
        self.backoff_multiplier = multiplier;
        self
    }
}

/// Retry an async operation with exponential backoff
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::retry_with_backoff;
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() {
///     let result = retry_with_backoff(
///         3,
///         Duration::from_millis(100),
///         || async {
///             // Some operation that might fail
///             Ok::<_, String>("success")
///         }
///     ).await;
///
///     assert!(result.is_ok());
/// }
/// ```
pub async fn retry_with_backoff<F, Fut, T, E>(
    max_retries: usize,
    initial_delay: Duration,
    operation: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let config = RetryConfig::default()
        .with_max_retries(max_retries)
        .with_initial_delay(initial_delay);

    retry_with_config(config, operation).await
}

/// Retry an async operation with custom retry configuration
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::{retry_with_config, RetryConfig};
/// use std::time::Duration;
///
/// #[tokio::main]
/// async fn main() {
///     let config = RetryConfig::new()
///         .with_max_retries(5)
///         .with_initial_delay(Duration::from_millis(50))
///         .with_backoff_multiplier(1.5);
///
///     let result = retry_with_config(
///         config,
///         || async {
///             Ok::<_, String>("success")
///         }
///     ).await;
///
///     assert!(result.is_ok());
/// }
/// ```
pub async fn retry_with_config<F, Fut, T, E>(
    config: RetryConfig,
    mut operation: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, E>>,
{
    let mut attempt = 0;
    let mut delay = config.initial_delay;

    loop {
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    debug!("Operation succeeded after {} retries", attempt);
                }
                return Ok(result);
            }
            Err(e) => {
                attempt += 1;

                if attempt > config.max_retries {
                    warn!("Operation failed after {} retries", config.max_retries);
                    return Err(e);
                }

                debug!(
                    "Attempt {} failed, retrying in {:?}...",
                    attempt, delay
                );

                sleep(delay).await;

                // Calculate next delay with exponential backoff
                delay = Duration::from_millis(
                    (delay.as_millis() as f64 * config.backoff_multiplier) as u64
                );
                delay = delay.min(config.max_delay);
            }
        }
    }
}

/// Check if a network error is retryable
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::network::is_retryable_error;
/// use reqwest::Error;
///
/// // This is just a conceptual example
/// fn check_error(err: &reqwest::Error) -> bool {
///     is_retryable_error(err)
/// }
/// ```
pub fn is_retryable_error(error: &reqwest::Error) -> bool {
    // Timeout errors are retryable
    if error.is_timeout() {
        return true;
    }

    // Connection errors are retryable
    if error.is_connect() {
        return true;
    }

    // Check status code if available
    if let Some(status) = error.status() {
        // 5xx errors are retryable
        if status.is_server_error() {
            return true;
        }

        // 429 (Too Many Requests) is retryable
        if status.as_u16() == 429 {
            return true;
        }

        // 408 (Request Timeout) is retryable
        if status.as_u16() == 408 {
            return true;
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_client() {
        let result = create_client();
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_client_with_timeout() {
        let result = create_client_with_timeout(Duration::from_secs(60));
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_with_timeout_success() {
        let result = with_timeout(Duration::from_secs(5), async {
            sleep(Duration::from_millis(10)).await;
            Ok::<_, String>("done")
        })
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_with_timeout_timeout() {
        let result = with_timeout(Duration::from_millis(10), async {
            sleep(Duration::from_secs(10)).await;
            Ok::<_, String>("done")
        })
        .await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_retry_with_backoff_success() {
        let result = retry_with_backoff(3, Duration::from_millis(10), || async {
            Ok::<_, String>("success")
        })
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_retry_with_backoff_eventual_success() {
        let mut attempts = 0;
        let result = retry_with_backoff(3, Duration::from_millis(10), || async {
            attempts += 1;
            if attempts < 3 {
                Err("not yet")
            } else {
                Ok::<_, &str>("success")
            }
        })
        .await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_retry_with_backoff_failure() {
        let result = retry_with_backoff(2, Duration::from_millis(10), || async {
            Err::<String, _>("always fails")
        })
        .await;

        assert!(result.is_err());
    }

    #[test]
    fn test_retry_config_builder() {
        let config = RetryConfig::new()
            .with_max_retries(5)
            .with_initial_delay(Duration::from_millis(50))
            .with_backoff_multiplier(1.5);

        assert_eq!(config.max_retries, 5);
        assert_eq!(config.initial_delay, Duration::from_millis(50));
        assert_eq!(config.backoff_multiplier, 1.5);
    }
}
