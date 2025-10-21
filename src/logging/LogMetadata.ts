/**
 * Log Metadata Management
 * Handles creation and manipulation of log metadata
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogMetadata, IPerformanceMetrics, LogCategory } from './types.js';

/**
 * Log metadata builder for fluent API
 */
export class LogMetadataBuilder {
  private readonly metadata: Partial<ILogMetadata>;

  constructor(category: LogCategory) {
    this.metadata = {
      logId: uuidv4(),
      timestamp: new Date().toISOString(),
      category,
      context: {},
      tags: [],
    };
  }

  /**
   * Set correlation ID
   */
  public withCorrelationId(correlationId: string): this {
    this.metadata.correlationId = correlationId;
    return this;
  }

  /**
   * Set user ID
   */
  public withUserId(userId: string): this {
    this.metadata.userId = userId;
    return this;
  }

  /**
   * Set session ID
   */
  public withSessionId(sessionId: string): this {
    this.metadata.sessionId = sessionId;
    return this;
  }

  /**
   * Add context data
   */
  public withContext(context: Record<string, unknown>): this {
    this.metadata.context = { ...this.metadata.context, ...context };
    return this;
  }

  /**
   * Set stack trace
   */
  public withStack(stack: string): this {
    this.metadata.stack = stack;
    return this;
  }

  /**
   * Set error code
   */
  public withErrorCode(errorCode: string): this {
    this.metadata.errorCode = errorCode;
    return this;
  }

  /**
   * Add performance metrics
   */
  public withPerformance(metrics: IPerformanceMetrics): this {
    this.metadata.performance = metrics;
    return this;
  }

  /**
   * Add tags
   */
  public withTags(...tags: string[]): this {
    this.metadata.tags = [...(this.metadata.tags ?? []), ...tags];
    return this;
  }

  /**
   * Build the metadata object
   */
  public build(): ILogMetadata {
    return this.metadata as ILogMetadata;
  }
}

/**
 * Log metadata utility class
 */
export class LogMetadata {
  /**
   * Create log metadata
   */
  public static create(category: LogCategory, partial?: Partial<ILogMetadata>): ILogMetadata {
    const base: ILogMetadata = {
      logId: uuidv4(),
      timestamp: new Date().toISOString(),
      category,
      context: {},
    };

    return { ...base, ...partial };
  }

  /**
   * Create builder
   */
  public static builder(category: LogCategory): LogMetadataBuilder {
    return new LogMetadataBuilder(category);
  }

  /**
   * Merge metadata objects
   */
  public static merge(base: ILogMetadata, ...updates: Partial<ILogMetadata>[]): ILogMetadata {
    const merged = { ...base };

    for (const update of updates) {
      Object.assign(merged, update);

      if (update.context) {
        merged.context = { ...merged.context, ...update.context };
      }

      if (update.tags) {
        merged.tags = [...(merged.tags ?? []), ...(update.tags ?? [])];
      }
    }

    return merged;
  }

  /**
   * Extract error metadata from error object
   */
  public static fromError(error: Error, category: LogCategory = LogCategory.ERROR): ILogMetadata {
    return this.builder(category)
      .withErrorCode(error.name)
      .withStack(error.stack ?? '')
      .withContext({
        errorName: error.name,
        errorMessage: error.message,
      })
      .withTags('error')
      .build();
  }

  /**
   * Create performance metadata
   */
  public static forPerformance(operation: string, metrics: IPerformanceMetrics): ILogMetadata {
    return this.builder(LogCategory.PERFORMANCE)
      .withPerformance(metrics)
      .withContext({ operation })
      .withTags('performance', operation)
      .build();
  }

  /**
   * Create audit metadata
   */
  public static forAudit(
    actor: { id: string; type: string; name?: string },
    action: string,
    resource: { type: string; id: string; name?: string }
  ): ILogMetadata {
    return this.builder(LogCategory.AUDIT)
      .withContext({
        actor,
        action,
        resource,
      })
      .withTags('audit', action)
      .build();
  }

  /**
   * Clone metadata
   */
  public static clone(metadata: ILogMetadata): ILogMetadata {
    return {
      ...metadata,
      context: { ...metadata.context },
      tags: [...(metadata.tags ?? [])],
      performance: metadata.performance ? { ...metadata.performance } : undefined,
    };
  }

  /**
   * Sanitize metadata for logging (remove sensitive data)
   */
  public static sanitize(metadata: ILogMetadata): ILogMetadata {
    const sanitized = this.clone(metadata);

    // Remove sensitive fields
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'key'];

    if (sanitized.context) {
      sanitized.context = this.sanitizeObject(sanitized.context, sensitiveKeys);
    }

    return sanitized;
  }

  /**
   * Sanitize object recursively
   */
  private static sanitizeObject(
    obj: Record<string, unknown>,
    sensitiveKeys: string[]
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>, sensitiveKeys);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Add correlation ID if not present
   */
  public static ensureCorrelationId(metadata: ILogMetadata): ILogMetadata {
    if (!metadata.correlationId) {
      return { ...metadata, correlationId: uuidv4() };
    }
    return metadata;
  }

  /**
   * Format metadata for display
   */
  public static format(metadata: ILogMetadata): string {
    const parts: string[] = [`[${metadata.category}]`, `[${metadata.logId}]`];

    if (metadata.correlationId) {
      parts.push(`[corr:${metadata.correlationId}]`);
    }

    if (metadata.userId) {
      parts.push(`[user:${metadata.userId}]`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      parts.push(`[tags:${metadata.tags.join(',')}]`);
    }

    return parts.join(' ');
  }

  /**
   * Validate metadata
   */
  public static validate(metadata: unknown): metadata is ILogMetadata {
    if (typeof metadata !== 'object' || metadata === null) {
      return false;
    }

    const meta = metadata as ILogMetadata;

    return !!(
      meta.logId &&
      typeof meta.logId === 'string' &&
      meta.timestamp &&
      typeof meta.timestamp === 'string' &&
      meta.category &&
      typeof meta.category === 'string'
    );
  }
}

/**
 * Performance metrics collector
 */
export class PerformanceMetricsCollector {
  private readonly startTime: number;
  private readonly operation: string;
  private endTime?: number;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * Complete the operation and collect metrics
   */
  public complete(): IPerformanceMetrics {
    this.endTime = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      operation: this.operation,
      duration: this.endTime - this.startTime,
      startTime: this.startTime,
      endTime: this.endTime,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };
  }

  /**
   * Get current metrics (without ending)
   */
  public current(): IPerformanceMetrics {
    const now = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      operation: this.operation,
      duration: now - this.startTime,
      startTime: this.startTime,
      endTime: now,
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
    };
  }
}

/**
 * Context manager for scoped metadata
 */
export class MetadataContext {
  private static contextStack: ILogMetadata[] = [];

  /**
   * Push metadata onto context stack
   */
  public static push(metadata: ILogMetadata): void {
    this.contextStack.push(metadata);
  }

  /**
   * Pop metadata from context stack
   */
  public static pop(): ILogMetadata | undefined {
    return this.contextStack.pop();
  }

  /**
   * Get current context
   */
  public static current(): ILogMetadata | undefined {
    return this.contextStack[this.contextStack.length - 1];
  }

  /**
   * Clear context stack
   */
  public static clear(): void {
    this.contextStack = [];
  }

  /**
   * Execute function with context
   */
  public static async withContext<T>(metadata: ILogMetadata, fn: () => Promise<T>): Promise<T> {
    this.push(metadata);
    try {
      return await fn();
    } finally {
      this.pop();
    }
  }

  /**
   * Execute synchronous function with context
   */
  public static withContextSync<T>(metadata: ILogMetadata, fn: () => T): T {
    this.push(metadata);
    try {
      return fn();
    } finally {
      this.pop();
    }
  }
}
