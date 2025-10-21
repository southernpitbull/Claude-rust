/**
 * Configuration Schema and Validation
 *
 * Provides validation rules and default values for the configuration system.
 * Supports environment variable substitution (${VAR_NAME}).
 *
 * @module config/schema
 */

import type {
  Config,
  AIConfig,
  MemoryConfig,
  ProvidersConfig,
  AgentsConfig,
  SecurityConfig,
  CheckpointConfig,
  LoggingConfig,
  ValidationResult,
  ValidationError,
} from './types';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Config = {
  ai: {
    default_provider: 'openai',
    max_tokens: 8000,
    temperature: 0.7,
    model: 'gpt-4',
    timeout_seconds: 60,
  },
  memory: {
    type: 'chroma',
    url: 'http://localhost:8000',
    enable_persistence: true,
    cleanup_interval_hours: 24,
  },
  providers: {
    openai: {
      api_key: '${OPENAI_API_KEY}',
      base_url: 'https://api.openai.com/v1',
    },
    anthropic: {
      api_key: '${ANTHROPIC_API_KEY}',
      max_tokens: 8000,
    },
    gemini: {
      api_key: '${GEMINI_API_KEY}',
    },
    local: {
      ollama_url: 'http://localhost:11434',
      lm_studio_url: 'http://localhost:8000',
    },
  },
  agents: {
    max_parallel: 4,
    timeout_seconds: 300,
    enable_logging: true,
  },
  security: {
    enable_auth: true,
    jwt_secret: '${JWT_SECRET}',
    token_expiry_hours: 24,
    enable_audit_log: true,
    audit_log_path: '/var/log/airchitect/audit.log',
  },
  checkpoint: {
    enabled: true,
    auto_backup_before_restore: true,
    backup_directory: '~/.airchitect/backups',
    max_checkpoints: 50,
  },
  logging: {
    level: 'info',
    format: 'json',
    output: 'stdout',
  },
};

/**
 * Validate AI configuration
 */
function validateAIConfig(config: Partial<AIConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.default_provider !== undefined) {
    if (typeof config.default_provider !== 'string' || config.default_provider.length === 0) {
      errors.push({
        path: 'ai.default_provider',
        message: 'default_provider must be a non-empty string',
        value: config.default_provider,
      });
    }
  }

  if (config.max_tokens !== undefined) {
    if (typeof config.max_tokens !== 'number' || config.max_tokens <= 0) {
      errors.push({
        path: 'ai.max_tokens',
        message: 'max_tokens must be a positive number',
        value: config.max_tokens,
      });
    }
  }

  if (config.temperature !== undefined) {
    if (
      typeof config.temperature !== 'number' ||
      config.temperature < 0 ||
      config.temperature > 2
    ) {
      errors.push({
        path: 'ai.temperature',
        message: 'temperature must be between 0 and 2',
        value: config.temperature,
      });
    }
  }

  if (config.model !== undefined) {
    if (typeof config.model !== 'string' || config.model.length === 0) {
      errors.push({
        path: 'ai.model',
        message: 'model must be a non-empty string',
        value: config.model,
      });
    }
  }

  if (config.timeout_seconds !== undefined) {
    if (typeof config.timeout_seconds !== 'number' || config.timeout_seconds <= 0) {
      errors.push({
        path: 'ai.timeout_seconds',
        message: 'timeout_seconds must be a positive number',
        value: config.timeout_seconds,
      });
    }
  }

  return errors;
}

/**
 * Validate memory configuration
 */
function validateMemoryConfig(config: Partial<MemoryConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.type !== undefined) {
    if (typeof config.type !== 'string' || config.type.length === 0) {
      errors.push({
        path: 'memory.type',
        message: 'type must be a non-empty string',
        value: config.type,
      });
    }
  }

  if (config.url !== undefined) {
    if (typeof config.url !== 'string' || !isValidUrl(config.url)) {
      errors.push({
        path: 'memory.url',
        message: 'url must be a valid URL',
        value: config.url,
      });
    }
  }

  if (config.enable_persistence !== undefined) {
    if (typeof config.enable_persistence !== 'boolean') {
      errors.push({
        path: 'memory.enable_persistence',
        message: 'enable_persistence must be a boolean',
        value: config.enable_persistence,
      });
    }
  }

  if (config.cleanup_interval_hours !== undefined) {
    if (typeof config.cleanup_interval_hours !== 'number' || config.cleanup_interval_hours <= 0) {
      errors.push({
        path: 'memory.cleanup_interval_hours',
        message: 'cleanup_interval_hours must be a positive number',
        value: config.cleanup_interval_hours,
      });
    }
  }

  return errors;
}

/**
 * Validate providers configuration
 */
function validateProvidersConfig(config: Partial<ProvidersConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate OpenAI provider
  if (config.openai) {
    if (config.openai.api_key !== undefined) {
      if (typeof config.openai.api_key !== 'string') {
        errors.push({
          path: 'providers.openai.api_key',
          message: 'api_key must be a string',
          value: config.openai.api_key,
        });
      }
    }
    if (config.openai.base_url !== undefined) {
      if (typeof config.openai.base_url !== 'string' || !isValidUrl(config.openai.base_url)) {
        errors.push({
          path: 'providers.openai.base_url',
          message: 'base_url must be a valid URL',
          value: config.openai.base_url,
        });
      }
    }
  }

  // Validate Anthropic provider
  if (config.anthropic) {
    if (config.anthropic.api_key !== undefined) {
      if (typeof config.anthropic.api_key !== 'string') {
        errors.push({
          path: 'providers.anthropic.api_key',
          message: 'api_key must be a string',
          value: config.anthropic.api_key,
        });
      }
    }
    if (config.anthropic.max_tokens !== undefined) {
      if (typeof config.anthropic.max_tokens !== 'number' || config.anthropic.max_tokens <= 0) {
        errors.push({
          path: 'providers.anthropic.max_tokens',
          message: 'max_tokens must be a positive number',
          value: config.anthropic.max_tokens,
        });
      }
    }
  }

  // Validate Gemini provider
  if (config.gemini) {
    if (config.gemini.api_key !== undefined) {
      if (typeof config.gemini.api_key !== 'string') {
        errors.push({
          path: 'providers.gemini.api_key',
          message: 'api_key must be a string',
          value: config.gemini.api_key,
        });
      }
    }
  }

  // Validate Local providers
  if (config.local) {
    if (config.local.ollama_url !== undefined) {
      if (typeof config.local.ollama_url !== 'string' || !isValidUrl(config.local.ollama_url)) {
        errors.push({
          path: 'providers.local.ollama_url',
          message: 'ollama_url must be a valid URL',
          value: config.local.ollama_url,
        });
      }
    }
    if (config.local.lm_studio_url !== undefined) {
      if (
        typeof config.local.lm_studio_url !== 'string' ||
        !isValidUrl(config.local.lm_studio_url)
      ) {
        errors.push({
          path: 'providers.local.lm_studio_url',
          message: 'lm_studio_url must be a valid URL',
          value: config.local.lm_studio_url,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate agents configuration
 */
function validateAgentsConfig(config: Partial<AgentsConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.max_parallel !== undefined) {
    if (typeof config.max_parallel !== 'number' || config.max_parallel <= 0) {
      errors.push({
        path: 'agents.max_parallel',
        message: 'max_parallel must be a positive number',
        value: config.max_parallel,
      });
    }
  }

  if (config.timeout_seconds !== undefined) {
    if (typeof config.timeout_seconds !== 'number' || config.timeout_seconds <= 0) {
      errors.push({
        path: 'agents.timeout_seconds',
        message: 'timeout_seconds must be a positive number',
        value: config.timeout_seconds,
      });
    }
  }

  if (config.enable_logging !== undefined) {
    if (typeof config.enable_logging !== 'boolean') {
      errors.push({
        path: 'agents.enable_logging',
        message: 'enable_logging must be a boolean',
        value: config.enable_logging,
      });
    }
  }

  return errors;
}

/**
 * Validate security configuration
 */
function validateSecurityConfig(config: Partial<SecurityConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.enable_auth !== undefined) {
    if (typeof config.enable_auth !== 'boolean') {
      errors.push({
        path: 'security.enable_auth',
        message: 'enable_auth must be a boolean',
        value: config.enable_auth,
      });
    }
  }

  if (config.jwt_secret !== undefined) {
    if (typeof config.jwt_secret !== 'string') {
      errors.push({
        path: 'security.jwt_secret',
        message: 'jwt_secret must be a string',
        value: config.jwt_secret,
      });
    }
  }

  if (config.token_expiry_hours !== undefined) {
    if (typeof config.token_expiry_hours !== 'number' || config.token_expiry_hours <= 0) {
      errors.push({
        path: 'security.token_expiry_hours',
        message: 'token_expiry_hours must be a positive number',
        value: config.token_expiry_hours,
      });
    }
  }

  if (config.enable_audit_log !== undefined) {
    if (typeof config.enable_audit_log !== 'boolean') {
      errors.push({
        path: 'security.enable_audit_log',
        message: 'enable_audit_log must be a boolean',
        value: config.enable_audit_log,
      });
    }
  }

  if (config.audit_log_path !== undefined) {
    if (typeof config.audit_log_path !== 'string') {
      errors.push({
        path: 'security.audit_log_path',
        message: 'audit_log_path must be a string',
        value: config.audit_log_path,
      });
    }
  }

  return errors;
}

/**
 * Validate checkpoint configuration
 */
function validateCheckpointConfig(config: Partial<CheckpointConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.enabled !== undefined) {
    if (typeof config.enabled !== 'boolean') {
      errors.push({
        path: 'checkpoint.enabled',
        message: 'enabled must be a boolean',
        value: config.enabled,
      });
    }
  }

  if (config.auto_backup_before_restore !== undefined) {
    if (typeof config.auto_backup_before_restore !== 'boolean') {
      errors.push({
        path: 'checkpoint.auto_backup_before_restore',
        message: 'auto_backup_before_restore must be a boolean',
        value: config.auto_backup_before_restore,
      });
    }
  }

  if (config.backup_directory !== undefined) {
    if (typeof config.backup_directory !== 'string') {
      errors.push({
        path: 'checkpoint.backup_directory',
        message: 'backup_directory must be a string',
        value: config.backup_directory,
      });
    }
  }

  if (config.max_checkpoints !== undefined) {
    if (typeof config.max_checkpoints !== 'number' || config.max_checkpoints <= 0) {
      errors.push({
        path: 'checkpoint.max_checkpoints',
        message: 'max_checkpoints must be a positive number',
        value: config.max_checkpoints,
      });
    }
  }

  return errors;
}

/**
 * Validate logging configuration
 */
function validateLoggingConfig(config: Partial<LoggingConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (config.level !== undefined) {
    const validLevels = ['trace', 'debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(config.level)) {
      errors.push({
        path: 'logging.level',
        message: `level must be one of: ${validLevels.join(', ')}`,
        value: config.level,
      });
    }
  }

  if (config.format !== undefined) {
    const validFormats = ['json', 'simple', 'detailed'];
    if (!validFormats.includes(config.format)) {
      errors.push({
        path: 'logging.format',
        message: `format must be one of: ${validFormats.join(', ')}`,
        value: config.format,
      });
    }
  }

  if (config.output !== undefined) {
    const validOutputs = ['stdout', 'stderr', 'file'];
    if (!validOutputs.includes(config.output)) {
      errors.push({
        path: 'logging.output',
        message: `output must be one of: ${validOutputs.join(', ')}`,
        value: config.output,
      });
    }
  }

  return errors;
}

/**
 * Validate complete configuration
 */
export function validateConfig(config: Partial<Config>): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate each section
  if (config.ai) {
    errors.push(...validateAIConfig(config.ai));
  }
  if (config.memory) {
    errors.push(...validateMemoryConfig(config.memory));
  }
  if (config.providers) {
    errors.push(...validateProvidersConfig(config.providers));
  }
  if (config.agents) {
    errors.push(...validateAgentsConfig(config.agents));
  }
  if (config.security) {
    errors.push(...validateSecurityConfig(config.security));
  }
  if (config.checkpoint) {
    errors.push(...validateCheckpointConfig(config.checkpoint));
  }
  if (config.logging) {
    errors.push(...validateLoggingConfig(config.logging));
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Substitute environment variables in config values
 * Replaces ${VAR_NAME} with process.env.VAR_NAME
 */
export function substituteEnvVars<T>(obj: T): T {
  if (typeof obj === 'string') {
    const matches = obj.match(/\$\{([^}]+)\}/g);
    if (matches) {
      let result: string = obj;
      for (const match of matches) {
        const varName = match.slice(2, -1);
        const value = process.env[varName] || '';
        result = result.replace(match, value);
      }
      return result as unknown as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVars(item)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result as unknown as T;
  }

  return obj;
}

/**
 * Deep merge two configuration objects
 */
export function mergeConfig<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };

  for (const key in override) {
    const overrideValue = override[key];
    const baseValue = base[key];

    if (overrideValue === undefined) {
      continue;
    }

    if (
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      overrideValue !== null &&
      typeof baseValue === 'object' &&
      !Array.isArray(baseValue) &&
      baseValue !== null
    ) {
      result[key] = mergeConfig(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      ) as T[Extract<keyof T, string>];
    } else {
      result[key] = overrideValue as T[Extract<keyof T, string>];
    }
  }

  return result;
}
