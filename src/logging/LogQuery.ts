/**
 * Log Query - Query and search logs with full-text search and field filtering
 * Provides time range queries, aggregations, and result export
 */

import type { ILogEntry, LogLevel, LogCategory } from './types.js';

/**
 * Time range for queries
 */
export interface ITimeRange {
  /** Start time */
  start: Date;

  /** End time */
  end: Date;
}

/**
 * Query filter
 */
export interface IQueryFilter {
  /** Log levels to include */
  levels?: LogLevel[];

  /** Categories to include */
  categories?: LogCategory[];

  /** Time range */
  timeRange?: ITimeRange;

  /** Full-text search */
  text?: string;

  /** Field filters */
  fields?: Record<string, unknown>;

  /** Context filters */
  context?: Record<string, unknown>;

  /** Correlation ID */
  correlationId?: string;

  /** User ID */
  userId?: string;

  /** Tags */
  tags?: string[];

  /** Minimum duration (ms) */
  minDuration?: number;

  /** Maximum duration (ms) */
  maxDuration?: number;
}

/**
 * Query options
 */
export interface IQueryOptions {
  /** Maximum results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Sort field */
  sortBy?: 'timestamp' | 'level' | 'duration';

  /** Sort direction */
  sortDirection?: 'asc' | 'desc';

  /** Include metadata */
  includeMetadata?: boolean;

  /** Include data */
  includeData?: boolean;
}

/**
 * Query result
 */
export interface IQueryResult {
  /** Matching entries */
  entries: ILogEntry[];

  /** Total count (before limit/offset) */
  total: number;

  /** Has more results */
  hasMore: boolean;

  /** Query execution time in ms */
  executionTime: number;
}

/**
 * Aggregation query
 */
export interface IAggregationQuery {
  /** Aggregation field */
  field: string;

  /** Aggregation function */
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';

  /** Group by field */
  groupBy?: string;
}

/**
 * Aggregation result
 */
export interface IAggregationResult {
  /** Field name */
  field: string;

  /** Aggregation function */
  function: string;

  /** Result value */
  value: number | Record<string, number>;

  /** Sample count */
  count: number;
}

/**
 * Log Query implementation
 */
export class LogQuery {
  private readonly entries: ILogEntry[];

  constructor(entries: ILogEntry[] = []) {
    this.entries = entries;
  }

  /**
   * Execute a query
   */
  public query(filter: IQueryFilter, options?: IQueryOptions): IQueryResult {
    const startTime = Date.now();

    // Apply filters
    let filtered = this.applyFilters(filter);

    // Get total before pagination
    const total = filtered.length;

    // Apply sorting
    filtered = this.applySorting(filtered, options);

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    const hasMore = offset + limit < total;
    filtered = filtered.slice(offset, offset + limit);

    // Strip metadata/data if requested
    if (options?.includeMetadata === false || options?.includeData === false) {
      filtered = filtered.map((entry) => ({
        ...entry,
        metadata:
          options?.includeMetadata !== false ? entry.metadata : ({} as typeof entry.metadata),
        data: options?.includeData !== false ? entry.data : undefined,
      }));
    }

    const executionTime = Date.now() - startTime;

    return {
      entries: filtered,
      total,
      hasMore,
      executionTime,
    };
  }

  /**
   * Search logs by text
   */
  public search(text: string, options?: IQueryOptions): IQueryResult {
    return this.query({ text }, options);
  }

  /**
   * Find logs by level
   */
  public findByLevel(levels: LogLevel | LogLevel[], options?: IQueryOptions): IQueryResult {
    return this.query({ levels: Array.isArray(levels) ? levels : [levels] }, options);
  }

  /**
   * Find logs by category
   */
  public findByCategory(
    categories: LogCategory | LogCategory[],
    options?: IQueryOptions
  ): IQueryResult {
    return this.query(
      { categories: Array.isArray(categories) ? categories : [categories] },
      options
    );
  }

  /**
   * Find logs by time range
   */
  public findByTimeRange(timeRange: ITimeRange, options?: IQueryOptions): IQueryResult {
    return this.query({ timeRange }, options);
  }

  /**
   * Find logs by correlation ID
   */
  public findByCorrelationId(correlationId: string, options?: IQueryOptions): IQueryResult {
    return this.query({ correlationId }, options);
  }

  /**
   * Find errors
   */
  public findErrors(options?: IQueryOptions): IQueryResult {
    return this.query({ levels: ['error'] }, options);
  }

  /**
   * Find slow operations
   */
  public findSlowOperations(minDuration: number, options?: IQueryOptions): IQueryResult {
    return this.query({ minDuration }, options);
  }

  /**
   * Aggregate logs
   */
  public aggregate(filter: IQueryFilter, aggregation: IAggregationQuery): IAggregationResult {
    const filtered = this.applyFilters(filter);

    if (aggregation.groupBy) {
      return this.groupedAggregate(filtered, aggregation);
    }

    return this.simpleAggregate(filtered, aggregation);
  }

  /**
   * Count logs
   */
  public count(filter: IQueryFilter): number {
    return this.applyFilters(filter).length;
  }

  /**
   * Export query results
   */
  public export(filter: IQueryFilter, format: 'json' | 'csv' | 'ndjson' = 'json'): string {
    const entries = this.applyFilters(filter);

    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);

      case 'csv':
        return this.exportCsv(entries);

      case 'ndjson':
        return entries.map((e) => JSON.stringify(e)).join('\n');

      default:
        return '';
    }
  }

  /**
   * Get distinct values for a field
   */
  public distinct(field: string, filter?: IQueryFilter): unknown[] {
    const entries = filter ? this.applyFilters(filter) : this.entries;
    const values = new Set<unknown>();

    for (const entry of entries) {
      const value = this.getFieldValue(entry, field);
      if (value !== undefined && value !== null) {
        values.add(value);
      }
    }

    return Array.from(values);
  }

  /**
   * Apply filters to entries
   */
  private applyFilters(filter: IQueryFilter): ILogEntry[] {
    return this.entries.filter((entry) => {
      // Level filter
      if (filter.levels && !filter.levels.includes(entry.level)) {
        return false;
      }

      // Category filter
      if (filter.categories && !filter.categories.includes(entry.metadata.category)) {
        return false;
      }

      // Time range filter
      if (filter.timeRange) {
        const timestamp = new Date(entry.metadata.timestamp);
        if (timestamp < filter.timeRange.start || timestamp > filter.timeRange.end) {
          return false;
        }
      }

      // Text search filter
      if (filter.text) {
        const searchText = filter.text.toLowerCase();
        if (!entry.message.toLowerCase().includes(searchText)) {
          return false;
        }
      }

      // Field filters
      if (filter.fields) {
        for (const [field, value] of Object.entries(filter.fields)) {
          if (this.getFieldValue(entry, field) !== value) {
            return false;
          }
        }
      }

      // Context filters
      if (filter.context && entry.metadata.context) {
        for (const [key, value] of Object.entries(filter.context)) {
          if (entry.metadata.context[key] !== value) {
            return false;
          }
        }
      }

      // Correlation ID filter
      if (filter.correlationId && entry.metadata.correlationId !== filter.correlationId) {
        return false;
      }

      // User ID filter
      if (filter.userId && entry.metadata.userId !== filter.userId) {
        return false;
      }

      // Tags filter
      if (filter.tags && entry.metadata.tags) {
        if (!filter.tags.some((tag) => entry.metadata.tags?.includes(tag))) {
          return false;
        }
      }

      // Duration filters
      if (filter.minDuration !== undefined || filter.maxDuration !== undefined) {
        const duration = entry.metadata.performance?.duration;
        if (duration === undefined) {
          return false;
        }
        if (filter.minDuration !== undefined && duration < filter.minDuration) {
          return false;
        }
        if (filter.maxDuration !== undefined && duration > filter.maxDuration) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sorting to entries
   */
  private applySorting(entries: ILogEntry[], options?: IQueryOptions): ILogEntry[] {
    if (!options?.sortBy) {
      return entries;
    }

    const sorted = [...entries];
    const direction = options.sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (options.sortBy) {
        case 'timestamp':
          aVal = new Date(a.metadata.timestamp).getTime();
          bVal = new Date(b.metadata.timestamp).getTime();
          break;
        case 'level': {
          const levels: LogLevel[] = ['trace', 'debug', 'verbose', 'http', 'info', 'warn', 'error'];
          aVal = levels.indexOf(a.level);
          bVal = levels.indexOf(b.level);
          break;
        }
        case 'duration':
          aVal = a.metadata.performance?.duration || 0;
          bVal = b.metadata.performance?.duration || 0;
          break;
      }

      return aVal > bVal ? direction : aVal < bVal ? -direction : 0;
    });

    return sorted;
  }

  /**
   * Simple aggregation
   */
  private simpleAggregate(
    entries: ILogEntry[],
    aggregation: IAggregationQuery
  ): IAggregationResult {
    const values = entries
      .map((e) => this.getFieldValue(e, aggregation.field))
      .filter((v): v is number => typeof v === 'number');

    let result = 0;

    switch (aggregation.function) {
      case 'count':
        result = entries.length;
        break;
      case 'sum':
        result = values.reduce((sum, v) => sum + v, 0);
        break;
      case 'avg':
        result = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
        break;
      case 'min':
        result = values.length > 0 ? Math.min(...values) : 0;
        break;
      case 'max':
        result = values.length > 0 ? Math.max(...values) : 0;
        break;
    }

    return {
      field: aggregation.field,
      function: aggregation.function,
      value: result,
      count: entries.length,
    };
  }

  /**
   * Grouped aggregation
   */
  private groupedAggregate(
    entries: ILogEntry[],
    aggregation: IAggregationQuery
  ): IAggregationResult {
    const groups = new Map<string, ILogEntry[]>();

    for (const entry of entries) {
      const groupKey = String(this.getFieldValue(entry, aggregation.groupBy!) || 'unknown');
      const group = groups.get(groupKey) || [];
      group.push(entry);
      groups.set(groupKey, group);
    }

    const results: Record<string, number> = {};

    for (const [key, groupEntries] of groups.entries()) {
      const agg = this.simpleAggregate(groupEntries, {
        ...aggregation,
        groupBy: undefined,
      });
      results[key] = typeof agg.value === 'number' ? agg.value : 0;
    }

    return {
      field: aggregation.field,
      function: aggregation.function,
      value: results,
      count: entries.length,
    };
  }

  /**
   * Get field value from entry
   */
  private getFieldValue(entry: ILogEntry, field: string): unknown {
    if (field === 'level') {
      return entry.level;
    }
    if (field === 'message') {
      return entry.message;
    }
    if (field === 'timestamp') {
      return entry.metadata.timestamp;
    }
    if (field === 'category') {
      return entry.metadata.category;
    }
    if (field === 'duration') {
      return entry.metadata.performance?.duration;
    }
    if (field === 'correlationId') {
      return entry.metadata.correlationId;
    }
    if (field === 'userId') {
      return entry.metadata.userId;
    }

    if (entry.metadata.context && field in entry.metadata.context) {
      return entry.metadata.context[field];
    }

    if (entry.data && field in entry.data) {
      return entry.data[field];
    }

    return undefined;
  }

  /**
   * Export entries as CSV
   */
  private exportCsv(entries: ILogEntry[]): string {
    const headers = ['timestamp', 'level', 'category', 'message', 'correlationId'];
    const rows = entries.map((e) => [
      e.metadata.timestamp,
      e.level,
      e.metadata.category,
      `"${e.message.replace(/"/g, '""')}"`,
      e.metadata.correlationId || '',
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }
}

/**
 * Create a log query instance
 */
export function createLogQuery(entries: ILogEntry[] = []): LogQuery {
  return new LogQuery(entries);
}

export default LogQuery;
