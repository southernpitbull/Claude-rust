//! Ollama Provider Implementation
//! 
//! Implements the AiProvider trait for Ollama local API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use async_stream::stream;

/// Ollama API message format
#[derive(Debug, Serialize, Deserialize)]
struct OllamaMessage {
    role: String,
    content: String,
}

/// Ollama API request format
#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
    #[serde(skip_serializing_if = "Option::is_none")]
    keep_alive: Option<String>,
}

#[derive(Debug, Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    frequency_penalty: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    presence_penalty: Option<f32>,
}

/// Ollama API response format
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    model: String,
    created_at: String,
    message: OllamaMessage,
    done: bool,
    #[serde(rename = "total_duration")]
    total_duration: Option<u64>,
    #[serde(rename = "load_duration")]
    load_duration: Option<u64>,
    #[serde(rename = "prompt_eval_count")]
    prompt_eval_count: Option<u32>,
    #[serde(rename = "prompt_eval_duration")]
    prompt_eval_duration: Option<u64>,
    #[serde(rename = "eval_count")]
    eval_count: Option<u32>,
    #[serde(rename = "eval_duration")]
    eval_duration: Option<u64>,
}

/// Ollama streaming response format
#[derive(Debug, Deserialize)]
struct OllamaStreamResponse {
    model: String,
    created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<OllamaMessage>,
    done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_duration: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    load_duration: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    prompt_eval_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    prompt_eval_duration: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    eval_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    eval_duration: Option<u64>,
}

/// Ollama AI Provider
pub struct OllamaProvider {
    config: ProviderConfig,
    client: Client,
}

impl OllamaProvider {
    /// Create a new Ollama provider
    pub fn new(config: ProviderConfig) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }

    /// Convert internal messages to Ollama format
    fn convert_messages(&self, messages: &[Message]) -> Vec<OllamaMessage> {
        messages
            .iter()
            .map(|msg| OllamaMessage {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "assistant".to_string(),
                    MessageRole::System => "system".to_string(),
                },
                content: msg.content.clone(),
            })
            .collect()
    }

    /// Convert Ollama response to internal format
    fn convert_response(&self, response: OllamaResponse) -> CompletionResponse {
        let message = Message {
            role: match response.message.role.as_str() {
                "assistant" => MessageRole::Assistant,
                "user" => MessageRole::User,
                _ => MessageRole::System,
            },
            content: response.message.content,
            name: None,
            extra: HashMap::new(),
        };

        // Create usage info from Ollama's evaluation counts
        let usage = Some(Usage {
            prompt_tokens: response.prompt_eval_count,
            completion_tokens: response.eval_count,
            total_tokens: response.prompt_eval_count.and_then(|p| {
                response.eval_count.map(|e| p + e)
            }),
            extra: HashMap::new(),
        });

        let mut completion_response = CompletionResponse::new(message, response.model);
        if let Some(usage) = usage {
            completion_response = completion_response.with_usage(usage);
        }

        completion_response
    }
}

#[async_trait]
impl AiProvider for OllamaProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let ollama_messages = self.convert_messages(&request.messages);

        let options = Some(OllamaOptions {
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: request.n.map(|n| n as i32),
            max_tokens: request.max_tokens.map(|mt| mt as i32),
            stop: request.stop.clone(),
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
        });

        let api_request = OllamaRequest {
            model: request.model.clone(),
            messages: ollama_messages,
            stream: Some(false), // Not streaming
            options,
            keep_alive: Some("5m".to_string()), // Keep model loaded for 5 minutes
        };

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/api/chat", base_url)
        } else {
            "http://localhost:11434/api/chat".to_string()
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
                provider: "ollama".to_string(),
            });
        }

        let api_response: OllamaResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        let ollama_messages = self.convert_messages(&request.messages);

        let options = Some(OllamaOptions {
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: request.n.map(|n| n as i32),
            max_tokens: request.max_tokens.map(|mt| mt as i32),
            stop: request.stop.clone(),
            frequency_penalty: request.frequency_penalty,
            presence_penalty: request.presence_penalty,
        });

        let api_request = OllamaRequest {
            model: request.model.clone(),
            messages: ollama_messages,
            stream: Some(true), // Enable streaming
            options,
            keep_alive: Some("5m".to_string()), // Keep model loaded for 5 minutes
        };

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/api/chat", base_url)
        } else {
            "http://localhost:11434/api/chat".to_string()
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
                            provider: "ollama".to_string(),
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
                                
                                // Process the SSE response - Ollama returns JSON lines
                                for line in text.lines() {
                                    if line.starts_with("data: ") {
                                        let data = &line[6..]; // Remove "data: " prefix
                                        if data == "[DONE]" {
                                            yield Ok(StreamChunk {
                                                content: content.clone(),
                                                index,
                                                is_final: true,
                                                usage: None, // Usage will be provided in the final chunk
                                                extra: HashMap::new(),
                                            });
                                            return;
                                        }

                                        match serde_json::from_str::<OllamaStreamResponse>(data) {
                                            Ok(stream_resp) => {
                                                if let Some(msg) = stream_resp.message {
                                                    content.push_str(&msg.content);
                                                    yield Ok(StreamChunk {
                                                        content: msg.content,
                                                        index: index,
                                                        is_final: stream_resp.done,
                                                        usage: if stream_resp.done {
                                                            Some(Usage {
                                                                prompt_tokens: stream_resp.prompt_eval_count,
                                                                completion_tokens: stream_resp.eval_count,
                                                                total_tokens: stream_resp.prompt_eval_count.and_then(|p| {
                                                                    stream_resp.eval_count.map(|e| p + e)
                                                                }),
                                                                extra: HashMap::new(),
                                                            })
                                                        } else {
                                                            None
                                                        },
                                                        extra: HashMap::new(),
                                                    });
                                                    index += 1;
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
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], "llama2");
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
        crate::ProviderType::Ollama
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("ollama", "test_key");
        let provider = OllamaProvider::new(config);
        
        let messages = vec![
            Message::system("You are a helpful assistant"),
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let ollama_messages = provider.convert_messages(&messages);
        
        assert_eq!(ollama_messages.len(), 3);
        assert_eq!(ollama_messages[0].role, "system");
        assert_eq!(ollama_messages[0].content, "You are a helpful assistant");
        assert_eq!(ollama_messages[1].role, "user");
        assert_eq!(ollama_messages[1].content, "Hello");
        assert_eq!(ollama_messages[2].role, "assistant");
        assert_eq!(ollama_messages[2].content, "Hi there");
    }

    #[test]
    fn test_ollama_provider_creation() {
        let config = ProviderConfig::new("ollama", "test_key");
        let provider = OllamaProvider::new(config);
        
        assert_eq!(provider.name(), "ollama");
    }
}