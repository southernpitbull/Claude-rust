/**
 * Logger Implementation
 * Winston-based logger with structured logging support
 */

import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import type {
  ILogger,
  ILoggerConfig,
  ILogMetadata,
  LogLevel,
  LogCategory,
  ILogEntry,
} from './types.js';
import { LogMetadata } from './LogMetadata.js';
import { LogFormatter } from './LogFormatter.js';
import { LogTransportFactory } from './LogTransport.js';

/**
 * Logger class implementing ILogger interface
 */
export class Logger implements ILogger {
  private readonly winstonLogger: winston.Logger;
  private readonly name: string;
  private readonly category: LogCategory;
  private readonly defaultMetadata: Record<string, unknown>;

  constructor(
    name: string,
    category: LogCategory = LogCategory.SYSTEM,
    config: Partial<ILoggerConfig> = {}
  ) {
    this.name = name;
    this.category = category;
    this.defaultMetadata = config.defaultMeta ?? {};

    // Create Winston logger
    this.winstonLogger = this.createWinstonLogger(config);
  }

  /**
   * Create Winston logger instance
   */
  private createWinstonLogger(config: Partial<ILoggerConfig>): winston.Logger {
    const {
      level = 'info',
      console: enableConsole = true,
      file: enableFile = false,
      filePath,
      dailyRotate = false,
      prettyPrint = false,
      colorize = true,
      timestamp = true,
      format = 'simple',
      silent = false,
    } = config;

    const transports: winston.transport[] = [];

    // Add console transport
    if (enableConsole) {
      transports.push(
        LogTransportFactory.createConsoleTransport({
          level,
          colorize,
          format,
        })
      );
    }

    // Add file transport
    if (enableFile && filePath) {
      if (dailyRotate) {
        transports.push(
          LogTransportFactory.createDailyRotateTransport({
            level,
            dirname: filePath,
            filename: `${this.name}-%DATE%.log`,
            format,
          })
        );
      } else {
        transports.push(
          LogTransportFactory.createFileTransport({
            level,
            filename: filePath,
            format,
          })
        );
      }
    }

    return winston.createLogger({
      level,
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        trace: 6,
      },
      format: LogFormatter.createFormat(format, colorize),
      transports,
      silent,
      exitOnError: false,
    });
  }

  /**
   * Log an error
   */
  public error(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('error', message, metadata, data);
  }

  /**
   * Log a warning
   */
  public warn(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('warn', message, metadata, data);
  }

  /**
   * Log info
   */
  public info(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('info', message, metadata, data);
  }

  /**
   * Log HTTP request/response
   */
  public http(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('http', message, metadata, data);
  }

  /**
   * Log verbose information
   */
  public verbose(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('verbose', message, metadata, data);
  }

  /**
   * Log debug information
   */
  public debug(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('debug', message, metadata, data);
  }

  /**
   * Log trace information
   */
  public trace(
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    this.log('trace', message, metadata, data);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    metadata?: Partial<ILogMetadata>,
    data?: Record<string, unknown>
  ): void {
    const fullMetadata = this.buildMetadata(metadata);
    const logEntry = this.buildLogEntry(level, message, fullMetadata, data);

    // Log to Winston
    this.winstonLogger.log({
      level,
      message,
      category: fullMetadata.category,
      logId: fullMetadata.logId,
      correlationId: fullMetadata.correlationId,
      userId: fullMetadata.userId,
      sessionId: fullMetadata.sessionId,
      context: fullMetadata.context,
      tags: fullMetadata.tags,
      stack: fullMetadata.stack,
      errorCode: fullMetadata.errorCode,
      performance: fullMetadata.performance,
      data,
      ...this.defaultMetadata,
    });
  }

  /**
   * Build full metadata
   */
  private buildMetadata(partial?: Partial<ILogMetadata>): ILogMetadata {
    const base = LogMetadata.create(this.category, {
      ...partial,
      context: {
        logger: this.name,
        ...partial?.context,
      },
    });

    return LogMetadata.sanitize(base);
  }

  /**
   * Build log entry
   */
  private buildLogEntry(
    level: LogLevel,
    message: string,
    metadata: ILogMetadata,
    data?: Record<string, unknown>
  ): ILogEntry {
    return {
      level,
      message,
      metadata,
      data,
    };
  }

  /**
   * Create a child logger with additional context
   */
  public child(context: Record<string, unknown>): ILogger {
    const childLogger = new Logger(`${this.name}:child`, this.category, {
      level: this.getLevel(),
      defaultMeta: {
        ...this.defaultMetadata,
        ...context,
      },
    });

    // Copy transports from parent
    this.winstonLogger.transports.forEach((transport) => {
      childLogger.winstonLogger.add(transport);
    });

    return childLogger;
  }

  /**
   * Get the underlying Winston logger
   */
  public getWinstonLogger(): winston.Logger {
    return this.winstonLogger;
  }

  /**
   * Set log level
   */
  public setLevel(level: LogLevel): void {
    this.winstonLogger.level = level;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.winstonLogger.level as LogLevel;
  }

  /**
   * Check if level is enabled
   */
  public isLevelEnabled(level: LogLevel): boolean {
    const levels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'trace'];
    const currentIndex = levels.indexOf(this.winstonLogger.level);
    const checkIndex = levels.indexOf(level);

    return checkIndex <= currentIndex;
  }

  /**
   * Add transport
   */
  public addTransport(transport: winston.transport): void {
    this.winstonLogger.add(transport);
  }

  /**
   * Remove transport
   */
  public removeTransport(transport: winston.transport): void {
    this.winstonLogger.remove(transport);
  }

  /**
   * Clear all transports
   */
  public clearTransports(): void {
    this.winstonLogger.clear();
  }

  /**
   * Close logger
   */
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      this.winstonLogger.close();
      resolve();
    });
  }

  /**
   * Log with performance tracking
   */
  public async logPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    level: LogLevel = 'info' as LogLevel
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    try {
      const result = await fn();
      const endTime = Date.now();
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);

      const duration = endTime - startTime;

      this.log(level, `Performance: ${operation}`, {
        category: LogCategory.PERFORMANCE,
        performance: {
          operation,
          duration,
          startTime,
          endTime,
          memoryUsage: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal,
            external: endMemory.external,
            rss: endMemory.rss,
          },
          cpuUsage: {
            user: endCpu.user,
            system: endCpu.system,
          },
        },
        tags: ['performance', operation],
      });

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      this.error(`Performance (failed): ${operation}`, {
        category: LogCategory.PERFORMANCE,
        performance: {
          operation,
          duration,
          startTime,
          endTime,
        },
        tags: ['performance', 'error', operation],
      });

      throw error;
    }
  }

  /**
   * Log error with stack trace
   */
  public logError(error: Error, context?: Record<string, unknown>): void {
    this.error(error.message, {
      category: LogCategory.ERROR,
      stack: error.stack,
      errorCode: error.name,
      context: {
        errorName: error.name,
        ...context,
      },
      tags: ['error', error.name.toLowerCase()],
    });
  }

  /**
   * Log audit event
   */
  public audit(
    action: string,
    actor: { id: string; type: string; name?: string },
    resource: { type: string; id: string; name?: string },
    result: 'success' | 'failure' | 'partial',
    data?: Record<string, unknown>
  ): void {
    this.info(
      `Audit: ${action}`,
      {
        category: LogCategory.AUDIT,
        context: {
          actor,
          action,
          resource,
          result,
        },
        tags: ['audit', action, result],
      },
      data
    );
  }
}

/**
 * Logger factory for creating loggers
 */
export class LoggerFactory {
  private static defaultConfig: Partial<ILoggerConfig> = {
    level: 'info' as LogLevel,
    console: true,
    file: false,
    dailyRotate: false,
    prettyPrint: false,
    colorize: true,
    timestamp: true,
    format: 'simple',
  };

  /**
   * Set default configuration
   */
  public static setDefaultConfig(config: Partial<ILoggerConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Create a logger
   */
  public static createLogger(
    name: string,
    category: LogCategory = LogCategory.SYSTEM,
    config?: Partial<ILoggerConfig>
  ): Logger {
    const mergedConfig = { ...this.defaultConfig, ...config };
    return new Logger(name, category, mergedConfig);
  }

  /**
   * Create a system logger
   */
  public static createSystemLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.SYSTEM, config);
  }

  /**
   * Create a security logger
   */
  public static createSecurityLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.SECURITY, config);
  }

  /**
   * Create a performance logger
   */
  public static createPerformanceLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.PERFORMANCE, config);
  }

  /**
   * Create an audit logger
   */
  public static createAuditLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.AUDIT, config);
  }

  /**
   * Create an API logger
   */
  public static createApiLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.API, config);
  }

  /**
   * Create an agent logger
   */
  public static createAgentLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.AGENT, config);
  }

  /**
   * Create a CLI logger
   */
  public static createCliLogger(name: string, config?: Partial<ILoggerConfig>): Logger {
    return this.createLogger(name, LogCategory.CLI, config);
  }
}
