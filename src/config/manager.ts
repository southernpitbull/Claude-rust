/**
 * Configuration Manager
 *
 * Manages configuration with hot-reload, persistence, and get/set methods.
 * Supports file watching and automatic reload on changes.
 *
 * @module config/manager
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as toml from '@iarna/toml';
import * as yaml from 'js-yaml';
import type { Config, PartialConfig, FileFormat } from './types';
import { loadConfig, getPrimaryConfigPath } from './loader';
import { validateConfig, mergeConfig } from './schema';

// Simple logger for now - can be replaced with full logging system later
const logger = {
  debug: (...args: unknown[]) => console.debug('[config-manager]', ...args),
  info: (...args: unknown[]) => console.info('[config-manager]', ...args),
  warn: (...args: unknown[]) => console.warn('[config-manager]', ...args),
  error: (...args: unknown[]) => console.error('[config-manager]', ...args),
};

/**
 * Configuration change callback type
 */
type ConfigChangeCallback = (config: Config) => void;

/**
 * Configuration Manager Class
 *
 * Provides centralized configuration management with:
 * - Load/reload capabilities
 * - Get/set methods with path notation
 * - Hot-reload with file watching
 * - Persistence to file
 * - Validation
 */
export class ConfigurationManager {
  private config: Config | null = null;
  private configPath: string | null = null;
  private watcher: fsSync.FSWatcher | null = null;
  private changeCallbacks: Set<ConfigChangeCallback> = new Set();
  private watchEnabled = false;

  /**
   * Initialize the configuration manager
   * Loads configuration from all sources
   */
  async initialize(): Promise<Config> {
    logger.info('Initializing configuration manager');

    // Load configuration
    this.config = await loadConfig();

    // Get the primary config file path
    this.configPath = await getPrimaryConfigPath();

    // Validate configuration
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      logger.warn('Configuration validation warnings:', errorMessages);
    }

    logger.info('Configuration manager initialized');
    return this.config;
  }

  /**
   * Get the entire configuration
   */
  getAll(): Config {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return { ...this.config };
  }

  /**
   * Get a configuration value by path
   *
   * @example
   * get<number>('ai.max_tokens')
   * get<string>('providers.openai.api_key')
   */
  get<T>(path: string): T {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }

    const keys = path.split('.');
    let value: unknown = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        throw new Error(`Configuration path not found: ${path}`);
      }
    }

    return value as T;
  }

  /**
   * Set a configuration value by path
   *
   * @example
   * set('ai.max_tokens', 16000)
   * set('providers.openai.api_key', 'sk-...')
   */
  set<T>(path: string, value: T): void {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }

    const keys = path.split('.');
    const lastKey = keys.pop();

    if (!lastKey) {
      throw new Error('Invalid configuration path');
    }

    let target: Record<string, unknown> = this.config as unknown as Record<
      string,
      unknown
    >;

    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key] as Record<string, unknown>;
    }

    target[lastKey] = value;

    // Validate after change
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      logger.warn('Configuration validation warnings after set:', errorMessages);
    }

    // Notify listeners
    this.notifyChange();
  }

  /**
   * Update configuration with partial config
   */
  update(updates: PartialConfig): void {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }

    this.config = mergeConfig(
      this.config as unknown as Record<string, unknown>,
      updates
    ) as unknown as Config;

    // Validate after change
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      logger.warn('Configuration validation warnings after update:', errorMessages);
    }

    // Notify listeners
    this.notifyChange();
  }

  /**
   * Reload configuration from files
   */
  async reload(): Promise<Config> {
    logger.info('Reloading configuration');

    const oldConfig = this.config;
    this.config = await loadConfig();

    // Validate
    const validation = validateConfig(this.config);
    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      logger.warn('Configuration validation warnings after reload:', errorMessages);
    }

    // Notify if changed
    if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
      this.notifyChange();
    }

    logger.info('Configuration reloaded');
    return this.config;
  }

  /**
   * Save current configuration to file
   *
   * @param filePath Optional file path. If not provided, uses the primary config path
   * @param format Optional format. If not provided, detects from file extension
   */
  async saveChanges(filePath?: string, format?: FileFormat): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }

    const targetPath = filePath || this.configPath;

    if (!targetPath) {
      throw new Error('No config file path available. Provide filePath parameter.');
    }

    // Detect format
    const fileFormat = format || this.detectFormat(targetPath);

    // Serialize configuration
    let content: string;
    switch (fileFormat) {
      case 'toml':
        content = toml.stringify(this.config as unknown as toml.JsonMap);
        break;

      case 'yaml':
      case 'yml':
        content = yaml.dump(this.config, { indent: 2 });
        break;

      case 'json':
        content = JSON.stringify(this.config, null, 2);
        break;

      default:
        throw new Error(`Unsupported format: ${fileFormat}`);
    }

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(targetPath, content, 'utf-8');

    logger.info(`Configuration saved to: ${targetPath}`);

    // Update config path
    this.configPath = targetPath;
  }

  /**
   * Enable hot-reload by watching config files
   */
  enableWatch(): void {
    if (this.watchEnabled) {
      logger.debug('File watching already enabled');
      return;
    }

    if (!this.configPath) {
      logger.warn('No config file to watch');
      return;
    }

    logger.info(`Enabling file watch on: ${this.configPath}`);

    this.watcher = fsSync.watch(this.configPath, async (eventType) => {
      if (eventType === 'change') {
        logger.debug('Config file changed, reloading...');
        try {
          await this.reload();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Failed to reload config: ${errorMessage}`);
        }
      }
    });

    this.watchEnabled = true;
  }

  /**
   * Disable hot-reload
   */
  disableWatch(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.watchEnabled = false;
      logger.info('File watching disabled');
    }
  }

  /**
   * Register a callback for configuration changes
   */
  onChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.add(callback);
  }

  /**
   * Unregister a change callback
   */
  offChange(callback: ConfigChangeCallback): void {
    this.changeCallbacks.delete(callback);
  }

  /**
   * Validate current configuration
   */
  validate(): boolean {
    if (!this.config) {
      return false;
    }

    const validation = validateConfig(this.config);

    if (!validation.valid) {
      const errorMessages = validation.errors.map((e) => `${e.path}: ${e.message}`);
      logger.error('Configuration validation failed:', errorMessages);
    }

    return validation.valid;
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): string[] {
    if (!this.config) {
      return ['Configuration not initialized'];
    }

    const validation = validateConfig(this.config);
    return validation.errors.map((e) => `${e.path}: ${e.message}`);
  }

  /**
   * Get the current config file path
   */
  getConfigPath(): string | null {
    return this.configPath;
  }

  /**
   * Check if watching is enabled
   */
  isWatchEnabled(): boolean {
    return this.watchEnabled;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disableWatch();
    this.changeCallbacks.clear();
  }

  /**
   * Notify change listeners
   */
  private notifyChange(): void {
    if (this.config) {
      const callbacks = Array.from(this.changeCallbacks);
      for (const callback of callbacks) {
        try {
          callback(this.config);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Error in change callback: ${errorMessage}`);
        }
      }
    }
  }

  /**
   * Detect file format from extension
   */
  private detectFormat(filePath: string): FileFormat {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.toml':
        return 'toml';
      case '.yaml':
        return 'yaml';
      case '.yml':
        return 'yml';
      case '.json':
        return 'json';
      default:
        return 'json'; // Default to JSON
    }
  }
}

// Singleton instance
let defaultManager: ConfigurationManager | null = null;

/**
 * Get the default configuration manager instance
 */
export function getConfigManager(): ConfigurationManager {
  if (!defaultManager) {
    defaultManager = new ConfigurationManager();
  }
  return defaultManager;
}

/**
 * Reset the default configuration manager
 */
export function resetConfigManager(): void {
  if (defaultManager) {
    defaultManager.dispose();
    defaultManager = null;
  }
}
