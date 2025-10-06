use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Application result type alias
pub type AppResult<T> = Result<T, crate::error::AppError>;

/// Provider type enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Claude,
    OpenAI,
    Gemini,
    Qwen,
    Ollama,
    LMStudio,
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Claude => write!(f, "claude"),
            Self::OpenAI => write!(f, "openai"),
            Self::Gemini => write!(f, "gemini"),
            Self::Qwen => write!(f, "qwen"),
            Self::Ollama => write!(f, "ollama"),
            Self::LMStudio => write!(f, "lmstudio"),
        }
    }
}

/// Authentication method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthMethod {
    OAuth,
    ApiKey,
    None,
}

/// Authentication state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthState {
    Initial,
    Authenticating,
    Authenticated,
    Failed,
    Refreshing,
    Expired,
    Unauthenticated,
}

/// Account status for multi-account support
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountStatus {
    Active,
    RateLimited,
    Expired,
    Disabled,
    Error,
}

/// Message role in a conversation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

/// Message in a conversation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Message {
    /// Role of the message sender
    pub role: MessageRole,
    /// Content of the message
    pub content: String,
}

/// AI model information
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AIModel {
    /// Model ID
    pub id: String,
    /// Model name
    pub name: String,
    /// Model version
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Maximum context length in tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_context_length: Option<usize>,
    /// Whether the model supports streaming
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supports_streaming: Option<bool>,
    /// Default parameters for the model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_params: Option<HashMap<String, serde_json::Value>>,
}

/// Token usage information
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Usage {
    /// Input tokens used
    pub input_tokens: u32,
    /// Output tokens used
    pub output_tokens: u32,
    /// Total tokens used
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
}

/// Completion options
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompletionOptions {
    /// Model to use
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    /// Temperature for sampling (0-1)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Maximum tokens to generate
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    /// Top P sampling parameter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    /// Top K sampling parameter
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    /// Stop sequences to end generation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
    /// System message for context
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
}

/// AI completion request
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompletionRequest {
    /// Messages for the conversation
    pub messages: Vec<Message>,
    /// Completion options
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<CompletionOptions>,
}

/// AI completion response
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompletionResponse {
    /// Generated text
    pub text: String,
    /// Model used for generation
    pub model: String,
    /// Reason the generation stopped
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<String>,
    /// Token usage information
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_type_display() {
        assert_eq!(ProviderType::Claude.to_string(), "claude");
        assert_eq!(ProviderType::OpenAI.to_string(), "openai");
        assert_eq!(ProviderType::Gemini.to_string(), "gemini");
        assert_eq!(ProviderType::Qwen.to_string(), "qwen");
        assert_eq!(ProviderType::Ollama.to_string(), "ollama");
        assert_eq!(ProviderType::LMStudio.to_string(), "lmstudio");
    }

    #[test]
    fn test_provider_type_serialization() {
        let provider = ProviderType::Claude;
        let json = serde_json::to_string(&provider).unwrap();
        assert_eq!(json, "\"claude\"");

        let deserialized: ProviderType = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, provider);
    }

    #[test]
    fn test_message_role_serialization() {
        let role = MessageRole::User;
        let json = serde_json::to_string(&role).unwrap();
        assert_eq!(json, "\"user\"");

        let deserialized: MessageRole = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, role);
    }

    #[test]
    fn test_message_serialization() {
        let message = Message {
            role: MessageRole::User,
            content: "Hello, world!".to_string(),
        };

        let json = serde_json::to_string(&message).unwrap();
        let deserialized: Message = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.role, message.role);
        assert_eq!(deserialized.content, message.content);
    }

    #[test]
    fn test_usage_serialization() {
        let usage = Usage {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: Some(150),
        };

        let json = serde_json::to_string(&usage).unwrap();
        let deserialized: Usage = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.input_tokens, usage.input_tokens);
        assert_eq!(deserialized.output_tokens, usage.output_tokens);
        assert_eq!(deserialized.total_tokens, usage.total_tokens);
    }

    #[test]
    fn test_completion_request_serialization() {
        let request = CompletionRequest {
            messages: vec![
                Message {
                    role: MessageRole::User,
                    content: "Test message".to_string(),
                },
            ],
            options: Some(CompletionOptions {
                model: Some("claude-3".to_string()),
                temperature: Some(0.7),
                max_tokens: Some(100),
                top_p: None,
                top_k: None,
                stop_sequences: None,
                system: None,
            }),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CompletionRequest = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.messages.len(), request.messages.len());
        assert_eq!(deserialized.options.is_some(), request.options.is_some());
    }

    #[test]
    fn test_completion_response_serialization() {
        let response = CompletionResponse {
            text: "Generated text".to_string(),
            model: "claude-3".to_string(),
            stop_reason: Some("end_turn".to_string()),
            usage: Some(Usage {
                input_tokens: 50,
                output_tokens: 25,
                total_tokens: Some(75),
            }),
        };

        let json = serde_json::to_string(&response).unwrap();
        let deserialized: CompletionResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.text, response.text);
        assert_eq!(deserialized.model, response.model);
        assert_eq!(deserialized.stop_reason, response.stop_reason);
        assert!(deserialized.usage.is_some());
    }

    #[test]
    fn test_auth_state_serialization() {
        let state = AuthState::Authenticated;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, "\"authenticated\"");

        let deserialized: AuthState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, state);
    }

    #[test]
    fn test_account_status_serialization() {
        let status = AccountStatus::Active;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"active\"");

        let deserialized: AccountStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, status);
    }
}
