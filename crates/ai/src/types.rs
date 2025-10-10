//! AI Types
//! 
//! Core types for AI operations including messages, requests, and responses

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use claude_code_core::types::ProviderType;

/// Message roles for conversation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// A message in a conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// The role of the message sender
    pub role: MessageRole,
    
    /// The message content
    pub content: String,
    
    /// Optional name for the message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    
    /// Additional metadata
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Message {
    /// Create a new user message
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::User,
            content: content.into(),
            name: None,
            extra: HashMap::new(),
        }
    }

    /// Create a new assistant message
    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
            name: None,
            extra: HashMap::new(),
        }
    }

    /// Create a new system message
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::System,
            content: content.into(),
            name: None,
            extra: HashMap::new(),
        }
    }
}

/// Usage information for tokens
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Usage {
    /// Number of tokens in the prompt
    pub prompt_tokens: Option<u32>,
    
    /// Number of tokens in the completion
    pub completion_tokens: Option<u32>,
    
    /// Total number of tokens
    pub total_tokens: Option<u32>,
    
    /// Additional provider-specific usage fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// A completion request to an AI provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    /// The messages to send to the model
    pub messages: Vec<Message>,

    /// The model to use
    pub model: String,

    /// Maximum number of tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,

    /// Sampling temperature (0.0 to 2.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// Top-p sampling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// Top-k sampling
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,

    /// Stop sequences
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    /// Frequency penalty
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    /// Presence penalty
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    /// Number of completions to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n: Option<u32>,

    /// Whether to stream the response
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    /// Additional options
    #[serde(flatten)]
    pub options: HashMap<String, serde_json::Value>,
}

impl CompletionRequest {
    /// Create a new completion request with messages and model
    pub fn new(messages: Vec<Message>, model: impl Into<String>) -> Self {
        Self {
            messages,
            model: model.into(),
            max_tokens: None,
            temperature: Some(1.0),
            top_p: Some(1.0),
            top_k: None,
            stop: None,
            frequency_penalty: None,
            presence_penalty: None,
            n: Some(1),
            stream: Some(false),
            options: HashMap::new(),
        }
    }

    /// Add a message to the request
    pub fn add_message(mut self, message: Message) -> Self {
        self.messages.push(message);
        self
    }

    /// Set max tokens
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    /// Set temperature
    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    /// Set streaming
    pub fn with_streaming(mut self, stream: bool) -> Self {
        self.stream = Some(stream);
        self
    }
}

/// Stop reason for completion
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    /// Natural end of completion
    EndTurn,
    /// Hit max tokens limit
    MaxTokens,
    /// Hit stop sequence
    StopSequence,
    /// Content filtered
    ContentFilter,
    /// Function/tool call
    ToolUse,
    /// Other/unknown reason
    Other,
}

/// A chunk of a streaming response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    /// The chunk content
    pub content: String,

    /// The index of this chunk in the sequence
    pub index: usize,

    /// Whether this is the final chunk
    pub is_final: bool,

    /// Optional usage information (usually only in final chunk)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,

    /// Additional provider-specific fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl StreamChunk {
    /// Create a content delta chunk
    pub fn content_delta(content: impl Into<String>, index: usize) -> Self {
        Self {
            content: content.into(),
            index,
            is_final: false,
            usage: None,
            extra: HashMap::new(),
        }
    }

    /// Create a message complete chunk
    pub fn message_complete(
        _id: impl Into<String>,
        _stop_reason: Option<StopReason>,
        usage: Option<Usage>,
    ) -> Self {
        Self {
            content: String::new(),
            index: 0,
            is_final: true,
            usage,
            extra: HashMap::new(),
        }
    }
}

/// A completion response from an AI provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    /// The generated message
    pub message: Message,
    
    /// The model that generated the response
    pub model: String,
    
    /// Usage information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    
    /// Timestamp of the response
    pub created: DateTime<Utc>,
    
    /// The finish reason
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
    
    /// Additional provider-specific fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl CompletionResponse {
    /// Create a new completion response
    pub fn new(message: Message, model: impl Into<String>) -> Self {
        Self {
            message,
            model: model.into(),
            usage: None,
            created: Utc::now(),
            finish_reason: None,
            extra: HashMap::new(),
        }
    }

    /// Set usage information
    pub fn with_usage(mut self, usage: Usage) -> Self {
        self.usage = Some(usage);
        self
    }

    /// Set finish reason
    pub fn with_finish_reason(mut self, reason: impl Into<String>) -> Self {
        self.finish_reason = Some(reason.into());
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_creation() {
        let user_msg = Message::user("Hello");
        assert_eq!(user_msg.role, MessageRole::User);
        assert_eq!(user_msg.content, "Hello");

        let assistant_msg = Message::assistant("Hi there");
        assert_eq!(assistant_msg.role, MessageRole::Assistant);
        assert_eq!(assistant_msg.content, "Hi there");

        let system_msg = Message::system("You are a helpful assistant");
        assert_eq!(system_msg.role, MessageRole::System);
        assert_eq!(system_msg.content, "You are a helpful assistant");
    }

    #[test]
    fn test_completion_request_creation() {
        let messages = vec![Message::user("Hello")];
        let request = CompletionRequest::new(messages, "gpt-4");
        
        assert_eq!(request.model, "gpt-4");
        assert_eq!(request.temperature, Some(1.0));
        assert_eq!(request.n, Some(1));
    }

    #[test]
    fn test_completion_response_creation() {
        let message = Message::assistant("Hello");
        let response = CompletionResponse::new(message, "claude-3");
        
        assert_eq!(response.model, "claude-3");
        assert_eq!(response.message.role, MessageRole::Assistant);
    }

    #[test]
    fn test_usage_creation() {
        let usage = Usage {
            prompt_tokens: Some(10),
            completion_tokens: Some(20),
            total_tokens: Some(30),
            extra: HashMap::new(),
        };

        assert_eq!(usage.prompt_tokens, Some(10));
        assert_eq!(usage.completion_tokens, Some(20));
        assert_eq!(usage.total_tokens, Some(30));
    }

    #[test]
    fn test_message_role_serialization() {
        let role = MessageRole::User;
        let serialized = serde_json::to_string(&role).unwrap();
        assert_eq!(serialized, "\"user\"");

        let role = MessageRole::Assistant;
        let serialized = serde_json::to_string(&role).unwrap();
        assert_eq!(serialized, "\"assistant\"");
    }
}