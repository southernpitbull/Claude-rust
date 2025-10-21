//! Dynamic log level filtering

use super::{LogError, LogResult};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::Level;

/// Dynamic log filter that can be updated at runtime
pub struct DynamicFilter {
    global_level: Arc<RwLock<Level>>,
    module_levels: Arc<RwLock<HashMap<String, Level>>>,
}

impl DynamicFilter {
    /// Create a new dynamic filter
    pub fn new(global_level: Level) -> Self {
        Self {
            global_level: Arc::new(RwLock::new(global_level)),
            module_levels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set global log level
    pub fn set_global_level(&self, level: Level) {
        *self.global_level.write() = level;
    }

    /// Get global log level
    pub fn global_level(&self) -> Level {
        *self.global_level.read()
    }

    /// Set module-specific log level
    pub fn set_module_level(&self, module: impl Into<String>, level: Level) {
        self.module_levels.write().insert(module.into(), level);
    }

    /// Remove module-specific log level
    pub fn remove_module_level(&self, module: &str) {
        self.module_levels.write().remove(module);
    }

    /// Get module-specific log level
    pub fn module_level(&self, module: &str) -> Option<Level> {
        self.module_levels.read().get(module).copied()
    }

    /// Check if a log level is enabled for a module
    pub fn enabled(&self, module: &str, level: &Level) -> bool {
        let module_level = self.module_level(module);
        let effective_level = module_level.unwrap_or_else(|| self.global_level());

        level <= &effective_level
    }

    /// Clear all module-specific filters
    pub fn clear_module_levels(&self) {
        self.module_levels.write().clear();
    }

    /// Get all module levels
    pub fn all_module_levels(&self) -> HashMap<String, Level> {
        self.module_levels.read().clone()
    }
}

impl Default for DynamicFilter {
    fn default() -> Self {
        Self::new(Level::INFO)
    }
}

/// Parse log level from string
pub fn parse_level(s: &str) -> LogResult<Level> {
    match s.to_lowercase().as_str() {
        "trace" => Ok(Level::TRACE),
        "debug" => Ok(Level::DEBUG),
        "info" => Ok(Level::INFO),
        "warn" | "warning" => Ok(Level::WARN),
        "error" => Ok(Level::ERROR),
        _ => Err(LogError::ConfigError(format!("Invalid log level: {}", s))),
    }
}

/// Convert log level to string
pub fn level_to_string(level: &Level) -> &'static str {
    match *level {
        Level::TRACE => "trace",
        Level::DEBUG => "debug",
        Level::INFO => "info",
        Level::WARN => "warn",
        Level::ERROR => "error",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dynamic_filter_creation() {
        let filter = DynamicFilter::new(Level::INFO);
        assert_eq!(filter.global_level(), Level::INFO);
    }

    #[test]
    fn test_dynamic_filter_set_global_level() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_global_level(Level::DEBUG);
        assert_eq!(filter.global_level(), Level::DEBUG);
    }

    #[test]
    fn test_dynamic_filter_set_module_level() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_module_level("test_module", Level::TRACE);

        assert_eq!(filter.module_level("test_module"), Some(Level::TRACE));
    }

    #[test]
    fn test_dynamic_filter_remove_module_level() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_module_level("test_module", Level::TRACE);
        filter.remove_module_level("test_module");

        assert_eq!(filter.module_level("test_module"), None);
    }

    #[test]
    fn test_dynamic_filter_enabled() {
        let filter = DynamicFilter::new(Level::INFO);

        assert!(filter.enabled("test", &Level::INFO));
        assert!(filter.enabled("test", &Level::WARN));
        assert!(filter.enabled("test", &Level::ERROR));
        assert!(!filter.enabled("test", &Level::DEBUG));
        assert!(!filter.enabled("test", &Level::TRACE));
    }

    #[test]
    fn test_dynamic_filter_enabled_with_module_level() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_module_level("debug_module", Level::DEBUG);

        // Global level
        assert!(!filter.enabled("other_module", &Level::DEBUG));

        // Module-specific level
        assert!(filter.enabled("debug_module", &Level::DEBUG));
        assert!(filter.enabled("debug_module", &Level::INFO));
        assert!(!filter.enabled("debug_module", &Level::TRACE));
    }

    #[test]
    fn test_dynamic_filter_clear_module_levels() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_module_level("module1", Level::TRACE);
        filter.set_module_level("module2", Level::DEBUG);

        assert_eq!(filter.all_module_levels().len(), 2);

        filter.clear_module_levels();
        assert_eq!(filter.all_module_levels().len(), 0);
    }

    #[test]
    fn test_dynamic_filter_all_module_levels() {
        let filter = DynamicFilter::new(Level::INFO);
        filter.set_module_level("module1", Level::TRACE);
        filter.set_module_level("module2", Level::DEBUG);

        let levels = filter.all_module_levels();
        assert_eq!(levels.len(), 2);
        assert_eq!(levels.get("module1"), Some(&Level::TRACE));
        assert_eq!(levels.get("module2"), Some(&Level::DEBUG));
    }

    #[test]
    fn test_parse_level_success() {
        assert_eq!(parse_level("trace").unwrap(), Level::TRACE);
        assert_eq!(parse_level("debug").unwrap(), Level::DEBUG);
        assert_eq!(parse_level("info").unwrap(), Level::INFO);
        assert_eq!(parse_level("warn").unwrap(), Level::WARN);
        assert_eq!(parse_level("warning").unwrap(), Level::WARN);
        assert_eq!(parse_level("error").unwrap(), Level::ERROR);
    }

    #[test]
    fn test_parse_level_case_insensitive() {
        assert_eq!(parse_level("TRACE").unwrap(), Level::TRACE);
        assert_eq!(parse_level("Debug").unwrap(), Level::DEBUG);
        assert_eq!(parse_level("INFO").unwrap(), Level::INFO);
    }

    #[test]
    fn test_parse_level_invalid() {
        assert!(parse_level("invalid").is_err());
        assert!(parse_level("").is_err());
        assert!(parse_level("log").is_err());
    }

    #[test]
    fn test_level_to_string() {
        assert_eq!(level_to_string(&Level::TRACE), "trace");
        assert_eq!(level_to_string(&Level::DEBUG), "debug");
        assert_eq!(level_to_string(&Level::INFO), "info");
        assert_eq!(level_to_string(&Level::WARN), "warn");
        assert_eq!(level_to_string(&Level::ERROR), "error");
    }

    #[test]
    fn test_dynamic_filter_default() {
        let filter = DynamicFilter::default();
        assert_eq!(filter.global_level(), Level::INFO);
    }
}
