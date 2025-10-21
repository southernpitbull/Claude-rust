/**
 * ConfigMerger Tests
 *
 * Comprehensive test suite for configuration merging
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConfigMerger } from '../../src/config/ConfigMerger';
import { DEFAULT_CONFIG } from '../../src/config/ConfigDefaults';
import type { Config, PartialConfig } from '../../src/config/ConfigSchema';

describe('ConfigMerger', () => {
  let merger: ConfigMerger;

  beforeEach(() => {
    merger = new ConfigMerger('deep');
  });

  describe('merge', () => {
    it('should merge two configurations deeply', () => {
      const base: PartialConfig = {
        version: '1.0.0',
        logging: {
          level: 'info',
        },
      };

      const override: PartialConfig = {
        logging: {
          level: 'debug',
          console: true,
        },
      };

      const result = merger.merge(base, override) as PartialConfig;

      expect(result.version).toBe('1.0.0');
      expect(result.logging?.level).toBe('debug');
      expect(result.logging?.console).toBe(true);
    });

    it('should merge multiple configurations in order', () => {
      const config1: PartialConfig = { version: '1.0.0' };
      const config2: PartialConfig = { version: '1.1.0' };
      const config3: PartialConfig = { version: '1.2.0' };

      const result = merger.merge(config1, config2, config3) as PartialConfig;

      expect(result.version).toBe('1.2.0');
    });

    it('should return cloned config for single input', () => {
      const config: PartialConfig = { version: '1.0.0' };
      const result = merger.merge(config);

      expect(result).toEqual(config);
      expect(result).not.toBe(config); // Should be a clone
    });
  });

  describe('mergeWith', () => {
    it('should use replace strategy', () => {
      const base: PartialConfig = {
        providers: {
          openai: { enabled: true, model: 'gpt-4' },
        },
      };

      const override: PartialConfig = {
        providers: {
          anthropic: { enabled: true, model: 'claude-3' },
        },
      };

      const result = merger.mergeWith('replace', base, override) as PartialConfig;

      expect(result.providers?.openai).toBeUndefined();
      expect(result.providers?.anthropic).toBeDefined();
    });

    it('should use deep strategy', () => {
      const base: PartialConfig = {
        providers: {
          openai: { enabled: true, model: 'gpt-4' },
        },
      };

      const override: PartialConfig = {
        providers: {
          anthropic: { enabled: true, model: 'claude-3' },
        },
      };

      const result = merger.mergeWith('deep', base, override) as PartialConfig;

      expect(result.providers?.openai).toBeDefined();
      expect(result.providers?.anthropic).toBeDefined();
    });
  });

  describe('setStrategy', () => {
    it('should set path-specific strategy', () => {
      merger.setStrategy('providers', 'replace');
      expect(merger.getStrategy('providers')).toBe('replace');
    });

    it('should remove path strategy', () => {
      merger.setStrategy('providers', 'replace');
      const removed = merger.removeStrategy('providers');
      expect(removed).toBe(true);
      expect(merger.getStrategy('providers')).not.toBe('replace');
    });
  });

  describe('array merging', () => {
    it('should handle array merging in append mode', () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [4, 5] };

      const result = merger.mergeWith('append', base, override) as { items: number[] };

      expect(result.items).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle array merging in prepend mode', () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [4, 5] };

      const result = merger.mergeWith('prepend', base, override) as { items: number[] };

      expect(result.items).toEqual([4, 5, 1, 2, 3]);
    });

    it('should handle array merging in union mode', () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [3, 4, 5] };

      const result = merger.mergeWith('union', base, override) as { items: number[] };

      expect(result.items.length).toBe(5);
      expect(new Set(result.items).size).toBe(5); // All unique
    });
  });
});
