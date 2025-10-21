//! Input validation and sanitization

use super::{CliError, CliResult};
use regex::Regex;
use std::path::Path;

/// Input validator for CLI arguments
pub struct InputValidator;

impl InputValidator {
    /// Validate file path
    pub fn validate_path(path: &str) -> CliResult<()> {
        let _path_obj = Path::new(path);

        // Check for directory traversal
        if path.contains("..") {
            return Err(CliError::ValidationError(
                "Path traversal detected".to_string(),
            ));
        }

        // Check for null bytes
        if path.contains('\0') {
            return Err(CliError::ValidationError("Null byte in path".to_string()));
        }

        // Check path length (Windows MAX_PATH is 260)
        if path.len() > 4096 {
            return Err(CliError::ValidationError("Path too long".to_string()));
        }

        Ok(())
    }

    /// Validate provider name
    pub fn validate_provider_name(name: &str) -> CliResult<()> {
        // Only allow alphanumeric, hyphen, and underscore
        let re = Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
        if !re.is_match(name) {
            return Err(CliError::ValidationError(
                "Invalid provider name: only alphanumeric, hyphen, and underscore allowed"
                    .to_string(),
            ));
        }

        if name.len() > 64 {
            return Err(CliError::ValidationError(
                "Provider name too long (max 64 characters)".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate API key format
    pub fn validate_api_key(key: &str) -> CliResult<()> {
        if key.is_empty() {
            return Err(CliError::ValidationError(
                "API key cannot be empty".to_string(),
            ));
        }

        if key.len() > 256 {
            return Err(CliError::ValidationError(
                "API key too long (max 256 characters)".to_string(),
            ));
        }

        // Check for common patterns that indicate invalid keys
        if key.contains(char::is_whitespace) {
            return Err(CliError::ValidationError(
                "API key contains whitespace".to_string(),
            ));
        }

        Ok(())
    }

    /// Validate JSON string
    pub fn validate_json(json_str: &str) -> CliResult<serde_json::Value> {
        serde_json::from_str(json_str)
            .map_err(|e| CliError::ValidationError(format!("Invalid JSON: {}", e)))
    }

    /// Sanitize user input (prevent injection attacks)
    pub fn sanitize_input(input: &str) -> String {
        input
            .replace('\0', "")
            .replace('\r', "")
            .chars()
            .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
            .collect()
    }

    /// Validate threshold value (0.0-1.0)
    pub fn validate_threshold(value: f32) -> CliResult<()> {
        if !(0.0..=1.0).contains(&value) {
            return Err(CliError::ValidationError(
                "Threshold must be between 0.0 and 1.0".to_string(),
            ));
        }
        Ok(())
    }

    /// Validate limit value
    pub fn validate_limit(value: usize, max: usize) -> CliResult<()> {
        if value == 0 {
            return Err(CliError::ValidationError(
                "Limit must be greater than 0".to_string(),
            ));
        }

        if value > max {
            return Err(CliError::ValidationError(format!(
                "Limit cannot exceed {}",
                max
            )));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_path_success() {
        assert!(InputValidator::validate_path("/home/user/file.txt").is_ok());
        assert!(InputValidator::validate_path("relative/path.txt").is_ok());
    }

    #[test]
    fn test_validate_path_traversal() {
        assert!(InputValidator::validate_path("../etc/passwd").is_err());
        assert!(InputValidator::validate_path("/home/../etc/passwd").is_err());
    }

    #[test]
    fn test_validate_path_null_byte() {
        assert!(InputValidator::validate_path("/home/user\0/file.txt").is_err());
    }

    #[test]
    fn test_validate_path_too_long() {
        let long_path = "a".repeat(5000);
        assert!(InputValidator::validate_path(&long_path).is_err());
    }

    #[test]
    fn test_validate_provider_name_success() {
        assert!(InputValidator::validate_provider_name("openai").is_ok());
        assert!(InputValidator::validate_provider_name("claude-3").is_ok());
        assert!(InputValidator::validate_provider_name("gpt_4").is_ok());
    }

    #[test]
    fn test_validate_provider_name_invalid() {
        assert!(InputValidator::validate_provider_name("open ai").is_err());
        assert!(InputValidator::validate_provider_name("open@ai").is_err());
        assert!(InputValidator::validate_provider_name("open.ai").is_err());
    }

    #[test]
    fn test_validate_provider_name_too_long() {
        let long_name = "a".repeat(65);
        assert!(InputValidator::validate_provider_name(&long_name).is_err());
    }

    #[test]
    fn test_validate_api_key_success() {
        assert!(InputValidator::validate_api_key("sk-1234567890abcdef").is_ok());
    }

    #[test]
    fn test_validate_api_key_empty() {
        assert!(InputValidator::validate_api_key("").is_err());
    }

    #[test]
    fn test_validate_api_key_whitespace() {
        assert!(InputValidator::validate_api_key("sk-123 456").is_err());
    }

    #[test]
    fn test_validate_api_key_too_long() {
        let long_key = "a".repeat(257);
        assert!(InputValidator::validate_api_key(&long_key).is_err());
    }

    #[test]
    fn test_validate_json_success() {
        let result = InputValidator::validate_json(r#"{"key": "value"}"#);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_json_invalid() {
        assert!(InputValidator::validate_json(r#"{"key": invalid}"#).is_err());
    }

    #[test]
    fn test_sanitize_input() {
        let input = "Hello\0World\rTest\x01Done";
        let sanitized = InputValidator::sanitize_input(input);
        assert_eq!(sanitized, "HelloWorldTestDone");
    }

    #[test]
    fn test_sanitize_input_preserves_newlines() {
        let input = "Line1\nLine2\tTabbed";
        let sanitized = InputValidator::sanitize_input(input);
        assert_eq!(sanitized, "Line1\nLine2\tTabbed");
    }

    #[test]
    fn test_validate_threshold_success() {
        assert!(InputValidator::validate_threshold(0.5).is_ok());
        assert!(InputValidator::validate_threshold(0.0).is_ok());
        assert!(InputValidator::validate_threshold(1.0).is_ok());
    }

    #[test]
    fn test_validate_threshold_invalid() {
        assert!(InputValidator::validate_threshold(-0.1).is_err());
        assert!(InputValidator::validate_threshold(1.1).is_err());
    }

    #[test]
    fn test_validate_limit_success() {
        assert!(InputValidator::validate_limit(10, 100).is_ok());
        assert!(InputValidator::validate_limit(1, 100).is_ok());
        assert!(InputValidator::validate_limit(100, 100).is_ok());
    }

    #[test]
    fn test_validate_limit_zero() {
        assert!(InputValidator::validate_limit(0, 100).is_err());
    }

    #[test]
    fn test_validate_limit_exceeds_max() {
        assert!(InputValidator::validate_limit(101, 100).is_err());
    }
}
