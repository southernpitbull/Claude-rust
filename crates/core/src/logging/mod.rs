//! Structured logging system with tracing
//!
//! Provides comprehensive logging capabilities:
//! - Structured logging with JSON and human-readable formats
//! - Multiple appenders (console, file, rotating)
//! - Runtime log level filtering
//! - Audit trail with integrity verification
//! - Performance tracing integration

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use thiserror::Error;
use tracing::{Level, Subscriber};
use tracing_subscriber::{
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter,
    Layer,
};

pub mod appender;
pub mod audit;
pub mod filter;

pub use appender::{FileAppender, RotatingFileAppender};
pub use audit::AuditLogger;
pub use filter::DynamicFilter;

/// Logging error types
#[derive(Error, Debug)]
pub enum LogError {
    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Format error: {0}")]
    FormatError(String),

    #[error("Audit error: {0}")]
    AuditError(String),
}

pub type LogResult<T> = Result<T, LogError>;

/// Log configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogConfig {
    /// Log level (trace, debug, info, warn, error)
    pub level: String,

    /// Output format (json, pretty, compact)
    pub format: LogFormat,

    /// Enable console logging
    pub console: bool,

    /// Enable file logging
    pub file: Option<FileConfig>,

    /// Enable audit logging
    pub audit: bool,

    /// Per-module log levels
    pub module_levels: std::collections::HashMap<String, String>,
}

/// Log output format
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogFormat {
    Json,
    Pretty,
    Compact,
}

/// File logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileConfig {
    /// Log file path
    pub path: PathBuf,

    /// Enable rotation
    pub rotate: bool,

    /// Max file size in bytes (for rotation)
    pub max_size: Option<u64>,

    /// Max number of rotated files
    pub max_files: Option<usize>,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            format: LogFormat::Pretty,
            console: true,
            file: None,
            audit: false,
            module_levels: std::collections::HashMap::new(),
        }
    }
}

/// Logger builder
pub struct LoggerBuilder {
    config: LogConfig,
}

impl LoggerBuilder {
    /// Create a new logger builder
    pub fn new() -> Self {
        Self {
            config: LogConfig::default(),
        }
    }

    /// Set log level
    pub fn level(mut self, level: impl Into<String>) -> Self {
        self.config.level = level.into();
        self
    }

    /// Set output format
    pub fn format(mut self, format: LogFormat) -> Self {
        self.config.format = format;
        self
    }

    /// Enable console logging
    pub fn console(mut self, enable: bool) -> Self {
        self.config.console = enable;
        self
    }

    /// Enable file logging
    pub fn file(mut self, config: FileConfig) -> Self {
        self.config.file = Some(config);
        self
    }

    /// Enable audit logging
    pub fn audit(mut self, enable: bool) -> Self {
        self.config.audit = enable;
        self
    }

    /// Add module-specific log level
    pub fn module_level(mut self, module: impl Into<String>, level: impl Into<String>) -> Self {
        self.config.module_levels.insert(module.into(), level.into());
        self
    }

    /// Build and initialize logger
    pub fn init(self) -> LogResult<Logger> {
        let filter = self.build_filter()?;

        let subscriber = tracing_subscriber::registry().with(filter);

        // Add console layer if enabled
        let subscriber = if self.config.console {
            let console_layer = match self.config.format {
                LogFormat::Json => fmt::layer()
                    .json()
                    .with_current_span(true)
                    .with_span_list(true)
                    .boxed(),
                LogFormat::Pretty => fmt::layer()
                    .pretty()
                    .with_line_number(true)
                    .with_thread_ids(true)
                    .boxed(),
                LogFormat::Compact => fmt::layer()
                    .compact()
                    .boxed(),
            };
            subscriber.with(console_layer)
        } else {
            subscriber.with(None::<fmt::Layer<_>>)
        };

        subscriber.init();

        Ok(Logger {
            config: Arc::new(self.config),
        })
    }

    fn build_filter(&self) -> LogResult<EnvFilter> {
        let mut filter = EnvFilter::try_from_default_env()
            .unwrap_or_else(|_| EnvFilter::new(&self.config.level));

        // Add module-specific filters
        for (module, level) in &self.config.module_levels {
            let directive = format!("{}={}", module, level);
            filter = filter.add_directive(
                directive.parse()
                    .map_err(|e| LogError::ConfigError(format!("Invalid filter directive: {}", e)))?
            );
        }

        Ok(filter)
    }
}

impl Default for LoggerBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Logger instance
pub struct Logger {
    config: Arc<LogConfig>,
}

impl Logger {
    /// Create a new logger with default configuration
    pub fn new() -> LogResult<Self> {
        LoggerBuilder::new().init()
    }

    /// Get logger configuration
    pub fn config(&self) -> &LogConfig {
        &self.config
    }
}

impl Default for Logger {
    fn default() -> Self {
        Self::new().expect("Failed to initialize default logger")
    }
}

/// Log event for structured logging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEvent {
    pub timestamp: DateTime<Utc>,
    pub level: String,
    pub target: String,
    pub message: String,
    pub fields: std::collections::HashMap<String, serde_json::Value>,
}

impl LogEvent {
    pub fn new(level: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            timestamp: Utc::now(),
            level: level.into(),
            target: String::new(),
            message: message.into(),
            fields: std::collections::HashMap::new(),
        }
    }

    pub fn with_target(mut self, target: impl Into<String>) -> Self {
        self.target = target.into();
        self
    }

    pub fn with_field(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.fields.insert(key.into(), value);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_config_default() {
        let config = LogConfig::default();
        assert_eq!(config.level, "info");
        assert!(config.console);
        assert!(!config.audit);
    }

    #[test]
    fn test_logger_builder() {
        let builder = LoggerBuilder::new()
            .level("debug")
            .format(LogFormat::Json)
            .console(true);

        assert_eq!(builder.config.level, "debug");
        assert!(matches!(builder.config.format, LogFormat::Json));
    }

    #[test]
    fn test_logger_builder_module_level() {
        let builder = LoggerBuilder::new()
            .module_level("ai_cli_core", "trace")
            .module_level("ai_cli_engine", "debug");

        assert_eq!(builder.config.module_levels.len(), 2);
        assert_eq!(builder.config.module_levels.get("ai_cli_core"), Some(&"trace".to_string()));
    }

    #[test]
    fn test_log_event_creation() {
        let event = LogEvent::new("info", "Test message");
        assert_eq!(event.level, "info");
        assert_eq!(event.message, "Test message");
    }

    #[test]
    fn test_log_event_with_target() {
        let event = LogEvent::new("info", "Test")
            .with_target("test_module");
        assert_eq!(event.target, "test_module");
    }

    #[test]
    fn test_log_event_with_fields() {
        let event = LogEvent::new("info", "Test")
            .with_field("key", serde_json::json!("value"));

        assert_eq!(event.fields.len(), 1);
        assert_eq!(event.fields.get("key"), Some(&serde_json::json!("value")));
    }

    #[test]
    fn test_log_format_serialization() {
        let format = LogFormat::Json;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, r#""json""#);
    }

    #[test]
    fn test_file_config_serialization() {
        let config = FileConfig {
            path: PathBuf::from("/var/log/app.log"),
            rotate: true,
            max_size: Some(1024 * 1024),
            max_files: Some(5),
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("app.log"));
    }

    #[test]
    fn test_log_config_serialization() {
        let config = LogConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("info"));
    }
}
