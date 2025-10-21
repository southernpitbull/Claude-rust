use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use anyhow::Result;
use hmac::Hmac;
use pbkdf2::pbkdf2;
use rand::RngCore;
use sha2::Sha256;

pub struct Aes256GcmEncryption;

impl Aes256GcmEncryption {
    pub fn encrypt(data: &[u8], password: &str) -> Result<Vec<u8>> {
        let salt = Self::generate_salt();
        let key_bytes = Self::derive_key(password, &salt);
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

        let cipher = Aes256Gcm::new(key);
        let nonce = Self::generate_nonce();
        let nonce_ga = Nonce::from_slice(&nonce);

        let ciphertext = cipher
            .encrypt(nonce_ga, data.as_ref())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Prepend salt and nonce to ciphertext
        let mut result = Vec::new();
        result.extend_from_slice(&salt);
        result.extend_from_slice(&nonce);
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    pub fn decrypt(data: &[u8], password: &str) -> Result<Vec<u8>> {
        if data.len() < 28 {
            // Salt (16) + Nonce (12) minimum
            return Err(anyhow::anyhow!("Invalid encrypted data length"));
        }

        let salt = &data[0..16];
        let nonce = &data[16..28]; // 12-byte nonce
        let ciphertext = &data[28..];

        let key_bytes = Self::derive_key(password, salt);
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        let nonce_ga = Nonce::from_slice(nonce);

        let plaintext = cipher
            .decrypt(nonce_ga, ciphertext.as_ref())
            .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

        Ok(plaintext)
    }

    fn derive_key(password: &str, salt: &[u8]) -> [u8; 32] {
        // 256 bits
        let mut key = [0u8; 32];
        let _ = pbkdf2::<Hmac<Sha256>>(password.as_bytes(), salt, 100_000, &mut key);
        key
    }

    fn generate_salt() -> [u8; 16] {
        let mut salt = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut salt);
        salt
    }

    fn generate_nonce() -> [u8; 12] {
        // AES-GCM typically uses 96-bit (12-byte) nonces
        let mut nonce = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce);
        nonce
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let original = b"Hello, world!";
        let password = "my_secret_password";

        let encrypted = Aes256GcmEncryption::encrypt(original, password).unwrap();
        let decrypted = Aes256GcmEncryption::decrypt(&encrypted, password).unwrap();

        assert_eq!(original, &decrypted[..]);
    }
}
