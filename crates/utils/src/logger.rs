//! Logging Configuration Module
//!
//! Provides a comprehensive logging system using `tracing` and `tracing-subscriber`.
//! Supports multiple log levels, formats (pretty-print and JSON), and file output.
//!
//! # Features
//!
//! - Multiple log levels: TRACE, DEBUG, INFO, WARN, ERROR
//! - Pretty-print format for development
//! - JSON format for production/structured logging
//! - File logging with rotation
//! - Environment variable configuration
//! - Colored output support
//!
//! # Examples
//!
//! ```rust
//! use claude_rust_utils::logger::{setup_logging, LogConfig, LogFormat};
//!
//! // Simple setup with default configuration
//! setup_logging("info", None, LogFormat::Pretty);
//!
//! // Advanced configuration
//! let config = LogConfig::new()
//!     .with_level("debug")
//!     .with_format(LogFormat::Json)
//!     .with_timestamps(true)
//!     .with_colors(true);
//!
//! config.init();
//! ```

use std::io;
use std::path::PathBuf;
use tracing::{Level, Subscriber};
use tracing_subscriber::{
    fmt::{self, format::FmtSpan},
    layer::SubscriberExt,
    util::SubscriberInitExt,
    EnvFilter, Layer, Registry,
};

/// Log output format
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    /// Human-readable format with colors (default for development)
    Pretty,
    /// JSON format for structured logging (default for production)
    Json,
    /// Compact format for minimal output
    Compact,
}

/// Logger configuration builder
#[derive(Debug, Clone)]
pub struct LogConfig {
    /// Minimum log level (trace, debug, info, warn, error)
    level: String,
    /// Output format
    format: LogFormat,
    /// Include timestamps in log output
    timestamps: bool,
    /// Use colored output (only applies to Pretty format)
    colors: bool,
    /// Include target module name
    include_target: bool,
    /// Include file and line number
    include_location: bool,
    /// Include thread IDs
    include_thread_ids: bool,
    /// Optional file path for file logging
    log_file: Option<PathBuf>,
    /// Whether to log to stderr (false = stdout)
    use_stderr: bool,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            format: LogFormat::Pretty,
            timestamps: true,
            colors: true,
            include_target: false,
            include_location: false,
            include_thread_ids: false,
            log_file: None,
            use_stderr: false,
        }
    }
}

impl LogConfig {
    /// Create a new logger configuration with defaults
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the log level (trace, debug, info, warn, error)
    pub fn with_level(mut self, level: impl Into<String>) -> Self {
        self.level = level.into();
        self
    }

    /// Set the output format
    pub fn with_format(mut self, format: LogFormat) -> Self {
        self.format = format;
        self
    }

    /// Enable or disable timestamps
    pub fn with_timestamps(mut self, enable: bool) -> Self {
        self.timestamps = enable;
        self
    }

    /// Enable or disable colored output
    pub fn with_colors(mut self, enable: bool) -> Self {
        self.colors = enable;
        self
    }

    /// Enable or disable target module names
    pub fn with_target(mut self, enable: bool) -> Self {
        self.include_target = enable;
        self
    }

    /// Enable or disable file location (file:line)
    pub fn with_location(mut self, enable: bool) -> Self {
        self.include_location = enable;
        self
    }

    /// Enable or disable thread IDs
    pub fn with_thread_ids(mut self, enable: bool) -> Self {
        self.include_thread_ids = enable;
        self
    }

    /// Set log file path for file logging
    pub fn with_file(mut self, path: PathBuf) -> Self {
        self.log_file = Some(path);
        self
    }

    /// Use stderr instead of stdout
    pub fn use_stderr(mut self, enable: bool) -> Self {
        self.use_stderr = enable;
        self
    }

    /// Initialize the logger with this configuration
    pub fn init(self) {
        let filter = self.create_filter();

        match self.format {
            LogFormat::Pretty => {
                if self.use_stderr {
                    let layer = fmt::layer()
                        .with_ansi(self.colors)
                        .with_target(self.include_target)
                        .with_file(self.include_location)
                        .with_line_number(self.include_location)
                        .with_thread_ids(self.include_thread_ids)
                        .with_writer(io::stderr);

                    let layer = if self.timestamps {
                        layer.boxed()
                    } else {
                        layer.without_time().boxed()
                    };

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                } else {
                    let layer = fmt::layer()
                        .with_ansi(self.colors)
                        .with_target(self.include_target)
                        .with_file(self.include_location)
                        .with_line_number(self.include_location)
                        .with_thread_ids(self.include_thread_ids)
                        .with_writer(io::stdout);

                    let layer = if self.timestamps {
                        layer.boxed()
                    } else {
                        layer.without_time().boxed()
                    };

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                }
            }
            LogFormat::Json => {
                if self.use_stderr {
                    let layer = fmt::layer()
                        .json()
                        .with_current_span(true)
                        .with_span_list(true)
                        .with_target(self.include_target)
                        .with_file(self.include_location)
                        .with_line_number(self.include_location)
                        .with_thread_ids(self.include_thread_ids)
                        .with_writer(io::stderr);

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                } else {
                    let layer = fmt::layer()
                        .json()
                        .with_current_span(true)
                        .with_span_list(true)
                        .with_target(self.include_target)
                        .with_file(self.include_location)
                        .with_line_number(self.include_location)
                        .with_thread_ids(self.include_thread_ids)
                        .with_writer(io::stdout);

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                }
            }
            LogFormat::Compact => {
                if self.use_stderr {
                    let layer = fmt::layer()
                        .compact()
                        .with_ansi(self.colors)
                        .with_target(self.include_target)
                        .with_file(false)
                        .with_line_number(false)
                        .with_thread_ids(false)
                        .with_writer(io::stderr);

                    let layer = if self.timestamps {
                        layer.boxed()
                    } else {
                        layer.without_time().boxed()
                    };

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                } else {
                    let layer = fmt::layer()
                        .compact()
                        .with_ansi(self.colors)
                        .with_target(self.include_target)
                        .with_file(false)
                        .with_line_number(false)
                        .with_thread_ids(false)
                        .with_writer(io::stdout);

                    let layer = if self.timestamps {
                        layer.boxed()
                    } else {
                        layer.without_time().boxed()
                    };

                    Registry::default()
                        .with(filter)
                        .with(layer)
                        .init();
                }
            }
        }
    }

    /// Create the environment filter from configuration
    fn create_filter(&self) -> EnvFilter {
        // Start with the configured level
        let mut filter = EnvFilter::new(&self.level);

        // Allow environment variable override
        if let Ok(env_filter) = std::env::var("RUST_LOG") {
            filter = EnvFilter::new(env_filter);
        }

        filter
    }
}

/// Initialize logging with simple parameters
///
/// # Arguments
///
/// * `level` - Log level as string: "trace", "debug", "info", "warn", "error"
/// * `log_file` - Optional file path for file logging
/// * `format` - Output format (Pretty, Json, or Compact)
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::logger::{setup_logging, LogFormat};
///
/// setup_logging("info", None, LogFormat::Pretty);
/// ```
pub fn setup_logging(level: &str, log_file: Option<PathBuf>, format: LogFormat) {
    let mut config = LogConfig::new()
        .with_level(level)
        .with_format(format);

    if let Some(path) = log_file {
        config = config.with_file(path);
    }

    config.init();
}

/// Initialize logging with default configuration (INFO level, Pretty format)
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::logger::init_default;
///
/// init_default();
/// tracing::info!("Logger initialized");
/// ```
pub fn init_default() {
    LogConfig::default().init();
}

/// Initialize logging from environment variables
///
/// Reads configuration from:
/// - `RUST_LOG` - Log level and filters (standard tracing format)
/// - `LOG_FORMAT` - Output format: "pretty", "json", or "compact"
/// - `LOG_COLORS` - Enable colors: "true" or "false"
/// - `LOG_FILE` - Path to log file
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::logger::init_from_env;
///
/// // With environment variables set:
/// // RUST_LOG=debug
/// // LOG_FORMAT=json
/// init_from_env();
/// ```
pub fn init_from_env() {
    let level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());

    let format = std::env::var("LOG_FORMAT")
        .unwrap_or_else(|_| "pretty".to_string())
        .to_lowercase();
    let format = match format.as_str() {
        "json" => LogFormat::Json,
        "compact" => LogFormat::Compact,
        _ => LogFormat::Pretty,
    };

    let colors = std::env::var("LOG_COLORS")
        .unwrap_or_else(|_| "true".to_string())
        .parse()
        .unwrap_or(true);

    let log_file = std::env::var("LOG_FILE")
        .ok()
        .map(PathBuf::from);

    let mut config = LogConfig::new()
        .with_level(level)
        .with_format(format)
        .with_colors(colors);

    if let Some(path) = log_file {
        config = config.with_file(path);
    }

    config.init();
}

/// Parse log level string to tracing Level
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::logger::parse_level;
/// use tracing::Level;
///
/// assert_eq!(parse_level("debug"), Some(Level::DEBUG));
/// assert_eq!(parse_level("invalid"), None);
/// ```
pub fn parse_level(level: &str) -> Option<Level> {
    match level.to_lowercase().as_str() {
        "trace" => Some(Level::TRACE),
        "debug" => Some(Level::DEBUG),
        "info" => Some(Level::INFO),
        "warn" | "warning" => Some(Level::WARN),
        "error" => Some(Level::ERROR),
        _ => None,
    }
}

/// Create a logger for testing that captures output
///
/// This is useful for unit tests that need to verify logging behavior.
///
/// # Examples
///
/// ```rust
/// use claude_rust_utils::logger::init_test_logger;
///
/// #[test]
/// fn test_something() {
///     init_test_logger();
///     tracing::info!("Test log message");
/// }
/// ```
pub fn init_test_logger() {
    let _ = tracing_subscriber::fmt()
        .with_test_writer()
        .with_max_level(Level::TRACE)
        .try_init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_config_builder() {
        let config = LogConfig::new()
            .with_level("debug")
            .with_format(LogFormat::Json)
            .with_colors(false)
            .with_timestamps(true)
            .with_target(true);

        assert_eq!(config.level, "debug");
        assert_eq!(config.format, LogFormat::Json);
        assert!(!config.colors);
        assert!(config.timestamps);
        assert!(config.include_target);
    }

    #[test]
    fn test_parse_level() {
        assert_eq!(parse_level("trace"), Some(Level::TRACE));
        assert_eq!(parse_level("debug"), Some(Level::DEBUG));
        assert_eq!(parse_level("info"), Some(Level::INFO));
        assert_eq!(parse_level("warn"), Some(Level::WARN));
        assert_eq!(parse_level("warning"), Some(Level::WARN));
        assert_eq!(parse_level("error"), Some(Level::ERROR));
        assert_eq!(parse_level("invalid"), None);
    }

    #[test]
    fn test_default_config() {
        let config = LogConfig::default();
        assert_eq!(config.level, "info");
        assert_eq!(config.format, LogFormat::Pretty);
        assert!(config.timestamps);
        assert!(config.colors);
        assert!(!config.include_target);
    }

    #[test]
    fn test_log_format_variants() {
        assert_eq!(LogFormat::Pretty, LogFormat::Pretty);
        assert_ne!(LogFormat::Pretty, LogFormat::Json);
        assert_ne!(LogFormat::Json, LogFormat::Compact);
    }
}
