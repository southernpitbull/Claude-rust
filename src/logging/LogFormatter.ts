/**
 * Log Formatter
 * Custom formatters for different log outputs
 */

import { format } from 'winston';
import type { Format } from 'logform';
import type { ILogEntry, ILogMetadata, LogLevel } from './types.js';

/**
 * Colors for console output
 */
const LEVEL_COLORS: Record<string, string> = {
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  info: '\x1b[32m', // Green
  http: '\x1b[35m', // Magenta
  verbose: '\x1b[36m', // Cyan
  debug: '\x1b[34m', // Blue
  trace: '\x1b[90m', // Gray
};

const RESET_COLOR = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Log formatter class
 */
export class LogFormatter {
  /**
   * Format log entry as JSON
   */
  public static formatAsJson(entry: ILogEntry): string {
    return JSON.stringify({
      timestamp: entry.metadata.timestamp,
      level: entry.level,
      category: entry.metadata.category,
      message: entry.message,
      logId: entry.metadata.logId,
      correlationId: entry.metadata.correlationId,
      userId: entry.metadata.userId,
      sessionId: entry.metadata.sessionId,
      context: entry.metadata.context,
      data: entry.data,
      stack: entry.metadata.stack,
      errorCode: entry.metadata.errorCode,
      performance: entry.metadata.performance,
      tags: entry.metadata.tags,
    });
  }

  /**
   * Format log entry for console output with colors
   */
  public static formatForConsole(entry: ILogEntry, colorize = true): string {
    const color = LEVEL_COLORS[entry.level] ?? '';
    const reset = colorize ? RESET_COLOR : '';
    const bold = colorize ? BOLD : '';
    const levelColor = colorize ? color : '';

    const timestamp = this.formatTimestamp(entry.metadata.timestamp);
    const level = entry.level.toUpperCase().padEnd(7);
    const category = `[${entry.metadata.category}]`;

    let output = `${timestamp} ${levelColor}${level}${reset} ${bold}${category}${reset} ${entry.message}`;

    // Add correlation ID if present
    if (entry.metadata.correlationId) {
      output += ` ${this.dim('[corr:', colorize)}${entry.metadata.correlationId}${this.dim(']', colorize)}`;
    }

    // Add tags if present
    if (entry.metadata.tags && entry.metadata.tags.length > 0) {
      output += ` ${this.dim('[', colorize)}${entry.metadata.tags.join(', ')}${this.dim(']', colorize)}`;
    }

    // Add data if present
    if (entry.data && Object.keys(entry.data).length > 0) {
      output += `\n  ${this.dim('Data:', colorize)} ${JSON.stringify(entry.data, null, 2)}`;
    }

    // Add context if present
    if (entry.metadata.context && Object.keys(entry.metadata.context).length > 0) {
      output += `\n  ${this.dim('Context:', colorize)} ${JSON.stringify(entry.metadata.context, null, 2)}`;
    }

    // Add performance metrics if present
    if (entry.metadata.performance) {
      const perf = entry.metadata.performance;
      output += `\n  ${this.dim('Performance:', colorize)} ${perf.operation ?? 'unknown'} (${perf.duration ?? 0}ms)`;
    }

    // Add stack trace if present
    if (entry.metadata.stack) {
      output += `\n${this.formatStackTrace(entry.metadata.stack, colorize)}`;
    }

    return output;
  }

  /**
   * Format log entry for file output
   */
  public static formatForFile(entry: ILogEntry): string {
    const timestamp = entry.metadata.timestamp;
    const level = entry.level.toUpperCase().padEnd(7);
    const category = `[${entry.metadata.category}]`;
    const logId = `[${entry.metadata.logId}]`;

    let output = `${timestamp} ${level} ${category} ${logId} ${entry.message}`;

    if (entry.metadata.correlationId) {
      output += ` [corr:${entry.metadata.correlationId}]`;
    }

    if (entry.data) {
      output += ` data=${JSON.stringify(entry.data)}`;
    }

    if (entry.metadata.context && Object.keys(entry.metadata.context).length > 0) {
      output += ` context=${JSON.stringify(entry.metadata.context)}`;
    }

    if (entry.metadata.performance) {
      output += ` perf=${JSON.stringify(entry.metadata.performance)}`;
    }

    if (entry.metadata.stack) {
      output += `\n${entry.metadata.stack}`;
    }

    return output;
  }

  /**
   * Format metadata
   */
  public static formatMetadata(metadata: ILogMetadata): string {
    const parts: string[] = [];

    parts.push(`ID: ${metadata.logId}`);
    parts.push(`Category: ${metadata.category}`);
    parts.push(`Timestamp: ${metadata.timestamp}`);

    if (metadata.correlationId) {
      parts.push(`Correlation ID: ${metadata.correlationId}`);
    }

    if (metadata.userId) {
      parts.push(`User ID: ${metadata.userId}`);
    }

    if (metadata.sessionId) {
      parts.push(`Session ID: ${metadata.sessionId}`);
    }

    if (metadata.tags && metadata.tags.length > 0) {
      parts.push(`Tags: ${metadata.tags.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Format timestamp
   */
  private static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * Format stack trace
   */
  private static formatStackTrace(stack: string, colorize: boolean): string {
    const lines = stack.split('\n');
    return lines.map((line) => `  ${this.dim(line, colorize)}`).join('\n');
  }

  /**
   * Dim text for console
   */
  private static dim(text: string, colorize: boolean): string {
    return colorize ? `\x1b[2m${text}\x1b[0m` : text;
  }

  /**
   * Create Winston format for JSON output
   */
  public static jsonFormat(): Format {
    return format.combine(format.timestamp(), format.errors({ stack: true }), format.json());
  }

  /**
   * Create Winston format for simple output
   */
  public static simpleFormat(colorize = false): Format {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      colorize ? format.colorize() : format.uncolorize(),
      format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp as string} ${level}: ${message as string}${metaStr}`;
      })
    );
  }

  /**
   * Create Winston format for verbose output
   */
  public static verboseFormat(colorize = false): Format {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      colorize ? format.colorize() : format.uncolorize(),
      format.printf((info) => {
        const { timestamp, level, message, category, logId, correlationId, stack, ...meta } = info;

        let output = `${timestamp as string} [${level}] [${(category as string) ?? 'UNKNOWN'}]`;

        if (logId) {
          output += ` [${logId as string}]`;
        }

        if (correlationId) {
          output += ` [corr:${correlationId as string}]`;
        }

        output += ` ${message as string}`;

        if (Object.keys(meta).length > 0) {
          output += `\n  ${JSON.stringify(meta, null, 2)}`;
        }

        if (stack) {
          output += `\n${stack as string}`;
        }

        return output;
      })
    );
  }

  /**
   * Create custom format for AIrchitect
   */
  public static airchitectFormat(colorize = false): Format {
    return format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      format.errors({ stack: true }),
      colorize ? format.colorize() : format.uncolorize(),
      format.printf((info) => {
        const {
          timestamp,
          level,
          message,
          category,
          logId,
          correlationId,
          tags,
          data,
          context,
          performance,
          stack,
          ...meta
        } = info;

        const levelUpper = level.toUpperCase().padEnd(7);
        const categoryStr = category ? `[${category as string}]` : '[UNKNOWN]';

        let output = `${timestamp as string} ${levelUpper} ${categoryStr} ${message as string}`;

        if (correlationId) {
          output += ` [corr:${correlationId as string}]`;
        }

        if (tags && Array.isArray(tags) && tags.length > 0) {
          output += ` [${tags.join(', ')}]`;
        }

        if (data && Object.keys(data).length > 0) {
          output += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        }

        if (context && Object.keys(context).length > 0) {
          output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
        }

        if (performance) {
          const perf = performance as { operation?: string; duration?: number };
          output += `\n  Performance: ${perf.operation ?? 'unknown'} (${perf.duration ?? 0}ms)`;
        }

        if (stack) {
          output += `\n${stack as string}`;
        }

        if (Object.keys(meta).length > 0) {
          output += `\n  Meta: ${JSON.stringify(meta, null, 2)}`;
        }

        return output;
      })
    );
  }

  /**
   * Create format based on format type
   */
  public static createFormat(
    formatType: 'json' | 'simple' | 'verbose' = 'simple',
    colorize = false
  ): Format {
    switch (formatType) {
      case 'json':
        return this.jsonFormat();
      case 'simple':
        return this.simpleFormat(colorize);
      case 'verbose':
        return this.verboseFormat(colorize);
      default:
        return this.airchitectFormat(colorize);
    }
  }
}

/**
 * Custom filter for log entries
 */
export class LogFilter {
  /**
   * Filter by log level
   */
  public static byLevel(level: LogLevel): (info: { level: string }) => boolean {
    const levels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'trace'];
    const levelIndex = levels.indexOf(level);

    return (info) => levels.indexOf(info.level) <= levelIndex;
  }

  /**
   * Filter by category
   */
  public static byCategory(...categories: string[]): (info: { category?: string }) => boolean {
    return (info) => {
      if (!info.category) {
        return false;
      }
      return categories.includes(info.category);
    };
  }

  /**
   * Filter by tags
   */
  public static byTags(...tags: string[]): (info: { tags?: string[] }) => boolean {
    return (info) => {
      if (!info.tags || !Array.isArray(info.tags)) {
        return false;
      }
      return tags.some((tag) => info.tags!.includes(tag));
    };
  }

  /**
   * Filter errors only
   */
  public static errorsOnly(): (info: { level: string }) => boolean {
    return (info) => info.level === 'error';
  }

  /**
   * Combine multiple filters with AND logic
   */
  public static and(...filters: Array<(info: unknown) => boolean>): (info: unknown) => boolean {
    return (info) => filters.every((filter) => filter(info));
  }

  /**
   * Combine multiple filters with OR logic
   */
  public static or(...filters: Array<(info: unknown) => boolean>): (info: unknown) => boolean {
    return (info) => filters.some((filter) => filter(info));
  }

  /**
   * Negate a filter
   */
  public static not(filter: (info: unknown) => boolean): (info: unknown) => boolean {
    return (info) => !filter(info);
  }
}
