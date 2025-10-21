/**
 * Base Error Class for AIrchitect CLI
 *
 * Provides comprehensive error handling with:
 * - Error codes and categorization
 * - Stack trace management
 * - Context preservation
 * - User-friendly messages
 * - Debug information
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  CONFIGURATION = 'configuration',
  VALIDATION = 'validation',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  PROVIDER = 'provider',
  AGENT = 'agent',
  CLI = 'cli',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  UNKNOWN = 'unknown',
}

/**
 * Context information for errors
 */
export interface ErrorContext {
  [key: string]: unknown;
  timestamp?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Error options for creating errors
 */
export interface BaseErrorOptions {
  code?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  context?: ErrorContext;
  userMessage?: string;
  debugInfo?: Record<string, unknown>;
  isOperational?: boolean;
  isRetryable?: boolean;
  cause?: Error | unknown;
}

/**
 * Base Error class that all custom errors extend
 */
export abstract class BaseError extends Error {
  /**
   * Unique error code for identification
   */
  public readonly code: string;

  /**
   * Error severity level
   */
  public readonly severity: ErrorSeverity;

  /**
   * Error category for classification
   */
  public readonly category: ErrorCategory;

  /**
   * Additional context information
   */
  public readonly context: ErrorContext;

  /**
   * User-friendly error message
   */
  public readonly userMessage: string;

  /**
   * Debug information (not shown to users)
   */
  public readonly debugInfo: Record<string, unknown>;

  /**
   * Whether this is an operational error (expected) vs programmer error
   */
  public readonly isOperational: boolean;

  /**
   * Whether this error can be retried
   */
  public readonly isRetryable: boolean;

  /**
   * The underlying cause of this error
   */
  public readonly cause?: Error | unknown;

  /**
   * Timestamp when error was created
   */
  public readonly timestamp: string;

  /**
   * Creates a new BaseError instance
   *
   * @param message - Technical error message (for developers)
   * @param options - Additional error options
   */
  constructor(message: string, options: BaseErrorOptions = {}) {
    super(message);

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();

    // Set error properties with defaults
    this.code = options.code ?? this.generateDefaultCode();
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.category = options.category ?? ErrorCategory.UNKNOWN;
    this.context = {
      ...options.context,
      timestamp: this.timestamp,
    };
    this.userMessage = options.userMessage ?? this.generateUserMessage();
    this.debugInfo = options.debugInfo ?? {};
    this.isOperational = options.isOperational ?? true;
    this.isRetryable = options.isRetryable ?? false;
    this.cause = options.cause;
  }

  /**
   * Generates a default error code based on the error class name
   */
  protected generateDefaultCode(): string {
    // Convert ErrorClassName to ERROR_CLASS_NAME
    return this.constructor.name
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }

  /**
   * Generates a user-friendly message from the technical message
   */
  protected generateUserMessage(): string {
    return this.message;
  }

  /**
   * Serializes the error to a JSON-compatible object
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      userMessage: this.userMessage,
      code: this.code,
      severity: this.severity,
      category: this.category,
      context: this.context,
      debugInfo: this.debugInfo,
      isOperational: this.isOperational,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp,
      stack: this.stack,
      cause:
        this.cause instanceof Error
          ? {
              name: this.cause.name,
              message: this.cause.message,
              stack: this.cause.stack,
            }
          : this.cause,
    };
  }

  /**
   * Returns a formatted string representation of the error
   */
  public toString(): string {
    const parts = [`[${this.code}]`, `${this.name}:`, this.message];

    if (this.cause instanceof Error) {
      parts.push(`\nCaused by: ${this.cause.message}`);
    }

    return parts.join(' ');
  }

  /**
   * Creates a clone of this error with updated context
   */
  public withContext(additionalContext: ErrorContext): this {
    const clonedError = Object.create(Object.getPrototypeOf(this));
    Object.assign(clonedError, this);
    clonedError.context = {
      ...this.context,
      ...additionalContext,
    };
    return clonedError;
  }

  /**
   * Checks if this error is caused by a specific error type
   */
  public isCausedBy(errorType: new (...args: unknown[]) => Error): boolean {
    let currentCause = this.cause;

    while (currentCause) {
      if (currentCause instanceof errorType) {
        return true;
      }

      currentCause = currentCause instanceof BaseError ? currentCause.cause : undefined;
    }

    return false;
  }

  /**
   * Gets the root cause of this error
   */
  public getRootCause(): Error | unknown {
    let currentCause = this.cause;
    let rootCause = this.cause;

    while (currentCause instanceof BaseError && currentCause.cause) {
      rootCause = currentCause.cause;
      currentCause = currentCause.cause;
    }

    return rootCause;
  }
}
