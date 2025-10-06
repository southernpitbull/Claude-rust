//! Qwen Provider Implementation
//! 
//! Implements the AiProvider trait for Alibaba's Qwen API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Qwen API message format
#[derive(Debug, Serialize, Deserialize)]
struct QwenMessage {
    role: String,
    content: String,
}

/// Qwen API request format
#[derive(Debug, Serialize)]
struct QwenRequest {
    model: String,
    messages: Vec<QwenMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    parameters: Option<QwenParameters>,
}

#[derive(Debug, Serialize)]
struct QwenParameters {
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    repetition_penalty: Option<f32>,
}

/// Qwen API response format
#[derive(Debug, Deserialize)]
struct QwenResponse {
    output: QwenOutput,
    usage: QwenUsage,
    #[serde(rename = "request_id")]
    request_id: String,
}

#[derive(Debug, Deserialize)]
struct QwenOutput {
    text: String,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QwenUsage {
    #[serde(rename = "input_tokens")]
    input_tokens: u32,
    #[serde(rename = "output_tokens")]
    output_tokens: u32,
    #[serde(rename = "total_tokens")]
    total_tokens: u32,
}

/// Qwen AI Provider
pub struct QwenProvider {
    config: ProviderConfig,
    client: Client,
}

impl QwenProvider {
    /// Create a new Qwen provider
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Convert internal messages to Qwen format
    fn convert_messages(&self, messages: &[Message]) -> Vec<QwenMessage> {
        messages
            .iter()
            .map(|msg| QwenMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::System => "system".to_string(), // Qwen supports system role
                },
                content: msg.content.clone(),
            })
            .collect()
    }

    /// Convert Qwen response to internal format
    fn convert_response(&self, response: QwenResponse, model: String) -> CompletionResponse {
        let message = Message {
            role: MessageRole::Assistant,
            content: response.output.text,
            name: None,
            extra: HashMap::new(),
        };

        let usage = Some(Usage {
            prompt_tokens: Some(response.usage.input_tokens),
            completion_tokens: Some(response.usage.output_tokens),
            total_tokens: Some(response.usage.total_tokens),
            extra: HashMap::new(),
        });

        let mut completion_response = CompletionResponse::new(message, model);
        if let Some(usage) = usage {
            completion_response = completion_response.with_usage(usage);
        }
        if let Some(finish_reason) = response.output.finish_reason {
            completion_response = completion_response.with_finish_reason(finish_reason);
        }

        completion_response
    }
}

#[async_trait]
impl AiProvider for QwenProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let qwen_messages = self.convert_messages(&request.messages);

        let parameters = Some(QwenParameters {
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: None, // Qwen-specific parameter
            stop: request.stop.clone(),
            repetition_penalty: None, // Qwen-specific parameter
        });

        let api_request = QwenRequest {
            model: request.model.clone(),
            messages: qwen_messages,
            parameters,
        };

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/api/v1/chat/completions", base_url)
        } else {
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation".to_string()
        };

        let response = self
            .client
            .post(&url)
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
                provider: "qwen".to_string(),
            });
        }

        let api_response: QwenResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response, request.model.clone()))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        // Streaming implementation for Qwen would use Server-Sent Events (SSE)
        // This is a simplified version - in practice, you'd need to handle SSE properly
        let error = AIError::Internal("Streaming not fully implemented for Qwen provider".to_string());
        let stream = futures::stream::once(async move {
            Err(error)
        }).boxed();
        Ok(stream)
    }

    async fn test_connection(&self) -> AIResult<bool> {
        // Try to make a simple request to test the connection
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], "qwen-max");
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
        crate::ProviderType::Qwen
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("qwen", "test_key");
        let provider = QwenProvider::new(config);
        
        let messages = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let qwen_messages = provider.convert_messages(&messages);
        
        assert_eq!(qwen_messages.len(), 3);
        assert_eq!(qwen_messages[0].role, "system");
        assert_eq!(qwen_messages[0].content, "You are a helpful assistant");
        assert_eq!(qwen_messages[1].role, "user");
        assert_eq!(qwen_messages[1].content, "Hello");
        assert_eq!(qwen_messages[2].role, "assistant");
        assert_eq!(qwen_messages[2].content, "Hi there");
    }

    #[test]
    fn test_qwen_provider_creation() {
        let config = ProviderConfig::new("qwen", "test_key");
        let provider = QwenProvider::new(config);
        
        assert_eq!(provider.name(), "qwen");
    }
}