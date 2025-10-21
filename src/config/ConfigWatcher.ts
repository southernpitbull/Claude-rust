/**
 * ConfigWatcher.ts
 *
 * File system watcher for configuration files with debouncing,
 * change detection, and hot reload support.
 *
 * @module config/ConfigWatcher
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { Config } from './ConfigDefaults';

/**
 * Watch event types
 */
export type WatchEventType = 'change' | 'add' | 'unlink' | 'error';

/**
 * Watch event
 */
export interface WatchEvent {
  type: WatchEventType;
  path: string;
  timestamp: number;
}

/**
 * Watcher options
 */
export interface WatcherOptions {
  debounceMs?: number;
  persistent?: boolean;
  recursive?: boolean;
  ignored?: string[];
}

/**
 * Change callback type
 */
export type ChangeCallback = (event: WatchEvent) => void | Promise<void>;

/**
 * Configuration file watcher
 *
 * Watches configuration files for changes and triggers callbacks.
 * Features:
 * - Debouncing to prevent multiple rapid triggers
 * - Change detection to avoid unnecessary reloads
 * - Support for multiple file watching
 * - Cross-platform compatibility
 */
export class ConfigWatcher extends EventEmitter {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private fileHashes: Map<string, string> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<WatcherOptions>;
  private callbacks: Set<ChangeCallback> = new Set();
  private isWatching: boolean = false;

  /**
   * Create a new ConfigWatcher instance
   *
   * @param {WatcherOptions} options - Watcher options
   */
  constructor(options: WatcherOptions = {}) {
    super();
    this.options = {
      debounceMs: options.debounceMs ?? 300,
      persistent: options.persistent ?? true,
      recursive: options.recursive ?? false,
      ignored: options.ignored || [],
    };
  }

  /**
   * Start watching a file or directory
   *
   * @param {string | string[]} paths - File path(s) to watch
   * @param {ChangeCallback} callback - Callback to call on change
   */
  public watch(paths: string | string[], callback?: ChangeCallback): void {
    const pathArray = Array.isArray(paths) ? paths : [paths];

    if (callback) {
      this.callbacks.add(callback);
    }

    for (const filePath of pathArray) {
      this.watchFile(filePath);
    }

    this.isWatching = true;
  }

  /**
   * Stop watching all files
   */
  public unwatch(): void {
    for (const [filePath, watcher] of this.watchers.entries()) {
      watcher.close();
      this.clearDebounceTimer(filePath);
    }

    this.watchers.clear();
    this.fileHashes.clear();
    this.debounceTimers.clear();
    this.callbacks.clear();
    this.isWatching = false;

    this.emit('unwatched');
  }

  /**
   * Stop watching a specific file
   *
   * @param {string} filePath - File path to stop watching
   */
  public unwatchFile(filePath: string): void {
    const normalizedPath = path.resolve(filePath);
    const watcher = this.watchers.get(normalizedPath);

    if (watcher) {
      watcher.close();
      this.watchers.delete(normalizedPath);
      this.fileHashes.delete(normalizedPath);
      this.clearDebounceTimer(normalizedPath);
    }

    if (this.watchers.size === 0) {
      this.isWatching = false;
    }
  }

  /**
   * Check if watcher is active
   *
   * @returns {boolean} True if watching
   */
  public isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get list of watched files
   *
   * @returns {string[]} Array of watched file paths
   */
  public getWatchedFiles(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Add a change callback
   *
   * @param {ChangeCallback} callback - Callback to add
   */
  public addCallback(callback: ChangeCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * Remove a change callback
   *
   * @param {ChangeCallback} callback - Callback to remove
   */
  public removeCallback(callback: ChangeCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * Watch a single file
   *
   * @param {string} filePath - File path to watch
   */
  private watchFile(filePath: string): void {
    const normalizedPath = path.resolve(filePath);

    // Skip if already watching
    if (this.watchers.has(normalizedPath)) {
      return;
    }

    // Skip if path is ignored
    if (this.isIgnored(normalizedPath)) {
      return;
    }

    try {
      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        this.emit('error', new Error(`File does not exist: ${normalizedPath}`));
        return;
      }

      // Store initial file hash
      this.updateFileHash(normalizedPath);

      // Create file watcher
      const watcher = fs.watch(
        normalizedPath,
        {
          persistent: this.options.persistent,
          recursive: this.options.recursive,
        },
        (eventType, filename) => {
          this.handleFileChange(normalizedPath, eventType, filename);
        }
      );

      watcher.on('error', (error) => {
        this.emit('error', error);
      });

      this.watchers.set(normalizedPath, watcher);
      this.emit('watching', normalizedPath);
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Handle file change event
   *
   * @param {string} filePath - File path that changed
   * @param {string} eventType - Event type from fs.watch
   * @param {string | null} filename - Filename from fs.watch
   */
  private handleFileChange(filePath: string, eventType: string, filename: string | null): void {
    // Clear existing debounce timer
    this.clearDebounceTimer(filePath);

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.processFileChange(filePath, eventType);
      this.debounceTimers.delete(filePath);
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Process file change after debounce
   *
   * @param {string} filePath - File path that changed
   * @param {string} eventType - Event type
   */
  private async processFileChange(filePath: string, eventType: string): Promise<void> {
    try {
      // Check if file still exists
      if (!fs.existsSync(filePath)) {
        const event: WatchEvent = {
          type: 'unlink',
          path: filePath,
          timestamp: Date.now(),
        };

        this.emit('unlink', event);
        await this.notifyCallbacks(event);
        return;
      }

      // Check if file content actually changed
      const hasChanged = await this.hasFileChanged(filePath);

      if (hasChanged) {
        const event: WatchEvent = {
          type: 'change',
          path: filePath,
          timestamp: Date.now(),
        };

        this.emit('change', event);
        await this.notifyCallbacks(event);

        // Update file hash
        this.updateFileHash(filePath);
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Check if file content has changed
   *
   * @param {string} filePath - File path to check
   * @returns {Promise<boolean>} True if file has changed
   */
  private async hasFileChanged(filePath: string): Promise<boolean> {
    const oldHash = this.fileHashes.get(filePath);
    const newHash = await this.computeFileHash(filePath);

    return oldHash !== newHash;
  }

  /**
   * Update stored file hash
   *
   * @param {string} filePath - File path
   */
  private updateFileHash(filePath: string): void {
    try {
      const hash = this.computeFileHashSync(filePath);
      this.fileHashes.set(filePath, hash);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Compute file hash (async)
   *
   * @param {string} filePath - File path
   * @returns {Promise<string>} File hash
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const hash = this.computeFileHashSync(filePath);
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Compute file hash (sync)
   *
   * @param {string} filePath - File path
   * @returns {string} File hash
   */
  private computeFileHashSync(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Simple hash based on content length and first/last chars
    // For production, consider using crypto.createHash
    return `${content.length}-${content[0] || ''}-${content[content.length - 1] || ''}`;
  }

  /**
   * Check if path should be ignored
   *
   * @param {string} filePath - File path to check
   * @returns {boolean} True if should be ignored
   */
  private isIgnored(filePath: string): boolean {
    return this.options.ignored.some((pattern) => {
      // Simple pattern matching - can be enhanced with glob patterns
      return filePath.includes(pattern);
    });
  }

  /**
   * Clear debounce timer for a file
   *
   * @param {string} filePath - File path
   */
  private clearDebounceTimer(filePath: string): void {
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }
  }

  /**
   * Notify all callbacks of a change
   *
   * @param {WatchEvent} event - Watch event
   */
  private async notifyCallbacks(event: WatchEvent): Promise<void> {
    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await callback(event);
      } catch (error) {
        this.emit('callback-error', error);
      }
    });

    await Promise.allSettled(promises);
  }
}

/**
 * Create a watcher instance
 *
 * @param {WatcherOptions} options - Watcher options
 * @returns {ConfigWatcher} Watcher instance
 */
export function createWatcher(options?: WatcherOptions): ConfigWatcher {
  return new ConfigWatcher(options);
}

/**
 * Watch configuration files with a callback
 *
 * @param {string | string[]} paths - File path(s) to watch
 * @param {ChangeCallback} callback - Callback to call on change
 * @param {WatcherOptions} options - Watcher options
 * @returns {ConfigWatcher} Watcher instance
 */
export function watchConfig(
  paths: string | string[],
  callback: ChangeCallback,
  options?: WatcherOptions
): ConfigWatcher {
  const watcher = new ConfigWatcher(options);
  watcher.watch(paths, callback);
  return watcher;
}
