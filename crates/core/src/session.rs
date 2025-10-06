//! Session Management
//!
//! Handles conversation session persistence, allowing users to continue
//! and resume conversations across CLI invocations.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Session metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// Unique session identifier
    pub id: String,

    /// Session creation timestamp
    pub created_at: DateTime<Utc>,

    /// Last updated timestamp
    pub updated_at: DateTime<Utc>,

    /// AI model used in this session
    pub model: String,

    /// AI provider used
    pub provider: String,

    /// Session title/description
    pub title: Option<String>,

    /// Total message count
    pub message_count: usize,

    /// Total tokens used (if available)
    pub total_tokens: Option<u32>,
}

/// Conversation session
/// Note: Uses serde_json::Value for messages to avoid circular dependencies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    /// Session metadata
    pub metadata: SessionMetadata,

    /// Conversation history (stored as JSON values)
    pub messages: Vec<serde_json::Value>,

    /// Session-specific configuration
    pub config: SessionConfig,
}

/// Session-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    /// Maximum messages to retain in history
    pub max_history: Option<usize>,

    /// Auto-save enabled
    pub auto_save: bool,

    /// Custom tags for session organization
    pub tags: Vec<String>,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            max_history: Some(100),
            auto_save: true,
            tags: Vec::new(),
        }
    }
}

impl Session {
    /// Create a new session
    pub fn new(model: String, provider: String) -> Self {
        let now = Utc::now();
        let id = Uuid::new_v4().to_string();

        Self {
            metadata: SessionMetadata {
                id,
                created_at: now,
                updated_at: now,
                model,
                provider,
                title: None,
                message_count: 0,
                total_tokens: None,
            },
            messages: Vec::new(),
            config: SessionConfig::default(),
        }
    }

    /// Convert a message from external types to JSON value for storage
    ///
    /// This helper converts messages with the structure:
    /// - role: String (one of "user", "assistant", "system")
    /// - content: String
    /// - name: Option<String>
    /// - extra: HashMap<String, serde_json::Value>
    pub fn message_to_value<T: Serialize>(message: &T) -> Result<serde_json::Value> {
        serde_json::to_value(message)
            .context("Failed to convert message to JSON value")
    }

    /// Convert a JSON value back to a typed message
    ///
    /// This helper deserializes stored message JSON back to the original message type.
    /// It expects the JSON to have the structure:
    /// - role: String (one of "user", "assistant", "system")
    /// - content: String
    /// - name: Option<String>
    /// - extra: HashMap<String, serde_json::Value> (flattened fields)
    pub fn value_to_message<T: for<'de> Deserialize<'de>>(value: &serde_json::Value) -> Result<T> {
        serde_json::from_value(value.clone())
            .context("Failed to convert JSON value to message")
    }

    /// Add a message to the session
    pub fn add_message(&mut self, message: serde_json::Value) {
        self.messages.push(message);
        self.metadata.message_count = self.messages.len();
        self.metadata.updated_at = Utc::now();

        // Enforce max history limit
        if let Some(max) = self.config.max_history {
            if self.messages.len() > max {
                // Keep system messages and trim from oldest user/assistant messages
                let system_messages: Vec<serde_json::Value> = self.messages
                    .iter()
                    .filter(|m| {
                        m.get("role")
                            .and_then(|r| r.as_str())
                            .map(|r| r == "system")
                            .unwrap_or(false)
                    })
                    .cloned()
                    .collect();

                let mut other_messages: Vec<serde_json::Value> = self.messages
                    .iter()
                    .filter(|m| {
                        m.get("role")
                            .and_then(|r| r.as_str())
                            .map(|r| r != "system")
                            .unwrap_or(true)
                    })
                    .cloned()
                    .collect();

                // Take only the most recent messages
                let start_idx = if other_messages.len() > (max - system_messages.len()) {
                    other_messages.len() - (max - system_messages.len())
                } else {
                    0
                };
                other_messages = other_messages[start_idx..].to_vec();

                self.messages = system_messages;
                self.messages.extend(other_messages);
            }
        }
    }

    /// Clear conversation history (preserves system messages)
    pub fn clear_history(&mut self, preserve_system: bool) {
        if preserve_system {
            self.messages.retain(|m| {
                m.get("role")
                    .and_then(|r| r.as_str())
                    .map(|r| r == "system")
                    .unwrap_or(false)
            });
        } else {
            self.messages.clear();
        }
        self.metadata.message_count = self.messages.len();
        self.metadata.updated_at = Utc::now();
    }

    /// Update total token usage
    pub fn update_tokens(&mut self, tokens: u32) {
        self.metadata.total_tokens = Some(
            self.metadata.total_tokens.unwrap_or(0) + tokens
        );
        self.metadata.updated_at = Utc::now();
    }

    /// Get session age in seconds
    pub fn age_seconds(&self) -> i64 {
        (Utc::now() - self.metadata.created_at).num_seconds()
    }

    /// Get time since last update in seconds
    pub fn idle_seconds(&self) -> i64 {
        (Utc::now() - self.metadata.updated_at).num_seconds()
    }
}

/// Session storage manager
pub struct SessionStore {
    sessions_dir: PathBuf,
}

impl SessionStore {
    /// Create a new session store
    pub fn new(sessions_dir: Option<PathBuf>) -> Result<Self> {
        let dir = sessions_dir.unwrap_or_else(|| {
            let home = dirs::home_dir().expect("Could not determine home directory");
            home.join(".claude").join("sessions")
        });

        // Create sessions directory if it doesn't exist
        if !dir.exists() {
            fs::create_dir_all(&dir)
                .context("Failed to create sessions directory")?;
            info!("Created sessions directory: {}", dir.display());
        }

        Ok(Self {
            sessions_dir: dir,
        })
    }

    /// Get the path for a session file
    fn session_path(&self, session_id: &str) -> PathBuf {
        self.sessions_dir.join(format!("{}.json", session_id))
    }

    /// Save a session to disk
    pub fn save(&self, session: &Session) -> Result<()> {
        let path = self.session_path(&session.metadata.id);
        let json = serde_json::to_string_pretty(session)
            .context("Failed to serialize session")?;

        fs::write(&path, json)
            .context(format!("Failed to write session file: {}", path.display()))?;

        debug!("Saved session {} to {}", session.metadata.id, path.display());
        Ok(())
    }

    /// Load a session from disk
    pub fn load(&self, session_id: &str) -> Result<Session> {
        let path = self.session_path(session_id);

        if !path.exists() {
            anyhow::bail!("Session not found: {}", session_id);
        }

        let json = fs::read_to_string(&path)
            .context(format!("Failed to read session file: {}", path.display()))?;

        let session: Session = serde_json::from_str(&json)
            .context("Failed to deserialize session")?;

        debug!("Loaded session {} from {}", session_id, path.display());
        Ok(session)
    }

    /// Delete a session
    pub fn delete(&self, session_id: &str) -> Result<()> {
        let path = self.session_path(session_id);

        if path.exists() {
            fs::remove_file(&path)
                .context(format!("Failed to delete session file: {}", path.display()))?;
            info!("Deleted session: {}", session_id);
        } else {
            warn!("Session not found for deletion: {}", session_id);
        }

        Ok(())
    }

    /// List all sessions
    pub fn list_sessions(&self) -> Result<Vec<SessionMetadata>> {
        let mut sessions = Vec::new();

        if !self.sessions_dir.exists() {
            return Ok(sessions);
        }

        for entry in fs::read_dir(&self.sessions_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                match self.load_metadata(&path) {
                    Ok(metadata) => sessions.push(metadata),
                    Err(e) => {
                        warn!("Failed to load session metadata from {}: {}", path.display(), e);
                    }
                }
            }
        }

        // Sort by updated_at (most recent first)
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(sessions)
    }

    /// Load only session metadata (faster than loading full session)
    fn load_metadata(&self, path: &Path) -> Result<SessionMetadata> {
        let json = fs::read_to_string(path)?;
        let session: Session = serde_json::from_str(&json)?;
        Ok(session.metadata)
    }

    /// Get the most recent session
    pub fn get_most_recent(&self) -> Result<Option<Session>> {
        let sessions = self.list_sessions()?;

        if let Some(metadata) = sessions.first() {
            Ok(Some(self.load(&metadata.id)?))
        } else {
            Ok(None)
        }
    }

    /// Clean up old sessions
    pub fn cleanup_old_sessions(&self, max_age_days: i64) -> Result<usize> {
        let sessions = self.list_sessions()?;
        let mut deleted_count = 0;

        let cutoff = Utc::now() - chrono::Duration::days(max_age_days);

        for metadata in sessions {
            if metadata.updated_at < cutoff {
                match self.delete(&metadata.id) {
                    Ok(_) => {
                        deleted_count += 1;
                        info!("Cleaned up old session: {}", metadata.id);
                    }
                    Err(e) => {
                        error!("Failed to delete old session {}: {}", metadata.id, e);
                    }
                }
            }
        }

        Ok(deleted_count)
    }

    /// Get total number of sessions
    pub fn count(&self) -> Result<usize> {
        Ok(self.list_sessions()?.len())
    }

    /// Export session to a specific path
    pub fn export(&self, session_id: &str, export_path: &Path) -> Result<()> {
        let session = self.load(session_id)?;
        let json = serde_json::to_string_pretty(&session)?;

        fs::write(export_path, json)?;
        info!("Exported session {} to {}", session_id, export_path.display());

        Ok(())
    }

    /// Import session from a file
    pub fn import(&self, import_path: &Path) -> Result<Session> {
        let json = fs::read_to_string(import_path)?;
        let mut session: Session = serde_json::from_str(&json)?;

        // Generate new ID to avoid conflicts
        session.metadata.id = Uuid::new_v4().to_string();
        session.metadata.updated_at = Utc::now();

        self.save(&session)?;
        info!("Imported session as {}", session.metadata.id);

        Ok(session)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::TempDir;

    #[test]
    fn test_session_creation() {
        let session = Session::new("test-model".to_string(), "test-provider".to_string());

        assert_eq!(session.metadata.model, "test-model");
        assert_eq!(session.metadata.provider, "test-provider");
        assert_eq!(session.messages.len(), 0);
        assert_eq!(session.metadata.message_count, 0);
    }

    #[test]
    fn test_add_message() {
        let mut session = Session::new("model".to_string(), "provider".to_string());

        let message = json!({
            "role": "user",
            "content": "Hello"
        });

        session.add_message(message);

        assert_eq!(session.messages.len(), 1);
        assert_eq!(session.metadata.message_count, 1);
    }

    #[test]
    fn test_clear_history() {
        let mut session = Session::new("model".to_string(), "provider".to_string());

        session.add_message(json!({
            "role": "system",
            "content": "System"
        }));

        session.add_message(json!({
            "role": "user",
            "content": "User"
        }));

        session.clear_history(true);

        assert_eq!(session.messages.len(), 1);
        assert_eq!(
            session.messages[0].get("role").and_then(|r| r.as_str()),
            Some("system")
        );
    }

    #[test]
    fn test_session_store() {
        let temp_dir = TempDir::new().unwrap();
        let store = SessionStore::new(Some(temp_dir.path().to_path_buf())).unwrap();

        let session = Session::new("model".to_string(), "provider".to_string());
        let session_id = session.metadata.id.clone();

        // Save
        store.save(&session).unwrap();

        // Load
        let loaded = store.load(&session_id).unwrap();
        assert_eq!(loaded.metadata.id, session_id);

        // Delete
        store.delete(&session_id).unwrap();
        assert!(store.load(&session_id).is_err());
    }
}
