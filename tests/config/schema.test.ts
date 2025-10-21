/**
 * Tests for configuration schema and validation
 */

import {
  DEFAULT_CONFIG,
  validateConfig,
  substituteEnvVars,
  mergeConfig,
} from '../../src/config/schema';
import type { Config, PartialConfig } from '../../src/config/types';

describe('Configuration Schema', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have all required sections', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('ai');
      expect(DEFAULT_CONFIG).toHaveProperty('memory');
      expect(DEFAULT_CONFIG).toHaveProperty('providers');
      expect(DEFAULT_CONFIG).toHaveProperty('agents');
      expect(DEFAULT_CONFIG).toHaveProperty('security');
      expect(DEFAULT_CONFIG).toHaveProperty('checkpoint');
      expect(DEFAULT_CONFIG).toHaveProperty('logging');
    });

    it('should have valid AI configuration', () => {
      expect(DEFAULT_CONFIG.ai.default_provider).toBe('openai');
      expect(DEFAULT_CONFIG.ai.max_tokens).toBe(8000);
      expect(DEFAULT_CONFIG.ai.temperature).toBe(0.7);
      expect(DEFAULT_CONFIG.ai.model).toBe('gpt-4');
      expect(DEFAULT_CONFIG.ai.timeout_seconds).toBe(60);
    });

    it('should have valid memory configuration', () => {
      expect(DEFAULT_CONFIG.memory.type).toBe('chroma');
      expect(DEFAULT_CONFIG.memory.url).toBe('http://localhost:8000');
      expect(DEFAULT_CONFIG.memory.enable_persistence).toBe(true);
      expect(DEFAULT_CONFIG.memory.cleanup_interval_hours).toBe(24);
    });

    it('should have valid providers configuration', () => {
      expect(DEFAULT_CONFIG.providers.openai).toBeDefined();
      expect(DEFAULT_CONFIG.providers.anthropic).toBeDefined();
      expect(DEFAULT_CONFIG.providers.gemini).toBeDefined();
      expect(DEFAULT_CONFIG.providers.local).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const result = validateConfig(DEFAULT_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid AI max_tokens', () => {
      const config: PartialConfig = {
        ai: { max_tokens: -100 },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ai.max_tokens',
          message: expect.stringContaining('positive'),
        })
      );
    });

    it('should reject invalid AI temperature', () => {
      const config: PartialConfig = {
        ai: { temperature: 3.0 },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'ai.temperature',
          message: expect.stringContaining('between 0 and 2'),
        })
      );
    });

    it('should reject invalid memory URL', () => {
      const config: PartialConfig = {
        memory: { url: 'not-a-url' },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'memory.url',
          message: expect.stringContaining('valid URL'),
        })
      );
    });

    it('should reject invalid agents max_parallel', () => {
      const config: PartialConfig = {
        agents: { max_parallel: 0 },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'agents.max_parallel',
          message: expect.stringContaining('positive'),
        })
      );
    });

    it('should reject invalid log level', () => {
      const config: PartialConfig = {
        logging: { level: 'invalid' as 'info' },
      };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'logging.level',
        })
      );
    });
  });

  describe('substituteEnvVars', () => {
    beforeEach(() => {
      process.env.TEST_API_KEY = 'test-key-123';
      process.env.TEST_SECRET = 'secret-456';
    });

    afterEach(() => {
      delete process.env.TEST_API_KEY;
      delete process.env.TEST_SECRET;
    });

    it('should substitute environment variables', () => {
      const config = {
        key: '${TEST_API_KEY}',
        secret: '${TEST_SECRET}',
      };
      const result = substituteEnvVars(config);
      expect(result.key).toBe('test-key-123');
      expect(result.secret).toBe('secret-456');
    });

    it('should handle missing environment variables', () => {
      const config = {
        key: '${MISSING_VAR}',
      };
      const result = substituteEnvVars(config);
      expect(result.key).toBe('');
    });

    it('should handle nested objects', () => {
      const config = {
        providers: {
          openai: {
            api_key: '${TEST_API_KEY}',
          },
        },
      };
      const result = substituteEnvVars(config);
      expect(result.providers.openai.api_key).toBe('test-key-123');
    });

    it('should not modify non-template strings', () => {
      const config = {
        normal: 'just a string',
        number: 42,
        boolean: true,
      };
      const result = substituteEnvVars(config);
      expect(result).toEqual(config);
    });
  });

  describe('mergeConfig', () => {
    it('should merge simple properties', () => {
      const base = { a: 1, b: 2 };
      const override = { b: 3, c: 4 };
      const result = mergeConfig(base, override);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const base = {
        ai: { max_tokens: 8000, temperature: 0.7 },
        memory: { type: 'chroma' },
      };
      const override = {
        ai: { max_tokens: 16000 },
      };
      const result = mergeConfig(base, override);
      expect(result.ai.max_tokens).toBe(16000);
      expect(result.ai.temperature).toBe(0.7);
      expect(result.memory.type).toBe('chroma');
    });

    it('should not mutate original objects', () => {
      const base = { a: 1 };
      const override = { a: 2 };
      mergeConfig(base, override);
      expect(base.a).toBe(1);
    });

    it('should handle undefined values', () => {
      const base = { a: 1, b: 2 };
      const override = { b: undefined };
      const result = mergeConfig(base, override);
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });
});
