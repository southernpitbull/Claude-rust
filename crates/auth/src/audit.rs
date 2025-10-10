//! Account Audit Logging
//!
//! Provides comprehensive logging of authentication events and account usage

use chrono::{DateTime, Utc};
use claude_code_core::types::ProviderType;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::{BufReader, BufWriter, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Maximum number of audit events to keep in memory
const MAX_MEMORY_EVENTS: usize = 1000;

/// Audit event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuditEventType {
    /// Account login attempt
    LoginAttempt,
    /// Successful login
    LoginSuccess,
    /// Failed login
    LoginFailure,
    /// Account logout
    Logout,
    /// Token refresh
    TokenRefresh,
    /// Token refresh failed
    TokenRefreshFailure,
    /// Account added to pool
    AccountAdded,
    /// Account removed from pool
    AccountRemoved,
    /// Account selected for use
    AccountSelected,
    /// Account state changed
    StateChanged,
    /// Token expired
    TokenExpired,
    /// API request made
    ApiRequest,
    /// Rate limit hit
    RateLimitHit,
    /// Authentication error
    AuthError,
}

/// Audit event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Timestamp of the event
    pub timestamp: DateTime<Utc>,

    /// Event type
    pub event_type: AuditEventType,

    /// Provider type
    pub provider: ProviderType,

    /// Account identifier
    pub account_id: String,

    /// Event message
    pub message: String,

    /// Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,

    /// Error details if applicable
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl AuditEvent {
    /// Create a new audit event
    pub fn new(
        event_type: AuditEventType,
        provider: ProviderType,
        account_id: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            timestamp: Utc::now(),
            event_type,
            provider,
            account_id: account_id.into(),
            message: message.into(),
            metadata: None,
            error: None,
        }
    }

    /// Add metadata to the event
    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    /// Add error information
    pub fn with_error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }
}

/// Audit logger configuration
#[derive(Debug, Clone)]
pub struct AuditConfig {
    /// Enable file logging
    pub enable_file_logging: bool,

    /// Log file path
    pub log_file_path: PathBuf,

    /// Enable memory logging
    pub enable_memory_logging: bool,

    /// Maximum memory events
    pub max_memory_events: usize,

    /// Enable console logging
    pub enable_console_logging: bool,
}

impl Default for AuditConfig {
    fn default() -> Self {
        let mut log_path = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."));
        log_path.push("claude-code");
        log_path.push("audit.log");

        Self {
            enable_file_logging: true,
            log_file_path: log_path,
            enable_memory_logging: true,
            max_memory_events: MAX_MEMORY_EVENTS,
            enable_console_logging: false,
        }
    }
}

/// Audit logger for tracking authentication events
pub struct AuditLogger {
    config: AuditConfig,
    memory_events: Arc<Mutex<VecDeque<AuditEvent>>>,
}

impl AuditLogger {
    /// Create a new audit logger with default config
    pub fn new() -> Self {
        Self::with_config(AuditConfig::default())
    }

    /// Create a new audit logger with custom config
    pub fn with_config(config: AuditConfig) -> Self {
        // Ensure log directory exists
        if config.enable_file_logging {
            if let Some(parent) = config.log_file_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

        Self {
            config,
            memory_events: Arc::new(Mutex::new(VecDeque::with_capacity(
                MAX_MEMORY_EVENTS,
            ))),
        }
    }

    /// Log an audit event
    pub fn log(&self, event: AuditEvent) {
        // Log to memory
        if self.config.enable_memory_logging {
            if let Ok(mut events) = self.memory_events.lock() {
                if events.len() >= self.config.max_memory_events {
                    events.pop_front();
                }
                events.push_back(event.clone());
            }
        }

        // Log to console
        if self.config.enable_console_logging {
            tracing::info!(
                provider = ?event.provider,
                account = %event.account_id,
                event_type = ?event.event_type,
                "{}",
                event.message
            );
        }

        // Log to file
        if self.config.enable_file_logging {
            let _ = self.write_to_file(&event);
        }
    }

    /// Write event to log file
    fn write_to_file(&self, event: &AuditEvent) -> std::io::Result<()> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.config.log_file_path)?;

        let mut writer = BufWriter::new(file);
        let json = serde_json::to_string(event)?;
        writeln!(writer, "{}", json)?;
        writer.flush()?;

        Ok(())
    }

    /// Get recent events from memory
    pub fn get_recent_events(&self, limit: usize) -> Vec<AuditEvent> {
        if let Ok(events) = self.memory_events.lock() {
            events
                .iter()
                .rev()
                .take(limit)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get events for a specific account
    pub fn get_account_events(
        &self,
        provider: ProviderType,
        account_id: &str,
        limit: usize,
    ) -> Vec<AuditEvent> {
        if let Ok(events) = self.memory_events.lock() {
            events
                .iter()
                .rev()
                .filter(|e| e.provider == provider && e.account_id == account_id)
                .take(limit)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get events by type
    pub fn get_events_by_type(
        &self,
        event_type: AuditEventType,
        limit: usize,
    ) -> Vec<AuditEvent> {
        if let Ok(events) = self.memory_events.lock() {
            events
                .iter()
                .rev()
                .filter(|e| e.event_type == event_type)
                .take(limit)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Read all events from log file
    pub fn read_file_events(&self) -> std::io::Result<Vec<AuditEvent>> {
        let file = File::open(&self.config.log_file_path)?;
        let reader = BufReader::new(file);
        let mut events = Vec::new();

        use std::io::BufRead;
        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(event) = serde_json::from_str(&line) {
                    events.push(event);
                }
            }
        }

        Ok(events)
    }

    /// Clear memory events
    pub fn clear_memory(&self) {
        if let Ok(mut events) = self.memory_events.lock() {
            events.clear();
        }
    }

    /// Get event count in memory
    pub fn memory_event_count(&self) -> usize {
        self.memory_events
            .lock()
            .map(|events| events.len())
            .unwrap_or(0)
    }

    /// Helper: Log login attempt
    pub fn log_login_attempt(&self, provider: ProviderType, account_id: &str) {
        let event = AuditEvent::new(
            AuditEventType::LoginAttempt,
            provider,
            account_id,
            format!("Login attempt for account {}", account_id),
        );
        self.log(event);
    }

    /// Helper: Log successful login
    pub fn log_login_success(&self, provider: ProviderType, account_id: &str) {
        let event = AuditEvent::new(
            AuditEventType::LoginSuccess,
            provider,
            account_id,
            format!("Successful login for account {}", account_id),
        );
        self.log(event);
    }

    /// Helper: Log login failure
    pub fn log_login_failure(&self, provider: ProviderType, account_id: &str, error: &str) {
        let event = AuditEvent::new(
            AuditEventType::LoginFailure,
            provider,
            account_id,
            format!("Login failed for account {}", account_id),
        )
        .with_error(error);
        self.log(event);
    }

    /// Helper: Log token refresh
    pub fn log_token_refresh(&self, provider: ProviderType, account_id: &str) {
        let event = AuditEvent::new(
            AuditEventType::TokenRefresh,
            provider,
            account_id,
            format!("Token refreshed for account {}", account_id),
        );
        self.log(event);
    }

    /// Helper: Log API request
    pub fn log_api_request(&self, provider: ProviderType, account_id: &str) {
        let event = AuditEvent::new(
            AuditEventType::ApiRequest,
            provider,
            account_id,
            format!("API request made with account {}", account_id),
        );
        self.log(event);
    }
}

impl Default for AuditLogger {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_logger() -> (AuditLogger, TempDir) {
        let temp_dir = TempDir::new().unwrap();
        let log_path = temp_dir.path().join("test_audit.log");

        let config = AuditConfig {
            enable_file_logging: true,
            log_file_path: log_path,
            enable_memory_logging: true,
            max_memory_events: 100,
            enable_console_logging: false,
        };

        (AuditLogger::with_config(config), temp_dir)
    }

    #[test]
    fn test_audit_logger_creation() {
        let logger = AuditLogger::new();
        assert_eq!(logger.memory_event_count(), 0);
    }

    #[test]
    fn test_log_event() {
        let (logger, _temp) = create_test_logger();

        let event = AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "test@example.com",
            "Test login",
        );

        logger.log(event);
        assert_eq!(logger.memory_event_count(), 1);
    }

    #[test]
    fn test_get_recent_events() {
        let (logger, _temp) = create_test_logger();

        // Log multiple events
        for i in 0..5 {
            let event = AuditEvent::new(
                AuditEventType::ApiRequest,
                ProviderType::Claude,
                format!("user{}@example.com", i),
                format!("Request {}", i),
            );
            logger.log(event);
        }

        let recent = logger.get_recent_events(3);
        assert_eq!(recent.len(), 3);
        assert!(recent[0].message.contains("Request 4")); // Most recent first
    }

    #[test]
    fn test_get_account_events() {
        let (logger, _temp) = create_test_logger();

        // Log events for different accounts
        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "alice@example.com",
            "Alice login",
        ));
        logger.log(AuditEvent::new(
            AuditEventType::ApiRequest,
            ProviderType::Claude,
            "alice@example.com",
            "Alice request",
        ));
        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "bob@example.com",
            "Bob login",
        ));

        let alice_events = logger.get_account_events(
            ProviderType::Claude,
            "alice@example.com",
            10,
        );
        assert_eq!(alice_events.len(), 2);
    }

    #[test]
    fn test_get_events_by_type() {
        let (logger, _temp) = create_test_logger();

        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "user1",
            "Login 1",
        ));
        logger.log(AuditEvent::new(
            AuditEventType::ApiRequest,
            ProviderType::Claude,
            "user1",
            "Request 1",
        ));
        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::OpenAI,
            "user2",
            "Login 2",
        ));

        let logins = logger.get_events_by_type(AuditEventType::LoginSuccess, 10);
        assert_eq!(logins.len(), 2);
    }

    #[test]
    fn test_memory_limit() {
        let temp_dir = TempDir::new().unwrap();
        let config = AuditConfig {
            enable_file_logging: false,
            log_file_path: temp_dir.path().join("test.log"),
            enable_memory_logging: true,
            max_memory_events: 5,
            enable_console_logging: false,
        };

        let logger = AuditLogger::with_config(config);

        // Log more events than the limit
        for i in 0..10 {
            logger.log(AuditEvent::new(
                AuditEventType::ApiRequest,
                ProviderType::Claude,
                "user",
                format!("Request {}", i),
            ));
        }

        // Should only keep the last 5 events
        assert_eq!(logger.memory_event_count(), 5);

        let events = logger.get_recent_events(10);
        assert_eq!(events.len(), 5);
        assert!(events[0].message.contains("Request 9")); // Most recent
    }

    #[test]
    fn test_clear_memory() {
        let (logger, _temp) = create_test_logger();

        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "user",
            "Test",
        ));

        assert_eq!(logger.memory_event_count(), 1);
        logger.clear_memory();
        assert_eq!(logger.memory_event_count(), 0);
    }

    #[test]
    fn test_helper_methods() {
        let (logger, _temp) = create_test_logger();

        logger.log_login_attempt(ProviderType::Claude, "test@example.com");
        logger.log_login_success(ProviderType::Claude, "test@example.com");
        logger.log_token_refresh(ProviderType::Claude, "test@example.com");
        logger.log_api_request(ProviderType::Claude, "test@example.com");

        assert_eq!(logger.memory_event_count(), 4);

        let logins = logger.get_events_by_type(AuditEventType::LoginSuccess, 10);
        assert_eq!(logins.len(), 1);
    }

    #[test]
    fn test_event_with_metadata() {
        let event = AuditEvent::new(
            AuditEventType::ApiRequest,
            ProviderType::Claude,
            "user",
            "Test",
        )
        .with_metadata(serde_json::json!({
            "endpoint": "/api/v1/test",
            "method": "POST"
        }))
        .with_error("Test error");

        assert!(event.metadata.is_some());
        assert!(event.error.is_some());
    }

    #[test]
    fn test_file_logging() {
        let (logger, temp) = create_test_logger();

        logger.log(AuditEvent::new(
            AuditEventType::LoginSuccess,
            ProviderType::Claude,
            "test@example.com",
            "Test login",
        ));

        // Read back from file
        let events = logger.read_file_events().unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].account_id, "test@example.com");
    }
}
