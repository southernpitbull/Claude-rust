/**
 * Configuration Management System
 *
 * Complete configuration management for AIrchitect with:
 * - Multi-format support (TOML, YAML, JSON)
 * - File discovery from multiple locations
 * - Environment variable overrides
 * - Hot-reload capabilities
 * - Validation and type safety
 * - Persistence
 *
 * @module config
 */

// Export types
export type {
  Config,
  PartialConfig,
  DeepPartial,
  AIConfig,
  MemoryConfig,
  ProvidersConfig,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GeminiProviderConfig,
  LocalProviderConfig,
  AgentsConfig,
  SecurityConfig,
  CheckpointConfig,
  LoggingConfig,
  ValidationResult,
  ValidationError,
  ConfigSource,
  FileFormat,
} from './types';

// Export type guards
export {
  isFileFormat,
  isLogLevel,
  isLogFormat,
  isLogOutput,
  ENV_PREFIX,
  CONFIG_SEARCH_PATHS,
  CONFIG_EXTENSIONS,
} from './types';

// Export schema and validation
export { DEFAULT_CONFIG, validateConfig, substituteEnvVars, mergeConfig } from './schema';

// Export loader functions
export {
  loadConfig,
  loadConfigFromFile,
  loadConfigFile,
  loadEnvOverrides,
  discoverConfigFiles,
  configExists,
  getPrimaryConfigPath,
} from './loader';

// Export manager
export { ConfigurationManager, getConfigManager, resetConfigManager } from './manager';

// Re-export legacy types for backward compatibility
export type { AIrchitectConfig } from './config';
export { ConfigManager } from './ConfigManager';

/**
 * Quick initialization helper
 *
 * Initializes and returns a ready-to-use configuration manager.
 *
 * @param enableWatch Enable file watching for hot-reload
 * @returns Initialized configuration manager
 */
export async function initializeConfig(enableWatch = false): Promise<ConfigurationManager> {
  const { ConfigurationManager } = await import('./manager');
  const manager = new ConfigurationManager();
  await manager.initialize();

  if (enableWatch) {
    manager.enableWatch();
  }

  return manager;
}

/**
 * Get current configuration
 *
 * Convenience function to get the current configuration from the default manager.
 *
 * @returns Current configuration or null if not initialized
 */
export async function getCurrentConfig(): Promise<Config> {
  const { getConfigManager } = await import('./manager');
  const manager = getConfigManager();

  // Initialize if not already done
  try {
    return manager.getAll();
  } catch {
    return await manager.initialize();
  }
}

/**
 * Update configuration
 *
 * Convenience function to update configuration using the default manager.
 *
 * @param updates Partial configuration to merge
 */
export async function updateConfig(updates: PartialConfig): Promise<void> {
  const { getConfigManager } = await import('./manager');
  const manager = getConfigManager();

  // Initialize if not already done
  try {
    manager.getAll();
  } catch {
    await manager.initialize();
  }

  manager.update(updates);
}

/**
 * Save configuration
 *
 * Convenience function to save configuration using the default manager.
 *
 * @param filePath Optional file path
 * @param format Optional format
 */
export async function saveConfig(filePath?: string, format?: FileFormat): Promise<void> {
  const { getConfigManager } = await import('./manager');
  const manager = getConfigManager();

  // Initialize if not already done
  try {
    manager.getAll();
  } catch {
    await manager.initialize();
  }

  await manager.saveChanges(filePath, format);
}

// Import types for the export above
import type { Config, PartialConfig, FileFormat } from './types';
import type { ConfigurationManager } from './manager';
