import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { CredentialInfo, CredentialManager } from './discovery';

/**
 * Secure credential storage and management with AES-256-GCM encryption
 *
 * Security improvements:
 * - Uses AES-256-GCM instead of deprecated createCipher
 * - Implements proper IV generation for each encryption
 * - Uses PBKDF2 with 600,000 iterations for key derivation
 * - Implements authentication tags for data integrity
 * - Removes hardcoded encryption keys
 * - Generates cryptographically secure random salts
 */
export class SecureCredentialStorage {
  private credentialManager: CredentialManager;
  private storagePath: string;
  private encrypted: boolean;
  private encryptionKey?: Buffer;
  private salt?: Buffer;

  // Security constants
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly PBKDF2_ITERATIONS = 600000; // OWASP recommendation for 2023+
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly HASH_ALGORITHM = 'sha256';

  constructor(credentialManager: CredentialManager, storagePath?: string) {
    this.credentialManager = credentialManager;
    this.storagePath = storagePath || this.getDefaultStoragePath();
    this.encrypted = true; // Default to encrypted storage
  }

  private getDefaultStoragePath(): string {
    const homeDir = require('os').homedir();
    return path.join(homeDir, '.aichitect', 'secure-credentials.json');
  }

  /**
   * Initialize the secure storage system
   */
  public async initialize(): Promise<void> {
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(this.storagePath), { recursive: true });

    // Set secure file permissions (0600 - owner read/write only)
    try {
      await fs.chmod(path.dirname(this.storagePath), 0o700);
    } catch (error) {
      console.warn('Failed to set directory permissions:', error);
    }

    // If encrypted storage is enabled, set up encryption
    if (this.encrypted) {
      await this.initializeEncryption();
    }
  }

  /**
   * Initialize encryption with secure key derivation
   */
  private async initializeEncryption(): Promise<void> {
    // Load or generate salt
    const saltPath = path.join(path.dirname(this.storagePath), '.salt');

    try {
      // Try to load existing salt
      const saltData = await fs.readFile(saltPath);
      this.salt = saltData;
    } catch (error) {
      // Generate new cryptographically secure random salt
      this.salt = crypto.randomBytes(SecureCredentialStorage.SALT_LENGTH);

      // Save salt to file with secure permissions
      await fs.writeFile(saltPath, this.salt, { mode: 0o600 });
    }

    // Derive encryption key from passphrase
    this.encryptionKey = await this.deriveEncryptionKey();
  }

  /**
   * Derive encryption key using PBKDF2 with high iteration count
   *
   * Security: Uses PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
   * This makes brute-force attacks computationally expensive.
   */
  private async deriveEncryptionKey(): Promise<Buffer> {
    // Get passphrase from secure source
    // Priority: 1) Environment variable, 2) System keychain, 3) User prompt
    const passphrase = await this.getSecurePassphrase();

    if (!this.salt) {
      throw new Error('Salt not initialized');
    }

    // Use PBKDF2 with high iteration count
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        passphrase,
        this.salt!,
        SecureCredentialStorage.PBKDF2_ITERATIONS,
        SecureCredentialStorage.KEY_LENGTH,
        SecureCredentialStorage.HASH_ALGORITHM,
        (err, derivedKey) => {
          if (err) {
            reject(new Error('Failed to derive encryption key'));
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Get passphrase from secure source
   *
   * Security: Never uses hardcoded defaults, requires explicit configuration
   */
  private async getSecurePassphrase(): Promise<string> {
    // Try environment variable first
    const envPassphrase = process.env.AICHITECT_CREDENTIAL_PASSPHRASE;
    if (envPassphrase && envPassphrase.length >= 16) {
      return envPassphrase;
    }

    // In production, this should integrate with system keychain/keyring
    // For now, we require the environment variable to be set
    throw new Error(
      'AICHITECT_CREDENTIAL_PASSPHRASE environment variable must be set. ' +
        'It must be at least 16 characters long. ' +
        'Example: export AICHITECT_CREDENTIAL_PASSPHRASE="your-secure-passphrase-here"'
    );
  }

  /**
   * Store a credential securely
   */
  public async storeCredential(provider: string, key: string): Promise<boolean> {
    try {
      const credentials = await this.loadCredentials();

      // Encrypt the key if needed
      const encryptedKey = this.encrypted ? await this.encrypt(key) : key;

      credentials[provider] = {
        provider,
        key: encryptedKey,
        lastAccessed: new Date().toISOString(),
        isValid: true,
      };

      await this.saveCredentials(credentials);

      // Also update the credential manager
      this.credentialManager.saveCredential(provider, key);

      return true;
    } catch (error) {
      console.error(`Failed to store credential for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Retrieve a credential
   */
  public async retrieveCredential(provider: string): Promise<string | null> {
    try {
      const credentials = await this.loadCredentials();
      const credential = credentials[provider];

      if (!credential || !credential.key) {
        return null;
      }

      // Update last accessed time
      credential.lastAccessed = new Date().toISOString();
      await this.saveCredentials(credentials);

      // Decrypt if needed
      if (this.encrypted) {
        return await this.decrypt(credential.key);
      }

      return credential.key;
    } catch (error) {
      console.error(`Failed to retrieve credential for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Delete a credential
   */
  public async deleteCredential(provider: string): Promise<boolean> {
    try {
      const credentials = await this.loadCredentials();

      if (credentials[provider]) {
        delete credentials[provider];
        await this.saveCredentials(credentials);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to delete credential for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Load all credentials
   */
  private async loadCredentials(): Promise<Record<string, CredentialInfo & { key: string }>> {
    try {
      await fs.access(this.storagePath);
      const content = await fs.readFile(this.storagePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // If file doesn't exist, return empty object
      return {};
    }
  }

  /**
   * Save credentials to storage with secure permissions
   */
  private async saveCredentials(credentials: Record<string, any>): Promise<void> {
    // Write file with secure permissions (0600 - owner read/write only)
    await fs.writeFile(this.storagePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  }

  /**
   * Encrypt a string using AES-256-GCM
   *
   * Security improvements:
   * - Uses AES-256-GCM (authenticated encryption)
   * - Generates random IV for each encryption
   * - Includes authentication tag for integrity verification
   * - Properly handles IV in the encrypted output
   */
  private async encrypt(text: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    // Generate random IV for this encryption
    const iv = crypto.randomBytes(SecureCredentialStorage.IV_LENGTH);

    // Create cipher with proper algorithm
    const cipher = crypto.createCipheriv(SecureCredentialStorage.ALGORITHM, this.encryptionKey, iv);

    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a string using AES-256-GCM
   *
   * Security improvements:
   * - Uses AES-256-GCM (authenticated encryption)
   * - Verifies authentication tag before decryption
   * - Properly extracts IV from encrypted data
   * - Validates data format before attempting decryption
   */
  private async decrypt(encryptedText: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not available');
    }

    // Parse the encrypted format: iv:authTag:encryptedData
    const parts = encryptedText.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format. Expected format: iv:authTag:encryptedData');
    }

    const [ivHex, authTagHex, encryptedData] = parts;

    // Validate components
    if (!ivHex || !authTagHex || !encryptedData) {
      throw new Error('Invalid encrypted text format: missing components');
    }

    try {
      // Convert hex strings to buffers
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      // Validate IV and auth tag lengths
      if (iv.length !== SecureCredentialStorage.IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${SecureCredentialStorage.IV_LENGTH}, got ${iv.length}`
        );
      }

      if (authTag.length !== SecureCredentialStorage.AUTH_TAG_LENGTH) {
        throw new Error(
          `Invalid auth tag length: expected ${SecureCredentialStorage.AUTH_TAG_LENGTH}, got ${authTag.length}`
        );
      }

      // Create decipher with proper algorithm
      const decipher = crypto.createDecipheriv(
        SecureCredentialStorage.ALGORITHM,
        this.encryptionKey,
        iv
      );

      // Set authentication tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Decryption failed: ${error.message}. Data may be corrupted or tampered with.`
        );
      }
      throw new Error('Decryption failed: Unknown error');
    }
  }

  /**
   * List all stored providers
   */
  public async listStoredProviders(): Promise<string[]> {
    const credentials = await this.loadCredentials();
    return Object.keys(credentials);
  }

  /**
   * Check if storage is encrypted
   */
  public isEncrypted(): boolean {
    return this.encrypted;
  }

  /**
   * Enable or disable encryption
   *
   * Security: Disabling encryption is not recommended in production
   */
  public setEncryption(enabled: boolean): void {
    if (!enabled) {
      console.warn('WARNING: Disabling encryption is not recommended in production environments');
    }
    this.encrypted = enabled;
  }

  /**
   * Rotate encryption key
   *
   * Security: Re-encrypts all stored credentials with new key
   */
  public async rotateEncryptionKey(newPassphrase: string): Promise<boolean> {
    try {
      // Load all credentials and decrypt with old key
      const credentials = await this.loadCredentials();
      const decryptedCredentials: Record<string, any> = {};

      for (const [provider, credInfo] of Object.entries(credentials)) {
        const decryptedKey = await this.decrypt(credInfo.key);
        decryptedCredentials[provider] = {
          ...credInfo,
          key: decryptedKey,
        };
      }

      // Generate new salt and derive new key
      this.salt = crypto.randomBytes(SecureCredentialStorage.SALT_LENGTH);
      const saltPath = path.join(path.dirname(this.storagePath), '.salt');
      await fs.writeFile(saltPath, this.salt, { mode: 0o600 });

      // Set new passphrase in environment (caller should handle this)
      process.env.AICHITECT_CREDENTIAL_PASSPHRASE = newPassphrase;

      // Derive new key
      this.encryptionKey = await this.deriveEncryptionKey();

      // Re-encrypt all credentials with new key
      const reencryptedCredentials: Record<string, any> = {};
      for (const [provider, credInfo] of Object.entries(decryptedCredentials)) {
        reencryptedCredentials[provider] = {
          ...credInfo,
          key: await this.encrypt(credInfo.key),
        };
      }

      // Save re-encrypted credentials
      await this.saveCredentials(reencryptedCredentials);

      return true;
    } catch (error) {
      console.error('Failed to rotate encryption key:', error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  public async getStats(): Promise<{
    totalCredentials: number;
    isEncrypted: boolean;
    algorithm: string;
    keyDerivationIterations: number;
    storagePath: string;
  }> {
    const credentials = await this.loadCredentials();

    return {
      totalCredentials: Object.keys(credentials).length,
      isEncrypted: this.encrypted,
      algorithm: SecureCredentialStorage.ALGORITHM,
      keyDerivationIterations: SecureCredentialStorage.PBKDF2_ITERATIONS,
      storagePath: this.storagePath,
    };
  }
}
