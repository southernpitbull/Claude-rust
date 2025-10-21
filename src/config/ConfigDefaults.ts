/**
 * ConfigDefaults.ts
 *
 * Provides comprehensive default configuration values for AIrchitect CLI.
 * All defaults are type-safe and environment-aware.
 *
 * @module config/ConfigDefaults
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Environment type definition
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Log level type definition
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Merge strategy type for configuration merging
 */
export type MergeStrategy = 'replace' | 'append' | 'prepend' | 'union' | 'deep';

/**
 * Export format type for configuration export
 */
export type ExportFormat = 'json' | 'yaml' | 'toml' | 'env';

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
}

/**
 * Agent memory configuration
 */
export interface AgentMemoryConfig {
  enabled: boolean;
  provider: string;
  maxSize: number;
  ttl: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  maxConcurrent: number;
  timeout: number;
  retries: number;
  memory: AgentMemoryConfig;
  enableEvolution: boolean;
  enableCollaboration: boolean;
}

/**
 * CLI configuration
 */
export interface CLIConfig {
  interactive: boolean;
  color: boolean;
  unicode: boolean;
  theme: string;
  maxHistory: number;
}

/**
 * Log rotation configuration
 */
export interface RotationConfig {
  enabled: boolean;
  maxSize: string;
  maxFiles: number;
  datePattern: string;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: LogLevel;
  file: boolean;
  console: boolean;
  format: string;
  rotation: RotationConfig;
  silent: boolean;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  encryption: boolean;
  keyring: boolean;
  apiKeys: Record<string, string>;
  requireAuthForFileOps: boolean;
  enableGovernance: boolean;
  maxTokensPerRequest: number;
}

/**
 * TUI layout configuration
 */
export interface LayoutConfig {
  splitDirection: 'horizontal' | 'vertical';
  showSidebar: boolean;
  sidebarWidth: number;
}

/**
 * TUI configuration
 */
export interface TUIConfig {
  enabled: boolean;
  theme: string;
  layout: LayoutConfig;
  showStatusBar: boolean;
  showTabBar: boolean;
  enableSyntaxHighlighting: boolean;
}

/**
 * Vector store configuration
 */
export interface VectorStoreConfig {
  provider: string;
  dimensions: number;
  indexType: string;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  provider: string;
  vectorStore: VectorStoreConfig;
  maxSize: number;
  enabled: boolean;
}

/**
 * Paths configuration
 */
export interface PathsConfig {
  config: string;
  data: string;
  cache: string;
  logs: string;
  plugins: string;
  projectMemory: string;
  checkpoints: string;
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig {
  enabled: boolean;
  interval: number;
  maxCheckpoints: number;
  autoCleanup: boolean;
}

/**
 * Complete configuration interface
 */
export interface Config {
  version: string;
  env: Environment;
  defaultMode: 'planning' | 'work';
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
  agents: AgentConfig;
  cli: CLIConfig;
  logging: LoggingConfig;
  security: SecurityConfig;
  tui: TUIConfig;
  memory: MemoryConfig;
  paths: PathsConfig;
  checkpoint: CheckpointConfig;
}

/**
 * Type for deep readonly configuration
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Type for deep partial configuration
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Get the default configuration directory based on the platform
 *
 * @returns {string} Default configuration directory path
 */
function getDefaultConfigDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.aichitect');
}

/**
 * Get the default data directory based on the platform
 *
 * @returns {string} Default data directory path
 */
function getDefaultDataDir(): string {
  const configDir = getDefaultConfigDir();
  return path.join(configDir, 'data');
}

/**
 * Get the default cache directory based on the platform
 *
 * @returns {string} Default cache directory path
 */
function getDefaultCacheDir(): string {
  const configDir = getDefaultConfigDir();
  return path.join(configDir, 'cache');
}

/**
 * Get the default logs directory based on the platform
 *
 * @returns {string} Default logs directory path
 */
function getDefaultLogsDir(): string {
  const configDir = getDefaultConfigDir();
  return path.join(configDir, 'logs');
}

/**
 * Default provider configurations
 */
const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  openai: {
    enabled: true,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    retries: 3,
  },
  anthropic: {
    enabled: true,
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    retries: 3,
  },
  google: {
    enabled: true,
    model: 'gemini-1.5-pro',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    retries: 3,
  },
  qwen: {
    enabled: true,
    model: 'qwen-max',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    retries: 3,
  },
  cloudflare: {
    enabled: true,
    model: '@cf/meta/llama-3.1-8b-instruct',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    retries: 3,
  },
  ollama: {
    enabled: true,
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000,
    retries: 2,
  },
  lmstudio: {
    enabled: true,
    baseUrl: 'http://localhost:1234',
    model: 'local-model',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000,
    retries: 2,
  },
  vllm: {
    enabled: false,
    baseUrl: 'http://localhost:8000',
    model: 'facebook/opt-125m',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 120000,
    retries: 2,
  },
};

/**
 * Default agent memory configuration
 */
const DEFAULT_AGENT_MEMORY: AgentMemoryConfig = {
  enabled: true,
  provider: 'llamaindex',
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Default agent configuration
 */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxConcurrent: 5,
  timeout: 300000, // 5 minutes
  retries: 3,
  memory: DEFAULT_AGENT_MEMORY,
  enableEvolution: true,
  enableCollaboration: true,
};

/**
 * Default CLI configuration
 */
const DEFAULT_CLI_CONFIG: CLIConfig = {
  interactive: true,
  color: true,
  unicode: true,
  theme: 'default',
  maxHistory: 100,
};

/**
 * Default log rotation configuration
 */
const DEFAULT_ROTATION_CONFIG: RotationConfig = {
  enabled: true,
  maxSize: '20m',
  maxFiles: 14,
  datePattern: 'YYYY-MM-DD',
};

/**
 * Default logging configuration
 */
const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
  level: 'info',
  file: true,
  console: true,
  format: 'json',
  rotation: DEFAULT_ROTATION_CONFIG,
  silent: false,
};

/**
 * Default security configuration
 */
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  encryption: true,
  keyring: true,
  apiKeys: {},
  requireAuthForFileOps: true,
  enableGovernance: true,
  maxTokensPerRequest: 4000,
};

/**
 * Default TUI layout configuration
 */
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  splitDirection: 'horizontal',
  showSidebar: true,
  sidebarWidth: 30,
};

/**
 * Default TUI configuration
 */
const DEFAULT_TUI_CONFIG: TUIConfig = {
  enabled: true,
  theme: 'default',
  layout: DEFAULT_LAYOUT_CONFIG,
  showStatusBar: true,
  showTabBar: false,
  enableSyntaxHighlighting: true,
};

/**
 * Default vector store configuration
 */
const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig = {
  provider: 'llamaindex',
  dimensions: 1536,
  indexType: 'flat',
};

/**
 * Default memory configuration
 */
const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  provider: 'llamaindex',
  vectorStore: DEFAULT_VECTOR_STORE_CONFIG,
  maxSize: 500 * 1024 * 1024, // 500MB
  enabled: true,
};

/**
 * Default paths configuration
 */
const DEFAULT_PATHS_CONFIG: PathsConfig = {
  config: getDefaultConfigDir(),
  data: getDefaultDataDir(),
  cache: getDefaultCacheDir(),
  logs: getDefaultLogsDir(),
  plugins: path.join(getDefaultConfigDir(), 'plugins'),
  projectMemory: './.aichitect/memory',
  checkpoints: './.aichitect/checkpoints',
};

/**
 * Default checkpoint configuration
 */
const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  enabled: true,
  interval: 30, // minutes
  maxCheckpoints: 50,
  autoCleanup: true,
};

/**
 * Complete default configuration
 *
 * This is the master default configuration that is used when no
 * user configuration is provided. It includes sensible defaults
 * for all configuration options.
 */
export const DEFAULT_CONFIG: DeepReadonly<Config> = {
  version: '1.0.0',
  env: 'development',
  defaultMode: 'planning',
  defaultProvider: 'openai',
  providers: DEFAULT_PROVIDERS,
  agents: DEFAULT_AGENT_CONFIG,
  cli: DEFAULT_CLI_CONFIG,
  logging: DEFAULT_LOGGING_CONFIG,
  security: DEFAULT_SECURITY_CONFIG,
  tui: DEFAULT_TUI_CONFIG,
  memory: DEFAULT_MEMORY_CONFIG,
  paths: DEFAULT_PATHS_CONFIG,
  checkpoint: DEFAULT_CHECKPOINT_CONFIG,
};

/**
 * Get environment-specific default configuration
 *
 * @param {Environment} env - The environment to get defaults for
 * @returns {DeepPartial<Config>} Environment-specific configuration overrides
 */
export function getEnvironmentDefaults(env: Environment): DeepPartial<Config> {
  switch (env) {
    case 'production':
      return {
        logging: {
          level: 'warn',
          console: false,
        },
        security: {
          encryption: true,
          requireAuthForFileOps: true,
          enableGovernance: true,
        },
        cli: {
          interactive: false,
        },
      };
    case 'staging':
      return {
        logging: {
          level: 'info',
        },
        security: {
          encryption: true,
        },
      };
    case 'development':
    default:
      return {
        logging: {
          level: 'debug',
          console: true,
        },
        security: {
          encryption: false,
          requireAuthForFileOps: false,
        },
      };
  }
}

/**
 * Get provider-specific defaults
 *
 * @param {string} provider - The provider name
 * @returns {ProviderConfig | undefined} Provider-specific configuration
 */
export function getProviderDefaults(provider: string): ProviderConfig | undefined {
  return DEFAULT_PROVIDERS[provider];
}

/**
 * Create a new configuration with defaults
 *
 * @param {DeepPartial<Config>} overrides - Configuration overrides
 * @returns {Config} Complete configuration with defaults applied
 */
export function createDefaultConfig(overrides?: DeepPartial<Config>): Config {
  if (!overrides) {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;
  }

  // Deep clone default config
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;

  // Apply overrides (shallow merge for now, will use ConfigMerger for deep merge)
  return {
    ...config,
    ...overrides,
  };
}

/**
 * Validate that a configuration object has all required fields
 *
 * @param {unknown} config - The configuration to validate
 * @returns {boolean} True if the configuration has all required fields
 */
export function hasRequiredFields(config: unknown): config is Config {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const cfg = config as Partial<Config>;
  return (
    typeof cfg.version === 'string' &&
    typeof cfg.env === 'string' &&
    typeof cfg.providers === 'object' &&
    typeof cfg.agents === 'object' &&
    typeof cfg.cli === 'object' &&
    typeof cfg.logging === 'object' &&
    typeof cfg.security === 'object' &&
    typeof cfg.tui === 'object' &&
    typeof cfg.memory === 'object' &&
    typeof cfg.paths === 'object'
  );
}
