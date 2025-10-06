//! LM Studio Provider Implementation
//! 
//! Implements the AiProvider trait for LM Studio local API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use async_stream::stream;

/// LM Studio API message format (same as OpenAI)
#[derive(Debug, Serialize, Deserialize)]
struct LmStudioMessage {
    role: String,
    content: String,
}

/// LM Studio API request format (same as OpenAI)
#[derive(Debug, Serialize)]
struct LmStudioRequest {
    model: String,
    messages: Vec<LmStudioMessage>,
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

/// LM Studio API response format (same as OpenAI)
#[derive(Debug, Deserialize)]
struct LmStudioResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<LmStudioChoice>,
    usage: Option<LmStudioUsage>,
}

#[derive(Debug, Deserialize)]
struct LmStudioChoice {
    index: u32,
    message: LmStudioMessage,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LmStudioUsage {
    #[serde(rename = "prompt_tokens")]
    prompt_tokens: u32,
    #[serde(rename = "completion_tokens")]
    completion_tokens: u32,
    #[serde(rename = "total_tokens")]
    total_tokens: u32,
}

/// LM Studio streaming response format
#[derive(Debug, Deserialize)]
struct LmStudioStreamResponse {
    id: String,
    object: String,
    created: u64,
    model: String,
    choices: Vec<LmStudioStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct LmStudioStreamChoice {
    index: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    delta: Option<LmStudioDelta>,
    #[serde(rename = "finish_reason")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LmStudioDelta {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

/// LM Studio AI Provider
pub struct LmStudioProvider {
    config: ProviderConfig,
    client: Client,
}

impl LmStudioProvider {
    /// Create a new LM Studio provider
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Convert internal messages to LM Studio format
    fn convert_messages(&self, messages: &[Message]) -> Vec<LmStudioMessage> {
        messages
            .iter()
            .map(|msg| LmStudioMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::System => "system".to_string(),
                },
                content: msg.content.clone(),
            })
            .collect()
    }

    /// Convert LM Studio response to internal format
    fn convert_response(&self, response: LmStudioResponse) -> CompletionResponse {
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
impl AiProvider for LmStudioProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let lm_studio_messages = self.convert_messages(&request.messages);

        let api_request = LmStudioRequest {
            model: request.model.clone(),
            messages: lm_studio_messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            stop: request.stop.clone(),
            stream: Some(false), // Not streaming
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
        };

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/v1/chat/completions", base_url)
        } else {
            "http://localhost:1234/v1/chat/completions".to_string()
        };

        let response = self
            .client
            .post(&url)
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
                provider: "lmstudio".to_string(),
            });
        }

        let api_response: LmStudioResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        let lm_studio_messages = self.convert_messages(&request.messages);

        let api_request = LmStudioRequest {
            model: request.model.clone(),
            messages: lm_studio_messages,
            max_tokens: request.max_tokens,
            temperature: request.temperature,
            top_p: request.top_p,
            stop: request.stop.clone(),
            stream: Some(true), // Enable streaming
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
        };

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/v1/chat/completions", base_url)
        } else {
            "http://localhost:1234/v1/chat/completions".to_string()
        };

        // Create a stream that makes the API request and processes the response
        let client = self.client.clone();
        let stream = async_stream::stream! {
            let response = client
                .post(&url)
                .header("Content-Type", "application/json")
                .json(&api_request)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if !resp.status().is_success() {
                        let status = resp.status().as_u16();
                        let error_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                        yield Err(AIError::Api {
                            status,
                            message: error_text,
                            provider: "lmstudio".to_string(),
                        });
                        return;
                    }

                    let mut stream = resp.bytes_stream();
                    let mut content = String::new();
                    let mut index = 0;

                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(bytes) => {
                                let text = String::from_utf8_lossy(&bytes);
                                
                                // Process the SSE response - LM Studio follows OpenAI's streaming format
                                for line in text.lines() {
                                    if line.starts_with("data: ") {
                                        let data = &line[6..]; // Remove "data: " prefix
                                        if data == "[DONE]" {
                                            yield Ok(StreamChunk {
                                                content: content.clone(),
                                                index,
                                                is_final: true,
                                                usage: None,
                                                extra: HashMap::new(),
                                            });
                                            return;
                                        }

                                        match serde_json::from_str::<LmStudioStreamResponse>(data) {
                                            Ok(stream_resp) => {
                                                if !stream_resp.choices.is_empty() {
                                                    if let Some(ref delta) = stream_resp.choices[0].delta {
                                                        if let Some(ref content_str) = delta.content {
                                                            content.push_str(content_str);
                                                            yield Ok(StreamChunk {
                                                                content: content_str.clone(),
                                                                index: index,
                                                                is_final: stream_resp.choices[0].finish_reason.is_some(),
                                                                usage: None, // Usage comes later or at the end of full completion
                                                                extra: HashMap::new(),
                                                            });
                                                            index += 1;
                                                        }
                                                    }
                                                }
                                            }
                                            Err(e) => {
                                                yield Err(AIError::Serialization(e));
                                                return;
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                yield Err(AIError::Network(e));
                                return;
                            }
                        }
                    }
                }
                Err(e) => {
                    yield Err(AIError::Network(e));
                }
            }
        };

        Ok(Box::pin(stream))
    }

    async fn test_connection(&self) -> AIResult<bool> {
        // Try to make a simple request to test the connection
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], "default-model");
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
        crate::ProviderType::LMStudio
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("lmstudio", "test_key");
        let provider = LmStudioProvider::new(config);
        
        let messages = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let lm_studio_messages = provider.convert_messages(&messages);
        
        assert_eq!(lm_studio_messages.len(), 3);
        assert_eq!(lm_studio_messages[0].role, "system");
        assert_eq!(lm_studio_messages[0].content, "You are a helpful assistant");
        assert_eq!(lm_studio_messages[1].role, "user");
        assert_eq!(lm_studio_messages[1].content, "Hello");
        assert_eq!(lm_studio_messages[2].role, "assistant");
        assert_eq!(lm_studio_messages[2].content, "Hi there");
    }

    #[test]
    fn test_lm_studio_provider_creation() {
        let config = ProviderConfig::new("lmstudio", "test_key");
        let provider = LmStudioProvider::new(config);
        
        assert_eq!(provider.name(), "lmstudio");
    }
}