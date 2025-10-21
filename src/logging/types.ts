/**
 * Logging System Type Definitions
 * Comprehensive types for structured logging with Winston
 */

import type { LeveledLogMethod, Logger as WinstonLogger } from 'winston';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  TRACE = 'trace',
}

/**
 * Log categories for organizational purposes
 */
export enum LogCategory {
  SYSTEM = 'system',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  AUDIT = 'audit',
  API = 'api',
  DATABASE = 'database',
  AGENT = 'agent',
  CLI = 'cli',
  ERROR = 'error',
  BUSINESS = 'business',
}

/**
 * Transport types for log output
 */
export enum TransportType {
  CONSOLE = 'console',
  FILE = 'file',
  DAILY_ROTATE = 'dailyRotate',
  HTTP = 'http',
  STREAM = 'stream',
}

/**
 * Log metadata interface for structured logging
 */
export interface ILogMetadata {
  /** Unique identifier for the log entry */
  readonly logId: string;

  /** Timestamp in ISO format */
  readonly timestamp: string;

  /** Category of the log */
  readonly category: LogCategory;

  /** Correlation ID for request tracking */
  correlationId?: string;

  /** User ID if applicable */
  userId?: string;

  /** Session ID if applicable */
  sessionId?: string;

  /** Additional context data */
  context?: Record<string, unknown>;

  /** Stack trace for errors */
  stack?: string;

  /** Error code if applicable */
  errorCode?: string;

  /** Performance metrics */
  performance?: IPerformanceMetrics;

  /** Tags for filtering */
  tags?: string[];
}

/**
 * Performance metrics interface
 */
export interface IPerformanceMetrics {
  /** Operation duration in milliseconds */
  duration?: number;

  /** Memory usage in bytes */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };

  /** CPU usage percentage */
  cpuUsage?: {
    user: number;
    system: number;
  };

  /** Operation name */
  operation?: string;

  /** Start time */
  startTime?: number;

  /** End time */
  endTime?: number;
}

/**
 * Structured log entry
 */
export interface ILogEntry {
  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Metadata */
  metadata: ILogMetadata;

  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Log context for contextual logging
 */
export interface ILogContext {
  /** Context name */
  name: string;

  /** Correlation ID */
  correlationId?: string;

  /** Parent context */
  parent?: ILogContext;

  /** Context data */
  data: Record<string, unknown>;

  /** Child contexts */
  children: ILogContext[];
}

/**
 * Logger configuration
 */
export interface ILoggerConfig {
  /** Log level */
  level: LogLevel;

  /** Enable console output */
  console: boolean;

  /** Enable file output */
  file: boolean;

  /** File path for logs */
  filePath?: string;

  /** Enable daily rotation */
  dailyRotate: boolean;

  /** Max file size for rotation */
  maxSize?: string;

  /** Max files to keep */
  maxFiles?: string;

  /** Date pattern for rotation */
  datePattern?: string;

  /** Enable pretty printing */
  prettyPrint: boolean;

  /** Enable colorization */
  colorize: boolean;

  /** Enable timestamps */
  timestamp: boolean;

  /** Enable stack traces */
  stackTrace: boolean;

  /** Log format */
  format?: 'json' | 'simple' | 'verbose';

  /** Category filter */
  categories?: LogCategory[];

  /** Silent mode */
  silent?: boolean;

  /** Custom metadata */
  defaultMeta?: Record<string, unknown>;
}

/**
 * Transport configuration
 */
export interface ITransportConfig {
  /** Transport type */
  type: TransportType;

  /** Log level for this transport */
  level?: LogLevel;

  /** Enabled flag */
  enabled: boolean;

  /** Transport-specific options */
  options: Record<string, unknown>;
}

/**
 * Logger instance interface
 */
export interface ILogger {
  /** Log an error */
  error(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log a warning */
  warn(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log info */
  info(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log HTTP request/response */
  http(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log verbose information */
  verbose(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log debug information */
  debug(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Log trace information */
  trace(message: string, metadata?: Partial<ILogMetadata>, data?: Record<string, unknown>): void;

  /** Create a child logger with additional context */
  child(context: Record<string, unknown>): ILogger;

  /** Get the underlying Winston logger */
  getWinstonLogger(): WinstonLogger;

  /** Set log level */
  setLevel(level: LogLevel): void;

  /** Get current log level */
  getLevel(): LogLevel;

  /** Check if level is enabled */
  isLevelEnabled(level: LogLevel): boolean;
}

/**
 * Log manager interface
 */
export interface ILogManager {
  /** Get a logger by name */
  getLogger(name: string, category?: LogCategory): ILogger;

  /** Create a new logger */
  createLogger(name: string, config?: Partial<ILoggerConfig>): ILogger;

  /** Remove a logger */
  removeLogger(name: string): void;

  /** Get all loggers */
  getLoggers(): Map<string, ILogger>;

  /** Set global log level */
  setGlobalLevel(level: LogLevel): void;

  /** Shutdown all loggers */
  shutdown(): Promise<void>;
}

/**
 * Audit log entry
 */
export interface IAuditLogEntry extends ILogEntry {
  /** Actor who performed the action */
  actor: {
    id: string;
    type: 'user' | 'system' | 'agent';
    name?: string;
  };

  /** Action performed */
  action: string;

  /** Resource affected */
  resource: {
    type: string;
    id: string;
    name?: string;
  };

  /** Result of the action */
  result: 'success' | 'failure' | 'partial';

  /** IP address */
  ipAddress?: string;

  /** User agent */
  userAgent?: string;
}

/**
 * Performance log entry
 */
export interface IPerformanceLogEntry extends ILogEntry {
  /** Operation being measured */
  operation: string;

  /** Performance metrics */
  metrics: Required<IPerformanceMetrics>;

  /** Threshold exceeded flag */
  thresholdExceeded?: boolean;

  /** Expected duration */
  expectedDuration?: number;
}

/**
 * Error log entry
 */
export interface IErrorLogEntry extends ILogEntry {
  /** Error name */
  errorName: string;

  /** Error message */
  errorMessage: string;

  /** Error stack trace */
  errorStack?: string;

  /** Error code */
  errorCode?: string;

  /** Error context */
  errorContext?: Record<string, unknown>;

  /** Is fatal error */
  fatal?: boolean;
}

/**
 * Log formatter interface
 */
export interface ILogFormatter {
  /** Format a log entry */
  format(entry: ILogEntry): string;

  /** Format metadata */
  formatMetadata(metadata: ILogMetadata): string;

  /** Format for console */
  formatForConsole(entry: ILogEntry): string;

  /** Format for file */
  formatForFile(entry: ILogEntry): string;

  /** Format as JSON */
  formatAsJson(entry: ILogEntry): string;
}

/**
 * Log filter interface
 */
export interface ILogFilter {
  /** Check if log should be filtered */
  shouldFilter(entry: ILogEntry): boolean;

  /** Add filter rule */
  addRule(rule: ILogFilterRule): void;

  /** Remove filter rule */
  removeRule(ruleId: string): void;
}

/**
 * Log filter rule
 */
export interface ILogFilterRule {
  /** Rule ID */
  id: string;

  /** Rule name */
  name: string;

  /** Filter function */
  filter: (entry: ILogEntry) => boolean;

  /** Enabled flag */
  enabled: boolean;
}

/**
 * Log rotation config
 */
export interface ILogRotationConfig {
  /** Max file size */
  maxSize: string;

  /** Max number of files */
  maxFiles: string;

  /** Date pattern */
  datePattern: string;

  /** Compression enabled */
  compress: boolean;

  /** Archive path */
  archivePath?: string;
}

/**
 * Custom log levels
 */
export const CUSTOM_LEVELS = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    trace: 6,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    trace: 'gray',
  },
};

/**
 * Type guard for log metadata
 */
export function isLogMetadata(obj: unknown): obj is ILogMetadata {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'logId' in obj &&
    'timestamp' in obj &&
    'category' in obj
  );
}

/**
 * Type guard for log entry
 */
export function isLogEntry(obj: unknown): obj is ILogEntry {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'level' in obj &&
    'message' in obj &&
    'metadata' in obj &&
    isLogMetadata((obj as ILogEntry).metadata)
  );
}
