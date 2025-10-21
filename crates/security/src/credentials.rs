use anyhow::Result;
use std::collections::HashMap;

pub struct CredentialManager {
    credentials: HashMap<String, String>,
}

impl Default for CredentialManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CredentialManager {
    pub fn new() -> Self {
        CredentialManager {
            credentials: HashMap::new(),
        }
    }

    pub fn store_credential(&mut self, key: String, value: String) -> Result<()> {
        self.credentials.insert(key, value);
        Ok(())
    }

    pub fn get_credential(&self, key: &str) -> Option<&String> {
        self.credentials.get(key)
    }

    pub fn remove_credential(&mut self, key: &str) -> Result<()> {
        self.credentials.remove(key);
        Ok(())
    }

    pub fn list_credentials(&self) -> Vec<String> {
        self.credentials.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_manager() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("api_key".to_string(), "secret123".to_string())
            .unwrap();
        assert_eq!(
            manager.get_credential("api_key"),
            Some(&"secret123".to_string())
        );

        manager.remove_credential("api_key").unwrap();
        assert_eq!(manager.get_credential("api_key"), None);
    }
}
