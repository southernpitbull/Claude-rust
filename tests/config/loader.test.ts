/**
 * Tests for configuration loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  loadConfigFile,
  loadEnvOverrides,
  discoverConfigFiles,
  configExists,
  getPrimaryConfigPath,
} from '../../src/config/loader';
import { DEFAULT_CONFIG } from '../../src/config/schema';

// Mock file system
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Configuration Loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadConfigFile', () => {
    it('should load JSON config file', async () => {
      const configPath = '/test/config.json';
      const configData = JSON.stringify({
        ai: { max_tokens: 16000 },
      });

      mockFs.readFile.mockResolvedValue(configData);

      const result = await loadConfigFile(configPath);

      expect(result).toEqual({ ai: { max_tokens: 16000 } });
      expect(mockFs.readFile).toHaveBeenCalledWith(configPath, 'utf-8');
    });

    it('should load TOML config file', async () => {
      const configPath = '/test/config.toml';
      const configData = '[ai]\nmax_tokens = 16000';

      mockFs.readFile.mockResolvedValue(configData);

      const result = await loadConfigFile(configPath);

      expect(result).toHaveProperty('ai');
      expect((result as { ai: { max_tokens: number } }).ai.max_tokens).toBe(
        16000
      );
    });

    it('should load YAML config file', async () => {
      const configPath = '/test/config.yaml';
      const configData = 'ai:\n  max_tokens: 16000';

      mockFs.readFile.mockResolvedValue(configData);

      const result = await loadConfigFile(configPath);

      expect(result).toHaveProperty('ai');
      expect((result as { ai: { max_tokens: number } }).ai.max_tokens).toBe(
        16000
      );
    });

    it('should throw error for invalid JSON', async () => {
      const configPath = '/test/config.json';
      mockFs.readFile.mockResolvedValue('invalid json');

      await expect(loadConfigFile(configPath)).rejects.toThrow();
    });
  });

  describe('loadEnvOverrides', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should load AI configuration from environment', () => {
      process.env.AIRCHITECT_AI_MAX_TOKENS = '16000';
      process.env.AIRCHITECT_AI_TEMPERATURE = '0.9';
      process.env.AIRCHITECT_AI_MODEL = 'gpt-4-turbo';

      const config = loadEnvOverrides();

      expect(config.ai?.max_tokens).toBe(16000);
      expect(config.ai?.temperature).toBe(0.9);
      expect(config.ai?.model).toBe('gpt-4-turbo');
    });

    it('should load memory configuration from environment', () => {
      process.env.AIRCHITECT_MEMORY_TYPE = 'llamaindex';
      process.env.AIRCHITECT_MEMORY_URL = 'http://localhost:9000';
      process.env.AIRCHITECT_MEMORY_ENABLE_PERSISTENCE = 'false';

      const config = loadEnvOverrides();

      expect(config.memory?.type).toBe('llamaindex');
      expect(config.memory?.url).toBe('http://localhost:9000');
      expect(config.memory?.enable_persistence).toBe(false);
    });

    it('should load logging configuration from environment', () => {
      process.env.AIRCHITECT_LOG_LEVEL = 'debug';
      process.env.AIRCHITECT_LOG_FORMAT = 'simple';

      const config = loadEnvOverrides();

      expect(config.logging?.level).toBe('debug');
      expect(config.logging?.format).toBe('simple');
    });

    it('should return empty config if no environment variables set', () => {
      const config = loadEnvOverrides();
      expect(Object.keys(config)).toHaveLength(0);
    });
  });

  describe('discoverConfigFiles', () => {
    it('should discover config files in search paths', async () => {
      mockFs.access
        .mockResolvedValueOnce(undefined) // .airchitect/config.toml exists
        .mockRejectedValue(new Error('ENOENT')); // others don't exist

      const sources = await discoverConfigFiles();

      expect(sources).toHaveLength(1);
      expect(sources[0]?.path).toContain('config.toml');
    });

    it('should return empty array if no config files found', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const sources = await discoverConfigFiles();

      expect(sources).toHaveLength(0);
    });
  });

  describe('configExists', () => {
    it('should return true if config file exists', async () => {
      mockFs.access.mockResolvedValueOnce(undefined);

      const exists = await configExists();

      expect(exists).toBe(true);
    });

    it('should return false if no config file exists', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const exists = await configExists();

      expect(exists).toBe(false);
    });
  });

  describe('getPrimaryConfigPath', () => {
    it('should return the highest priority config path', async () => {
      mockFs.access
        .mockRejectedValueOnce(new Error('ENOENT')) // skip first
        .mockResolvedValueOnce(undefined); // found

      const configPath = await getPrimaryConfigPath();

      expect(configPath).toBeTruthy();
      expect(configPath).toContain('config');
    });

    it('should return null if no config files found', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      const configPath = await getPrimaryConfigPath();

      expect(configPath).toBeNull();
    });
  });
});
