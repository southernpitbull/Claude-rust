/**
 * ConfigValidator Tests
 *
 * Comprehensive test suite for configuration validation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigValidator } from '../../src/config/ConfigValidator';
import { DEFAULT_CONFIG } from '../../src/config/ConfigDefaults';
import type { Config } from '../../src/config/ConfigSchema';

describe('ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator('strict');
  });

  describe('validate', () => {
    it('should validate a complete valid configuration', () => {
      const result = validator.validate(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        version: 'invalid', // Should match semver pattern
      };

      const result = validator.validate(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate required fields', () => {
      const incompleteConfig = {
        version: '1.0.0',
        // Missing other required fields
      };

      const result = validator.validate(incompleteConfig);
      expect(result.success).toBe(false);
    });

    it('should validate at least one provider is enabled', () => {
      const config: Config = {
        ...DEFAULT_CONFIG,
        providers: {
          openai: { enabled: false, model: 'gpt-4' },
        },
      };

      const result = validator.validate(config);
      expect(result.success).toBe(false);
    });
  });

  describe('validatePartial', () => {
    it('should validate partial configuration', () => {
      const partialConfig = {
        logging: {
          level: 'debug' as const,
        },
      };

      const result = validator.validatePartial(partialConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid partial configuration', () => {
      const invalidPartial = {
        logging: {
          level: 'invalid-level',
        },
      };

      const result = validator.validatePartial(invalidPartial);
      expect(result.success).toBe(false);
    });
  });

  describe('validateField', () => {
    it('should validate a specific field', () => {
      const result = validator.validateField(
        'logging.level',
        'info',
        DEFAULT_CONFIG as Config
      );
      expect(result.success).toBe(true);
    });

    it('should reject invalid field value', () => {
      const result = validator.validateField(
        'logging.level',
        'invalid',
        DEFAULT_CONFIG as Config
      );
      expect(result.success).toBe(false);
    });
  });

  describe('addRule', () => {
    it('should add custom validation rule', () => {
      validator.addRule(
        'customRule',
        (config) => {
          return true;
        },
        {
          message: 'Custom rule failed',
        }
      );

      const result = validator.validate(DEFAULT_CONFIG);
      expect(result.success).toBe(true);
    });

    it('should fail on custom rule', () => {
      validator.addRule(
        'failingRule',
        (config) => {
          return false;
        },
        {
          message: 'This should fail',
        }
      );

      const result = validator.validate(DEFAULT_CONFIG);
      expect(result.success).toBe(false);
      expect(result.errors?.[0]?.message).toContain('This should fail');
    });
  });

  describe('isValid', () => {
    it('should return true for valid config', () => {
      expect(validator.isValid(DEFAULT_CONFIG)).toBe(true);
    });

    it('should return false for invalid config', () => {
      const invalidConfig = { version: 'bad' };
      expect(validator.isValid(invalidConfig)).toBe(false);
    });
  });

  describe('setMode', () => {
    it('should change validation mode', () => {
      validator.setMode('loose');
      expect(validator.getMode()).toBe('loose');
    });
  });
});
