// Configuration Validation
//
// Validates configuration values to ensure they are sensible and secure

use super::Config;
use crate::error::{AppError, AppResult, ErrorCategory};
use tracing::warn;

/// Configuration validator
pub struct ConfigValidator;

impl ConfigValidator {
    /// Validate a complete configuration
    pub fn validate(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        // Validate API configuration
        warnings.extend(Self::validate_api_config(config)?);

        // Validate telemetry configuration
        warnings.extend(Self::validate_telemetry_config(config)?);

        // Validate terminal configuration
        warnings.extend(Self::validate_terminal_config(config)?);

        // Validate code analysis configuration
        warnings.extend(Self::validate_code_analysis_config(config)?);

        // Validate multi-account configuration
        warnings.extend(Self::validate_multi_account_config(config)?);

        // Validate offline configuration
        warnings.extend(Self::validate_offline_config(config)?);

        Ok(warnings)
    }

    /// Validate API configuration
    fn validate_api_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        // Check timeout is reasonable
        if config.api.timeout < 1000 {
            warnings.push(ValidationWarning::new(
                "api.timeout",
                "API timeout is very low (<1 second), may cause frequent timeouts",
            ));
        } else if config.api.timeout > 300_000 {
            warnings.push(ValidationWarning::new(
                "api.timeout",
                "API timeout is very high (>5 minutes), may cause long hangs",
            ));
        }

        // Check retry count is reasonable
        if config.api.retries > 10 {
            warnings.push(ValidationWarning::new(
                "api.retries",
                "Too many retry attempts configured, may cause long delays",
            ));
        }

        // Check retry delay is reasonable
        if config.api.retry_delay < 100 {
            warnings.push(ValidationWarning::new(
                "api.retry_delay",
                "Retry delay is very short, may overwhelm API servers",
            ));
        }

        // Validate base URL
        if !config.api.base_url.starts_with("http://")
            && !config.api.base_url.starts_with("https://") {
            return Err(AppError::InvalidConfig {
                reason: "API base URL must start with http:// or https://".to_string(),
                field: Some("api.base_url".to_string()),
            });
        }

        // Warn if using HTTP instead of HTTPS
        if config.api.base_url.starts_with("http://")
            && !config.api.base_url.contains("localhost")
            && !config.api.base_url.contains("127.0.0.1") {
            warnings.push(ValidationWarning::new(
                "api.base_url",
                "Using HTTP instead of HTTPS is insecure for remote APIs",
            ));
        }

        Ok(warnings)
    }

    /// Validate telemetry configuration
    fn validate_telemetry_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        // Check submission interval is reasonable
        if config.telemetry.submission_interval < 10_000 {
            warnings.push(ValidationWarning::new(
                "telemetry.submission_interval",
                "Telemetry submission interval is very frequent (<10 seconds)",
            ));
        }

        // Check queue size is reasonable
        if config.telemetry.max_queue_size > 10_000 {
            warnings.push(ValidationWarning::new(
                "telemetry.max_queue_size",
                "Telemetry queue size is very large, may consume significant memory",
            ));
        }

        Ok(warnings)
    }

    /// Validate terminal configuration
    fn validate_terminal_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        // Check terminal dimensions are reasonable
        if let Some(height) = config.terminal.max_height {
            if height < 10 {
                warnings.push(ValidationWarning::new(
                    "terminal.max_height",
                    "Terminal height is very small (<10 lines)",
                ));
            } else if height > 500 {
                warnings.push(ValidationWarning::new(
                    "terminal.max_height",
                    "Terminal height is unreasonably large (>500 lines)",
                ));
            }
        }

        if let Some(width) = config.terminal.max_width {
            if width < 40 {
                warnings.push(ValidationWarning::new(
                    "terminal.max_width",
                    "Terminal width is very small (<40 columns)",
                ));
            } else if width > 500 {
                warnings.push(ValidationWarning::new(
                    "terminal.max_width",
                    "Terminal width is unreasonably large (>500 columns)",
                ));
            }
        }

        Ok(warnings)
    }

    /// Validate code analysis configuration
    fn validate_code_analysis_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        // Check index depth is reasonable
        if config.code_analysis.index_depth == 0 {
            return Err(AppError::InvalidConfig {
                reason: "Code analysis index depth must be at least 1".to_string(),
                field: Some("code_analysis.index_depth".to_string()),
            });
        } else if config.code_analysis.index_depth > 10 {
            warnings.push(ValidationWarning::new(
                "code_analysis.index_depth",
                "Index depth is very high (>10), may scan too many files",
            ));
        }

        // Check max file size is reasonable
        if config.code_analysis.max_file_size == 0 {
            return Err(AppError::InvalidConfig {
                reason: "Code analysis max file size must be greater than 0".to_string(),
                field: Some("code_analysis.max_file_size".to_string()),
            });
        } else if config.code_analysis.max_file_size > 100 * 1024 * 1024 {
            warnings.push(ValidationWarning::new(
                "code_analysis.max_file_size",
                "Max file size is very large (>100MB), may cause memory issues",
            ));
        }

        // Check scan timeout is reasonable
        if config.code_analysis.scan_timeout < 1000 {
            warnings.push(ValidationWarning::new(
                "code_analysis.scan_timeout",
                "Scan timeout is very short (<1 second)",
            ));
        }

        Ok(warnings)
    }

    /// Validate multi-account configuration
    fn validate_multi_account_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        if config.multi_account.enabled {
            // Check max accounts is reasonable
            if config.multi_account.max_accounts_per_provider == 0 {
                return Err(AppError::InvalidConfig {
                    reason: "Max accounts per provider must be at least 1".to_string(),
                    field: Some("multi_account.max_accounts_per_provider".to_string()),
                });
            } else if config.multi_account.max_accounts_per_provider > 100 {
                warnings.push(ValidationWarning::new(
                    "multi_account.max_accounts_per_provider",
                    "Max accounts per provider is very high (>100)",
                ));
            }

            // Check health check interval
            if config.multi_account.health_check_interval < 5_000 {
                warnings.push(ValidationWarning::new(
                    "multi_account.health_check_interval",
                    "Health check interval is very frequent (<5 seconds)",
                ));
            }

            // Check rotation options
            if config.multi_account.rotation_options.min_rotation_interval < 100 {
                warnings.push(ValidationWarning::new(
                    "multi_account.rotation_options.min_rotation_interval",
                    "Min rotation interval is very short (<100ms)",
                ));
            }

            if config.multi_account.rotation_options.proactive_threshold > 100 {
                return Err(AppError::InvalidConfig {
                    reason: "Proactive threshold must be between 0 and 100".to_string(),
                    field: Some("multi_account.rotation_options.proactive_threshold".to_string()),
                });
            }

            // Check security options
            if config.multi_account.security_options.require_reauth_after_days == 0 {
                warnings.push(ValidationWarning::new(
                    "multi_account.security_options.require_reauth_after_days",
                    "Requiring immediate re-authentication may be disruptive",
                ));
            }

            if config.multi_account.security_options.auto_lock_after_minutes == 0 {
                warnings.push(ValidationWarning::new(
                    "multi_account.security_options.auto_lock_after_minutes",
                    "Auto-lock disabled (0 minutes) reduces security",
                ));
            }
        }

        Ok(warnings)
    }

    /// Validate offline configuration
    fn validate_offline_config(config: &Config) -> AppResult<Vec<ValidationWarning>> {
        let mut warnings = Vec::new();

        if config.offline.enabled {
            // Check network check interval
            if config.offline.network_check_interval < 1_000 {
                warnings.push(ValidationWarning::new(
                    "offline.network_check_interval",
                    "Network check interval is very frequent (<1 second)",
                ));
            }

            // Validate local provider URLs
            if config.offline.local_providers.ollama.enabled {
                if !config.offline.local_providers.ollama.base_url.starts_with("http://")
                    && !config.offline.local_providers.ollama.base_url.starts_with("https://") {
                    return Err(AppError::InvalidConfig {
                        reason: "Ollama base URL must start with http:// or https://".to_string(),
                        field: Some("offline.local_providers.ollama.base_url".to_string()),
                    });
                }
            }

            if config.offline.local_providers.lmstudio.enabled {
                if !config.offline.local_providers.lmstudio.base_url.starts_with("http://")
                    && !config.offline.local_providers.lmstudio.base_url.starts_with("https://") {
                    return Err(AppError::InvalidConfig {
                        reason: "LM Studio base URL must start with http:// or https://".to_string(),
                        field: Some("offline.local_providers.lmstudio.base_url".to_string()),
                    });
                }
            }
        }

        Ok(warnings)
    }

    /// Validate and apply fixes to configuration
    pub fn validate_and_fix(mut config: Config) -> AppResult<(Config, Vec<ValidationWarning>)> {
        let warnings = Self::validate(&config)?;

        // Auto-fix some issues
        if config.api.timeout < 1000 {
            warn!("Auto-fixing API timeout to 1000ms");
            config.api.timeout = 1000;
        }

        if config.api.retries > 10 {
            warn!("Auto-fixing retry count to 10");
            config.api.retries = 10;
        }

        if config.code_analysis.index_depth == 0 {
            warn!("Auto-fixing index depth to 1");
            config.code_analysis.index_depth = 1;
        }

        Ok((config, warnings))
    }
}

/// Validation warning (non-fatal issues)
#[derive(Debug, Clone)]
pub struct ValidationWarning {
    pub field: String,
    pub message: String,
}

impl ValidationWarning {
    pub fn new(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            field: field.into(),
            message: message.into(),
        }
    }
}

impl std::fmt::Display for ValidationWarning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.field, self.message)
    }
}



#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_config() {
        let config = Config::default();
        let result = ConfigValidator::validate(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_low_timeout() {
        let mut config = Config::default();
        config.api.timeout = 500;

        let warnings = ConfigValidator::validate(&config).unwrap();
        assert!(!warnings.is_empty());
        assert!(warnings.iter().any(|w| w.field == "api.timeout"));
    }

    #[test]
    fn test_validate_invalid_base_url() {
        let mut config = Config::default();
        config.api.base_url = "invalid-url".to_string();

        let result = ConfigValidator::validate(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_and_fix() {
        let mut config = Config::default();
        config.api.timeout = 500;
        config.api.retries = 15;

        let (fixed_config, _warnings) = ConfigValidator::validate_and_fix(config).unwrap();
        assert_eq!(fixed_config.api.timeout, 1000);
        assert_eq!(fixed_config.api.retries, 10);
    }

    #[test]
    fn test_validate_zero_index_depth() {
        let mut config = Config::default();
        config.code_analysis.index_depth = 0;

        let result = ConfigValidator::validate(&config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_proactive_threshold() {
        let mut config = Config::default();
        config.multi_account.enabled = true;
        config.multi_account.rotation_options.proactive_threshold = 150;

        let result = ConfigValidator::validate(&config);
        assert!(result.is_err());
    }
}
