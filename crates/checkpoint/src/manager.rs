//! Checkpoint management system for state persistence and rollback
//!
//! Provides:
//! - Create, restore, and manage checkpoints
//! - Incremental snapshots
//! - Compression and encryption
//! - Metadata tracking

use ai_cli_security::encryption::Aes256GcmEncryption;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// Checkpoint error types
#[derive(Error, Debug)]
pub enum CheckpointError {
    #[error("Checkpoint not found: {0}")]
    NotFound(String),

    #[error("Invalid checkpoint: {0}")]
    Invalid(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Encryption error: {0}")]
    EncryptionError(String),

    #[error("Storage error: {0}")]
    StorageError(String),
}

pub type CheckpointResult<T> = Result<T, CheckpointError>;

/// Checkpoint metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub file_path: PathBuf,
    pub size_bytes: u64,
    pub compressed: bool,
    pub encrypted: bool,
    pub parent_id: Option<String>,
    pub metadata: HashMap<String, String>,
    pub checksum: String,
}

impl Checkpoint {
    pub fn new(id: impl Into<String>, name: impl Into<String>, file_path: PathBuf) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: None,
            created_at: Utc::now(),
            file_path,
            size_bytes: 0,
            compressed: false,
            encrypted: false,
            parent_id: None,
            metadata: HashMap::new(),
            checksum: String::new(),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self
    }

    pub fn with_parent(mut self, parent_id: impl Into<String>) -> Self {
        self.parent_id = Some(parent_id.into());
        self
    }
}

/// Checkpoint configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointConfig {
    pub storage_path: PathBuf,
    pub max_checkpoints: usize,
    pub compression_enabled: bool,
    pub encryption_enabled: bool,
    pub encryption_password: Option<String>,
}

impl Default for CheckpointConfig {
    fn default() -> Self {
        Self {
            storage_path: PathBuf::from(".checkpoints"),
            max_checkpoints: 10,
            compression_enabled: true,
            encryption_enabled: false,
            encryption_password: None,
        }
    }
}

/// Checkpoint manager
pub struct CheckpointManager {
    config: CheckpointConfig,
    checkpoints: Arc<RwLock<HashMap<String, Checkpoint>>>,
}

impl CheckpointManager {
    /// Create a new checkpoint manager
    pub fn new(config: CheckpointConfig) -> CheckpointResult<Self> {
        // Create storage directory if it doesn't exist
        std::fs::create_dir_all(&config.storage_path)?;

        Ok(Self {
            config,
            checkpoints: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Create a new checkpoint
    pub async fn create_checkpoint(
        &self,
        name: impl Into<String>,
        data: &[u8],
    ) -> CheckpointResult<Checkpoint> {
        let id = uuid::Uuid::new_v4().to_string();
        let name = name.into();
        let file_name = format!("{}.ckpt", id);
        let file_path = self.config.storage_path.join(&file_name);

        // Process data (compression, encryption)
        let processed_data = self.process_data(data)?;

        // Write to file
        tokio::fs::write(&file_path, &processed_data).await?;

        // Calculate checksum
        let checksum = self.calculate_checksum(&processed_data);

        // Create checkpoint metadata
        let mut checkpoint = Checkpoint::new(id.clone(), name, file_path);
        checkpoint.size_bytes = processed_data.len() as u64;
        checkpoint.compressed = self.config.compression_enabled;
        checkpoint.encrypted = self.config.encryption_enabled;
        checkpoint.checksum = checksum;

        // Store checkpoint
        self.checkpoints
            .write()
            .await
            .insert(id.clone(), checkpoint.clone());

        // Enforce max checkpoints limit
        self.enforce_checkpoint_limit().await?;

        Ok(checkpoint)
    }

    /// Create a checkpoint with description
    pub async fn create_checkpoint_with_description(
        &self,
        name: impl Into<String>,
        description: impl Into<String>,
        data: &[u8],
    ) -> CheckpointResult<Checkpoint> {
        let mut checkpoint = self.create_checkpoint(name, data).await?;
        checkpoint.description = Some(description.into());

        // Update stored checkpoint
        self.checkpoints
            .write()
            .await
            .insert(checkpoint.id.clone(), checkpoint.clone());

        Ok(checkpoint)
    }

    /// Restore a checkpoint
    pub async fn restore_checkpoint(&self, id: &str) -> CheckpointResult<Vec<u8>> {
        let checkpoints = self.checkpoints.read().await;
        let checkpoint = checkpoints
            .get(id)
            .ok_or_else(|| CheckpointError::NotFound(id.to_string()))?;

        // Read file
        let data = tokio::fs::read(&checkpoint.file_path).await?;

        // Verify checksum
        let checksum = self.calculate_checksum(&data);
        if checksum != checkpoint.checksum {
            return Err(CheckpointError::Invalid("Checksum mismatch".to_string()));
        }

        // Unprocess data (decrypt, decompress)
        self.unprocess_data(&data, checkpoint)
    }

    /// List all checkpoints
    pub async fn list_checkpoints(&self) -> Vec<Checkpoint> {
        let checkpoints = self.checkpoints.read().await;
        let mut list: Vec<_> = checkpoints.values().cloned().collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    /// Get a specific checkpoint
    pub async fn get_checkpoint(&self, id: &str) -> Option<Checkpoint> {
        self.checkpoints.read().await.get(id).cloned()
    }

    /// Delete a checkpoint
    pub async fn delete_checkpoint(&self, id: &str) -> CheckpointResult<bool> {
        let mut checkpoints = self.checkpoints.write().await;

        if let Some(checkpoint) = checkpoints.remove(id) {
            // Delete file
            if checkpoint.file_path.exists() {
                tokio::fs::remove_file(&checkpoint.file_path).await?;
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Clear all checkpoints
    pub async fn clear_all(&self) -> CheckpointResult<()> {
        let mut checkpoints = self.checkpoints.write().await;

        for checkpoint in checkpoints.values() {
            if checkpoint.file_path.exists() {
                tokio::fs::remove_file(&checkpoint.file_path).await?;
            }
        }

        checkpoints.clear();
        Ok(())
    }

    /// Process data (compress and/or encrypt)
    fn process_data(&self, data: &[u8]) -> CheckpointResult<Vec<u8>> {
        let mut processed = data.to_vec();

        // Compression (placeholder - would use flate2 or similar)
        if self.config.compression_enabled {
            // processed = compress(processed)?;
        }

        // Encryption
        if self.config.encryption_enabled {
            if let Some(password) = &self.config.encryption_password {
                processed = Aes256GcmEncryption::encrypt(&processed, password)
                    .map_err(|e| CheckpointError::EncryptionError(e.to_string()))?;
            }
        }

        Ok(processed)
    }

    /// Unprocess data (decrypt and/or decompress)
    fn unprocess_data(&self, data: &[u8], checkpoint: &Checkpoint) -> CheckpointResult<Vec<u8>> {
        let mut unprocessed = data.to_vec();

        // Decryption
        if checkpoint.encrypted {
            if let Some(password) = &self.config.encryption_password {
                unprocessed = Aes256GcmEncryption::decrypt(&unprocessed, password)
                    .map_err(|e| CheckpointError::EncryptionError(e.to_string()))?;
            } else {
                return Err(CheckpointError::EncryptionError(
                    "Password not provided".to_string(),
                ));
            }
        }

        // Decompression (placeholder)
        if checkpoint.compressed {
            // unprocessed = decompress(unprocessed)?;
        }

        Ok(unprocessed)
    }

    /// Calculate checksum
    fn calculate_checksum(&self, data: &[u8]) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    /// Enforce checkpoint limit
    async fn enforce_checkpoint_limit(&self) -> CheckpointResult<()> {
        let mut checkpoints = self.checkpoints.write().await;

        if checkpoints.len() > self.config.max_checkpoints {
            // Sort by creation time
            let mut sorted: Vec<_> = checkpoints.values().cloned().collect();
            sorted.sort_by(|a, b| a.created_at.cmp(&b.created_at));

            // Remove oldest checkpoints
            let to_remove = checkpoints.len() - self.config.max_checkpoints;
            for checkpoint in sorted.iter().take(to_remove) {
                if checkpoint.file_path.exists() {
                    tokio::fs::remove_file(&checkpoint.file_path).await?;
                }
                checkpoints.remove(&checkpoint.id);
            }
        }

        Ok(())
    }

    /// Get storage statistics
    pub async fn get_stats(&self) -> CheckpointStats {
        let checkpoints = self.checkpoints.read().await;
        let total_size: u64 = checkpoints.values().map(|c| c.size_bytes).sum();
        let count = checkpoints.len();

        CheckpointStats {
            total_checkpoints: count,
            total_size_bytes: total_size,
            storage_path: self.config.storage_path.clone(),
        }
    }
}

/// Checkpoint statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointStats {
    pub total_checkpoints: usize,
    pub total_size_bytes: u64,
    pub storage_path: PathBuf,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_config(temp_dir: &TempDir) -> CheckpointConfig {
        CheckpointConfig {
            storage_path: temp_dir.path().to_path_buf(),
            max_checkpoints: 3,
            compression_enabled: false,
            encryption_enabled: false,
            encryption_password: None,
        }
    }

    #[test]
    fn test_checkpoint_creation() {
        let checkpoint = Checkpoint::new("id1", "test", PathBuf::from("/test"));
        assert_eq!(checkpoint.id, "id1");
        assert_eq!(checkpoint.name, "test");
    }

    #[test]
    fn test_checkpoint_with_description() {
        let checkpoint = Checkpoint::new("id1", "test", PathBuf::from("/test"))
            .with_description("Test description");
        assert_eq!(checkpoint.description, Some("Test description".to_string()));
    }

    #[test]
    fn test_checkpoint_config_default() {
        let config = CheckpointConfig::default();
        assert_eq!(config.max_checkpoints, 10);
        assert!(config.compression_enabled);
    }

    #[tokio::test]
    async fn test_manager_creation() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);

        let manager = CheckpointManager::new(config).unwrap();
        assert_eq!(manager.list_checkpoints().await.len(), 0);
    }

    #[tokio::test]
    async fn test_create_checkpoint() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        let data = b"Test data";
        let checkpoint = manager.create_checkpoint("test", data).await.unwrap();

        assert_eq!(checkpoint.name, "test");
        assert!(checkpoint.file_path.exists());
    }

    #[tokio::test]
    async fn test_restore_checkpoint() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        let original_data = b"Test data for restoration";
        let checkpoint = manager
            .create_checkpoint("test", original_data)
            .await
            .unwrap();

        let restored = manager.restore_checkpoint(&checkpoint.id).await.unwrap();
        assert_eq!(restored, original_data);
    }

    #[tokio::test]
    async fn test_list_checkpoints() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        manager.create_checkpoint("test1", b"data1").await.unwrap();
        manager.create_checkpoint("test2", b"data2").await.unwrap();

        let list = manager.list_checkpoints().await;
        assert_eq!(list.len(), 2);
    }

    #[tokio::test]
    async fn test_delete_checkpoint() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        let checkpoint = manager.create_checkpoint("test", b"data").await.unwrap();
        let deleted = manager.delete_checkpoint(&checkpoint.id).await.unwrap();

        assert!(deleted);
        assert!(!checkpoint.file_path.exists());
    }

    #[tokio::test]
    async fn test_checkpoint_limit() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir); // max 3
        let manager = CheckpointManager::new(config).unwrap();

        // Create 5 checkpoints
        for i in 0..5 {
            manager
                .create_checkpoint(format!("test{}", i), b"data")
                .await
                .unwrap();
        }

        // Should only have 3 (oldest removed)
        let list = manager.list_checkpoints().await;
        assert_eq!(list.len(), 3);
    }

    #[tokio::test]
    async fn test_get_stats() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        manager.create_checkpoint("test", b"data").await.unwrap();

        let stats = manager.get_stats().await;
        assert_eq!(stats.total_checkpoints, 1);
        assert!(stats.total_size_bytes > 0);
    }

    #[tokio::test]
    async fn test_clear_all() {
        let temp_dir = TempDir::new().unwrap();
        let config = create_test_config(&temp_dir);
        let manager = CheckpointManager::new(config).unwrap();

        manager.create_checkpoint("test1", b"data1").await.unwrap();
        manager.create_checkpoint("test2", b"data2").await.unwrap();

        manager.clear_all().await.unwrap();

        assert_eq!(manager.list_checkpoints().await.len(), 0);
    }

    #[tokio::test]
    async fn test_checkpoint_with_encryption() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = create_test_config(&temp_dir);
        config.encryption_enabled = true;
        config.encryption_password = Some("test_password".to_string());

        let manager = CheckpointManager::new(config).unwrap();

        let data = b"Sensitive data";
        let checkpoint = manager.create_checkpoint("encrypted", data).await.unwrap();

        assert!(checkpoint.encrypted);

        let restored = manager.restore_checkpoint(&checkpoint.id).await.unwrap();
        assert_eq!(restored, data);
    }
}
