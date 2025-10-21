/**
 * ConfigMerger.ts
 *
 * Intelligent configuration merging with support for multiple strategies,
 * deep merging, type preservation, and conflict resolution.
 *
 * @module config/ConfigMerger
 */

import { cloneDeep, merge, mergeWith } from 'lodash';
import type { Config, PartialConfig, MergeStrategy } from './ConfigSchema';
import type { DeepPartial } from './ConfigDefaults';

/**
 * Merge policy for specific configuration paths
 */
export interface MergePolicy {
  path: string;
  strategy: MergeStrategy;
}

/**
 * Merge options
 */
export interface MergeOptions {
  strategy?: MergeStrategy;
  policies?: MergePolicy[];
  preserveArrays?: boolean;
  overwriteUndefined?: boolean;
  customMerger?: CustomMergerFn;
}

/**
 * Custom merger function type
 */
export type CustomMergerFn = (
  targetValue: unknown,
  sourceValue: unknown,
  key: string,
  target: object,
  source: object
) => unknown | undefined;

/**
 * Configuration merger class
 *
 * Provides intelligent merging of configuration objects with support for:
 * - Multiple merge strategies (replace, append, prepend, union, deep)
 * - Path-specific merge policies
 * - Array handling strategies
 * - Type preservation
 * - Custom merge functions
 */
export class ConfigMerger {
  private policies: Map<string, MergeStrategy> = new Map();
  private defaultStrategy: MergeStrategy = 'deep';

  /**
   * Create a new ConfigMerger instance
   *
   * @param {MergeStrategy} defaultStrategy - Default merge strategy
   */
  constructor(defaultStrategy: MergeStrategy = 'deep') {
    this.defaultStrategy = defaultStrategy;
  }

  /**
   * Merge multiple configurations
   *
   * @param {...(Config | PartialConfig)[]} configs - Configurations to merge (in priority order)
   * @returns {Config} Merged configuration
   */
  public merge(...configs: (Config | PartialConfig)[]): Config {
    if (configs.length === 0) {
      throw new Error('At least one configuration is required for merging');
    }

    if (configs.length === 1) {
      return cloneDeep(configs[0]) as Config;
    }

    let result = cloneDeep(configs[0]);

    for (let i = 1; i < configs.length; i++) {
      result = this.mergeTwo(result, configs[i]);
    }

    return result as Config;
  }

  /**
   * Merge configurations with a specific strategy
   *
   * @param {MergeStrategy} strategy - Merge strategy to use
   * @param {...(Config | PartialConfig)[]} configs - Configurations to merge
   * @returns {Config} Merged configuration
   */
  public mergeWith(strategy: MergeStrategy, ...configs: (Config | PartialConfig)[]): Config {
    const originalStrategy = this.defaultStrategy;
    this.defaultStrategy = strategy;

    try {
      return this.merge(...configs);
    } finally {
      this.defaultStrategy = originalStrategy;
    }
  }

  /**
   * Merge two configurations
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @param {MergeOptions} options - Merge options
   * @returns {Config | PartialConfig} Merged configuration
   */
  public mergeTwo(
    target: Config | PartialConfig,
    source: Config | PartialConfig,
    options?: MergeOptions
  ): Config | PartialConfig {
    const strategy = options?.strategy || this.defaultStrategy;

    switch (strategy) {
      case 'replace':
        return this.mergeReplace(target, source);
      case 'append':
        return this.mergeAppend(target, source);
      case 'prepend':
        return this.mergePrepend(target, source);
      case 'union':
        return this.mergeUnion(target, source);
      case 'deep':
      default:
        return this.mergeDeep(target, source, options);
    }
  }

  /**
   * Set merge strategy for a specific path
   *
   * @param {string} path - Configuration path (e.g., 'providers.openai')
   * @param {MergeStrategy} strategy - Merge strategy
   */
  public setStrategy(path: string, strategy: MergeStrategy): void {
    this.policies.set(path, strategy);
  }

  /**
   * Remove merge strategy for a path
   *
   * @param {string} path - Configuration path
   * @returns {boolean} True if strategy was removed
   */
  public removeStrategy(path: string): boolean {
    return this.policies.delete(path);
  }

  /**
   * Get merge strategy for a path
   *
   * @param {string} path - Configuration path
   * @returns {MergeStrategy} Merge strategy for the path
   */
  public getStrategy(path: string): MergeStrategy {
    return this.policies.get(path) || this.defaultStrategy;
  }

  /**
   * Clear all path-specific strategies
   */
  public clearStrategies(): void {
    this.policies.clear();
  }

  /**
   * Replace merge strategy
   * Simply replaces target with source
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @returns {Config | PartialConfig} Merged configuration
   */
  private mergeReplace(
    target: Config | PartialConfig,
    source: Config | PartialConfig
  ): Config | PartialConfig {
    return cloneDeep(source);
  }

  /**
   * Append merge strategy
   * Appends arrays, deep merges objects
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @returns {Config | PartialConfig} Merged configuration
   */
  private mergeAppend(
    target: Config | PartialConfig,
    source: Config | PartialConfig
  ): Config | PartialConfig {
    return mergeWith(cloneDeep(target), source, (targetValue, sourceValue) => {
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        return [...targetValue, ...sourceValue];
      }
      return undefined; // Use default merge behavior
    });
  }

  /**
   * Prepend merge strategy
   * Prepends arrays, deep merges objects
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @returns {Config | PartialConfig} Merged configuration
   */
  private mergePrepend(
    target: Config | PartialConfig,
    source: Config | PartialConfig
  ): Config | PartialConfig {
    return mergeWith(cloneDeep(target), source, (targetValue, sourceValue) => {
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        return [...sourceValue, ...targetValue];
      }
      return undefined; // Use default merge behavior
    });
  }

  /**
   * Union merge strategy
   * Creates unique union of arrays, deep merges objects
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @returns {Config | PartialConfig} Merged configuration
   */
  private mergeUnion(
    target: Config | PartialConfig,
    source: Config | PartialConfig
  ): Config | PartialConfig {
    return mergeWith(cloneDeep(target), source, (targetValue, sourceValue) => {
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        // Create unique union
        const combined = [...targetValue, ...sourceValue];
        return Array.from(new Set(combined.map((item) => JSON.stringify(item)))).map((item) =>
          JSON.parse(item)
        );
      }
      return undefined; // Use default merge behavior
    });
  }

  /**
   * Deep merge strategy
   * Deep merges all objects and arrays
   *
   * @param {Config | PartialConfig} target - Target configuration
   * @param {Config | PartialConfig} source - Source configuration
   * @param {MergeOptions} options - Merge options
   * @returns {Config | PartialConfig} Merged configuration
   */
  private mergeDeep(
    target: Config | PartialConfig,
    source: Config | PartialConfig,
    options?: MergeOptions
  ): Config | PartialConfig {
    const customMerger = options?.customMerger;

    return mergeWith(
      cloneDeep(target),
      source,
      (targetValue, sourceValue, key, targetObj, sourceObj) => {
        // Apply custom merger if provided
        if (customMerger) {
          const result = customMerger(targetValue, sourceValue, key, targetObj, sourceObj);
          if (result !== undefined) {
            return result;
          }
        }

        // Handle undefined values based on options
        if (sourceValue === undefined && !options?.overwriteUndefined) {
          return targetValue;
        }

        // Handle arrays based on preserveArrays option
        if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
          if (options?.preserveArrays) {
            return sourceValue; // Replace entire array
          }
          // Default: merge arrays
          return this.mergeArrays(targetValue, sourceValue);
        }

        // Check for path-specific strategies
        if (typeof key === 'string') {
          const strategy = this.getStrategyForPath(targetObj, key);
          if (strategy && strategy !== 'deep') {
            const tempTarget = { [key]: targetValue };
            const tempSource = { [key]: sourceValue };
            const merged = this.mergeTwo(tempTarget as any, tempSource as any, {
              strategy,
            });
            return (merged as any)[key];
          }
        }

        return undefined; // Use default lodash merge behavior
      }
    );
  }

  /**
   * Merge arrays intelligently
   *
   * @param {unknown[]} target - Target array
   * @param {unknown[]} source - Source array
   * @returns {unknown[]} Merged array
   */
  private mergeArrays(target: unknown[], source: unknown[]): unknown[] {
    // If arrays contain primitives, create union
    const isPrimitive = (val: unknown) =>
      val === null || ['string', 'number', 'boolean'].includes(typeof val);

    if (target.every(isPrimitive) && source.every(isPrimitive)) {
      return Array.from(new Set([...target, ...source]));
    }

    // For object arrays, merge by index
    const result = [...target];
    source.forEach((item, index) => {
      if (index < result.length) {
        if (typeof item === 'object' && item !== null && typeof result[index] === 'object') {
          result[index] = merge({}, result[index], item);
        } else {
          result[index] = item;
        }
      } else {
        result.push(item);
      }
    });

    return result;
  }

  /**
   * Get strategy for a specific path by traversing the object
   *
   * @param {object} obj - Object to traverse
   * @param {string} key - Current key
   * @returns {MergeStrategy | undefined} Strategy for the path
   */
  private getStrategyForPath(obj: object, key: string): MergeStrategy | undefined {
    // This is a simplified implementation
    // In a real implementation, we would track the full path during traversal
    return this.policies.get(key);
  }
}

/**
 * Create a merger instance
 *
 * @param {MergeStrategy} defaultStrategy - Default merge strategy
 * @returns {ConfigMerger} Merger instance
 */
export function createMerger(defaultStrategy: MergeStrategy = 'deep'): ConfigMerger {
  return new ConfigMerger(defaultStrategy);
}

/**
 * Quick merge helper
 *
 * @param {...(Config | PartialConfig)[]} configs - Configurations to merge
 * @returns {Config} Merged configuration
 */
export function mergeConfigs(...configs: (Config | PartialConfig)[]): Config {
  const merger = new ConfigMerger();
  return merger.merge(...configs);
}

/**
 * Merge configurations with replace strategy
 *
 * @param {Config | PartialConfig} target - Target configuration
 * @param {Config | PartialConfig} source - Source configuration
 * @returns {Config | PartialConfig} Merged configuration
 */
export function mergeReplace(
  target: Config | PartialConfig,
  source: Config | PartialConfig
): Config | PartialConfig {
  const merger = new ConfigMerger();
  return merger.mergeWith('replace', target, source);
}

/**
 * Merge configurations with deep strategy
 *
 * @param {Config | PartialConfig} target - Target configuration
 * @param {Config | PartialConfig} source - Source configuration
 * @returns {Config | PartialConfig} Merged configuration
 */
export function mergeDeep(
  target: Config | PartialConfig,
  source: Config | PartialConfig
): Config | PartialConfig {
  const merger = new ConfigMerger();
  return merger.mergeWith('deep', target, source);
}

/**
 * Apply overrides to a configuration
 *
 * @param {Config} base - Base configuration
 * @param {DeepPartial<Config>} overrides - Configuration overrides
 * @returns {Config} Configuration with overrides applied
 */
export function applyOverrides(base: Config, overrides: DeepPartial<Config>): Config {
  const merger = new ConfigMerger('deep');
  return merger.merge(base, overrides as PartialConfig);
}
