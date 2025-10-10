use crate::error::{AIError, AIResult};
use crate::message::{Message, MessageContent, MessageRole};
use crate::provider::{
    ModelInfo, Provider, ProviderCapabilities, ProviderConfig, ProviderInfo,
};
use crate::request::{AIRequest, AIResponse, StopReason, StreamChunk, UsageStats};
use async_trait::async_trait;
use claude_code_core::types::ProviderType;
use futures::stream::{Stream, StreamExt};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::time::Duration;
use async_channel;
use tokio_stream::StreamExt as TokioStreamExt;

/// OpenAI-compatible message format (used by Ollama and LM Studio)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct LocalMessage {
    role: String,
    content: String,
}

/// Local provider request (OpenAI-compatible)
#[derive(Debug, Serialize)]
struct LocalRequest {
    model: String,
    messages: Vec<LocalMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

/// Local provider response (OpenAI-compatible)
#[derive(Debug, Deserialize)]
struct LocalResponse {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    object: Option<String>,
    #[serde(default)]
    created: Option<u64>,
    model: String,
    choices: Vec<LocalChoice>,
    #[serde(default)]
    usage: Option<LocalUsage>,
}

#[derive(Debug, Deserialize)]
struct LocalChoice {
    index: usize,
    message: LocalResponseMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LocalResponseMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct LocalUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

/// Ollama streaming response
#[derive(Debug, Deserialize)]
struct OllamaStreamResponse {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    object: Option<String>,
    #[serde(default)]
    created: Option<u64>,
    model: String,
    choices: Vec<OllamaStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamChoice {
    index: usize,
    delta: Option<OllamaDelta>,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaDelta {
    role: Option<String>,
    content: String,
}

/// Local provider (LM Studio, etc.) streaming response - OpenAI compatible
#[derive(Debug, Deserialize)]
struct LocalStreamResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<LocalStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct LocalStreamChoice {
    index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    delta: Option<LocalDelta>,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LocalDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

/// Ollama-specific list models response
#[derive(Debug, Deserialize)]
struct OllamaModelsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
    #[serde(default)]
    size: Option<u64>,
    #[serde(default)]
    digest: Option<String>,
}

/// Ollama provider implementation
pub struct OllamaProvider {
    config: ProviderConfig,
    client: Client,
    base_url: String,
}

impl OllamaProvider {
    /// Create new Ollama provider
    pub fn new(config: ProviderConfig) -> Self {
        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:11434".to_string());

        let timeout = Duration::from_secs(config.timeout.unwrap_or(300)); // Longer timeout for local models

        let client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            base_url,
        }
    }

    /// Convert our messages to local format
    fn convert_messages(&self, messages: &[Message]) -> Vec<LocalMessage> {
        messages
            .iter()
            .map(|msg| {
                let role = match msg.role {
                    MessageRole::System => "system",
                    MessageRole::User => "user",
                    MessageRole::Assistant => "assistant",
                }
                .to_string();

                LocalMessage {
                    role,
                    content: msg.get_text(),
                }
            })
            .collect()
    }

    /// Parse stop reason
    fn parse_stop_reason(reason: Option<String>) -> Option<StopReason> {
        reason.as_ref().map(|r| match r.as_str() {
            "stop" => StopReason::EndTurn,
            "length" => StopReason::MaxTokens,
            _ => StopReason::Other,
        })
    }

    /// Make request to Ollama API
    async fn make_request(&self, request: LocalRequest) -> AIResult<LocalResponse> {
        let url = format!("{}/v1/chat/completions", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                AIError::provider(format!(
                    "Failed to connect to Ollama at {}. Is Ollama running? Error: {}",
                    self.base_url, e
                ))
            })?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(match status {
                StatusCode::NOT_FOUND => {
                    AIError::model_not_found("Model not found. Try pulling it with 'ollama pull <model>'")
                }
                _ => AIError::api(status.as_u16(), error_text, "ollama"),
            });
        }

        let local_response: LocalResponse = response.json().await?;
        Ok(local_response)
    }

    /// Fetch available models from Ollama
    async fn fetch_models(&self) -> AIResult<Vec<ModelInfo>> {
        let url = format!("{}/api/tags", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AIError::provider("Failed to fetch models from Ollama"))?;

        if !response.status().is_success() {
            return Ok(Vec::new());
        }

        let ollama_response: OllamaModelsResponse = response.json().await?;

        Ok(ollama_response
            .models
            .into_iter()
            .map(|m| ModelInfo {
                id: m.name.clone(),
                name: m.name,
                description: None,
                capabilities: ProviderCapabilities::default(),
                pricing: None, // Local models are free
            })
            .collect())
    }
}

#[async_trait]
impl Provider for OllamaProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::Ollama
    }

    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            provider_type: ProviderType::Ollama,
            name: "Ollama".to_string(),
            description: Some("Local Ollama models".to_string()),
            base_url: self.base_url.clone(),
            requires_auth: false,
            default_capabilities: ProviderCapabilities::default(),
            models: Vec::new(), // Will be fetched dynamically
        }
    }

    async fn get_models(&self) -> AIResult<Vec<ModelInfo>> {
        self.fetch_models().await
    }

    async fn validate_config(&self) -> AIResult<bool> {
        // Check if Ollama is running by trying to fetch models
        match self.fetch_models().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn send_request(&self, request: AIRequest) -> AIResult<AIResponse> {
        let messages = self.convert_messages(&request.messages);

        let local_request = LocalRequest {
            model: request.model.clone(),
            messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop_sequences,
            stream: Some(false),
        };

        let local_response = self.make_request(local_request).await?;

        let choice = local_response
            .choices
            .first()
            .ok_or_else(|| AIError::invalid_response("No choices in response"))?;

        let usage = local_response
            .usage
            .map(|u| UsageStats::new(u.prompt_tokens, u.completion_tokens))
            .unwrap_or_default();

        Ok(AIResponse::new(
            local_response.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            local_response.model,
            choice.message.content.clone(),
        )
        .with_stop_reason(Self::parse_stop_reason(choice.finish_reason.clone()).unwrap_or(StopReason::Other))
        .with_usage(usage))
    }

    async fn stream_request(
        &self,
        request: AIRequest,
    ) -> AIResult<Pin<Box<dyn Stream<Item = AIResult<StreamChunk>> + Send>>> {
        use futures::stream::{self, StreamExt};
        
        let messages = self.convert_messages(&request.messages);

        let local_request = LocalRequest {
            model: request.model.clone(),
            messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop_sequences,
            stream: Some(true), // Enable streaming
        };

        let url = format!("{}/v1/chat/completions", self.base_url);
        
        // Create a channel for streaming chunks
        let (tx, rx) = async_channel::unbounded();

        // Spawn a task to handle the streaming request
        let client = self.client.clone();
        let request_body = serde_json::to_vec(&local_request)
            .map_err(|e| AIError::serialization(e.to_string()))?;

        tokio::spawn(async move {
            match client
                .post(&url)
                .header("Content-Type", "application/json")
                .body(request_body)
                .send()
                .await
            {
                Ok(response) => {
                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();
                    
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(bytes) => {
                                buffer.push_str(&String::from_utf8_lossy(&bytes));
                                
                                // Process lines from the buffer
                                while let Some(pos) = buffer.find('\n') {
                                    let line = buffer[..pos].trim();
                                    buffer = buffer[pos + 1..].to_string();
                                    
                                    if line.starts_with("data: ") {
                                        let data = &line[6..];
                                        
                                        if data == "[DONE]" {
                                            break;
                                        }
                                        
                                        match serde_json::from_str::<OllamaStreamResponse>(data) {
                                            Ok(stream_response) => {
                                                if let Some(choice) = stream_response.choices.first() {
                                                    if let Some(delta) = &choice.delta {
                                                        let chunk = StreamChunk {
                                                            content: delta.content.clone(),
                                                            finish_reason: choice.finish_reason.clone(),
                                                        };
                                                        
                                                        if tx.send(Ok(chunk)).await.is_err() {
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                            Err(_) => continue,
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                let _ = tx.send(Err(AIError::network(e))).await;
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(AIError::provider(format!("Failed to connect to Ollama: {}", e)))).await;
                }
            }
        });

        Ok(Box::pin(rx.stream()))
    }
}

/// LM Studio provider implementation
pub struct LMStudioProvider {
    config: ProviderConfig,
    client: Client,
    base_url: String,
}

impl LMStudioProvider {
    /// Create new LM Studio provider
    pub fn new(config: ProviderConfig) -> Self {
        let base_url = config
            .base_url
            .clone()
            .unwrap_or_else(|| "http://localhost:1234".to_string());

        let timeout = Duration::from_secs(config.timeout.unwrap_or(300));

        let client = Client::builder()
            .timeout(timeout)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            client,
            base_url,
        }
    }

    /// Convert our messages to local format
    fn convert_messages(&self, messages: &[Message]) -> Vec<LocalMessage> {
        messages
            .iter()
            .map(|msg| {
                let role = match msg.role {
                    MessageRole::System => "system",
                    MessageRole::User => "user",
                    MessageRole::Assistant => "assistant",
                }
                .to_string();

                LocalMessage {
                    role,
                    content: msg.get_text(),
                }
            })
            .collect()
    }

    /// Parse stop reason
    fn parse_stop_reason(reason: Option<String>) -> Option<StopReason> {
        reason.as_ref().map(|r| match r.as_str() {
            "stop" => StopReason::EndTurn,
            "length" => StopReason::MaxTokens,
            _ => StopReason::Other,
        })
    }

    /// Make request to LM Studio API
    async fn make_request(&self, request: LocalRequest) -> AIResult<LocalResponse> {
        let url = format!("{}/v1/chat/completions", self.base_url);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                AIError::provider(format!(
                    "Failed to connect to LM Studio at {}. Is LM Studio running? Error: {}",
                    self.base_url, e
                ))
            })?;

        let status = response.status();

        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AIError::api(status.as_u16(), error_text, "lmstudio"));
        }

        let local_response: LocalResponse = response.json().await?;
        Ok(local_response)
    }

    /// Fetch available models from LM Studio
    async fn fetch_models(&self) -> AIResult<Vec<ModelInfo>> {
        let url = format!("{}/v1/models", self.base_url);

        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|_| AIError::provider("Failed to fetch models from LM Studio"))?;

        if !response.status().is_success() {
            return Ok(Vec::new());
        }

        #[derive(Deserialize)]
        struct ModelsResponse {
            data: Vec<ModelData>,
        }

        #[derive(Deserialize)]
        struct ModelData {
            id: String,
        }

        let models_response: ModelsResponse = response.json().await?;

        Ok(models_response
            .data
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id.clone(),
                name: m.id,
                description: None,
                capabilities: ProviderCapabilities::default(),
                pricing: None,
            })
            .collect())
    }
}

#[async_trait]
impl Provider for LMStudioProvider {
    fn provider_type(&self) -> ProviderType {
        ProviderType::LMStudio
    }

    fn info(&self) -> ProviderInfo {
        ProviderInfo {
            provider_type: ProviderType::LMStudio,
            name: "LM Studio".to_string(),
            description: Some("Local LM Studio models".to_string()),
            base_url: self.base_url.clone(),
            requires_auth: false,
            default_capabilities: ProviderCapabilities::default(),
            models: Vec::new(),
        }
    }

    async fn get_models(&self) -> AIResult<Vec<ModelInfo>> {
        self.fetch_models().await
    }

    async fn validate_config(&self) -> AIResult<bool> {
        match self.fetch_models().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn send_request(&self, request: AIRequest) -> AIResult<AIResponse> {
        let messages = self.convert_messages(&request.messages);

        let local_request = LocalRequest {
            model: request.model.clone(),
            messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop_sequences,
            stream: Some(false),
        };

        let local_response = self.make_request(local_request).await?;

        let choice = local_response
            .choices
            .first()
            .ok_or_else(|| AIError::invalid_response("No choices in response"))?;

        let usage = local_response
            .usage
            .map(|u| UsageStats::new(u.prompt_tokens, u.completion_tokens))
            .unwrap_or_default();

        Ok(AIResponse::new(
            local_response.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            local_response.model,
            choice.message.content.clone(),
        )
        .with_stop_reason(Self::parse_stop_reason(choice.finish_reason.clone()).unwrap_or(StopReason::Other))
        .with_usage(usage))
    }

    async fn stream_request(
        &self,
        request: AIRequest,
    ) -> AIResult<Pin<Box<dyn Stream<Item = AIResult<StreamChunk>> + Send>>> {
        use futures::stream::{self, StreamExt};
        
        let messages = self.convert_messages(&request.messages);

        let local_request = LocalRequest {
            model: request.model.clone(),
            messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            top_p: request.top_p,
            stop: request.stop_sequences,
            stream: Some(true), // Enable streaming
        };

        let url = format!("{}/v1/chat/completions", self.base_url);
        
        // Create a channel for streaming chunks
        let (tx, rx) = async_channel::unbounded();

        // Spawn a task to handle the streaming request
        let client = self.client.clone();
        let request_body = serde_json::to_vec(&local_request)
            .map_err(|e| AIError::serialization(e.to_string()))?;

        tokio::spawn(async move {
            match client
                .post(&url)
                .header("Content-Type", "application/json")
                .body(request_body)
                .send()
                .await
            {
                Ok(response) => {
                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();
                    
                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(bytes) => {
                                buffer.push_str(&String::from_utf8_lossy(&bytes));
                                
                                // Process lines from the buffer
                                while let Some(pos) = buffer.find('\n') {
                                    let line = buffer[..pos].trim();
                                    buffer = buffer[pos + 1..].to_string();
                                    
                                    if line.starts_with("data: ") {
                                        let data = &line[6..];
                                        
                                        if data == "[DONE]" {
                                            break;
                                        }
                                        
                                        // For LM Studio, we need to use the OpenAI-compatible streaming format
                                        match serde_json::from_str::<LocalStreamResponse>(data) {
                                            Ok(stream_response) => {
                                                if !stream_response.choices.is_empty() {
                                                    if let Some(delta) = &stream_response.choices[0].delta {
                                                        if let Some(content) = &delta.content {
                                                            let chunk = StreamChunk {
                                                                content: content.clone(),
                                                                finish_reason: stream_response.choices[0].finish_reason.clone(),
                                                            };
                                                            
                                                            if tx.send(Ok(chunk)).await.is_err() {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            Err(_) => continue,
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                let _ = tx.send(Err(AIError::network(e))).await;
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(AIError::provider(format!("Failed to connect to LM Studio: {}", e)))).await;
                }
            }
        });

        Ok(Box::pin(rx.stream()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ollama_provider_info() {
        let config = ProviderConfig::new("");
        let provider = OllamaProvider::new(config);

        assert_eq!(provider.provider_type(), ProviderType::Ollama);
        assert_eq!(provider.name(), "Ollama");
    }

    #[test]
    fn test_lmstudio_provider_info() {
        let config = ProviderConfig::new("");
        let provider = LMStudioProvider::new(config);

        assert_eq!(provider.provider_type(), ProviderType::LMStudio);
        assert_eq!(provider.name(), "LM Studio");
    }

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("");
        let provider = OllamaProvider::new(config);

        let messages = vec![
            Message::system("You are helpful"),
            Message::user("Hello"),
        ];

        let converted = provider.convert_messages(&messages);
        assert_eq!(converted.len(), 2);
        assert_eq!(converted[0].role, "system");
        assert_eq!(converted[1].role, "user");
    }
}
