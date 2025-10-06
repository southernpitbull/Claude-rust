//! Validation Utilities
//!
//! Provides comprehensive validation functions for URLs, emails, API keys,
//! and other common data formats used in the application.
//!
//! # Features
//!
//! - URL validation with scheme checking
//! - Email validation with regex
//! - API key format validation
//! - Token validation
//! - Hostname validation
//! - Port number validation
//!
//! # Examples
//!
//! ```rust
//! use claude_code_utils::validation::*;
//!
//! // Validate URLs
//! assert!(is_valid_url("https://example.com"));
//! assert!(!is_valid_url("not-a-url"));
//!
//! // Validate emails
//! assert!(is_valid_email("user@example.com"));
//! assert!(!is_valid_email("invalid-email"));
//!
//! // Validate API keys
//! assert!(is_valid_api_key("sk-1234567890abcdef", Some("sk-")));
//! ```

use regex::Regex;
use std::sync::OnceLock;
use url::Url;

/// Email validation regex pattern (simplified RFC 5322)
static EMAIL_REGEX: OnceLock<Regex> = OnceLock::new();

/// Get or initialize the email validation regex
fn email_regex() -> &'static Regex {
    EMAIL_REGEX.get_or_init(|| {
        Regex::new(
            r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
        ).unwrap()
    })
}

/// Validate a URL string
///
/// Checks if the string is a valid URL with a valid scheme (http/https).
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_url;
///
/// assert!(is_valid_url("https://example.com"));
/// assert!(is_valid_url("http://localhost:8080/path"));
/// assert!(!is_valid_url("not-a-url"));
/// assert!(!is_valid_url("ftp://example.com")); // Only http/https allowed
/// ```
pub fn is_valid_url(url: &str) -> bool {
    match Url::parse(url) {
        Ok(parsed) => {
            let scheme = parsed.scheme();
            scheme == "http" || scheme == "https"
        }
        Err(_) => false,
    }
}

/// Validate a URL string with custom allowed schemes
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_url_with_schemes;
///
/// let schemes = vec!["http", "https", "ftp"];
/// assert!(is_valid_url_with_schemes("ftp://example.com", &schemes));
/// assert!(!is_valid_url_with_schemes("mailto:test@example.com", &schemes));
/// ```
pub fn is_valid_url_with_schemes(url: &str, allowed_schemes: &[&str]) -> bool {
    match Url::parse(url) {
        Ok(parsed) => allowed_schemes.contains(&parsed.scheme()),
        Err(_) => false,
    }
}

/// Validate an email address
///
/// Uses a simplified RFC 5322 regex pattern for validation.
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_email;
///
/// assert!(is_valid_email("user@example.com"));
/// assert!(is_valid_email("first.last@subdomain.example.org"));
/// assert!(!is_valid_email("invalid-email"));
/// assert!(!is_valid_email("@example.com"));
/// assert!(!is_valid_email("user@"));
/// ```
pub fn is_valid_email(email: &str) -> bool {
    if email.is_empty() || email.len() > 254 {
        return false;
    }

    email_regex().is_match(email)
}

/// Validate an API key format
///
/// Checks if the API key:
/// - Is not empty
/// - Has minimum length (if specified)
/// - Has expected prefix (if specified)
/// - Contains only valid characters (alphanumeric, dash, underscore)
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_api_key;
///
/// assert!(is_valid_api_key("sk-1234567890abcdef", Some("sk-")));
/// assert!(is_valid_api_key("api_key_12345", None));
/// assert!(!is_valid_api_key("", None));
/// assert!(!is_valid_api_key("short", Some("sk-")));
/// ```
pub fn is_valid_api_key(key: &str, expected_prefix: Option<&str>) -> bool {
    // Check if empty
    if key.is_empty() {
        return false;
    }

    // Check minimum length (at least 8 characters)
    if key.len() < 8 {
        return false;
    }

    // Check prefix if specified
    if let Some(prefix) = expected_prefix {
        if !key.starts_with(prefix) {
            return false;
        }
    }

    // Check that it contains only valid characters (alphanumeric, dash, underscore)
    key.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

/// Validate an API key with more detailed requirements
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::validate_api_key;
///
/// let result = validate_api_key("sk-1234567890abcdef", Some("sk-"), Some(16), Some(128));
/// assert!(result.is_ok());
///
/// let result = validate_api_key("short", Some("sk-"), Some(16), Some(128));
/// assert!(result.is_err());
/// ```
pub fn validate_api_key(
    key: &str,
    expected_prefix: Option<&str>,
    min_length: Option<usize>,
    max_length: Option<usize>,
) -> Result<(), String> {
    if key.is_empty() {
        return Err("API key cannot be empty".to_string());
    }

    if let Some(min) = min_length {
        if key.len() < min {
            return Err(format!("API key must be at least {} characters", min));
        }
    }

    if let Some(max) = max_length {
        if key.len() > max {
            return Err(format!("API key must be at most {} characters", max));
        }
    }

    if let Some(prefix) = expected_prefix {
        if !key.starts_with(prefix) {
            return Err(format!("API key must start with '{}'", prefix));
        }
    }

    if !key.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("API key contains invalid characters".to_string());
    }

    Ok(())
}

/// Validate a JWT token format (basic structure check)
///
/// Checks if the token has the basic structure of a JWT (three base64 parts separated by dots).
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_jwt_format;
///
/// assert!(is_valid_jwt_format("eyJ.eyJ.SflK"));
/// assert!(!is_valid_jwt_format("not-a-jwt"));
/// assert!(!is_valid_jwt_format("only.two"));
/// ```
pub fn is_valid_jwt_format(token: &str) -> bool {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return false;
    }

    // Check that each part is non-empty and contains valid base64url characters
    parts.iter().all(|part| {
        !part.is_empty() && part.chars().all(|c| {
            c.is_alphanumeric() || c == '-' || c == '_'
        })
    })
}

/// Validate a hostname
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_hostname;
///
/// assert!(is_valid_hostname("example.com"));
/// assert!(is_valid_hostname("sub.example.com"));
/// assert!(is_valid_hostname("localhost"));
/// assert!(!is_valid_hostname(""));
/// assert!(!is_valid_hostname("-invalid.com"));
/// ```
pub fn is_valid_hostname(hostname: &str) -> bool {
    if hostname.is_empty() || hostname.len() > 253 {
        return false;
    }

    let labels: Vec<&str> = hostname.split('.').collect();

    for label in labels {
        if label.is_empty() || label.len() > 63 {
            return false;
        }

        // Label must start and end with alphanumeric
        if !label.chars().next().unwrap().is_alphanumeric()
            || !label.chars().last().unwrap().is_alphanumeric()
        {
            return false;
        }

        // Label can only contain alphanumeric and hyphens
        if !label.chars().all(|c| c.is_alphanumeric() || c == '-') {
            return false;
        }
    }

    true
}

/// Validate a port number
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_port;
///
/// assert!(is_valid_port(80));
/// assert!(is_valid_port(8080));
/// assert!(is_valid_port(65535));
/// assert!(!is_valid_port(0));
/// assert!(!is_valid_port(65536));
/// ```
pub fn is_valid_port(port: u32) -> bool {
    port > 0 && port <= 65535
}

/// Validate a semantic version string
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_semver;
///
/// assert!(is_valid_semver("1.0.0"));
/// assert!(is_valid_semver("1.2.3"));
/// assert!(is_valid_semver("0.1.0"));
/// assert!(!is_valid_semver("1.0"));
/// assert!(!is_valid_semver("v1.0.0"));
/// ```
pub fn is_valid_semver(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() != 3 {
        return false;
    }

    parts.iter().all(|part| part.parse::<u32>().is_ok())
}

/// Validate that a string is non-empty and contains only printable ASCII characters
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_ascii_string;
///
/// assert!(is_valid_ascii_string("Hello World"));
/// assert!(is_valid_ascii_string("test123"));
/// assert!(!is_valid_ascii_string(""));
/// assert!(!is_valid_ascii_string("test\x00"));
/// ```
pub fn is_valid_ascii_string(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|c| c.is_ascii() && !c.is_ascii_control())
}

/// Validate a hexadecimal string
///
/// # Examples
///
/// ```rust
/// use claude_code_utils::validation::is_valid_hex;
///
/// assert!(is_valid_hex("abcdef123"));
/// assert!(is_valid_hex("ABCDEF"));
/// assert!(!is_valid_hex("xyz"));
/// assert!(!is_valid_hex(""));
/// ```
pub fn is_valid_hex(text: &str) -> bool {
    !text.is_empty() && text.chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_url() {
        assert!(is_valid_url("https://example.com"));
        assert!(is_valid_url("http://localhost:8080"));
        assert!(is_valid_url("https://sub.example.com/path?query=1"));
        assert!(!is_valid_url("not-a-url"));
        assert!(!is_valid_url("ftp://example.com"));
        assert!(!is_valid_url(""));
    }

    #[test]
    fn test_is_valid_url_with_schemes() {
        let schemes = vec!["http", "https", "ftp"];
        assert!(is_valid_url_with_schemes("ftp://example.com", &schemes));
        assert!(is_valid_url_with_schemes("https://example.com", &schemes));
        assert!(!is_valid_url_with_schemes("mailto:test@example.com", &schemes));
    }

    #[test]
    fn test_is_valid_email() {
        assert!(is_valid_email("user@example.com"));
        assert!(is_valid_email("first.last@example.com"));
        assert!(is_valid_email("user+tag@example.org"));
        assert!(!is_valid_email("invalid-email"));
        assert!(!is_valid_email("@example.com"));
        assert!(!is_valid_email("user@"));
        assert!(!is_valid_email(""));
        assert!(!is_valid_email("user@example"));
    }

    #[test]
    fn test_is_valid_api_key() {
        assert!(is_valid_api_key("sk-1234567890abcdef", Some("sk-")));
        assert!(is_valid_api_key("api_key_12345678", None));
        assert!(is_valid_api_key("12345678", None));
        assert!(!is_valid_api_key("", None));
        assert!(!is_valid_api_key("short", None));
        assert!(!is_valid_api_key("api-key-12345678", Some("sk-")));
        assert!(!is_valid_api_key("key with spaces", None));
    }

    #[test]
    fn test_validate_api_key() {
        assert!(validate_api_key("sk-1234567890abcdef", Some("sk-"), Some(16), Some(128)).is_ok());
        assert!(validate_api_key("", Some("sk-"), Some(16), Some(128)).is_err());
        assert!(validate_api_key("short", Some("sk-"), Some(16), Some(128)).is_err());
        assert!(validate_api_key("api-key", Some("sk-"), None, None).is_err());
    }

    #[test]
    fn test_is_valid_jwt_format() {
        assert!(is_valid_jwt_format("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"));
        assert!(is_valid_jwt_format("abc.def.ghi"));
        assert!(!is_valid_jwt_format("not-a-jwt"));
        assert!(!is_valid_jwt_format("only.two"));
        assert!(!is_valid_jwt_format("too.many.parts.here"));
    }

    #[test]
    fn test_is_valid_hostname() {
        assert!(is_valid_hostname("example.com"));
        assert!(is_valid_hostname("sub.example.com"));
        assert!(is_valid_hostname("localhost"));
        assert!(is_valid_hostname("my-server"));
        assert!(!is_valid_hostname(""));
        assert!(!is_valid_hostname("-invalid.com"));
        assert!(!is_valid_hostname("invalid-.com"));
    }

    #[test]
    fn test_is_valid_port() {
        assert!(is_valid_port(80));
        assert!(is_valid_port(443));
        assert!(is_valid_port(8080));
        assert!(is_valid_port(65535));
        assert!(!is_valid_port(0));
        assert!(!is_valid_port(65536));
        assert!(!is_valid_port(100000));
    }

    #[test]
    fn test_is_valid_semver() {
        assert!(is_valid_semver("1.0.0"));
        assert!(is_valid_semver("0.1.0"));
        assert!(is_valid_semver("10.20.30"));
        assert!(!is_valid_semver("1.0"));
        assert!(!is_valid_semver("v1.0.0"));
        assert!(!is_valid_semver("1.0.0-beta"));
        assert!(!is_valid_semver(""));
    }

    #[test]
    fn test_is_valid_ascii_string() {
        assert!(is_valid_ascii_string("Hello World"));
        assert!(is_valid_ascii_string("test123"));
        assert!(is_valid_ascii_string("!@#$%"));
        assert!(!is_valid_ascii_string(""));
        assert!(!is_valid_ascii_string("test\x00control"));
        assert!(!is_valid_ascii_string("emoji🎉"));
    }

    #[test]
    fn test_is_valid_hex() {
        assert!(is_valid_hex("abcdef"));
        assert!(is_valid_hex("ABCDEF"));
        assert!(is_valid_hex("123456"));
        assert!(is_valid_hex("0123456789abcdefABCDEF"));
        assert!(!is_valid_hex("xyz"));
        assert!(!is_valid_hex(""));
        assert!(!is_valid_hex("abcdefg"));
    }
}
