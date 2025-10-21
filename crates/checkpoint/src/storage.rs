use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub path: String,
    pub max_size: String,
    pub retention_days: u32,
}

pub struct StorageBackend {
    config: StorageConfig,
}

impl StorageBackend {
    pub fn new(config: StorageConfig) -> Self {
        StorageBackend { config }
    }

    pub fn save_checkpoint(
        &self,
        id: &str,
        data: &str,
    ) -> Result<(), ai_cli_utils::error::AIError> {
        let path = format!("{}/{}.checkpoint", self.config.path, id);
        std::fs::create_dir_all(&self.config.path)?;
        std::fs::write(path, data)?;
        Ok(())
    }

    pub fn load_checkpoint(&self, id: &str) -> Result<String, ai_cli_utils::error::AIError> {
        let path = format!("{}/{}.checkpoint", self.config.path, id);
        let contents = std::fs::read_to_string(path)?;
        Ok(contents)
    }

    pub fn delete_checkpoint(&self, id: &str) -> Result<(), ai_cli_utils::error::AIError> {
        let path = format!("{}/{}.checkpoint", self.config.path, id);
        std::fs::remove_file(path)?;
        Ok(())
    }

    pub fn list_checkpoints(&self) -> Result<Vec<String>, ai_cli_utils::error::AIError> {
        let path = std::path::Path::new(&self.config.path);
        if !path.exists() {
            return Ok(Vec::new());
        }

        let mut checkpoints = Vec::new();
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();
            if name_str.ends_with(".checkpoint") {
                checkpoints.push(name_str.replace(".checkpoint", ""));
            }
        }

        Ok(checkpoints)
    }
}
