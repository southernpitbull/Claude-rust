/**
 * Configuration File Loader
 *
 * Discovers and loads configuration files from multiple sources.
 * Supports TOML, YAML, and JSON formats.
 * Implements environment variable overrides.
 *
 * @module config/loader
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as toml from '@iarna/toml';
import * as yaml from 'js-yaml';
import type { Config, PartialConfig, FileFormat, ConfigSource } from './types';
import { DEFAULT_CONFIG, mergeConfig, substituteEnvVars } from './schema';

// Simple logger for now - can be replaced with full logging system later
const logger = {
  debug: (...args: unknown[]) => console.debug('[config-loader]', ...args),
  info: (...args: unknown[]) => console.info('[config-loader]', ...args),
  warn: (...args: unknown[]) => console.warn('[config-loader]', ...args),
  error: (...args: unknown[]) => console.error('[config-loader]', ...args),
};

/**
 * Configuration search paths in order of priority
 */
const SEARCH_PATHS = ['.airchitect', path.join(os.homedir(), '.airchitect'), getXDGConfigPath()];

/**
 * Get XDG config path
 */
function getXDGConfigPath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'airchitect');
  }
  return path.join(os.homedir(), '.config', 'airchitect');
}

/**
 * Supported configuration file names
 */
const CONFIG_FILENAMES = ['config.toml', 'config.yaml', 'config.yml', 'config.json'];

/**
 * Discover configuration files
 *
 * Searches for config files in all standard locations.
 * Returns all found files with their paths and priorities.
 */
export async function discoverConfigFiles(): Promise<ConfigSource[]> {
  const sources: ConfigSource[] = [];
  let priority = 1;

  for (const searchPath of SEARCH_PATHS) {
    for (const filename of CONFIG_FILENAMES) {
      const filePath = path.join(searchPath, filename);

      try {
        await fs.access(filePath);
        sources.push({
          type: 'file',
          path: filePath,
          priority: priority++,
        });
        logger.debug(`Found config file: ${filePath}`);
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  return sources;
}

/**
 * Detect file format from extension
 */
function detectFormat(filePath: string): FileFormat {
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
      throw new Error(`Unknown file extension: ${ext}`);
  }
}

/**
 * Parse configuration file based on format
 */
async function parseConfigFile(filePath: string, format: FileFormat): Promise<PartialConfig> {
  const content = await fs.readFile(filePath, 'utf-8');

  try {
    switch (format) {
      case 'toml':
        return toml.parse(content) as PartialConfig;

      case 'yaml':
      case 'yml':
        return yaml.load(content) as PartialConfig;

      case 'json':
        return JSON.parse(content) as PartialConfig;

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse ${format} file ${filePath}: ${errorMessage}`);
  }
}

/**
 * Load configuration from a file
 */
export async function loadConfigFile(filePath: string): Promise<PartialConfig> {
  logger.info(`Loading config from: ${filePath}`);

  const format = detectFormat(filePath);
  const config = await parseConfigFile(filePath, format);

  logger.debug(`Loaded ${format} config:`, config);
  return config;
}

/**
 * Load environment variable overrides
 *
 * Supports AIRCHITECT_* environment variables.
 * Example: AIRCHITECT_AI_MAX_TOKENS=16000
 */
export function loadEnvOverrides(): PartialConfig {
  const config: PartialConfig = {};
  const prefix = 'AIRCHITECT_';

  // AI configuration
  if (process.env[`${prefix}AI_DEFAULT_PROVIDER`]) {
    config.ai = {
      ...config.ai,
      default_provider: process.env[`${prefix}AI_DEFAULT_PROVIDER`],
    };
  }
  if (process.env[`${prefix}AI_MAX_TOKENS`]) {
    config.ai = {
      ...config.ai,
      max_tokens: parseInt(process.env[`${prefix}AI_MAX_TOKENS`] as string, 10),
    };
  }
  if (process.env[`${prefix}AI_TEMPERATURE`]) {
    config.ai = {
      ...config.ai,
      temperature: parseFloat(process.env[`${prefix}AI_TEMPERATURE`] as string),
    };
  }
  if (process.env[`${prefix}AI_MODEL`]) {
    config.ai = {
      ...config.ai,
      model: process.env[`${prefix}AI_MODEL`],
    };
  }
  if (process.env[`${prefix}AI_TIMEOUT_SECONDS`]) {
    config.ai = {
      ...config.ai,
      timeout_seconds: parseInt(process.env[`${prefix}AI_TIMEOUT_SECONDS`] as string, 10),
    };
  }

  // Memory configuration
  if (process.env[`${prefix}MEMORY_TYPE`]) {
    config.memory = {
      ...config.memory,
      type: process.env[`${prefix}MEMORY_TYPE`],
    };
  }
  if (process.env[`${prefix}MEMORY_URL`]) {
    config.memory = {
      ...config.memory,
      url: process.env[`${prefix}MEMORY_URL`],
    };
  }
  if (process.env[`${prefix}MEMORY_ENABLE_PERSISTENCE`]) {
    config.memory = {
      ...config.memory,
      enable_persistence: process.env[`${prefix}MEMORY_ENABLE_PERSISTENCE`] === 'true',
    };
  }

  // Provider API keys (these are referenced via ${VAR_NAME} in config)
  // We don't override them here, they're substituted later

  // Logging configuration
  if (process.env[`${prefix}LOG_LEVEL`]) {
    const level = process.env[`${prefix}LOG_LEVEL`];
    if (['trace', 'debug', 'info', 'warn', 'error'].includes(level as string)) {
      config.logging = {
        ...config.logging,
        level: level as Config['logging']['level'],
      };
    }
  }
  if (process.env[`${prefix}LOG_FORMAT`]) {
    const format = process.env[`${prefix}LOG_FORMAT`];
    if (['json', 'simple', 'detailed'].includes(format as string)) {
      config.logging = {
        ...config.logging,
        format: format as Config['logging']['format'],
      };
    }
  }

  // Agents configuration
  if (process.env[`${prefix}AGENTS_MAX_PARALLEL`]) {
    config.agents = {
      ...config.agents,
      max_parallel: parseInt(process.env[`${prefix}AGENTS_MAX_PARALLEL`] as string, 10),
    };
  }

  // Security configuration
  if (process.env[`${prefix}SECURITY_ENABLE_AUTH`]) {
    config.security = {
      ...config.security,
      enable_auth: process.env[`${prefix}SECURITY_ENABLE_AUTH`] === 'true',
    };
  }

  // Checkpoint configuration
  if (process.env[`${prefix}CHECKPOINT_ENABLED`]) {
    config.checkpoint = {
      ...config.checkpoint,
      enabled: process.env[`${prefix}CHECKPOINT_ENABLED`] === 'true',
    };
  }
  if (process.env[`${prefix}CHECKPOINT_MAX_CHECKPOINTS`]) {
    config.checkpoint = {
      ...config.checkpoint,
      max_checkpoints: parseInt(process.env[`${prefix}CHECKPOINT_MAX_CHECKPOINTS`] as string, 10),
    };
  }

  const hasOverrides = Object.keys(config).length > 0;
  if (hasOverrides) {
    logger.debug('Loaded environment overrides:', config);
  }

  return config;
}

/**
 * Load and merge all configuration sources
 *
 * Order of precedence (highest to lowest):
 * 1. Environment variables (AIRCHITECT_*)
 * 2. XDG config directory
 * 3. User home directory (~/.airchitect)
 * 4. Project directory (.airchitect)
 * 5. Default configuration
 */
export async function loadConfig(): Promise<Config> {
  logger.info('Loading configuration from all sources');

  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Discover and load config files
  const sources = await discoverConfigFiles();

  // Sort by priority (lower number = higher priority, load first so later ones override)
  sources.sort((a, b) => a.priority - b.priority);

  // Load and merge each file
  for (const source of sources) {
    if (source.path) {
      try {
        const fileConfig = await loadConfigFile(source.path);
        config = mergeConfig(
          config as unknown as Record<string, unknown>,
          fileConfig
        ) as unknown as Config;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`Failed to load config from ${source.path}: ${errorMessage}`);
      }
    }
  }

  // Apply environment variable overrides (highest priority)
  const envOverrides = loadEnvOverrides();
  if (Object.keys(envOverrides).length > 0) {
    config = mergeConfig(
      config as unknown as Record<string, unknown>,
      envOverrides
    ) as unknown as Config;
  }

  // Substitute environment variables in config values (${VAR_NAME})
  config = substituteEnvVars(config);

  logger.info('Configuration loaded successfully');
  return config;
}

/**
 * Load configuration from a specific file
 */
export async function loadConfigFromFile(filePath: string): Promise<Config> {
  logger.info(`Loading configuration from specific file: ${filePath}`);

  // Start with defaults
  let config: Config = { ...DEFAULT_CONFIG };

  // Load and merge the specific file
  const fileConfig = await loadConfigFile(filePath);
  config = mergeConfig(
    config as unknown as Record<string, unknown>,
    fileConfig
  ) as unknown as Config;

  // Apply environment variable overrides
  const envOverrides = loadEnvOverrides();
  if (Object.keys(envOverrides).length > 0) {
    config = mergeConfig(
      config as unknown as Record<string, unknown>,
      envOverrides
    ) as unknown as Config;
  }

  // Substitute environment variables
  config = substituteEnvVars(config);

  return config;
}

/**
 * Check if a config file exists in standard locations
 */
export async function configExists(): Promise<boolean> {
  const sources = await discoverConfigFiles();
  return sources.length > 0;
}

/**
 * Get the path to the primary config file (highest priority existing file)
 */
export async function getPrimaryConfigPath(): Promise<string | null> {
  const sources = await discoverConfigFiles();
  if (sources.length === 0) {
    return null;
  }

  // Return the last one (highest priority)
  return sources[sources.length - 1]?.path ?? null;
}
