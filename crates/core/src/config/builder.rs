// Configuration Builder
//
// Provides a fluent builder API for constructing configuration
// with programmatic overrides

use super::{
    ApiConfig, Config, EditorConfig, GitConfig, LogLevel, OfflineConfig, TerminalConfig, Theme,
};
use crate::error::AppResult;
use std::path::PathBuf;

/// Builder for constructing configuration
pub struct ConfigBuilder {
    config: Config,
    config_file: Option<PathBuf>,
    env_prefix: String,
    skip_env: bool,
    skip_files: bool,
}

impl ConfigBuilder {
    /// Create a new config builder with defaults
    pub fn new() -> Self {
        Self {
            config: Config::default(),
            config_file: None,
            env_prefix: "CLAUDE".to_string(),
            skip_env: false,
            skip_files: false,
        }
    }

    /// Start with an existing config
    pub fn from_config(config: Config) -> Self {
        Self {
            config,
            config_file: None,
            env_prefix: "CLAUDE".to_string(),
            skip_env: false,
            skip_files: false,
        }
    }

    /// Set config file path to load
    pub fn with_file(mut self, path: impl Into<PathBuf>) -> Self {
        self.config_file = Some(path.into());
        self
    }

    /// Set environment variable prefix
    pub fn with_env_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.env_prefix = prefix.into();
        self
    }

    /// Skip loading from environment variables
    pub fn skip_env(mut self) -> Self {
        self.skip_env = true;
        self
    }

    /// Skip loading from files
    pub fn skip_files(mut self) -> Self {
        self.skip_files = true;
        self
    }

    /// Set workspace directory
    pub fn workspace(mut self, workspace: impl Into<PathBuf>) -> Self {
        self.config.workspace = Some(workspace.into());
        self
    }

    /// Set log level
    pub fn log_level(mut self, level: LogLevel) -> Self {
        self.config.log_level = level;
        self
    }

    /// Set API key
    pub fn api_key(mut self, key: impl Into<String>) -> Self {
        self.config.api.key = Some(key.into());
        self
    }

    /// Set API base URL
    pub fn api_base_url(mut self, url: impl Into<String>) -> Self {
        self.config.api.base_url = url.into();
        self
    }

    /// Set API timeout
    pub fn api_timeout(mut self, timeout_ms: u64) -> Self {
        self.config.api.timeout = timeout_ms;
        self
    }

    /// Enable/disable telemetry
    pub fn telemetry(mut self, enabled: bool) -> Self {
        self.config.telemetry.enabled = enabled;
        self
    }

    /// Enable/disable error reporting
    pub fn error_reporting(mut self, enabled: bool) -> Self {
        self.config.telemetry.error_reporting = enabled;
        self
    }

    /// Set terminal theme
    pub fn theme(mut self, theme: Theme) -> Self {
        self.config.terminal.theme = theme;
        self
    }

    /// Enable/disable colors
    pub fn colors(mut self, enabled: bool) -> Self {
        self.config.terminal.use_colors = enabled;
        self
    }

    /// Enable/disable code highlighting
    pub fn code_highlighting(mut self, enabled: bool) -> Self {
        self.config.terminal.code_highlighting = enabled;
        self
    }

    /// Set git preferred remote
    pub fn git_remote(mut self, remote: impl Into<String>) -> Self {
        self.config.git.preferred_remote = remote.into();
        self
    }

    /// Enable/disable git commit signing
    pub fn git_sign_commits(mut self, enabled: bool) -> Self {
        self.config.git.sign_commits = enabled;
        self
    }

    /// Enable/disable multi-account support
    pub fn multi_account(mut self, enabled: bool) -> Self {
        self.config.multi_account.enabled = enabled;
        self
    }

    /// Set max accounts per provider
    pub fn max_accounts_per_provider(mut self, max: u32) -> Self {
        self.config.multi_account.max_accounts_per_provider = max;
        self
    }

    /// Enable/disable offline mode
    pub fn offline_mode(mut self, enabled: bool) -> Self {
        self.config.offline.enabled = enabled;
        self
    }

    /// Prefer local AI providers
    pub fn prefer_local(mut self, enabled: bool) -> Self {
        self.config.offline.prefer_local = enabled;
        self
    }

    /// Set force login flag
    pub fn force_login(mut self, enabled: bool) -> Self {
        self.config.force_login = enabled;
        self
    }

    /// Set force logout flag
    pub fn force_logout(mut self, enabled: bool) -> Self {
        self.config.force_logout = enabled;
        self
    }

    /// Add a recent workspace
    pub fn add_recent_workspace(mut self, workspace: impl Into<PathBuf>) -> Self {
        self.config.recent_workspaces.push(workspace.into());
        self
    }

    /// Set code analysis max file size
    pub fn max_file_size(mut self, size_bytes: usize) -> Self {
        self.config.code_analysis.max_file_size = size_bytes;
        self
    }

    /// Add exclude pattern for code analysis
    pub fn add_exclude_pattern(mut self, pattern: impl Into<String>) -> Self {
        self.config.code_analysis.exclude_patterns.push(pattern.into());
        self
    }

    /// Set exclude patterns for code analysis
    pub fn exclude_patterns(mut self, patterns: Vec<String>) -> Self {
        self.config.code_analysis.exclude_patterns = patterns;
        self
    }

    /// Set editor tab width
    pub fn tab_width(mut self, width: u32) -> Self {
        self.config.editor.tab_width = width;
        self
    }

    /// Enable/disable format on save
    pub fn format_on_save(mut self, enabled: bool) -> Self {
        self.config.editor.format_on_save = enabled;
        self
    }

    /// Build the final configuration
    pub fn build(mut self) -> AppResult<Config> {
        use super::loader::ConfigLoader;

        // Load from file if not skipped
        if !self.skip_files {
            if let Some(config_file) = self.config_file {
                // Load from specific file
                let file_config = ConfigLoader::new().load_from_file(&config_file)?;
                self.config = Self::merge_configs(file_config, self.config);
            } else {
                // Load from default locations
                let loader = ConfigLoader::new().with_env_prefix(self.env_prefix.clone());
                if let Ok(file_config) = loader.load() {
                    self.config = Self::merge_configs(file_config, self.config);
                }
            }
        }

        // Apply environment variables if not skipped
        if !self.skip_env {
            let loader = ConfigLoader::new().with_env_prefix(self.env_prefix);
            if let Ok(env_config) = loader.load() {
                // Merge env vars (they take priority)
                self.config = Self::merge_configs(self.config, env_config);
            }
        }

        Ok(self.config)
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

        // Merge git config
        if override_cfg.git.sign_commits {
            base.git.sign_commits = override_cfg.git.sign_commits;
        }
        if !override_cfg.git.preferred_remote.is_empty()
            && override_cfg.git.preferred_remote != GitConfig::default().preferred_remote {
            base.git.preferred_remote = override_cfg.git.preferred_remote;
        }

        // Merge multi-account config
        if override_cfg.multi_account.enabled {
            base.multi_account = override_cfg.multi_account;
        }

        // Merge offline config
        if override_cfg.offline.enabled != OfflineConfig::default().enabled {
            base.offline = override_cfg.offline;
        }

        // Merge editor config
        if override_cfg.editor.tab_width != EditorConfig::default().tab_width {
            base.editor.tab_width = override_cfg.editor.tab_width;
        }
        if override_cfg.editor.format_on_save != EditorConfig::default().format_on_save {
            base.editor.format_on_save = override_cfg.editor.format_on_save;
        }

        // Merge code analysis config
        if !override_cfg.code_analysis.exclude_patterns.is_empty() {
            base.code_analysis.exclude_patterns = override_cfg.code_analysis.exclude_patterns;
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

        base
    }
}

impl Default for ConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_basic() {
        let config = ConfigBuilder::new()
            .api_key("test-key")
            .log_level(LogLevel::Debug)
            .colors(false)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.api.key, Some("test-key".to_string()));
        assert_eq!(config.log_level, LogLevel::Debug);
        assert!(!config.terminal.use_colors);
    }

    #[test]
    fn test_builder_workspace() {
        let config = ConfigBuilder::new()
            .workspace("/tmp/test")
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.workspace, Some(PathBuf::from("/tmp/test")));
    }

    #[test]
    fn test_builder_multi_account() {
        let config = ConfigBuilder::new()
            .multi_account(true)
            .max_accounts_per_provider(5)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert!(config.multi_account.enabled);
        assert_eq!(config.multi_account.max_accounts_per_provider, 5);
    }

    #[test]
    fn test_builder_code_analysis() {
        let config = ConfigBuilder::new()
            .max_file_size(512 * 1024)
            .add_exclude_pattern("*.tmp")
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.code_analysis.max_file_size, 512 * 1024);
        assert!(config.code_analysis.exclude_patterns.contains(&"*.tmp".to_string()));
    }

    #[test]
    fn test_builder_api_config() {
        let config = ConfigBuilder::new()
            .api_key("test-api-key")
            .api_base_url("https://custom.api.com")
            .api_timeout(90000)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.api.key, Some("test-api-key".to_string()));
        assert_eq!(config.api.base_url, "https://custom.api.com");
        assert_eq!(config.api.timeout, 90000);
    }

    #[test]
    fn test_builder_telemetry() {
        let config = ConfigBuilder::new()
            .telemetry(false)
            .error_reporting(false)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert!(!config.telemetry.enabled);
        assert!(!config.telemetry.error_reporting);
    }

    #[test]
    fn test_builder_theme_and_colors() {
        let config = ConfigBuilder::new()
            .theme(Theme::Dark)
            .colors(true)
            .code_highlighting(false)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.terminal.theme, Theme::Dark);
        assert!(config.terminal.use_colors);
        assert!(!config.terminal.code_highlighting);
    }

    #[test]
    fn test_builder_git_config() {
        let config = ConfigBuilder::new()
            .git_remote("upstream")
            .git_sign_commits(true)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.git.preferred_remote, "upstream");
        assert!(config.git.sign_commits);
    }

    #[test]
    fn test_builder_offline_mode() {
        let config = ConfigBuilder::new()
            .offline_mode(true)
            .prefer_local(true)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert!(config.offline.enabled);
        assert!(config.offline.prefer_local);
    }

    #[test]
    fn test_builder_force_flags() {
        let config = ConfigBuilder::new()
            .force_login(true)
            .force_logout(false)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert!(config.force_login);
        assert!(!config.force_logout);
    }

    #[test]
    fn test_builder_recent_workspaces() {
        let config = ConfigBuilder::new()
            .add_recent_workspace("/workspace1")
            .add_recent_workspace("/workspace2")
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.recent_workspaces.len(), 2);
        assert!(config.recent_workspaces.contains(&PathBuf::from("/workspace1")));
        assert!(config.recent_workspaces.contains(&PathBuf::from("/workspace2")));
    }

    #[test]
    fn test_builder_editor_config() {
        let config = ConfigBuilder::new()
            .tab_width(4)
            .format_on_save(false)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.editor.tab_width, 4);
        assert!(!config.editor.format_on_save);
    }

    #[test]
    fn test_builder_exclude_patterns() {
        let patterns = vec!["*.log".to_string(), "*.tmp".to_string()];
        let config = ConfigBuilder::new()
            .exclude_patterns(patterns.clone())
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.code_analysis.exclude_patterns, patterns);
    }

    #[test]
    fn test_builder_chaining() {
        let config = ConfigBuilder::new()
            .workspace("/test")
            .log_level(LogLevel::Verbose)
            .api_key("chained-key")
            .colors(false)
            .multi_account(true)
            .max_accounts_per_provider(20)
            .skip_env()
            .skip_files()
            .build()
            .unwrap();

        assert_eq!(config.workspace, Some(PathBuf::from("/test")));
        assert_eq!(config.log_level, LogLevel::Verbose);
        assert_eq!(config.api.key, Some("chained-key".to_string()));
        assert!(!config.terminal.use_colors);
        assert!(config.multi_account.enabled);
        assert_eq!(config.multi_account.max_accounts_per_provider, 20);
    }

    #[test]
    fn test_builder_merge_preserves_base() {
        let mut base = Config::default();
        base.log_level = LogLevel::Debug;

        let mut override_cfg = Config::default();
        override_cfg.api.key = Some("override-key".to_string());

        let merged = ConfigBuilder::merge_configs(base, override_cfg);

        assert_eq!(merged.log_level, LogLevel::Debug); // Preserved from base
        assert_eq!(merged.api.key, Some("override-key".to_string())); // From override
    }

    #[test]
    fn test_builder_default_trait() {
        let builder = ConfigBuilder::default();
        let config = builder.skip_env().skip_files().build().unwrap();

        assert_eq!(config.log_level, LogLevel::Info);
    }
}
