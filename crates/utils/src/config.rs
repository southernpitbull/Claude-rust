use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub ai_providers: HashMap<String, ProviderConfig>,
    pub default_provider: String,
    pub cache_dir: String,
    pub log_level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: Option<String>,
    pub base_url: String,
    pub default_model: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            ai_providers: HashMap::new(),
            default_provider: "openai".to_string(),
            cache_dir: ".cache".to_string(),
            log_level: "info".to_string(),
        }
    }
}

impl Config {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn load_from_file(path: &str) -> Result<Self, crate::error::AIError> {
        let contents = std::fs::read_to_string(path)?;
        let config: Config = serde_json::from_str(&contents)?;
        Ok(config)
    }

    pub fn save_to_file(&self, path: &str) -> Result<(), crate::error::AIError> {
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(path, contents)?;
        Ok(())
    }
}
