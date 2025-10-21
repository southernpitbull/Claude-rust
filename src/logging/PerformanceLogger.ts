/**
 * PerformanceLogger.ts
 *
 * Performance and profiling logging for the AIrchitect CLI.
 * Tracks execution time, memory usage, CPU usage, I/O operations, and custom metrics.
 */

import { Logger, LogLevel, LogContext } from './Logger';
import { StructuredLogger, ITimer } from './StructuredLogger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Performance metric types
 */
export type PerformanceMetricType =
  | 'execution-time'
  | 'memory-usage'
  | 'cpu-usage'
  | 'io-operations'
  | 'network-latency'
  | 'database-query'
  | 'custom';

/**
 * Performance metric interface
 */
export interface PerformanceMetric {
  id: string;
  name: string;
  type: PerformanceMetricType;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  context?: LogContext;
  metadata?: Record<string, unknown>;
}

/**
 * Performance timer interface extending the base timer
 */
export interface IPerformanceTimer extends ITimer {
  /** Get memory usage at start */
  startMemory?: number;

  /** Get memory usage at end */
  endMemory?: number;

  /** Get CPU usage at start */
  startCpu?: number;

  /** Get CPU usage at end */
  endCpu?: number;
}

/**
 * Performance benchmark result
 */
export interface PerformanceBenchmark {
  operation: string;
  duration: number; // in milliseconds
  memoryBefore: number; // in bytes
  memoryAfter: number; // in bytes
  memoryDelta: number; // in bytes
  cpuBefore: number; // percentage
  cpuAfter: number; // percentage
  cpuDelta: number; // percentage
  timestamp: Date;
  tags?: Record<string, string>;
  context?: LogContext;
}

/**
 * Performance logger configuration
 */
export interface PerformanceLoggerConfig {
  logger?: Logger;
  structuredLogger?: StructuredLogger;
  logLevel?: LogLevel;
  enableMemoryTracking?: boolean;
  enableCpuTracking?: boolean;
  enableIoTracking?: boolean;
  enableNetworkTracking?: boolean;
  enableDatabaseTracking?: boolean;
  logThreshold?: number; // log only if duration exceeds this threshold (ms)
  trackAllOperations?: boolean;
  defaultTags?: Record<string, string>;
  autoLogBenchmarks?: boolean;
}

/**
 * PerformanceLogger class for performance tracking
 */
export class PerformanceLogger {
  private logger: Logger;
  private structuredLogger: StructuredLogger;
  private config: PerformanceLoggerConfig;
  private metrics: Map<string, PerformanceMetric[]>;
  private activeTimers: Map<string, IPerformanceTimer>;
  private benchmarks: PerformanceBenchmark[];

  constructor(config: PerformanceLoggerConfig = {}) {
    this.config = {
      logLevel: config.logLevel || 'info',
      enableMemoryTracking: config.enableMemoryTracking ?? true,
      enableCpuTracking: config.enableCpuTracking ?? false, // CPU tracking can be expensive
      enableIoTracking: config.enableIoTracking ?? false,
      enableNetworkTracking: config.enableNetworkTracking ?? false,
      enableDatabaseTracking: config.enableDatabaseTracking ?? false,
      logThreshold: config.logThreshold ?? 0, // Log all by default
      trackAllOperations: config.trackAllOperations ?? true,
      defaultTags: config.defaultTags || {},
      autoLogBenchmarks: config.autoLogBenchmarks ?? true,
      logger: config.logger,
    };

    // Create dependencies if not provided
    if (!this.config.logger) {
      this.config.logger = new Logger({ level: this.config.logLevel });
    }
    this.logger = this.config.logger;

    if (!config.structuredLogger) {
      this.config.structuredLogger = new StructuredLogger(this.logger);
    }
    this.structuredLogger = this.config.structuredLogger;

    this.metrics = new Map();
    this.activeTimers = new Map();
    this.benchmarks = [];
  }

  /**
   * Start performance tracking for an operation
   */
  public start(
    operation: string,
    context?: LogContext,
    tags?: Record<string, string>
  ): IPerformanceTimer {
    const id = uuidv4();
    const startTime = Date.now();

    // Get initial resource usage
    const startMemory = this.config.enableMemoryTracking ? process.memoryUsage().heapUsed : 0;
    const startCpu = this.config.enableCpuTracking ? this.getCurrentCpuUsage() : 0;

    const timer: IPerformanceTimer = {
      operation,
      startTime,
      startMemory,
      startCpu,

      stop: (): number => {
        const stopTime = Date.now();
        const duration = stopTime - startTime;

        // Get final resource usage
        const endMemory = this.config.enableMemoryTracking ? process.memoryUsage().heapUsed : 0;
        const endCpu = this.config.enableCpuTracking ? this.getCurrentCpuUsage() : 0;

        // Create benchmark result
        const benchmark: PerformanceBenchmark = {
          operation,
          duration,
          memoryBefore: startMemory,
          memoryAfter: endMemory,
          memoryDelta: endMemory - startMemory,
          cpuBefore: startCpu,
          cpuAfter: endCpu,
          cpuDelta: endCpu - startCpu,
          timestamp: new Date(),
          tags: { ...this.config.defaultTags, ...tags },
          context,
        };

        this.benchmarks.push(benchmark);

        // Log benchmark if auto-logging is enabled and threshold is met
        if (this.config.autoLogBenchmarks && duration >= (this.config.logThreshold || 0)) {
          this.logBenchmark(benchmark);
        }

        // Clean up timer
        this.activeTimers.delete(id);

        return duration;
      },

      elapsed: (): number => {
        return Date.now() - startTime;
      },
    };

    this.activeTimers.set(id, timer);
    return timer;
  }

  /**
   * Time an async operation and track performance
   */
  public async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext,
    tags?: Record<string, string>
  ): Promise<T> {
    const timer = this.start(operation, context, tags);
    try {
      const result = await fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop();
      throw error;
    }
  }

  /**
   * Time a synchronous operation and track performance
   */
  public timeSync<T>(
    operation: string,
    fn: () => T,
    context?: LogContext,
    tags?: Record<string, string>
  ): T {
    const timer = this.start(operation, context, tags);
    try {
      const result = fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop();
      throw error;
    }
  }

  /**
   * Record a custom performance metric
   */
  public recordMetric(
    name: string,
    value: number,
    unit: string,
    type: PerformanceMetricType = 'custom',
    context?: LogContext,
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      id: uuidv4(),
      name,
      type,
      value,
      unit,
      timestamp: new Date(),
      tags: { ...this.config.defaultTags, ...tags },
      context,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Log metric
    this.structuredLogger.metric(name, value, { ...tags, type, unit }, unit);
  }

  /**
   * Log a performance benchmark
   */
  public logBenchmark(benchmark: PerformanceBenchmark): void {
    const logMessage = `Performance: ${benchmark.operation} completed in ${benchmark.duration}ms`;

    // Log with structured logger
    this.structuredLogger.info(logMessage, {
      operation: benchmark.operation,
      duration: benchmark.duration,
      memoryBefore: benchmark.memoryBefore,
      memoryAfter: benchmark.memoryAfter,
      memoryDelta: benchmark.memoryDelta,
      cpuBefore: benchmark.cpuBefore,
      cpuAfter: benchmark.cpuAfter,
      cpuDelta: benchmark.cpuDelta,
      timestamp: benchmark.timestamp,
      tags: benchmark.tags,
    });

    // Log detailed performance info if duration exceeds threshold significantly
    if (benchmark.duration > (this.config.logThreshold || 0) * 10) {
      this.logger.warn(`Performance alert: ${benchmark.operation} took ${benchmark.duration}ms`, {
        operation: benchmark.operation,
        duration: benchmark.duration,
        memoryDelta: benchmark.memoryDelta,
        cpuDelta: benchmark.cpuDelta,
      });
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private getCurrentCpuUsage(): number {
    try {
      const cpuInfo = process.cpuUsage();
      // Convert to percentage (this is a simplified calculation)
      // In a real implementation, you'd need to track CPU usage over time
      return Math.round((cpuInfo.user + cpuInfo.system) / 1000);
    } catch {
      return 0;
    }
  }

  /**
   * Monitor memory usage over time
   */
  public monitorMemory(
    intervalMs: number = 5000,
    onThresholdExceeded?: (usage: NodeJS.MemoryUsage) => void
  ): () => void {
    if (!this.config.enableMemoryTracking) {
      return () => {};
    }

    const interval = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      // Record memory metrics
      this.recordMetric(
        'memory.heap-used',
        memoryUsage.heapUsed,
        'bytes',
        'memory-usage',
        undefined,
        {
          type: 'heap-used',
        }
      );
      this.recordMetric(
        'memory.heap-total',
        memoryUsage.heapTotal,
        'bytes',
        'memory-usage',
        undefined,
        {
          type: 'heap-total',
        }
      );

      // Check if memory usage is high
      if (heapUsedPercent > 80) {
        // 80% threshold
        this.logger.warn(`High memory usage: ${heapUsedPercent.toFixed(2)}%`, {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
        });

        if (onThresholdExceeded) {
          onThresholdExceeded(memoryUsage);
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }

  /**
   * Monitor specific operations for performance
   */
  public monitorOperation(
    operation: string,
    fn: () => Promise<any>,
    threshold?: number,
    context?: LogContext
  ): () => Promise<any> {
    const effectiveThreshold = threshold ?? this.config.logThreshold ?? 0;

    return async () => {
      const timer = this.start(operation, context);
      try {
        const result = await fn();
        const duration = timer.stop();

        // Log if operation took longer than threshold
        if (duration > effectiveThreshold) {
          this.logger.warn(`${operation} took longer than expected: ${duration}ms`, {
            operation,
            duration,
            threshold: effectiveThreshold,
          });
        }

        return result;
      } catch (error) {
        timer.stop();
        throw error;
      }
    };
  }

  /**
   * Get performance statistics for an operation
   */
  public getStats(operation: string): PerformanceStats | null {
    const benchmarks = this.benchmarks.filter((b) => b.operation === operation);

    if (benchmarks.length === 0) {
      return null;
    }

    const durations = benchmarks.map((b) => b.duration);
    const totalDuration = durations.reduce((sum, dur) => sum + dur, 0);
    const avgDuration = totalDuration / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    const memoryDeltas = benchmarks.map((b) => b.memoryDelta);
    const avgMemoryDelta =
      memoryDeltas.reduce((sum, delta) => sum + delta, 0) / memoryDeltas.length;

    return {
      operation,
      count: benchmarks.length,
      totalDuration,
      avgDuration,
      minDuration,
      maxDuration,
      avgMemoryDelta,
      lastExecuted: benchmarks[benchmarks.length - 1].timestamp,
    };
  }

  /**
   * Get all performance statistics
   */
  public getAllStats(): PerformanceStats[] {
    const operations = new Set(this.benchmarks.map((b) => b.operation));
    return Array.from(operations).map((op) => this.getStats(op)!);
  }

  /**
   * Get a specific metric by name
   */
  public getMetric(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all collected metrics
   */
  public getAllMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get all benchmarks
   */
  public getBenchmarks(): PerformanceBenchmark[] {
    return [...this.benchmarks];
  }

  /**
   * Clear all collected performance data
   */
  public clear(): void {
    this.metrics.clear();
    this.benchmarks = [];

    // Stop all active timers
    for (const [id, timer] of this.activeTimers) {
      try {
        timer.stop();
      } catch {
        // Timer might have already been stopped
      }
    }
    this.activeTimers.clear();
  }

  /**
   * Log performance summary
   */
  public logSummary(): void {
    const stats = this.getAllStats();

    if (stats.length === 0) {
      this.logger.info('No performance data collected yet');
      return;
    }

    this.logger.info(`Performance Summary (${stats.length} operations):`);
    stats.forEach((stat) => {
      this.logger.info(
        `  ${stat.operation}: ${stat.count} calls, ` +
          `avg: ${stat.avgDuration.toFixed(2)}ms, ` +
          `min: ${stat.minDuration}ms, ` +
          `max: ${stat.maxDuration}ms`
      );
    });
  }

  /**
   * Create a performance report
   */
  public generateReport(): PerformanceReport {
    return {
      timestamp: new Date(),
      totalOperations: this.benchmarks.length,
      totalDuration: this.benchmarks.reduce((sum, b) => sum + b.duration, 0),
      avgDuration:
        this.benchmarks.length > 0
          ? this.benchmarks.reduce((sum, b) => sum + b.duration, 0) / this.benchmarks.length
          : 0,
      operations: this.getAllStats(),
      metrics: Array.from(this.metrics.entries()).map(([name, metrics]) => ({
        name,
        count: metrics.length,
        latest: metrics[metrics.length - 1],
      })),
    };
  }

  /**
   * Set performance budget for an operation
   */
  public setPerformanceBudget(operation: string, maxDuration: number): void {
    // In a full implementation, this would track operations against budgets
    // and potentially emit warnings when budgets are exceeded
  }

  /**
   * Check if any operations are exceeding performance budgets
   */
  public checkPerformanceBudgets(): PerformanceBudgetCheckResult[] {
    // In a full implementation, this would compare operations to their budgets
    return [];
  }
}

/**
 * Performance statistics interface
 */
export interface PerformanceStats {
  operation: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgMemoryDelta: number;
  lastExecuted: Date;
}

/**
 * Performance report interface
 */
export interface PerformanceReport {
  timestamp: Date;
  totalOperations: number;
  totalDuration: number;
  avgDuration: number;
  operations: PerformanceStats[];
  metrics: Array<{
    name: string;
    count: number;
    latest: PerformanceMetric;
  }>;
}

/**
 * Performance budget check result
 */
export interface PerformanceBudgetCheckResult {
  operation: string;
  maxDuration: number;
  actualAverage: number;
  exceeded: boolean;
  details: string;
}

// Export a singleton instance for convenience
const performanceLogger = new PerformanceLogger();
export default performanceLogger;
export { performanceLogger };
