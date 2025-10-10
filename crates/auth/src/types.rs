//! Authentication Types
//!
//! Core type definitions for authentication functionality.

use claude_code_core::types::ProviderType;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Provider credentials
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCredentials {
    pub provider: ProviderType,
    pub credentials: Credentials,
}

/// Credentials enum
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Credentials {
    ApiKey { api_key: String },
    OAuth { client_id: String, client_secret: Option<String> },
}

/// Authentication methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    /// API key authentication
    #[serde(rename = "api_key")]
    ApiKey,

    /// OAuth authentication
    #[serde(rename = "oauth")]
    OAuth,

    /// No authentication required (for local providers)
    #[serde(rename = "none")]
    None,
}

impl fmt::Display for AuthMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::ApiKey => write!(f, "api_key"),
            Self::OAuth => write!(f, "oauth"),
            Self::None => write!(f, "none"),
        }
    }
}

/// Authentication states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthState {
    /// Initial state
    Initial,

    /// Authentication in progress
    Authenticating,

    /// Successfully authenticated
    Authenticated,

    /// Authentication failed
    Failed,

    /// Refreshing authentication
    Refreshing,

    /// Expired authentication
    Expired,

    /// Unauthenticated state
    Unauthenticated,
}

impl fmt::Display for AuthState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Initial => write!(f, "initial"),
            Self::Authenticating => write!(f, "authenticating"),
            Self::Authenticated => write!(f, "authenticated"),
            Self::Failed => write!(f, "failed"),
            Self::Refreshing => write!(f, "refreshing"),
            Self::Expired => write!(f, "expired"),
            Self::Unauthenticated => write!(f, "unauthenticated"),
        }
    }
}

/// OAuth configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    /// Client ID
    pub client_id: String,

    /// Client secret (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_secret: Option<String>,

    /// Authorization endpoint
    pub authorization_endpoint: String,

    /// Token endpoint
    pub token_endpoint: String,

    /// Redirect URI
    pub redirect_uri: String,

    /// Requested scopes
    pub scopes: Vec<String>,

    /// Response type
    pub response_type: String,

    /// Whether to use PKCE
    #[serde(default)]
    pub use_pkce: bool,
}

/// Authentication manager configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// API key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,

    /// OAuth configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oauth: Option<OAuthConfig>,

    /// Preferred authentication method
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_method: Option<AuthMethod>,

    /// Auto-refresh tokens
    #[serde(default = "default_auto_refresh")]
    pub auto_refresh: bool,

    /// Token refresh threshold in seconds
    #[serde(default = "default_refresh_threshold")]
    pub token_refresh_threshold: i64,

    /// Maximum retry attempts
    #[serde(default = "default_max_retry")]
    pub max_retry_attempts: u32,
}

fn default_auto_refresh() -> bool {
    true
}

fn default_refresh_threshold() -> i64 {
    300 // 5 minutes
}

fn default_max_retry() -> u32 {
    3
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            api_key: None,
            oauth: None,
            preferred_method: None,
            auto_refresh: true,
            token_refresh_threshold: 300,
            max_retry_attempts: 3,
        }
    }
}

/// Token details for display
#[derive(Debug, Clone)]
pub struct TokenDetails {
    pub token_type: String,
    pub expires: String,
    pub expires_in: String,
    pub scope: String,
    pub access_token_masked: String,
    pub id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_method_serialization() {
        let method = AuthMethod::ApiKey;
        let json = serde_json::to_string(&method).unwrap();
        assert_eq!(json, r#""api_key""#);
    }

    #[test]
    fn test_auth_state_display() {
        assert_eq!(AuthState::Authenticated.to_string(), "authenticated");
        assert_eq!(AuthState::Failed.to_string(), "failed");
    }

    #[test]
    fn test_all_auth_methods_serialization() {
        assert_eq!(
            serde_json::to_string(&AuthMethod::ApiKey).unwrap(),
            r#""api_key""#
        );
        assert_eq!(
            serde_json::to_string(&AuthMethod::OAuth).unwrap(),
            r#""oauth""#
        );
        assert_eq!(
            serde_json::to_string(&AuthMethod::None).unwrap(),
            r#""none""#
        );
    }

    #[test]
    fn test_auth_method_deserialization() {
        let method: AuthMethod = serde_json::from_str(r#""api_key""#).unwrap();
        assert_eq!(method, AuthMethod::ApiKey);

        let method: AuthMethod = serde_json::from_str(r#""oauth""#).unwrap();
        assert_eq!(method, AuthMethod::OAuth);
    }

    #[test]
    fn test_all_auth_states() {
        let states = vec![
            AuthState::Initial,
            AuthState::Authenticating,
            AuthState::Authenticated,
            AuthState::Failed,
            AuthState::Refreshing,
            AuthState::Expired,
            AuthState::Unauthenticated,
        ];

        for state in states {
            let json = serde_json::to_string(&state).unwrap();
            let deserialized: AuthState = serde_json::from_str(&json).unwrap();
            assert_eq!(state, deserialized);
        }
    }

    #[test]
    fn test_auth_config_default() {
        let config = AuthConfig::default();
        assert!(config.api_key.is_none());
        assert!(config.oauth.is_none());
        assert!(config.auto_refresh);
        assert_eq!(config.token_refresh_threshold, 300);
        assert_eq!(config.max_retry_attempts, 3);
    }

    #[test]
    fn test_auth_config_serialization() {
        let mut config = AuthConfig::default();
        config.api_key = Some("test_key".to_string());

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: AuthConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.api_key, Some("test_key".to_string()));
        assert_eq!(deserialized.auto_refresh, config.auto_refresh);
    }

    #[test]
    fn test_oauth_config_serialization() {
        let config = OAuthConfig {
            client_id: "test_client".to_string(),
            client_secret: Some("secret".to_string()),
            authorization_endpoint: "https://auth.example.com/authorize".to_string(),
            token_endpoint: "https://auth.example.com/token".to_string(),
            redirect_uri: "http://localhost:8080/callback".to_string(),
            scopes: vec!["read".to_string(), "write".to_string()],
            response_type: "code".to_string(),
            use_pkce: true,
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: OAuthConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.client_id, config.client_id);
        assert_eq!(deserialized.use_pkce, true);
        assert_eq!(deserialized.scopes.len(), 2);
    }

    #[test]
    fn test_credentials_enum_api_key() {
        let creds = Credentials::ApiKey {
            api_key: "test_key_123".to_string(),
        };

        let json = serde_json::to_string(&creds).unwrap();
        assert!(json.contains("apikey"));
        assert!(json.contains("test_key_123"));

        let deserialized: Credentials = serde_json::from_str(&json).unwrap();
        if let Credentials::ApiKey { api_key } = deserialized {
            assert_eq!(api_key, "test_key_123");
        } else {
            panic!("Expected ApiKey variant");
        }
    }

    #[test]
    fn test_credentials_enum_oauth() {
        let creds = Credentials::OAuth {
            client_id: "client_123".to_string(),
            client_secret: Some("secret_456".to_string()),
        };

        let json = serde_json::to_string(&creds).unwrap();
        let deserialized: Credentials = serde_json::from_str(&json).unwrap();

        if let Credentials::OAuth {
            client_id,
            client_secret,
        } = deserialized
        {
            assert_eq!(client_id, "client_123");
            assert_eq!(client_secret, Some("secret_456".to_string()));
        } else {
            panic!("Expected OAuth variant");
        }
    }

    #[test]
    fn test_provider_credentials() {
        let creds = ProviderCredentials {
            provider: ProviderType::Claude,
            credentials: Credentials::ApiKey {
                api_key: "key".to_string(),
            },
        };

        let json = serde_json::to_string(&creds).unwrap();
        let deserialized: ProviderCredentials = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.provider, ProviderType::Claude);
    }

    #[test]
    fn test_auth_method_display() {
        assert_eq!(AuthMethod::ApiKey.to_string(), "api_key");
        assert_eq!(AuthMethod::OAuth.to_string(), "oauth");
        assert_eq!(AuthMethod::None.to_string(), "none");
    }

    #[test]
    fn test_auth_state_equality() {
        assert_eq!(AuthState::Authenticated, AuthState::Authenticated);
        assert_ne!(AuthState::Authenticated, AuthState::Failed);
    }
}
