/**
 * Configuration Error Classes
 *
 * Handles errors related to configuration loading, parsing, and validation
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * Config error codes
 */
export enum ConfigErrorCode {
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_INVALID_FORMAT = 'CONFIG_INVALID_FORMAT',
  CONFIG_PARSE_FAILED = 'CONFIG_PARSE_FAILED',
  CONFIG_VALIDATION_FAILED = 'CONFIG_VALIDATION_FAILED',
  CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
  CONFIG_INVALID_VALUE = 'CONFIG_INVALID_VALUE',
  CONFIG_WRITE_FAILED = 'CONFIG_WRITE_FAILED',
  CONFIG_READ_FAILED = 'CONFIG_READ_FAILED',
  CONFIG_MIGRATION_FAILED = 'CONFIG_MIGRATION_FAILED',
  CONFIG_SCHEMA_INVALID = 'CONFIG_SCHEMA_INVALID',
}

/**
 * Base Configuration Error
 */
export class ConfigError extends BaseError {
  public readonly configPath?: string;

  constructor(message: string, options: BaseErrorOptions & { configPath?: string } = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.CONFIGURATION,
      code: options.code ?? ConfigErrorCode.CONFIG_VALIDATION_FAILED,
      context: {
        ...options.context,
        configPath: options.configPath,
      },
    });

    this.configPath = options.configPath;
  }

  protected generateUserMessage(): string {
    const pathInfo = this.configPath ? ` in ${this.configPath}` : '';
    return `Configuration error${pathInfo}: ${this.message}`;
  }
}

/**
 * Config Not Found Error
 */
export class ConfigNotFoundError extends ConfigError {
  constructor(configPath: string, options: BaseErrorOptions = {}) {
    super(`Configuration file not found: ${configPath}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_NOT_FOUND,
      severity: ErrorSeverity.HIGH,
      configPath,
    });
  }

  protected generateUserMessage(): string {
    return `Configuration file not found at '${this.configPath}'. Please run 'ai init' to create one.`;
  }
}

/**
 * Config Invalid Format Error
 */
export class ConfigInvalidFormatError extends ConfigError {
  constructor(
    configPath: string,
    expectedFormat: string,
    actualFormat: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Invalid configuration format: expected ${expectedFormat}, got ${actualFormat}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_INVALID_FORMAT,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        expectedFormat,
        actualFormat,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Configuration file '${this.configPath}' has invalid format. Expected ${this.context.expectedFormat}.`;
  }
}

/**
 * Config Parse Failed Error
 */
export class ConfigParseError extends ConfigError {
  constructor(configPath: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to parse configuration: ${reason}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_PARSE_FAILED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to parse configuration file '${this.configPath}': ${this.context.reason}`;
  }
}

/**
 * Config Validation Failed Error
 */
export class ConfigValidationError extends ConfigError {
  constructor(
    configPath: string,
    errors: Array<{ field: string; message: string }>,
    options: BaseErrorOptions = {}
  ) {
    const errorList = errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    super(`Configuration validation failed: ${errorList}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_VALIDATION_FAILED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        validationErrors: errors,
      },
    });
  }

  protected generateUserMessage(): string {
    const errors = this.context.validationErrors as Array<{ field: string; message: string }>;
    const errorMessages = errors.map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    return `Configuration validation failed:\n${errorMessages}`;
  }
}

/**
 * Config Missing Required Error
 */
export class ConfigMissingRequiredError extends ConfigError {
  constructor(configPath: string, missingFields: string[], options: BaseErrorOptions = {}) {
    super(`Missing required configuration fields: ${missingFields.join(', ')}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_MISSING_REQUIRED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        missingFields,
      },
    });
  }

  protected generateUserMessage(): string {
    const fields = this.context.missingFields as string[];
    return `Configuration is missing required fields: ${fields.join(', ')}`;
  }
}

/**
 * Config Invalid Value Error
 */
export class ConfigInvalidValueError extends ConfigError {
  constructor(
    configPath: string,
    field: string,
    value: unknown,
    expected: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Invalid value for '${field}': ${expected}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_INVALID_VALUE,
      severity: ErrorSeverity.MEDIUM,
      configPath,
      context: {
        ...options.context,
        field,
        value,
        expected,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Invalid value for configuration field '${this.context.field}': ${this.context.expected}`;
  }
}

/**
 * Config Write Failed Error
 */
export class ConfigWriteError extends ConfigError {
  constructor(configPath: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to write configuration: ${reason}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_WRITE_FAILED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to write configuration to '${this.configPath}': ${this.context.reason}`;
  }
}

/**
 * Config Read Failed Error
 */
export class ConfigReadError extends ConfigError {
  constructor(configPath: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to read configuration: ${reason}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_READ_FAILED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to read configuration from '${this.configPath}': ${this.context.reason}`;
  }
}

/**
 * Config Migration Failed Error
 */
export class ConfigMigrationError extends ConfigError {
  constructor(
    configPath: string,
    fromVersion: string,
    toVersion: string,
    reason: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Failed to migrate configuration from v${fromVersion} to v${toVersion}: ${reason}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_MIGRATION_FAILED,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        fromVersion,
        toVersion,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to migrate configuration from v${this.context.fromVersion} to v${this.context.toVersion}: ${this.context.reason}`;
  }
}

/**
 * Config Schema Invalid Error
 */
export class ConfigSchemaError extends ConfigError {
  constructor(configPath: string, schemaErrors: string[], options: BaseErrorOptions = {}) {
    super(`Configuration schema validation failed: ${schemaErrors.join(', ')}`, {
      ...options,
      code: ConfigErrorCode.CONFIG_SCHEMA_INVALID,
      severity: ErrorSeverity.HIGH,
      configPath,
      context: {
        ...options.context,
        schemaErrors,
      },
    });
  }

  protected generateUserMessage(): string {
    const errors = this.context.schemaErrors as string[];
    return `Configuration schema validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`;
  }
}
