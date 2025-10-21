/**
 * Retry Strategy Implementation for AIrchitect CLI
 *
 * Provides intelligent retry logic with multiple strategies:
 * - Exponential backoff
 * - Linear backoff
 * - Fixed delay
 * - Custom algorithms
 *
 * Features circuit breaker pattern to prevent cascading failures.
 */

import { ErrorCode, ErrorCodeRegistry } from './ErrorCodes';
import { BaseError } from './BaseError';

/**
 * Retry options configuration
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Initial delay in milliseconds */
  initialDelay?: number;
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  /** Function to determine if error is retryable */
  retryableErrors?: (error: Error) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** Callback on final failure */
  onFailure?: (error: Error, attempts: number) => void;
}

/**
 * Retry statistics
 */
export interface RetryStatistics {
  totalAttempts: number;
  successfulRetries: number;
  failedRetries: number;
  averageDelay: number;
  totalDelay: number;
  lastError?: Error;
}

/**
 * Retry strategy types
 */
export enum RetryStrategyType {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIXED = 'fixed',
  CUSTOM = 'custom',
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Threshold of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before attempting recovery */
  recoveryTimeout?: number;
  /** Number of successful attempts needed to close circuit */
  successThreshold?: number;
  /** Enable circuit breaker */
  enabled?: boolean;
}

/**
 * Retry strategy base class
 */
export abstract class RetryStrategy {
  protected options: Required<RetryOptions>;
  protected statistics: RetryStatistics = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageDelay: 0,
    totalDelay: 0,
  };

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 60000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      jitter: options.jitter ?? true,
      timeout: options.timeout ?? 30000,
      retryableErrors: options.retryableErrors ?? this.defaultRetryableErrors,
      onRetry: options.onRetry ?? (() => {}),
      onFailure: options.onFailure ?? (() => {}),
    };
  }

  /**
   * Default logic to determine if error is retryable
   */
  protected defaultRetryableErrors(error: Error): boolean {
    // Check if it's a BaseError with a retryable error code
    if (error instanceof BaseError) {
      return error.isRetryable;
    }

    // Check common retryable error patterns
    const retryablePatterns = [
      /timeout/i,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /rate limit/i,
      /429/,
      /503/,
      /504/,
    ];

    const errorMessage = error.message;
    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * Calculate delay for next retry attempt
   */
  protected abstract calculateDelay(attempt: number): number;

  /**
   * Execute function with retry logic
   */
  public async execute<T>(fn: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error;
    let attempt = 0;

    while (attempt < this.options.maxAttempts) {
      attempt++;
      this.statistics.totalAttempts++;

      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(fn, this.options.timeout);
        this.statistics.successfulRetries++;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.options.retryableErrors(lastError)) {
          this.statistics.failedRetries++;
          this.options.onFailure(lastError, attempt);
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt >= this.options.maxAttempts) {
          this.statistics.failedRetries++;
          this.statistics.lastError = lastError;
          this.options.onFailure(lastError, attempt);
          throw lastError;
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt);
        this.statistics.totalDelay += delay;
        this.statistics.averageDelay = this.statistics.totalDelay / this.statistics.totalAttempts;

        // Call retry callback
        this.options.onRetry(attempt, lastError, delay);

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // Should not reach here, but TypeScript needs it
    throw lastError!;
  }

  /**
   * Execute function with timeout
   */
  protected executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Add jitter to delay
   */
  protected addJitter(delay: number): number {
    if (!this.options.jitter) {
      return delay;
    }

    // Add random jitter between -25% and +25%
    const jitterFactor = 0.25;
    const jitter = delay * jitterFactor * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  /**
   * Get retry statistics
   */
  public getStatistics(): Readonly<RetryStatistics> {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  public resetStatistics(): void {
    this.statistics = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageDelay: 0,
      totalDelay: 0,
    };
  }
}

/**
 * Exponential backoff retry strategy
 */
export class ExponentialBackoffStrategy extends RetryStrategy {
  protected calculateDelay(attempt: number): number {
    // delay = initialDelay * (multiplier ^ (attempt - 1))
    const delay = this.options.initialDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);

    // Cap at maxDelay
    const cappedDelay = Math.min(delay, this.options.maxDelay);

    // Add jitter if enabled
    return this.addJitter(cappedDelay);
  }
}

/**
 * Linear backoff retry strategy
 */
export class LinearBackoffStrategy extends RetryStrategy {
  protected calculateDelay(attempt: number): number {
    // delay = initialDelay * attempt
    const delay = this.options.initialDelay * attempt;

    // Cap at maxDelay
    const cappedDelay = Math.min(delay, this.options.maxDelay);

    // Add jitter if enabled
    return this.addJitter(cappedDelay);
  }
}

/**
 * Fixed delay retry strategy
 */
export class FixedDelayStrategy extends RetryStrategy {
  protected calculateDelay(attempt: number): number {
    // Always use initial delay
    return this.addJitter(this.options.initialDelay);
  }
}

/**
 * Custom retry strategy with user-defined delay calculation
 */
export class CustomRetryStrategy extends RetryStrategy {
  private customDelayFn: (attempt: number) => number;

  constructor(delayFn: (attempt: number) => number, options: RetryOptions = {}) {
    super(options);
    this.customDelayFn = delayFn;
  }

  protected calculateDelay(attempt: number): number {
    const delay = this.customDelayFn(attempt);
    const cappedDelay = Math.min(delay, this.options.maxDelay);
    return this.addJitter(cappedDelay);
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      recoveryTimeout: options.recoveryTimeout ?? 60000,
      successThreshold: options.successThreshold ?? 2,
      enabled: options.enabled ?? true,
    };
  }

  /**
   * Execute function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.options.enabled) {
      return fn();
    }

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitBreakerState.OPEN) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.options.recoveryTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN. Operation not allowed.');
      }
    }

    try {
      const result = await fn();

      // Handle success
      this.onSuccess();

      return result;
    } catch (error) {
      // Handle failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      this.successCount = 0;
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  /**
   * Get current circuit breaker state
   */
  public getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset circuit breaker to closed state
   */
  public reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Get failure count
   */
  public getFailureCount(): number {
    return this.failureCount;
  }
}

/**
 * Retry strategy factory
 */
export class RetryStrategyFactory {
  /**
   * Create exponential backoff strategy
   */
  public static createExponentialBackoff(options?: RetryOptions): ExponentialBackoffStrategy {
    return new ExponentialBackoffStrategy(options);
  }

  /**
   * Create linear backoff strategy
   */
  public static createLinearBackoff(options?: RetryOptions): LinearBackoffStrategy {
    return new LinearBackoffStrategy(options);
  }

  /**
   * Create fixed delay strategy
   */
  public static createFixedDelay(options?: RetryOptions): FixedDelayStrategy {
    return new FixedDelayStrategy(options);
  }

  /**
   * Create custom retry strategy
   */
  public static createCustom(
    delayFn: (attempt: number) => number,
    options?: RetryOptions
  ): CustomRetryStrategy {
    return new CustomRetryStrategy(delayFn, options);
  }

  /**
   * Create retry strategy by type
   */
  public static create(type: RetryStrategyType, options?: RetryOptions): RetryStrategy {
    switch (type) {
      case RetryStrategyType.EXPONENTIAL:
        return this.createExponentialBackoff(options);
      case RetryStrategyType.LINEAR:
        return this.createLinearBackoff(options);
      case RetryStrategyType.FIXED:
        return this.createFixedDelay(options);
      default:
        throw new Error(`Unknown retry strategy type: ${type}`);
    }
  }
}

/**
 * Decorator for automatic retry on async functions
 */
export function Retryable(options: RetryOptions = {}): MethodDecorator {
  return function (target: unknown, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const strategy = new ExponentialBackoffStrategy(options);

    descriptor.value = async function (...args: unknown[]) {
      return strategy.execute(() => originalMethod.apply(this, args), `${String(propertyKey)}`);
    };

    return descriptor;
  };
}

/**
 * Helper function to retry a function
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const strategy = new ExponentialBackoffStrategy(options);
  return strategy.execute(fn);
}

/**
 * Helper function to retry with linear backoff
 */
export async function retryLinear<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const strategy = new LinearBackoffStrategy(options);
  return strategy.execute(fn);
}

/**
 * Helper function to retry with fixed delay
 */
export async function retryFixed<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const strategy = new FixedDelayStrategy(options);
  return strategy.execute(fn);
}
