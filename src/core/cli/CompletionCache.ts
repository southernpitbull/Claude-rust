/**
 * CompletionCache.ts
 *
 * Implements a cache for shell completion suggestions to improve performance.
 * Stores frequently used completions to avoid recomputing them.
 */

export interface CacheEntry {
  completions: string[];
  timestamp: number;
  expiry: number; // Timestamp when this entry should expire
}

export class CompletionCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;
  private defaultTTL: number; // Default time-to-live in milliseconds

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Get completions from cache
   * @param key - The cache key
   * @returns The completions if found and not expired, undefined otherwise
   */
  public get(key: string): string[] | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if the entry has expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.completions;
  }

  /**
   * Set completions in cache
   * @param key - The cache key
   * @param completions - The completions to cache
   * @param ttl - Optional time-to-live in milliseconds (uses default if not provided)
   */
  public set(key: string, completions: string[], ttl?: number): void {
    const expiryTime = ttl !== undefined ? ttl : this.defaultTTL;

    // Remove oldest entries if we're at max capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      completions,
      timestamp: Date.now(),
      expiry: Date.now() + expiryTime,
    });
  }

  /**
   * Check if a key exists in the cache (and is not expired)
   * @param key - The cache key
   * @returns True if the key exists and is not expired, false otherwise
   */
  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from the cache
   * @param key - The cache key to delete
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache
   */
  public keys(): string[] {
    // Clean expired entries while getting keys
    const validKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiry) {
        // Remove expired entry
        this.cache.delete(key);
      } else {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Prune expired entries from the cache
   */
  public prune(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate a cache key based on command context
   * @param command - The command name
   * @param subcommand - Optional subcommand
   * @param argType - The type of argument being completed
   * @param context - Additional context for the completion
   * @returns A unique cache key
   */
  public generateKey(
    command: string,
    subcommand?: string,
    argType?: string,
    context?: string
  ): string {
    const parts = [command];

    if (subcommand) {
      parts.push(subcommand);
    }

    if (argType) {
      parts.push(argType);
    }

    if (context) {
      parts.push(context);
    }

    return parts.join(':');
  }

  /**
   * Get completions with automatic caching
   * @param key - The cache key
   * @param computeFn - Function to compute completions if not in cache
   * @param ttl - Optional time-to-live for the cache entry
   * @returns The completions
   */
  public async getOrCompute(
    key: string,
    computeFn: () => Promise<string[]>,
    ttl?: number
  ): Promise<string[]> {
    // Try to get from cache first
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    // Compute the completions
    const completions = await computeFn();

    // Store in cache
    this.set(key, completions, ttl);

    return completions;
  }
}
