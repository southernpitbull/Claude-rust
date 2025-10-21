/**
 * ConfigSchema.ts
 *
 * Defines comprehensive Zod schemas for configuration validation.
 * All configuration objects are validated against these schemas
 * to ensure type safety and correctness.
 *
 * @module config/ConfigSchema
 */

import { z } from 'zod';

/**
 * Environment schema
 */
export const EnvironmentSchema = z.enum(['development', 'staging', 'production']);

/**
 * Log level schema
 */
export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error']);

/**
 * Merge strategy schema
 */
export const MergeStrategySchema = z.enum(['replace', 'append', 'prepend', 'union', 'deep']);

/**
 * Export format schema
 */
export const ExportFormatSchema = z.enum(['json', 'yaml', 'toml', 'env']);

/**
 * Provider configuration schema
 */
export const ProviderConfigSchema = z.object({
  enabled: z.boolean(),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(10).optional(),
});

/**
 * Agent memory configuration schema
 */
export const AgentMemoryConfigSchema = z.object({
  enabled: z.boolean(),
  provider: z.string().min(1),
  maxSize: z.number().positive(),
  ttl: z.number().positive(),
});

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  maxConcurrent: z.number().positive().max(20),
  timeout: z.number().positive(),
  retries: z.number().min(0).max(10),
  memory: AgentMemoryConfigSchema,
  enableEvolution: z.boolean(),
  enableCollaboration: z.boolean(),
});

/**
 * CLI configuration schema
 */
export const CLIConfigSchema = z.object({
  interactive: z.boolean(),
  color: z.boolean(),
  unicode: z.boolean(),
  theme: z.string().min(1),
  maxHistory: z.number().positive(),
});

/**
 * Log rotation configuration schema
 */
export const RotationConfigSchema = z.object({
  enabled: z.boolean(),
  maxSize: z.string().regex(/^\d+[kmg]$/i),
  maxFiles: z.number().positive(),
  datePattern: z.string().min(1),
});

/**
 * Logging configuration schema
 */
export const LoggingConfigSchema = z.object({
  level: LogLevelSchema,
  file: z.boolean(),
  console: z.boolean(),
  format: z.enum(['json', 'simple', 'detailed']),
  rotation: RotationConfigSchema,
  silent: z.boolean(),
});

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  encryption: z.boolean(),
  keyring: z.boolean(),
  apiKeys: z.record(z.string(), z.string()),
  requireAuthForFileOps: z.boolean(),
  enableGovernance: z.boolean(),
  maxTokensPerRequest: z.number().positive(),
});

/**
 * TUI layout configuration schema
 */
export const LayoutConfigSchema = z.object({
  splitDirection: z.enum(['horizontal', 'vertical']),
  showSidebar: z.boolean(),
  sidebarWidth: z.number().min(10).max(80),
});

/**
 * TUI configuration schema
 */
export const TUIConfigSchema = z.object({
  enabled: z.boolean(),
  theme: z.string().min(1),
  layout: LayoutConfigSchema,
  showStatusBar: z.boolean(),
  showTabBar: z.boolean(),
  enableSyntaxHighlighting: z.boolean(),
});

/**
 * Vector store configuration schema
 */
export const VectorStoreConfigSchema = z.object({
  provider: z.string().min(1),
  dimensions: z.number().positive(),
  indexType: z.string().min(1),
});

/**
 * Memory configuration schema
 */
export const MemoryConfigSchema = z.object({
  provider: z.string().min(1),
  vectorStore: VectorStoreConfigSchema,
  maxSize: z.number().positive(),
  enabled: z.boolean(),
});

/**
 * Paths configuration schema
 */
export const PathsConfigSchema = z.object({
  config: z.string().min(1),
  data: z.string().min(1),
  cache: z.string().min(1),
  logs: z.string().min(1),
  plugins: z.string().min(1),
  projectMemory: z.string().min(1),
  checkpoints: z.string().min(1),
});

/**
 * Checkpoint configuration schema
 */
export const CheckpointConfigSchema = z.object({
  enabled: z.boolean(),
  interval: z.number().positive(),
  maxCheckpoints: z.number().positive(),
  autoCleanup: z.boolean(),
});

/**
 * Complete configuration schema
 */
export const ConfigSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  env: EnvironmentSchema,
  defaultMode: z.enum(['planning', 'work']),
  defaultProvider: z.string().min(1),
  providers: z.record(z.string(), ProviderConfigSchema),
  agents: AgentConfigSchema,
  cli: CLIConfigSchema,
  logging: LoggingConfigSchema,
  security: SecurityConfigSchema,
  tui: TUIConfigSchema,
  memory: MemoryConfigSchema,
  paths: PathsConfigSchema,
  checkpoint: CheckpointConfigSchema,
});

/**
 * Partial configuration schema (for updates and overrides)
 */
export const PartialConfigSchema = ConfigSchema.deepPartial();

/**
 * Configuration source schema
 */
export const ConfigSourceSchema = z.object({
  type: z.enum(['file', 'env', 'cli', 'remote', 'default']),
  path: z.string().optional(),
  priority: z.number().min(0).max(100),
  data: z.unknown(),
});

/**
 * Validation result schema
 */
export const ValidationResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  errors: z
    .array(
      z.object({
        path: z.array(z.union([z.string(), z.number()])),
        message: z.string(),
        code: z.string(),
      })
    )
    .optional(),
});

/**
 * Config change event schema
 */
export const ConfigChangeEventSchema = z.object({
  timestamp: z.number(),
  source: z.string(),
  path: z.string(),
  oldValue: z.unknown().optional(),
  newValue: z.unknown(),
});

/**
 * Migration script schema
 */
export const MigrationScriptSchema = z.object({
  version: z.string(),
  description: z.string(),
  up: z.function().args(z.unknown()).returns(z.promise(z.unknown())),
  down: z.function().args(z.unknown()).returns(z.promise(z.unknown())),
});

/**
 * Type inference helpers
 */
export type Environment = z.infer<typeof EnvironmentSchema>;
export type LogLevel = z.infer<typeof LogLevelSchema>;
export type MergeStrategy = z.infer<typeof MergeStrategySchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type AgentMemoryConfig = z.infer<typeof AgentMemoryConfigSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type CLIConfig = z.infer<typeof CLIConfigSchema>;
export type RotationConfig = z.infer<typeof RotationConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type LayoutConfig = z.infer<typeof LayoutConfigSchema>;
export type TUIConfig = z.infer<typeof TUIConfigSchema>;
export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type CheckpointConfig = z.infer<typeof CheckpointConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type PartialConfig = z.infer<typeof PartialConfigSchema>;
export type ConfigSource = z.infer<typeof ConfigSourceSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ConfigChangeEvent = z.infer<typeof ConfigChangeEventSchema>;
export type MigrationScript = z.infer<typeof MigrationScriptSchema>;

/**
 * Custom refinements and validators
 */

/**
 * Validate that at least one provider is enabled
 */
export const validateAtLeastOneProvider = (config: Config): boolean => {
  const providers = Object.values(config.providers);
  return providers.some((provider) => provider.enabled);
};

/**
 * Validate that the default provider is enabled
 */
export const validateDefaultProviderEnabled = (config: Config): boolean => {
  const defaultProvider = config.providers[config.defaultProvider];
  return defaultProvider !== undefined && defaultProvider.enabled;
};

/**
 * Validate that paths are not empty and are properly formatted
 */
export const validatePaths = (paths: PathsConfig): boolean => {
  const pathValues = Object.values(paths);
  return pathValues.every((p) => typeof p === 'string' && p.trim().length > 0);
};

/**
 * Validate that API keys are present for enabled providers (optional check)
 */
export const validateProviderApiKeys = (
  providers: Record<string, ProviderConfig>,
  strict: boolean = false
): { valid: boolean; missing: string[] } => {
  const missing: string[] = [];

  for (const [name, config] of Object.entries(providers)) {
    if (config.enabled && !config.apiKey && strict) {
      // Check if it's a local provider that doesn't need API keys
      const localProviders = ['ollama', 'lmstudio', 'vllm'];
      if (!localProviders.includes(name)) {
        missing.push(name);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Enhanced configuration schema with custom refinements
 */
export const EnhancedConfigSchema = ConfigSchema.refine(validateAtLeastOneProvider, {
  message: 'At least one provider must be enabled',
  path: ['providers'],
}).refine(validateDefaultProviderEnabled, {
  message: 'Default provider must be enabled',
  path: ['defaultProvider'],
});

/**
 * Schema for environment variable mapping
 */
export const EnvVarMappingSchema = z.object({
  AICHITECT_ENV: z.string().optional(),
  AICHITECT_LOG_LEVEL: LogLevelSchema.optional(),
  AICHITECT_CONFIG_PATH: z.string().optional(),
  AICHITECT_TUI_ENABLED: z.string().optional(),
  AICHITECT_ENCRYPTION_ENABLED: z.string().optional(),
  AICHITECT_OPENAI_API_KEY: z.string().optional(),
  AICHITECT_ANTHROPIC_API_KEY: z.string().optional(),
  AICHITECT_GOOGLE_API_KEY: z.string().optional(),
  AICHITECT_QWEN_API_KEY: z.string().optional(),
  AICHITECT_CLOUDFLARE_API_KEY: z.string().optional(),
});

/**
 * Type for environment variable mapping
 */
export type EnvVarMapping = z.infer<typeof EnvVarMappingSchema>;

/**
 * Parse and validate environment variables
 *
 * @param {Record<string, string | undefined>} env - Environment variables
 * @returns {Partial<Config>} Parsed configuration from environment
 */
export function parseEnvVars(env: Record<string, string | undefined>): Partial<Config> {
  const config: Partial<Config> = {};

  if (env.AICHITECT_ENV) {
    const envResult = EnvironmentSchema.safeParse(env.AICHITECT_ENV);
    if (envResult.success) {
      config.env = envResult.data;
    }
  }

  if (env.AICHITECT_LOG_LEVEL) {
    const logLevelResult = LogLevelSchema.safeParse(env.AICHITECT_LOG_LEVEL);
    if (logLevelResult.success) {
      config.logging = { level: logLevelResult.data } as LoggingConfig;
    }
  }

  if (env.AICHITECT_TUI_ENABLED) {
    const tuiEnabled = env.AICHITECT_TUI_ENABLED.toLowerCase() === 'true';
    config.tui = { enabled: tuiEnabled } as TUIConfig;
  }

  if (env.AICHITECT_ENCRYPTION_ENABLED) {
    const encryptionEnabled = env.AICHITECT_ENCRYPTION_ENABLED.toLowerCase() === 'true';
    config.security = { encryption: encryptionEnabled } as SecurityConfig;
  }

  // Provider API keys
  const providers: Record<string, Partial<ProviderConfig>> = {};

  if (env.AICHITECT_OPENAI_API_KEY) {
    providers.openai = { apiKey: env.AICHITECT_OPENAI_API_KEY };
  }

  if (env.AICHITECT_ANTHROPIC_API_KEY) {
    providers.anthropic = { apiKey: env.AICHITECT_ANTHROPIC_API_KEY };
  }

  if (env.AICHITECT_GOOGLE_API_KEY) {
    providers.google = { apiKey: env.AICHITECT_GOOGLE_API_KEY };
  }

  if (env.AICHITECT_QWEN_API_KEY) {
    providers.qwen = { apiKey: env.AICHITECT_QWEN_API_KEY };
  }

  if (env.AICHITECT_CLOUDFLARE_API_KEY) {
    providers.cloudflare = { apiKey: env.AICHITECT_CLOUDFLARE_API_KEY };
  }

  if (Object.keys(providers).length > 0) {
    config.providers = providers as Record<string, ProviderConfig>;
  }

  return config;
}
