//! PKCE (Proof Key for Code Exchange) Implementation
//!
//! Implements RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients
//! This module provides secure code verifier and challenge generation for OAuth flows.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{distributions::Alphanumeric, thread_rng, Rng};
use sha2::{Digest, Sha256};
use std::fmt;

/// PKCE challenge methods as defined in RFC 7636
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChallengeMethod {
    /// Plain text challenge (not recommended for production)
    Plain,
    /// SHA256 hash challenge (recommended)
    S256,
}

impl fmt::Display for ChallengeMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Plain => write!(f, "plain"),
            Self::S256 => write!(f, "S256"),
        }
    }
}

impl ChallengeMethod {
    /// Returns the string representation as required by OAuth spec
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Plain => "plain",
            Self::S256 => "S256",
        }
    }
}

/// PKCE parameters containing verifier and challenge
#[derive(Debug, Clone)]
pub struct PkceParams {
    /// Code verifier - random string stored by client
    pub code_verifier: String,
    /// Code challenge - derived from verifier
    pub code_challenge: String,
    /// Challenge method used
    pub challenge_method: ChallengeMethod,
}

impl PkceParams {
    /// Generates new PKCE parameters with S256 challenge method
    ///
    /// # Arguments
    ///
    /// * `length` - Length of the code verifier (43-128 characters per RFC 7636)
    ///
    /// # Returns
    ///
    /// Returns `PkceParams` with generated verifier and S256 challenge
    ///
    /// # Panics
    ///
    /// Panics if length is not between 43 and 128 characters
    ///
    /// # Examples
    ///
    /// ```
    /// use claude_rust_auth::pkce::PkceParams;
    ///
    /// let params = PkceParams::new(64);
    /// assert_eq!(params.code_verifier.len(), 64);
    /// ```
    pub fn new(length: usize) -> Self {
        Self::new_with_method(length, ChallengeMethod::S256)
    }

    /// Generates new PKCE parameters with specified challenge method
    ///
    /// # Arguments
    ///
    /// * `length` - Length of the code verifier (43-128 characters per RFC 7636)
    /// * `method` - Challenge method to use (Plain or S256)
    ///
    /// # Returns
    ///
    /// Returns `PkceParams` with generated verifier and challenge
    ///
    /// # Panics
    ///
    /// Panics if length is not between 43 and 128 characters
    pub fn new_with_method(length: usize, method: ChallengeMethod) -> Self {
        assert!(
            length >= 43 && length <= 128,
            "Code verifier length must be between 43 and 128 characters (RFC 7636)"
        );

        let code_verifier = generate_code_verifier(length);
        let code_challenge = generate_code_challenge(&code_verifier, method);

        Self {
            code_verifier,
            code_challenge,
            challenge_method: method,
        }
    }

    /// Creates PKCE parameters from an existing code verifier
    ///
    /// # Arguments
    ///
    /// * `verifier` - Existing code verifier string
    /// * `method` - Challenge method to use
    ///
    /// # Returns
    ///
    /// Returns `PkceParams` with the provided verifier and derived challenge
    pub fn from_verifier(verifier: String, method: ChallengeMethod) -> Self {
        let code_challenge = generate_code_challenge(&verifier, method);

        Self {
            code_verifier: verifier,
            code_challenge,
            challenge_method: method,
        }
    }
}

/// Generates a cryptographically secure random code verifier
///
/// The code verifier is a high-entropy cryptographic random string using the
/// unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
///
/// # Arguments
///
/// * `length` - Length of the verifier (43-128 characters per RFC 7636)
///
/// # Returns
///
/// Returns a random alphanumeric string of the specified length
///
/// # Examples
///
/// ```
/// use claude_rust_auth::pkce::generate_code_verifier;
///
/// let verifier = generate_code_verifier(64);
/// assert_eq!(verifier.len(), 64);
/// assert!(verifier.chars().all(|c| c.is_alphanumeric()));
/// ```
pub fn generate_code_verifier(length: usize) -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

/// Generates a code challenge from a verifier using the specified method
///
/// # Arguments
///
/// * `verifier` - The code verifier string
/// * `method` - Challenge method (Plain or S256)
///
/// # Returns
///
/// Returns the code challenge string
///
/// # Examples
///
/// ```
/// use claude_rust_auth::pkce::{generate_code_challenge, ChallengeMethod};
///
/// let verifier = "test_verifier_12345";
/// let challenge = generate_code_challenge(verifier, ChallengeMethod::S256);
/// assert!(!challenge.is_empty());
/// ```
pub fn generate_code_challenge(verifier: &str, method: ChallengeMethod) -> String {
    match method {
        ChallengeMethod::Plain => verifier.to_string(),
        ChallengeMethod::S256 => {
            let mut hasher = Sha256::new();
            hasher.update(verifier.as_bytes());
            let hash = hasher.finalize();
            URL_SAFE_NO_PAD.encode(hash)
        }
    }
}

/// Verifies that a code verifier matches a code challenge
///
/// This is typically used by the authorization server, but can be useful
/// for testing and validation.
///
/// # Arguments
///
/// * `verifier` - The code verifier to check
/// * `challenge` - The code challenge to verify against
/// * `method` - The challenge method used
///
/// # Returns
///
/// Returns `true` if the verifier matches the challenge, `false` otherwise
///
/// # Examples
///
/// ```
/// use claude_rust_auth::pkce::{generate_code_verifier, generate_code_challenge, verify_challenge, ChallengeMethod};
///
/// let verifier = generate_code_verifier(64);
/// let challenge = generate_code_challenge(&verifier, ChallengeMethod::S256);
/// assert!(verify_challenge(&verifier, &challenge, ChallengeMethod::S256));
/// ```
pub fn verify_challenge(verifier: &str, challenge: &str, method: ChallengeMethod) -> bool {
    let computed_challenge = generate_code_challenge(verifier, method);
    computed_challenge == challenge
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_code_verifier_length() {
        let verifier = generate_code_verifier(64);
        assert_eq!(verifier.len(), 64);
    }

    #[test]
    fn test_generate_code_verifier_characters() {
        let verifier = generate_code_verifier(64);
        assert!(verifier.chars().all(|c| c.is_alphanumeric()));
    }

    #[test]
    fn test_generate_code_verifier_uniqueness() {
        let verifier1 = generate_code_verifier(64);
        let verifier2 = generate_code_verifier(64);
        assert_ne!(verifier1, verifier2);
    }

    #[test]
    fn test_code_challenge_plain() {
        let verifier = "test_verifier_12345";
        let challenge = generate_code_challenge(verifier, ChallengeMethod::Plain);
        assert_eq!(challenge, verifier);
    }

    #[test]
    fn test_code_challenge_s256() {
        let verifier = "test_verifier_12345";
        let challenge = generate_code_challenge(verifier, ChallengeMethod::S256);
        assert_ne!(challenge, verifier);
        assert!(!challenge.contains('='));
        assert!(!challenge.contains('+'));
        assert!(!challenge.contains('/'));
    }

    #[test]
    fn test_code_challenge_s256_deterministic() {
        let verifier = "test_verifier_12345";
        let challenge1 = generate_code_challenge(verifier, ChallengeMethod::S256);
        let challenge2 = generate_code_challenge(verifier, ChallengeMethod::S256);
        assert_eq!(challenge1, challenge2);
    }

    #[test]
    fn test_verify_challenge_plain() {
        let verifier = "test_verifier_12345";
        let challenge = generate_code_challenge(verifier, ChallengeMethod::Plain);
        assert!(verify_challenge(verifier, &challenge, ChallengeMethod::Plain));
    }

    #[test]
    fn test_verify_challenge_s256() {
        let verifier = "test_verifier_12345";
        let challenge = generate_code_challenge(verifier, ChallengeMethod::S256);
        assert!(verify_challenge(verifier, &challenge, ChallengeMethod::S256));
    }

    #[test]
    fn test_verify_challenge_invalid() {
        let verifier = "test_verifier_12345";
        let challenge = "invalid_challenge";
        assert!(!verify_challenge(verifier, challenge, ChallengeMethod::S256));
    }

    #[test]
    fn test_pkce_params_new() {
        let params = PkceParams::new(64);
        assert_eq!(params.code_verifier.len(), 64);
        assert!(!params.code_challenge.is_empty());
        assert_eq!(params.challenge_method, ChallengeMethod::S256);
    }

    #[test]
    fn test_pkce_params_new_with_method_plain() {
        let params = PkceParams::new_with_method(64, ChallengeMethod::Plain);
        assert_eq!(params.code_verifier, params.code_challenge);
        assert_eq!(params.challenge_method, ChallengeMethod::Plain);
    }

    #[test]
    fn test_pkce_params_new_with_method_s256() {
        let params = PkceParams::new_with_method(64, ChallengeMethod::S256);
        assert_ne!(params.code_verifier, params.code_challenge);
        assert_eq!(params.challenge_method, ChallengeMethod::S256);
    }

    #[test]
    #[should_panic(expected = "Code verifier length must be between 43 and 128 characters")]
    fn test_pkce_params_new_too_short() {
        PkceParams::new(42);
    }

    #[test]
    #[should_panic(expected = "Code verifier length must be between 43 and 128 characters")]
    fn test_pkce_params_new_too_long() {
        PkceParams::new(129);
    }

    #[test]
    fn test_pkce_params_from_verifier() {
        let verifier = generate_code_verifier(64);
        let params = PkceParams::from_verifier(verifier.clone(), ChallengeMethod::S256);
        assert_eq!(params.code_verifier, verifier);
        assert!(verify_challenge(
            &params.code_verifier,
            &params.code_challenge,
            params.challenge_method
        ));
    }

    #[test]
    fn test_challenge_method_display() {
        assert_eq!(ChallengeMethod::Plain.to_string(), "plain");
        assert_eq!(ChallengeMethod::S256.to_string(), "S256");
    }

    #[test]
    fn test_challenge_method_as_str() {
        assert_eq!(ChallengeMethod::Plain.as_str(), "plain");
        assert_eq!(ChallengeMethod::S256.as_str(), "S256");
    }

    #[test]
    fn test_pkce_params_validation() {
        let params = PkceParams::new(64);
        assert!(verify_challenge(
            &params.code_verifier,
            &params.code_challenge,
            params.challenge_method
        ));
    }

    #[test]
    fn test_minimum_length_verifier() {
        let params = PkceParams::new(43);
        assert_eq!(params.code_verifier.len(), 43);
    }

    #[test]
    fn test_maximum_length_verifier() {
        let params = PkceParams::new(128);
        assert_eq!(params.code_verifier.len(), 128);
    }
}
