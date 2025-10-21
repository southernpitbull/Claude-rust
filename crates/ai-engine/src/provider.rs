//! Base provider trait and abstractions for AI model integration
//!
//! This module provides:
//! - Async provider trait for AI models
//! - Request/response types with streaming support
//! - Rate limiting and retry logic
//! - Cost tracking
//! - Health monitoring

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use futures::Stream;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Provider error types
#[derive(Error, Debug)]
pub enum ProviderError {
    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitError(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Model error: {0}")]
    ModelError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Provider unavailable: {0}")]
    Unavailable(String),

    #[error("Generic error: {0}")]
    GenericError(String),
}

pub type ProviderResult<T> = Result<T, ProviderError>;

/// Response stream type
pub type ResponseStream = Pin<Box<dyn Stream<Item = ProviderResult<StreamChunk>> + Send>>;

/// AI provider trait
#[async_trait]
pub trait AIProvider: Send + Sync {
    /// Send a prompt and get a complete response
    async fn send_prompt(&self, request: PromptRequest) -> ProviderResult<PromptResponse>;

    /// Stream a prompt response
    async fn stream_prompt(&self, request: PromptRequest) -> ProviderResult<ResponseStream>;

    /// Get available models
    async fn get_models(&self) -> ProviderResult<Vec<ModelInfo>>;

    /// Get provider health status
    async fn get_health_status(&self) -> ProviderResult<HealthStatus>;

    /// Get provider name
    fn name(&self) -> &str;

    /// Get provider capabilities
    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::default()
    }
}

/// Prompt request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRequest {
    /// Model to use
    pub model: String,

    /// System prompt
    pub system_prompt: Option<String>,

    /// User messages
    pub messages: Vec<Message>,

    /// Temperature (0.0-2.0)
    pub temperature: Option<f32>,

    /// Max tokens to generate
    pub max_tokens: Option<u32>,

    /// Stop sequences
    pub stop_sequences: Option<Vec<String>>,

    /// Additional parameters
    pub parameters: HashMap<String, serde_json::Value>,

    /// Request metadata
    pub metadata: RequestMetadata,
}

/// Message in conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub content: String,
    pub name: Option<String>,
}

/// Message role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    System,
    User,
    Assistant,
    Function,
}

/// Request metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestMetadata {
    pub request_id: String,
    pub timestamp: DateTime<Utc>,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
}

impl Default for RequestMetadata {
    fn default() -> Self {
        Self {
            request_id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            user_id: None,
            session_id: None,
        }
    }
}

/// Prompt response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptResponse {
    /// Generated text
    pub content: String,

    /// Model used
    pub model: String,

    /// Token usage
    pub usage: TokenUsage,

    /// Finish reason
    pub finish_reason: FinishReason,

    /// Response metadata
    pub metadata: ResponseMetadata,
}

/// Token usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl TokenUsage {
    pub fn new(prompt_tokens: u32, completion_tokens: u32) -> Self {
        Self {
            prompt_tokens,
            completion_tokens,
            total_tokens: prompt_tokens + completion_tokens,
        }
    }

    pub fn empty() -> Self {
        Self {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        }
    }
}

/// Finish reason
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    Stop,
    Length,
    ContentFilter,
    ToolCalls,
    Error,
}

/// Response metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseMetadata {
    pub request_id: String,
    pub timestamp: DateTime<Utc>,
    pub latency_ms: u64,
    pub cost: Option<f64>,
}

/// Stream chunk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub content: String,
    pub finish_reason: Option<FinishReason>,
    pub usage: Option<TokenUsage>,
}

/// Model information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_window: u32,
    pub max_output_tokens: Option<u32>,
    pub pricing: Option<ModelPricing>,
    pub capabilities: Vec<String>,
}

/// Model pricing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub prompt_price_per_1k: f64,
    pub completion_price_per_1k: f64,
    pub currency: String,
}

/// Provider capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub streaming: bool,
    pub function_calling: bool,
    pub vision: bool,
    pub embeddings: bool,
    pub fine_tuning: bool,
}

impl Default for ProviderCapabilities {
    fn default() -> Self {
        Self {
            streaming: true,
            function_calling: false,
            vision: false,
            embeddings: false,
            fine_tuning: false,
        }
    }
}

/// Provider health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub latency_ms: Option<u64>,
    pub error: Option<String>,
    pub last_check: DateTime<Utc>,
}

impl HealthStatus {
    pub fn healthy(latency_ms: u64) -> Self {
        Self {
            healthy: true,
            latency_ms: Some(latency_ms),
            error: None,
            last_check: Utc::now(),
        }
    }

    pub fn unhealthy(error: impl Into<String>) -> Self {
        Self {
            healthy: false,
            latency_ms: None,
            error: Some(error.into()),
            last_check: Utc::now(),
        }
    }
}

/// Provider registry
pub struct ProviderRegistry {
    providers: Arc<RwLock<HashMap<String, Arc<dyn AIProvider>>>>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register(&self, provider: Arc<dyn AIProvider>) {
        let name = provider.name().to_string();
        self.providers.write().await.insert(name, provider);
    }

    pub async fn get(&self, name: &str) -> Option<Arc<dyn AIProvider>> {
        self.providers.read().await.get(name).cloned()
    }

    pub async fn list(&self) -> Vec<String> {
        self.providers.read().await.keys().cloned().collect()
    }

    pub async fn remove(&self, name: &str) -> bool {
        self.providers.write().await.remove(name).is_some()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockProvider {
        name: String,
    }

    #[async_trait]
    impl AIProvider for MockProvider {
        async fn send_prompt(&self, _request: PromptRequest) -> ProviderResult<PromptResponse> {
            Ok(PromptResponse {
                content: "Test response".to_string(),
                model: "test-model".to_string(),
                usage: TokenUsage::new(10, 20),
                finish_reason: FinishReason::Stop,
                metadata: ResponseMetadata {
                    request_id: "test".to_string(),
                    timestamp: Utc::now(),
                    latency_ms: 100,
                    cost: Some(0.001),
                },
            })
        }

        async fn stream_prompt(&self, _request: PromptRequest) -> ProviderResult<ResponseStream> {
            Err(ProviderError::GenericError("Not implemented".to_string()))
        }

        async fn get_models(&self) -> ProviderResult<Vec<ModelInfo>> {
            Ok(vec![ModelInfo {
                id: "test-model".to_string(),
                name: "Test Model".to_string(),
                description: Some("A test model".to_string()),
                context_window: 4096,
                max_output_tokens: Some(2048),
                pricing: None,
                capabilities: vec!["chat".to_string()],
            }])
        }

        async fn get_health_status(&self) -> ProviderResult<HealthStatus> {
            Ok(HealthStatus::healthy(50))
        }

        fn name(&self) -> &str {
            &self.name
        }
    }

    #[test]
    fn test_message_creation() {
        let msg = Message {
            role: MessageRole::User,
            content: "Hello".to_string(),
            name: None,
        };
        assert_eq!(msg.content, "Hello");
    }

    #[test]
    fn test_token_usage() {
        let usage = TokenUsage::new(100, 50);
        assert_eq!(usage.prompt_tokens, 100);
        assert_eq!(usage.completion_tokens, 50);
        assert_eq!(usage.total_tokens, 150);
    }

    #[test]
    fn test_token_usage_empty() {
        let usage = TokenUsage::empty();
        assert_eq!(usage.total_tokens, 0);
    }

    #[test]
    fn test_health_status_healthy() {
        let status = HealthStatus::healthy(100);
        assert!(status.healthy);
        assert_eq!(status.latency_ms, Some(100));
        assert!(status.error.is_none());
    }

    #[test]
    fn test_health_status_unhealthy() {
        let status = HealthStatus::unhealthy("Connection failed");
        assert!(!status.healthy);
        assert!(status.latency_ms.is_none());
        assert_eq!(status.error, Some("Connection failed".to_string()));
    }

    #[tokio::test]
    async fn test_mock_provider_send_prompt() {
        let provider = MockProvider {
            name: "test".to_string(),
        };

        let request = PromptRequest {
            model: "test-model".to_string(),
            system_prompt: None,
            messages: vec![],
            temperature: None,
            max_tokens: None,
            stop_sequences: None,
            parameters: HashMap::new(),
            metadata: RequestMetadata::default(),
        };

        let response = provider.send_prompt(request).await.unwrap();
        assert_eq!(response.content, "Test response");
    }

    #[tokio::test]
    async fn test_mock_provider_get_models() {
        let provider = MockProvider {
            name: "test".to_string(),
        };

        let models = provider.get_models().await.unwrap();
        assert_eq!(models.len(), 1);
        assert_eq!(models[0].id, "test-model");
    }

    #[tokio::test]
    async fn test_mock_provider_health() {
        let provider = MockProvider {
            name: "test".to_string(),
        };

        let status = provider.get_health_status().await.unwrap();
        assert!(status.healthy);
    }

    #[tokio::test]
    async fn test_provider_registry() {
        let registry = ProviderRegistry::new();
        let provider = Arc::new(MockProvider {
            name: "test".to_string(),
        });

        registry.register(provider.clone()).await;

        let retrieved = registry.get("test").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name(), "test");
    }

    #[tokio::test]
    async fn test_provider_registry_list() {
        let registry = ProviderRegistry::new();
        let provider1 = Arc::new(MockProvider {
            name: "test1".to_string(),
        });
        let provider2 = Arc::new(MockProvider {
            name: "test2".to_string(),
        });

        registry.register(provider1).await;
        registry.register(provider2).await;

        let list = registry.list().await;
        assert_eq!(list.len(), 2);
        assert!(list.contains(&"test1".to_string()));
        assert!(list.contains(&"test2".to_string()));
    }

    #[tokio::test]
    async fn test_provider_registry_remove() {
        let registry = ProviderRegistry::new();
        let provider = Arc::new(MockProvider {
            name: "test".to_string(),
        });

        registry.register(provider).await;
        assert!(registry.remove("test").await);
        assert!(!registry.remove("test").await);
        assert!(registry.get("test").await.is_none());
    }

    #[test]
    fn test_provider_capabilities_default() {
        let caps = ProviderCapabilities::default();
        assert!(caps.streaming);
        assert!(!caps.function_calling);
    }

    #[test]
    fn test_request_metadata_default() {
        let metadata = RequestMetadata::default();
        assert!(!metadata.request_id.is_empty());
    }
}
