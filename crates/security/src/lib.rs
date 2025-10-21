//! Security layer with credential management for AIrchitect CLI

pub mod credentials;
pub mod encryption;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub encryption_enabled: bool,
    pub encryption_algorithm: String,
    pub key_derivation: String,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        SecurityConfig {
            encryption_enabled: true,
            encryption_algorithm: "AES-256-GCM".to_string(),
            key_derivation: "PBKDF2".to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::credentials::CredentialManager;
    use crate::encryption::Aes256GcmEncryption;

    // SecurityConfig tests
    #[test]
    fn test_security_config_default() {
        let config = SecurityConfig::default();
        assert!(config.encryption_enabled);
        assert_eq!(config.encryption_algorithm, "AES-256-GCM");
        assert_eq!(config.key_derivation, "PBKDF2");
    }

    #[test]
    fn test_security_config_serialization() {
        let config = SecurityConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: SecurityConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(config.encryption_enabled, deserialized.encryption_enabled);
        assert_eq!(
            config.encryption_algorithm,
            deserialized.encryption_algorithm
        );
        assert_eq!(config.key_derivation, deserialized.key_derivation);
    }

    #[test]
    fn test_security_config_custom_values() {
        let config = SecurityConfig {
            encryption_enabled: false,
            encryption_algorithm: "AES-128-GCM".to_string(),
            key_derivation: "Argon2".to_string(),
        };

        assert!(!config.encryption_enabled);
        assert_eq!(config.encryption_algorithm, "AES-128-GCM");
        assert_eq!(config.key_derivation, "Argon2");
    }

    // Encryption tests
    #[test]
    fn test_encrypt_decrypt_simple() {
        let data = b"Hello, World!";
        let password = "test_password_123";

        let encrypted = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();

        assert_eq!(data, &decrypted[..]);
    }

    #[test]
    fn test_encrypt_decrypt_empty_data() {
        let data = b"";
        let password = "test_password";

        let encrypted = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();

        assert_eq!(data, &decrypted[..]);
    }

    #[test]
    fn test_encrypt_decrypt_large_data() {
        let data = vec![42u8; 10000];
        let password = "secure_password_456";

        let encrypted = Aes256GcmEncryption::encrypt(&data, password).unwrap();
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();

        assert_eq!(data, decrypted);
    }

    #[test]
    fn test_encrypt_decrypt_unicode() {
        let data = "Hello 世界! 🔒🔑".as_bytes();
        let password = "パスワード";

        let encrypted = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();

        assert_eq!(data, &decrypted[..]);
    }

    #[test]
    fn test_decrypt_with_wrong_password() {
        let data = b"Secret data";
        let password = "correct_password";
        let wrong_password = "wrong_password";

        let encrypted = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let result = Aes256GcmEncryption::decrypt(&encrypted, wrong_password);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Decryption failed"));
    }

    #[test]
    fn test_decrypt_invalid_data() {
        let invalid_data = vec![1, 2, 3, 4, 5];
        let password = "test_password";

        let result = Aes256GcmEncryption::decrypt(&invalid_data, password);

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Invalid encrypted data length"));
    }

    #[test]
    fn test_decrypt_truncated_data() {
        let data = b"Test data";
        let password = "password123";

        let encrypted = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let truncated = &encrypted[..20];

        let result = Aes256GcmEncryption::decrypt(truncated, password);
        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_different_nonces() {
        let data = b"Same data";
        let password = "same_password";

        let encrypted1 = Aes256GcmEncryption::encrypt(data, password).unwrap();
        let encrypted2 = Aes256GcmEncryption::encrypt(data, password).unwrap();

        // Different nonces mean different ciphertexts
        assert_ne!(encrypted1, encrypted2);

        // But both decrypt to the same plaintext
        let decrypted1 = Aes256GcmEncryption::decrypt(&encrypted1, password).unwrap();
        let decrypted2 = Aes256GcmEncryption::decrypt(&encrypted2, password).unwrap();
        assert_eq!(decrypted1, decrypted2);
    }

    // Credential management tests
    #[test]
    fn test_credential_manager_new() {
        let manager = CredentialManager::new();
        assert_eq!(manager.list_credentials().len(), 0);
    }

    #[test]
    fn test_store_and_retrieve_credential() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("api_key".to_string(), "secret123".to_string())
            .unwrap();

        let retrieved = manager.get_credential("api_key");
        assert_eq!(retrieved, Some(&"secret123".to_string()));
    }

    #[test]
    fn test_retrieve_nonexistent_credential() {
        let manager = CredentialManager::new();

        let retrieved = manager.get_credential("nonexistent");
        assert_eq!(retrieved, None);
    }

    #[test]
    fn test_remove_credential() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("temp_key".to_string(), "temp_value".to_string())
            .unwrap();
        assert!(manager.get_credential("temp_key").is_some());

        manager.remove_credential("temp_key").unwrap();
        assert!(manager.get_credential("temp_key").is_none());
    }

    #[test]
    fn test_remove_nonexistent_credential() {
        let mut manager = CredentialManager::new();

        // Should not panic or error
        let result = manager.remove_credential("nonexistent");
        assert!(result.is_ok());
    }

    #[test]
    fn test_list_multiple_credentials() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("key1".to_string(), "value1".to_string())
            .unwrap();
        manager
            .store_credential("key2".to_string(), "value2".to_string())
            .unwrap();
        manager
            .store_credential("key3".to_string(), "value3".to_string())
            .unwrap();

        let credentials = manager.list_credentials();
        assert_eq!(credentials.len(), 3);
        assert!(credentials.contains(&"key1".to_string()));
        assert!(credentials.contains(&"key2".to_string()));
        assert!(credentials.contains(&"key3".to_string()));
    }

    #[test]
    fn test_overwrite_credential() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("key".to_string(), "old_value".to_string())
            .unwrap();
        assert_eq!(
            manager.get_credential("key"),
            Some(&"old_value".to_string())
        );

        manager
            .store_credential("key".to_string(), "new_value".to_string())
            .unwrap();
        assert_eq!(
            manager.get_credential("key"),
            Some(&"new_value".to_string())
        );
    }

    #[test]
    fn test_credential_with_special_characters() {
        let mut manager = CredentialManager::new();

        let key = "api_key_with-special.chars_123";
        let value = "value!@#$%^&*()_+-=[]{}|;:',.<>?/";

        manager
            .store_credential(key.to_string(), value.to_string())
            .unwrap();
        assert_eq!(manager.get_credential(key), Some(&value.to_string()));
    }

    #[test]
    fn test_credential_with_unicode() {
        let mut manager = CredentialManager::new();

        manager
            .store_credential("日本語キー".to_string(), "🔑🔒".to_string())
            .unwrap();
        assert_eq!(
            manager.get_credential("日本語キー"),
            Some(&"🔑🔒".to_string())
        );
    }

    // Integration tests
    #[test]
    fn test_encrypt_credential() {
        let mut manager = CredentialManager::new();
        let password = "master_password";

        // Store credential
        let api_key = "super_secret_key_12345";
        manager
            .store_credential("openai".to_string(), api_key.to_string())
            .unwrap();

        // Retrieve and encrypt
        let credential = manager.get_credential("openai").unwrap();
        let encrypted = Aes256GcmEncryption::encrypt(credential.as_bytes(), password).unwrap();

        // Decrypt and verify
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();
        let decrypted_str = String::from_utf8(decrypted).unwrap();

        assert_eq!(decrypted_str, api_key);
    }

    #[test]
    fn test_multiple_credentials_encryption() {
        let mut manager = CredentialManager::new();
        let password = "encryption_password";

        // Store multiple credentials
        manager
            .store_credential("key1".to_string(), "value1".to_string())
            .unwrap();
        manager
            .store_credential("key2".to_string(), "value2".to_string())
            .unwrap();

        // Encrypt all
        let mut encrypted_creds = std::collections::HashMap::new();
        for key in manager.list_credentials() {
            let value = manager.get_credential(&key).unwrap();
            let encrypted = Aes256GcmEncryption::encrypt(value.as_bytes(), password).unwrap();
            encrypted_creds.insert(key, encrypted);
        }

        // Verify we can decrypt all
        for (key, encrypted) in encrypted_creds {
            let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();
            let decrypted_str = String::from_utf8(decrypted).unwrap();

            let original = manager.get_credential(&key).unwrap();
            assert_eq!(&decrypted_str, original);
        }
    }
}
