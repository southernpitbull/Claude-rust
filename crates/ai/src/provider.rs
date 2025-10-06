//! AI Provider Trait
//! 
//! Common interface for all AI providers

use crate::types::{CompletionRequest, CompletionResponse, StreamChunk};
use crate::error::{AIError, AIResult};
use async_trait::async_trait;
use futures::stream::BoxStream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;

/// AI Provider trait defining the common interface for all AI providers
#[async_trait]
pub trait AiProvider: Send + Sync {
    /// Perform a completion request
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse>;

    /// Perform a streaming completion request
    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>>;

    /// Test the connection to the provider
    async fn test_connection(&self) -> AIResult<bool>;

    /// Get the provider name
    fn name(&self) -> &str;

    /// Get the provider type
    fn provider_type(&self) -> crate::ProviderType;
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// Provider name
    pub name: String,
    
    /// API key or other authentication
    pub api_key: String,
    
    /// Base URL for the API
    pub base_url: Option<String>,
    
    /// Default model to use
    pub default_model: Option<String>,
    
    /// Additional configuration options
    pub options: std::collections::HashMap<String, serde_json::Value>,
}

impl ProviderConfig {
    /// Create a new provider config
    pub fn new(name: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            api_key: api_key.into(),
            base_url: None,
            default_model: None,
            options: std::collections::HashMap::new(),
        }
    }

    /// Set the base URL
    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    /// Set the default model
    pub fn with_default_model(mut self, model: impl Into<String>) -> Self {
        self.default_model = Some(model.into());
        self
    }

    /// Add an option
    pub fn with_option(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.options.insert(key.into(), value);
        self
    }
}

/// Token usage tracking
#[derive(Debug, Clone, Default)]
pub struct TokenUsage {
    /// Total prompt tokens used
    pub total_prompt_tokens: u64,
    
    /// Total completion tokens used
    pub total_completion_tokens: u64,
    
    /// Total tokens used
    pub total_tokens: u64,
}

impl TokenUsage {
    /// Add usage to this tracker
    pub fn add(&mut self, usage: &crate::types::Usage) {
        if let Some(prompt_tokens) = usage.prompt_tokens {
            self.total_prompt_tokens += prompt_tokens as u64;
            self.total_tokens += prompt_tokens as u64;
        }
        if let Some(completion_tokens) = usage.completion_tokens {
            self.total_completion_tokens += completion_tokens as u64;
            self.total_tokens += completion_tokens as u64;
        }
    }

    /// Get total tokens used
    pub fn total(&self) -> u64 {
        self.total_tokens
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_config_creation() {
        let config = ProviderConfig::new("test_provider", "test_key");
        assert_eq!(config.name, "test_provider");
        assert_eq!(config.api_key, "test_key");
        assert!(config.base_url.is_none());
    }

    #[test]
    fn test_provider_config_with_methods() {
        let config = ProviderConfig::new("test", "key")
            .with_base_url("https://api.example.com")
            .with_default_model("gpt-4");
        
        assert_eq!(config.base_url, Some("https://api.example.com".to_string()));
        assert_eq!(config.default_model, Some("gpt-4".to_string()));
    }

    #[test]
    fn test_token_usage() {
        use crate::types::Usage;
        
        let mut usage_tracker = TokenUsage::default();
        let usage = Usage {
            prompt_tokens: Some(10),
            completion_tokens: Some(20),
            total_tokens: Some(30),
            extra: std::collections::HashMap::new(),
        };
        
        usage_tracker.add(&usage);
        
        assert_eq!(usage_tracker.total_prompt_tokens, 10);
        assert_eq!(usage_tracker.total_completion_tokens, 20);
        assert_eq!(usage_tracker.total_tokens, 30);
    }

    #[test]
    fn test_token_usage_addition() {
        use crate::types::Usage;
        
        let mut usage_tracker = TokenUsage::default();
        
        // Add first usage
        let usage1 = Usage {
            prompt_tokens: Some(10),
            completion_tokens: Some(20),
            total_tokens: Some(30),
            extra: std::collections::HashMap::new(),
        };
        usage_tracker.add(&usage1);
        
        // Add second usage
        let usage2 = Usage {
            prompt_tokens: Some(5),
            completion_tokens: Some(15),
            total_tokens: Some(20),
            extra: std::collections::HashMap::new(),
        };
        usage_tracker.add(&usage2);
        
        assert_eq!(usage_tracker.total_prompt_tokens, 15); // 10 + 5
        assert_eq!(usage_tracker.total_completion_tokens, 35); // 20 + 15
        assert_eq!(usage_tracker.total_tokens, 50); // 30 + 20
    }
}