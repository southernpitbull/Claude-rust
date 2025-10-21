/**
 * Validation Error Classes
 *
 * Handles errors related to data validation, schema validation, and input validation
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * Validation error codes
 */
export enum ValidationErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SCHEMA_VALIDATION_FAILED = 'SCHEMA_VALIDATION_FAILED',
  TYPE_VALIDATION_FAILED = 'TYPE_VALIDATION_FAILED',
  RANGE_VALIDATION_FAILED = 'RANGE_VALIDATION_FAILED',
  FORMAT_VALIDATION_FAILED = 'FORMAT_VALIDATION_FAILED',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  INVALID_PATTERN = 'INVALID_PATTERN',
  LENGTH_VALIDATION_FAILED = 'LENGTH_VALIDATION_FAILED',
  CUSTOM_VALIDATION_FAILED = 'CUSTOM_VALIDATION_FAILED',
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
  value?: unknown;
  constraint?: unknown;
}

/**
 * Base Validation Error
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: ValidationErrorDetail[];

  constructor(
    message: string,
    validationErrors: ValidationErrorDetail[] = [],
    options: BaseErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: ErrorCategory.VALIDATION,
      code: options.code ?? ValidationErrorCode.VALIDATION_FAILED,
      severity: options.severity ?? ErrorSeverity.LOW,
      context: {
        ...options.context,
        validationErrors,
      },
    });

    this.validationErrors = validationErrors;
  }

  protected generateUserMessage(): string {
    if (this.validationErrors.length === 0) {
      return `Validation failed: ${this.message}`;
    }

    const errorMessages = this.validationErrors
      .map((e) => `  - ${e.field}: ${e.message}`)
      .join('\n');

    return `Validation failed:\n${errorMessages}`;
  }
}

/**
 * Schema Validation Error
 */
export class SchemaValidationError extends ValidationError {
  constructor(
    schemaName: string,
    validationErrors: ValidationErrorDetail[],
    options: BaseErrorOptions = {}
  ) {
    super(`Schema validation failed for '${schemaName}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.SCHEMA_VALIDATION_FAILED,
      context: {
        ...options.context,
        schemaName,
      },
    });
  }
}

/**
 * Type Validation Error
 */
export class TypeValidationError extends ValidationError {
  constructor(
    field: string,
    expectedType: string,
    actualType: string,
    value: unknown,
    options: BaseErrorOptions = {}
  ) {
    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message: `Expected type ${expectedType}, got ${actualType}`,
        value,
        constraint: expectedType,
      },
    ];

    super(`Type validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.TYPE_VALIDATION_FAILED,
    });
  }
}

/**
 * Range Validation Error
 */
export class RangeValidationError extends ValidationError {
  constructor(
    field: string,
    value: number,
    min?: number,
    max?: number,
    options: BaseErrorOptions = {}
  ) {
    let message = `Value ${value} is out of range`;
    if (min !== undefined && max !== undefined) {
      message = `Value ${value} is not between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `Value ${value} is less than ${min}`;
    } else if (max !== undefined) {
      message = `Value ${value} is greater than ${max}`;
    }

    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message,
        value,
        constraint: { min, max },
      },
    ];

    super(`Range validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.RANGE_VALIDATION_FAILED,
    });
  }
}

/**
 * Format Validation Error
 */
export class FormatValidationError extends ValidationError {
  constructor(
    field: string,
    value: unknown,
    expectedFormat: string,
    options: BaseErrorOptions = {}
  ) {
    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message: `Expected format ${expectedFormat}`,
        value,
        constraint: expectedFormat,
      },
    ];

    super(`Format validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.FORMAT_VALIDATION_FAILED,
    });
  }
}

/**
 * Required Field Missing Error
 */
export class RequiredFieldError extends ValidationError {
  constructor(fields: string[], options: BaseErrorOptions = {}) {
    const validationErrors: ValidationErrorDetail[] = fields.map((field) => ({
      field,
      message: 'This field is required',
    }));

    super(`Required fields missing: ${fields.join(', ')}`, validationErrors, {
      ...options,
      code: ValidationErrorCode.REQUIRED_FIELD_MISSING,
    });
  }
}

/**
 * Invalid Enum Value Error
 */
export class InvalidEnumValueError extends ValidationError {
  constructor(
    field: string,
    value: unknown,
    allowedValues: unknown[],
    options: BaseErrorOptions = {}
  ) {
    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message: `Must be one of: ${allowedValues.join(', ')}`,
        value,
        constraint: allowedValues,
      },
    ];

    super(`Invalid enum value for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.INVALID_ENUM_VALUE,
    });
  }
}

/**
 * Invalid Pattern Error
 */
export class InvalidPatternError extends ValidationError {
  constructor(field: string, value: unknown, pattern: string, options: BaseErrorOptions = {}) {
    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message: `Must match pattern: ${pattern}`,
        value,
        constraint: pattern,
      },
    ];

    super(`Pattern validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.INVALID_PATTERN,
    });
  }
}

/**
 * Length Validation Error
 */
export class LengthValidationError extends ValidationError {
  constructor(
    field: string,
    actualLength: number,
    minLength?: number,
    maxLength?: number,
    options: BaseErrorOptions = {}
  ) {
    let message = `Invalid length ${actualLength}`;
    if (minLength !== undefined && maxLength !== undefined) {
      message = `Length must be between ${minLength} and ${maxLength} (got ${actualLength})`;
    } else if (minLength !== undefined) {
      message = `Length must be at least ${minLength} (got ${actualLength})`;
    } else if (maxLength !== undefined) {
      message = `Length must be at most ${maxLength} (got ${actualLength})`;
    }

    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message,
        value: actualLength,
        constraint: { minLength, maxLength },
      },
    ];

    super(`Length validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.LENGTH_VALIDATION_FAILED,
    });
  }
}

/**
 * Custom Validation Error
 */
export class CustomValidationError extends ValidationError {
  constructor(field: string, message: string, value?: unknown, options: BaseErrorOptions = {}) {
    const validationErrors: ValidationErrorDetail[] = [
      {
        field,
        message,
        value,
      },
    ];

    super(`Custom validation failed for field '${field}'`, validationErrors, {
      ...options,
      code: ValidationErrorCode.CUSTOM_VALIDATION_FAILED,
    });
  }
}
