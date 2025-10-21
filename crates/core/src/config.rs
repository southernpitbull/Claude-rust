use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoreConfig {
    pub app_name: String,
    pub version: String,
    pub default_mode: String,
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

impl Default for CoreConfig {
    fn default() -> Self {
        CoreConfig {
            app_name: "AIrchitect CLI".to_string(),
            version: "1.0.0".to_string(),
            default_mode: "planning".to_string(),
            ai_providers: HashMap::new(),
            default_provider: "openai".to_string(),
            cache_dir: ".cache".to_string(),
            log_level: "info".to_string(),
        }
    }
}

impl CoreConfig {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn load_from_file(path: &str) -> Result<Self, ai_cli_utils::error::AIError> {
        let contents = std::fs::read_to_string(path)?;
        let config: CoreConfig = serde_json::from_str(&contents)?;
        Ok(config)
    }

    pub fn save_to_file(&self, path: &str) -> Result<(), ai_cli_utils::error::AIError> {
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(path, contents)?;
        Ok(())
    }
}
