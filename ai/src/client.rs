//! AI Client
//!
//! Unified client for interacting with multiple AI providers

use crate::error::{AIError, AIResult};
use crate::provider::{AiProvider, TokenUsage};
use crate::types::{CompletionRequest, CompletionResponse, StreamChunk};
use crate::ProviderType;
use async_trait::async_trait;
use futures::stream::BoxStream;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

/// Registry for AI providers
#[derive(Clone)]
pub struct ProviderRegistry {
    providers: Arc<RwLock<HashMap<ProviderType, Arc<dyn AiProvider>>>>,
    default_provider: Arc<RwLock<Option<ProviderType>>>,
}

impl ProviderRegistry {
    /// Create a new provider registry
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            default_provider: Arc::new(RwLock::new(None)),
        }
    }

    /// Register a provider
    pub async fn register_provider(
        &self,
        provider_type: ProviderType,
        provider: Arc<dyn AiProvider>,
    ) {
        let mut providers = self.providers.write().await;
        providers.insert(provider_type, provider);
        debug!("Registered provider: {:?}", provider_type);
    }

    /// Set the default provider
    pub async fn set_default_provider(&self, provider_type: ProviderType) {
        let mut default = self.default_provider.write().await;
        *default = Some(provider_type);
        debug!("Set default provider to: {:?}", provider_type);
    }

    /// Get a provider by type
    pub async fn get_provider(&self, provider_type: ProviderType) -> Option<Arc<dyn AiProvider>> {
        let providers = self.providers.read().await;
        providers.get(&provider_type).cloned()
    }

    /// Get the default provider
    pub async fn get_default_provider(&self) -> Option<Arc<dyn AiProvider>> {
        let default = self.default_provider.read().await;
        if let Some(default_type) = &*default {
            self.get_provider(*default_type).await
        } else {
            None
        }
    }

    /// Get all registered provider types
    pub async fn get_registered_providers(&self) -> Vec<ProviderType> {
        let providers = self.providers.read().await;
        providers.keys().cloned().collect()
    }
}

/// AI Client for unified access to all providers
pub struct AiClient {
    registry: Arc<ProviderRegistry>,
    token_usage: Arc<RwLock<TokenUsage>>,
}

impl AiClient {
    /// Create a new AI client
    pub fn new() -> Self {
        Self {
            registry: Arc::new(ProviderRegistry::new()),
            token_usage: Arc::new(RwLock::new(TokenUsage::default())),
        }
    }

    /// Get the provider registry
    pub fn registry(&self) -> Arc<ProviderRegistry> {
        self.registry.clone()
    }

    /// Complete a request with a specific provider
    pub async fn complete(
        &self,
        request: &CompletionRequest,
        provider_type: ProviderType,
    ) -> AIResult<CompletionResponse> {
        debug!(
            "Completing request with provider: {:?}",
            provider_type
        );

        let provider = self
            .registry
            .get_provider(provider_type)
            .await
            .ok_or_else(|| AIError::provider(format!("Provider not found: {:?}", provider_type)))?;

        let response = provider.complete(request).await?;
        
        // Track token usage
        if let Some(ref usage) = response.usage {
            let mut token_usage = self.token_usage.write().await;
            token_usage.add(usage);
        }

        info!(
            "Request completed successfully with provider: {:?}",
            provider_type
        );
        Ok(response)
    }

    /// Complete a request with the default provider
    pub async fn complete_with_default(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<CompletionResponse> {
        let provider = self
            .registry
            .get_default_provider()
            .await
            .ok_or_else(|| AIError::invalid_config("No default provider set"))?;

        let response = provider.complete(request).await?;
        
        // Track token usage
        if let Some(ref usage) = response.usage {
            let mut token_usage = self.token_usage.write().await;
            token_usage.add(usage);
        }

        info!(
            "Request completed successfully with default provider: {}",
            provider.name()
        );
        Ok(response)
    }

    /// Complete a request with streaming
    pub async fn complete_stream(
        &self,
        request: &CompletionRequest,
        provider_type: ProviderType,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        debug!(
            "Completing streaming request with provider: {:?}",
            provider_type
        );

        let provider = self
            .registry
            .get_provider(provider_type)
            .await
            .ok_or_else(|| AIError::provider(format!("Provider not found: {:?}", provider_type)))?;

        let stream = provider.complete_stream(request).await?;
        info!(
            "Started streaming request with provider: {:?}",
            provider_type
        );
        Ok(stream)
    }

    /// Get current token usage
    pub async fn get_token_usage(&self) -> TokenUsage {
        let token_usage = self.token_usage.read().await;
        token_usage.clone()
    }

    /// Reset token usage tracking
    pub async fn reset_token_usage(&self) {
        let mut token_usage = self.token_usage.write().await;
        *token_usage = TokenUsage::default();
    }
}

impl Default for AiClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Message, MessageRole};

    #[tokio::test]
    async fn test_provider_registry() {
        let registry = ProviderRegistry::new();
        
        // Initially empty
        let providers = registry.get_registered_providers().await;
        assert!(providers.is_empty());
        
        // No default provider
        assert!(registry.get_default_provider().await.is_none());
    }

    #[tokio::test]
    async fn test_ai_client_creation() {
        let client = AiClient::new();
        
        // Should have empty usage initially
        let usage = client.get_token_usage().await;
        assert_eq!(usage.total(), 0);
    }

    #[tokio::test]
    async fn test_ai_client_default_functions() {
        let client = AiClient::new();
        
        // Test reset usage
        client.reset_token_usage().await;
        let usage = client.get_token_usage().await;
        assert_eq!(usage.total(), 0);
    }
}