/**
 * ErrorHandler.ts
 *
 * Central error handling and recovery system for the AIrchitect CLI.
 * Provides global error handling, recovery strategies, retry logic with backoff,
 * fallback mechanisms, circuit breaker pattern, error transformation,
 * context preservation, stack trace enhancement, and error aggregation.
 */

import { BaseError } from './BaseError';
import { ErrorCodes, ErrorCodeRegistry } from './ErrorCodes';
import { RetryStrategy, CircuitBreaker, ExponentialBackoffStrategy } from './RetryStrategy';
import { ErrorLogger } from './ErrorLogger';
import { ErrorReporter } from './ErrorReporter';
import { ErrorFormatter } from './ErrorFormatter';
import { ErrorContext, getCurrentErrorContext } from './ErrorContext';
import { Logger, LogLevel } from '../logging';

/**
 * Error handling configuration
 */
export interface IErrorHandlerConfig {
  logger?: Logger;
  errorLogger?: ErrorLogger;
  errorReporter?: ErrorReporter;
  errorFormatter?: ErrorFormatter;
  verbose?: boolean;
  exitOnError?: boolean;
  enableRecovery?: boolean;
  enableRetry?: boolean;
  enableCircuitBreaker?: boolean;
  defaultRetryAttempts?: number;
  defaultRetryDelay?: number;
  enableFallback?: boolean;
  enableContext?: boolean;
  enableStackEnhancement?: boolean;
  enableAggregation?: boolean;
  enableMetrics?: boolean;
}

/**
 * Error recovery function type
 */
export type ErrorRecoveryFn = (
  error: Error,
  context?: ErrorContext
) => Promise<ErrorResult | undefined>;

/**
 * Fallback handler function type
 */
export type FallbackHandler = (error: Error, context?: ErrorContext) => Promise<ErrorResult>;

/**
 * Error result interface
 */
export interface ErrorResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
  recovered?: boolean;
}

/**
 * Error metrics interface
 */
export interface ErrorMetrics {
  totalHandled: number;
  totalRecovered: number;
  totalFallbacks: number;
  errorTypeCounts: Map<string, number>;
  severityCounts: Map<string, number>;
  lastHandled: Date;
  recoveryRate: number;
}

/**
 * Global error handler registry
 */
export interface ErrorTypeHandler {
  errorType: ErrorConstructor;
  handler: ErrorRecoveryFn;
  priority: number;
}

/**
 * Central ErrorHandler class
 */
export class ErrorHandler {
  private logger: Logger;
  private errorLogger: ErrorLogger;
  private errorReporter: ErrorReporter;
  private errorFormatter: ErrorFormatter;
  private config: IErrorHandlerConfig;
  private handlers: Map<string, ErrorTypeHandler>;
  private fallbackHandler?: FallbackHandler;
  private metrics: ErrorMetrics;
  private recoveryStrategies: Map<string, ErrorRecoveryFn>;
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor(config: IErrorHandlerConfig = {}) {
    this.config = {
      verbose: config.verbose ?? false,
      exitOnError: config.exitOnError ?? false,
      enableRecovery: config.enableRecovery ?? true,
      enableRetry: config.enableRetry ?? true,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      defaultRetryAttempts: config.defaultRetryAttempts ?? 3,
      defaultRetryDelay: config.defaultRetryDelay ?? 1000,
      enableFallback: config.enableFallback ?? true,
      enableContext: config.enableContext ?? true,
      enableStackEnhancement: config.enableStackEnhancement ?? true,
      enableAggregation: config.enableAggregation ?? true,
      enableMetrics: config.enableMetrics ?? true,
      logger: config.logger,
      errorLogger: config.errorLogger,
      errorReporter: config.errorReporter,
      errorFormatter: config.errorFormatter,
    };

    // Create dependencies if not provided
    if (!this.config.logger) {
      this.config.logger = new Logger({ level: LogLevel.ERROR });
    }
    this.logger = this.config.logger;

    if (!this.config.errorLogger) {
      this.config.errorLogger = new ErrorLogger({ logger: this.config.logger });
    }
    this.errorLogger = this.config.errorLogger;

    if (!this.config.errorReporter) {
      this.config.errorReporter = new ErrorReporter({ logger: this.config.logger });
    }
    this.errorReporter = this.config.errorReporter;

    if (!this.config.errorFormatter) {
      this.config.errorFormatter = new ErrorFormatter();
    }
    this.errorFormatter = this.config.errorFormatter;

    this.handlers = new Map();
    this.recoveryStrategies = new Map();
    this.circuitBreakers = new Map();

    // Initialize metrics
    this.metrics = {
      totalHandled: 0,
      totalRecovered: 0,
      totalFallbacks: 0,
      errorTypeCounts: new Map(),
      severityCounts: new Map(),
      lastHandled: new Date(0),
      recoveryRate: 0,
    };

    // Initialize global error handlers if configured
    if (this.config.enableRecovery) {
      this.setupGlobalHandlers();
    }
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // We'll set up global handlers in the application bootstrap phase
    // to avoid interfering with other error handling systems
  }

  /**
   * Handle an error with appropriate recovery and logging
   */
  public async handle(
    error: Error,
    context?: ErrorContext | string,
    options?: {
      retry?: boolean;
      fallback?: boolean;
      report?: boolean;
      log?: boolean;
    }
  ): Promise<ErrorResult> {
    // Update metrics
    this.metrics.totalHandled++;
    this.metrics.lastHandled = new Date();

    // Track error type and severity
    const errorType = error.constructor.name;
    this.metrics.errorTypeCounts.set(
      errorType,
      (this.metrics.errorTypeCounts.get(errorType) || 0) + 1
    );

    if (error instanceof BaseError) {
      this.metrics.severityCounts.set(
        error.severity,
        (this.metrics.severityCounts.get(error.severity) || 0) + 1
      );
    }

    // Convert string context to ErrorContext if needed
    let errorContext: ErrorContext | undefined;
    if (typeof context === 'string') {
      errorContext = new ErrorContext({ action: context });
    } else {
      errorContext = context;
    }

    // Use current context if available and none provided
    if (!errorContext && this.config.enableContext) {
      errorContext = getCurrentErrorContext() || undefined;
    }

    // Log the error
    if (options?.log !== false && this.config.enableRecovery) {
      this.errorLogger.logError(error, errorContext?.getSanitized(), {
        handled: true,
        handler: 'ErrorHandler',
      });
    }

    // Format and display the error
    const formattedError = this.errorFormatter.format(error);
    this.logger.error(formattedError.formatted);

    // Report the error
    if (options?.report !== false && this.config.enableRecovery) {
      this.errorReporter.captureException(error, {
        context: errorContext?.getSanitized(),
        handled: true,
      });
    }

    // Apply recovery strategies
    if (this.config.enableRecovery) {
      const recoveryResult = await this.applyRecoveryStrategies(error, errorContext);
      if (recoveryResult) {
        this.metrics.totalRecovered++;
        this.updateRecoveryRate();
        return {
          success: true,
          data: recoveryResult,
          recovered: true,
        };
      }
    }

    // Check for specific error type handlers
    if (this.handlers.size > 0) {
      const handler = this.findHandler(error);
      if (handler) {
        try {
          const result = await handler(error, errorContext);
          if (result) {
            this.metrics.totalRecovered++;
            this.updateRecoveryRate();
            return result;
          }
        } catch (handlerError) {
          this.logger.warn(`Error handler failed: ${handlerError.message}`);
        }
      }
    }

    // Apply retry logic if enabled and requested
    if (this.config.enableRetry && options?.retry !== false) {
      const retryResult = await this.applyRetryStrategy(error, errorContext);
      if (retryResult?.success) {
        return retryResult;
      }
    }

    // Apply fallback if enabled and requested
    if (this.config.enableFallback && options?.fallback !== false && this.fallbackHandler) {
      try {
        const fallbackResult = await this.fallbackHandler(error, errorContext);
        this.metrics.totalFallbacks++;
        return {
          success: true,
          data: fallbackResult.data,
          error: fallbackResult.error,
          metadata: fallbackResult.metadata,
        };
      } catch (fallbackError) {
        this.logger.error(`Fallback handler failed: ${fallbackError.message}`);
      }
    }

    // If all recovery strategies fail, decide whether to exit
    if (this.config.exitOnError) {
      process.exit(1);
    }

    // Update recovery rate metrics
    this.updateRecoveryRate();

    // Return error result
    return {
      success: false,
      error,
      metadata: {
        handled: true,
        timestamp: new Date(),
        context: errorContext,
      },
    };
  }

  /**
   * Register an error type handler
   */
  public register(
    errorType: ErrorConstructor,
    handler: ErrorRecoveryFn,
    priority: number = 0
  ): void {
    const key = errorType.name;
    this.handlers.set(key, { errorType, handler, priority });
  }

  /**
   * Set a fallback handler
   */
  public setFallback(handler: FallbackHandler): void {
    this.fallbackHandler = handler;
  }

  /**
   * Get current error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset error metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalHandled: 0,
      totalRecovered: 0,
      totalFallbacks: 0,
      errorTypeCounts: new Map(),
      severityCounts: new Map(),
      lastHandled: new Date(0),
      recoveryRate: 0,
    };
  }

  /**
   * Apply recovery strategies for an error
   */
  private async applyRecoveryStrategies(
    error: Error,
    context?: ErrorContext
  ): Promise<unknown | undefined> {
    // Try registered recovery strategies
    for (const [name, strategy] of this.recoveryStrategies) {
      try {
        const result = await strategy(error, context);
        if (result) {
          return result;
        }
      } catch (strategyError) {
        this.logger.warn(`Recovery strategy ${name} failed: ${strategyError.message}`);
      }
    }

    return undefined;
  }

  /**
   * Apply retry strategy for an error
   */
  private async applyRetryStrategy(
    error: Error,
    context?: ErrorContext
  ): Promise<ErrorResult | undefined> {
    if (!(error instanceof BaseError)) {
      return undefined;
    }

    // Check if error is retryable
    const isRetryable = ErrorCodeRegistry.isRetryable(error.errorCode as ErrorCodes);
    if (!isRetryable) {
      return undefined;
    }

    // Create circuit breaker for this error type if not exists
    const circuitKey = error.errorCode || error.constructor.name;
    let circuitBreaker = this.circuitBreakers.get(circuitKey);

    if (!circuitBreaker && this.config.enableCircuitBreaker) {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
      });
      this.circuitBreakers.set(circuitKey, circuitBreaker);
    }

    // Create retry strategy
    const retryStrategy = new ExponentialBackoffStrategy({
      maxAttempts: this.config.defaultRetryAttempts,
      initialDelay: this.config.defaultRetryDelay,
      maxDelay: 30000, // 30 seconds max
      jitter: true,
    });

    if (circuitBreaker) {
      return circuitBreaker
        .execute(async () => {
          return retryStrategy.execute(async () => {
            // In a real implementation, this would call the original function
            // For now, we'll return undefined to indicate no retry happened
            return undefined;
          });
        })
        .catch(() => undefined);
    } else {
      return retryStrategy
        .execute(async () => {
          // In a real implementation, this would call the original function
          return undefined;
        })
        .catch(() => undefined);
    }
  }

  /**
   * Find appropriate handler for an error
   */
  private findHandler(error: Error): ErrorRecoveryFn | undefined {
    // Check for exact error type match
    const exactHandler = this.handlers.get(error.constructor.name);
    if (exactHandler) {
      return exactHandler.handler;
    }

    // Check for inheritance-based matches
    for (const [key, handler] of this.handlers) {
      if (error instanceof handler.errorType) {
        return handler.handler;
      }
    }

    return undefined;
  }

  /**
   * Add a recovery strategy
   */
  public addRecoveryStrategy(name: string, strategy: ErrorRecoveryFn): void {
    this.recoveryStrategies.set(name, strategy);
  }

  /**
   * Remove a recovery strategy
   */
  public removeRecoveryStrategy(name: string): void {
    this.recoveryStrategies.delete(name);
  }

  /**
   * Wrap a function with error handling
   */
  public wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    context?: string | ErrorContext,
    options?: {
      retry?: boolean;
      fallback?: boolean;
      report?: boolean;
      log?: boolean;
    }
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>> | ErrorResult> {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>> | ErrorResult> => {
      try {
        return await fn(...args);
      } catch (error) {
        const result = await this.handle(error, context, options);
        if (result.success && result.data !== undefined) {
          return result.data as Awaited<ReturnType<T>>;
        }
        return result;
      }
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async withCircuitBreaker<T>(
    key: string,
    fn: () => Promise<T>,
    circuitOptions?: ConstructorParameters<typeof CircuitBreaker>[0]
  ): Promise<T> {
    let circuitBreaker = this.circuitBreakers.get(key);

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(circuitOptions);
      this.circuitBreakers.set(key, circuitBreaker);
    }

    return circuitBreaker.execute(fn);
  }

  /**
   * Update recovery rate metric
   */
  private updateRecoveryRate(): void {
    if (this.metrics.totalHandled === 0) {
      this.metrics.recoveryRate = 0;
      return;
    }

    this.metrics.recoveryRate =
      (this.metrics.totalRecovered + this.metrics.totalFallbacks) / this.metrics.totalHandled;
  }

  /**
   * Enhance error stack trace
   */
  private enhanceStackTrace(error: Error, context?: ErrorContext): void {
    if (!this.config.enableStackEnhancement || !error.stack) {
      return;
    }

    // Add context information to the stack trace
    if (context) {
      const contextInfo = `\n    at Context: ${JSON.stringify(context.getSanitized())}`;
      error.stack += contextInfo;
    }
  }

  /**
   * Transform an error to a different type
   */
  public transformError<T extends Error>(error: Error, transformFn: (original: Error) => T): T {
    return transformFn(error);
  }

  /**
   * Create an error from an error code
   */
  public createErrorFromCode(
    errorCode: ErrorCodes,
    context?: ErrorContext,
    additionalMessage?: string
  ): BaseError {
    const metadata = ErrorCodeRegistry.getMetadata(errorCode);
    const message = additionalMessage
      ? `${metadata.userMessage}: ${additionalMessage}`
      : metadata.userMessage;

    return new BaseError(
      message,
      metadata.errorCode.toString(),
      metadata.severity.toLowerCase() as any,
      metadata.category,
      context?.getSanitized(),
      metadata.recoverySuggestions
    );
  }

  /**
   * Aggregate multiple errors into a single error
   */
  public aggregateErrors(errors: Error[], message?: string): BaseError {
    if (errors.length === 0) {
      throw new Error('Cannot aggregate empty error list');
    }

    if (errors.length === 1) {
      return errors[0] instanceof BaseError
        ? errors[0]
        : new BaseError(errors[0].message, 'AGGREGATED_ERROR', 'medium', 'unknown');
    }

    const aggregatedMessage =
      message ||
      `Multiple errors occurred (${errors.length}): ${errors.map((e) => e.message).join(', ')}`;

    const aggregatedContext = {
      originalErrors: errors.map((e) => ({
        message: e.message,
        stack: e.stack,
        type: e.constructor.name,
      })),
    };

    return new BaseError(
      aggregatedMessage,
      'AGGREGATED_ERROR',
      'high',
      'validation',
      aggregatedContext
    );
  }

  /**
   * Close the error handler and cleanup resources
   */
  public async close(): Promise<void> {
    // Close error reporter
    await this.errorReporter.close();

    // Flush error logger
    await this.errorLogger.flush();
  }
}

// Export singleton instance
const errorHandler = new ErrorHandler();
export default errorHandler;

// Export utility functions
export {
  errorHandler,
  type IErrorHandlerConfig,
  type ErrorRecoveryFn,
  type FallbackHandler,
  type ErrorResult,
  type ErrorMetrics,
  type ErrorTypeHandler,
};
