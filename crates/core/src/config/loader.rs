// Configuration Loader
//
// Loads configuration from multiple sources with proper priority:
// 1. Command-line arguments (highest priority)
// 2. Environment variables (CLAUDE_*)
// 3. Config file (~/.config/claude-code/config.toml)
// 4. Default values (lowest priority)

use super::{
    ApiConfig, Config, LogLevel, OfflineConfig, TelemetryConfig, TerminalConfig, Theme,
    default_exclude_patterns, default_include_patterns, default_index_depth,
    default_max_file_size, default_remote, default_retries, default_retry_delay,
    default_tab_width, default_timeout,
};
use crate::error::{AppError, AppResult};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, warn};

/// Configuration file loader
pub struct ConfigLoader {
    config_paths: Vec<PathBuf>,
    env_prefix: String,
}

impl ConfigLoader {
    /// Create a new config loader with default paths
    pub fn new() -> Self {
        Self {
            config_paths: Self::default_config_paths(),
            env_prefix: "CLAUDE".to_string(),
        }
    }

    /// Create a config loader with custom paths
    pub fn with_paths(paths: Vec<PathBuf>) -> Self {
        Self {
            config_paths: paths,
            env_prefix: "CLAUDE".to_string(),
        }
    }

    /// Set the environment variable prefix (default: CLAUDE)
    pub fn with_env_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.env_prefix = prefix.into();
        self
    }

    /// Add an additional config file path
    pub fn add_path(&mut self, path: PathBuf) {
        self.config_paths.push(path);
    }

    /// Load configuration from all sources
    pub fn load(&self) -> AppResult<Config> {
        debug!("Loading configuration");

        // Start with default config
        let mut config = Config::default();

        // Try to load from config files
        for path in &self.config_paths {
            if let Some(file_config) = self.try_load_file(path)? {
                debug!("Loaded configuration from {}", path.display());
                config = Self::merge_configs(config, file_config);
                break; // Use first found config file
            }
        }

        // Apply environment variables
        config = self.apply_env_vars(config)?;

        // Populate runtime paths
        config.paths = super::PathsConfig {
            home: Some(Self::get_home_dir()?),
            app: Some(Self::get_app_dir()?),
            cache: Some(Self::get_cache_dir()?),
            logs: Some(Self::get_logs_dir()?),
            workspace: config.workspace.clone(),
        };

        debug!("Configuration loaded successfully");
        Ok(config)
    }

    /// Load config from a specific file
    pub fn load_from_file(&self, path: &Path) -> AppResult<Config> {
        debug!("Loading configuration from {}", path.display());

        if !path.exists() {
            return Err(AppError::ConfigNotFound {
                path: path.to_path_buf(),
            });
        }

        let contents = fs::read_to_string(path).map_err(|e| {
            AppError::FileReadError {
                path: path.to_path_buf(),
                source: e,
            }
        })?;

        self.parse_config(&contents, path)
    }

    /// Try to load config from a file (returns None if file doesn't exist)
    fn try_load_file(&self, path: &Path) -> AppResult<Option<Config>> {
        if !path.exists() {
            return Ok(None);
        }

        let contents = fs::read_to_string(path).map_err(|e| {
            AppError::FileReadError {
                path: path.to_path_buf(),
                source: e,
            }
        })?;

        let config = self.parse_config(&contents, path)?;
        Ok(Some(config))
    }

    /// Parse config from string based on file extension
    fn parse_config(&self, contents: &str, path: &Path) -> AppResult<Config> {
        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("toml");

        match extension {
            "toml" => self.parse_toml(contents),
            "json" => self.parse_json(contents),
            "yaml" | "yml" => self.parse_yaml(contents),
            ext => Err(AppError::InvalidConfig {
                reason: format!("Unsupported config file format: {}", ext),
                field: Some("file_extension".to_string()),
            }),
        }
    }

    /// Parse TOML configuration
    fn parse_toml(&self, contents: &str) -> AppResult<Config> {
        toml::from_str(contents).map_err(|e| {
            AppError::ConfigParseError {
                path: PathBuf::from("<TOML_STRING>"), // Placeholder since we don't have a real path here
                source: Box::new(e),
            }
        })
    }

    /// Parse JSON configuration
    fn parse_json(&self, contents: &str) -> AppResult<Config> {
        serde_json::from_str(contents).map_err(|e| {
            AppError::ConfigParseError {
                path: PathBuf::from("<JSON_STRING>"), // Placeholder since we don't have a real path here
                source: Box::new(e),
            }
        })
    }

    /// Parse YAML configuration
    fn parse_yaml(&self, contents: &str) -> AppResult<Config> {
        serde_yaml::from_str(contents).map_err(|e| {
            AppError::ConfigParseError {
                path: PathBuf::from("<YAML_STRING>"), // Placeholder since we don't have a real path here
                source: Box::new(e),
            }
        })
    }

    /// Apply environment variable overrides
    fn apply_env_vars(&self, mut config: Config) -> AppResult<Config> {
        debug!("Applying environment variable overrides");

        // API key
        if let Ok(api_key) = env::var(format!("{}_API_KEY", self.env_prefix)) {
            config.api.key = Some(api_key);
        }

        // API base URL
        if let Ok(base_url) = env::var(format!("{}_API_URL", self.env_prefix)) {
            config.api.base_url = base_url;
        }

        // Log level
        if let Ok(log_level) = env::var(format!("{}_LOG_LEVEL", self.env_prefix)) {
            match log_level.to_lowercase().as_str() {
                "error" => config.log_level = super::LogLevel::Error,
                "warn" => config.log_level = super::LogLevel::Warn,
                "info" => config.log_level = super::LogLevel::Info,
                "verbose" => config.log_level = super::LogLevel::Verbose,
                "debug" => config.log_level = super::LogLevel::Debug,
                "trace" => config.log_level = super::LogLevel::Trace,
                _ => warn!("Invalid log level in environment variable: {}", log_level),
            }
        }

        // Telemetry opt-out
        if let Ok(telemetry) = env::var(format!("{}_TELEMETRY", self.env_prefix)) {
            config.telemetry.enabled = !matches!(telemetry.as_str(), "0" | "false" | "off");
        }

        // Workspace
        if let Ok(workspace) = env::var(format!("{}_WORKSPACE", self.env_prefix)) {
            config.workspace = Some(PathBuf::from(workspace));
        }

        // Multi-account enabled
        if let Ok(multi_account) = env::var(format!("{}_MULTI_ACCOUNT", self.env_prefix)) {
            config.multi_account.enabled = matches!(multi_account.as_str(), "1" | "true" | "on");
        }

        // Colors enabled
        if let Ok(colors) = env::var(format!("{}_NO_COLOR", self.env_prefix)) {
            config.terminal.use_colors = !matches!(colors.as_str(), "1" | "true" | "on");
        }

        Ok(config)
    }

    /// Merge two configs (second takes priority for non-None/non-default values)
    fn merge_configs(mut base: Config, override_cfg: Config) -> Config {
        // Merge workspace
        if override_cfg.workspace.is_some() {
            base.workspace = override_cfg.workspace;
        }

        // Merge log level (always override if different from default)
        if override_cfg.log_level != LogLevel::default() {
            base.log_level = override_cfg.log_level;
        }

        // Merge API config
        if override_cfg.api.key.is_some() {
            base.api.key = override_cfg.api.key;
        }
        if override_cfg.api.base_url != ApiConfig::default().base_url {
            base.api.base_url = override_cfg.api.base_url;
        }
        if override_cfg.api.version.is_some() {
            base.api.version = override_cfg.api.version;
        }
        if override_cfg.api.timeout != default_timeout() {
            base.api.timeout = override_cfg.api.timeout;
        }
        if override_cfg.api.retries != default_retries() {
            base.api.retries = override_cfg.api.retries;
        }
        if override_cfg.api.retry_delay != default_retry_delay() {
            base.api.retry_delay = override_cfg.api.retry_delay;
        }

        // Merge telemetry config
        if override_cfg.telemetry.enabled != TelemetryConfig::default().enabled {
            base.telemetry.enabled = override_cfg.telemetry.enabled;
        }
        if override_cfg.telemetry.anonymize_data != TelemetryConfig::default().anonymize_data {
            base.telemetry.anonymize_data = override_cfg.telemetry.anonymize_data;
        }
        if override_cfg.telemetry.error_reporting != TelemetryConfig::default().error_reporting {
            base.telemetry.error_reporting = override_cfg.telemetry.error_reporting;
        }

        // Merge terminal config
        if override_cfg.terminal.theme != Theme::default() {
            base.terminal.theme = override_cfg.terminal.theme;
        }
        if override_cfg.terminal.use_colors != TerminalConfig::default().use_colors {
            base.terminal.use_colors = override_cfg.terminal.use_colors;
        }
        if override_cfg.terminal.code_highlighting != TerminalConfig::default().code_highlighting {
            base.terminal.code_highlighting = override_cfg.terminal.code_highlighting;
        }
        if override_cfg.terminal.max_height.is_some() {
            base.terminal.max_height = override_cfg.terminal.max_height;
        }
        if override_cfg.terminal.max_width.is_some() {
            base.terminal.max_width = override_cfg.terminal.max_width;
        }

        // Merge code analysis config
        if override_cfg.code_analysis.index_depth != default_index_depth() {
            base.code_analysis.index_depth = override_cfg.code_analysis.index_depth;
        }
        if !override_cfg.code_analysis.exclude_patterns.is_empty()
            && override_cfg.code_analysis.exclude_patterns != default_exclude_patterns() {
            base.code_analysis.exclude_patterns = override_cfg.code_analysis.exclude_patterns;
        }
        if !override_cfg.code_analysis.include_patterns.is_empty()
            && override_cfg.code_analysis.include_patterns != default_include_patterns() {
            base.code_analysis.include_patterns = override_cfg.code_analysis.include_patterns;
        }
        if override_cfg.code_analysis.max_file_size != default_max_file_size() {
            base.code_analysis.max_file_size = override_cfg.code_analysis.max_file_size;
        }

        // Merge git config
        if override_cfg.git.preferred_remote != default_remote() {
            base.git.preferred_remote = override_cfg.git.preferred_remote;
        }
        if override_cfg.git.preferred_branch.is_some() {
            base.git.preferred_branch = override_cfg.git.preferred_branch;
        }
        if override_cfg.git.use_ssh {
            base.git.use_ssh = override_cfg.git.use_ssh;
        }
        if override_cfg.git.sign_commits {
            base.git.sign_commits = override_cfg.git.sign_commits;
        }

        // Merge editor config
        if override_cfg.editor.preferred_launcher.is_some() {
            base.editor.preferred_launcher = override_cfg.editor.preferred_launcher;
        }
        if override_cfg.editor.tab_width != default_tab_width() {
            base.editor.tab_width = override_cfg.editor.tab_width;
        }

        // Merge multi-account config
        if override_cfg.multi_account.enabled {
            base.multi_account = override_cfg.multi_account;
        }

        // Merge offline config
        if override_cfg.offline.enabled != OfflineConfig::default().enabled {
            base.offline = override_cfg.offline;
        }

        // Merge providers (override completely if non-empty)
        if !override_cfg.providers.providers.is_empty() {
            base.providers = override_cfg.providers;
        }

        // Merge boolean flags
        if override_cfg.force_login {
            base.force_login = override_cfg.force_login;
        }
        if override_cfg.force_logout {
            base.force_logout = override_cfg.force_logout;
        }

        // Merge recent workspaces (append if different)
        if !override_cfg.recent_workspaces.is_empty() {
            base.recent_workspaces = override_cfg.recent_workspaces;
        }

        // Merge paths (override if present)
        if override_cfg.paths.workspace.is_some() {
            base.paths.workspace = override_cfg.paths.workspace;
        }

        base
    }

    /// Get default config file paths in priority order
    fn default_config_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        // Current directory
        if let Ok(cwd) = env::current_dir() {
            paths.push(cwd.join(".claude-code.toml"));
            paths.push(cwd.join(".claude-code.json"));
            paths.push(cwd.join(".claude-code.yaml"));
        }

        // User config directory
        if let Ok(config_dir) = Self::get_config_dir() {
            paths.push(config_dir.join("config.toml"));
            paths.push(config_dir.join("config.json"));
            paths.push(config_dir.join("config.yaml"));
        }

        // Home directory
        if let Ok(home) = Self::get_home_dir() {
            paths.push(home.join(".claude-code.toml"));
            paths.push(home.join(".claude-code.json"));
        }

        paths
    }

    /// Get user home directory
    fn get_home_dir() -> AppResult<PathBuf> {
        dirs::home_dir().ok_or_else(|| {
            AppError::InitializationFailed {
                component: "home directory".to_string(),
                source: None,
            }
        })
    }

    /// Get application config directory
    fn get_config_dir() -> AppResult<PathBuf> {
        let config_dir = if cfg!(target_os = "windows") {
            // Windows: %APPDATA%\claude-code
            dirs::config_dir()
                .ok_or_else(|| {
                    AppError::InitializationFailed {
                        component: "config directory".to_string(),
                        source: None,
                    }
                })?
                .join("claude-code")
        } else {
            // Unix: ~/.config/claude-code
            Self::get_home_dir()?.join(".config").join("claude-code")
        };

        // Create directory if it doesn't exist
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(|e| {
                AppError::DirectoryCreationError {
                    path: config_dir.clone(),
                    source: e,
                }
            })?;
        }

        Ok(config_dir)
    }

    /// Get application data directory
    fn get_app_dir() -> AppResult<PathBuf> {
        Self::get_config_dir()
    }

    /// Get cache directory
    fn get_cache_dir() -> AppResult<PathBuf> {
        let cache_dir = if cfg!(target_os = "windows") {
            dirs::cache_dir()
                .ok_or_else(|| {
                    AppError::InitializationFailed {
                        component: "cache directory".to_string(),
                        source: None,
                    }
                })?
                .join("claude-code")
        } else {
            Self::get_home_dir()?.join(".cache").join("claude-code")
        };

        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir).map_err(|e| {
                AppError::DirectoryCreationError {
                    path: cache_dir.clone(),
                    source: e,
                }
            })?;
        }

        Ok(cache_dir)
    }

    /// Get logs directory
    fn get_logs_dir() -> AppResult<PathBuf> {
        let logs_dir = Self::get_app_dir()?.join("logs");

        if !logs_dir.exists() {
            fs::create_dir_all(&logs_dir).map_err(|e| {
                AppError::DirectoryCreationError {
                    path: logs_dir.clone(),
                    source: e,
                }
            })?;
        }

        Ok(logs_dir)
    }
}

impl Default for ConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

// Add dirs crate for cross-platform directory detection
// This is a placeholder - actual implementation would use dirs crate
mod dirs {
    use std::path::PathBuf;

    pub fn home_dir() -> Option<PathBuf> {
        std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .ok()
            .map(PathBuf::from)
    }

    pub fn config_dir() -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            std::env::var("APPDATA").ok().map(PathBuf::from)
        } else {
            home_dir().map(|h| h.join(".config"))
        }
    }

    pub fn cache_dir() -> Option<PathBuf> {
        if cfg!(target_os = "windows") {
            std::env::var("LOCALAPPDATA").ok().map(PathBuf::from)
        } else {
            home_dir().map(|h| h.join(".cache"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_parse_toml_config() {
        let toml_content = r#"
            log_level = "debug"
            force_login = true

            [api]
            base_url = "https://custom.api.com"
            timeout = 30000

            [terminal]
            theme = "dark"
            use_colors = false
        "#;

        let loader = ConfigLoader::new();
        let config = loader.parse_toml(toml_content).unwrap();

        assert_eq!(config.log_level, LogLevel::Debug);
        assert!(config.force_login);
        assert_eq!(config.api.base_url, "https://custom.api.com");
        assert_eq!(config.api.timeout, 30000);
        assert_eq!(config.terminal.theme, Theme::Dark);
        assert!(!config.terminal.use_colors);
    }

    #[test]
    fn test_parse_json_config() {
        let json_content = r#"
        {
            "log_level": "verbose",
            "api": {
                "base_url": "https://test.api.com",
                "timeout": 45000
            },
            "terminal": {
                "theme": "light"
            }
        }
        "#;

        let loader = ConfigLoader::new();
        let config = loader.parse_json(json_content).unwrap();

        assert_eq!(config.log_level, LogLevel::Verbose);
        assert_eq!(config.api.base_url, "https://test.api.com");
        assert_eq!(config.api.timeout, 45000);
        assert_eq!(config.terminal.theme, Theme::Light);
    }

    #[test]
    fn test_parse_yaml_config() {
        let yaml_content = r#"
        log_level: error
        api:
          base_url: https://yaml.api.com
          timeout: 20000
        terminal:
          use_colors: true
        "#;

        let loader = ConfigLoader::new();
        let config = loader.parse_yaml(yaml_content).unwrap();

        assert_eq!(config.log_level, LogLevel::Error);
        assert_eq!(config.api.base_url, "https://yaml.api.com");
        assert_eq!(config.api.timeout, 20000);
        assert!(config.terminal.use_colors);
    }

    #[test]
    fn test_load_from_file_toml() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.toml");

        let toml_content = r#"
            log_level = "trace"
            force_logout = true

            [api]
            timeout = 90000
        "#;

        fs::write(&config_path, toml_content).unwrap();

        let loader = ConfigLoader::new();
        let config = loader.load_from_file(&config_path).unwrap();

        assert_eq!(config.log_level, LogLevel::Trace);
        assert!(config.force_logout);
        assert_eq!(config.api.timeout, 90000);
    }

    #[test]
    fn test_apply_env_vars() {
        // Set environment variables
        std::env::set_var("CLAUDE_API_KEY", "test-key-123");
        std::env::set_var("CLAUDE_API_URL", "https://env.api.com");
        std::env::set_var("CLAUDE_LOG_LEVEL", "debug");
        std::env::set_var("CLAUDE_TELEMETRY", "0");
        std::env::set_var("CLAUDE_NO_COLOR", "1");

        let loader = ConfigLoader::new();
        let base_config = Config::default();
        let config = loader.apply_env_vars(base_config).unwrap();

        assert_eq!(config.api.key, Some("test-key-123".to_string()));
        assert_eq!(config.api.base_url, "https://env.api.com");
        assert_eq!(config.log_level, LogLevel::Debug);
        assert!(!config.telemetry.enabled);
        assert!(!config.terminal.use_colors);

        // Clean up
        std::env::remove_var("CLAUDE_API_KEY");
        std::env::remove_var("CLAUDE_API_URL");
        std::env::remove_var("CLAUDE_LOG_LEVEL");
        std::env::remove_var("CLAUDE_TELEMETRY");
        std::env::remove_var("CLAUDE_NO_COLOR");
    }

    #[test]
    fn test_config_merge_basic() {
        let mut base = Config::default();
        base.log_level = LogLevel::Info;
        base.api.timeout = 60000;

        let mut override_cfg = Config::default();
        override_cfg.log_level = LogLevel::Debug;
        override_cfg.api.key = Some("override-key".to_string());

        let merged = ConfigLoader::merge_configs(base, override_cfg);

        assert_eq!(merged.log_level, LogLevel::Debug);
        assert_eq!(merged.api.key, Some("override-key".to_string()));
        assert_eq!(merged.api.timeout, 60000); // Base value preserved
    }

    #[test]
    fn test_config_merge_workspace() {
        let mut base = Config::default();
        base.workspace = Some(PathBuf::from("/base/workspace"));

        let mut override_cfg = Config::default();
        override_cfg.workspace = Some(PathBuf::from("/override/workspace"));

        let merged = ConfigLoader::merge_configs(base, override_cfg);

        assert_eq!(merged.workspace, Some(PathBuf::from("/override/workspace")));
    }

    #[test]
    fn test_config_merge_preserves_base_when_override_is_default() {
        let mut base = Config::default();
        base.api.timeout = 12345;
        base.terminal.use_colors = false;

        let override_cfg = Config::default(); // All defaults

        let merged = ConfigLoader::merge_configs(base, override_cfg);

        // Base values should be preserved when override has defaults
        assert_eq!(merged.api.timeout, 12345);
        assert!(!merged.terminal.use_colors);
    }

    #[test]
    fn test_config_merge_multi_account() {
        let base = Config::default();

        let mut override_cfg = Config::default();
        override_cfg.multi_account.enabled = true;
        override_cfg.multi_account.max_accounts_per_provider = 15;

        let merged = ConfigLoader::merge_configs(base, override_cfg);

        assert!(merged.multi_account.enabled);
        assert_eq!(merged.multi_account.max_accounts_per_provider, 15);
    }

    #[test]
    fn test_env_prefix_custom() {
        std::env::set_var("MYAPP_API_KEY", "custom-prefix-key");
        std::env::set_var("MYAPP_LOG_LEVEL", "error");

        let loader = ConfigLoader::new().with_env_prefix("MYAPP");
        let base_config = Config::default();
        let config = loader.apply_env_vars(base_config).unwrap();

        assert_eq!(config.api.key, Some("custom-prefix-key".to_string()));
        assert_eq!(config.log_level, LogLevel::Error);

        // Clean up
        std::env::remove_var("MYAPP_API_KEY");
        std::env::remove_var("MYAPP_LOG_LEVEL");
    }

    #[test]
    fn test_default_config_paths() {
        let paths = ConfigLoader::default_config_paths();

        // Should have multiple paths
        assert!(!paths.is_empty());

        // Should include current directory configs
        assert!(paths.iter().any(|p| p.to_str().unwrap().contains(".claude-code.toml")));
    }

    #[test]
    fn test_unsupported_format_error() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.xml");
        fs::write(&config_path, "<config></config>").unwrap();

        let loader = ConfigLoader::new();
        let result = loader.load_from_file(&config_path);

        assert!(result.is_err());
        if let Err(e) = result {
            assert!(e.to_string().contains("Unsupported config file format"));
        }
    }

    #[test]
    fn test_invalid_toml() {
        let invalid_toml = "this is not valid toml {{{";
        let loader = ConfigLoader::new();
        let result = loader.parse_toml(invalid_toml);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_json() {
        let invalid_json = "{ not valid json }";
        let loader = ConfigLoader::new();
        let result = loader.parse_json(invalid_json);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_yaml() {
        let invalid_yaml = "- invalid:\n\t  yaml";
        let loader = ConfigLoader::new();
        let result = loader.parse_yaml(invalid_yaml);
        assert!(result.is_err());
    }
}
