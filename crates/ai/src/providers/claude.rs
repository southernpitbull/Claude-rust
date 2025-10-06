//! Claude Provider Implementation
//! 
//! Implements the AiProvider trait for Anthropic's Claude API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Claude API response format
#[derive(Debug, Deserialize)]
struct ClaudeApiResponse {
    #[serde(rename = "type")]
    response_type: String,
    id: String,
    content: Vec<ClaudeContent>,
    model: String,
    #[serde(rename = "stop_reason")]
    finish_reason: Option<String>,
    #[serde(rename = "stop_sequence")]
    stop_sequence: Option<String>,
    #[serde(rename = "usage")]
    usage: ClaudeUsage,
}

#[derive(Debug, Deserialize)]
struct ClaudeContent {
    #[serde(rename = "type")]
    content_type: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeUsage {
    #[serde(rename = "input_tokens")]
    input_tokens: u32,
    #[serde(rename = "output_tokens")]
    output_tokens: u32,
}

/// Claude API request format
#[derive(Debug, Serialize)]
struct ClaudeApiRequest {
    model: String,
    messages: Vec<ClaudeMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop_sequences: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
}

#[derive(Debug, Serialize)]
struct ClaudeMessage {
    role: String,
    content: String,
}

/// Claude AI Provider
pub struct ClaudeProvider {
    config: ProviderConfig,
    client: Client,
}

impl ClaudeProvider {
    /// Create a new Claude provider
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Convert internal messages to Claude format
    fn convert_messages(&self, messages: &[Message]) -> Vec<ClaudeMessage> {
        let mut claude_messages = Vec::new();

        for message in messages {
            match message.role {
                MessageRole::System => {
                    // Claude handles system messages separately - skip them here
                    // They are extracted in the complete() function
                }
                _ => {
                    // User or Assistant messages go into the messages array
                    claude_messages.push(ClaudeMessage {
                        role: match message.role {
                            MessageRole::User => "user".to_string(),
                            MessageRole::Assistant => "assistant".to_string(),
                            MessageRole::System => "user".to_string(), // System merged separately
                        },
                        content: message.content.clone(),
                    });
                }
            }
        }

        claude_messages
    }

    /// Convert Claude response to internal format
    fn convert_response(&self, response: ClaudeApiResponse) -> CompletionResponse {
        let content = if !response.content.is_empty() {
            response.content[0].text.clone()
        } else {
            String::new()
        };

        let message = Message {
            role: MessageRole::Assistant,
            content,
            name: None,
            extra: HashMap::new(),
        };

        let usage = Some(Usage {
            prompt_tokens: Some(response.usage.input_tokens),
            completion_tokens: Some(response.usage.output_tokens),
            total_tokens: Some(response.usage.input_tokens + response.usage.output_tokens),
            extra: HashMap::new(),
        });

        CompletionResponse::new(message, response.model)
            .with_usage(usage.unwrap())
            .with_finish_reason(response.finish_reason.unwrap_or_else(|| "stop".to_string()))
    }
}

#[async_trait]
impl AiProvider for ClaudeProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let claude_messages = self.convert_messages(&request.messages);
        
        let system_content = request
            .messages
            .iter()
            .find(|m| m.role == MessageRole::System)
            .map(|m| m.content.clone());

        let api_request = ClaudeApiRequest {
            model: request.model.clone(),
            messages: claude_messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: None, // Claude-specific parameter
            stop_sequences: request.stop.clone(),
            stream: Some(false), // Not streaming
            system: system_content,
        };

        let response = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.config.api_key)
            .header("anthropic-version", "2023-06-01") // Current Claude API version
            .header("content-type", "application/json")
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
                provider: "claude".to_string(),
            });
        }

        let api_response: ClaudeApiResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        // Streaming implementation for Claude would use Server-Sent Events (SSE)
        // This is a simplified version - in practice, you'd need to handle SSE properly
        let error = AIError::Internal("Streaming not fully implemented for Claude provider".to_string());
        let stream = futures::stream::once(async move {
            Err(error)
        }).boxed();
        Ok(stream)
    }

    async fn test_connection(&self) -> AIResult<bool> {
        // Try to make a simple request to test the connection
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], "claude-3-sonnet-20240229");
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
        crate::ProviderType::Claude
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("claude", "test_key");
        let provider = ClaudeProvider::new(config);
        
        let messages = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let claude_messages = provider.convert_messages(&messages);
        
        // The system message should be handled separately, not in the messages array
        assert_eq!(claude_messages.len(), 2); // Only user and assistant messages
        assert_eq!(claude_messages[0].role, "user");
        assert_eq!(claude_messages[0].content, "Hello");
        assert_eq!(claude_messages[1].role, "assistant");
        assert_eq!(claude_messages[1].content, "Hi there");
    }

    #[test]
    fn test_claude_provider_creation() {
        let config = ProviderConfig::new("claude", "test_key");
        let provider = ClaudeProvider::new(config);
        
        assert_eq!(provider.name(), "claude");
    }
}