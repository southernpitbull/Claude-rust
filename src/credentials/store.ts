import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DiscoveredCredential } from './discovery';

/**
 * Interface for encrypted credential storage
 */
export interface EncryptedCredential {
  provider: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

/**
 * Interface for credential store configuration
 */
export interface CredentialStoreConfig {
  storagePath?: string;
  encryptionKey?: string;
  keyDerivationIterations?: number;
  autoEncrypt?: boolean;
  backupEnabled?: boolean;
  backupPath?: string;
}

/**
 * Secure credential storage system with AES-256-GCM encryption
 *
 * Security improvements:
 * - Uses AES-256-GCM with proper IV and authentication tags
 * - Implements PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
 * - Uses cryptographically secure random salts per store
 * - Removes hardcoded encryption keys
 * - Sets secure file permissions (0600)
 * - Implements proper error handling for crypto operations
 */
export class CredentialStore {
  private credentials: Map<string, EncryptedCredential>;
  private config: CredentialStoreConfig;
  private encryptionKey: Buffer | null = null;
  private salt: Buffer | null = null;
  private initialized: boolean = false;

  // Security constants
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits
  private static readonly PBKDF2_ITERATIONS = 600000; // OWASP 2023 recommendation
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly HASH_ALGORITHM = 'sha256';
  private static readonly MIN_PASSPHRASE_LENGTH = 16;

  constructor(config?: CredentialStoreConfig) {
    this.config = {
      storagePath: path.join(os.homedir(), '.aichitect', 'credentials.json'),
      keyDerivationIterations: CredentialStore.PBKDF2_ITERATIONS,
      autoEncrypt: true,
      backupEnabled: true,
      backupPath: path.join(os.homedir(), '.aichitect', 'credentials.backup.json'),
      ...config,
    };

    this.credentials = new Map();
  }

  /**
   * Generate encryption key from passphrase using PBKDF2
   *
   * Security improvements:
   * - Uses PBKDF2 with 600,000 iterations (OWASP 2023 recommendation)
   * - Uses cryptographically secure random salt per store
   * - No hardcoded passphrases or default keys
   * - Enforces minimum passphrase length
   */
  private async generateEncryptionKey(): Promise<Buffer> {
    // Get passphrase from secure source
    const passphrase = await this.getSecurePassphrase();

    // Validate passphrase strength
    if (passphrase.length < CredentialStore.MIN_PASSPHRASE_LENGTH) {
      throw new Error(
        `Passphrase must be at least ${CredentialStore.MIN_PASSPHRASE_LENGTH} characters long`
      );
    }

    // Load or generate salt
    const saltPath = path.join(path.dirname(this.config.storagePath!), '.store-salt');

    try {
      // Try to load existing salt
      this.salt = await fs.readFile(saltPath);
    } catch (error) {
      // Generate new cryptographically secure random salt
      this.salt = crypto.randomBytes(CredentialStore.SALT_LENGTH);

      // Save salt with secure permissions
      await fs.writeFile(saltPath, this.salt, { mode: 0o600 });
    }

    // Derive key using PBKDF2 with high iteration count
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        passphrase,
        this.salt!,
        this.config.keyDerivationIterations || CredentialStore.PBKDF2_ITERATIONS,
        CredentialStore.KEY_LENGTH,
        CredentialStore.HASH_ALGORITHM,
        (err, derivedKey) => {
          if (err) {
            reject(new Error(`Key derivation failed: ${err.message}`));
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
    // Priority: 1) Config, 2) Environment variable, 3) Throw error
    const passphrase =
      this.config.encryptionKey ||
      process.env.AICHITECT_STORE_PASSPHRASE ||
      process.env.AICHITECT_CREDENTIAL_PASSPHRASE;

    if (!passphrase) {
      throw new Error(
        'No encryption passphrase provided. Set AICHITECT_STORE_PASSPHRASE environment variable ' +
          'or provide encryptionKey in config. Passphrase must be at least 16 characters long. ' +
          'Example: export AICHITECT_STORE_PASSPHRASE="your-secure-passphrase-here"'
      );
    }

    return passphrase;
  }

  /**
   * Initialize the credential store
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create storage directory if it doesn't exist
      const storageDir = path.dirname(this.config.storagePath || '');
      await fs.mkdir(storageDir, { recursive: true });

      // Set secure directory permissions
      try {
        await fs.chmod(storageDir, 0o700);
      } catch (error) {
        console.warn('Failed to set directory permissions:', error);
      }

      // Generate or load encryption key
      this.encryptionKey = await this.generateEncryptionKey();

      // Load existing credentials
      await this.loadCredentials();

      // If backup is enabled, create a backup
      if (this.config.backupEnabled) {
        await this.createBackup();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize credential store:', error);
      return false;
    }
  }

  /**
   * Load credentials from storage
   */
  private async loadCredentials(): Promise<boolean> {
    try {
      const storagePath = this.config.storagePath;
      if (!storagePath) {
        throw new Error('Storage path not configured');
      }

      // Check if file exists
      try {
        await fs.access(storagePath);
      } catch {
        // File doesn't exist, create empty store
        this.credentials = new Map();
        return true;
      }

      // Read and parse the file
      const content = await fs.readFile(storagePath, 'utf8');
      const data = JSON.parse(content);

      // Validate data structure
      if (!data.credentials || !Array.isArray(data.credentials)) {
        throw new Error('Invalid credential store format');
      }

      // Load credentials into memory
      this.credentials = new Map();
      for (const cred of data.credentials) {
        // Validate credential structure
        if (!this.isValidCredentialStructure(cred)) {
          console.warn(`Skipping invalid credential entry for ${cred?.provider || 'unknown'}`);
          continue;
        }
        this.credentials.set(cred.provider, cred);
      }

      return true;
    } catch (error) {
      console.error('Failed to load credentials:', error);
      this.credentials = new Map();
      return false;
    }
  }

  /**
   * Validate credential structure
   */
  private isValidCredentialStructure(cred: any): boolean {
    return (
      cred &&
      typeof cred.provider === 'string' &&
      typeof cred.encryptedKey === 'string' &&
      typeof cred.iv === 'string' &&
      typeof cred.authTag === 'string' &&
      typeof cred.createdAt === 'string' &&
      typeof cred.updatedAt === 'string'
    );
  }

  /**
   * Save credentials to storage with secure permissions
   */
  private async saveCredentials(): Promise<boolean> {
    try {
      const storagePath = this.config.storagePath;
      if (!storagePath) {
        throw new Error('Storage path not configured');
      }

      // Create data structure for storage
      const data = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        credentials: Array.from(this.credentials.values()),
      };

      // Write to file with secure permissions (0600 - owner read/write only)
      await fs.writeFile(storagePath, JSON.stringify(data, null, 2), { mode: 0o600 });

      // Create backup if enabled
      if (this.config.backupEnabled) {
        await this.createBackup();
      }

      return true;
    } catch (error) {
      console.error('Failed to save credentials:', error);
      return false;
    }
  }

  /**
   * Create a backup of the credential store
   */
  private async createBackup(): Promise<boolean> {
    if (!this.config.backupEnabled || !this.config.backupPath) {
      return false;
    }

    try {
      const backupDir = path.dirname(this.config.backupPath);
      await fs.mkdir(backupDir, { recursive: true });

      // Copy current storage to backup location
      const storagePath = this.config.storagePath;
      if (storagePath) {
        try {
          await fs.access(storagePath);
          await fs.copyFile(storagePath, this.config.backupPath);
          // Set secure permissions on backup
          await fs.chmod(this.config.backupPath, 0o600);
        } catch (error) {
          // Source file doesn't exist yet, skip backup
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return false;
    }
  }

  /**
   * Encrypt a credential key using AES-256-GCM
   *
   * Security improvements:
   * - Uses AES-256-GCM (authenticated encryption)
   * - Generates random IV for each encryption
   * - Includes authentication tag for integrity verification
   * - Validates encryption key availability
   */
  private encryptKey(key: string): Omit<EncryptedCredential, 'provider'> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Generate a random IV for this encryption
    const iv = crypto.randomBytes(CredentialStore.IV_LENGTH);

    // Create cipher with proper algorithm
    const cipher = crypto.createCipheriv(CredentialStore.ALGORITHM, this.encryptionKey, iv);

    // Encrypt the key
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Return encrypted credential without provider
    return {
      encryptedKey: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Decrypt a credential key using AES-256-GCM
   *
   * Security improvements:
   * - Uses AES-256-GCM (authenticated encryption)
   * - Verifies authentication tag before decryption
   * - Validates IV and auth tag lengths
   * - Proper error handling for tampering detection
   */
  private decryptKey(encryptedCred: EncryptedCredential): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      // Convert hex strings to buffers
      const iv = Buffer.from(encryptedCred.iv, 'hex');
      const authTag = Buffer.from(encryptedCred.authTag, 'hex');

      // Validate IV and auth tag lengths
      if (iv.length !== CredentialStore.IV_LENGTH) {
        throw new Error(
          `Invalid IV length: expected ${CredentialStore.IV_LENGTH}, got ${iv.length}`
        );
      }

      if (authTag.length !== CredentialStore.AUTH_TAG_LENGTH) {
        throw new Error(
          `Invalid auth tag length: expected ${CredentialStore.AUTH_TAG_LENGTH}, got ${authTag.length}`
        );
      }

      // Create decipher with proper algorithm
      const decipher = crypto.createDecipheriv(CredentialStore.ALGORITHM, this.encryptionKey, iv);

      // Set authentication tag for verification
      decipher.setAuthTag(authTag);

      // Decrypt the key
      let decrypted = decipher.update(encryptedCred.encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to decrypt credential for ${encryptedCred.provider}: ${error.message}. ` +
            'Data may be corrupted or tampered with.'
        );
      }
      throw new Error(`Failed to decrypt credential for ${encryptedCred.provider}`);
    }
  }

  /**
   * Store a credential securely
   */
  public async storeCredential(provider: string, key: string, expiresAt?: Date): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Validate inputs
      if (!provider || !key) {
        throw new Error('Provider and key are required');
      }

      // Encrypt the key
      const encryptedCred = this.encryptKey(key);

      // Create full credential object
      const fullCred: EncryptedCredential = {
        provider,
        ...encryptedCred,
      };

      if (expiresAt) {
        fullCred.expiresAt = expiresAt.toISOString();
      }

      // Store in memory
      this.credentials.set(provider, fullCred);

      // Save to persistent storage
      return await this.saveCredentials();
    } catch (error) {
      console.error(`Failed to store credential for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Retrieve a credential securely
   */
  public async retrieveCredential(provider: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const encryptedCred = this.credentials.get(provider);
    if (!encryptedCred) {
      return null;
    }

    // Check if credential has expired
    if (encryptedCred.expiresAt) {
      const expiryDate = new Date(encryptedCred.expiresAt);
      if (expiryDate < new Date()) {
        // Remove expired credential
        this.credentials.delete(provider);
        await this.saveCredentials();
        return null;
      }
    }

    try {
      // Decrypt the key
      const key = this.decryptKey(encryptedCred);

      // Update last accessed time (without saving to avoid excessive I/O)
      encryptedCred.updatedAt = new Date().toISOString();

      return key;
    } catch (error) {
      console.error(`Failed to retrieve credential for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Remove a credential
   */
  public async removeCredential(provider: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const removed = this.credentials.delete(provider);
    if (removed) {
      return await this.saveCredentials();
    }

    return false;
  }

  /**
   * List all stored providers
   */
  public listProviders(): string[] {
    return Array.from(this.credentials.keys());
  }

  /**
   * Check if a credential exists for a provider
   */
  public hasCredential(provider: string): boolean {
    return this.credentials.has(provider);
  }

  /**
   * Get credential metadata without decrypting
   */
  public getCredentialMetadata(
    provider: string
  ): Omit<EncryptedCredential, 'encryptedKey' | 'iv' | 'authTag'> | null {
    const cred = this.credentials.get(provider);
    if (!cred) {
      return null;
    }

    // Return metadata without sensitive fields
    return {
      provider: cred.provider,
      createdAt: cred.createdAt,
      updatedAt: cred.updatedAt,
      expiresAt: cred.expiresAt,
    };
  }

  /**
   * Update credential expiration
   */
  public async updateCredentialExpiration(provider: string, expiresAt: Date): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cred = this.credentials.get(provider);
    if (!cred) {
      return false;
    }

    cred.expiresAt = expiresAt.toISOString();
    cred.updatedAt = new Date().toISOString();

    return await this.saveCredentials();
  }

  /**
   * Rotate a credential (update with new key)
   */
  public async rotateCredential(
    provider: string,
    newKey: string,
    expiresAt?: Date
  ): Promise<boolean> {
    return await this.storeCredential(provider, newKey, expiresAt);
  }

  /**
   * Validate all stored credentials
   */
  public async validateAllCredentials(): Promise<{
    valid: number;
    invalid: number;
    expired: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    let valid = 0;
    let invalid = 0;
    let expired = 0;

    for (const [provider, cred] of this.credentials.entries()) {
      // Check expiration
      if (cred.expiresAt) {
        const expiryDate = new Date(cred.expiresAt);
        if (expiryDate < new Date()) {
          expired++;
          continue;
        }
      }

      // Try to decrypt (this validates the credential)
      try {
        await this.retrieveCredential(provider);
        valid++;
      } catch (error) {
        invalid++;
        console.warn(`Invalid credential for ${provider}:`, error);
      }
    }

    return { valid, invalid, expired };
  }

  /**
   * Clear all credentials
   */
  public async clearAllCredentials(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.credentials.clear();
    return await this.saveCredentials();
  }

  /**
   * Import credentials from a file
   */
  public async importCredentials(filePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);

      if (!data.credentials || !Array.isArray(data.credentials)) {
        throw new Error('Invalid credential file format');
      }

      // Import each credential
      for (const cred of data.credentials) {
        // Validate required fields
        if (!this.isValidCredentialStructure(cred)) {
          console.warn(`Skipping invalid credential entry for ${cred?.provider || 'unknown'}`);
          continue;
        }

        // Store in memory
        this.credentials.set(cred.provider, cred);
      }

      // Save to persistent storage
      return await this.saveCredentials();
    } catch (error) {
      console.error(`Failed to import credentials from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Export credentials to a file
   */
  public async exportCredentials(filePath: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Create data structure for export
      const data = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        credentials: Array.from(this.credentials.values()),
      };

      // Write to file with secure permissions
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
      return true;
    } catch (error) {
      console.error(`Failed to export credentials to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get store statistics
   */
  public getStats(): {
    totalCredentials: number;
    encryptedCredentials: number;
    expiredCredentials: number;
    providers: string[];
    storagePath: string | undefined;
    algorithm: string;
    keyDerivationIterations: number;
  } {
    const now = new Date();
    let expiredCredentials = 0;

    // Count expired credentials
    for (const cred of this.credentials.values()) {
      if (cred.expiresAt && new Date(cred.expiresAt) < now) {
        expiredCredentials++;
      }
    }

    return {
      totalCredentials: this.credentials.size,
      encryptedCredentials: this.credentials.size, // All credentials are encrypted
      expiredCredentials,
      providers: Array.from(this.credentials.keys()),
      storagePath: this.config.storagePath,
      algorithm: CredentialStore.ALGORITHM,
      keyDerivationIterations:
        this.config.keyDerivationIterations || CredentialStore.PBKDF2_ITERATIONS,
    };
  }

  /**
   * Check if the store is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Change the encryption key and re-encrypt all credentials
   */
  public async changeEncryptionKey(newPassphrase: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Validate new passphrase strength
    if (newPassphrase.length < CredentialStore.MIN_PASSPHRASE_LENGTH) {
      throw new Error(
        `New passphrase must be at least ${CredentialStore.MIN_PASSPHRASE_LENGTH} characters long`
      );
    }

    try {
      // Decrypt all credentials with old key
      const decryptedCredentials: Array<{ provider: string; key: string; metadata: any }> = [];
      for (const [provider, encryptedCred] of this.credentials.entries()) {
        try {
          const key = this.decryptKey(encryptedCred);
          decryptedCredentials.push({
            provider,
            key,
            metadata: {
              createdAt: encryptedCred.createdAt,
              updatedAt: encryptedCred.updatedAt,
              expiresAt: encryptedCred.expiresAt,
            },
          });
        } catch (error) {
          console.error(`Failed to decrypt credential for ${provider}:`, error);
          return false;
        }
      }

      // Generate new salt and derive new key
      this.salt = crypto.randomBytes(CredentialStore.SALT_LENGTH);
      const saltPath = path.join(path.dirname(this.config.storagePath!), '.store-salt');
      await fs.writeFile(saltPath, this.salt, { mode: 0o600 });

      // Update config with new passphrase
      this.config.encryptionKey = newPassphrase;

      // Derive new encryption key
      this.encryptionKey = await this.generateEncryptionKey();

      // Re-encrypt all credentials with new key
      this.credentials.clear();
      for (const { provider, key, metadata } of decryptedCredentials) {
        const encryptedCred = this.encryptKey(key);
        const fullCred: EncryptedCredential = {
          provider,
          ...encryptedCred,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
        };
        if (metadata.expiresAt) {
          fullCred.expiresAt = metadata.expiresAt;
        }
        this.credentials.set(provider, fullCred);
      }

      // Save to persistent storage
      return await this.saveCredentials();
    } catch (error) {
      console.error('Failed to change encryption key:', error);
      return false;
    }
  }
}
