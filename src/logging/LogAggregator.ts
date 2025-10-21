/**
 * Log Aggregator - Real-time log aggregation and statistical analysis
 * Provides trend detection, pattern recognition, and alerting
 */

import type { ILogEntry, LogLevel, LogCategory } from './types.js';

/**
 * Aggregation time window
 */
export type AggregationWindow = '1m' | '5m' | '15m' | '1h' | '24h';

/**
 * Aggregation metric type
 */
export type MetricType = 'count' | 'rate' | 'average' | 'p50' | 'p95' | 'p99' | 'sum';

/**
 * Alert condition
 */
export interface IAlertCondition {
  /** Condition ID */
  id: string;

  /** Condition name */
  name: string;

  /** Metric to monitor */
  metric: string;

  /** Threshold value */
  threshold: number;

  /** Comparison operator */
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';

  /** Time window */
  window: AggregationWindow;

  /** Alert callback */
  callback: (alert: IAlert) => void | Promise<void>;

  /** Enabled flag */
  enabled: boolean;
}

/**
 * Alert data
 */
export interface IAlert {
  /** Alert ID */
  id: string;

  /** Alert condition */
  condition: IAlertCondition;

  /** Current value */
  value: number;

  /** Threshold */
  threshold: number;

  /** Timestamp */
  timestamp: Date;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Aggregation result
 */
export interface IAggregationResult {
  /** Metric name */
  metric: string;

  /** Metric type */
  type: MetricType;

  /** Value */
  value: number;

  /** Time window */
  window: AggregationWindow;

  /** Sample count */
  sampleCount: number;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;
}

/**
 * Statistics summary
 */
export interface IStatsSummary {
  /** Total logs */
  totalLogs: number;

  /** Logs by level */
  byLevel: Map<LogLevel, number>;

  /** Logs by category */
  byCategory: Map<LogCategory, number>;

  /** Error rate */
  errorRate: number;

  /** Average logs per minute */
  avgLogsPerMinute: number;

  /** Top error messages */
  topErrors: Array<{ message: string; count: number }>;

  /** Performance metrics */
  performance?: {
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
  };

  /** Time range */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Time series data point
 */
interface ITimeSeriesPoint {
  timestamp: number;
  value: number;
}

/**
 * Log Aggregator implementation
 */
export class LogAggregator {
  private readonly entries: ILogEntry[];
  private readonly timeSeries: Map<string, ITimeSeriesPoint[]>;
  private readonly alertConditions: Map<string, IAlertCondition>;
  private readonly maxEntries: number;
  private aggregationInterval?: NodeJS.Timeout;

  constructor(maxEntries = 10000) {
    this.entries = [];
    this.timeSeries = new Map();
    this.alertConditions = new Map();
    this.maxEntries = maxEntries;
  }

  /**
   * Add a log entry for aggregation
   */
  public add(entry: ILogEntry): void {
    this.entries.push(entry);

    // Limit size
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Update time series
    this.updateTimeSeries(entry);

    // Check alerts
    this.checkAlerts();
  }

  /**
   * Add multiple log entries
   */
  public addBatch(entries: ILogEntry[]): void {
    for (const entry of entries) {
      this.add(entry);
    }
  }

  /**
   * Get summary statistics
   */
  public getSummary(): IStatsSummary {
    if (this.entries.length === 0) {
      return this.getEmptySummary();
    }

    const byLevel = new Map<LogLevel, number>();
    const byCategory = new Map<LogCategory, number>();
    const errorMessages = new Map<string, number>();
    const durations: number[] = [];

    let errorCount = 0;

    for (const entry of this.entries) {
      // Count by level
      byLevel.set(entry.level, (byLevel.get(entry.level) || 0) + 1);

      // Count by category
      byCategory.set(entry.metadata.category, (byCategory.get(entry.metadata.category) || 0) + 1);

      // Track errors
      if (entry.level === 'error') {
        errorCount++;
        errorMessages.set(entry.message, (errorMessages.get(entry.message) || 0) + 1);
      }

      // Collect durations
      if (entry.metadata.performance?.duration) {
        durations.push(entry.metadata.performance.duration);
      }
    }

    // Calculate time range
    const timestamps = this.entries.map((e) => new Date(e.metadata.timestamp).getTime());
    const startTime = new Date(Math.min(...timestamps));
    const endTime = new Date(Math.max(...timestamps));
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    // Sort and get top errors
    const topErrors = Array.from(errorMessages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));

    return {
      totalLogs: this.entries.length,
      byLevel,
      byCategory,
      errorRate: this.entries.length > 0 ? errorCount / this.entries.length : 0,
      avgLogsPerMinute: durationMinutes > 0 ? this.entries.length / durationMinutes : 0,
      topErrors,
      performance:
        durations.length > 0
          ? {
              avgDuration: this.average(durations),
              p95Duration: this.percentile(durations, 0.95),
              p99Duration: this.percentile(durations, 0.99),
            }
          : undefined,
      timeRange: {
        start: startTime,
        end: endTime,
      },
    };
  }

  /**
   * Aggregate by metric
   */
  public aggregate(
    metric: string,
    type: MetricType,
    window: AggregationWindow
  ): IAggregationResult | undefined {
    const windowMs = this.getWindowMs(window);
    const now = Date.now();
    const startTime = new Date(now - windowMs);

    const relevantEntries = this.entries.filter(
      (e) => new Date(e.metadata.timestamp).getTime() >= startTime.getTime()
    );

    if (relevantEntries.length === 0) {
      return undefined;
    }

    let value = 0;

    switch (type) {
      case 'count':
        value = relevantEntries.length;
        break;
      case 'rate':
        value = relevantEntries.length / (windowMs / 1000 / 60); // per minute
        break;
      case 'average':
      case 'p50':
      case 'p95':
      case 'p99':
      case 'sum':
        value = this.aggregateValues(relevantEntries, metric, type);
        break;
    }

    return {
      metric,
      type,
      value,
      window,
      sampleCount: relevantEntries.length,
      startTime,
      endTime: new Date(now),
    };
  }

  /**
   * Add an alert condition
   */
  public addAlert(condition: IAlertCondition): void {
    this.alertConditions.set(condition.id, condition);
  }

  /**
   * Remove an alert condition
   */
  public removeAlert(conditionId: string): boolean {
    return this.alertConditions.delete(conditionId);
  }

  /**
   * Get all alert conditions
   */
  public getAlerts(): Map<string, IAlertCondition> {
    return new Map(this.alertConditions);
  }

  /**
   * Get time series data
   */
  public getTimeSeries(metric: string, window: AggregationWindow): ITimeSeriesPoint[] {
    const key = `${metric}:${window}`;
    return this.timeSeries.get(key) || [];
  }

  /**
   * Clear all data
   */
  public clear(): void {
    this.entries.length = 0;
    this.timeSeries.clear();
  }

  /**
   * Start continuous aggregation
   */
  public start(intervalMs = 60000): void {
    this.stop();
    this.aggregationInterval = setInterval(() => {
      this.performAggregation();
    }, intervalMs);
  }

  /**
   * Stop continuous aggregation
   */
  public stop(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }
  }

  /**
   * Export data
   */
  public export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(
        {
          summary: this.getSummary(),
          entries: this.entries,
        },
        null,
        2
      );
    }

    // CSV export
    const headers = ['timestamp', 'level', 'message', 'category'];
    const rows = this.entries.map((e) => [
      e.metadata.timestamp,
      e.level,
      e.message,
      e.metadata.category,
    ]);
    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }

  /**
   * Update time series data
   */
  private updateTimeSeries(entry: ILogEntry): void {
    const timestamp = new Date(entry.metadata.timestamp).getTime();

    // Update count time series
    this.addTimeSeriesPoint('log_count:1m', timestamp, 1);

    // Update level-specific time series
    this.addTimeSeriesPoint(`log_${entry.level}:1m`, timestamp, 1);

    // Update performance metrics if available
    if (entry.metadata.performance?.duration) {
      this.addTimeSeriesPoint('duration:1m', timestamp, entry.metadata.performance.duration);
    }
  }

  /**
   * Add a time series point
   */
  private addTimeSeriesPoint(key: string, timestamp: number, value: number): void {
    let points = this.timeSeries.get(key);
    if (!points) {
      points = [];
      this.timeSeries.set(key, points);
    }

    points.push({ timestamp, value });

    // Keep only last hour of data
    const cutoff = timestamp - 60 * 60 * 1000;
    const filtered = points.filter((p) => p.timestamp >= cutoff);
    this.timeSeries.set(key, filtered);
  }

  /**
   * Check alert conditions
   */
  private checkAlerts(): void {
    for (const condition of this.alertConditions.values()) {
      if (!condition.enabled) {
        continue;
      }

      const result = this.aggregate(condition.metric, 'count', condition.window);
      if (!result) {
        continue;
      }

      const triggered = this.evaluateCondition(
        result.value,
        condition.operator,
        condition.threshold
      );
      if (triggered) {
        const alert: IAlert = {
          id: `${condition.id}:${Date.now()}`,
          condition,
          value: result.value,
          threshold: condition.threshold,
          timestamp: new Date(),
        };

        try {
          void condition.callback(alert);
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Aggregate values from entries
   */
  private aggregateValues(entries: ILogEntry[], metric: string, type: MetricType): number {
    const values = entries
      .map((e) => this.extractMetricValue(e, metric))
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return 0;
    }

    switch (type) {
      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);
      case 'average':
        return this.average(values);
      case 'p50':
        return this.percentile(values, 0.5);
      case 'p95':
        return this.percentile(values, 0.95);
      case 'p99':
        return this.percentile(values, 0.99);
      default:
        return 0;
    }
  }

  /**
   * Extract metric value from entry
   */
  private extractMetricValue(entry: ILogEntry, metric: string): number | null {
    if (metric === 'duration' && entry.metadata.performance?.duration) {
      return entry.metadata.performance.duration;
    }

    if (entry.data && metric in entry.data) {
      const value = entry.data[metric];
      return typeof value === 'number' ? value : null;
    }

    return null;
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) {
      return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Get window duration in milliseconds
   */
  private getWindowMs(window: AggregationWindow): number {
    const windows: Record<AggregationWindow, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };
    return windows[window];
  }

  /**
   * Get empty summary
   */
  private getEmptySummary(): IStatsSummary {
    return {
      totalLogs: 0,
      byLevel: new Map(),
      byCategory: new Map(),
      errorRate: 0,
      avgLogsPerMinute: 0,
      topErrors: [],
      timeRange: {
        start: new Date(),
        end: new Date(),
      },
    };
  }

  /**
   * Perform periodic aggregation
   */
  private performAggregation(): void {
    // This could be extended to perform scheduled tasks like:
    // - Generating reports
    // - Cleaning up old data
    // - Sending metrics to external systems
    // - Calculating trends
  }
}

/**
 * Create a log aggregator
 */
export function createLogAggregator(maxEntries = 10000): LogAggregator {
  return new LogAggregator(maxEntries);
}

export default LogAggregator;
