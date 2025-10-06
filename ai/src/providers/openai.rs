//! OpenAI Provider Implementation
//! 
//! Implements the AiProvider trait for OpenAI API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// OpenAI API message format
#[derive(Debug, Serialize, Deserialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

/// OpenAI API response format
#[derive(Debug, Deserialize)]
struct OpenAiResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    index: u32,
    message: OpenAiMessage,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    #[serde(rename = "prompt_tokens")]
    prompt_tokens: u32,
    #[serde(rename = "completion_tokens")]
    completion_tokens: u32,
    #[serde(rename = "total_tokens")]
    total_tokens: u32,
}

/// OpenAI API request format
#[derive(Debug, Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    presence_penalty: Option<f32>,
}

/// OpenAI AI Provider
pub struct OpenAiProvider {
    config: ProviderConfig,
    client: Client,
}

impl OpenAiProvider {
    /// Create a new OpenAI provider
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Convert internal messages to OpenAI format
    fn convert_messages(&self, messages: &[Message]) -> Vec<OpenAiMessage> {
        messages
            .iter()
            .map(|msg| OpenAiMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::System => "system".to_string(),
                },
                content: msg.content.clone(),
            })
            .collect()
    }

    /// Convert OpenAI response to internal format
    fn convert_response(&self, response: OpenAiResponse) -> CompletionResponse {
        let content = if !response.choices.is_empty() {
            response.choices[0].message.content.clone()
        } else {
            String::new()
        };

        let message = Message {
            role: MessageRole::Assistant,
            content,
            name: None,
            extra: HashMap::new(),
        };

        let usage = response.usage.map(|usage| Usage {
            prompt_tokens: Some(usage.prompt_tokens),
            completion_tokens: Some(usage.completion_tokens),
            total_tokens: Some(usage.total_tokens),
            extra: HashMap::new(),
        });

        let mut completion_response = CompletionResponse::new(message, response.model);
        if let Some(usage) = usage {
            completion_response = completion_response.with_usage(usage);
        }
        if !response.choices.is_empty() {
            if let Some(ref finish_reason) = response.choices[0].finish_reason {
                completion_response = completion_response.with_finish_reason(finish_reason);
            }
        }

        completion_response
    }
}

#[async_trait]
impl AiProvider for OpenAiProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let openai_messages = self.convert_messages(&request.messages);

        let api_request = OpenAiRequest {
            model: request.model.clone(),
            messages: openai_messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            stop: request.stop.clone(),
            stream: Some(false), // Not streaming
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
        };

        let response = self
            .client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", &self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&api_request)
            .send()
            .await
            .map_err(|e| AIError::Network(e))?;

        if !response.status().is_success() {
            let status = response.status().as_u16();
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::Api {
                status,
                message: error_text,
                provider: "openai".to_string(),
            });
        }

        let api_response: OpenAiResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        // Streaming implementation for OpenAI would use Server-Sent Events (SSE)
        // This is a simplified version - in practice, you'd need to handle SSE properly
        let error = AIError::Internal("Streaming not fully implemented for OpenAI provider".to_string());
        let stream = futures::stream::once(async move {
            Err(error)
        }).boxed();
        Ok(stream)
    }

    async fn test_connection(&self) -> AIResult<bool> {
        // Try to make a simple request to test the connection
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], "gpt-3.5-turbo");
        match self.complete(&test_request).await {
            Ok(_) => Ok(true),
            Err(e) => {
                // In a real implementation, we might want to log this differently
                // but for now, just return the error to indicate connection failure
                Err(e)
            }
        }
    }

    fn name(&self) -> &str {
        &self.config.name
    }

    fn provider_type(&self) -> crate::ProviderType {
        crate::ProviderType::OpenAI
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("openai", "test_key");
        let provider = OpenAiProvider::new(config);
        
        let messages = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let openai_messages = provider.convert_messages(&messages);
        
        assert_eq!(openai_messages.len(), 3);
        assert_eq!(openai_messages[0].role, "system");
        assert_eq!(openai_messages[0].content, "You are a helpful assistant");
        assert_eq!(openai_messages[1].role, "user");
        assert_eq!(openai_messages[1].content, "Hello");
        assert_eq!(openai_messages[2].role, "assistant");
        assert_eq!(openai_messages[2].content, "Hi there");
    }

    #[test]
    fn test_openai_provider_creation() {
        let config = ProviderConfig::new("openai", "test_key");
        let provider = OpenAiProvider::new(config);
        
        assert_eq!(provider.name(), "openai");
    }
}