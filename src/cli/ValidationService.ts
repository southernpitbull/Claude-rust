/**
 * ValidationService.ts
 *
 * Comprehensive input validation service for the AIrchitect CLI.
 * Provides type validation, format validation, range validation, and more.
 */

import { CLIError, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Validation result interface
 */
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
  validator: string;
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
  validator: string;
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  name: string;
  validator: ValidatorFn;
  message: string;
  code?: string;
}

/**
 * Validator function type
 */
export type ValidatorFn = (value: unknown) => boolean | Promise<boolean>;

/**
 * Type validator function type
 */
export type TypeValidatorFn = (value: unknown) => value is any;

/**
 * Async validator function type
 */
export type AsyncValidatorFn = (value: unknown) => Promise<boolean>;

/**
 * Validation options
 */
export interface ValidationOptions {
  required?: boolean;
  type?: string;
  format?: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: ValidatorFn;
  async?: AsyncValidatorFn;
  messages?: Partial<ValidationMessages>;
  nullable?: boolean;
  default?: unknown;
}

/**
 * Validation messages
 */
export interface ValidationMessages {
  required: string;
  type: string;
  format: string;
  min: string;
  max: string;
  pattern: string;
  custom: string;
  async: string;
}

/**
 * Validation chain
 */
export class ValidationChain {
  private validators: Array<{ fn: ValidatorFn; message: string; code?: string }> = [];
  private asyncValidators: Array<{ fn: AsyncValidatorFn; message: string; code?: string }> = [];
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  /**
   * Add a validator to the chain
   */
  public addValidator(validator: ValidatorFn, message: string, code?: string): ValidationChain {
    this.validators.push({ fn: validator, message, code });
    return this;
  }

  /**
   * Add an async validator to the chain
   */
  public addAsyncValidator(
    validator: AsyncValidatorFn,
    message: string,
    code?: string
  ): ValidationChain {
    this.asyncValidators.push({ fn: validator, message, code });
    return this;
  }

  /**
   * Validate a value against all validators in the chain
   */
  public async validate(value: unknown): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Run synchronous validators
    for (const { fn, message, code } of this.validators) {
      try {
        const result = await Promise.resolve(fn(value));
        if (!result) {
          errors.push({
            field: this.field,
            message,
            code,
            value,
            validator: 'custom',
          });
          // If any validator fails, no point in continuing
          break;
        }
      } catch (error) {
        errors.push({
          field: this.field,
          message: `Validator error: ${error instanceof Error ? error.message : String(error)}`,
          value,
          validator: 'custom',
        });
      }
    }

    // Run async validators
    for (const { fn, message, code } of this.asyncValidators) {
      try {
        const result = await fn(value);
        if (!result) {
          errors.push({
            field: this.field,
            message,
            code,
            value,
            validator: 'async',
          });
        }
      } catch (error) {
        errors.push({
          field: this.field,
          message: `Async validator error: ${error instanceof Error ? error.message : String(error)}`,
          value,
          validator: 'async',
        });
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * ValidationService for input validation
 */
export class ValidationService {
  private validators: Map<string, ValidationRule>;
  private defaultMessages: ValidationMessages;

  constructor() {
    this.validators = new Map();
    this.defaultMessages = {
      required: 'Field is required',
      type: 'Invalid type',
      format: 'Invalid format',
      min: 'Value is too small',
      max: 'Value is too large',
      pattern: 'Value does not match pattern',
      custom: 'Custom validation failed',
      async: 'Async validation failed',
    };

    // Register built-in validators
    this.registerBuiltInValidators();
  }

  /**
   * Register a custom validator
   */
  public registerValidator(
    name: string,
    validator: ValidatorFn,
    message: string,
    code?: string
  ): void {
    this.validators.set(name, { name, validator, message, code });
  }

  /**
   * Get a registered validator
   */
  public getValidator(name: string): ValidationRule | undefined {
    return this.validators.get(name);
  }

  /**
   * Validate a value with a registered validator
   */
  public async validateWith(name: string, value: unknown): Promise<ValidationResult> {
    const rule = this.getValidator(name);
    if (!rule) {
      throw new CLIError(
        `Validator '${name}' not found`,
        ErrorCategory.VALIDATION,
        ErrorSeverity.HIGH,
        'VALIDATOR_NOT_FOUND'
      );
    }

    const result = await Promise.resolve(rule.validator(value));
    const success = result === true;

    return {
      success,
      errors: success
        ? []
        : [
            {
              field: name,
              message: rule.message,
              code: rule.code,
              value,
              validator: name,
            },
          ],
      warnings: [],
    };
  }

  /**
   * Create a validation chain for a field
   */
  public chain(field: string): ValidationChain {
    return new ValidationChain(field);
  }

  /**
   * Validate an object against a schema
   */
  public async validateSchema<T extends Record<string, unknown>>(
    obj: T,
    schema: Record<keyof T, ValidationOptions>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const [field, options] of Object.entries(schema)) {
      const value = obj[field as keyof T];
      const fieldErrors = await this.validateField(value, options, field);

      errors.push(...fieldErrors);
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single field with options
   */
  public async validateField(
    value: unknown,
    options: ValidationOptions,
    field: string
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Check if field is required
    if (options.required && (value === undefined || value === null)) {
      errors.push({
        field,
        message: options.messages?.required || this.defaultMessages.required,
        code: 'FIELD_REQUIRED',
        value,
        validator: 'required',
      });
      return errors; // If required and missing, no point in checking other validations
    }

    // If value is null/undefined and not required, and nullable is allowed, skip other validations
    if ((value === null || value === undefined) && options.nullable !== false) {
      return errors;
    }

    // Type validation
    if (options.type && !this.validateType(value, options.type)) {
      errors.push({
        field,
        message: options.messages?.type || this.defaultMessages.type,
        code: 'INVALID_TYPE',
        value,
        validator: 'type',
      });
    }

    // Format validation (for specific formats like email, URL, etc.)
    if (options.format && !this.validateFormat(value, options.format)) {
      errors.push({
        field,
        message: options.messages?.format || this.defaultMessages.format,
        code: 'INVALID_FORMAT',
        value,
        validator: 'format',
      });
    }

    // Range validation for numbers
    if (typeof value === 'number') {
      if (options.min !== undefined && value < options.min) {
        errors.push({
          field,
          message: options.messages?.min || this.defaultMessages.min,
          code: 'INVALID_MIN',
          value,
          validator: 'min',
        });
      }

      if (options.max !== undefined && value > options.max) {
        errors.push({
          field,
          message: options.messages?.max || this.defaultMessages.max,
          code: 'INVALID_MAX',
          value,
          validator: 'max',
        });
      }
    }

    // Pattern validation for strings
    if (typeof value === 'string' && options.pattern && !options.pattern.test(value)) {
      errors.push({
        field,
        message: options.messages?.pattern || this.defaultMessages.pattern,
        code: 'INVALID_PATTERN',
        value,
        validator: 'pattern',
      });
    }

    // Custom validation
    if (options.custom) {
      try {
        const result = await Promise.resolve(options.custom(value));
        if (!result) {
          errors.push({
            field,
            message: options.messages?.custom || this.defaultMessages.custom,
            code: 'CUSTOM_VALIDATION_FAILED',
            value,
            validator: 'custom',
          });
        }
      } catch (error) {
        errors.push({
          field,
          message: `Custom validator error: ${error instanceof Error ? error.message : String(error)}`,
          value,
          validator: 'custom',
        });
      }
    }

    // Async validation
    if (options.async) {
      try {
        const result = await options.async(value);
        if (!result) {
          errors.push({
            field,
            message: options.messages?.async || this.defaultMessages.async,
            code: 'ASYNC_VALIDATION_FAILED',
            value,
            validator: 'async',
          });
        }
      } catch (error) {
        errors.push({
          field,
          message: `Async validator error: ${error instanceof Error ? error.message : String(error)}`,
          value,
          validator: 'async',
        });
      }
    }

    return errors;
  }

  /**
   * Type validation helper
   */
  private validateType(value: unknown, expectedType: string): boolean {
    switch (expectedType.toLowerCase()) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'function':
        return typeof value === 'function';
      case 'date':
        return value instanceof Date;
      case 'regexp':
        return value instanceof RegExp;
      case 'null':
        return value === null;
      case 'undefined':
        return value === undefined;
      default:
        return true; // If type is unknown, consider it valid
    }
  }

  /**
   * Format validation helper
   */
  private validateFormat(value: unknown, format: string): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    switch (format.toLowerCase()) {
      case 'email':
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'uuid':
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
      case 'date-iso':
        const date = new Date(value);
        return date.toISOString() === value;
      case 'ip':
        const ipRegex =
          /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(value);
      case 'ipv6':
        // Basic IPv6 validation (simplified)
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
        return ipv6Regex.test(value);
      case 'credit-card':
        // Basic credit card validation (Luhn algorithm)
        if (value.replace(/\s/g, '').replace(/-/g, '').length < 13) {
          return false;
        }
        return this.validateCreditCard(value);
      case 'phone':
        // Basic phone number validation
        const phoneRegex = /^[+]?[\s./0-9]*[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/;
        return phoneRegex.test(value);
      case 'json':
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      default:
        return true; // If format is unknown, consider it valid
    }
  }

  /**
   * Validate credit card using Luhn algorithm
   */
  private validateCreditCard(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/\s/g, '').replace(/-/g, '');
    if (!/^\d+$/.test(cleaned)) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Register built-in validators
   */
  private registerBuiltInValidators(): void {
    // Email validator
    this.registerValidator(
      'email',
      (value: unknown) => {
        if (typeof value !== 'string') {
          return false;
        }
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(value);
      },
      'Invalid email format'
    );

    // URL validator
    this.registerValidator(
      'url',
      (value: unknown) => {
        if (typeof value !== 'string') {
          return false;
        }
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      'Invalid URL format'
    );

    // UUID validator
    this.registerValidator(
      'uuid',
      (value: unknown) => {
        if (typeof value !== 'string') {
          return false;
        }
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
      },
      'Invalid UUID format'
    );

    // Required validator
    this.registerValidator(
      'required',
      (value: unknown) => value !== undefined && value !== null && value !== '',
      'Value is required'
    );

    // Minimum length validator
    this.registerValidator(
      'minLength',
      (value: unknown, minLength: number) => {
        if (typeof value === 'string') {
          return value.length >= (minLength || 0);
        } else if (Array.isArray(value)) {
          return value.length >= (minLength || 0);
        }
        return false;
      },
      'Value is too short'
    );

    // Maximum length validator
    this.registerValidator(
      'maxLength',
      (value: unknown, maxLength: number) => {
        if (typeof value === 'string') {
          return value.length <= (maxLength || Infinity);
        } else if (Array.isArray(value)) {
          return value.length <= (maxLength || Infinity);
        }
        return false;
      },
      'Value is too long'
    );

    // Number range validator
    this.registerValidator(
      'range',
      (value: unknown, min: number, max: number) => {
        if (typeof value === 'number') {
          return value >= (min || -Infinity) && value <= (max || Infinity);
        }
        return false;
      },
      'Number is out of range'
    );
  }

  /**
   * Validate email address
   */
  public validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL
   */
  public validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate UUID
   */
  public validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate if value is within range
   */
  public validateRange(value: number, min?: number, max?: number): boolean {
    if (min !== undefined && value < min) {
      return false;
    }
    if (max !== undefined && value > max) {
      return false;
    }
    return true;
  }

  /**
   * Validate if string has min/max length
   */
  public validateLength(str: string, min?: number, max?: number): boolean {
    if (min !== undefined && str.length < min) {
      return false;
    }
    if (max !== undefined && str.length > max) {
      return false;
    }
    return true;
  }

  /**
   * Sanitize a value based on type
   */
  public sanitize(value: unknown, type: string): unknown {
    switch (type.toLowerCase()) {
      case 'string':
        return typeof value === 'string' ? value.trim() : String(value);
      case 'number':
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'string') {
          return Number(value);
        }
        return NaN;
      case 'boolean':
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        }
        return Boolean(value);
      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        return [value];
      default:
        return value;
    }
  }
}

// Export a singleton instance for convenience
export const validationService = new ValidationService();
