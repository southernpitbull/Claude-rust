//! Retry Logic with Exponential Backoff
//!
//! Provides retry functionality with configurable backoff strategies
//! for handling transient failures.

use std::time::Duration;
use tokio::time::sleep;

use crate::error::{AppError, AppResult};

/// Retry policy configuration
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    /// Maximum number of retry attempts
    pub max_attempts: u32,
    /// Initial delay before first retry
    pub initial_delay: Duration,
    /// Maximum delay between retries
    pub max_delay: Duration,
    /// Backoff multiplier (for exponential backoff)
    pub backoff_multiplier: f64,
    /// Whether to add jitter to delays
    pub use_jitter: bool,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(30),
            backoff_multiplier: 2.0,
            use_jitter: true,
        }
    }
}

impl RetryPolicy {
    /// Create a new retry policy with exponential backoff
    pub fn exponential(max_attempts: u32) -> Self {
        Self {
            max_attempts,
            ..Default::default()
        }
    }

    /// Create a new retry policy with fixed delay
    pub fn fixed(max_attempts: u32, delay: Duration) -> Self {
        Self {
            max_attempts,
            initial_delay: delay,
            max_delay: delay,
            backoff_multiplier: 1.0,
            use_jitter: false,
        }
    }

    /// Create a new retry policy with linear backoff
    pub fn linear(max_attempts: u32) -> Self {
        Self {
            max_attempts,
            backoff_multiplier: 1.0,
            ..Default::default()
        }
    }

    /// Calculate delay for a given attempt
    fn calculate_delay(&self, attempt: u32) -> Duration {
        let delay_ms = if self.backoff_multiplier > 1.0 {
            // Exponential backoff
            let base_delay = self.initial_delay.as_millis() as f64;
            let delay = base_delay * self.backoff_multiplier.powi(attempt as i32);
            delay as u64
        } else {
            // Linear or fixed backoff
            self.initial_delay.as_millis() as u64 * (attempt as u64 + 1)
        };

        let delay = Duration::from_millis(delay_ms);
        let delay = std::cmp::min(delay, self.max_delay);

        if self.use_jitter {
            add_jitter(delay)
        } else {
            delay
        }
    }
}

/// Add jitter to a duration to avoid thundering herd
fn add_jitter(duration: Duration) -> Duration {
    // Simple jitter based on hash to avoid rand dependency
    use std::collections::hash_map::RandomState;
    use std::hash::{BuildHasher, Hash, Hasher};

    let rs = RandomState::new();
    let mut hasher = rs.build_hasher();
    duration.as_millis().hash(&mut hasher);
    let hash_value = hasher.finish();

    // Use hash to generate jitter between 0-30%
    let jitter_percent = (hash_value % 30) as f64 / 100.0;
    let multiplier = 1.0 + jitter_percent;
    Duration::from_millis((duration.as_millis() as f64 * multiplier) as u64)
}

/// Execute an async function with retry logic
pub async fn retry_with_policy<F, T, Fut>(
    policy: &RetryPolicy,
    mut operation: F,
) -> AppResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    let mut last_error = None;

    for attempt in 0..policy.max_attempts {
        match operation().await {
            Ok(result) => {
                if attempt > 0 {
                    tracing::info!("Operation succeeded after {} retries", attempt);
                }
                return Ok(result);
            }
            Err(err) => {
                // Check if error is retryable
                if !err.is_retryable() {
                    tracing::debug!("Error is not retryable: {}", err);
                    return Err(err);
                }

                tracing::warn!(
                    "Operation failed (attempt {}/{}): {}",
                    attempt + 1,
                    policy.max_attempts,
                    err
                );

                last_error = Some(err);

                // If this isn't the last attempt, wait before retrying
                if attempt < policy.max_attempts - 1 {
                    let delay = policy.calculate_delay(attempt);
                    tracing::debug!("Retrying after {:?}", delay);
                    sleep(delay).await;
                }
            }
        }
    }

    // All retries exhausted
    Err(last_error.unwrap_or_else(|| AppError::Internal {
        message: "Retry failed with no error".to_string(),
        source: None,
    }))
}

/// Execute an async function with default retry policy (3 attempts, exponential backoff)
pub async fn retry<F, T, Fut>(operation: F) -> AppResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    retry_with_policy(&RetryPolicy::default(), operation).await
}

/// Execute an async function with exponential backoff retry
pub async fn retry_exponential<F, T, Fut>(
    max_attempts: u32,
    operation: F,
) -> AppResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    retry_with_policy(&RetryPolicy::exponential(max_attempts), operation).await
}

/// Execute an async function with fixed delay retry
pub async fn retry_fixed<F, T, Fut>(
    max_attempts: u32,
    delay: Duration,
    operation: F,
) -> AppResult<T>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = AppResult<T>>,
{
    retry_with_policy(&RetryPolicy::fixed(max_attempts, delay), operation).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_retry_succeeds_on_second_attempt() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();

        let result: Result<(), AppError> = retry_with_policy(
            &RetryPolicy::exponential(3),
            || {
                let counter = counter_clone.clone();
                async move {
                    let count = counter.fetch_add(1, Ordering::SeqCst);
                    if count == 0 {
                        Err(AppError::NetworkError {
                            message: "Simulated network error".to_string(),
                            source: None,
                        })
                    } else {
                        Ok(())
                    }
                }
            },
        )
        .await;

        assert!(result.is_ok());
        assert_eq!(counter.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn test_retry_fails_after_max_attempts() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();

        let result: Result<(), AppError> = retry_with_policy(
            &RetryPolicy::exponential(3),
            || {
                let counter = counter_clone.clone();
                async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                    Err(AppError::NetworkError {
                        message: "Simulated network error".to_string(),
                        source: None,
                    })
                }
            },
        )
        .await;

        assert!(result.is_err());
        assert_eq!(counter.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn test_non_retryable_error() {
        let counter = Arc::new(AtomicU32::new(0));
        let counter_clone = counter.clone();

        let result: Result<(), AppError> = retry_with_policy(
            &RetryPolicy::exponential(3),
            || {
                let counter = counter_clone.clone();
                async move {
                    counter.fetch_add(1, Ordering::SeqCst);
                    Err(AppError::AuthenticationFailed {
                        reason: "Invalid credentials".to_string(),
                        provider: "test".to_string(),
                    })
                }
            },
        )
        .await;

        assert!(result.is_err());
        // Should only be called once since error is not retryable
        assert_eq!(counter.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn test_delay_calculation() {
        let policy = RetryPolicy {
            max_attempts: 5,
            initial_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(10),
            backoff_multiplier: 2.0,
            use_jitter: false,
        };

        // Test exponential backoff
        assert_eq!(policy.calculate_delay(0), Duration::from_millis(100));
        assert_eq!(policy.calculate_delay(1), Duration::from_millis(200));
        assert_eq!(policy.calculate_delay(2), Duration::from_millis(400));
        assert_eq!(policy.calculate_delay(3), Duration::from_millis(800));
    }

    #[test]
    fn test_max_delay_cap() {
        let policy = RetryPolicy {
            max_attempts: 10,
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(5),
            backoff_multiplier: 2.0,
            use_jitter: false,
        };

        // Delay should be capped at max_delay
        assert!(policy.calculate_delay(5) <= Duration::from_secs(5));
        assert!(policy.calculate_delay(10) <= Duration::from_secs(5));
    }
}
