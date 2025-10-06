//! Error Handling Examples
//!
//! This module demonstrates various usage patterns for the error handling system.
//! These examples show best practices for creating, handling, and propagating errors.

#![allow(dead_code)]

use crate::error::{AppError, AppResult, ErrorContext, io_error_with_path, network_error};
use std::fs;
use std::path::PathBuf;

// ============================================================================
// Example 1: Basic Error Creation
// ============================================================================

/// Example of creating and returning domain-specific errors
fn authenticate_user(token: &str) -> AppResult<String> {
    if token.is_empty() {
        return Err(AppError::NotAuthenticated);
    }

    if token.len() < 10 {
        return Err(AppError::InvalidToken {
            provider: "claude".to_string(),
        });
    }

    Ok("authenticated".to_string())
}

// ============================================================================
// Example 2: Error Conversion with From trait
// ============================================================================

/// Example showing automatic error conversion from std errors
fn read_config_file(path: &PathBuf) -> AppResult<String> {
    // IO errors are automatically converted to AppError via From trait
    let contents = fs::read_to_string(path)?;

    // JSON errors are also automatically converted
    let _config: serde_json::Value = serde_json::from_str(&contents)?;

    Ok(contents)
}

// ============================================================================
// Example 3: Adding Context to Errors
// ============================================================================

/// Example of adding context to errors for better debugging
fn load_configuration(config_path: &PathBuf) -> AppResult<String> {
    // Add context when reading file fails
    let contents = fs::read_to_string(config_path)
        .map_err(|e| io_error_with_path(e, config_path.clone()))
        .context("Failed to load application configuration")?;

    // Parse with context
    let _parsed: serde_json::Value = serde_json::from_str(&contents)
        .context("Invalid JSON in configuration file")?;

    Ok(contents)
}

// ============================================================================
// Example 4: Lazy Context Evaluation
// ============================================================================

/// Example using with_context for expensive context computation
fn process_large_file(path: &PathBuf) -> AppResult<Vec<u8>> {
    fs::read(path)
        .map_err(|e| io_error_with_path(e, path.clone()))
        .with_context(|| {
            // This closure is only called if an error occurs
            format!("Failed to process large file at {}", path.display())
        })
}

// ============================================================================
// Example 5: Handling Retryable Errors
// ============================================================================

/// Example of checking if errors are retryable and implementing retry logic
async fn fetch_with_retry(url: &str, max_retries: u32) -> AppResult<String> {
    let mut attempts = 0;

    loop {
        match fetch_data(url).await {
            Ok(data) => return Ok(data),
            Err(e) if e.is_retryable() && attempts < max_retries => {
                attempts += 1;
                eprintln!("Retryable error, attempt {}/{}: {}", attempts, max_retries, e);

                // Wait before retrying (exponential backoff)
                let delay = std::time::Duration::from_secs(2u64.pow(attempts));
                tokio::time::sleep(delay).await;
            }
            Err(e) => return Err(e),
        }
    }
}

async fn fetch_data(_url: &str) -> AppResult<String> {
    // Simulated network fetch
    Ok("data".to_string())
}

// ============================================================================
// Example 6: Error Classification and Metrics
// ============================================================================

/// Example of using error categories for metrics and logging
fn handle_error_with_metrics(error: &AppError) {
    // Get error category for metrics
    let category = error.category();

    // Log based on category
    match category {
        crate::error::ErrorCategory::Network => {
            eprintln!("Network error detected: {}", error);
            // Increment network error counter
        }
        crate::error::ErrorCategory::Authentication => {
            eprintln!("Authentication error: {}", error);
            // Alert security team
        }
        _ => {
            eprintln!("Error in category {:?}: {}", category, error);
        }
    }

    // Check if retryable
    if error.is_retryable() {
        eprintln!("This error is retryable");
    }
}

// ============================================================================
// Example 7: User-Friendly Error Messages
// ============================================================================

/// Example of displaying user-friendly error messages
fn display_error_to_user(error: &AppError) {
    // Get user-friendly message
    let user_msg = error.user_message();
    println!("Error: {}", user_msg);

    // Get resolution steps
    let steps = error.resolution_steps();
    if !steps.is_empty() {
        println!("\nHow to resolve:");
        for step in steps {
            println!("  {}", step);
        }
    }
}

// ============================================================================
// Example 8: Custom Error Creation with Context
// ============================================================================

/// Example of creating specific errors with rich context
fn validate_api_response(response: &str) -> AppResult<serde_json::Value> {
    if response.is_empty() {
        return Err(AppError::InvalidModelResponse {
            reason: "Empty response received".to_string(),
            provider: "claude".to_string(),
        });
    }

    let json: serde_json::Value = serde_json::from_str(response)
        .map_err(|e| AppError::JsonParseError {
            message: format!("Failed to parse API response: {}", e),
            source: e,
        })?;

    // Validate structure
    if !json.is_object() {
        return Err(AppError::InvalidModelResponse {
            reason: "Response is not a JSON object".to_string(),
            provider: "claude".to_string(),
        });
    }

    Ok(json)
}

// ============================================================================
// Example 9: Handling Multiple Error Types
// ============================================================================

/// Example combining multiple operations that can fail in different ways
fn complex_operation(path: &PathBuf, api_key: &str) -> AppResult<String> {
    // Authentication
    if api_key.is_empty() {
        return Err(AppError::NotAuthenticated);
    }

    // File operations
    if !path.exists() {
        return Err(AppError::FileNotFound {
            path: path.clone(),
        });
    }

    let data = fs::read_to_string(path)
        .map_err(|e| AppError::FileReadError {
            path: path.clone(),
            source: e,
        })?;

    // Validation
    if data.len() > 1_000_000 {
        return Err(AppError::ValidationFailed {
            field: "file_size".to_string(),
            reason: "File too large (max 1MB)".to_string(),
        });
    }

    // Network operation
    // simulate_api_call(&data, api_key)?;

    Ok(data)
}

// ============================================================================
// Example 10: Error Recovery Patterns
// ============================================================================

/// Example of graceful error recovery with fallbacks
fn read_config_with_fallback(primary_path: &PathBuf, fallback_path: &PathBuf) -> AppResult<String> {
    // Try primary path first
    match fs::read_to_string(primary_path) {
        Ok(contents) => Ok(contents),
        Err(e) => {
            eprintln!("Failed to read primary config at {}: {}", primary_path.display(), e);

            // Try fallback
            match fs::read_to_string(fallback_path) {
                Ok(contents) => {
                    eprintln!("Using fallback config at {}", fallback_path.display());
                    Ok(contents)
                }
                Err(fallback_err) => {
                    // Both failed, return comprehensive error
                    Err(AppError::ConfigNotFound {
                        path: primary_path.clone(),
                    })
                }
            }
        }
    }
}

// ============================================================================
// Example 11: Network Error Helper
// ============================================================================

/// Example using the network_error helper function
fn make_http_request(url: &str) -> AppResult<String> {
    // Simulate HTTP error
    let http_error = std::io::Error::new(
        std::io::ErrorKind::ConnectionRefused,
        "Connection refused"
    );

    Err(network_error(
        format!("Failed to connect to {}", url),
        http_error
    ))
}

// ============================================================================
// Example 12: Command Execution Errors
// ============================================================================

/// Example of handling command execution errors
fn run_external_command(command: &str, args: &[&str]) -> AppResult<String> {
    use std::process::Command;

    let output = Command::new(command)
        .args(args)
        .output()
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::NotFound {
                AppError::CommandNotFound {
                    command: command.to_string(),
                }
            } else {
                AppError::IoError {
                    message: format!("Failed to execute command: {}", command),
                    source: e,
                }
            }
        })?;

    if !output.status.success() {
        return Err(AppError::CommandExecutionFailed {
            command: format!("{} {}", command, args.join(" ")),
            exit_code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        });
    }

    String::from_utf8(output.stdout)
        .map_err(Into::into)
}

// ============================================================================
// Example 13: Rate Limit Handling
// ============================================================================

/// Example of handling rate limits with proper waiting
async fn handle_rate_limited_request(provider: &str) -> AppResult<String> {
    match make_api_request(provider).await {
        Err(AppError::RateLimitExceeded { retry_after: Some(duration), .. }) => {
            eprintln!("Rate limited, waiting {:?}", duration);
            tokio::time::sleep(duration).await;
            // Retry after waiting
            make_api_request(provider).await
        }
        result => result,
    }
}

async fn make_api_request(_provider: &str) -> AppResult<String> {
    Ok("response".to_string())
}

// ============================================================================
// Example 14: Session Expiry Handling
// ============================================================================

/// Example of handling session expiry with re-authentication
async fn authenticated_operation(token: &str) -> AppResult<String> {
    match perform_operation(token).await {
        Err(AppError::SessionExpired { .. }) => {
            eprintln!("Session expired, re-authenticating...");
            let new_token = re_authenticate().await?;
            perform_operation(&new_token).await
        }
        result => result,
    }
}

async fn perform_operation(_token: &str) -> AppResult<String> {
    Ok("result".to_string())
}

async fn re_authenticate() -> AppResult<String> {
    Ok("new_token".to_string())
}

// ============================================================================
// Example 15: Comprehensive Error Handling in Main Function
// ============================================================================

/// Example of proper error handling in main function
pub async fn example_main() -> AppResult<()> {
    let config_path = PathBuf::from("config.toml");

    // Load configuration with context
    let config = load_configuration(&config_path)
        .context("Failed during application initialization")?;

    println!("Loaded config: {} bytes", config.len());

    // Authenticate with proper error handling
    let api_key = "example_key_1234567890";
    let _session = authenticate_user(api_key)
        .context("User authentication failed")?;

    // Demonstrate error handling
    if let Err(e) = complex_operation(&config_path, api_key) {
        display_error_to_user(&e);
        handle_error_with_metrics(&e);

        // Decide whether to retry or fail
        if e.is_retryable() {
            eprintln!("Error is retryable, consider retry logic");
        } else {
            return Err(e);
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authentication_errors() {
        let result = authenticate_user("");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::NotAuthenticated));

        let result = authenticate_user("short");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AppError::InvalidToken { .. }));

        let result = authenticate_user("valid_token_12345");
        assert!(result.is_ok());
    }

    #[test]
    fn test_error_display() {
        let error = AppError::FileNotFound {
            path: PathBuf::from("/tmp/missing.txt"),
        };
        let msg = error.user_message();
        assert!(msg.contains("File not found"));
    }

    #[test]
    fn test_error_category() {
        let error = AppError::NetworkError {
            message: "Connection failed".to_string(),
            source: None,
        };
        assert_eq!(error.category(), crate::error::ErrorCategory::Network);
    }
}
