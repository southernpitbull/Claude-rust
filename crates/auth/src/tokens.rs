use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Authentication token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_token: Option<String>,

    pub expires_at: i64,
    pub token_type: String,
    pub scope: String,
}

impl AuthToken {
    /// Create a new token from an API key (never expires)
    pub fn new_api_key(api_key: String) -> Self {
        Self {
            access_token: api_key,
            refresh_token: None,
            expires_at: i64::MAX, // Never expires
            token_type: "api_key".to_string(),
            scope: "all".to_string(),
        }
    }

    /// Create a new OAuth token
    pub fn new_oauth(
        access_token: String,
        refresh_token: Option<String>,
        expires_in: i64,
    ) -> Self {
        Self {
            access_token,
            refresh_token,
            expires_at: Utc::now().timestamp() + expires_in,
            token_type: "Bearer".to_string(),
            scope: "all".to_string(),
        }
    }

    /// Check if the token is expired
    pub fn is_expired(&self) -> bool {
        let now = Utc::now().timestamp();
        now >= self.expires_at
    }

    /// Check if the token will expire soon (within 5 minutes)
    pub fn expires_soon(&self) -> bool {
        let now = Utc::now().timestamp();
        let five_minutes = 5 * 60;
        now + five_minutes >= self.expires_at
    }

    /// Get time until expiration in seconds
    pub fn time_until_expiration(&self) -> i64 {
        self.expires_at - Utc::now().timestamp()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_expiration() {
        let expired_token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() - 3600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        assert!(expired_token.is_expired());
    }

    #[test]
    fn test_token_not_expired() {
        let valid_token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + 3600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        assert!(!valid_token.is_expired());
    }

    #[test]
    fn test_expires_soon() {
        // Token expiring in 2 minutes (should be "soon")
        let soon_token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + 120,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        assert!(soon_token.expires_soon());

        // Token expiring in 10 minutes (should not be "soon")
        let not_soon_token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + 600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        assert!(!not_soon_token.expires_soon());
    }

    #[test]
    fn test_time_until_expiration() {
        let token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + 3600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        let time_left = token.time_until_expiration();
        // Should be approximately 3600 seconds (allow some margin for test execution)
        assert!(time_left > 3590 && time_left <= 3600);
    }

    #[test]
    fn test_token_with_refresh() {
        let token = AuthToken {
            access_token: "access_token_123".to_string(),
            refresh_token: Some("refresh_token_456".to_string()),
            expires_at: Utc::now().timestamp() + 3600,
            token_type: "Bearer".to_string(),
            scope: "read write".to_string(),
        };

        assert!(token.refresh_token.is_some());
        assert_eq!(token.refresh_token.unwrap(), "refresh_token_456");
    }

    #[test]
    fn test_token_serialization() {
        let token = AuthToken {
            access_token: "test_token".to_string(),
            refresh_token: Some("refresh".to_string()),
            expires_at: 1234567890,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        // Serialize
        let json = serde_json::to_string(&token).unwrap();
        assert!(json.contains("test_token"));
        assert!(json.contains("Bearer"));

        // Deserialize
        let deserialized: AuthToken = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.access_token, token.access_token);
        assert_eq!(deserialized.expires_at, token.expires_at);
    }

    #[test]
    fn test_token_without_refresh() {
        let token = AuthToken {
            access_token: "access_only".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() + 3600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        assert!(token.refresh_token.is_none());

        // When serialized, refresh_token should be omitted
        let json = serde_json::to_string(&token).unwrap();
        assert!(!json.contains("refresh_token"));
    }

    #[test]
    fn test_expired_token_time_until_expiration() {
        let token = AuthToken {
            access_token: "test".to_string(),
            refresh_token: None,
            expires_at: Utc::now().timestamp() - 3600,
            token_type: "Bearer".to_string(),
            scope: "read".to_string(),
        };

        let time_left = token.time_until_expiration();
        assert!(time_left < 0); // Should be negative for expired token
    }
}
