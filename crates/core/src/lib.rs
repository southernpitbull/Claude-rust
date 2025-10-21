//! AIrchitect CLI - Core Library
//!
//! This library provides the core functionality for the AIrchitect CLI system.

pub mod cli;
pub mod config;
pub mod error;

use anyhow::Result;
use serde::{Deserialize, Serialize};

/// AIrchitect CLI version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Main AIrchitect CLI application
pub struct AICli {
    config: AppConfig,
}

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Debug mode
    pub debug: bool,

    /// Default AI provider
    pub default_provider: String,

    /// Available providers
    pub providers: Vec<ProviderConfig>,
}

/// Provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    /// Provider name
    pub name: String,

    /// Whether the provider is enabled
    pub enabled: bool,

    /// API key for the provider
    pub api_key: Option<String>,

    /// Default model for the provider
    pub default_model: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            debug: false,
            default_provider: "openai".to_string(),
            providers: vec![
                ProviderConfig {
                    name: "openai".to_string(),
                    enabled: true,
                    api_key: None,
                    default_model: Some("gpt-4".to_string()),
                },
                ProviderConfig {
                    name: "anthropic".to_string(),
                    enabled: true,
                    api_key: None,
                    default_model: Some("claude-3-opus".to_string()),
                },
            ],
        }
    }
}

impl AICli {
    /// Create a new AIrchitect CLI instance
    pub fn new(config: AppConfig) -> Self {
        AICli { config }
    }

    /// Get the application configuration
    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    /// Run the CLI application
    pub async fn run(&self) -> Result<()> {
        // Initialize the application
        self.initialize().await?;

        // Run the main application loop
        self.main_loop().await?;

        Ok(())
    }

    /// Initialize the application
    async fn initialize(&self) -> Result<()> {
        if self.config.debug {
            println!("Initializing AIrchitect CLI v{}", VERSION);
        }

        // TODO: Initialize logging
        // TODO: Load providers
        // TODO: Initialize memory system
        // TODO: Initialize agent framework

        Ok(())
    }

    /// Run the main application loop
    async fn main_loop(&self) -> Result<()> {
        // TODO: Implement main application loop
        // This would handle command parsing, TUI rendering, etc.

        println!("AIrchitect CLI initialized. Use --help for available commands.");

        Ok(())
    }
}

/// Result type for AIrchitect operations
pub type AICliResult<T> = Result<T, error::AICliError>;

#[cfg(test)]
mod tests {
    use super::*;

    // AppConfig tests
    #[test]
    fn test_app_config_default() {
        let config = AppConfig::default();

        assert!(!config.debug);
        assert_eq!(config.default_provider, "openai");
        assert_eq!(config.providers.len(), 2);
    }

    #[test]
    fn test_app_config_default_providers() {
        let config = AppConfig::default();

        let openai = config.providers.iter().find(|p| p.name == "openai");
        assert!(openai.is_some());

        let openai = openai.unwrap();
        assert!(openai.enabled);
        assert_eq!(openai.default_model, Some("gpt-4".to_string()));
        assert!(openai.api_key.is_none());

        let anthropic = config.providers.iter().find(|p| p.name == "anthropic");
        assert!(anthropic.is_some());

        let anthropic = anthropic.unwrap();
        assert!(anthropic.enabled);
        assert_eq!(anthropic.default_model, Some("claude-3-opus".to_string()));
    }

    #[test]
    fn test_app_config_serialization() {
        let config = AppConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AppConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.debug, deserialized.debug);
        assert_eq!(config.default_provider, deserialized.default_provider);
        assert_eq!(config.providers.len(), deserialized.providers.len());
    }

    #[test]
    fn test_provider_config_creation() {
        let provider = ProviderConfig {
            name: "test_provider".to_string(),
            enabled: false,
            api_key: Some("test_key".to_string()),
            default_model: Some("test_model".to_string()),
        };

        assert_eq!(provider.name, "test_provider");
        assert!(!provider.enabled);
        assert_eq!(provider.api_key, Some("test_key".to_string()));
        assert_eq!(provider.default_model, Some("test_model".to_string()));
    }

    #[test]
    fn test_provider_config_without_api_key() {
        let provider = ProviderConfig {
            name: "local_provider".to_string(),
            enabled: true,
            api_key: None,
            default_model: None,
        };

        assert!(provider.api_key.is_none());
        assert!(provider.default_model.is_none());
    }

    // AICli tests
    #[test]
    fn test_ai_cli_new() {
        let config = AppConfig::default();
        let cli = AICli::new(config.clone());

        assert_eq!(cli.config().debug, config.debug);
        assert_eq!(cli.config().default_provider, config.default_provider);
    }

    #[test]
    fn test_ai_cli_with_custom_config() {
        let config = AppConfig {
            debug: true,
            default_provider: "custom_provider".to_string(),
            providers: vec![ProviderConfig {
                name: "custom".to_string(),
                enabled: true,
                api_key: Some("key123".to_string()),
                default_model: Some("model-v1".to_string()),
            }],
        };

        let cli = AICli::new(config.clone());

        assert!(cli.config().debug);
        assert_eq!(cli.config().default_provider, "custom_provider");
        assert_eq!(cli.config().providers.len(), 1);
    }

    #[test]
    fn test_ai_cli_config_retrieval() {
        let config = AppConfig::default();
        let cli = AICli::new(config.clone());

        let retrieved_config = cli.config();

        assert_eq!(retrieved_config.default_provider, config.default_provider);
        assert_eq!(retrieved_config.debug, config.debug);
    }

    #[test]
    fn test_version_constant() {
        assert!(!VERSION.is_empty());
        // Version should follow semantic versioning pattern
        let parts: Vec<&str> = VERSION.split('.').collect();
        assert!(parts.len() >= 2, "Version should have at least major.minor");
    }

    // Integration tests
    #[tokio::test]
    async fn test_ai_cli_run_with_debug() {
        let config = AppConfig {
            debug: true,
            default_provider: "openai".to_string(),
            providers: vec![],
        };

        let cli = AICli::new(config);

        // This should initialize and run the main loop
        let result = cli.run().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_ai_cli_run_without_debug() {
        let config = AppConfig {
            debug: false,
            default_provider: "anthropic".to_string(),
            providers: vec![],
        };

        let cli = AICli::new(config);
        let result = cli.run().await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_config_with_multiple_providers() {
        let mut config = AppConfig::default();

        config.providers.push(ProviderConfig {
            name: "custom1".to_string(),
            enabled: true,
            api_key: Some("key1".to_string()),
            default_model: Some("model1".to_string()),
        });

        config.providers.push(ProviderConfig {
            name: "custom2".to_string(),
            enabled: false,
            api_key: Some("key2".to_string()),
            default_model: Some("model2".to_string()),
        });

        assert_eq!(config.providers.len(), 4); // 2 default + 2 custom

        let enabled_count = config.providers.iter().filter(|p| p.enabled).count();
        assert_eq!(enabled_count, 3); // openai, anthropic, custom1
    }

    #[test]
    fn test_config_find_provider_by_name() {
        let config = AppConfig::default();

        let openai = config.providers.iter().find(|p| p.name == "openai");
        assert!(openai.is_some());

        let nonexistent = config.providers.iter().find(|p| p.name == "nonexistent");
        assert!(nonexistent.is_none());
    }

    #[test]
    fn test_config_update_provider() {
        let mut config = AppConfig::default();

        if let Some(provider) = config.providers.iter_mut().find(|p| p.name == "openai") {
            provider.api_key = Some("new_api_key".to_string());
            provider.enabled = false;
        }

        let openai = config
            .providers
            .iter()
            .find(|p| p.name == "openai")
            .unwrap();
        assert_eq!(openai.api_key, Some("new_api_key".to_string()));
        assert!(!openai.enabled);
    }

    #[test]
    fn test_config_clone() {
        let config1 = AppConfig::default();
        let config2 = config1.clone();

        assert_eq!(config1.debug, config2.debug);
        assert_eq!(config1.default_provider, config2.default_provider);
        assert_eq!(config1.providers.len(), config2.providers.len());
    }
}
