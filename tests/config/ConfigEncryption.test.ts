/**
 * ConfigEncryption Tests
 *
 * Comprehensive test suite for configuration encryption
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigEncryption } from '../../src/config/ConfigEncryption';

describe('ConfigEncryption', () => {
  let encryption: ConfigEncryption;
  const testMasterKey = 'test-master-key-12345';

  beforeEach(() => {
    encryption = new ConfigEncryption({ masterKey: testMasterKey });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a value', () => {
      const original = 'my-secret-api-key';
      const encrypted = encryption.encrypt(original);
      const decrypted = encryption.decrypt(encrypted);

      expect(encrypted).not.toBe(original);
      expect(encrypted).toContain('enc:');
      expect(decrypted).toBe(original);
    });

    it('should produce different encrypted values for same input', () => {
      const original = 'my-secret-api-key';
      const encrypted1 = encryption.encrypt(original);
      const encrypted2 = encryption.encrypt(original);

      expect(encrypted1).not.toBe(encrypted2);

      const decrypted1 = encryption.decrypt(encrypted1);
      const decrypted2 = encryption.decrypt(encrypted2);

      expect(decrypted1).toBe(original);
      expect(decrypted2).toBe(original);
    });

    it('should throw error when decrypting non-encrypted value', () => {
      expect(() => {
        encryption.decrypt('not-encrypted');
      }).toThrow('Value is not encrypted');
    });
  });

  describe('isEncrypted', () => {
    it('should detect encrypted values', () => {
      const encrypted = encryption.encrypt('test');
      expect(encryption.isEncrypted(encrypted)).toBe(true);
    });

    it('should detect non-encrypted values', () => {
      expect(encryption.isEncrypted('plain-text')).toBe(false);
    });
  });

  describe('encryptFields', () => {
    it('should encrypt specific fields', () => {
      const config = {
        apiKey: 'secret-key',
        publicValue: 'not-secret',
      };

      const encrypted = encryption.encryptFields(config, ['apiKey']);

      expect(encryption.isEncrypted(encrypted.apiKey as string)).toBe(true);
      expect(encrypted.publicValue).toBe('not-secret');
    });

    it('should handle nested fields', () => {
      const config = {
        provider: {
          apiKey: 'secret-key',
        },
      };

      const encrypted = encryption.encryptFields(config, ['provider.apiKey']);

      expect(
        encryption.isEncrypted((encrypted.provider as Record<string, unknown>).apiKey as string)
      ).toBe(true);
    });
  });

  describe('decryptFields', () => {
    it('should decrypt specific fields', () => {
      const config = {
        apiKey: 'secret-key',
        publicValue: 'not-secret',
      };

      const encrypted = encryption.encryptFields(config, ['apiKey']);
      const decrypted = encryption.decryptFields(encrypted, ['apiKey']);

      expect(decrypted.apiKey).toBe('secret-key');
      expect(decrypted.publicValue).toBe('not-secret');
    });
  });

  describe('encryptApiKeys', () => {
    it('should encrypt API keys in provider configs', () => {
      const providers = {
        openai: {
          enabled: true,
          apiKey: 'sk-test-key',
        },
        anthropic: {
          enabled: true,
          apiKey: 'sk-ant-test-key',
        },
      };

      const encrypted = encryption.encryptApiKeys(providers);

      expect(
        encryption.isEncrypted((encrypted.openai as Record<string, unknown>).apiKey as string)
      ).toBe(true);
      expect(
        encryption.isEncrypted((encrypted.anthropic as Record<string, unknown>).apiKey as string)
      ).toBe(true);
    });
  });

  describe('decryptApiKeys', () => {
    it('should decrypt API keys in provider configs', () => {
      const providers = {
        openai: {
          enabled: true,
          apiKey: 'sk-test-key',
        },
      };

      const encrypted = encryption.encryptApiKeys(providers);
      const decrypted = encryption.decryptApiKeys(encrypted);

      expect((decrypted.openai as Record<string, unknown>).apiKey).toBe('sk-test-key');
    });
  });

  describe('key generation', () => {
    it('should generate a key', () => {
      const key = encryption.generateKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(32); // 32 bytes for AES-256
    });
  });
});
