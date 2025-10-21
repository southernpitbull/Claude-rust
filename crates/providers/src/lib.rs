//! AI provider adapters for AIrchitect CLI

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMetadata {
    pub name: String,
    pub version: String,
    pub description: String,
    pub supported_models: Vec<String>,
    pub capabilities: Vec<String>,
}

pub trait AIProviderAdapter: Send + Sync {
    fn get_metadata(&self) -> ProviderMetadata;
    fn is_available(&self) -> bool;
    fn get_models(&self) -> Vec<String>;
    fn send_request(
        &self,
        request: &str,
        model: &str,
    ) -> Result<String, ai_cli_utils::error::AIError>;
}

pub struct OpenAIAdapter {
    pub api_key: String,
    pub base_url: String,
}

impl OpenAIAdapter {
    pub fn new(api_key: String, base_url: String) -> Self {
        OpenAIAdapter { api_key, base_url }
    }
}

impl AIProviderAdapter for OpenAIAdapter {
    fn get_metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            name: "OpenAI".to_string(),
            version: "v1".to_string(),
            description: "OpenAI API adapter".to_string(),
            supported_models: vec!["gpt-4".to_string(), "gpt-3.5-turbo".to_string()],
            capabilities: vec!["text-generation".to_string(), "chat".to_string()],
        }
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn get_models(&self) -> Vec<String> {
        vec!["gpt-4".to_string(), "gpt-3.5-turbo".to_string()]
    }

    fn send_request(
        &self,
        request: &str,
        model: &str,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        // Placeholder implementation
        Ok(format!("OpenAI response for model {}: {}", model, request))
    }
}

pub struct AnthropicAdapter {
    pub api_key: String,
    pub base_url: String,
}

impl AnthropicAdapter {
    pub fn new(api_key: String, base_url: String) -> Self {
        AnthropicAdapter { api_key, base_url }
    }
}

impl AIProviderAdapter for AnthropicAdapter {
    fn get_metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            name: "Anthropic".to_string(),
            version: "v1".to_string(),
            description: "Anthropic API adapter".to_string(),
            supported_models: vec!["claude-3-opus".to_string(), "claude-3-sonnet".to_string()],
            capabilities: vec!["text-generation".to_string(), "chat".to_string()],
        }
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn get_models(&self) -> Vec<String> {
        vec!["claude-3-opus".to_string(), "claude-3-sonnet".to_string()]
    }

    fn send_request(
        &self,
        request: &str,
        model: &str,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        // Placeholder implementation
        Ok(format!(
            "Anthropic response for model {}: {}",
            model, request
        ))
    }
}

pub struct GoogleAdapter {
    pub api_key: String,
    pub base_url: String,
}

impl GoogleAdapter {
    pub fn new(api_key: String, base_url: String) -> Self {
        GoogleAdapter { api_key, base_url }
    }
}

impl AIProviderAdapter for GoogleAdapter {
    fn get_metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            name: "Google".to_string(),
            version: "v1".to_string(),
            description: "Google AI API adapter".to_string(),
            supported_models: vec!["gemini-pro".to_string(), "gemini-ultra".to_string()],
            capabilities: vec!["text-generation".to_string(), "chat".to_string()],
        }
    }

    fn is_available(&self) -> bool {
        !self.api_key.is_empty()
    }

    fn get_models(&self) -> Vec<String> {
        vec!["gemini-pro".to_string(), "gemini-ultra".to_string()]
    }

    fn send_request(
        &self,
        request: &str,
        model: &str,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        // Placeholder implementation
        Ok(format!("Google response for model {}: {}", model, request))
    }
}
