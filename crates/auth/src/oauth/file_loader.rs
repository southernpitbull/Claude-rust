//! OAuth Credential File Loader
//!
//! Loads OAuth credentials from files in user directories:
//! - ~/.claude/.credentials.json
//! - ~/.claude/oauth_creds.json
//! - ~/.gemini/.credentials.json
//! - ~/.gemini/oauth_creds.json
//! - ~/.qwen/.credentials.json
//! - ~/.qwen/oauth_creds.json

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{debug, info, warn};

/// OAuth credential file formats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CredentialFileFormat {
    /// Standard credentials.json format
    Credentials {
        /// Access token
        access_token: String,
        /// Refresh token
        #[serde(default)]
        refresh_token: Option<String>,
        /// Token expiration time
        #[serde(default)]
        expires_at: Option<String>,
        /// Token type
        #[serde(default)]
        token_type: Option<String>,
        /// Token scope
        #[serde(default)]
        scope: Option<String>,
    },
    
    /// OAuth credentials format
    OAuthCreds {
        /// Provider name
        provider: String,
        /// Account identifier
        #[serde(default)]
        account: Option<String>,
        /// Credentials data
        credentials: OAuthCredentials,
    },
}

/// OAuth credentials data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCredentials {
    /// Access token
    pub access_token: String,
    /// Refresh token
    #[serde(default)]
    pub refresh_token: Option<String>,
    /// Token expiration time
    #[serde(default)]
    pub expires_at: Option<String>,
    /// Token type
    #[serde(default)]
    pub token_type: Option<String>,
    /// Token scope
    #[serde(default)]
    pub scope: Option<String>,
}

impl OAuthCredentials {
    /// Create new OAuth credentials
    pub fn new(access_token: String) -> Self {
        Self {
            access_token,
            refresh_token: None,
            expires_at: None,
            token_type: None,
            scope: None,
        }
    }
    
    /// Set refresh token
    pub fn with_refresh_token(mut self, refresh_token: String) -> Self {
        self.refresh_token = Some(refresh_token);
        self
    }
    
    /// Set expiration time
    pub fn with_expires_at(mut self, expires_at: String) -> Self {
        self.expires_at = Some(expires_at);
        self
    }
    
    /// Set token type
    pub fn with_token_type(mut self, token_type: String) -> Self {
        self.token_type = Some(token_type);
        self
    }
    
    /// Set scope
    pub fn with_scope(mut self, scope: String) -> Self {
        self.scope = Some(scope);
        self
    }
}

/// OAuth credential file loader
pub struct OAuthCredentialFileLoader {
    /// User home directory
    home_dir: PathBuf,
}

impl OAuthCredentialFileLoader {
    /// Create new OAuth credential file loader
    pub fn new() -> Result<Self> {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| anyhow::anyhow!("Failed to determine home directory"))?;
        
        Ok(Self { home_dir })
    }
    
    /// Load credentials from all supported directories
    pub fn load_all_credentials(&self) -> Result<HashMap<String, OAuthCredentials>> {
        let mut credentials = HashMap::new();
        
        // Load from .claude directory
        let claude_dir = self.home_dir.join(".claude");
        if claude_dir.exists() {
            self.load_credentials_from_dir(&claude_dir, &mut credentials)?;
        }
        
        // Load from .gemini directory
        let gemini_dir = self.home_dir.join(".gemini");
        if gemini_dir.exists() {
            self.load_credentials_from_dir(&gemini_dir, &mut credentials)?;
        }
        
        // Load from .qwen directory
        let qwen_dir = self.home_dir.join(".qwen");
        if qwen_dir.exists() {
            self.load_credentials_from_dir(&qwen_dir, &mut credentials)?;
        }
        
        Ok(credentials)
    }
    
    /// Load credentials from a specific directory
    fn load_credentials_from_dir(
        &self,
        dir: &Path,
        credentials: &mut HashMap<String, OAuthCredentials>,
    ) -> Result<()> {
        debug!("Loading OAuth credentials from directory: {}", dir.display());
        
        // Check for .credentials.json
        let credentials_file = dir.join(".credentials.json");
        if credentials_file.exists() {
            match self.load_credentials_file(&credentials_file) {
                Ok(creds) => {
                    let provider = self.get_provider_from_dir(dir);
                    credentials.insert(provider, creds);
                    info!("Loaded credentials from: {}", credentials_file.display());
                }
                Err(e) => {
                    warn!("Failed to load credentials from {}: {}", credentials_file.display(), e);
                }
            }
        }
        
        // Check for oauth_creds.json
        let oauth_creds_file = dir.join("oauth_creds.json");
        if oauth_creds_file.exists() {
            match self.load_oauth_creds_file(&oauth_creds_file) {
                Ok((provider, creds)) => {
                    credentials.insert(provider, creds);
                    info!("Loaded OAuth credentials from: {}", oauth_creds_file.display());
                }
                Err(e) => {
                    warn!("Failed to load OAuth credentials from {}: {}", oauth_creds_file.display(), e);
                }
            }
        }
        
        Ok(())
    }
    
    /// Load credentials from .credentials.json file
    fn load_credentials_file(&self, file_path: &Path) -> Result<OAuthCredentials> {
        debug!("Loading credentials from: {}", file_path.display());
        
        let content = fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read credentials file: {}", file_path.display()))?;
        
        let creds: CredentialFileFormat = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse credentials file: {}", file_path.display()))?;
        
        match creds {
            CredentialFileFormat::Credentials {
                access_token,
                refresh_token,
                expires_at,
                token_type,
                scope,
            } => {
                Ok(OAuthCredentials {
                    access_token,
                    refresh_token,
                    expires_at,
                    token_type,
                    scope,
                })
            }
            CredentialFileFormat::OAuthCreds { .. } => {
                bail!("Expected credentials format, got OAuthCreds format in: {}", file_path.display());
            }
        }
    }
    
    /// Load credentials from oauth_creds.json file
    fn load_oauth_creds_file(&self, file_path: &Path) -> Result<(String, OAuthCredentials)> {
        debug!("Loading OAuth credentials from: {}", file_path.display());
        
        let content = fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read OAuth credentials file: {}", file_path.display()))?;
        
        let creds: CredentialFileFormat = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse OAuth credentials file: {}", file_path.display()))?;
        
        match creds {
            CredentialFileFormat::OAuthCreds {
                provider,
                account: _,
                credentials,
            } => {
                Ok((provider, credentials))
            }
            CredentialFileFormat::Credentials { .. } => {
                bail!("Expected OAuthCreds format, got credentials format in: {}", file_path.display());
            }
        }
    }
    
    /// Get provider name from directory path
    fn get_provider_from_dir(&self, dir: &Path) -> String {
        let dir_name = dir.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");
        
        // Remove the dot prefix if present
        let provider = if dir_name.starts_with('.') {
            &dir_name[1..]
        } else {
            dir_name
        };
        
        provider.to_string()
    }
    
    /// Get home directory
    pub fn home_dir(&self) -> &Path {
        &self.home_dir
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    #[test]
    fn test_oauth_credential_file_loader_creation() {
        let loader = OAuthCredentialFileLoader::new();
        assert!(loader.is_ok());
    }
    
    #[test]
    fn test_get_provider_from_dir() {
        let loader = OAuthCredentialFileLoader::new().unwrap();
        
        let claude_dir = PathBuf::from("/home/user/.claude");
        let provider = loader.get_provider_from_dir(&claude_dir);
        assert_eq!(provider, "claude");
        
        let gemini_dir = PathBuf::from("/home/user/.gemini");
        let provider = loader.get_provider_from_dir(&gemini_dir);
        assert_eq!(provider, "gemini");
        
        let qwen_dir = PathBuf::from("/home/user/.qwen");
        let provider = loader.get_provider_from_dir(&qwen_dir);
        assert_eq!(provider, "qwen");
    }
    
    #[test]
    fn test_load_credentials_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join(".credentials.json");
        
        let content = r#"{
            "type": "credentials",
            "access_token": "test_token",
            "refresh_token": "test_refresh",
            "expires_at": "2025-01-01T00:00:00Z",
            "token_type": "Bearer",
            "scope": "read write"
        }"#;
        
        fs::write(&file_path, content).unwrap();
        
        let loader = OAuthCredentialFileLoader::new().unwrap();
        let creds = loader.load_credentials_file(&file_path);
        assert!(creds.is_ok());
        
        let creds = creds.unwrap();
        assert_eq!(creds.access_token, "test_token");
        assert_eq!(creds.refresh_token, Some("test_refresh".to_string()));
        assert_eq!(creds.expires_at, Some("2025-01-01T00:00:00Z".to_string()));
        assert_eq!(creds.token_type, Some("Bearer".to_string()));
        assert_eq!(creds.scope, Some("read write".to_string()));
    }
    
    #[test]
    fn test_load_oauth_creds_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("oauth_creds.json");
        
        let content = r#"{
            "type": "oauth_creds",
            "provider": "claude",
            "account": "test@example.com",
            "credentials": {
                "access_token": "test_token",
                "refresh_token": "test_refresh",
                "expires_at": "2025-01-01T00:00:00Z",
                "token_type": "Bearer",
                "scope": "read write"
            }
        }"#;
        
        fs::write(&file_path, content).unwrap();
        
        let loader = OAuthCredentialFileLoader::new().unwrap();
        let creds = loader.load_oauth_creds_file(&file_path);
        assert!(creds.is_ok());
        
        let (provider, creds) = creds.unwrap();
        assert_eq!(provider, "claude");
        assert_eq!(creds.access_token, "test_token");
        assert_eq!(creds.refresh_token, Some("test_refresh".to_string()));
        assert_eq!(creds.expires_at, Some("2025-01-01T00:00:00Z".to_string()));
        assert_eq!(creds.token_type, Some("Bearer".to_string()));
        assert_eq!(creds.scope, Some("read write".to_string()));
    }
}