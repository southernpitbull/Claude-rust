//! Checkpoint System
//!
//! Provides functionality to save and restore code and conversation state at specific points in time.
//! Checkpoints can be used to rewind to previous states, enabling easy experimentation and recovery.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// A checkpoint representing a snapshot of files and conversation state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Unique checkpoint identifier
    pub id: String,

    /// Timestamp when checkpoint was created
    pub timestamp: DateTime<Utc>,

    /// Optional description of the checkpoint
    pub description: Option<String>,

    /// Snapshot of file contents at checkpoint time
    /// Maps absolute file path to file content
    pub files: HashMap<PathBuf, String>,

    /// Conversation history at checkpoint time
    /// Stored as JSON values to avoid circular dependencies
    pub conversation: Vec<serde_json::Value>,

    /// Additional metadata
    pub metadata: CheckpointMetadata,
}

/// Metadata associated with a checkpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointMetadata {
    /// Total number of files in checkpoint
    pub file_count: usize,

    /// Total number of messages in conversation
    pub message_count: usize,

    /// Total size of checkpoint data in bytes (before compression)
    pub total_size_bytes: u64,

    /// Whether the checkpoint is compressed
    pub compressed: bool,

    /// Tags for organizing checkpoints
    pub tags: Vec<String>,

    /// Custom metadata fields
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl Checkpoint {
    /// Create a new checkpoint
    pub fn new(
        description: Option<String>,
        files: HashMap<PathBuf, String>,
        conversation: Vec<serde_json::Value>,
    ) -> Self {
        let id = Uuid::new_v4().to_string();
        let timestamp = Utc::now();

        // Calculate total size
        let total_size_bytes = files.values()
            .map(|content| content.len() as u64)
            .sum::<u64>()
            + conversation.iter()
                .map(|msg| serde_json::to_string(msg).unwrap_or_default().len() as u64)
                .sum::<u64>();

        let metadata = CheckpointMetadata {
            file_count: files.len(),
            message_count: conversation.len(),
            total_size_bytes,
            compressed: false,
            tags: Vec::new(),
            extra: HashMap::new(),
        };

        Self {
            id,
            timestamp,
            description,
            files,
            conversation,
            metadata,
        }
    }

    /// Get checkpoint age in seconds
    pub fn age_seconds(&self) -> i64 {
        (Utc::now() - self.timestamp).num_seconds()
    }

    /// Get human-readable age string
    pub fn age_display(&self) -> String {
        let seconds = self.age_seconds();

        if seconds < 60 {
            format!("{} seconds ago", seconds)
        } else if seconds < 3600 {
            format!("{} minutes ago", seconds / 60)
        } else if seconds < 86400 {
            format!("{} hours ago", seconds / 3600)
        } else {
            format!("{} days ago", seconds / 86400)
        }
    }

    /// Get a summary string for display
    pub fn summary(&self) -> String {
        format!(
            "{}: {} files, {} messages ({})",
            &self.id[..8],
            self.metadata.file_count,
            self.metadata.message_count,
            self.age_display()
        )
    }

    /// Add a tag to the checkpoint
    pub fn add_tag(&mut self, tag: String) {
        if !self.metadata.tags.contains(&tag) {
            self.metadata.tags.push(tag);
        }
    }

    /// Check if checkpoint has a specific tag
    pub fn has_tag(&self, tag: &str) -> bool {
        self.metadata.tags.iter().any(|t| t == tag)
    }
}

/// Manages checkpoint storage and retrieval
pub struct CheckpointStore {
    /// Directory where checkpoints are stored
    checkpoints_dir: PathBuf,

    /// Whether to compress checkpoints by default
    compress: bool,

    /// Maximum number of checkpoints to retain (None = unlimited)
    max_checkpoints: Option<usize>,
}

impl CheckpointStore {
    /// Create a new checkpoint store
    ///
    /// # Arguments
    /// * `checkpoints_dir` - Optional custom directory for checkpoints (defaults to ~/.claude/checkpoints)
    /// * `compress` - Whether to compress checkpoints (default: true)
    pub fn new(checkpoints_dir: Option<PathBuf>, compress: bool) -> Result<Self> {
        let dir = checkpoints_dir.unwrap_or_else(|| {
            let home = dirs::home_dir().expect("Could not determine home directory");
            home.join(".claude").join("checkpoints")
        });

        // Create checkpoints directory if it doesn't exist
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .context("Failed to create checkpoints directory")?;
            info!("Created checkpoints directory: {}", dir.display());
        }

        Ok(Self {
            checkpoints_dir: dir,
            compress,
            max_checkpoints: None,
        })
    }

    /// Set maximum number of checkpoints to retain
    pub fn with_max_checkpoints(mut self, max: usize) -> Self {
        self.max_checkpoints = Some(max);
        self
    }

    /// Get the path for a checkpoint file
    fn checkpoint_path(&self, checkpoint_id: &str) -> PathBuf {
        let extension = if self.compress { "json.gz" } else { "json" };
        self.checkpoints_dir.join(format!("{}.{}", checkpoint_id, extension))
    }

    /// Create and save a new checkpoint
    pub fn create_checkpoint(
        &self,
        description: Option<String>,
        files: HashMap<PathBuf, String>,
        conversation: Vec<serde_json::Value>,
    ) -> Result<Checkpoint> {
        let checkpoint = Checkpoint::new(description, files, conversation);
        self.save_checkpoint(&checkpoint)?;

        // Clean up old checkpoints if max limit is set
        if let Some(max) = self.max_checkpoints {
            self.cleanup_excess_checkpoints(max)?;
        }

        Ok(checkpoint)
    }

    /// Save a checkpoint to disk
    pub fn save_checkpoint(&self, checkpoint: &Checkpoint) -> Result<String> {
        let path = self.checkpoint_path(&checkpoint.id);

        // Serialize to JSON
        let json = serde_json::to_string_pretty(checkpoint)
            .context("Failed to serialize checkpoint")?;

        if self.compress {
            // Compress with gzip
            self.write_compressed(&path, json.as_bytes())?;
            debug!("Saved compressed checkpoint {} to {}", checkpoint.id, path.display());
        } else {
            // Write uncompressed
            fs::write(&path, json)
                .context(format!("Failed to write checkpoint file: {}", path.display()))?;
            debug!("Saved checkpoint {} to {}", checkpoint.id, path.display());
        }

        Ok(checkpoint.id.clone())
    }

    /// Load a checkpoint from disk
    pub fn load_checkpoint(&self, id: &str) -> Result<Checkpoint> {
        // Try both compressed and uncompressed formats
        let compressed_path = self.checkpoints_dir.join(format!("{}.json.gz", id));
        let uncompressed_path = self.checkpoints_dir.join(format!("{}.json", id));

        let json = if compressed_path.exists() {
            self.read_compressed(&compressed_path)?
        } else if uncompressed_path.exists() {
            fs::read_to_string(&uncompressed_path)
                .context(format!("Failed to read checkpoint file: {}", uncompressed_path.display()))?
        } else {
            anyhow::bail!("Checkpoint not found: {}", id);
        };

        let checkpoint: Checkpoint = serde_json::from_str(&json)
            .context("Failed to deserialize checkpoint")?;

        debug!("Loaded checkpoint {} from disk", id);
        Ok(checkpoint)
    }

    /// Delete a checkpoint
    pub fn delete_checkpoint(&self, id: &str) -> Result<()> {
        let compressed_path = self.checkpoints_dir.join(format!("{}.json.gz", id));
        let uncompressed_path = self.checkpoints_dir.join(format!("{}.json", id));

        let mut deleted = false;

        if compressed_path.exists() {
            fs::remove_file(&compressed_path)
                .context(format!("Failed to delete checkpoint file: {}", compressed_path.display()))?;
            deleted = true;
        }

        if uncompressed_path.exists() {
            fs::remove_file(&uncompressed_path)
                .context(format!("Failed to delete checkpoint file: {}", uncompressed_path.display()))?;
            deleted = true;
        }

        if deleted {
            info!("Deleted checkpoint: {}", id);
        } else {
            warn!("Checkpoint not found for deletion: {}", id);
        }

        Ok(())
    }

    /// List all checkpoints with their metadata
    pub fn list_checkpoints(&self) -> Result<Vec<CheckpointInfo>> {
        let mut checkpoints = Vec::new();

        if !self.checkpoints_dir.exists() {
            return Ok(checkpoints);
        }

        for entry in fs::read_dir(&self.checkpoints_dir)? {
            let entry = entry?;
            let path = entry.path();

            // Check for both .json and .json.gz files
            let is_checkpoint = path.extension()
                .and_then(|s| s.to_str())
                .map(|ext| ext == "json" || ext == "gz")
                .unwrap_or(false);

            if is_checkpoint {
                match self.load_checkpoint_metadata(&path) {
                    Ok(info) => checkpoints.push(info),
                    Err(e) => {
                        warn!("Failed to load checkpoint metadata from {}: {}", path.display(), e);
                    }
                }
            }
        }

        // Sort by timestamp (most recent first)
        checkpoints.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        Ok(checkpoints)
    }

    /// Load only checkpoint metadata (faster than loading full checkpoint)
    fn load_checkpoint_metadata(&self, path: &Path) -> Result<CheckpointInfo> {
        let json = if path.extension().and_then(|s| s.to_str()) == Some("gz") {
            self.read_compressed(path)?
        } else {
            fs::read_to_string(path)?
        };

        let checkpoint: Checkpoint = serde_json::from_str(&json)?;

        Ok(CheckpointInfo {
            id: checkpoint.id,
            timestamp: checkpoint.timestamp,
            description: checkpoint.description,
            file_count: checkpoint.metadata.file_count,
            message_count: checkpoint.metadata.message_count,
            total_size_bytes: checkpoint.metadata.total_size_bytes,
            compressed: checkpoint.metadata.compressed,
            tags: checkpoint.metadata.tags,
        })
    }

    /// Restore checkpoint by applying its state
    pub fn restore_checkpoint(
        &self,
        id: &str,
        restore_files: bool,
        restore_conversation: bool,
    ) -> Result<RestoredCheckpoint> {
        let checkpoint = self.load_checkpoint(id)?;

        let mut restored_files = Vec::new();
        let mut failed_files = Vec::new();

        // Restore files if requested
        if restore_files {
            for (path, content) in &checkpoint.files {
                match self.restore_file(path, content) {
                    Ok(_) => {
                        restored_files.push(path.clone());
                        debug!("Restored file: {}", path.display());
                    }
                    Err(e) => {
                        error!("Failed to restore file {}: {}", path.display(), e);
                        failed_files.push((path.clone(), e.to_string()));
                    }
                }
            }
        }

        let conversation = if restore_conversation {
            Some(checkpoint.conversation.clone())
        } else {
            None
        };

        Ok(RestoredCheckpoint {
            checkpoint_id: checkpoint.id.clone(),
            timestamp: checkpoint.timestamp,
            description: checkpoint.description.clone(),
            restored_files,
            failed_files,
            conversation,
        })
    }

    /// Restore a single file from checkpoint content
    fn restore_file(&self, path: &Path, content: &str) -> Result<()> {
        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .context(format!("Failed to create parent directory: {}", parent.display()))?;
        }

        // Write file content
        fs::write(path, content)
            .context(format!("Failed to write file: {}", path.display()))?;

        Ok(())
    }

    /// Write compressed data using gzip
    fn write_compressed(&self, path: &Path, data: &[u8]) -> Result<()> {
        use flate2::Compression;
        use flate2::write::GzEncoder;

        let file = fs::File::create(path)
            .context(format!("Failed to create file: {}", path.display()))?;

        let mut encoder = GzEncoder::new(file, Compression::default());
        encoder.write_all(data)
            .context("Failed to write compressed data")?;
        encoder.finish()
            .context("Failed to finalize compression")?;

        Ok(())
    }

    /// Read compressed data using gzip
    fn read_compressed(&self, path: &Path) -> Result<String> {
        use flate2::read::GzDecoder;

        let file = fs::File::open(path)
            .context(format!("Failed to open file: {}", path.display()))?;

        let mut decoder = GzDecoder::new(file);
        let mut contents = String::new();
        decoder.read_to_string(&mut contents)
            .context("Failed to read compressed data")?;

        Ok(contents)
    }

    /// Clean up excess checkpoints, keeping only the most recent ones
    fn cleanup_excess_checkpoints(&self, max_keep: usize) -> Result<()> {
        let checkpoints = self.list_checkpoints()?;

        if checkpoints.len() > max_keep {
            let to_delete = &checkpoints[max_keep..];

            for checkpoint_info in to_delete {
                match self.delete_checkpoint(&checkpoint_info.id) {
                    Ok(_) => {
                        info!("Cleaned up old checkpoint: {}", checkpoint_info.id);
                    }
                    Err(e) => {
                        error!("Failed to delete old checkpoint {}: {}", checkpoint_info.id, e);
                    }
                }
            }
        }

        Ok(())
    }

    /// Clean up checkpoints older than specified days
    pub fn cleanup_old_checkpoints(&self, max_age_days: i64) -> Result<usize> {
        let checkpoints = self.list_checkpoints()?;
        let mut deleted_count = 0;

        let cutoff = Utc::now() - chrono::Duration::days(max_age_days);

        for checkpoint_info in checkpoints {
            if checkpoint_info.timestamp < cutoff {
                match self.delete_checkpoint(&checkpoint_info.id) {
                    Ok(_) => {
                        deleted_count += 1;
                        info!("Cleaned up old checkpoint: {}", checkpoint_info.id);
                    }
                    Err(e) => {
                        error!("Failed to delete old checkpoint {}: {}", checkpoint_info.id, e);
                    }
                }
            }
        }

        Ok(deleted_count)
    }

    /// Get total number of checkpoints
    pub fn count(&self) -> Result<usize> {
        Ok(self.list_checkpoints()?.len())
    }

    /// Export checkpoint to a specific path
    pub fn export_checkpoint(&self, checkpoint_id: &str, export_path: &Path) -> Result<()> {
        let checkpoint = self.load_checkpoint(checkpoint_id)?;
        let json = serde_json::to_string_pretty(&checkpoint)?;

        fs::write(export_path, json)
            .context(format!("Failed to write export file: {}", export_path.display()))?;

        info!("Exported checkpoint {} to {}", checkpoint_id, export_path.display());

        Ok(())
    }

    /// Import checkpoint from a file
    pub fn import_checkpoint(&self, import_path: &Path) -> Result<Checkpoint> {
        let json = fs::read_to_string(import_path)
            .context(format!("Failed to read import file: {}", import_path.display()))?;

        let mut checkpoint: Checkpoint = serde_json::from_str(&json)
            .context("Failed to deserialize checkpoint")?;

        // Generate new ID to avoid conflicts
        checkpoint.id = Uuid::new_v4().to_string();
        checkpoint.timestamp = Utc::now();

        self.save_checkpoint(&checkpoint)?;
        info!("Imported checkpoint as {}", checkpoint.id);

        Ok(checkpoint)
    }

    /// Find checkpoints by tag
    pub fn find_by_tag(&self, tag: &str) -> Result<Vec<CheckpointInfo>> {
        let all_checkpoints = self.list_checkpoints()?;
        Ok(all_checkpoints.into_iter()
            .filter(|c| c.tags.contains(&tag.to_string()))
            .collect())
    }

    /// Get the most recent checkpoint
    pub fn get_most_recent(&self) -> Result<Option<Checkpoint>> {
        let checkpoints = self.list_checkpoints()?;

        if let Some(info) = checkpoints.first() {
            Ok(Some(self.load_checkpoint(&info.id)?))
        } else {
            Ok(None)
        }
    }

    /// Get total storage size of all checkpoints
    pub fn total_storage_size(&self) -> Result<u64> {
        let mut total_size = 0u64;

        if !self.checkpoints_dir.exists() {
            return Ok(0);
        }

        for entry in fs::read_dir(&self.checkpoints_dir)? {
            let entry = entry?;
            if let Ok(metadata) = entry.metadata() {
                total_size += metadata.len();
            }
        }

        Ok(total_size)
    }
}

impl Default for CheckpointStore {
    fn default() -> Self {
        Self::new(None, true).expect("Failed to create default checkpoint store")
    }
}

/// Information about a checkpoint (lighter weight than full Checkpoint)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckpointInfo {
    /// Checkpoint ID
    pub id: String,

    /// Timestamp
    pub timestamp: DateTime<Utc>,

    /// Description
    pub description: Option<String>,

    /// Number of files
    pub file_count: usize,

    /// Number of messages
    pub message_count: usize,

    /// Total size in bytes
    pub total_size_bytes: u64,

    /// Whether compressed
    pub compressed: bool,

    /// Tags
    pub tags: Vec<String>,
}

impl CheckpointInfo {
    /// Get human-readable age string
    pub fn age_display(&self) -> String {
        let seconds = (Utc::now() - self.timestamp).num_seconds();

        if seconds < 60 {
            format!("{} seconds ago", seconds)
        } else if seconds < 3600 {
            format!("{} minutes ago", seconds / 60)
        } else if seconds < 86400 {
            format!("{} hours ago", seconds / 3600)
        } else {
            format!("{} days ago", seconds / 86400)
        }
    }

    /// Get human-readable size string
    pub fn size_display(&self) -> String {
        let size = self.total_size_bytes as f64;

        if size < 1024.0 {
            format!("{} B", size)
        } else if size < 1024.0 * 1024.0 {
            format!("{:.2} KB", size / 1024.0)
        } else if size < 1024.0 * 1024.0 * 1024.0 {
            format!("{:.2} MB", size / (1024.0 * 1024.0))
        } else {
            format!("{:.2} GB", size / (1024.0 * 1024.0 * 1024.0))
        }
    }
}

/// Result of restoring a checkpoint
#[derive(Debug)]
pub struct RestoredCheckpoint {
    /// ID of restored checkpoint
    pub checkpoint_id: String,

    /// Timestamp of checkpoint
    pub timestamp: DateTime<Utc>,

    /// Checkpoint description
    pub description: Option<String>,

    /// List of successfully restored files
    pub restored_files: Vec<PathBuf>,

    /// List of files that failed to restore with error messages
    pub failed_files: Vec<(PathBuf, String)>,

    /// Restored conversation (if requested)
    pub conversation: Option<Vec<serde_json::Value>>,
}

impl RestoredCheckpoint {
    /// Get a summary of the restoration
    pub fn summary(&self) -> String {
        let mut summary = format!(
            "Restored checkpoint {} ({})\n",
            &self.checkpoint_id[..8],
            self.timestamp.format("%Y-%m-%d %H:%M:%S")
        );

        if let Some(desc) = &self.description {
            summary.push_str(&format!("Description: {}\n", desc));
        }

        summary.push_str(&format!("Restored {} files", self.restored_files.len()));

        if !self.failed_files.is_empty() {
            summary.push_str(&format!(", {} failed", self.failed_files.len()));
        }

        if self.conversation.is_some() {
            summary.push_str(", conversation restored");
        }

        summary
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    #[test]
    fn test_checkpoint_creation() {
        let mut files = HashMap::new();
        files.insert(PathBuf::from("/test/file.rs"), "fn main() {}".to_string());

        let conversation = vec![
            json!({"role": "user", "content": "Hello"}),
            json!({"role": "assistant", "content": "Hi"}),
        ];

        let checkpoint = Checkpoint::new(
            Some("Test checkpoint".to_string()),
            files.clone(),
            conversation.clone(),
        );

        assert_eq!(checkpoint.files.len(), 1);
        assert_eq!(checkpoint.conversation.len(), 2);
        assert_eq!(checkpoint.metadata.file_count, 1);
        assert_eq!(checkpoint.metadata.message_count, 2);
        assert!(checkpoint.metadata.total_size_bytes > 0);
    }

    #[test]
    fn test_checkpoint_age() {
        let checkpoint = Checkpoint::new(None, HashMap::new(), Vec::new());
        assert!(checkpoint.age_seconds() < 5);
    }

    #[test]
    fn test_checkpoint_tags() {
        let mut checkpoint = Checkpoint::new(None, HashMap::new(), Vec::new());

        checkpoint.add_tag("test".to_string());
        assert!(checkpoint.has_tag("test"));
        assert!(!checkpoint.has_tag("other"));

        checkpoint.add_tag("test".to_string());
        assert_eq!(checkpoint.metadata.tags.len(), 1); // No duplicates
    }

    #[test]
    fn test_checkpoint_store() {
        let temp_dir = TempDir::new().unwrap();
        let store = CheckpointStore::new(Some(temp_dir.path().to_path_buf()), false).unwrap();

        let mut files = HashMap::new();
        files.insert(PathBuf::from("/test/file.rs"), "fn main() {}".to_string());

        let conversation = vec![json!({"role": "user", "content": "Test"})];

        // Create checkpoint
        let checkpoint = store.create_checkpoint(
            Some("Test".to_string()),
            files,
            conversation,
        ).unwrap();

        let checkpoint_id = checkpoint.id.clone();

        // Load checkpoint
        let loaded = store.load_checkpoint(&checkpoint_id).unwrap();
        assert_eq!(loaded.id, checkpoint_id);
        assert_eq!(loaded.files.len(), 1);

        // List checkpoints
        let list = store.list_checkpoints().unwrap();
        assert_eq!(list.len(), 1);

        // Delete checkpoint
        store.delete_checkpoint(&checkpoint_id).unwrap();
        assert!(store.load_checkpoint(&checkpoint_id).is_err());
    }

    #[test]
    fn test_checkpoint_store_compressed() {
        let temp_dir = TempDir::new().unwrap();
        let store = CheckpointStore::new(Some(temp_dir.path().to_path_buf()), true).unwrap();

        let mut files = HashMap::new();
        files.insert(PathBuf::from("/test/large.txt"), "x".repeat(10000));

        let checkpoint = store.create_checkpoint(
            None,
            files,
            Vec::new(),
        ).unwrap();

        // Should be able to load compressed checkpoint
        let loaded = store.load_checkpoint(&checkpoint.id).unwrap();
        assert_eq!(loaded.files.len(), 1);
    }

    #[test]
    fn test_checkpoint_cleanup() {
        let temp_dir = TempDir::new().unwrap();
        let store = CheckpointStore::new(Some(temp_dir.path().to_path_buf()), false)
            .unwrap()
            .with_max_checkpoints(2);

        // Create 3 checkpoints
        for i in 0..3 {
            store.create_checkpoint(
                Some(format!("Checkpoint {}", i)),
                HashMap::new(),
                Vec::new(),
            ).unwrap();
            // Small delay to ensure different timestamps
            std::thread::sleep(std::time::Duration::from_millis(10));
        }

        // Should only have 2 checkpoints (most recent)
        let list = store.list_checkpoints().unwrap();
        assert_eq!(list.len(), 2);
    }
}
