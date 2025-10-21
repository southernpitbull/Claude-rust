/**
 * Log Filter - Intelligent log filtering with rate limiting, deduplication, and sampling
 * Provides dynamic filters, pattern matching, and performance optimization
 */

import type { ILogEntry, LogLevel, LogCategory, ILogFilterRule } from './types.js';

/**
 * Filter type enumeration
 */
export type FilterType =
  | 'level'
  | 'category'
  | 'pattern'
  | 'rateLimit'
  | 'deduplication'
  | 'sampling'
  | 'contextual'
  | 'custom';

/**
 * Filter configuration
 */
export interface IFilterConfig {
  /** Filter type */
  type: FilterType;

  /** Filter enabled */
  enabled: boolean;

  /** Filter priority (higher = applied first) */
  priority?: number;

  /** Filter-specific options */
  options: Record<string, unknown>;
}

/**
 * Rate limit configuration
 */
export interface IRateLimitConfig {
  /** Maximum logs per time window */
  maxPerWindow: number;

  /** Time window in milliseconds */
  windowMs: number;

  /** Reset on window boundary */
  resetOnBoundary?: boolean;
}

/**
 * Deduplication configuration
 */
export interface IDeduplicationConfig {
  /** Window size in milliseconds */
  windowMs: number;

  /** Maximum cache size */
  maxCacheSize?: number;

  /** Fields to use for deduplication */
  fields?: string[];
}

/**
 * Sampling configuration
 */
export interface ISamplingConfig {
  /** Sample rate (0-1) */
  rate: number;

  /** Always sample errors */
  alwaysLogErrors?: boolean;

  /** Sampling strategy */
  strategy?: 'random' | 'deterministic' | 'adaptive';
}

/**
 * Filter statistics
 */
export interface IFilterStats {
  /** Total logs processed */
  processed: number;

  /** Total logs filtered out */
  filtered: number;

  /** Total logs passed */
  passed: number;

  /** Filter rate (filtered / processed) */
  filterRate: number;

  /** Last reset time */
  lastReset: Date;
}

/**
 * Log Filter implementation
 */
export class LogFilter {
  private readonly rules: Map<string, ILogFilterRule>;
  private readonly filters: Map<string, IFilterConfig>;
  private readonly rateLimiters: Map<string, { count: number; resetAt: number }>;
  private readonly deduplicationCache: Map<string, number>;
  private sampleCounter = 0;
  private stats: IFilterStats;

  constructor() {
    this.rules = new Map();
    this.filters = new Map();
    this.rateLimiters = new Map();
    this.deduplicationCache = new Map();
    this.stats = {
      processed: 0,
      filtered: 0,
      passed: 0,
      filterRate: 0,
      lastReset: new Date(),
    };
  }

  /**
   * Add a filter rule
   */
  public addRule(rule: ILogFilterRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a filter rule
   */
  public removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get a filter rule
   */
  public getRule(ruleId: string): ILogFilterRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  public getRules(): Map<string, ILogFilterRule> {
    return new Map(this.rules);
  }

  /**
   * Add a filter configuration
   */
  public addFilter(id: string, config: IFilterConfig): void {
    this.filters.set(id, config);
  }

  /**
   * Remove a filter
   */
  public removeFilter(id: string): boolean {
    return this.filters.delete(id);
  }

  /**
   * Check if a log entry should be filtered
   */
  public shouldFilter(entry: ILogEntry): boolean {
    this.stats.processed++;

    // Apply custom rules first
    const ruleResult = this.applyRules(entry);
    if (ruleResult !== null) {
      if (ruleResult) {
        this.stats.filtered++;
      } else {
        this.stats.passed++;
      }
      this.updateFilterRate();
      return ruleResult;
    }

    // Apply built-in filters
    const sortedFilters = Array.from(this.filters.entries())
      .filter(([, config]) => config.enabled)
      .sort(([, a], [, b]) => (b.priority || 0) - (a.priority || 0));

    for (const [id, config] of sortedFilters) {
      const shouldFilter = this.applyFilter(id, config, entry);
      if (shouldFilter) {
        this.stats.filtered++;
        this.updateFilterRate();
        return true;
      }
    }

    this.stats.passed++;
    this.updateFilterRate();
    return false;
  }

  /**
   * Add a level filter
   */
  public addLevelFilter(minLevel: LogLevel, enabled = true): void {
    this.addFilter('level', {
      type: 'level',
      enabled,
      options: { minLevel },
    });
  }

  /**
   * Add a category filter
   */
  public addCategoryFilter(categories: LogCategory[], enabled = true): void {
    this.addFilter('category', {
      type: 'category',
      enabled,
      options: { categories },
    });
  }

  /**
   * Add a pattern filter
   */
  public addPatternFilter(pattern: string | RegExp, enabled = true): void {
    this.addFilter('pattern', {
      type: 'pattern',
      enabled,
      options: { pattern: typeof pattern === 'string' ? new RegExp(pattern) : pattern },
    });
  }

  /**
   * Add a rate limiter
   */
  public addRateLimiter(config: IRateLimitConfig, enabled = true): void {
    this.addFilter('rateLimit', {
      type: 'rateLimit',
      enabled,
      options: config,
    });
  }

  /**
   * Add deduplication
   */
  public addDeduplication(config: IDeduplicationConfig, enabled = true): void {
    this.addFilter('deduplication', {
      type: 'deduplication',
      enabled,
      options: config,
    });
  }

  /**
   * Add sampling
   */
  public addSampling(config: ISamplingConfig, enabled = true): void {
    this.addFilter('sampling', {
      type: 'sampling',
      enabled,
      priority: -1, // Apply last
      options: config,
    });
  }

  /**
   * Get filter statistics
   */
  public getStats(): IFilterStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      processed: 0,
      filtered: 0,
      passed: 0,
      filterRate: 0,
      lastReset: new Date(),
    };
  }

  /**
   * Clear all filters and caches
   */
  public clear(): void {
    this.rules.clear();
    this.filters.clear();
    this.rateLimiters.clear();
    this.deduplicationCache.clear();
    this.sampleCounter = 0;
    this.resetStats();
  }

  /**
   * Apply custom rules
   */
  private applyRules(entry: ILogEntry): boolean | null {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const result = rule.filter(entry);
        if (result) {
          return true; // Filter this entry
        }
      } catch {
        // Ignore rule errors
      }
    }
    return null; // No rule matched, continue to built-in filters
  }

  /**
   * Apply a specific filter
   */
  private applyFilter(id: string, config: IFilterConfig, entry: ILogEntry): boolean {
    switch (config.type) {
      case 'level':
        return this.applyLevelFilter(config, entry);
      case 'category':
        return this.applyCategoryFilter(config, entry);
      case 'pattern':
        return this.applyPatternFilter(config, entry);
      case 'rateLimit':
        return this.applyRateLimit(id, config, entry);
      case 'deduplication':
        return this.applyDeduplication(config, entry);
      case 'sampling':
        return this.applySampling(config, entry);
      default:
        return false;
    }
  }

  /**
   * Apply level filter
   */
  private applyLevelFilter(config: IFilterConfig, entry: ILogEntry): boolean {
    const { minLevel } = config.options as { minLevel: LogLevel };
    const levels: LogLevel[] = ['trace', 'debug', 'verbose', 'http', 'info', 'warn', 'error'];
    const entryLevelIndex = levels.indexOf(entry.level);
    const minLevelIndex = levels.indexOf(minLevel);
    return entryLevelIndex < minLevelIndex;
  }

  /**
   * Apply category filter
   */
  private applyCategoryFilter(config: IFilterConfig, entry: ILogEntry): boolean {
    const { categories } = config.options as { categories: LogCategory[] };
    return !categories.includes(entry.metadata.category);
  }

  /**
   * Apply pattern filter
   */
  private applyPatternFilter(config: IFilterConfig, entry: ILogEntry): boolean {
    const { pattern } = config.options as { pattern: RegExp };
    return !pattern.test(entry.message);
  }

  /**
   * Apply rate limiting
   */
  private applyRateLimit(id: string, config: IFilterConfig, entry: ILogEntry): boolean {
    const { maxPerWindow, windowMs, resetOnBoundary } = config.options as IRateLimitConfig;
    const now = Date.now();

    let limiter = this.rateLimiters.get(id);
    if (!limiter || now >= limiter.resetAt) {
      limiter = {
        count: 0,
        resetAt: resetOnBoundary ? Math.ceil(now / windowMs) * windowMs : now + windowMs,
      };
      this.rateLimiters.set(id, limiter);
    }

    limiter.count++;
    return limiter.count > maxPerWindow;
  }

  /**
   * Apply deduplication
   */
  private applyDeduplication(config: IFilterConfig, entry: ILogEntry): boolean {
    const { windowMs, maxCacheSize = 1000, fields } = config.options as IDeduplicationConfig;
    const now = Date.now();

    // Generate hash from entry
    const hash = this.generateHash(entry, fields);

    // Check if we've seen this hash recently
    const lastSeen = this.deduplicationCache.get(hash);
    if (lastSeen && now - lastSeen < windowMs) {
      return true; // Duplicate, filter it out
    }

    // Add to cache
    this.deduplicationCache.set(hash, now);

    // Clean up old entries if cache is too large
    if (this.deduplicationCache.size > maxCacheSize) {
      const cutoff = now - windowMs;
      for (const [key, time] of this.deduplicationCache.entries()) {
        if (time < cutoff) {
          this.deduplicationCache.delete(key);
        }
      }
    }

    return false;
  }

  /**
   * Apply sampling
   */
  private applySampling(config: IFilterConfig, entry: ILogEntry): boolean {
    const { rate, alwaysLogErrors = true, strategy = 'random' } = config.options as ISamplingConfig;

    // Always log errors if configured
    if (alwaysLogErrors && entry.level === 'error') {
      return false;
    }

    // Apply sampling strategy
    switch (strategy) {
      case 'random':
        return Math.random() >= rate;

      case 'deterministic':
        this.sampleCounter++;
        return this.sampleCounter % Math.ceil(1 / rate) !== 0;

      case 'adaptive': {
        // Adaptive: sample more during quiet periods
        const recentPassRate = this.stats.passed / Math.max(this.stats.processed, 1);
        const adjustedRate = rate * (1 + (1 - recentPassRate));
        return Math.random() >= Math.min(adjustedRate, 1);
      }

      default:
        return false;
    }
  }

  /**
   * Generate hash for deduplication
   */
  private generateHash(entry: ILogEntry, fields?: string[]): string {
    if (fields && fields.length > 0) {
      // Hash specific fields
      const parts = fields.map((field) => {
        if (field === 'message') {
          return entry.message;
        }
        if (field === 'level') {
          return entry.level;
        }
        if (entry.metadata.context && field in entry.metadata.context) {
          return String(entry.metadata.context[field]);
        }
        return '';
      });
      return parts.join('|');
    }

    // Default: hash message and level
    return `${entry.level}|${entry.message}`;
  }

  /**
   * Update filter rate
   */
  private updateFilterRate(): void {
    this.stats.filterRate =
      this.stats.processed > 0 ? this.stats.filtered / this.stats.processed : 0;
  }
}

/**
 * Create a log filter
 */
export function createLogFilter(): LogFilter {
  return new LogFilter();
}

export default LogFilter;
