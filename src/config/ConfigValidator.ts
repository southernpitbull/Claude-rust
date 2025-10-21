/**
 * ConfigValidator.ts
 *
 * Comprehensive configuration validation engine with support for
 * Zod schemas, custom validators, and detailed error reporting.
 *
 * @module config/ConfigValidator
 */

import { z, ZodError, ZodIssue } from 'zod';
import {
  ConfigSchema,
  EnhancedConfigSchema,
  PartialConfigSchema,
  validateAtLeastOneProvider,
  validateDefaultProviderEnabled,
  validatePaths,
  validateProviderApiKeys,
  type Config,
  type PartialConfig,
  type ValidationResult,
} from './ConfigSchema';

/**
 * Validation error details
 */
export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
  value?: unknown;
}

/**
 * Validation mode
 */
export type ValidationMode = 'strict' | 'loose';

/**
 * Custom validator function type
 */
export type ValidatorFn = (value: unknown) => boolean | string | Promise<boolean | string>;

/**
 * Validator rule definition
 */
export interface ValidatorRule {
  name: string;
  validator: ValidatorFn;
  message?: string;
  async?: boolean;
}

/**
 * Validation context for cross-field validation
 */
export interface ValidationContext {
  config: Partial<Config>;
  path: string[];
  mode: ValidationMode;
}

/**
 * Configuration validator class
 *
 * Provides comprehensive validation capabilities including:
 * - Zod schema validation
 * - Custom validator rules
 * - Cross-field validation
 * - Async validation
 * - Detailed error reporting
 */
export class ConfigValidator {
  private customRules: Map<string, ValidatorRule> = new Map();
  private mode: ValidationMode = 'strict';

  /**
   * Create a new ConfigValidator instance
   *
   * @param {ValidationMode} mode - Validation mode (strict or loose)
   */
  constructor(mode: ValidationMode = 'strict') {
    this.mode = mode;
    this.initializeDefaultRules();
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Rule: At least one provider must be enabled
    this.addRule('atLeastOneProvider', validateAtLeastOneProvider, {
      message: 'At least one provider must be enabled',
    });

    // Rule: Default provider must be enabled
    this.addRule('defaultProviderEnabled', validateDefaultProviderEnabled, {
      message: 'Default provider must be enabled',
    });

    // Rule: Paths must be valid
    this.addRule(
      'validPaths',
      (config: unknown) => {
        if (typeof config !== 'object' || config === null) {
          return false;
        }
        const cfg = config as Partial<Config>;
        return cfg.paths ? validatePaths(cfg.paths) : true;
      },
      {
        message: 'All paths must be non-empty strings',
      }
    );
  }

  /**
   * Validate a complete configuration
   *
   * @param {unknown} config - Configuration to validate
   * @returns {ValidationResult} Validation result with errors if any
   */
  public validate(config: unknown): ValidationResult {
    try {
      // Use enhanced schema for strict mode, basic schema for loose mode
      const schema = this.mode === 'strict' ? EnhancedConfigSchema : ConfigSchema;
      const validatedConfig = schema.parse(config);

      // Run custom validators
      const customErrors = this.runCustomValidators(validatedConfig);

      if (customErrors.length > 0) {
        return {
          success: false,
          errors: customErrors,
        };
      }

      return {
        success: true,
        data: validatedConfig,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error),
        };
      }

      return {
        success: false,
        errors: [
          {
            path: [],
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Validate a partial configuration (for updates)
   *
   * @param {unknown} config - Partial configuration to validate
   * @returns {ValidationResult} Validation result with errors if any
   */
  public validatePartial(config: unknown): ValidationResult {
    try {
      const validatedConfig = PartialConfigSchema.parse(config);

      return {
        success: true,
        data: validatedConfig,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error),
        };
      }

      return {
        success: false,
        errors: [
          {
            path: [],
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Validate a specific field in the configuration
   *
   * @param {string} path - Field path (e.g., 'providers.openai.apiKey')
   * @param {unknown} value - Value to validate
   * @param {Config} config - Full configuration for context
   * @returns {ValidationResult} Validation result
   */
  public validateField(path: string, value: unknown, config: Config): ValidationResult {
    const pathParts = path.split('.');

    try {
      // Navigate through the schema to find the appropriate validator
      let schema: z.ZodTypeAny = ConfigSchema;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];

        if (schema instanceof z.ZodObject) {
          const shape = schema.shape;
          schema = shape[part];
        } else if (schema instanceof z.ZodRecord) {
          schema = schema._def.valueType;
        } else {
          throw new Error(`Cannot navigate to path: ${path}`);
        }
      }

      // Get the final field schema
      const fieldName = pathParts[pathParts.length - 1];
      if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        schema = shape[fieldName];
      } else if (schema instanceof z.ZodRecord) {
        schema = schema._def.valueType;
      }

      const result = schema.safeParse(value);

      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          errors: this.formatZodErrors(result.error),
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            path: pathParts,
            message: error instanceof Error ? error.message : 'Unknown validation error',
            code: 'FIELD_VALIDATION_ERROR',
          },
        ],
      };
    }
  }

  /**
   * Add a custom validation rule
   *
   * @param {string} name - Rule name
   * @param {ValidatorFn} validator - Validator function
   * @param {Object} options - Rule options
   * @param {string} options.message - Custom error message
   * @param {boolean} options.async - Whether the validator is async
   */
  public addRule(
    name: string,
    validator: ValidatorFn,
    options?: { message?: string; async?: boolean }
  ): void {
    this.customRules.set(name, {
      name,
      validator,
      message: options?.message,
      async: options?.async,
    });
  }

  /**
   * Remove a custom validation rule
   *
   * @param {string} name - Rule name to remove
   * @returns {boolean} True if rule was removed
   */
  public removeRule(name: string): boolean {
    return this.customRules.delete(name);
  }

  /**
   * Get all validation errors from the last validation
   *
   * @returns {ValidationError[]} Array of validation errors
   */
  public getErrors(): ValidationError[] {
    // This would typically store errors from the last validation
    // For now, we return an empty array as errors are returned in ValidationResult
    return [];
  }

  /**
   * Check if configuration is valid (quick check)
   *
   * @param {unknown} config - Configuration to check
   * @returns {boolean} True if valid
   */
  public isValid(config: unknown): boolean {
    const result = this.validate(config);
    return result.success;
  }

  /**
   * Validate API keys for enabled providers
   *
   * @param {Config} config - Configuration to validate
   * @param {boolean} strict - Whether to enforce API key presence
   * @returns {ValidationResult} Validation result
   */
  public validateApiKeys(config: Config, strict: boolean = false): ValidationResult {
    const result = validateProviderApiKeys(config.providers, strict);

    if (!result.valid) {
      return {
        success: false,
        errors: result.missing.map((provider) => ({
          path: ['providers', provider, 'apiKey'],
          message: `Provider '${provider}' is enabled but no API key is configured`,
          code: 'MISSING_API_KEY',
        })),
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Validate async (for async validation rules)
   *
   * @param {unknown} config - Configuration to validate
   * @returns {Promise<ValidationResult>} Validation result
   */
  public async validateAsync(config: unknown): Promise<ValidationResult> {
    // First, run synchronous validation
    const syncResult = this.validate(config);

    if (!syncResult.success) {
      return syncResult;
    }

    // Then run async validators
    const asyncErrors = await this.runAsyncValidators(config as Config);

    if (asyncErrors.length > 0) {
      return {
        success: false,
        errors: asyncErrors,
      };
    }

    return {
      success: true,
      data: config,
    };
  }

  /**
   * Set validation mode
   *
   * @param {ValidationMode} mode - Validation mode
   */
  public setMode(mode: ValidationMode): void {
    this.mode = mode;
  }

  /**
   * Get current validation mode
   *
   * @returns {ValidationMode} Current validation mode
   */
  public getMode(): ValidationMode {
    return this.mode;
  }

  /**
   * Format Zod errors into ValidationError format
   *
   * @param {ZodError} error - Zod validation error
   * @returns {ValidationError[]} Formatted validation errors
   */
  private formatZodErrors(error: ZodError): ValidationError[] {
    return error.errors.map((issue: ZodIssue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
      value: 'received' in issue ? issue.received : undefined,
    }));
  }

  /**
   * Run custom validators
   *
   * @param {Config} config - Configuration to validate
   * @returns {ValidationError[]} Array of validation errors
   */
  private runCustomValidators(config: Config): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [name, rule] of this.customRules.entries()) {
      if (rule.async) {
        // Skip async validators in synchronous validation
        continue;
      }

      try {
        const result = rule.validator(config);

        if (result === false) {
          errors.push({
            path: [],
            message: rule.message || `Custom validation rule '${name}' failed`,
            code: `CUSTOM_RULE_${name.toUpperCase()}`,
          });
        } else if (typeof result === 'string') {
          errors.push({
            path: [],
            message: result,
            code: `CUSTOM_RULE_${name.toUpperCase()}`,
          });
        }
      } catch (error) {
        errors.push({
          path: [],
          message: error instanceof Error ? error.message : `Custom rule '${name}' threw an error`,
          code: 'CUSTOM_RULE_ERROR',
        });
      }
    }

    return errors;
  }

  /**
   * Run async validators
   *
   * @param {Config} config - Configuration to validate
   * @returns {Promise<ValidationError[]>} Array of validation errors
   */
  private async runAsyncValidators(config: Config): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const [name, rule] of this.customRules.entries()) {
      if (!rule.async) {
        // Skip synchronous validators
        continue;
      }

      try {
        const result = await rule.validator(config);

        if (result === false) {
          errors.push({
            path: [],
            message: rule.message || `Async validation rule '${name}' failed`,
            code: `ASYNC_RULE_${name.toUpperCase()}`,
          });
        } else if (typeof result === 'string') {
          errors.push({
            path: [],
            message: result,
            code: `ASYNC_RULE_${name.toUpperCase()}`,
          });
        }
      } catch (error) {
        errors.push({
          path: [],
          message: error instanceof Error ? error.message : `Async rule '${name}' threw an error`,
          code: 'ASYNC_RULE_ERROR',
        });
      }
    }

    return errors;
  }
}

/**
 * Create a validator instance
 *
 * @param {ValidationMode} mode - Validation mode
 * @returns {ConfigValidator} Validator instance
 */
export function createValidator(mode: ValidationMode = 'strict'): ConfigValidator {
  return new ConfigValidator(mode);
}

/**
 * Quick validation helper
 *
 * @param {unknown} config - Configuration to validate
 * @returns {ValidationResult} Validation result
 */
export function validateConfig(config: unknown): ValidationResult {
  const validator = new ConfigValidator('strict');
  return validator.validate(config);
}

/**
 * Quick partial validation helper
 *
 * @param {unknown} config - Partial configuration to validate
 * @returns {ValidationResult} Validation result
 */
export function validatePartialConfig(config: unknown): ValidationResult {
  const validator = new ConfigValidator('loose');
  return validator.validatePartial(config);
}
