/// Authentication Provider Configuration
///
/// Defines provider-specific auth configurations and methods

use crate::error::{AuthError, AuthResult};
use crate::types::AuthMethod;
use claude_code_core::types::ProviderType;
use serde::{Deserialize, Serialize};

/// Provider authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuthConfig {
    /// Provider type
    pub provider: ProviderType,

    /// Authentication method (OAuth or API Key)
    pub method: AuthMethod,

    /// OAuth client ID (if using OAuth)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,

    /// OAuth scopes
    #[serde(default)]
    pub scopes: Vec<String>,

    /// OAuth authorization URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_url: Option<String>,

    /// OAuth token URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_url: Option<String>,

    /// Redirect URI for OAuth callback
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redirect_uri: Option<String>,

    /// Whether to use PKCE for OAuth
    #[serde(default)]
    pub use_pkce: bool,

    /// API key environment variable name (if using API key)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_env: Option<String>,
}

impl ProviderAuthConfig {
    /// Get default configuration for a provider
    pub fn default_for_provider(provider: ProviderType) -> Self {
        match provider {
            ProviderType::Claude => Self {
                provider,
                method: AuthMethod::OAuth,
                client_id: None, // User needs to provide this
                scopes: vec!["read".to_string(), "write".to_string()],
                auth_url: Some("https://auth.anthropic.com/oauth/authorize".to_string()),
                token_url: Some("https://auth.anthropic.com/oauth/token".to_string()),
                redirect_uri: Some("http://localhost:8080/callback".to_string()),
                use_pkce: true,
                api_key_env: Some("ANTHROPIC_API_KEY".to_string()),
            },
            ProviderType::OpenAI => Self {
                provider,
                method: AuthMethod::ApiKey,
                client_id: None,
                scopes: vec![],
                auth_url: None,
                token_url: None,
                redirect_uri: None,
                use_pkce: false,
                api_key_env: Some("OPENAI_API_KEY".to_string()),
            },
            ProviderType::Gemini => Self {
                provider,
                method: AuthMethod::ApiKey,
                client_id: None,
                scopes: vec![],
                auth_url: None,
                token_url: None,
                redirect_uri: None,
                use_pkce: false,
                api_key_env: Some("GEMINI_API_KEY".to_string()),
            },
            ProviderType::Qwen => Self {
                provider,
                method: AuthMethod::ApiKey,
                client_id: None,
                scopes: vec![],
                auth_url: None,
                token_url: None,
                redirect_uri: None,
                use_pkce: false,
                api_key_env: Some("QWEN_API_KEY".to_string()),
            },
            ProviderType::Ollama => Self {
                provider,
                method: AuthMethod::ApiKey, // No auth usually needed for local
                client_id: None,
                scopes: vec![],
                auth_url: None,
                token_url: None,
                redirect_uri: None,
                use_pkce: false,
                api_key_env: None,
            },
            ProviderType::LMStudio => Self {
                provider,
                method: AuthMethod::ApiKey, // No auth usually needed for local
                client_id: None,
                scopes: vec![],
                auth_url: None,
                token_url: None,
                redirect_uri: None,
                use_pkce: false,
                api_key_env: None,
            },
        }
    }

    /// Validate the configuration
    pub fn validate(&self) -> AuthResult<()> {
        match self.method {
            AuthMethod::OAuth => {
                // Validate OAuth configuration
                if self.client_id.is_none() {
                    return Err(AuthError::ConfigurationError(
                        "OAuth requires client_id".to_string(),
                    ));
                }
                if self.auth_url.is_none() {
                    return Err(AuthError::ConfigurationError(
                        "OAuth requires auth_url".to_string(),
                    ));
                }
                if self.token_url.is_none() {
                    return Err(AuthError::ConfigurationError(
                        "OAuth requires token_url".to_string(),
                    ));
                }
                if self.redirect_uri.is_none() {
                    return Err(AuthError::ConfigurationError(
                        "OAuth requires redirect_uri".to_string(),
                    ));
                }
            }
            AuthMethod::ApiKey => {
                // API key auth is always valid (key can come from env or manual entry)
            }
            AuthMethod::None => {
                // No authentication required
            }
        }
        Ok(())
    }

    /// Get API key from environment variable
    pub fn get_api_key_from_env(&self) -> Option<String> {
        self.api_key_env
            .as_ref()
            .and_then(|var| std::env::var(var).ok())
    }

    /// Check if provider supports OAuth
    pub fn supports_oauth(&self) -> bool {
        matches!(self.method, AuthMethod::OAuth)
    }

    /// Check if provider supports API key authentication
    pub fn supports_api_key(&self) -> bool {
        matches!(self.method, AuthMethod::ApiKey)
    }
}

/// Registry of provider configurations
pub struct ProviderRegistry {
    configs: std::collections::HashMap<ProviderType, ProviderAuthConfig>,
}

impl ProviderRegistry {
    /// Create a new registry with default configurations
    pub fn new() -> Self {
        let mut configs = std::collections::HashMap::new();

        for provider in [
            ProviderType::Claude,
            ProviderType::OpenAI,
            ProviderType::Gemini,
            ProviderType::Qwen,
            ProviderType::Ollama,
            ProviderType::LMStudio,
        ] {
            configs.insert(provider, ProviderAuthConfig::default_for_provider(provider));
        }

        Self { configs }
    }

    /// Get configuration for a provider
    pub fn get(&self, provider: ProviderType) -> Option<&ProviderAuthConfig> {
        self.configs.get(&provider)
    }

    /// Update configuration for a provider
    pub fn set(&mut self, provider: ProviderType, config: ProviderAuthConfig) {
        self.configs.insert(provider, config);
    }

    /// Get all supported providers
    pub fn providers(&self) -> Vec<ProviderType> {
        self.configs.keys().copied().collect()
    }

    /// Get all providers that support OAuth
    pub fn oauth_providers(&self) -> Vec<ProviderType> {
        self.configs
            .iter()
            .filter(|(_, config)| config.supports_oauth())
            .map(|(provider, _)| *provider)
            .collect()
    }

    /// Get all providers that support API key auth
    pub fn api_key_providers(&self) -> Vec<ProviderType> {
        self.configs
            .iter()
            .filter(|(_, config)| config.supports_api_key())
            .map(|(provider, _)| *provider)
            .collect()
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_configs() {
        let claude_config = ProviderAuthConfig::default_for_provider(ProviderType::Claude);
        assert_eq!(claude_config.method, AuthMethod::OAuth);
        assert!(claude_config.use_pkce);

        let openai_config = ProviderAuthConfig::default_for_provider(ProviderType::OpenAI);
        assert_eq!(openai_config.method, AuthMethod::ApiKey);
    }

    #[test]
    fn test_oauth_validation() {
        let mut config = ProviderAuthConfig::default_for_provider(ProviderType::Claude);
        config.client_id = None;

        let result = config.validate();
        assert!(result.is_err());
    }

    #[test]
    fn test_registry() {
        let registry = ProviderRegistry::new();

        assert!(registry.get(ProviderType::Claude).is_some());
        assert!(registry.get(ProviderType::OpenAI).is_some());

        let oauth_providers = registry.oauth_providers();
        assert!(oauth_providers.contains(&ProviderType::Claude));

        let api_key_providers = registry.api_key_providers();
        assert!(api_key_providers.contains(&ProviderType::OpenAI));
    }

    #[test]
    fn test_provider_capabilities() {
        let claude_config = ProviderAuthConfig::default_for_provider(ProviderType::Claude);
        assert!(claude_config.supports_oauth());

        let openai_config = ProviderAuthConfig::default_for_provider(ProviderType::OpenAI);
        assert!(openai_config.supports_api_key());
    }
}
