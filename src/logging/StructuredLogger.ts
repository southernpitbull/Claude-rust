/**
 * Structured Logger with typed structured logging and rich metadata
 * Provides correlation IDs, request tracking, and performance metrics
 */

import { v4 as uuidv4 } from 'uuid';
import type { LogLevel, LogCategory, ILogMetadata, ILogEntry, ILogger } from './types.js';

/**
 * Timer interface for performance tracking
 */
export interface ITimer {
  /** Stop the timer and return elapsed time in milliseconds */
  stop(): number;

  /** Get elapsed time without stopping */
  elapsed(): number;

  /** Timer operation name */
  readonly operation: string;

  /** Timer start time */
  readonly startTime: number;
}

/**
 * Structured log data interface
 */
export interface IStructuredLogData {
  /** Primary log message */
  message: string;

  /** Additional structured fields */
  fields?: Record<string, unknown>;

  /** Error object if applicable */
  error?: Error;

  /** Performance metrics */
  duration?: number;

  /** Correlation ID for request tracking */
  correlationId?: string;

  /** Request ID */
  requestId?: string;

  /** User ID */
  userId?: string;

  /** Trace ID for distributed tracing */
  traceId?: string;

  /** Span ID for distributed tracing */
  spanId?: string;

  /** Tags for categorization */
  tags?: string[];
}

/**
 * Metric data interface
 */
export interface IMetricData {
  /** Metric name */
  name: string;

  /** Metric value */
  value: number;

  /** Metric type */
  type: 'counter' | 'gauge' | 'histogram' | 'timer';

  /** Metric tags */
  tags?: Record<string, string>;

  /** Metric timestamp */
  timestamp?: Date;

  /** Metric unit */
  unit?: string;
}

/**
 * Log sampling configuration
 */
export interface ISamplingConfig {
  /** Enable sampling */
  enabled: boolean;

  /** Sample rate (0-1, where 1 = 100%) */
  rate: number;

  /** Always sample errors */
  alwaysLogErrors?: boolean;

  /** Sampling strategy */
  strategy?: 'random' | 'rate-limit' | 'adaptive';
}

/**
 * Structured logger context
 */
export interface IStructuredLogContext {
  /** Context name */
  name: string;

  /** Correlation ID */
  correlationId?: string;

  /** Additional context fields */
  fields: Record<string, unknown>;

  /** Parent context */
  parent?: IStructuredLogContext;
}

/**
 * Timer implementation
 */
class Timer implements ITimer {
  public readonly operation: string;
  public readonly startTime: number;
  private stopped = false;
  private stopTime?: number;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  public stop(): number {
    if (!this.stopped) {
      this.stopTime = Date.now();
      this.stopped = true;
    }
    return this.elapsed();
  }

  public elapsed(): number {
    const endTime = this.stopped ? this.stopTime! : Date.now();
    return endTime - this.startTime;
  }
}

/**
 * Structured Logger implementation
 */
export class StructuredLogger {
  private readonly baseLogger: ILogger;
  private readonly context: IStructuredLogContext;
  private readonly samplingConfig: ISamplingConfig;
  private readonly timers: Map<string, Timer>;
  private sampleCounter = 0;

  constructor(
    baseLogger: ILogger,
    context?: Partial<IStructuredLogContext>,
    samplingConfig?: Partial<ISamplingConfig>
  ) {
    this.baseLogger = baseLogger;
    this.context = {
      name: context?.name || 'default',
      correlationId: context?.correlationId || uuidv4(),
      fields: context?.fields || {},
      parent: context?.parent,
    };
    this.samplingConfig = {
      enabled: samplingConfig?.enabled ?? false,
      rate: samplingConfig?.rate ?? 1.0,
      alwaysLogErrors: samplingConfig?.alwaysLogErrors ?? true,
      strategy: samplingConfig?.strategy ?? 'random',
    };
    this.timers = new Map();
  }

  /**
   * Log structured data at specified level
   */
  public log<T extends IStructuredLogData>(
    level: LogLevel,
    data: T,
    metadata?: Partial<ILogMetadata>
  ): void {
    // Check sampling
    if (!this.shouldLog(level)) {
      return;
    }

    // Build complete metadata
    const completeMetadata: Partial<ILogMetadata> = {
      ...metadata,
      correlationId: data.correlationId || this.context.correlationId,
      context: {
        ...this.context.fields,
        ...data.fields,
        ...(metadata?.context || {}),
      },
      tags: [...(metadata?.tags || []), ...(data.tags || [])],
    };

    // Add performance metrics if duration provided
    if (data.duration !== undefined) {
      completeMetadata.performance = {
        ...completeMetadata.performance,
        duration: data.duration,
      };
    }

    // Add error stack if error provided
    if (data.error) {
      completeMetadata.stack = data.error.stack;
      completeMetadata.errorCode = (data.error as Error & { code?: string }).code;
    }

    // Log using base logger
    const logMethod = this.baseLogger[level].bind(this.baseLogger);
    logMethod(data.message, completeMetadata, data.fields);
  }

  /**
   * Log trace information
   */
  public trace<T extends Record<string, unknown>>(operation: string, data: T): void {
    this.log('trace', {
      message: `Trace: ${operation}`,
      fields: data,
      correlationId: this.context.correlationId,
      tags: ['trace', operation],
    });
  }

  /**
   * Log debug information
   */
  public debug(message: string, fields?: Record<string, unknown>): void {
    this.log('debug', {
      message,
      fields,
      correlationId: this.context.correlationId,
    });
  }

  /**
   * Log info message
   */
  public info(message: string, fields?: Record<string, unknown>): void {
    this.log('info', {
      message,
      fields,
      correlationId: this.context.correlationId,
    });
  }

  /**
   * Log warning
   */
  public warn(message: string, fields?: Record<string, unknown>): void {
    this.log('warn', {
      message,
      fields,
      correlationId: this.context.correlationId,
    });
  }

  /**
   * Log error
   */
  public error(message: string, error?: Error, fields?: Record<string, unknown>): void {
    this.log('error', {
      message,
      error,
      fields,
      correlationId: this.context.correlationId,
      tags: ['error'],
    });
  }

  /**
   * Record a metric
   */
  public metric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const metricData: IMetricData = {
      name,
      value,
      type: 'gauge',
      tags,
      timestamp: new Date(),
      unit,
    };

    this.log('info', {
      message: `Metric: ${name}`,
      fields: {
        metric: metricData,
      },
      correlationId: this.context.correlationId,
      tags: ['metric', name],
    });
  }

  /**
   * Start a performance timer
   */
  public startTimer(operation: string): ITimer {
    const timer = new Timer(operation);
    this.timers.set(operation, timer);
    return timer;
  }

  /**
   * Stop a timer and log the duration
   */
  public stopTimer(operation: string, logLevel: LogLevel = 'debug'): number | undefined {
    const timer = this.timers.get(operation);
    if (!timer) {
      this.warn(`Timer not found: ${operation}`);
      return undefined;
    }

    const duration = timer.stop();
    this.timers.delete(operation);

    this.log(logLevel, {
      message: `Operation completed: ${operation}`,
      duration,
      fields: {
        operation,
        duration,
      },
      correlationId: this.context.correlationId,
      tags: ['performance', operation],
    });

    return duration;
  }

  /**
   * Time an async operation
   */
  public async time<T>(
    operation: string,
    fn: () => Promise<T>,
    logLevel: LogLevel = 'debug'
  ): Promise<T> {
    const timer = this.startTimer(operation);
    try {
      const result = await fn();
      this.stopTimer(operation, logLevel);
      return result;
    } catch (error) {
      const duration = timer.stop();
      this.error(
        `Operation failed: ${operation}`,
        error instanceof Error ? error : new Error(String(error)),
        { operation, duration }
      );
      throw error;
    }
  }

  /**
   * Create a child logger with additional context
   */
  public child(
    contextFields: Record<string, unknown>,
    options?: {
      name?: string;
      correlationId?: string;
    }
  ): StructuredLogger {
    const childContext: Partial<IStructuredLogContext> = {
      name: options?.name || this.context.name,
      correlationId: options?.correlationId || this.context.correlationId,
      fields: {
        ...this.context.fields,
        ...contextFields,
      },
      parent: this.context,
    };

    return new StructuredLogger(this.baseLogger, childContext, this.samplingConfig);
  }

  /**
   * Log a span for distributed tracing
   */
  public span<T>(
    spanName: string,
    fn: (logger: StructuredLogger) => T,
    traceId?: string,
    parentSpanId?: string
  ): T {
    const spanId = uuidv4();
    const spanLogger = this.child(
      {
        spanName,
        spanId,
        traceId: traceId || uuidv4(),
        parentSpanId,
      },
      { name: `${this.context.name}:${spanName}` }
    );

    const timer = spanLogger.startTimer(spanName);
    try {
      spanLogger.debug(`Span started: ${spanName}`, {
        spanId,
        traceId,
        parentSpanId,
      });

      const result = fn(spanLogger);

      const duration = timer.stop();
      spanLogger.debug(`Span completed: ${spanName}`, {
        spanId,
        traceId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = timer.stop();
      spanLogger.error(
        `Span failed: ${spanName}`,
        error instanceof Error ? error : new Error(String(error)),
        { spanId, traceId, duration }
      );
      throw error;
    }
  }

  /**
   * Log an async span for distributed tracing
   */
  public async spanAsync<T>(
    spanName: string,
    fn: (logger: StructuredLogger) => Promise<T>,
    traceId?: string,
    parentSpanId?: string
  ): Promise<T> {
    const spanId = uuidv4();
    const spanLogger = this.child(
      {
        spanName,
        spanId,
        traceId: traceId || uuidv4(),
        parentSpanId,
      },
      { name: `${this.context.name}:${spanName}` }
    );

    const timer = spanLogger.startTimer(spanName);
    try {
      spanLogger.debug(`Span started: ${spanName}`, {
        spanId,
        traceId,
        parentSpanId,
      });

      const result = await fn(spanLogger);

      const duration = timer.stop();
      spanLogger.debug(`Span completed: ${spanName}`, {
        spanId,
        traceId,
        duration,
      });

      return result;
    } catch (error) {
      const duration = timer.stop();
      spanLogger.error(
        `Span failed: ${spanName}`,
        error instanceof Error ? error : new Error(String(error)),
        { spanId, traceId, duration }
      );
      throw error;
    }
  }

  /**
   * Get current context
   */
  public getContext(): IStructuredLogContext {
    return { ...this.context };
  }

  /**
   * Get correlation ID
   */
  public getCorrelationId(): string {
    return this.context.correlationId || '';
  }

  /**
   * Set correlation ID
   */
  public setCorrelationId(correlationId: string): void {
    (this.context as { correlationId?: string }).correlationId = correlationId;
  }

  /**
   * Check if a log should be sampled
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.samplingConfig.enabled) {
      return true;
    }

    // Always log errors if configured
    if (this.samplingConfig.alwaysLogErrors && level === 'error') {
      return true;
    }

    // Apply sampling strategy
    switch (this.samplingConfig.strategy) {
      case 'random':
        return Math.random() < this.samplingConfig.rate;

      case 'rate-limit':
        this.sampleCounter++;
        return this.sampleCounter % Math.ceil(1 / this.samplingConfig.rate) === 0;

      case 'adaptive':
        // Simple adaptive sampling: sample more at lower rates
        const threshold = this.samplingConfig.rate * 1000;
        return this.sampleCounter++ % 1000 < threshold;

      default:
        return true;
    }
  }

  /**
   * Get base logger
   */
  public getBaseLogger(): ILogger {
    return this.baseLogger;
  }

  /**
   * Flush any pending logs
   */
  public async flush(): Promise<void> {
    // Stop all active timers
    for (const [operation, timer] of this.timers.entries()) {
      this.stopTimer(operation, 'debug');
    }
    this.timers.clear();
  }
}

/**
 * Factory function to create a structured logger
 */
export function createStructuredLogger(
  baseLogger: ILogger,
  context?: Partial<IStructuredLogContext>,
  samplingConfig?: Partial<ISamplingConfig>
): StructuredLogger {
  return new StructuredLogger(baseLogger, context, samplingConfig);
}

/**
 * Decorator for automatic method timing
 */
export function Timed(operation?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const opName = operation || propertyKey;

    descriptor.value = async function (this: { logger?: StructuredLogger }, ...args: unknown[]) {
      const logger = (this as { logger?: StructuredLogger }).logger;
      if (!logger) {
        return originalMethod.apply(this, args);
      }

      return logger.time(opName, async () => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

export default StructuredLogger;
