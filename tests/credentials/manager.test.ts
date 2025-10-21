/**
 * manager.test.ts
 *
 * Comprehensive unit tests for the CredentialManager class.
 * Tests credential discovery, storage, retrieval, encryption, and lifecycle management.
 */

import { CredentialManager } from '../../src/credentials/manager';
import { CredentialDiscovery } from '../../src/credentials/discovery';
import { CredentialStore } from '../../src/credentials/store';
import { CredentialConfig } from '../../src/credentials/types';

// Mock the dependencies
jest.mock('../../src/credentials/discovery');
jest.mock('../../src/credentials/store');

describe('CredentialManager', () => {
  let manager: CredentialManager;
  let mockDiscovery: jest.Mocked<CredentialDiscovery>;
  let mockStore: jest.Mocked<CredentialStore>;

  beforeEach(() => {
    // Arrange: Reset mocks and create fresh instances before each test
    jest.clearAllMocks();

    // Create mock instances
    mockDiscovery = {
      discoverAll: jest.fn(),
      getStats: jest.fn(),
    } as any;

    mockStore = {
      initialize: jest.fn(),
      storeCredential: jest.fn(),
      retrieveCredential: jest.fn(),
      removeCredential: jest.fn(),
      listProviders: jest.fn(),
      validateAllCredentials: jest.fn(),
      rotateCredential: jest.fn(),
      getStats: jest.fn(),
      exportCredentials: jest.fn(),
      importCredentials: jest.fn(),
      clearAllCredentials: jest.fn(),
      changeEncryptionKey: jest.fn(),
    } as any;

    // Mock the constructor calls
    (CredentialDiscovery as jest.Mock).mockImplementation(() => mockDiscovery);
    (CredentialStore as jest.Mock).mockImplementation(() => mockStore);

    manager = new CredentialManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new CredentialManager instance', () => {
      // Arrange & Act
      const newManager = new CredentialManager();

      // Assert
      expect(newManager).toBeInstanceOf(CredentialManager);
      expect(CredentialDiscovery).toHaveBeenCalled();
      expect(CredentialStore).toHaveBeenCalled();
    });

    it('should initialize with empty config when not provided', () => {
      // Arrange & Act
      const newManager = new CredentialManager();

      // Assert
      expect(newManager).toBeDefined();
    });

    it('should accept custom config', () => {
      // Arrange
      const config: CredentialConfig = {
        openai: 'test-key',
      };

      // Act
      const newManager = new CredentialManager(config);

      // Assert
      expect(newManager).toBeDefined();
    });

    it('should create discovery and store instances', () => {
      // Arrange & Act
      const newManager = new CredentialManager();

      // Assert
      expect(CredentialDiscovery).toHaveBeenCalled();
      expect(CredentialStore).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await manager.initialize();

      // Assert
      expect(result).toBe(true);
      expect(mockStore.initialize).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Loading credential configuration...');
    });

    it('should return false on initialization failure', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValue(false);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await manager.initialize();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle store initialization errors', async () => {
      // Arrange
      mockStore.initialize.mockRejectedValue(new Error('Store init failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await manager.initialize();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize credential manager:',
        expect.any(Error)
      );
    });

    it('should load configuration during initialization', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await manager.initialize();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Loading credential configuration...');
    });

    it('should be callable multiple times', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValue(true);

      // Act
      const result1 = await manager.initialize();
      const result2 = await manager.initialize();

      // Assert
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('discoverAll', () => {
    it('should discover and store credentials successfully', async () => {
      // Arrange
      const discoveredCreds = [
        { provider: 'openai', key: 'sk-test', isValid: true },
        { provider: 'anthropic', key: 'sk-ant-test', isValid: true },
      ];
      mockDiscovery.discoverAll.mockResolvedValue(discoveredCreds as any);
      mockStore.storeCredential.mockResolvedValue(true);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(true);
      expect(mockDiscovery.discoverAll).toHaveBeenCalled();
      expect(mockStore.storeCredential).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('Discovered and stored 2 valid credentials');
    });

    it('should skip invalid credentials', async () => {
      // Arrange
      const discoveredCreds = [
        { provider: 'openai', key: 'sk-test', isValid: true },
        { provider: 'anthropic', key: 'invalid', isValid: false },
      ];
      mockDiscovery.discoverAll.mockResolvedValue(discoveredCreds as any);
      mockStore.storeCredential.mockResolvedValue(true);

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(true);
      expect(mockStore.storeCredential).toHaveBeenCalledTimes(1);
    });

    it('should handle discovery errors', async () => {
      // Arrange
      mockDiscovery.discoverAll.mockRejectedValue(new Error('Discovery failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle store failure for individual credentials', async () => {
      // Arrange
      const discoveredCreds = [
        { provider: 'openai', key: 'sk-test', isValid: true },
        { provider: 'anthropic', key: 'sk-ant-test', isValid: true },
      ];
      mockDiscovery.discoverAll.mockResolvedValue(discoveredCreds as any);
      mockStore.storeCredential.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Discovered and stored 1 valid credentials');
    });

    it('should handle empty discovery results', async () => {
      // Arrange
      mockDiscovery.discoverAll.mockResolvedValue([]);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Discovered and stored 0 valid credentials');
    });
  });

  describe('getCredential', () => {
    it('should retrieve credential from store', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue('sk-test-key');

      // Act
      const result = await manager.getCredential('openai');

      // Assert
      expect(result).toBe('sk-test-key');
      expect(mockStore.retrieveCredential).toHaveBeenCalledWith('openai');
    });

    it('should discover credential if not in store', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue(null);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'openai', key: 'sk-discovered', isValid: true } as any,
      ]);
      mockStore.storeCredential.mockResolvedValue(true);

      // Act
      const result = await manager.getCredential('openai');

      // Assert
      expect(result).toBe('sk-discovered');
      expect(mockStore.storeCredential).toHaveBeenCalledWith('openai', 'sk-discovered');
    });

    it('should return null if credential not found', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue(null);
      mockDiscovery.discoverAll.mockResolvedValue([]);

      // Act
      const result = await manager.getCredential('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should skip invalid discovered credentials', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue(null);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'openai', key: 'sk-invalid', isValid: false } as any,
      ]);

      // Act
      const result = await manager.getCredential('openai');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('setCredential', () => {
    it('should store credential successfully', async () => {
      // Arrange
      mockStore.storeCredential.mockResolvedValue(true);

      // Act
      const result = await manager.setCredential('openai', 'sk-new-key');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.storeCredential).toHaveBeenCalledWith('openai', 'sk-new-key');
    });

    it('should return false on store failure', async () => {
      // Arrange
      mockStore.storeCredential.mockResolvedValue(false);

      // Act
      const result = await manager.setCredential('openai', 'sk-new-key');

      // Assert
      expect(result).toBe(false);
    });

    it('should handle empty key', async () => {
      // Arrange
      mockStore.storeCredential.mockResolvedValue(true);

      // Act
      const result = await manager.setCredential('openai', '');

      // Assert
      expect(mockStore.storeCredential).toHaveBeenCalledWith('openai', '');
    });
  });

  describe('removeCredential', () => {
    it('should remove credential successfully', async () => {
      // Arrange
      mockStore.removeCredential.mockResolvedValue(true);

      // Act
      const result = await manager.removeCredential('openai');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.removeCredential).toHaveBeenCalledWith('openai');
    });

    it('should return false if credential does not exist', async () => {
      // Arrange
      mockStore.removeCredential.mockResolvedValue(false);

      // Act
      const result = await manager.removeCredential('nonexistent');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getProviderStatus', () => {
    it('should return status for all providers', async () => {
      // Arrange
      mockStore.listProviders.mockReturnValue(['openai', 'anthropic']);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'google', key: 'test', isValid: true, lastChecked: new Date() } as any,
      ]);

      // Act
      const status = await manager.getProviderStatus();

      // Assert
      expect(status).toBeInstanceOf(Array);
      expect(status.length).toBeGreaterThan(0);
    });

    it('should include stored providers', async () => {
      // Arrange
      mockStore.listProviders.mockReturnValue(['openai']);
      mockDiscovery.discoverAll.mockResolvedValue([]);

      // Act
      const status = await manager.getProviderStatus();

      // Assert
      const openaiStatus = status.find((s) => s.provider === 'openai');
      expect(openaiStatus).toBeDefined();
      expect(openaiStatus?.hasCredential).toBe(true);
    });

    it('should include discovered providers', async () => {
      // Arrange
      mockStore.listProviders.mockReturnValue([]);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'anthropic', key: 'test', isValid: true, lastChecked: new Date() } as any,
      ]);

      // Act
      const status = await manager.getProviderStatus();

      // Assert
      const anthropicStatus = status.find((s) => s.provider === 'anthropic');
      expect(anthropicStatus).toBeDefined();
    });

    it('should merge information from multiple sources', async () => {
      // Arrange
      mockStore.listProviders.mockReturnValue(['openai']);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'openai', key: 'test', isValid: true, lastChecked: new Date() } as any,
      ]);

      // Act
      const status = await manager.getProviderStatus();

      // Assert
      const openaiStatus = status.find((s) => s.provider === 'openai');
      expect(openaiStatus?.hasCredential).toBe(true);
      expect(openaiStatus?.isValid).toBe(true);
    });
  });

  describe('validateAllCredentials', () => {
    it('should validate all stored credentials', async () => {
      // Arrange
      const validationResult = { valid: 5, invalid: 1, expired: 2 };
      mockStore.validateAllCredentials.mockResolvedValue(validationResult);

      // Act
      const result = await manager.validateAllCredentials();

      // Assert
      expect(result).toEqual(validationResult);
      expect(mockStore.validateAllCredentials).toHaveBeenCalled();
    });

    it('should return validation statistics', async () => {
      // Arrange
      mockStore.validateAllCredentials.mockResolvedValue({
        valid: 3,
        invalid: 0,
        expired: 0,
      });

      // Act
      const result = await manager.validateAllCredentials();

      // Assert
      expect(result.valid).toBe(3);
      expect(result.invalid).toBe(0);
      expect(result.expired).toBe(0);
    });
  });

  describe('rotateCredential', () => {
    it('should rotate credential successfully', async () => {
      // Arrange
      mockStore.rotateCredential.mockResolvedValue(true);

      // Act
      const result = await manager.rotateCredential('openai', 'sk-new-rotated-key');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.rotateCredential).toHaveBeenCalledWith('openai', 'sk-new-rotated-key');
    });

    it('should return false on rotation failure', async () => {
      // Arrange
      mockStore.rotateCredential.mockResolvedValue(false);

      // Act
      const result = await manager.rotateCredential('openai', 'sk-new-key');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getStoreStats', () => {
    it('should return store statistics', () => {
      // Arrange
      const stats = {
        totalCredentials: 5,
        encryptedCredentials: 5,
        expiredCredentials: 1,
        providers: ['openai', 'anthropic'],
      };
      mockStore.getStats.mockReturnValue(stats);

      // Act
      const result = manager.getStoreStats();

      // Assert
      expect(result).toEqual(stats);
      expect(mockStore.getStats).toHaveBeenCalled();
    });
  });

  describe('exportCredentials', () => {
    it('should export credentials successfully', async () => {
      // Arrange
      mockStore.exportCredentials.mockResolvedValue(true);

      // Act
      const result = await manager.exportCredentials('/path/to/export.json');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.exportCredentials).toHaveBeenCalledWith('/path/to/export.json');
    });

    it('should return false on export failure', async () => {
      // Arrange
      mockStore.exportCredentials.mockResolvedValue(false);

      // Act
      const result = await manager.exportCredentials('/invalid/path');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('importCredentials', () => {
    it('should import credentials successfully', async () => {
      // Arrange
      mockStore.importCredentials.mockResolvedValue(true);

      // Act
      const result = await manager.importCredentials('/path/to/import.json');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.importCredentials).toHaveBeenCalledWith('/path/to/import.json');
    });

    it('should return false on import failure', async () => {
      // Arrange
      mockStore.importCredentials.mockResolvedValue(false);

      // Act
      const result = await manager.importCredentials('/invalid/path');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('clearAllCredentials', () => {
    it('should clear all credentials successfully', async () => {
      // Arrange
      mockStore.clearAllCredentials.mockResolvedValue(true);

      // Act
      const result = await manager.clearAllCredentials();

      // Assert
      expect(result).toBe(true);
      expect(mockStore.clearAllCredentials).toHaveBeenCalled();
    });

    it('should return false on clear failure', async () => {
      // Arrange
      mockStore.clearAllCredentials.mockResolvedValue(false);

      // Act
      const result = await manager.clearAllCredentials();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('changeEncryptionKey', () => {
    it('should change encryption key successfully', async () => {
      // Arrange
      mockStore.changeEncryptionKey.mockResolvedValue(true);

      // Act
      const result = await manager.changeEncryptionKey('new-secure-passphrase');

      // Assert
      expect(result).toBe(true);
      expect(mockStore.changeEncryptionKey).toHaveBeenCalledWith('new-secure-passphrase');
    });

    it('should return false on key change failure', async () => {
      // Arrange
      mockStore.changeEncryptionKey.mockResolvedValue(false);

      // Act
      const result = await manager.changeEncryptionKey('new-passphrase');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getDiscoveryStats', () => {
    it('should return discovery statistics', () => {
      // Arrange
      const stats = {
        totalCredentials: 3,
        validCredentials: 2,
        sourceBreakdown: { environment: 2, file: 1 },
        providerBreakdown: { openai: 1, anthropic: 2 },
      };
      mockDiscovery.getStats.mockReturnValue(stats);

      // Act
      const result = manager.getDiscoveryStats();

      // Assert
      expect(result).toEqual(stats);
      expect(mockDiscovery.getStats).toHaveBeenCalled();
    });
  });

  describe('getOverallStats', () => {
    it('should return combined statistics', async () => {
      // Arrange
      const storeStats = {
        totalCredentials: 5,
        encryptedCredentials: 5,
        expiredCredentials: 1,
        providers: ['openai'],
      };
      const discoveryStats = {
        totalCredentials: 3,
        validCredentials: 2,
        sourceBreakdown: { environment: 2 },
        providerBreakdown: { openai: 2 },
      };
      const validationResult = { valid: 4, invalid: 1, expired: 1 };

      mockStore.getStats.mockReturnValue(storeStats);
      mockDiscovery.getStats.mockReturnValue(discoveryStats);
      mockStore.validateAllCredentials.mockResolvedValue(validationResult);

      // Act
      const result = await manager.getOverallStats();

      // Assert
      expect(result.store).toEqual(storeStats);
      expect(result.discovery).toEqual(discoveryStats);
      expect(result.validation).toEqual(validationResult);
    });
  });

  describe('integration tests', () => {
    it('should complete full workflow: initialize, discover, get, clear', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValue(true);
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'openai', key: 'sk-test', isValid: true } as any,
      ]);
      mockStore.storeCredential.mockResolvedValue(true);
      mockStore.retrieveCredential.mockResolvedValue('sk-test');
      mockStore.clearAllCredentials.mockResolvedValue(true);

      // Act
      await manager.initialize();
      await manager.discoverAll();
      const cred = await manager.getCredential('openai');
      await manager.clearAllCredentials();

      // Assert
      expect(cred).toBe('sk-test');
    });

    it('should handle multiple concurrent operations', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue('sk-test');
      mockStore.storeCredential.mockResolvedValue(true);

      // Act
      const promises = [
        manager.getCredential('openai'),
        manager.setCredential('anthropic', 'sk-ant-test'),
        manager.getCredential('google'),
      ];
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should handle null provider name', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue(null);

      // Act
      const result = await manager.getCredential(null as any);

      // Assert
      expect(mockStore.retrieveCredential).toHaveBeenCalledWith(null);
    });

    it('should handle empty provider name', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue(null);

      // Act
      const result = await manager.getCredential('');

      // Assert
      expect(mockStore.retrieveCredential).toHaveBeenCalledWith('');
    });

    it('should handle undefined config', () => {
      // Arrange & Act
      const newManager = new CredentialManager(undefined);

      // Assert
      expect(newManager).toBeDefined();
    });

    it('should handle discovery returning null', async () => {
      // Arrange
      mockDiscovery.discoverAll.mockResolvedValue(null as any);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('error recovery', () => {
    it('should recover from initialization failure', async () => {
      // Arrange
      mockStore.initialize.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      // Act
      const firstTry = await manager.initialize();
      const secondTry = await manager.initialize();

      // Assert
      expect(firstTry).toBe(false);
      expect(secondTry).toBe(true);
    });

    it('should continue operation after credential store failure', async () => {
      // Arrange
      mockDiscovery.discoverAll.mockResolvedValue([
        { provider: 'openai', key: 'sk-test', isValid: true } as any,
      ]);
      mockStore.storeCredential.mockResolvedValue(false);

      // Act
      const result = await manager.discoverAll();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('performance tests', () => {
    it('should create manager quickly', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const newManager = new CredentialManager();
      const duration = Date.now() - startTime;

      // Assert
      expect(newManager).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid credential requests', async () => {
      // Arrange
      mockStore.retrieveCredential.mockResolvedValue('sk-test');
      const startTime = Date.now();

      // Act
      await Promise.all([
        manager.getCredential('openai'),
        manager.getCredential('anthropic'),
        manager.getCredential('google'),
      ]);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500);
    });
  });
});
