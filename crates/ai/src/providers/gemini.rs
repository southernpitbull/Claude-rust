//! Gemini Provider Implementation
//! 
//! Implements the AiProvider trait for Google's Gemini API

use crate::provider::{AiProvider, ProviderConfig};
use crate::error::{AIError, AIResult};
use crate::types::{CompletionRequest, CompletionResponse, Message, MessageRole, StreamChunk, Usage};
use async_trait::async_trait;
use futures::stream::{BoxStream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Gemini API content format
#[derive(Debug, Serialize, Deserialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

/// Gemini API request format
#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GeminiGenerationConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    safety_settings: Option<Vec<GeminiSafetySetting>>,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stop_sequences: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
struct GeminiSafetySetting {
    category: String,
    threshold: String,
}

/// Gemini API response format
#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    #[serde(rename = "usageMetadata")]
    usage_metadata: Option<GeminiUsageMetadata>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: GeminiContent,
    #[serde(rename = "finishReason")]
    finish_reason: Option<String>,
    #[serde(rename = "safetyRatings")]
    safety_ratings: Option<Vec<GeminiSafetyRating>>,
}

#[derive(Debug, Deserialize)]
struct GeminiSafetyRating {
    category: String,
    probability: String,
}

#[derive(Debug, Deserialize)]
struct GeminiUsageMetadata {
    #[serde(rename = "promptTokenCount")]
    prompt_token_count: Option<u32>,
    #[serde(rename = "candidatesTokenCount")]
    candidates_token_count: Option<u32>,
    #[serde(rename = "totalTokenCount")]
    total_token_count: Option<u32>,
}

/// Gemini AI Provider
pub struct GeminiProvider {
    config: ProviderConfig,
    client: Client,
    model: String, // Model name without "models/" prefix
}

impl GeminiProvider {
    /// Create a new Gemini provider
    pub fn new(config: ProviderConfig) -> Self {
        let model = config.default_model
            .clone()
            .unwrap_or_else(|| "gemini-pro".to_string());
        Self {
            client: Client::new(),
            config,
            model,
        }
    }

    /// Convert internal messages to Gemini format
    fn convert_messages(&self, messages: &[Message]) -> Vec<GeminiContent> {
        messages
            .iter()
            .map(|msg| GeminiContent {
                role: match msg.role {
                    MessageRole::User => "user".to_string(),
                    MessageRole::Assistant => "model".to_string(),
                    MessageRole::System => "user".to_string(), // Gemini doesn't have a system role
                },
                parts: vec![GeminiPart {
                    text: msg.content.clone(),
                }],
            })
            .collect()
    }

    /// Convert Gemini response to internal format
    fn convert_response(&self, response: GeminiResponse) -> CompletionResponse {
        let content = if let Some(candidates) = &response.candidates {
            if !candidates.is_empty() {
                if !candidates[0].content.parts.is_empty() {
                    candidates[0].content.parts[0].text.clone()
                } else {
                    String::new()
                }
            } else {
                String::new()
            }
        } else {
            String::new()
        };

        let message = Message {
            role: MessageRole::Assistant,
            content,
            name: None,
            extra: HashMap::new(),
        };

        let usage = response.usage_metadata.map(|usage| Usage {
            prompt_tokens: usage.prompt_token_count,
            completion_tokens: usage.candidates_token_count,
            total_tokens: usage.total_token_count,
            extra: HashMap::new(),
        });

        let mut completion_response = CompletionResponse::new(message, self.model.clone());
        if let Some(usage) = usage {
            completion_response = completion_response.with_usage(usage);
        }
        if let Some(candidates) = &response.candidates {
            if !candidates.is_empty() {
                if let Some(ref finish_reason) = candidates[0].finish_reason {
                    completion_response = completion_response.with_finish_reason(finish_reason);
                }
            }
        }

        completion_response
    }
}

#[async_trait]
impl AiProvider for GeminiProvider {
    async fn complete(&self, request: &CompletionRequest) -> AIResult<CompletionResponse> {
        let gemini_messages = self.convert_messages(&request.messages);

        let generation_config = Some(GeminiGenerationConfig {
            temperature: request.temperature,
            top_p: request.top_p,
            top_k: request.n.map(|n| n as i32), // Convert to i32 for Gemini
            max_output_tokens: request.max_tokens.map(|mt| mt as i32), // Convert to i32 for Gemini
            stop_sequences: request.stop.clone(),
        });

        let api_request = GeminiRequest {
            contents: gemini_messages,
            generation_config,
            safety_settings: None, // Optionally configure safety settings
        };

        // Construct the API URL - Gemini API uses a different format
        let model_name = if self.model.starts_with("models/") {
            self.model.clone()
        } else {
            format!("models/{}", self.model)
        };
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
            model_name, &self.config.api_key
        );

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
                provider: "gemini".to_string(),
            });
        }

        let api_response: GeminiResponse = response.json().await
            .map_err(AIError::Network)?;
        Ok(self.convert_response(api_response))
    }

    async fn complete_stream(
        &self,
        request: &CompletionRequest,
    ) -> AIResult<BoxStream<'static, AIResult<StreamChunk>>> {
        let gemini_messages = self.convert_messages(&request.messages);

        let url = if let Some(ref base_url) = self.config.base_url {
            format!("{}/v1beta/models/{}:streamGenerateContent", base_url, request.model)
        } else {
            format!("https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?key={}", 
                    request.model, self.config.api_key)
        };

        let api_request = GeminiRequest {
            contents: gemini_messages,
            generation_config: Some(GeminiGenerationConfig {
                temperature: request.temperature,
                top_p: request.top_p,
                top_k: request.top_k.map(|k| k as i32),
                max_output_tokens: request.max_tokens.map(|t| t as i32),
                stop_sequences: request.stop.clone(),
            }),
            safety_settings: None, // Use default safety settings
        };

        // Create a stream that makes the API request and processes the response
        use async_stream::stream;
        let client = self.client.clone();
        let stream = stream! {
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
                            provider: "gemini".to_string(),
                        });
                        return;
                    }

                    let mut stream = resp.bytes_stream();
                    let mut buffer = String::new();
                    let mut content = String::new();
                    let mut index = 0;

                    while let Some(chunk) = stream.next().await {
                        match chunk {
                            Ok(bytes) => {
                                buffer.push_str(&String::from_utf8_lossy(&bytes));
                                
                                // Process the JSON response (multiple JSON objects separated by newlines)
                                while let Some(pos) = buffer.find('\n') {
                                    let line = buffer[..pos].trim().to_string();
                                    buffer = buffer[pos + 1..].to_string();

                                    if !line.is_empty() {
                                        // Parse Gemini's streaming response
                                        match serde_json::from_str::<GeminiResponse>(&line) {
                                            Ok(api_response) => {
                                                // Extract content from the response
                                                if let Some(candidates) = api_response.candidates {
                                                    for candidate in candidates {
                                                        for part in candidate.content.parts {
                                                            let text = part.text;
                                                            content.push_str(&text);
                                                            yield Ok(StreamChunk::content_delta(text, index));
                                                            index += 1;
                                                        }
                                                    }
                                                }
                                            }
                                            Err(_) => {
                                                // Ignore parsing errors for this line
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

                    // At the end, send a completion chunk
                    yield Ok(StreamChunk::message_complete(
                        uuid::Uuid::new_v4().to_string(),
                        Some(crate::types::StopReason::EndTurn),
                        None,
                    ));
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
        let test_request = CompletionRequest::new(vec![Message::user("Hello")], self.model.clone());
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
        crate::ProviderType::Gemini
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_messages() {
        let config = ProviderConfig::new("gemini", "test_key");
        let provider = GeminiProvider::new(config);
        
        let messages = vec![
            Message::user("Hello"),
            Message::assistant("Hi there"),
        ];
        
        let gemini_messages = provider.convert_messages(&messages);
        
        assert_eq!(gemini_messages.len(), 2);
        assert_eq!(gemini_messages[0].role, "user");
        assert_eq!(gemini_messages[0].parts[0].text, "Hello");
        assert_eq!(gemini_messages[1].role, "model");
        assert_eq!(gemini_messages[1].parts[0].text, "Hi there");
    }

    #[test]
    fn test_gemini_provider_creation() {
        let config = ProviderConfig::new("gemini", "test_key");
        let provider = GeminiProvider::new(config);
        
        assert_eq!(provider.name(), "gemini");
    }
}