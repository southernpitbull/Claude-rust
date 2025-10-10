//! OAuth Credential File Loading
//!
//! This module provides functionality to load OAuth credentials from files in user directories.
//! Supports loading from:
//! - C:\Users\%username%\.claude\.credentials.json
//! - C:\Users\%username%\.gemini\.credentials.json
//! - C:\Users\%username%\.qwen\.credentials.json
//! - And their oauth_creds.json equivalents

use crate::error::{AuthError, AuthResult};
use crate::tokens::AuthToken;
use claude_code_core::types::ProviderType;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tracing::{debug, info, warn};

/// Schema for .credentials.json files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialsFileSchema {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>, // ISO8601 timestamp
    pub token_type: Option<String>,
    pub scope: Option<String>,
}

/// Schema for oauth_creds.json files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OauthCredsFileSchema {
    pub provider: String,
    pub account: Option<String>,
    pub credentials: CredentialsFileSchema,
}

/// OAuth Credential File Loader
pub struct OAuthCredentialFileLoader;

impl OAuthCredentialFileLoader {
    /// Creates a new credential file loader
    pub fn new() -> Self {
        Self
    }

    /// Load credentials from files in user directories
    pub fn load_credentials(&self) -> AuthResult<HashMap<ProviderType, Vec<AuthToken>>> {
        let mut all_credentials = HashMap::new();

        // Get user directories
        let user_dir = dirs::home_dir()
            .ok_or_else(|| AuthError::ConfigurationError("Could not determine user directory".to_string()))?;

        // Load credentials for each provider
        self.load_provider_credentials(&user_dir, ProviderType::Claude, &mut all_credentials)?;
        self.load_provider_credentials(&user_dir, ProviderType::Gemini, &mut all_credentials)?;
        self.load_provider_credentials(&user_dir, ProviderType::Qwen, &mut all_credentials)?;

        Ok(all_credentials)
    }

    /// Load credentials for a specific provider
    fn load_provider_credentials(
        &self,
        user_dir: &PathBuf,
        provider: ProviderType,
        all_credentials: &mut HashMap<ProviderType, Vec<AuthToken>>,
    ) -> AuthResult<()> {
        let provider_name = self.provider_to_dir_name(&provider);
        let provider_dir = user_dir.join(format!(".{}", provider_name));

        if !provider_dir.exists() {
            debug!("Provider directory does not exist: {}", provider_dir.display());
            return Ok(());
        }

        // Look for credential files in the provider directory
        let credential_files = vec![
            provider_dir.join(".credentials.json"),
            provider_dir.join("oauth_creds.json"),
        ];

        let mut provider_tokens = Vec::new();

        for cred_file in credential_files {
            if cred_file.exists() {
                debug!("Found credential file: {}", cred_file.display());
                
                // Determine file type and load accordingly
                if cred_file.file_name().unwrap_or_default() == ".credentials.json" {
                    if let Ok(tokens) = self.load_credentials_file(&cred_file, provider) {
                        provider_tokens.extend(tokens);
                    }
                } else if cred_file.file_name().unwrap_or_default() == "oauth_creds.json" {
                    if let Ok(tokens) = self.load_oauth_creds_file(&cred_file, provider) {
                        provider_tokens.extend(tokens);
                    }
                }
            }
        }

        if !provider_tokens.is_empty() {
            let token_count = provider_tokens.len();
            all_credentials.insert(provider, provider_tokens);
            info!("Loaded {} credential(s) for provider: {:?}", token_count, provider);
        }

        Ok(())
    }

    /// Load from .credentials.json file
    fn load_credentials_file(&self, file_path: &PathBuf, provider: ProviderType) -> AuthResult<Vec<AuthToken>> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| AuthError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read credential file {}: {}", file_path.display(), e))))?;

        let credentials: CredentialsFileSchema = serde_json::from_str(&content)
            .map_err(|e| AuthError::Serialization(e))?;

        let token = self.convert_to_auth_token(credentials, &format!("{:?}", provider))?;
        Ok(vec![token])
    }

    /// Load from oauth_creds.json file
    fn load_oauth_creds_file(&self, file_path: &PathBuf, provider: ProviderType) -> AuthResult<Vec<AuthToken>> {
        let content = fs::read_to_string(file_path)
            .map_err(|e| AuthError::Io(std::io::Error::new(std::io::ErrorKind::Other, format!("Failed to read oauth cred file {}: {}", file_path.display(), e))))?;

        let oauth_creds: OauthCredsFileSchema = serde_json::from_str(&content)
            .map_err(|e| AuthError::Serialization(e))?;

        // Verify the provider matches
        let expected_provider = self.provider_to_dir_name(&provider);
        if oauth_creds.provider != expected_provider && oauth_creds.provider != format!("{:?}", provider) {
            warn!("Provider mismatch in {}, expected {} but found {}",
                  file_path.display(), expected_provider, oauth_creds.provider);
            return Err(AuthError::InvalidToken("Provider mismatch in credential file".to_string()));
        }

        let token = self.convert_to_auth_token(oauth_creds.credentials,
                                              &oauth_creds.account.unwrap_or_else(|| format!("{:?}", provider)))?;
        Ok(vec![token])
    }

    /// Convert credentials schema to AuthToken
    fn convert_to_auth_token(&self, creds: CredentialsFileSchema, _account: &str) -> AuthResult<AuthToken> {
        // Parse the expires_at timestamp if provided
        let expires_at = match creds.expires_at {
            Some(timestamp_str) => {
                match chrono::DateTime::parse_from_rfc3339(&timestamp_str) {
                    Ok(dt) => dt.timestamp(),
                    Err(_) => {
                        warn!("Invalid timestamp format in credentials: {}", timestamp_str);
                        // Default to 1 hour from now if parsing fails
                        chrono::Utc::now().timestamp() + 3600
                    }
                }
            }
            None => chrono::Utc::now().timestamp() + 3600, // Default to 1 hour from now
        };

        Ok(AuthToken {
            access_token: creds.access_token,
            refresh_token: creds.refresh_token,
            expires_at,
            token_type: creds.token_type.unwrap_or_else(|| "Bearer".to_string()),
            scope: creds.scope.unwrap_or_default(),
        })
    }

    /// Convert ProviderType to directory name
    fn provider_to_dir_name(&self, provider: &ProviderType) -> String {
        match provider {
            ProviderType::Claude => "claude".to_string(),
            ProviderType::OpenAI => "openai".to_string(),
            ProviderType::Gemini => "gemini".to_string(),
            ProviderType::Qwen => "qwen".to_string(),
            ProviderType::Ollama => "ollama".to_string(),
            ProviderType::LMStudio => "lmstudio".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_provider_to_dir_name() {
        let loader = OAuthCredentialFileLoader::new();
        
        assert_eq!(loader.provider_to_dir_name(&ProviderType::Claude), "claude");
        assert_eq!(loader.provider_to_dir_name(&ProviderType::Gemini), "gemini");
        assert_eq!(loader.provider_to_dir_name(&ProviderType::Qwen), "qwen");
    }

    #[test]
    fn test_convert_to_auth_token() {
        let loader = OAuthCredentialFileLoader::new();
        
        let creds = CredentialsFileSchema {
            access_token: "test_access_token".to_string(),
            refresh_token: Some("test_refresh_token".to_string()),
            expires_at: Some("2023-12-31T23:59:59Z".to_string()),
            token_type: Some("Bearer".to_string()),
            scope: Some("read write".to_string()),
        };

        let token = loader.convert_to_auth_token(creds, "test_account").unwrap();
        assert_eq!(token.access_token, "test_access_token");
        assert_eq!(token.refresh_token, Some("test_refresh_token".to_string()));
        assert_eq!(token.token_type, "Bearer");
        assert_eq!(token.scope, "read write");
    }

    #[test]
    fn test_load_credentials_file() {
        let temp_dir = TempDir::new().unwrap();
        let cred_file = temp_dir.path().join(".credentials.json");
        
        let creds_schema = CredentialsFileSchema {
            access_token: "test_token".to_string(),
            refresh_token: Some("refresh_token".to_string()),
            expires_at: Some("2023-12-31T23:59:59Z".to_string()),
            token_type: Some("Bearer".to_string()),
            scope: Some("read".to_string()),
        };
        
        fs::write(&cred_file, serde_json::to_string(&creds_schema).unwrap()).unwrap();
        
        let loader = OAuthCredentialFileLoader::new();
        let result = loader.load_credentials_file(&cred_file, ProviderType::Claude);
        assert!(result.is_ok());
        
        let tokens = result.unwrap();
        assert_eq!(tokens.len(), 1);
        assert_eq!(tokens[0].access_token, "test_token");
    }
}