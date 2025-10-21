use crate::providers::AIProvider;

pub struct ProviderOrchestrator {
    providers: Vec<AIProvider>,
}

impl ProviderOrchestrator {
    pub fn new(providers: Vec<AIProvider>) -> Self {
        ProviderOrchestrator { providers }
    }

    pub async fn route_request(
        &self,
        prompt: &str,
        provider_name: &str,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        for provider in &self.providers {
            // Placeholder logic to route based on provider name
            match provider {
                AIProvider::OpenAI(_config) if provider_name == "openai" => {
                    return provider.send_request(prompt).await;
                }
                AIProvider::Anthropic(_config) if provider_name == "anthropic" => {
                    return provider.send_request(prompt).await;
                }
                AIProvider::Google(_config) if provider_name == "google" => {
                    return provider.send_request(prompt).await;
                }
                AIProvider::Qwen(_config) if provider_name == "qwen" => {
                    return provider.send_request(prompt).await;
                }
                _ => continue,
            }
        }

        Err(ai_cli_utils::error::AIError::GenericError(format!(
            "Provider {} not found",
            provider_name
        )))
    }

    pub async fn fallback_request(
        &self,
        prompt: &str,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        // Try the first available provider as fallback
        if let Some(provider) = self.providers.first() {
            provider.send_request(prompt).await
        } else {
            Err(ai_cli_utils::error::AIError::GenericError(
                "No providers available".to_string(),
            ))
        }
    }
}
