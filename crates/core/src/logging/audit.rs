//! Audit logging with integrity verification

use super::{LogError, LogResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::Mutex;
use sha2::{Sha256, Digest};

/// Audit log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub user: String,
    pub action: String,
    pub resource: Option<String>,
    pub result: AuditResult,
    pub metadata: std::collections::HashMap<String, String>,
    /// Hash of previous entry for chain integrity
    pub previous_hash: String,
    /// Hash of this entry
    pub hash: String,
}

/// Audit result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuditResult {
    Success,
    Failure,
    Warning,
}

impl AuditEntry {
    /// Create a new audit entry
    pub fn new(
        event_type: impl Into<String>,
        user: impl Into<String>,
        action: impl Into<String>,
    ) -> Self {
        let timestamp = Utc::now();
        let event_type = event_type.into();
        let user = user.into();
        let action = action.into();

        let mut entry = Self {
            timestamp,
            event_type,
            user,
            action,
            resource: None,
            result: AuditResult::Success,
            metadata: std::collections::HashMap::new(),
            previous_hash: String::new(),
            hash: String::new(),
        };

        entry.hash = entry.compute_hash();
        entry
    }

    /// Set resource
    pub fn with_resource(mut self, resource: impl Into<String>) -> Self {
        self.resource = Some(resource.into());
        self.hash = self.compute_hash();
        self
    }

    /// Set result
    pub fn with_result(mut self, result: AuditResult) -> Self {
        self.result = result;
        self.hash = self.compute_hash();
        self
    }

    /// Add metadata
    pub fn with_metadata(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.metadata.insert(key.into(), value.into());
        self.hash = self.compute_hash();
        self
    }

    /// Set previous hash
    pub fn with_previous_hash(mut self, hash: impl Into<String>) -> Self {
        self.previous_hash = hash.into();
        self.hash = self.compute_hash();
        self
    }

    /// Compute hash of entry
    fn compute_hash(&self) -> String {
        let mut hasher = Sha256::new();

        hasher.update(self.timestamp.to_rfc3339().as_bytes());
        hasher.update(self.event_type.as_bytes());
        hasher.update(self.user.as_bytes());
        hasher.update(self.action.as_bytes());

        if let Some(ref resource) = self.resource {
            hasher.update(resource.as_bytes());
        }

        let result_str = serde_json::to_string(&self.result).unwrap_or_default();
        hasher.update(result_str.as_bytes());

        // Sort metadata keys for consistent hashing
        let mut keys: Vec<&String> = self.metadata.keys().collect();
        keys.sort();
        for key in keys {
            if let Some(value) = self.metadata.get(key) {
                hasher.update(key.as_bytes());
                hasher.update(value.as_bytes());
            }
        }

        hasher.update(self.previous_hash.as_bytes());

        format!("{:x}", hasher.finalize())
    }

    /// Verify entry integrity
    pub fn verify(&self) -> bool {
        self.hash == self.compute_hash()
    }
}

/// Audit logger with chain verification
pub struct AuditLogger {
    path: PathBuf,
    entries: Arc<Mutex<Vec<AuditEntry>>>,
    last_hash: Arc<Mutex<String>>,
}

impl AuditLogger {
    /// Create a new audit logger
    pub fn new(path: impl AsRef<Path>) -> LogResult<Self> {
        let path = path.as_ref().to_path_buf();

        // Create parent directory if needed
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let entries = if path.exists() {
            let content = std::fs::read_to_string(&path)?;
            let entries: Vec<AuditEntry> = content
                .lines()
                .filter_map(|line| serde_json::from_str(line).ok())
                .collect();
            entries
        } else {
            Vec::new()
        };

        let last_hash = entries.last()
            .map(|e| e.hash.clone())
            .unwrap_or_default();

        Ok(Self {
            path,
            entries: Arc::new(Mutex::new(entries)),
            last_hash: Arc::new(Mutex::new(last_hash)),
        })
    }

    /// Log an audit entry
    pub fn log(&self, mut entry: AuditEntry) -> LogResult<()> {
        // Set previous hash
        let prev_hash = self.last_hash.lock().clone();
        entry = entry.with_previous_hash(prev_hash);

        // Verify entry
        if !entry.verify() {
            return Err(LogError::AuditError("Entry verification failed".to_string()));
        }

        // Append to file
        let json = serde_json::to_string(&entry)
            .map_err(|e| LogError::FormatError(e.to_string()))?;

        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;

        writeln!(file, "{}", json)?;
        file.flush()?;

        // Update state
        *self.last_hash.lock() = entry.hash.clone();
        self.entries.lock().push(entry);

        Ok(())
    }

    /// Verify audit trail integrity
    pub fn verify_chain(&self) -> LogResult<bool> {
        let entries = self.entries.lock();

        if entries.is_empty() {
            return Ok(true);
        }

        // Verify first entry
        if !entries[0].verify() {
            return Ok(false);
        }

        // Verify chain
        for i in 1..entries.len() {
            let prev_hash = &entries[i - 1].hash;
            let curr_entry = &entries[i];

            // Verify entry itself
            if !curr_entry.verify() {
                return Ok(false);
            }

            // Verify chain link
            if curr_entry.previous_hash != *prev_hash {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Get all entries
    pub fn entries(&self) -> Vec<AuditEntry> {
        self.entries.lock().clone()
    }

    /// Get entries by event type
    pub fn entries_by_type(&self, event_type: &str) -> Vec<AuditEntry> {
        self.entries.lock()
            .iter()
            .filter(|e| e.event_type == event_type)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_audit_entry_creation() {
        let entry = AuditEntry::new("test", "user1", "action1");
        assert_eq!(entry.event_type, "test");
        assert_eq!(entry.user, "user1");
        assert_eq!(entry.action, "action1");
        assert!(!entry.hash.is_empty());
    }

    #[test]
    fn test_audit_entry_with_resource() {
        let entry = AuditEntry::new("test", "user1", "action1")
            .with_resource("resource1");
        assert_eq!(entry.resource, Some("resource1".to_string()));
    }

    #[test]
    fn test_audit_entry_with_metadata() {
        let entry = AuditEntry::new("test", "user1", "action1")
            .with_metadata("key1", "value1");
        assert_eq!(entry.metadata.get("key1"), Some(&"value1".to_string()));
    }

    #[test]
    fn test_audit_entry_hash() {
        let entry1 = AuditEntry::new("test", "user1", "action1");
        let entry2 = AuditEntry::new("test", "user1", "action1");

        // Different timestamps should produce different hashes
        assert_ne!(entry1.hash, entry2.hash);
    }

    #[test]
    fn test_audit_entry_verify() {
        let entry = AuditEntry::new("test", "user1", "action1");
        assert!(entry.verify());
    }

    #[test]
    fn test_audit_logger_creation() {
        let temp_dir = TempDir::new().unwrap();
        let audit_path = temp_dir.path().join("audit.log");

        let logger = AuditLogger::new(&audit_path).unwrap();
        assert_eq!(logger.entries().len(), 0);
    }

    #[test]
    fn test_audit_logger_log() {
        let temp_dir = TempDir::new().unwrap();
        let audit_path = temp_dir.path().join("audit.log");

        let logger = AuditLogger::new(&audit_path).unwrap();
        let entry = AuditEntry::new("test", "user1", "action1");

        logger.log(entry).unwrap();
        assert_eq!(logger.entries().len(), 1);
    }

    #[test]
    fn test_audit_logger_chain() {
        let temp_dir = TempDir::new().unwrap();
        let audit_path = temp_dir.path().join("audit.log");

        let logger = AuditLogger::new(&audit_path).unwrap();

        logger.log(AuditEntry::new("test", "user1", "action1")).unwrap();
        logger.log(AuditEntry::new("test", "user2", "action2")).unwrap();
        logger.log(AuditEntry::new("test", "user3", "action3")).unwrap();

        assert_eq!(logger.entries().len(), 3);

        // Verify chain integrity
        let entries = logger.entries();
        assert_eq!(entries[1].previous_hash, entries[0].hash);
        assert_eq!(entries[2].previous_hash, entries[1].hash);
    }

    #[test]
    fn test_audit_logger_verify_chain() {
        let temp_dir = TempDir::new().unwrap();
        let audit_path = temp_dir.path().join("audit.log");

        let logger = AuditLogger::new(&audit_path).unwrap();

        logger.log(AuditEntry::new("test", "user1", "action1")).unwrap();
        logger.log(AuditEntry::new("test", "user2", "action2")).unwrap();

        assert!(logger.verify_chain().unwrap());
    }

    #[test]
    fn test_audit_logger_entries_by_type() {
        let temp_dir = TempDir::new().unwrap();
        let audit_path = temp_dir.path().join("audit.log");

        let logger = AuditLogger::new(&audit_path).unwrap();

        logger.log(AuditEntry::new("login", "user1", "login")).unwrap();
        logger.log(AuditEntry::new("logout", "user1", "logout")).unwrap();
        logger.log(AuditEntry::new("login", "user2", "login")).unwrap();

        let login_entries = logger.entries_by_type("login");
        assert_eq!(login_entries.len(), 2);
    }

    #[test]
    fn test_audit_result_serialization() {
        let result = AuditResult::Success;
        let json = serde_json::to_string(&result).unwrap();
        assert_eq!(json, r#""success""#);
    }
}
