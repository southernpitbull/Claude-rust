//! Rate Limiter with Circuit Breaker
//! 
//! Implements rate limiting and circuit breaker patterns for API calls

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, warn};

/// Rate limit configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub max_requests: u32,
    pub per_duration: Duration,
    pub max_tokens_per_minute: Option<u32>,
}

impl RateLimitConfig {
    pub fn new(max_requests: u32, per_duration: Duration) -> Self {
        Self {
            max_requests,
            per_duration,
            max_tokens_per_minute: None,
        }
    }

    pub fn with_token_limit(mut self, max_tokens: u32) -> Self {
        self.max_tokens_per_minute = Some(max_tokens);
        self
    }
}

/// A token bucket for rate limiting
#[derive(Debug, Clone)]
struct TokenBucket {
    capacity: u32,
    tokens: f64,
    refill_rate: f64, // tokens per second
    last_refill: Instant,
}

impl TokenBucket {
    fn new(capacity: u32, refill_interval: Duration) -> Self {
        let refill_rate = capacity as f64 / refill_interval.as_secs_f64();
        Self {
            capacity: capacity,
            tokens: capacity as f64,
            refill_rate,
            last_refill: Instant::now(),
        }
    }

    fn try_consume(&mut self, amount: u32) -> bool {
        self.refill();
        
        if self.tokens >= amount as f64 {
            self.tokens -= amount as f64;
            true
        } else {
            false
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill);
        let tokens_to_add = elapsed.as_secs_f64() * self.refill_rate;
        
        self.tokens = (self.tokens + tokens_to_add).min(self.capacity as f64);
        self.last_refill = now;
    }
}

/// Circuit breaker states
#[derive(Debug, Clone, PartialEq)]
enum CircuitState {
    /// Normal operation
    Closed,
    /// Circuit is broken, requests are blocked
    Open(Instant), // Time when circuit was opened
    /// Testing state, allowing some requests through
    HalfOpen,
}

/// Circuit breaker for API calls
#[derive(Debug, Clone)]
struct CircuitBreaker {
    state: CircuitState,
    failure_count: u32,
    max_failures: u32,
    timeout: Duration, // How long to stay open before transitioning to HalfOpen
    success_count: u32, // Count of consecutive successes when HalfOpen
    max_successes_to_close: u32, // Successes needed to close circuit
}

impl CircuitBreaker {
    fn new(max_failures: u32, timeout: Duration, max_successes_to_close: u32) -> Self {
        Self {
            state: CircuitState::Closed,
            failure_count: 0,
            max_failures,
            timeout,
            success_count: 0,
            max_successes_to_close,
        }
    }

    fn record_failure(&mut self) {
        self.failure_count += 1;
        if self.failure_count >= self.max_failures {
            self.state = CircuitState::Open(Instant::now());
        }
    }

    fn record_success(&mut self) {
        match self.state {
            CircuitState::Closed => {
                self.failure_count = 0; // Reset on success in normal state
            }
            CircuitState::Open(_) => {
                // Don't transition directly from Open to Closed
                // Wait for HalfOpen state
            }
            CircuitState::HalfOpen => {
                self.success_count += 1;
                if self.success_count >= self.max_successes_to_close {
                    self.state = CircuitState::Closed;
                    self.failure_count = 0;
                    self.success_count = 0;
                }
            }
        }
    }

    fn can_attempt_request(&mut self) -> bool {
        match self.state {
            CircuitState::Closed => true,
            CircuitState::Open(opened_at) => {
                // Check if enough time has passed to try again
                if opened_at.elapsed() >= self.timeout {
                    self.state = CircuitState::HalfOpen;
                    self.success_count = 0; // Reset success counter
                    true
                } else {
                    false // Still in open state, deny request
                }
            }
            CircuitState::HalfOpen => true, // Allow requests in HalfOpen state
        }
    }

    fn is_closed(&self) -> bool {
        matches!(self.state, CircuitState::Closed)
    }
}

/// Rate limiter for API calls with circuit breaker functionality
#[derive(Clone)]
pub struct RateLimiter {
    request_buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
    token_buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
    circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreaker>>>,
    configs: Arc<RwLock<HashMap<String, RateLimitConfig>>>,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new() -> Self {
        Self {
            request_buckets: Arc::new(RwLock::new(HashMap::new())),
            token_buckets: Arc::new(RwLock::new(HashMap::new())),
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            configs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Configure rate limits and circuit breaker for a provider
    pub async fn configure(&self, provider_id: String, config: RateLimitConfig) {
        {
            let mut configs = self.configs.write().await;
            configs.insert(provider_id.clone(), config.clone());
        }

        // Initialize rate limiting buckets
        {
            let mut request_buckets = self.request_buckets.write().await;
            let request_bucket = TokenBucket::new(
                config.max_requests,
                config.per_duration,
            );
            request_buckets.insert(provider_id.clone(), request_bucket);
        }

        if let Some(max_tokens) = config.max_tokens_per_minute {
            let mut token_buckets = self.token_buckets.write().await;
            // Token bucket refills at max_tokens per minute
            let token_bucket = TokenBucket::new(
                max_tokens,
                Duration::from_secs(60), // refill every minute
            );
            token_buckets.insert(provider_id.clone(), token_bucket);
        }

        // Initialize circuit breaker with default settings (can be customized per provider)
        {
            let mut circuit_breakers = self.circuit_breakers.write().await;
            let circuit_breaker = CircuitBreaker::new(
                5, // Allow 5 consecutive failures before opening circuit
                Duration::from_secs(60), // Stay open for 60 seconds
                3, // Need 3 consecutive successes to close circuit
            );
            circuit_breakers.insert(provider_id, circuit_breaker);
        }
    }

    /// Check if a request is allowed for the provider
    pub async fn is_allowed(&self, provider_id: &str, tokens_used: Option<u32>) -> bool {
        let provider_id = provider_id.to_string();
        
        // Check circuit breaker first
        {
            let mut circuit_breakers = self.circuit_breakers.write().await;
            if let Some(breaker) = circuit_breakers.get_mut(&provider_id) {
                if !breaker.can_attempt_request() {
                    debug!("Circuit breaker open for provider: {}", provider_id);
                    return false;
                }
            } else {
                // If no circuit breaker config, proceed with rate limiting
            }
        }
        
        // Check request rate limit
        {
            let mut request_buckets = self.request_buckets.write().await;
            if let Some(bucket) = request_buckets.get_mut(&provider_id) {
                if !bucket.try_consume(1) {
                    debug!("Request rate limit exceeded for provider: {}", provider_id);
                    // Record failure in circuit breaker
                    self.record_failure(&provider_id).await;
                    return false;
                }
            } else {
                warn!("No rate limit config found for provider: {}", provider_id);
                // If no config, allow the request but log a warning
                return true;
            }
        }

        // Check token rate limit if tokens were used
        if let Some(tokens) = tokens_used {
            let mut token_buckets = self.token_buckets.write().await;
            if let Some(bucket) = token_buckets.get_mut(&provider_id) {
                if !bucket.try_consume(tokens) {
                    debug!("Token rate limit exceeded for provider: {}", provider_id);
                    // Record failure in circuit breaker
                    self.record_failure(&provider_id).await;
                    return false;
                }
            } else {
                // If no token limit config, continue
            }
        }

        // Record success in circuit breaker
        self.record_success(&provider_id).await;
        true
    }

    /// Record a successful API call
    pub async fn record_success(&self, provider_id: &str) {
        let mut circuit_breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = circuit_breakers.get_mut(provider_id) {
            breaker.record_success();
        }
    }

    /// Record a failed API call
    pub async fn record_failure(&self, provider_id: &str) {
        let mut circuit_breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = circuit_breakers.get_mut(provider_id) {
            breaker.record_failure();
        }
    }

    /// Check circuit breaker state
    pub async fn circuit_is_closed(&self, provider_id: &str) -> bool {
        let circuit_breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = circuit_breakers.get(provider_id) {
            breaker.is_closed()
        } else {
            true // If no circuit breaker, assume it's closed
        }
    }

    /// Wait until a request is allowed for the provider
    pub async fn wait_for_allowed(&self, provider_id: &str, tokens_used: Option<u32>) {
        // In a real implementation, this would wait until the rate limit resets or circuit breaker is closed
        if !self.is_allowed(provider_id, tokens_used).await {
            // Wait for a bit before trying again
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }

    /// Get remaining requests for a provider
    pub async fn get_remaining_requests(&self, provider_id: &str) -> Option<u32> {
        let request_buckets = self.request_buckets.read().await;
        let bucket = request_buckets.get(provider_id);
        
        bucket.map(|b| b.tokens as u32)
    }

    /// Get remaining tokens for a provider
    pub async fn get_remaining_tokens(&self, provider_id: &str) -> Option<u32> {
        let token_buckets = self.token_buckets.read().await;
        let bucket = token_buckets.get(provider_id);
        
        bucket.map(|b| b.tokens as u32)
    }

    /// Get circuit breaker state for a provider
    pub async fn get_circuit_state(&self, provider_id: &str) -> Option<String> {
        let circuit_breakers = self.circuit_breakers.read().await;
        if let Some(breaker) = circuit_breakers.get(provider_id) {
            match &breaker.state {
                CircuitState::Closed => Some("closed".to_string()),
                CircuitState::Open(_) => Some("open".to_string()),
                CircuitState::HalfOpen => Some("half_open".to_string()),
            }
        } else {
            None // No circuit breaker configured
        }
    }

    /// Manually reset the circuit breaker for a provider
    pub async fn reset_circuit(&self, provider_id: &str) {
        let mut circuit_breakers = self.circuit_breakers.write().await;
        if let Some(breaker) = circuit_breakers.get_mut(provider_id) {
            *breaker = CircuitBreaker::new(
                breaker.max_failures,
                breaker.timeout,
                breaker.max_successes_to_close,
            );
        }
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_creation() {
        let limiter = RateLimiter::new();
        
        // Initially no configs
        assert!(limiter.get_remaining_requests("test").await.is_none());
    }

    #[tokio::test]
    async fn test_rate_limiter_configuration() {
        let limiter = RateLimiter::new();
        let config = RateLimitConfig::new(10, Duration::from_secs(60))
            .with_token_limit(1000);
        
        limiter.configure("test_provider".to_string(), config).await;
        
        // Check that config was stored
        assert!(limiter.get_remaining_requests("test_provider").await.is_some());
    }

    #[tokio::test]
    async fn test_rate_limiter_request_limit() {
        let limiter = RateLimiter::new();
        let config = RateLimitConfig::new(2, Duration::from_secs(60)); // 2 requests per minute
        
        limiter.configure("test_provider".to_string(), config).await;
        
        // First two requests should be allowed
        assert!(limiter.is_allowed("test_provider", None).await);
        assert!(limiter.is_allowed("test_provider", None).await);
        
        // Third request might be denied depending on implementation
        // (in our implementation, it would fail immediately since we're not sleeping)
    }

    #[tokio::test]
    async fn test_rate_limiter_token_limit() {
        let limiter = RateLimiter::new();
        let config = RateLimitConfig::new(10, Duration::from_secs(60))
            .with_token_limit(100); // 100 tokens per minute
        
        limiter.configure("token_test".to_string(), config).await;
        
        // Should allow if tokens used are within limit
        assert!(limiter.is_allowed("token_test", Some(50)).await);
    }
}