//! Circuit Breaker Pattern Implementation
//!
//! Provides circuit breaker functionality to prevent cascading failures and enable
//! graceful degradation when services are experiencing issues.

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use std::collections::VecDeque;

use crate::error::{AppError, AppResult};

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    /// Circuit is closed, requests pass through normally
    Closed,
    /// Circuit is open, requests are rejected
    Open,
    /// Circuit is testing if service has recovered
    HalfOpen,
}

/// Circuit breaker configuration
#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    /// Name of the circuit breaker for identification
    pub name: String,
    /// Number of failures before opening the circuit
    pub failure_threshold: u32,
    /// Number of successes needed to close from half-open
    pub success_threshold: u32,
    /// Timeout before attempting recovery (in milliseconds)
    pub timeout: Duration,
    /// Period for monitoring failure rate (in milliseconds)
    pub monitoring_period: Duration,
    /// Maximum backoff time
    pub max_backoff_time: Duration,
    /// Backoff multiplier for exponential backoff
    pub backoff_multiplier: f64,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            failure_threshold: 5,
            success_threshold: 3,
            timeout: Duration::from_secs(30),
            monitoring_period: Duration::from_secs(60),
            max_backoff_time: Duration::from_secs(300),
            backoff_multiplier: 2.0,
        }
    }
}

/// Statistics for circuit breaker
#[derive(Debug, Clone)]
pub struct CircuitBreakerStats {
    pub total_requests: u64,
    pub successful_requests: u64,
    pub failed_requests: u64,
    pub rejected_requests: u64,
    pub consecutive_failures: u32,
    pub consecutive_successes: u32,
    pub last_failure_time: Option<Instant>,
    pub last_success_time: Option<Instant>,
    pub average_response_time: Duration,
    pub failure_rate: f64,
}

impl Default for CircuitBreakerStats {
    fn default() -> Self {
        Self {
            total_requests: 0,
            successful_requests: 0,
            failed_requests: 0,
            rejected_requests: 0,
            consecutive_failures: 0,
            consecutive_successes: 0,
            last_failure_time: None,
            last_success_time: None,
            average_response_time: Duration::from_millis(0),
            failure_rate: 0.0,
        }
    }
}

/// Call record for failure rate calculation
#[derive(Debug, Clone)]
struct CallRecord {
    timestamp: Instant,
    success: bool,
    duration: Duration,
}

/// Circuit breaker implementation
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    state: Arc<RwLock<CircuitState>>,
    stats: Arc<RwLock<CircuitBreakerStats>>,
    recent_calls: Arc<RwLock<VecDeque<CallRecord>>>,
    next_attempt_time: Arc<RwLock<Instant>>,
    open_count: Arc<RwLock<u32>>,
}

impl CircuitBreaker {
    /// Create a new circuit breaker with the given configuration
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            state: Arc::new(RwLock::new(CircuitState::Closed)),
            stats: Arc::new(RwLock::new(CircuitBreakerStats::default())),
            recent_calls: Arc::new(RwLock::new(VecDeque::new())),
            next_attempt_time: Arc::new(RwLock::new(Instant::now())),
            open_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Execute a function with circuit breaker protection
    pub async fn execute<F, T, Fut>(&self, operation: F) -> AppResult<T>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        // Check if circuit is open
        let state = *self.state.read().await;
        if state == CircuitState::Open {
            let next_attempt = *self.next_attempt_time.read().await;
            if Instant::now() < next_attempt {
                self.record_rejection().await;
                return Err(AppError::Internal {
                    message: format!("Circuit breaker '{}' is OPEN", self.config.name),
                    source: None,
                });
            } else {
                // Move to half-open state for testing
                self.change_state(CircuitState::HalfOpen).await;
            }
        }

        // Execute the operation
        let start_time = Instant::now();
        let result = operation().await;
        let duration = start_time.elapsed();

        match result {
            Ok(value) => {
                self.record_success(duration).await;
                self.check_state_transition().await;
                Ok(value)
            }
            Err(err) => {
                self.record_failure(duration).await;
                self.check_state_transition().await;
                Err(err)
            }
        }
    }

    /// Get current circuit state
    pub async fn get_state(&self) -> CircuitState {
        *self.state.read().await
    }

    /// Get circuit breaker statistics
    pub async fn get_stats(&self) -> CircuitBreakerStats {
        self.stats.read().await.clone()
    }

    /// Manually open the circuit breaker
    pub async fn open(&self) {
        self.change_state(CircuitState::Open).await;
    }

    /// Manually close the circuit breaker
    pub async fn close(&self) {
        self.change_state(CircuitState::Closed).await;
    }

    /// Reset circuit breaker statistics
    pub async fn reset(&self) {
        *self.stats.write().await = CircuitBreakerStats::default();
        *self.recent_calls.write().await = VecDeque::new();
        self.change_state(CircuitState::Closed).await;
        tracing::info!("Circuit breaker '{}' reset", self.config.name);
    }

    /// Record a successful call
    async fn record_success(&self, duration: Duration) {
        let mut stats = self.stats.write().await;
        stats.total_requests += 1;
        stats.successful_requests += 1;
        stats.consecutive_successes += 1;
        stats.consecutive_failures = 0;
        stats.last_success_time = Some(Instant::now());

        self.update_average_response_time(duration).await;
        self.update_recent_calls(true, duration).await;
        self.update_failure_rate().await;

        tracing::debug!(
            "Circuit breaker '{}' call succeeded, consecutive successes: {}",
            self.config.name,
            stats.consecutive_successes
        );
    }

    /// Record a failed call
    async fn record_failure(&self, duration: Duration) {
        let mut stats = self.stats.write().await;
        stats.total_requests += 1;
        stats.failed_requests += 1;
        stats.consecutive_failures += 1;
        stats.consecutive_successes = 0;
        stats.last_failure_time = Some(Instant::now());

        self.update_average_response_time(duration).await;
        self.update_recent_calls(false, duration).await;
        self.update_failure_rate().await;

        tracing::debug!(
            "Circuit breaker '{}' call failed, consecutive failures: {}",
            self.config.name,
            stats.consecutive_failures
        );
    }

    /// Record a rejected call
    async fn record_rejection(&self) {
        let mut stats = self.stats.write().await;
        stats.rejected_requests += 1;

        tracing::debug!(
            "Circuit breaker '{}' call rejected, state: {:?}",
            self.config.name,
            *self.state.read().await
        );
    }

    /// Update recent calls for failure rate calculation
    async fn update_recent_calls(&self, success: bool, duration: Duration) {
        let now = Instant::now();
        let mut recent_calls = self.recent_calls.write().await;

        recent_calls.push_back(CallRecord {
            timestamp: now,
            success,
            duration,
        });

        // Remove calls outside monitoring period
        let cutoff = now - self.config.monitoring_period;
        while let Some(call) = recent_calls.front() {
            if call.timestamp > cutoff {
                break;
            }
            recent_calls.pop_front();
        }
    }

    /// Update average response time
    async fn update_average_response_time(&self, duration: Duration) {
        let mut stats = self.stats.write().await;
        let total_time = stats.average_response_time.as_millis() as u64 * (stats.total_requests - 1)
            + duration.as_millis() as u64;
        stats.average_response_time = Duration::from_millis(total_time / stats.total_requests);
    }

    /// Update failure rate
    async fn update_failure_rate(&self) {
        let recent_calls = self.recent_calls.read().await;
        let mut stats = self.stats.write().await;

        if recent_calls.is_empty() {
            stats.failure_rate = 0.0;
            return;
        }

        let failures = recent_calls.iter().filter(|call| !call.success).count();
        stats.failure_rate = (failures as f64 / recent_calls.len() as f64) * 100.0;
    }

    /// Check if state transition is needed
    async fn check_state_transition(&self) {
        let state = *self.state.read().await;
        let stats = self.stats.read().await;

        match state {
            CircuitState::Closed => {
                if self.should_open(&stats).await {
                    drop(stats);
                    self.change_state(CircuitState::Open).await;
                }
            }
            CircuitState::HalfOpen => {
                if stats.consecutive_successes >= self.config.success_threshold {
                    drop(stats);
                    self.change_state(CircuitState::Closed).await;
                } else if stats.consecutive_failures > 0 {
                    drop(stats);
                    self.change_state(CircuitState::Open).await;
                }
            }
            CircuitState::Open => {
                // State transitions from OPEN are handled by timeout
            }
        }
    }

    /// Check if circuit should open
    async fn should_open(&self, stats: &CircuitBreakerStats) -> bool {
        // Check consecutive failures
        if stats.consecutive_failures >= self.config.failure_threshold {
            return true;
        }

        // Check failure rate over monitoring period
        let recent_calls = self.recent_calls.read().await;
        if stats.failure_rate > 50.0 && recent_calls.len() >= self.config.failure_threshold as usize {
            return true;
        }

        false
    }

    /// Change circuit breaker state
    async fn change_state(&self, new_state: CircuitState) {
        let old_state = *self.state.read().await;
        *self.state.write().await = new_state;

        if new_state == CircuitState::Open {
            let backoff_time = self.calculate_backoff_time().await;
            *self.next_attempt_time.write().await = Instant::now() + backoff_time;
            *self.open_count.write().await += 1;
        }

        if new_state == CircuitState::Closed {
            *self.open_count.write().await = 0;
        }

        tracing::info!(
            "Circuit breaker '{}' state changed from {:?} to {:?}",
            self.config.name,
            old_state,
            new_state
        );
    }

    /// Calculate backoff time for recovery
    async fn calculate_backoff_time(&self) -> Duration {
        let open_count = *self.open_count.read().await;
        let backoff_millis = self.config.timeout.as_millis() as f64
            * self.config.backoff_multiplier.powi(open_count as i32);

        let backoff_duration = Duration::from_millis(backoff_millis as u64);

        std::cmp::min(backoff_duration, self.config.max_backoff_time)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker_opens_on_failures() {
        let config = CircuitBreakerConfig {
            name: "test".to_string(),
            failure_threshold: 3,
            ..Default::default()
        };

        let breaker = CircuitBreaker::new(config);

        // Execute failing operations
        for _ in 0..3 {
            let _: Result<(), AppError> = breaker
                .execute(|| async { Err(AppError::Internal {
                    message: "test error".to_string(),
                    source: None,
                }) })
                .await;
        }

        // Circuit should be open
        assert_eq!(breaker.get_state().await, CircuitState::Open);
    }

    #[tokio::test]
    async fn test_circuit_breaker_closes_on_success() {
        let config = CircuitBreakerConfig {
            name: "test".to_string(),
            failure_threshold: 3,
            success_threshold: 2,
            timeout: Duration::from_millis(100),
            ..Default::default()
        };

        let breaker = CircuitBreaker::new(config);

        // Open the circuit
        for _ in 0..3 {
            let _: Result<(), AppError> = breaker
                .execute(|| async { Err(AppError::Internal {
                    message: "test error".to_string(),
                    source: None,
                }) })
                .await;
        }

        assert_eq!(breaker.get_state().await, CircuitState::Open);

        // Wait for timeout
        tokio::time::sleep(Duration::from_millis(150)).await;

        // Execute successful operations
        for _ in 0..2 {
            let _: Result<(), AppError> = breaker.execute(|| async { Ok(()) }).await;
        }

        // Circuit should be closed
        assert_eq!(breaker.get_state().await, CircuitState::Closed);
    }

    #[tokio::test]
    async fn test_circuit_breaker_stats() {
        let config = CircuitBreakerConfig {
            name: "test".to_string(),
            ..Default::default()
        };

        let breaker = CircuitBreaker::new(config);

        // Execute some operations
        let _: Result<(), AppError> = breaker.execute(|| async { Ok(()) }).await;
        let _: Result<(), AppError> = breaker.execute(|| async { Ok(()) }).await;
        let _: Result<(), AppError> = breaker
            .execute(|| async { Err(AppError::Internal {
                message: "test error".to_string(),
                source: None,
            }) })
            .await;

        let stats = breaker.get_stats().await;
        assert_eq!(stats.total_requests, 3);
        assert_eq!(stats.successful_requests, 2);
        assert_eq!(stats.failed_requests, 1);
    }
}
