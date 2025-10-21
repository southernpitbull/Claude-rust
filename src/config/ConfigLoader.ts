/**
 * ConfigLoader.ts
 *
 * Multi-source configuration loader with support for files, environment
 * variables, CLI arguments, and remote sources. Includes hot reload and
 * file watching capabilities.
 *
 * @module config/ConfigLoader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { DEFAULT_CONFIG, type Config, type DeepPartial } from './ConfigDefaults';
import { parseEnvVars, type PartialConfig } from './ConfigSchema';
import { ConfigMerger } from './ConfigMerger';
import { ConfigValidator } from './ConfigValidator';

/**
 * Configuration source types
 */
export type ConfigSourceType = 'file' | 'env' | 'cli' | 'remote' | 'default';

/**
 * Configuration source definition
 */
export interface ConfigSource {
  type: ConfigSourceType;
  path?: string;
  priority: number;
  data?: unknown;
}

/**
 * File format types
 */
export type FileFormat = 'json' | 'yaml' | 'toml' | 'js' | 'ts';

/**
 * Loader options
 */
export interface LoaderOptions {
  searchPaths?: string[];
  configFileNames?: string[];
  envPrefix?: string;
  watchEnabled?: boolean;
  validateOnLoad?: boolean;
  mergeStrategy?: 'replace' | 'deep';
}

/**
 * Configuration change callback
 */
export type ConfigChangeCallback = (config: Config) => void | Promise<void>;

/**
 * Default configuration file names (in order of preference)
 */
const DEFAULT_CONFIG_FILES = [
  'aichitect.config.json',
  '.aichitectrc.json',
  '.aichitectrc',
  'aichitect.config.js',
  'aichitect.config.ts',
];

/**
 * Default search paths (in order of priority)
 */
const DEFAULT_SEARCH_PATHS = [
  process.cwd(), // Current working directory
  path.join(process.cwd(), '.aichitect'), // Project .aichitect directory
  path.join(os.homedir(), '.aichitect'), // User home .aichitect directory
  path.join(os.homedir()), // User home directory
];

/**
 * Configuration loader class
 *
 * Loads configuration from multiple sources with priority-based merging:
 * 1. CLI arguments (highest priority)
 * 2. Environment variables
 * 3. Project config file
 * 4. User config file
 * 5. System config file
 * 6. Default config (lowest priority)
 */
export class ConfigLoader extends EventEmitter {
  private sources: ConfigSource[] = [];
  private loadedConfig: Config | null = null;
  private options: LoaderOptions;
  private merger: ConfigMerger;
  private validator: ConfigValidator;
  private watchCallbacks: Set<ConfigChangeCallback> = new Set();

  /**
   * Create a new ConfigLoader instance
   *
   * @param {LoaderOptions} options - Loader options
   */
  constructor(options: LoaderOptions = {}) {
    super();
    this.options = {
      searchPaths: options.searchPaths || DEFAULT_SEARCH_PATHS,
      configFileNames: options.configFileNames || DEFAULT_CONFIG_FILES,
      envPrefix: options.envPrefix || 'AICHITECT',
      watchEnabled: options.watchEnabled ?? false,
      validateOnLoad: options.validateOnLoad ?? true,
      mergeStrategy: options.mergeStrategy || 'deep',
    };

    this.merger = new ConfigMerger(this.options.mergeStrategy);
    this.validator = new ConfigValidator('strict');
  }

  /**
   * Load configuration from all sources
   *
   * @param {ConfigSource[]} sources - Additional sources to load from
   * @returns {Promise<Config>} Loaded and merged configuration
   */
  public async load(sources: ConfigSource[] = []): Promise<Config> {
    this.sources = [];

    // Priority 6: Load defaults (lowest priority)
    this.sources.push({
      type: 'default',
      priority: 0,
      data: DEFAULT_CONFIG,
    });

    // Priority 5: Load from system config
    await this.loadSystemConfig();

    // Priority 4: Load from user config
    await this.loadUserConfig();

    // Priority 3: Load from project config
    await this.loadProjectConfig();

    // Priority 2: Load from environment variables
    this.loadEnvironmentVariables();

    // Priority 1: Load from CLI arguments (if provided)
    this.sources.push(...sources.filter((s) => s.type === 'cli'));

    // Sort sources by priority (higher priority last)
    this.sources.sort((a, b) => a.priority - b.priority);

    // Merge all configurations
    const configs = this.sources.map((s) => s.data as PartialConfig).filter(Boolean);
    this.loadedConfig = this.merger.merge(...configs);

    // Validate the final configuration
    if (this.options.validateOnLoad) {
      const result = this.validator.validate(this.loadedConfig);
      if (!result.success) {
        const errorMessages = result.errors?.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new Error(`Configuration validation failed:\n${errorMessages?.join('\n')}`);
      }
    }

    // Emit loaded event
    this.emit('loaded', this.loadedConfig);

    return this.loadedConfig;
  }

  /**
   * Reload configuration from all sources
   *
   * @returns {Promise<Config>} Reloaded configuration
   */
  public async reload(): Promise<Config> {
    const oldConfig = this.loadedConfig;
    const newConfig = await this.load();

    if (JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
      this.emit('changed', newConfig, oldConfig);

      // Call watch callbacks
      for (const callback of this.watchCallbacks) {
        try {
          await callback(newConfig);
        } catch (error) {
          this.emit('error', error);
        }
      }
    }

    return newConfig;
  }

  /**
   * Watch for configuration changes
   *
   * @param {ConfigChangeCallback} callback - Callback to call when config changes
   */
  public watch(callback: ConfigChangeCallback): void {
    this.watchCallbacks.add(callback);

    // Enable watching if not already enabled
    if (!this.options.watchEnabled) {
      this.options.watchEnabled = true;
    }
  }

  /**
   * Stop watching for configuration changes
   *
   * @param {ConfigChangeCallback} callback - Callback to remove (if not provided, removes all)
   */
  public unwatch(callback?: ConfigChangeCallback): void {
    if (callback) {
      this.watchCallbacks.delete(callback);
    } else {
      this.watchCallbacks.clear();
    }

    // Disable watching if no callbacks remain
    if (this.watchCallbacks.size === 0) {
      this.options.watchEnabled = false;
    }
  }

  /**
   * Get the loaded configuration
   *
   * @returns {Config | null} Loaded configuration or null if not loaded
   */
  public getConfig(): Config | null {
    return this.loadedConfig;
  }

  /**
   * Get all configuration sources
   *
   * @returns {ConfigSource[]} Array of configuration sources
   */
  public getSources(): ConfigSource[] {
    return [...this.sources];
  }

  /**
   * Find a configuration file in search paths
   *
   * @returns {Promise<string | null>} Path to config file or null if not found
   */
  public async findConfigFile(): Promise<string | null> {
    for (const searchPath of this.options.searchPaths || []) {
      for (const fileName of this.options.configFileNames || []) {
        const filePath = path.join(searchPath, fileName);
        try {
          await fs.access(filePath);
          return filePath;
        } catch {
          // File doesn't exist, continue
        }
      }
    }
    return null;
  }

  /**
   * Load configuration from a file
   *
   * @param {string} filePath - Path to configuration file
   * @returns {Promise<PartialConfig>} Loaded configuration
   */
  public async loadFromFile(filePath: string): Promise<PartialConfig> {
    try {
      await fs.access(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const format = this.detectFileFormat(filePath);

      switch (format) {
        case 'json':
          return JSON.parse(content) as PartialConfig;
        case 'js':
        case 'ts':
          // For JS/TS files, we would need to use dynamic import
          // For now, we'll try to parse as JSON
          try {
            return JSON.parse(content) as PartialConfig;
          } catch {
            throw new Error(`Cannot load ${format} config files yet. Use JSON format.`);
          }
        case 'yaml':
        case 'toml':
          throw new Error(`${format.toUpperCase()} format not yet supported. Use JSON format.`);
        default:
          throw new Error(`Unknown config file format: ${format}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to load config from ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load from environment variables
   */
  private loadEnvironmentVariables(): void {
    const envConfig = parseEnvVars(process.env);

    if (Object.keys(envConfig).length > 0) {
      this.sources.push({
        type: 'env',
        priority: 70,
        data: envConfig,
      });
    }
  }

  /**
   * Load from project config file
   */
  private async loadProjectConfig(): Promise<void> {
    const projectPaths = [process.cwd(), path.join(process.cwd(), '.aichitect')];

    for (const searchPath of projectPaths) {
      for (const fileName of this.options.configFileNames || []) {
        const filePath = path.join(searchPath, fileName);
        try {
          const config = await this.loadFromFile(filePath);
          this.sources.push({
            type: 'file',
            path: filePath,
            priority: 50,
            data: config,
          });
          return; // Only load the first config file found
        } catch {
          // Continue to next file
        }
      }
    }
  }

  /**
   * Load from user config file
   */
  private async loadUserConfig(): Promise<void> {
    const userPaths = [path.join(os.homedir(), '.aichitect'), os.homedir()];

    for (const searchPath of userPaths) {
      for (const fileName of this.options.configFileNames || []) {
        const filePath = path.join(searchPath, fileName);
        try {
          const config = await this.loadFromFile(filePath);
          this.sources.push({
            type: 'file',
            path: filePath,
            priority: 30,
            data: config,
          });
          return; // Only load the first config file found
        } catch {
          // Continue to next file
        }
      }
    }
  }

  /**
   * Load from system config file
   */
  private async loadSystemConfig(): Promise<void> {
    const systemPaths =
      process.platform === 'win32'
        ? ['C:\\ProgramData\\aichitect']
        : ['/etc/aichitect', '/usr/local/etc/aichitect'];

    for (const searchPath of systemPaths) {
      for (const fileName of this.options.configFileNames || []) {
        const filePath = path.join(searchPath, fileName);
        try {
          const config = await this.loadFromFile(filePath);
          this.sources.push({
            type: 'file',
            path: filePath,
            priority: 10,
            data: config,
          });
          return; // Only load the first config file found
        } catch {
          // Continue to next file
        }
      }
    }
  }

  /**
   * Detect file format from extension
   *
   * @param {string} filePath - File path
   * @returns {FileFormat} Detected file format
   */
  private detectFileFormat(filePath: string): FileFormat {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.toml':
        return 'toml';
      case '.js':
        return 'js';
      case '.ts':
        return 'ts';
      default:
        // If no extension, try to detect from filename
        if (filePath.endsWith('rc')) {
          return 'json';
        }
        return 'json';
    }
  }
}

/**
 * Create a loader instance
 *
 * @param {LoaderOptions} options - Loader options
 * @returns {ConfigLoader} Loader instance
 */
export function createLoader(options?: LoaderOptions): ConfigLoader {
  return new ConfigLoader(options);
}

/**
 * Quick load helper
 *
 * @param {LoaderOptions} options - Loader options
 * @returns {Promise<Config>} Loaded configuration
 */
export async function loadConfig(options?: LoaderOptions): Promise<Config> {
  const loader = new ConfigLoader(options);
  return await loader.load();
}
