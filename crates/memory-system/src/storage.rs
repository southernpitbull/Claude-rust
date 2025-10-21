use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub path: String,
    pub max_size: String,
    pub retention_days: u32,
}

pub struct StorageBackend {
    #[allow(dead_code)]
    config: StorageConfig,
}

impl StorageBackend {
    pub fn new(config: StorageConfig) -> Self {
        StorageBackend { config }
    }

    pub fn save(&self, data: &str, path: &str) -> Result<(), ai_cli_utils::error::AIError> {
        std::fs::write(path, data)?;
        Ok(())
    }

    pub fn load(&self, path: &str) -> Result<String, ai_cli_utils::error::AIError> {
        let contents = std::fs::read_to_string(path)?;
        Ok(contents)
    }

    pub fn delete(&self, path: &str) -> Result<(), ai_cli_utils::error::AIError> {
        std::fs::remove_file(path)?;
        Ok(())
    }

    pub fn exists(&self, path: &str) -> bool {
        std::path::Path::new(path).exists()
    }
}
