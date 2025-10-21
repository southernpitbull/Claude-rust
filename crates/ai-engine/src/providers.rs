use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

pub enum AIProvider {
    OpenAI(OpenAIConfig),
    Anthropic(AnthropicConfig),
    Google(GoogleConfig),
    Qwen(QwenConfig),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QwenConfig {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

impl AIProvider {
    pub async fn send_request(&self, prompt: &str) -> Result<String, ai_cli_utils::error::AIError> {
        // Placeholder implementation
        match self {
            AIProvider::OpenAI(config) => {
                println!("Sending request to OpenAI: {} - {}", config.model, prompt);
                Ok(format!("OpenAI response: Echo - {}", prompt))
            }
            AIProvider::Anthropic(config) => {
                println!(
                    "Sending request to Anthropic: {} - {}",
                    config.model, prompt
                );
                Ok(format!("Anthropic response: Echo - {}", prompt))
            }
            AIProvider::Google(config) => {
                println!("Sending request to Google: {} - {}", config.model, prompt);
                Ok(format!("Google response: Echo - {}", prompt))
            }
            AIProvider::Qwen(config) => {
                println!("Sending request to Qwen: {} - {}", config.model, prompt);
                Ok(format!("Qwen response: Echo - {}", prompt))
            }
        }
    }
}
