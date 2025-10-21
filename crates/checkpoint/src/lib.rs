//! Version control and rollback system for AIrchitect CLI

pub mod manager;
pub mod storage;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointConfig {
    pub enabled: bool,
    pub auto_checkpoint: bool,
    pub max_checkpoints: u32,
    pub retention_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub name: String,
    pub description: String,
    pub timestamp: u64,
    pub metadata: HashMap<String, String>,
}

pub struct CheckpointSystem {
    pub config: CheckpointConfig,
    checkpoints: Vec<Checkpoint>,
}

impl CheckpointSystem {
    pub fn new(config: CheckpointConfig) -> Self {
        CheckpointSystem {
            config,
            checkpoints: Vec::new(),
        }
    }

    pub fn create_checkpoint(
        &mut self,
        name: String,
        description: String,
        metadata: HashMap<String, String>,
    ) -> Result<String, ai_cli_utils::error::AIError> {
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let checkpoint = Checkpoint {
            id: id.clone(),
            name,
            description,
            timestamp,
            metadata,
        };

        self.checkpoints.push(checkpoint);

        // Enforce max checkpoints
        if self.checkpoints.len() > self.config.max_checkpoints as usize {
            self.checkpoints.remove(0); // Remove oldest checkpoint
        }

        Ok(id)
    }

    pub fn list_checkpoints(&self) -> Vec<&Checkpoint> {
        self.checkpoints.iter().collect()
    }

    pub fn get_checkpoint(&self, id: &str) -> Option<&Checkpoint> {
        self.checkpoints.iter().find(|cp| cp.id == id)
    }

    pub fn delete_checkpoint(&mut self, id: &str) -> Result<(), ai_cli_utils::error::AIError> {
        let len_before = self.checkpoints.len();
        self.checkpoints.retain(|cp| cp.id != id);

        if self.checkpoints.len() == len_before {
            Err(ai_cli_utils::error::AIError::GenericError(format!(
                "Checkpoint {} not found",
                id
            )))
        } else {
            Ok(())
        }
    }
}
