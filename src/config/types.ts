/**
 * Configuration Type Definitions for AIrchitect
 *
 * Complete TypeScript interfaces for the configuration system.
 * Aligned with the TOML/YAML/JSON schema requirements.
 *
 * @module config/types
 */

/**
 * AI Provider Configuration
 */
export interface AIConfig {
  /** Default AI provider to use */
  default_provider: string;
  /** Maximum tokens for AI responses */
  max_tokens: number;
  /** Temperature for AI responses (0-2) */
  temperature: number;
  /** AI model identifier */
  model: string;
  /** Timeout in seconds for AI requests */
  timeout_seconds: number;
}

/**
 * Memory System Configuration
 */
export interface MemoryConfig {
  /** Memory backend type (chroma, llamaindex, etc.) */
  type: string;
  /** Memory backend URL */
  url: string;
  /** Enable persistence to disk */
  enable_persistence: boolean;
  /** Cleanup interval in hours */
  cleanup_interval_hours: number;
}

/**
 * OpenAI Provider Configuration
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key (supports env var substitution) */
  api_key: string;
  /** OpenAI API base URL */
  base_url: string;
}

/**
 * Anthropic Provider Configuration
 */
export interface AnthropicProviderConfig {
  /** Anthropic API key (supports env var substitution) */
  api_key: string;
  /** Maximum tokens for Anthropic */
  max_tokens: number;
}

/**
 * Gemini Provider Configuration
 */
export interface GeminiProviderConfig {
  /** Google Gemini API key (supports env var substitution) */
  api_key: string;
}

/**
 * Local Providers Configuration
 */
export interface LocalProviderConfig {
  /** Ollama service URL */
  ollama_url: string;
  /** LM Studio service URL */
  lm_studio_url: string;
}

/**
 * All Providers Configuration
 */
export interface ProvidersConfig {
  /** OpenAI configuration */
  openai: OpenAIProviderConfig;
  /** Anthropic configuration */
  anthropic: AnthropicProviderConfig;
  /** Google Gemini configuration */
  gemini: GeminiProviderConfig;
  /** Local providers configuration */
  local: LocalProviderConfig;
}

/**
 * Agents Configuration
 */
export interface AgentsConfig {
  /** Maximum parallel agents */
  max_parallel: number;
  /** Timeout in seconds for agent operations */
  timeout_seconds: number;
  /** Enable agent logging */
  enable_logging: boolean;
}

/**
 * Security Configuration
 */
export interface SecurityConfig {
  /** Enable authentication */
  enable_auth: boolean;
  /** JWT secret (supports env var substitution) */
  jwt_secret: string;
  /** Token expiry in hours */
  token_expiry_hours: number;
  /** Enable audit logging */
  enable_audit_log: boolean;
  /** Audit log file path */
  audit_log_path: string;
}

/**
 * Checkpoint Configuration
 */
export interface CheckpointConfig {
  /** Enable checkpoint system */
  enabled: boolean;
  /** Auto backup before restore */
  auto_backup_before_restore: boolean;
  /** Backup directory path */
  backup_directory: string;
  /** Maximum number of checkpoints to keep */
  max_checkpoints: number;
}

/**
 * Logging Configuration
 */
export interface LoggingConfig {
  /** Log level (trace, debug, info, warn, error) */
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /** Log format (json, simple, detailed) */
  format: 'json' | 'simple' | 'detailed';
  /** Log output destination */
  output: 'stdout' | 'stderr' | 'file';
}

/**
 * Complete Configuration Interface
 */
export interface Config {
  /** AI configuration */
  ai: AIConfig;
  /** Memory system configuration */
  memory: MemoryConfig;
  /** Providers configuration */
  providers: ProvidersConfig;
  /** Agents configuration */
  agents: AgentsConfig;
  /** Security configuration */
  security: SecurityConfig;
  /** Checkpoint configuration */
  checkpoint: CheckpointConfig;
  /** Logging configuration */
  logging: LoggingConfig;
}

/**
 * Partial configuration for updates and overrides
 */
export type PartialConfig = {
  [K in keyof Config]?: Partial<Config[K]>;
};

/**
 * Deep partial configuration type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Configuration validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** List of validation errors */
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Path to the invalid field */
  path: string;
  /** Error message */
  message: string;
  /** Current value */
  value?: unknown;
}

/**
 * Configuration source information
 */
export interface ConfigSource {
  /** Source type */
  type: 'file' | 'env' | 'default';
  /** File path (if type is 'file') */
  path?: string;
  /** Priority (higher = more important) */
  priority: number;
}

/**
 * File format types
 */
export type FileFormat = 'toml' | 'yaml' | 'yml' | 'json';

/**
 * Environment variable prefix
 */
export const ENV_PREFIX = 'AIRCHITECT_';

/**
 * Configuration file discovery paths
 */
export const CONFIG_SEARCH_PATHS = [
  '.airchitect/config',
  '~/.airchitect/config',
  'XDG_CONFIG_HOME/airchitect/config',
] as const;

/**
 * Supported configuration file extensions
 */
export const CONFIG_EXTENSIONS: FileFormat[] = ['toml', 'yaml', 'yml', 'json'];

/**
 * Type guard for FileFormat
 */
export function isFileFormat(value: string): value is FileFormat {
  return CONFIG_EXTENSIONS.includes(value as FileFormat);
}

/**
 * Type guard for log level
 */
export function isLogLevel(value: string): value is LoggingConfig['level'] {
  return ['trace', 'debug', 'info', 'warn', 'error'].includes(value);
}

/**
 * Type guard for log format
 */
export function isLogFormat(value: string): value is LoggingConfig['format'] {
  return ['json', 'simple', 'detailed'].includes(value);
}

/**
 * Type guard for log output
 */
export function isLogOutput(value: string): value is LoggingConfig['output'] {
  return ['stdout', 'stderr', 'file'].includes(value);
}
