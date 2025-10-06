# Error Handling System Design

## Overview

This document describes the comprehensive error handling system designed for the Claude Code Rust refactoring. The system is built on Rust's error handling best practices using `thiserror` for error definitions and provides a hierarchical, contextual, and user-friendly error system.

## Location

The error handling module is located at:
```
crates/core/src/error.rs
```

## Key Components

### 1. AppError Enum

The primary error type that encompasses all possible errors in the application. It is organized into logical categories:

#### Authentication Errors
- `AuthenticationFailed` - Authentication with AI provider failed
- `OAuthFailed` - OAuth flow failed or was cancelled
- `InvalidToken` - Token is invalid, expired, or revoked
- `CredentialStorageError` - Failed to store or retrieve credentials
- `NotAuthenticated` - User is not authenticated
- `SessionExpired` - Session has expired

#### AI Provider Errors
- `AiProviderError` - AI provider API error with optional status code
- `RateLimitExceeded` - Rate limit exceeded with optional retry duration
- `ModelNotAvailable` - Model not available or not supported
- `InvalidModelResponse` - Invalid response from AI model
- `ContextLengthExceeded` - Context length exceeded
- `StreamError` - Streaming error with provider context

#### Network Errors
- `NetworkError` - Generic network request failed
- `ConnectionTimeout` - Connection timeout with duration
- `DnsResolutionFailed` - DNS resolution failed
- `TlsError` - TLS/SSL error
- `ProxyError` - Proxy error

#### Configuration Errors
- `ConfigNotFound` - Configuration file not found
- `InvalidConfig` - Invalid configuration with field context
- `ConfigParseError` - Failed to parse configuration file
- `MissingConfig` - Missing required configuration

#### IO Errors
- `FileNotFound` - File not found with path
- `PermissionDenied` - Permission denied with path and operation
- `FileReadError` - Failed to read file
- `FileWriteError` - Failed to write file
- `DirectoryCreationError` - Failed to create directory
- `IoError` - Generic IO error

#### Terminal Errors
- `TerminalInitError` - Terminal initialization failed
- `TerminalNotSupported` - Terminal not supported
- `TerminalSizeError` - Failed to detect terminal size
- `TerminalInputError` - Terminal input error
- `TerminalOutputError` - Terminal output error

#### Validation Errors
- `InvalidInput` - Invalid input provided
- `ValidationFailed` - Validation failed with field and reason
- `JsonParseError` - JSON parsing error
- `SerializationError` - Serialization error

#### Command Execution Errors
- `CommandExecutionFailed` - Command execution failed with exit code
- `CommandNotFound` - Command not found
- `CommandTimeout` - Command timeout

#### Application Errors
- `NotImplemented` - Feature not yet implemented
- `Internal` - Internal error (should not happen)
- `Cancelled` - Operation cancelled by user
- `ResourceNotFound` - Resource not found
- `ResourceAlreadyExists` - Resource already exists
- `InitializationFailed` - Initialization failed

### 2. AppResult<T> Type Alias

A convenient type alias for `Result<T, AppError>` used throughout the application:

```rust
pub type AppResult<T> = Result<T, AppError>;
```

### 3. ErrorCategory Enum

An enum for classifying errors into broad categories for metrics and logging:

- `Authentication`
- `AiProvider`
- `Network`
- `Configuration`
- `Io`
- `Terminal`
- `Validation`
- `CommandExecution`
- `Application`

### 4. ErrorContext Trait

An extension trait for adding context to errors:

```rust
pub trait ErrorContext<T> {
    fn context<C>(self, context: C) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static;

    fn with_context<C, F>(self, f: F) -> AppResult<T>
    where
        C: fmt::Display + Send + Sync + 'static,
        F: FnOnce() -> C;
}
```

## Key Features

### 1. Hierarchical Organization

Errors are organized by domain (Authentication, AI Provider, Network, etc.), making it easy to understand the source of errors.

### 2. Rich Context

Each error variant includes relevant context:
- Provider names for authentication and AI errors
- File paths for IO errors
- Status codes for network errors
- Duration for timeout errors
- Reasons and messages for all errors

### 3. User-Friendly Messages

The `user_message()` method provides actionable, user-friendly error messages:

```rust
let error = AppError::NotAuthenticated;
let msg = error.user_message();
// Returns: "You are not authenticated. Please run the authentication flow."
```

### 4. Resolution Steps

The `resolution_steps()` method provides step-by-step guidance for resolving errors:

```rust
let error = AppError::ConnectionTimeout { ... };
let steps = error.resolution_steps();
// Returns:
// [
//   "1. Check your internet connection",
//   "2. Verify firewall settings",
//   "3. Try again in a few moments"
// ]
```

### 5. Retryability Detection

The `is_retryable()` method identifies transient errors that can be retried:

```rust
let error = AppError::ConnectionTimeout { ... };
if error.is_retryable() {
    // Implement retry logic
}
```

Retryable errors include:
- Network errors (timeout, DNS resolution)
- Rate limit errors
- Server errors (5xx status codes)
- Command timeouts
- Session expiry

### 6. Error Categorization

The `category()` method returns the error category for classification and metrics:

```rust
let error = AppError::AuthenticationFailed { ... };
let category = error.category();
// Returns: ErrorCategory::Authentication
```

### 7. Automatic Error Conversion

Implements `From` trait for common error types:
- `std::io::Error`
- `serde_json::Error`
- `std::string::FromUtf8Error`

### 8. Error Chaining

Supports error cause chains using `#[source]` attribute from `thiserror`:

```rust
#[error("Failed to read file: {}", path.display())]
FileReadError {
    path: PathBuf,
    #[source]
    source: io::Error,
}
```

## Helper Functions

### io_error_with_path

Creates an IO error with specific path context:

```rust
pub fn io_error_with_path(err: io::Error, path: PathBuf) -> AppError
```

### network_error

Creates a network error from a generic error source:

```rust
pub fn network_error<E>(message: impl Into<String>, source: E) -> AppError
where
    E: std::error::Error + Send + Sync + 'static
```

## Usage Examples

### Basic Error Creation

```rust
fn authenticate_user(token: &str) -> AppResult<String> {
    if token.is_empty() {
        return Err(AppError::NotAuthenticated);
    }
    Ok("authenticated".to_string())
}
```

### Automatic Error Conversion

```rust
fn read_config(path: &PathBuf) -> AppResult<String> {
    // IO errors automatically converted to AppError
    let contents = fs::read_to_string(path)?;
    Ok(contents)
}
```

### Adding Context

```rust
fn load_config(path: &PathBuf) -> AppResult<String> {
    fs::read_to_string(path)
        .map_err(|e| io_error_with_path(e, path.clone()))
        .context("Failed to load application configuration")?;
    Ok("config".to_string())
}
```

### Lazy Context Evaluation

```rust
fn process_file(path: &PathBuf) -> AppResult<Vec<u8>> {
    fs::read(path)
        .map_err(|e| io_error_with_path(e, path.clone()))
        .with_context(|| {
            // Only called on error
            format!("Failed to process file at {}", path.display())
        })
}
```

### Retry Logic

```rust
async fn fetch_with_retry(url: &str, max_retries: u32) -> AppResult<String> {
    let mut attempts = 0;
    loop {
        match fetch_data(url).await {
            Ok(data) => return Ok(data),
            Err(e) if e.is_retryable() && attempts < max_retries => {
                attempts += 1;
                let delay = std::time::Duration::from_secs(2u64.pow(attempts));
                tokio::time::sleep(delay).await;
            }
            Err(e) => return Err(e),
        }
    }
}
```

### Error Classification for Metrics

```rust
fn handle_error_with_metrics(error: &AppError) {
    let category = error.category();
    match category {
        ErrorCategory::Network => {
            // Increment network error counter
        }
        ErrorCategory::Authentication => {
            // Alert security team
        }
        _ => {
            // General error handling
        }
    }
}
```

### User-Friendly Error Display

```rust
fn display_error_to_user(error: &AppError) {
    let user_msg = error.user_message();
    println!("Error: {}", user_msg);

    let steps = error.resolution_steps();
    if !steps.is_empty() {
        println!("\nHow to resolve:");
        for step in steps {
            println!("  {}", step);
        }
    }
}
```

### Rate Limit Handling

```rust
async fn handle_rate_limited_request(provider: &str) -> AppResult<String> {
    match make_api_request(provider).await {
        Err(AppError::RateLimitExceeded { retry_after: Some(duration), .. }) => {
            tokio::time::sleep(duration).await;
            make_api_request(provider).await
        }
        result => result,
    }
}
```

### Session Expiry Handling

```rust
async fn authenticated_operation(token: &str) -> AppResult<String> {
    match perform_operation(token).await {
        Err(AppError::SessionExpired { .. }) => {
            let new_token = re_authenticate().await?;
            perform_operation(&new_token).await
        }
        result => result,
    }
}
```

## Best Practices

### 1. Use Specific Error Variants

Always use the most specific error variant available:

```rust
// Good
Err(AppError::FileNotFound { path: path.clone() })

// Avoid
Err(AppError::Internal { message: "file not found".to_string(), source: None })
```

### 2. Include Context

Provide rich context in errors:

```rust
// Good
Err(AppError::InvalidConfig {
    reason: "port must be between 1 and 65535".to_string(),
    field: Some("port".to_string()),
})

// Avoid
Err(AppError::InvalidConfig {
    reason: "invalid port".to_string(),
    field: None,
})
```

### 3. Chain Errors

Use error chaining to preserve the full error context:

```rust
fs::read_to_string(path)
    .map_err(|e| AppError::FileReadError { path: path.clone(), source: e })?
```

### 4. Add Context Layers

Add contextual information as errors propagate:

```rust
fn outer() -> AppResult<()> {
    inner().context("Failed to complete outer operation")?;
    Ok(())
}
```

### 5. Handle Retryable Errors

Always check if an error is retryable before failing:

```rust
match operation() {
    Err(e) if e.is_retryable() => {
        // Implement retry logic
    }
    result => result,
}
```

### 6. Display User-Friendly Messages

When showing errors to users, use `user_message()` and `resolution_steps()`:

```rust
if let Err(e) = operation() {
    eprintln!("{}", e.user_message());
    for step in e.resolution_steps() {
        eprintln!("  {}", step);
    }
}
```

## Testing

The error module includes comprehensive tests for:

- Error categorization
- Retryability detection
- Display messages
- User messages
- Resolution steps
- Error context
- Error conversions
- Category display

Run tests with:

```bash
cargo test --package claude-code-core
```

## Integration with Other Crates

The error types are designed to be used across all crates in the workspace:

```rust
// In other crates
use claude_code_core::{AppError, AppResult, ErrorContext};

fn some_function() -> AppResult<()> {
    // Use error types
    Ok(())
}
```

## Future Enhancements

Potential future improvements:

1. **Error Codes**: Add unique error codes for each variant
2. **Telemetry Integration**: Automatic error reporting to telemetry systems
3. **I18n Support**: Internationalization of error messages
4. **Error Recovery**: Automatic recovery strategies for retryable errors
5. **Error Aggregation**: Collecting multiple errors in batch operations
6. **Custom Error Handlers**: Plugin system for custom error handling

## Dependencies

The error system uses:

- `thiserror` - For deriving Error trait implementations
- `chrono` - For timestamp handling in SessionExpired
- Standard library types (`std::io`, `std::fmt`, `std::path`, etc.)

## References

- [Rust Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)
- [thiserror documentation](https://docs.rs/thiserror)
- [anyhow vs thiserror](https://nick.groenen.me/posts/rust-error-handling/)
