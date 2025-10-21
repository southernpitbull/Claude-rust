/**
 * ConfigEncryption.ts
 *
 * Secure encryption for sensitive configuration values using AES-256.
 * Supports selective encryption, key management, and keyring integration.
 *
 * @module config/ConfigEncryption
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Encryption algorithm
 */
const ALGORITHM = 'aes-256-gcm';

/**
 * Encryption key length in bytes
 */
const KEY_LENGTH = 32;

/**
 * IV length in bytes
 */
const IV_LENGTH = 16;

/**
 * Auth tag length in bytes
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Encryption marker prefix
 */
const ENCRYPTION_MARKER = 'enc:';

/**
 * Encryption options
 */
export interface EncryptionOptions {
  keyPath?: string;
  masterKey?: string;
  useKeyring?: boolean;
  rotateKey?: boolean;
}

/**
 * Encrypted value format
 */
export interface EncryptedValue {
  iv: string;
  authTag: string;
  encrypted: string;
}

/**
 * Configuration encryption class
 *
 * Provides secure encryption for sensitive configuration values:
 * - AES-256-GCM encryption
 * - Secure key management
 * - Selective field encryption
 * - Key rotation support
 * - Keyring integration (optional)
 */
export class ConfigEncryption {
  private key: Buffer | null = null;
  private keyPath: string;
  private options: Required<EncryptionOptions>;

  /**
   * Create a new ConfigEncryption instance
   *
   * @param {EncryptionOptions} options - Encryption options
   */
  constructor(options: EncryptionOptions = {}) {
    this.keyPath = options.keyPath || this.getDefaultKeyPath();
    this.options = {
      keyPath: this.keyPath,
      masterKey: options.masterKey || '',
      useKeyring: options.useKeyring ?? false,
      rotateKey: options.rotateKey ?? false,
    };
  }

  /**
   * Initialize encryption (load or generate key)
   *
   * @returns {Promise<void>}
   */
  public async initialize(): Promise<void> {
    if (this.options.masterKey) {
      // Use provided master key
      this.key = this.deriveKey(this.options.masterKey);
    } else {
      // Try to load existing key or generate new one
      this.key = await this.loadOrGenerateKey();
    }
  }

  /**
   * Encrypt a value
   *
   * @param {string} value - Value to encrypt
   * @returns {string} Encrypted value with marker
   */
  public encrypt(value: string): string {
    if (!this.key) {
      throw new Error('Encryption not initialized. Call initialize() first.');
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    // Encrypt
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Create encrypted value object
    const encryptedValue: EncryptedValue = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };

    // Return with marker
    return ENCRYPTION_MARKER + JSON.stringify(encryptedValue);
  }

  /**
   * Decrypt a value
   *
   * @param {string} encryptedValue - Encrypted value with marker
   * @returns {string} Decrypted value
   */
  public decrypt(encryptedValue: string): string {
    if (!this.key) {
      throw new Error('Encryption not initialized. Call initialize() first.');
    }

    // Check for encryption marker
    if (!encryptedValue.startsWith(ENCRYPTION_MARKER)) {
      throw new Error('Value is not encrypted');
    }

    // Remove marker and parse
    const valueStr = encryptedValue.substring(ENCRYPTION_MARKER.length);
    const value: EncryptedValue = JSON.parse(valueStr);

    // Convert hex strings to buffers
    const iv = Buffer.from(value.iv, 'hex');
    const authTag = Buffer.from(value.authTag, 'hex');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(value.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Check if a value is encrypted
   *
   * @param {string} value - Value to check
   * @returns {boolean} True if encrypted
   */
  public isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith(ENCRYPTION_MARKER);
  }

  /**
   * Encrypt sensitive fields in a configuration object
   *
   * @param {Record<string, unknown>} config - Configuration object
   * @param {string[]} sensitiveFields - Field names to encrypt
   * @returns {Record<string, unknown>} Configuration with encrypted fields
   */
  public encryptFields(
    config: Record<string, unknown>,
    sensitiveFields: string[]
  ): Record<string, unknown> {
    const result = { ...config };

    for (const field of sensitiveFields) {
      const value = this.getNestedValue(result, field);
      if (typeof value === 'string' && !this.isEncrypted(value)) {
        this.setNestedValue(result, field, this.encrypt(value));
      }
    }

    return result;
  }

  /**
   * Decrypt sensitive fields in a configuration object
   *
   * @param {Record<string, unknown>} config - Configuration object
   * @param {string[]} sensitiveFields - Field names to decrypt
   * @returns {Record<string, unknown>} Configuration with decrypted fields
   */
  public decryptFields(
    config: Record<string, unknown>,
    sensitiveFields: string[]
  ): Record<string, unknown> {
    const result = { ...config };

    for (const field of sensitiveFields) {
      const value = this.getNestedValue(result, field);
      if (typeof value === 'string' && this.isEncrypted(value)) {
        this.setNestedValue(result, field, this.decrypt(value));
      }
    }

    return result;
  }

  /**
   * Encrypt API keys in provider configurations
   *
   * @param {Record<string, unknown>} providers - Provider configurations
   * @returns {Record<string, unknown>} Providers with encrypted API keys
   */
  public encryptApiKeys(providers: Record<string, unknown>): Record<string, unknown> {
    const result = { ...providers };

    for (const [key, provider] of Object.entries(result)) {
      if (typeof provider === 'object' && provider !== null) {
        const providerConfig = provider as Record<string, unknown>;
        if (typeof providerConfig.apiKey === 'string' && !this.isEncrypted(providerConfig.apiKey)) {
          providerConfig.apiKey = this.encrypt(providerConfig.apiKey);
        }
      }
    }

    return result;
  }

  /**
   * Decrypt API keys in provider configurations
   *
   * @param {Record<string, unknown>} providers - Provider configurations
   * @returns {Record<string, unknown>} Providers with decrypted API keys
   */
  public decryptApiKeys(providers: Record<string, unknown>): Record<string, unknown> {
    const result = { ...providers };

    for (const [key, provider] of Object.entries(result)) {
      if (typeof provider === 'object' && provider !== null) {
        const providerConfig = provider as Record<string, unknown>;
        if (typeof providerConfig.apiKey === 'string' && this.isEncrypted(providerConfig.apiKey)) {
          providerConfig.apiKey = this.decrypt(providerConfig.apiKey);
        }
      }
    }

    return result;
  }

  /**
   * Generate a new encryption key
   *
   * @returns {Buffer} Generated key
   */
  public generateKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
  }

  /**
   * Save encryption key to file
   *
   * @param {Buffer} key - Key to save
   * @returns {Promise<void>}
   */
  public async saveKey(key: Buffer): Promise<void> {
    const keyDir = path.dirname(this.keyPath);
    await fs.mkdir(keyDir, { recursive: true });
    await fs.writeFile(this.keyPath, key.toString('hex'), { mode: 0o600 });
  }

  /**
   * Load encryption key from file
   *
   * @returns {Promise<Buffer>} Loaded key
   */
  public async loadKey(): Promise<Buffer> {
    const keyHex = await fs.readFile(this.keyPath, 'utf-8');
    return Buffer.from(keyHex.trim(), 'hex');
  }

  /**
   * Rotate encryption key (re-encrypt all values with new key)
   *
   * @param {Record<string, unknown>} config - Configuration to re-encrypt
   * @param {string[]} encryptedFields - Fields that are encrypted
   * @returns {Promise<Record<string, unknown>>} Re-encrypted configuration
   */
  public async rotateKey(
    config: Record<string, unknown>,
    encryptedFields: string[]
  ): Promise<Record<string, unknown>> {
    // Decrypt with old key
    const decrypted = this.decryptFields(config, encryptedFields);

    // Generate new key
    const newKey = this.generateKey();
    await this.saveKey(newKey);
    this.key = newKey;

    // Encrypt with new key
    return this.encryptFields(decrypted, encryptedFields);
  }

  /**
   * Load or generate encryption key
   *
   * @returns {Promise<Buffer>} Encryption key
   */
  private async loadOrGenerateKey(): Promise<Buffer> {
    try {
      // Try to load existing key
      return await this.loadKey();
    } catch {
      // Generate new key if not found
      const key = this.generateKey();
      await this.saveKey(key);
      return key;
    }
  }

  /**
   * Derive key from master key
   *
   * @param {string} masterKey - Master key
   * @returns {Buffer} Derived key
   */
  private deriveKey(masterKey: string): Buffer {
    return crypto.pbkdf2Sync(masterKey, 'aichitect-salt', 100000, KEY_LENGTH, 'sha256');
  }

  /**
   * Get default key path
   *
   * @returns {string} Default key path
   */
  private getDefaultKeyPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.aichitect', '.key');
  }

  /**
   * Get nested value from object
   *
   * @param {Record<string, unknown>} obj - Object to search
   * @param {string} path - Dot-notation path
   * @returns {unknown} Value at path
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.');
    let value: unknown = obj;

    for (const key of keys) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set nested value in object
   *
   * @param {Record<string, unknown>} obj - Object to modify
   * @param {string} path - Dot-notation path
   * @param {unknown} value - Value to set
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }
}

/**
 * Create an encryption instance
 *
 * @param {EncryptionOptions} options - Encryption options
 * @returns {ConfigEncryption} Encryption instance
 */
export function createEncryption(options?: EncryptionOptions): ConfigEncryption {
  return new ConfigEncryption(options);
}

/**
 * Quick encrypt helper
 *
 * @param {string} value - Value to encrypt
 * @param {string} masterKey - Master key
 * @returns {string} Encrypted value
 */
export function encryptValue(value: string, masterKey: string): string {
  const encryption = new ConfigEncryption({ masterKey });
  return encryption.encrypt(value);
}

/**
 * Quick decrypt helper
 *
 * @param {string} encryptedValue - Encrypted value
 * @param {string} masterKey - Master key
 * @returns {string} Decrypted value
 */
export function decryptValue(encryptedValue: string, masterKey: string): string {
  const encryption = new ConfigEncryption({ masterKey });
  return encryption.decrypt(encryptedValue);
}
