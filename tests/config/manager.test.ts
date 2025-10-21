/**
 * Tests for configuration manager
 */

import { ConfigurationManager } from '../../src/config/manager';
import * as loader from '../../src/config/loader';
import { DEFAULT_CONFIG } from '../../src/config/schema';
import type { Config, PartialConfig } from '../../src/config/types';

// Mock the loader module
jest.mock('../../src/config/loader');
const mockLoader = loader as jest.Mocked<typeof loader>;

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new ConfigurationManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('initialize', () => {
    it('should initialize with default config', async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);

      const config = await manager.initialize();

      expect(config).toBeDefined();
      expect(config.ai).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(mockLoader.loadConfig).toHaveBeenCalled();
    });

    it('should throw if initialization fails', async () => {
      mockLoader.loadConfig.mockRejectedValue(new Error('Load failed'));

      await expect(manager.initialize()).rejects.toThrow('Load failed');
    });
  });

  describe('getAll', () => {
    it('should return entire configuration', async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);

      await manager.initialize();
      const config = manager.getAll();

      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('should throw if not initialized', () => {
      expect(() => manager.getAll()).toThrow('not initialized');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should get nested configuration value', () => {
      const maxTokens = manager.get<number>('ai.max_tokens');
      expect(maxTokens).toBe(8000);
    });

    it('should get deep nested value', () => {
      const apiKey = manager.get<string>('providers.openai.api_key');
      expect(apiKey).toBe('${OPENAI_API_KEY}');
    });

    it('should throw for invalid path', () => {
      expect(() => manager.get('invalid.path.here')).toThrow(
        'Configuration path not found'
      );
    });

    it('should throw if not initialized', () => {
      const uninitializedManager = new ConfigurationManager();
      expect(() => uninitializedManager.get('ai.max_tokens')).toThrow(
        'not initialized'
      );
    });
  });

  describe('set', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should set configuration value', () => {
      manager.set('ai.max_tokens', 16000);
      const value = manager.get<number>('ai.max_tokens');
      expect(value).toBe(16000);
    });

    it('should set nested value', () => {
      manager.set('providers.openai.api_key', 'sk-test');
      const value = manager.get<string>('providers.openai.api_key');
      expect(value).toBe('sk-test');
    });

    it('should throw for invalid path', () => {
      expect(() => manager.set('', 'value')).toThrow('Invalid configuration path');
    });

    it('should notify change listeners', () => {
      const callback = jest.fn();
      manager.onChange(callback);

      manager.set('ai.max_tokens', 16000);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should merge partial configuration', () => {
      const updates: PartialConfig = {
        ai: { max_tokens: 16000 },
        logging: { level: 'debug' },
      };

      manager.update(updates);

      expect(manager.get<number>('ai.max_tokens')).toBe(16000);
      expect(manager.get<string>('logging.level')).toBe('debug');
      expect(manager.get<number>('ai.temperature')).toBe(0.7); // unchanged
    });

    it('should notify change listeners', () => {
      const callback = jest.fn();
      manager.onChange(callback);

      manager.update({ ai: { max_tokens: 16000 } });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('reload', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should reload configuration', async () => {
      const newConfig = {
        ...DEFAULT_CONFIG,
        ai: { ...DEFAULT_CONFIG.ai, max_tokens: 16000 },
      };
      mockLoader.loadConfig.mockResolvedValue(newConfig);

      await manager.reload();

      expect(manager.get<number>('ai.max_tokens')).toBe(16000);
    });

    it('should notify listeners if config changed', async () => {
      const callback = jest.fn();
      manager.onChange(callback);

      const newConfig = {
        ...DEFAULT_CONFIG,
        ai: { ...DEFAULT_CONFIG.ai, max_tokens: 16000 },
      };
      mockLoader.loadConfig.mockResolvedValue(newConfig);

      await manager.reload();

      expect(callback).toHaveBeenCalled();
    });

    it('should not notify if config unchanged', async () => {
      const callback = jest.fn();
      manager.onChange(callback);

      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });

      await manager.reload();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('validate', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should validate correct configuration', () => {
      const isValid = manager.validate();
      expect(isValid).toBe(true);
    });

    it('should detect invalid configuration', () => {
      manager.set('ai.max_tokens', -100);
      const isValid = manager.validate();
      expect(isValid).toBe(false);
    });

    it('should return validation errors', () => {
      manager.set('ai.temperature', 5.0); // invalid: > 2
      const errors = manager.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('temperature'))).toBe(true);
    });
  });

  describe('onChange / offChange', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should register change callback', () => {
      const callback = jest.fn();
      manager.onChange(callback);

      manager.set('ai.max_tokens', 16000);

      expect(callback).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should unregister change callback', () => {
      const callback = jest.fn();
      manager.onChange(callback);
      manager.offChange(callback);

      manager.set('ai.max_tokens', 16000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      manager.onChange(callback1);
      manager.onChange(callback2);

      manager.set('ai.max_tokens', 16000);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('getConfigPath', () => {
    it('should return config file path', async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue('/test/config.toml');

      await manager.initialize();

      expect(manager.getConfigPath()).toBe('/test/config.toml');
    });

    it('should return null if no config file', async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);

      await manager.initialize();

      expect(manager.getConfigPath()).toBeNull();
    });
  });

  describe('watch functionality', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue('/test/config.toml');
      await manager.initialize();
    });

    it('should enable watching', () => {
      manager.enableWatch();
      expect(manager.isWatchEnabled()).toBe(true);
    });

    it('should disable watching', () => {
      manager.enableWatch();
      manager.disableWatch();
      expect(manager.isWatchEnabled()).toBe(false);
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
      mockLoader.getPrimaryConfigPath.mockResolvedValue(null);
      await manager.initialize();
    });

    it('should clean up resources', () => {
      manager.enableWatch();
      const callback = jest.fn();
      manager.onChange(callback);

      manager.dispose();

      expect(manager.isWatchEnabled()).toBe(false);

      // Reinitialize for next test
      mockLoader.loadConfig.mockResolvedValue({ ...DEFAULT_CONFIG });
    });
  });
});
