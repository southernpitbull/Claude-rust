// Configuration System
//
// Comprehensive configuration management with support for:
// - Multiple config sources (files, env vars, CLI args)
// - Multiple formats (TOML, JSON, YAML)
// - Validation and sensible defaults
// - Multi-account settings
// - Platform-specific paths

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use crate::error::{AppError, AppResult};

// ============================================================================
// Enums
// ============================================================================

/// Log level for the application
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Verbose,
    Debug,
    Trace,
}

/// Terminal theme
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
    System,
}

/// AI provider type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    Claude,
    Gemini,
    OpenAI,
    Qwen,
}

/// Authentication method
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    ApiKey,
    OAuth,
}

/// Account rotation strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RotationStrategy {
    RoundRobin,
    LeastUsed,
    Random,
    Weighted,
}

// ============================================================================
// Configuration Structs
// ============================================================================

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Workspace directory
    #[serde(default)]
    pub workspace: Option<PathBuf>,

    /// Log level
    #[serde(default)]
    pub log_level: LogLevel,

    /// API configuration
    #[serde(default)]
    pub api: ApiConfig,

    /// Telemetry configuration
    #[serde(default)]
    pub telemetry: TelemetryConfig,

    /// Terminal configuration
    #[serde(default)]
    pub terminal: TerminalConfig,

    /// Code analysis configuration
    #[serde(default)]
    pub code_analysis: CodeAnalysisConfig,

    /// Git configuration
    #[serde(default)]
    pub git: GitConfig,

    /// Editor configuration
    #[serde(default)]
    pub editor: EditorConfig,

    /// Multi-provider configuration
    #[serde(default)]
    pub providers: ProvidersConfig,

    /// Runtime paths
    #[serde(default)]
    pub paths: PathsConfig,

    /// Authentication data
    #[serde(default)]
    pub auth: AuthDataConfig,

    /// Force login flag
    #[serde(default)]
    pub force_login: bool,

    /// Force logout flag
    #[serde(default)]
    pub force_logout: bool,

    /// Recent workspaces
    #[serde(default)]
    pub recent_workspaces: Vec<PathBuf>,

    /// Last update check timestamp
    #[serde(default)]
    pub last_update_check: Option<u64>,

    /// Multi-account settings
    #[serde(default)]
    pub multi_account: MultiAccountConfig,

    /// Offline/local AI configuration
    #[serde(default)]
    pub offline: OfflineConfig,

    /// Task-specific model selection
    #[serde(default)]
    pub model_selection: ModelSelectionConfig,
}

/// API configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// API key (optional, can use OAuth instead)
    #[serde(default)]
    pub key: Option<String>,

    /// Base URL for API
    pub base_url: String,

    /// API version
    #[serde(default)]
    pub version: Option<String>,

    /// Request timeout in milliseconds
    #[serde(default = "default_timeout")]
    pub timeout: u64,

    /// Retry attempts on failure
    #[serde(default = "default_retries")]
    pub retries: u32,

    /// Delay between retries in milliseconds
    #[serde(default = "default_retry_delay")]
    pub retry_delay: u64,
}

/// Telemetry configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryConfig {
    /// Enable telemetry
    #[serde(default)]
    pub enabled: bool,

    /// Anonymize collected data
    #[serde(default = "default_true")]
    pub anonymize_data: bool,

    /// Enable error reporting
    #[serde(default)]
    pub error_reporting: bool,

    /// Submission interval in milliseconds
    #[serde(default = "default_telemetry_interval")]
    pub submission_interval: u64,

    /// Maximum queue size before forcing submission
    #[serde(default = "default_max_queue_size")]
    pub max_queue_size: usize,

    /// Auto-submit telemetry data
    #[serde(default = "default_true")]
    pub auto_submit: bool,
}

/// Terminal configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
    /// Color theme
    #[serde(default)]
    pub theme: Theme,

    /// Show progress indicators
    #[serde(default = "default_true")]
    pub show_progress_indicators: bool,

    /// Use colors in output
    #[serde(default = "default_true")]
    pub use_colors: bool,

    /// Enable code syntax highlighting
    #[serde(default = "default_true")]
    pub code_highlighting: bool,

    /// Maximum terminal height
    #[serde(default)]
    pub max_height: Option<u16>,

    /// Maximum terminal width
    #[serde(default)]
    pub max_width: Option<u16>,
}

/// Code analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeAnalysisConfig {
    /// Maximum depth for file tree traversal
    #[serde(default = "default_index_depth")]
    pub index_depth: u32,

    /// Patterns to exclude from analysis
    #[serde(default = "default_exclude_patterns")]
    pub exclude_patterns: Vec<String>,

    /// Patterns to include in analysis
    #[serde(default = "default_include_patterns")]
    pub include_patterns: Vec<String>,

    /// Maximum file size to analyze (bytes)
    #[serde(default = "default_max_file_size")]
    pub max_file_size: usize,

    /// Timeout for scanning operations (milliseconds)
    #[serde(default = "default_scan_timeout")]
    pub scan_timeout: u64,
}

/// Git configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitConfig {
    /// Preferred remote name
    #[serde(default = "default_remote")]
    pub preferred_remote: String,

    /// Preferred branch name
    #[serde(default)]
    pub preferred_branch: Option<String>,

    /// Use SSH for git operations
    #[serde(default)]
    pub use_ssh: bool,

    /// Use GPG for signing
    #[serde(default)]
    pub use_gpg: bool,

    /// Sign commits by default
    #[serde(default)]
    pub sign_commits: bool,
}

/// Editor configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorConfig {
    /// Preferred editor launcher
    #[serde(default)]
    pub preferred_launcher: Option<String>,

    /// Tab width in spaces
    #[serde(default = "default_tab_width")]
    pub tab_width: u32,

    /// Insert spaces instead of tabs
    #[serde(default = "default_true")]
    pub insert_spaces: bool,

    /// Format on save
    #[serde(default = "default_true")]
    pub format_on_save: bool,
}

/// OAuth configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,

    #[serde(default)]
    pub scope: Vec<String>,
}

/// Provider authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAuthConfig {
    pub method: AuthMethod,

    #[serde(default)]
    pub api_key: Option<String>,

    #[serde(default)]
    pub oauth_config: Option<OAuthConfig>,
}

/// Provider capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    #[serde(default = "default_true")]
    pub supports_streaming: bool,

    #[serde(default)]
    pub supports_images: bool,

    #[serde(default)]
    pub supports_files: bool,

    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,

    #[serde(default)]
    pub supported_models: Vec<String>,
}

/// Individual provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub provider_type: ProviderType,
    pub name: String,

    #[serde(default)]
    pub base_url: Option<String>,

    pub default_model: String,
    pub auth: ProviderAuthConfig,
    pub capabilities: ProviderCapabilities,

    #[serde(default = "default_true")]
    pub enabled: bool,
}

/// Multi-provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvidersConfig {
    #[serde(default)]
    pub default_provider: Option<String>,

    #[serde(default)]
    pub providers: HashMap<String, ProviderConfig>,

    #[serde(default = "default_true")]
    pub fallback_enabled: bool,

    #[serde(default)]
    pub auto_switch_on_failure: bool,
}

/// Runtime paths configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathsConfig {
    #[serde(default)]
    pub home: Option<PathBuf>,

    #[serde(default)]
    pub app: Option<PathBuf>,

    #[serde(default)]
    pub cache: Option<PathBuf>,

    #[serde(default)]
    pub logs: Option<PathBuf>,

    #[serde(default)]
    pub workspace: Option<PathBuf>,
}

/// Authentication data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthDataConfig {
    #[serde(default)]
    pub tokens: HashMap<String, String>,

    #[serde(default)]
    pub last_auth: Option<u64>,
}

/// Multi-account configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultiAccountConfig {
    /// Enable multi-account support
    #[serde(default)]
    pub enabled: bool,

    /// Account rotation strategy
    #[serde(default)]
    pub rotation_strategy: RotationStrategy,

    /// Intelligent rate limiting
    #[serde(default = "default_true")]
    pub intelligent_rate_limiting: bool,

    /// Auto-switch on errors
    #[serde(default = "default_true")]
    pub auto_switch_on_error: bool,

    /// Health check interval (milliseconds)
    #[serde(default = "default_health_check_interval")]
    pub health_check_interval: u64,

    /// Maximum accounts per provider
    #[serde(default = "default_max_accounts")]
    pub max_accounts_per_provider: u32,

    /// Security options
    #[serde(default)]
    pub security_options: SecurityOptions,

    /// Rotation options
    #[serde(default)]
    pub rotation_options: RotationOptions,
}

/// Security options for multi-account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityOptions {
    /// Require re-authentication after N days
    #[serde(default = "default_reauth_days")]
    pub require_reauth_after_days: u32,

    /// Encrypt account metadata
    #[serde(default = "default_true")]
    pub encrypt_metadata: bool,

    /// Auto-lock after N minutes of inactivity
    #[serde(default = "default_autolock_minutes")]
    pub auto_lock_after_minutes: u32,

    /// Securely delete data on removal
    #[serde(default = "default_true")]
    pub secure_delete: bool,
}

/// Rotation options for multi-account
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationOptions {
    /// Minimum interval between rotations (milliseconds)
    #[serde(default = "default_min_rotation_interval")]
    pub min_rotation_interval: u64,

    /// Proactive rotation before limits
    #[serde(default = "default_true")]
    pub proactive_rotation: bool,

    /// Proactive threshold percentage (0-100)
    #[serde(default = "default_proactive_threshold")]
    pub proactive_threshold: u32,
}

/// Offline/local AI configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfflineConfig {
    /// Enable offline mode support
    #[serde(default = "default_true")]
    pub enabled: bool,

    /// Prefer local providers
    #[serde(default)]
    pub prefer_local: bool,

    /// Auto-detect local providers
    #[serde(default = "default_true")]
    pub auto_detect: bool,

    /// Local provider configurations
    #[serde(default)]
    pub local_providers: LocalProvidersConfig,

    /// Fallback strategy
    #[serde(default = "default_fallback_strategy")]
    pub fallback_strategy: String,

    /// Network check interval (milliseconds)
    #[serde(default = "default_network_check_interval")]
    pub network_check_interval: u64,
}

/// Local AI providers configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalProvidersConfig {
    #[serde(default)]
    pub ollama: LocalProviderConfig,

    #[serde(default)]
    pub lmstudio: LocalProviderConfig,
}

/// Individual local provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalProviderConfig {
    #[serde(default = "default_true")]
    pub enabled: bool,

    pub base_url: String,
    pub default_model: String,

    #[serde(default = "default_local_timeout")]
    pub timeout: u64,
}

/// Task-specific model selection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSelectionConfig {
    #[serde(default)]
    pub planning: TaskModelConfig,

    #[serde(default)]
    pub debugging: TaskModelConfig,

    #[serde(default)]
    pub complex: TaskModelConfig,

    #[serde(default)]
    pub coding: TaskModelConfig,

    #[serde(default)]
    pub simple: TaskModelConfig,
}

/// Model configuration for specific task type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskModelConfig {
    pub primary: String,
    pub fallback: String,
    pub providers: Vec<String>,
    pub local_model: String,
    pub description: String,
}

// ============================================================================
// Default Value Functions
// ============================================================================

pub(crate) fn default_true() -> bool {
    true
}

pub(crate) fn default_timeout() -> u64 {
    60000
}

pub(crate) fn default_retries() -> u32 {
    3
}

pub(crate) fn default_retry_delay() -> u64 {
    1000
}

pub(crate) fn default_telemetry_interval() -> u64 {
    30 * 60 * 1000 // 30 minutes
}

pub(crate) fn default_max_queue_size() -> usize {
    100
}

pub(crate) fn default_index_depth() -> u32 {
    3
}

pub(crate) fn default_exclude_patterns() -> Vec<String> {
    vec![
        "node_modules/**".to_string(),
        ".git/**".to_string(),
        "dist/**".to_string(),
        "build/**".to_string(),
        "**/*.min.js".to_string(),
        "**/*.bundle.js".to_string(),
        "**/vendor/**".to_string(),
        ".DS_Store".to_string(),
        "**/*.log".to_string(),
        "**/*.lock".to_string(),
        "**/package-lock.json".to_string(),
        "**/yarn.lock".to_string(),
        "**/pnpm-lock.yaml".to_string(),
        ".env*".to_string(),
        "**/*.map".to_string(),
    ]
}

pub(crate) fn default_include_patterns() -> Vec<String> {
    vec!["**/*".to_string()]
}

pub(crate) fn default_max_file_size() -> usize {
    1024 * 1024 // 1 MB
}

pub(crate) fn default_scan_timeout() -> u64 {
    30000 // 30 seconds
}

pub(crate) fn default_remote() -> String {
    "origin".to_string()
}

pub(crate) fn default_tab_width() -> u32 {
    2
}

pub(crate) fn default_max_tokens() -> u32 {
    4096
}

pub(crate) fn default_health_check_interval() -> u64 {
    60000 // 1 minute
}

pub(crate) fn default_max_accounts() -> u32 {
    10
}

pub(crate) fn default_reauth_days() -> u32 {
    30
}

pub(crate) fn default_autolock_minutes() -> u32 {
    30
}

pub(crate) fn default_min_rotation_interval() -> u64 {
    1000 // 1 second
}

pub(crate) fn default_proactive_threshold() -> u32 {
    80
}

pub(crate) fn default_local_timeout() -> u64 {
    30000 // 30 seconds
}

pub(crate) fn default_network_check_interval() -> u64 {
    60000 // 1 minute
}

pub(crate) fn default_fallback_strategy() -> String {
    "local".to_string()
}

// ============================================================================
// Default Implementations
// ============================================================================

impl Default for LogLevel {
    fn default() -> Self {
        Self::Info
    }
}

impl Default for Theme {
    fn default() -> Self {
        Self::System
    }
}

impl Default for RotationStrategy {
    fn default() -> Self {
        Self::RoundRobin
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            key: None,
            base_url: "https://api.anthropic.com".to_string(),
            version: Some("v1".to_string()),
            timeout: default_timeout(),
            retries: default_retries(),
            retry_delay: default_retry_delay(),
        }
    }
}

impl Default for TelemetryConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            anonymize_data: true,
            error_reporting: true,
            submission_interval: default_telemetry_interval(),
            max_queue_size: default_max_queue_size(),
            auto_submit: true,
        }
    }
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            show_progress_indicators: true,
            use_colors: true,
            code_highlighting: true,
            max_height: None,
            max_width: None,
        }
    }
}

impl Default for CodeAnalysisConfig {
    fn default() -> Self {
        Self {
            index_depth: default_index_depth(),
            exclude_patterns: default_exclude_patterns(),
            include_patterns: default_include_patterns(),
            max_file_size: default_max_file_size(),
            scan_timeout: default_scan_timeout(),
        }
    }
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            preferred_remote: default_remote(),
            preferred_branch: None,
            use_ssh: false,
            use_gpg: false,
            sign_commits: false,
        }
    }
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            preferred_launcher: None,
            tab_width: default_tab_width(),
            insert_spaces: true,
            format_on_save: true,
        }
    }
}

impl Default for ProviderCapabilities {
    fn default() -> Self {
        Self {
            supports_streaming: true,
            supports_images: false,
            supports_files: false,
            max_tokens: default_max_tokens(),
            supported_models: Vec::new(),
        }
    }
}

impl Default for ProvidersConfig {
    fn default() -> Self {
        Self {
            default_provider: None,
            providers: HashMap::new(),
            fallback_enabled: true,
            auto_switch_on_failure: false,
        }
    }
}

impl Default for PathsConfig {
    fn default() -> Self {
        Self {
            home: None,
            app: None,
            cache: None,
            logs: None,
            workspace: None,
        }
    }
}

impl Default for AuthDataConfig {
    fn default() -> Self {
        Self {
            tokens: HashMap::new(),
            last_auth: None,
        }
    }
}

impl Default for SecurityOptions {
    fn default() -> Self {
        Self {
            require_reauth_after_days: default_reauth_days(),
            encrypt_metadata: true,
            auto_lock_after_minutes: default_autolock_minutes(),
            secure_delete: true,
        }
    }
}

impl Default for RotationOptions {
    fn default() -> Self {
        Self {
            min_rotation_interval: default_min_rotation_interval(),
            proactive_rotation: true,
            proactive_threshold: default_proactive_threshold(),
        }
    }
}

impl Default for MultiAccountConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            rotation_strategy: RotationStrategy::default(),
            intelligent_rate_limiting: true,
            auto_switch_on_error: true,
            health_check_interval: default_health_check_interval(),
            max_accounts_per_provider: default_max_accounts(),
            security_options: SecurityOptions::default(),
            rotation_options: RotationOptions::default(),
        }
    }
}

impl Default for LocalProviderConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            base_url: "http://localhost:11434".to_string(),
            default_model: "llama3.2".to_string(),
            timeout: default_local_timeout(),
        }
    }
}

impl Default for LocalProvidersConfig {
    fn default() -> Self {
        Self {
            ollama: LocalProviderConfig {
                enabled: true,
                base_url: "http://localhost:11434".to_string(),
                default_model: "llama3.2".to_string(),
                timeout: default_local_timeout(),
            },
            lmstudio: LocalProviderConfig {
                enabled: true,
                base_url: "http://localhost:1234/v1".to_string(),
                default_model: "auto".to_string(),
                timeout: 60000,
            },
        }
    }
}

impl Default for OfflineConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            prefer_local: false,
            auto_detect: true,
            local_providers: LocalProvidersConfig::default(),
            fallback_strategy: default_fallback_strategy(),
            network_check_interval: default_network_check_interval(),
        }
    }
}

impl Default for TaskModelConfig {
    fn default() -> Self {
        Self {
            primary: "claude-3-5-haiku-20241022".to_string(),
            fallback: "gpt-4o-mini".to_string(),
            providers: vec!["claude".to_string(), "openai".to_string()],
            local_model: "llama3.2".to_string(),
            description: "Default task model configuration".to_string(),
        }
    }
}

impl Default for ModelSelectionConfig {
    fn default() -> Self {
        Self {
            planning: TaskModelConfig {
                primary: "claude-3-5-sonnet-20241022".to_string(),
                fallback: "gpt-4".to_string(),
                providers: vec!["claude".to_string(), "openai".to_string(), "ollama".to_string()],
                local_model: "llama3.2".to_string(),
                description: "For complex planning, architecture, and strategic tasks".to_string(),
            },
            debugging: TaskModelConfig {
                primary: "claude-3-5-sonnet-20241022".to_string(),
                fallback: "gpt-4-turbo".to_string(),
                providers: vec!["claude".to_string(), "openai".to_string(), "ollama".to_string()],
                local_model: "codellama".to_string(),
                description: "For debugging, error analysis, and troubleshooting".to_string(),
            },
            complex: TaskModelConfig {
                primary: "claude-3-opus-20240229".to_string(),
                fallback: "gpt-4".to_string(),
                providers: vec!["claude".to_string(), "openai".to_string()],
                local_model: "llama3.1:70b".to_string(),
                description: "For complex algorithms, detailed analysis, and challenging problems".to_string(),
            },
            coding: TaskModelConfig {
                primary: "claude-3-5-haiku-20241022".to_string(),
                fallback: "gpt-4o-mini".to_string(),
                providers: vec!["claude".to_string(), "openai".to_string(), "ollama".to_string(), "lmstudio".to_string()],
                local_model: "llama3.2".to_string(),
                description: "For general coding, refactoring, and code generation".to_string(),
            },
            simple: TaskModelConfig {
                primary: "claude-3-5-haiku-20241022".to_string(),
                fallback: "gpt-4o-mini".to_string(),
                providers: vec!["claude".to_string(), "openai".to_string(), "ollama".to_string(), "lmstudio".to_string()],
                local_model: "llama3.2".to_string(),
                description: "For simple questions, explanations, and quick tasks".to_string(),
            },
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            workspace: None,
            log_level: LogLevel::default(),
            api: ApiConfig::default(),
            telemetry: TelemetryConfig::default(),
            terminal: TerminalConfig::default(),
            code_analysis: CodeAnalysisConfig::default(),
            git: GitConfig::default(),
            editor: EditorConfig::default(),
            providers: ProvidersConfig::default(),
            paths: PathsConfig::default(),
            auth: AuthDataConfig::default(),
            force_login: false,
            force_logout: false,
            recent_workspaces: Vec::new(),
            last_update_check: None,
            multi_account: MultiAccountConfig::default(),
            offline: OfflineConfig::default(),
            model_selection: ModelSelectionConfig::default(),
        }
    }
}

// ============================================================================
// Configuration Loading and Management
// ============================================================================

mod loader;
mod builder;
mod validation;

pub use loader::ConfigLoader;
pub use builder::ConfigBuilder;
pub use validation::ConfigValidator;
