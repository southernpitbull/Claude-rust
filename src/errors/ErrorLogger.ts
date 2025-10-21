/**
 * ErrorLogger.ts
 *
 * Specialized error logging for the AIrchitect CLI.
 * Provides structured error logging with context, stack traces, and performance metrics.
 */

import { Logger, LogLevel, LogTransport, LogFormatter, LogContext } from '../logging';
import { BaseError } from './BaseError';
import { ErrorCodes, ErrorCodeRegistry } from './ErrorCodes';

/**
 * Error log entry interface
 */
export interface ErrorLogEntry {
  timestamp: Date;
  error: BaseError | Error;
  context?: LogContext;
  metadata?: Record<string, unknown>;
  stack?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  severity?: string;
  errorCode?: string;
  category?: string;
}

/**
 * Error logging configuration
 */
export interface ErrorLoggerConfig {
  logger?: Logger;
  logToFile?: boolean;
  logFilePath?: string;
  logToConsole?: boolean;
  logLevel?: LogLevel;
  includeStack?: boolean;
  includeContext?: boolean;
  logPerformance?: boolean;
  enableDeduplication?: boolean;
  deduplicationWindow?: number; // milliseconds
  maxLogSize?: number; // bytes
}

/**
 * ErrorLogger class for specialized error logging
 */
export class ErrorLogger {
  private logger: Logger;
  private config: ErrorLoggerConfig;
  private recentErrors: Map<string, { timestamp: number; count: number }>;
  private logPerformance: boolean;

  constructor(config: ErrorLoggerConfig = {}) {
    this.config = {
      logToFile: config.logToFile ?? true,
      logToConsole: config.logToConsole ?? true,
      logLevel: config.logLevel ?? 'error',
      includeStack: config.includeStack ?? true,
      includeContext: config.includeContext ?? true,
      logPerformance: config.logPerformance ?? true,
      enableDeduplication: config.enableDeduplication ?? true,
      deduplicationWindow: config.deduplicationWindow ?? 60000, // 1 minute
      maxLogSize: config.maxLogSize ?? 10 * 1024 * 1024, // 10MB
      logger: config.logger,
    };

    // Create logger if not provided
    if (!this.config.logger) {
      this.config.logger = new Logger({
        level: this.config.logLevel,
        logToFile: this.config.logToFile,
        logFilePath: this.config.logFilePath,
        transports: [
          new LogTransport({
            level: this.config.logLevel,
            formatter: new LogFormatter({ format: 'json' }),
          }),
        ],
      });
    }

    this.logger = this.config.logger;
    this.recentErrors = new Map();
    this.logPerformance = this.config.logPerformance ?? true;
  }

  /**
   * Log an error with context
   */
  public logError(
    error: BaseError | Error,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    // Check for duplication if enabled
    if (this.config.enableDeduplication && this.isDuplicateError(error)) {
      return;
    }

    const logEntry: ErrorLogEntry = {
      timestamp: new Date(),
      error,
      context: this.config.includeContext ? context : undefined,
      metadata,
      stack: this.config.includeStack ? error.stack : undefined,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.userId,
    };

    // Enhance with error-specific information
    if (error instanceof BaseError) {
      logEntry.severity = error.severity;
      logEntry.errorCode = error.errorCode;
      logEntry.category = error.category;
    }

    // Log to underlying logger
    this.logger.error(this.formatErrorLog(logEntry), {
      ...logEntry.metadata,
      stack: logEntry.stack,
      errorType: error.constructor.name,
      correlationId: logEntry.correlationId,
      requestId: logEntry.requestId,
      userId: logEntry.userId,
      severity: logEntry.severity,
      errorCode: logEntry.errorCode,
      category: logEntry.category,
    });

    // Track for deduplication
    if (this.config.enableDeduplication) {
      this.trackError(error);
    }
  }

  /**
   * Log an error with performance metrics
   */
  public logErrorWithPerformance(
    error: BaseError | Error,
    startTime: number,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    const duration = Date.now() - startTime;

    const additionalMetadata = {
      ...metadata,
      performance: {
        duration,
        timestamp: new Date(startTime),
      },
    };

    this.logError(error, context, additionalMetadata);

    if (this.logPerformance) {
      this.logger.metric('error.duration', duration, {
        errorType: error.constructor.name,
        errorCode: error instanceof BaseError ? error.errorCode : 'UNKNOWN',
      });
    }
  }

  /**
   * Log multiple errors
   */
  public logErrors(
    errors: Array<BaseError | Error>,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    for (const error of errors) {
      this.logError(error, context, metadata);
    }
  }

  /**
   * Format error log entry for logging
   */
  private formatErrorLog(entry: ErrorLogEntry): string {
    const parts: string[] = [];

    // Error message
    parts.push(`ERROR: ${entry.error.message}`);

    // Error code if available
    if (entry.errorCode) {
      parts.push(` [${entry.errorCode}]`);
    }

    // Context information
    if (entry.correlationId) {
      parts.push(` Correlation-ID: ${entry.correlationId}`);
    }

    if (entry.requestId) {
      parts.push(` Request-ID: ${entry.requestId}`);
    }

    if (entry.userId) {
      parts.push(` User-ID: ${entry.userId}`);
    }

    // Additional context
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(` Context: ${JSON.stringify(entry.context)}`);
    }

    return parts.join('');
  }

  /**
   * Check if this error has been logged recently (for deduplication)
   */
  private isDuplicateError(error: BaseError | Error): boolean {
    if (!this.config.enableDeduplication) {
      return false;
    }

    const errorKey = this.getErrorKey(error);
    const now = Date.now();
    const windowStart = now - (this.config.deduplicationWindow || 60000);

    const trackedError = this.recentErrors.get(errorKey);

    if (!trackedError) {
      return false;
    }

    // Remove expired entries
    if (trackedError.timestamp < windowStart) {
      this.recentErrors.delete(errorKey);
      return false;
    }

    return true;
  }

  /**
   * Get a unique key for an error for deduplication
   */
  private getErrorKey(error: BaseError | Error): string {
    if (error instanceof BaseError) {
      return `${error.name}:${error.message}:${error.errorCode}`;
    }
    return `${error.name}:${error.message}`;
  }

  /**
   * Track an error for deduplication
   */
  private trackError(error: BaseError | Error): void {
    if (!this.config.enableDeduplication) {
      return;
    }

    const errorKey = this.getErrorKey(error);
    const now = Date.now();

    const existing = this.recentErrors.get(errorKey);
    if (existing) {
      existing.timestamp = now;
      existing.count++;
    } else {
      this.recentErrors.set(errorKey, { timestamp: now, count: 1 });
    }

    // Clean up old entries periodically
    this.cleanupOldEntries();
  }

  /**
   * Clean up old error entries
   */
  private cleanupOldEntries(): void {
    if (!this.config.enableDeduplication) {
      return;
    }

    const now = Date.now();
    const windowStart = now - (this.config.deduplicationWindow || 60000);

    for (const [key, entry] of this.recentErrors.entries()) {
      if (entry.timestamp < windowStart) {
        this.recentErrors.delete(key);
      }
    }
  }

  /**
   * Log an error from error code
   */
  public logErrorFromCode(
    errorCode: ErrorCodes,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): void {
    const errorMetadata = ErrorCodeRegistry.getMetadata(errorCode);
    const error = new BaseError(
      errorMetadata.userMessage,
      errorMetadata.errorCode,
      errorMetadata.severity as any,
      errorMetadata.category
    );

    this.logError(error, context, {
      ...metadata,
      errorCode,
      errorMetadata,
    });
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): ErrorStats {
    const now = Date.now();
    const windowStart = now - (this.config.deduplicationWindow || 60000);

    let totalErrors = 0;
    let uniqueErrors = 0;

    for (const [key, entry] of this.recentErrors.entries()) {
      if (entry.timestamp >= windowStart) {
        totalErrors += entry.count;
        uniqueErrors++;
      }
    }

    return {
      totalErrors,
      uniqueErrors,
      deduplicationWindow: this.config.deduplicationWindow,
    };
  }

  /**
   * Clear error tracking (for deduplication)
   */
  public clearErrorTracking(): void {
    this.recentErrors.clear();
  }

  /**
   * Set the log level
   */
  public setLogLevel(level: LogLevel): void {
    this.config.logLevel = level;
    this.logger.setLevel(level);
  }

  /**
   * Enable or disable error deduplication
   */
  public setDeduplication(enabled: boolean): void {
    this.config.enableDeduplication = enabled;
  }

  /**
   * Set the deduplication window in milliseconds
   */
  public setDeduplicationWindow(windowMs: number): void {
    this.config.deduplicationWindow = windowMs;
  }

  /**
   * Log an error and return a promise that resolves when logging is complete
   */
  public async logErrorAsync(
    error: BaseError | Error,
    context?: LogContext,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return new Promise((resolve) => {
      setImmediate(() => {
        this.logError(error, context, metadata);
        resolve();
      });
    });
  }

  /**
   * Flush any pending logs
   */
  public async flush(): Promise<void> {
    if (this.logger && typeof this.logger.flush === 'function') {
      await this.logger.flush();
    }
  }
}

/**
 * Error statistics interface
 */
export interface ErrorStats {
  totalErrors: number;
  uniqueErrors: number;
  deduplicationWindow: number;
}

/**
 * Create an error logger instance with default configuration
 */
export function createErrorLogger(config?: ErrorLoggerConfig): ErrorLogger {
  return new ErrorLogger(config);
}

export default ErrorLogger;
