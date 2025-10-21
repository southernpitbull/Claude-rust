/**
 * Log Manager
 * Centralized management of multiple loggers
 */

import type { ILogManager, ILogger, ILoggerConfig, LogLevel, LogCategory } from './types.js';
import { Logger, LoggerFactory } from './Logger.js';
import { DefaultTransports } from './LogTransport.js';
import * as path from 'path';

/**
 * Log manager for managing multiple loggers
 */
export class LogManager implements ILogManager {
  private static instance: LogManager | null = null;
  private readonly loggers: Map<string, ILogger>;
  private globalConfig: Partial<ILoggerConfig>;
  private readonly logsDirectory: string;

  private constructor(logsDirectory: string = './logs') {
    this.loggers = new Map();
    this.logsDirectory = logsDirectory;
    this.globalConfig = {
      level: 'info' as LogLevel,
      console: true,
      file: true,
      dailyRotate: true,
      filePath: logsDirectory,
      prettyPrint: false,
      colorize: true,
      timestamp: true,
      format: 'simple',
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(logsDirectory?: string): LogManager {
    if (!this.instance) {
      this.instance = new LogManager(logsDirectory);
    }
    return this.instance;
  }

  /**
   * Reset singleton instance (mainly for testing)
   */
  public static resetInstance(): void {
    if (this.instance) {
      void this.instance.shutdown();
      this.instance = null;
    }
  }

  /**
   * Get a logger by name
   */
  public getLogger(name: string, category?: LogCategory): ILogger {
    const key = this.getLoggerKey(name, category);

    let logger = this.loggers.get(key);

    if (!logger) {
      logger = this.createLogger(name, { ...this.globalConfig });
      this.loggers.set(key, logger);
    }

    return logger;
  }

  /**
   * Create a new logger
   */
  public createLogger(name: string, config?: Partial<ILoggerConfig>): ILogger {
    const mergedConfig = { ...this.globalConfig, ...config };
    const category = this.getCategoryFromConfig(config);

    const logger = LoggerFactory.createLogger(name, category, mergedConfig);
    const key = this.getLoggerKey(name, category);

    this.loggers.set(key, logger);

    return logger;
  }

  /**
   * Remove a logger
   */
  public removeLogger(name: string): void {
    const logger = this.loggers.get(name);

    if (logger && logger instanceof Logger) {
      void logger.close();
    }

    this.loggers.delete(name);
  }

  /**
   * Get all loggers
   */
  public getLoggers(): Map<string, ILogger> {
    return new Map(this.loggers);
  }

  /**
   * Set global log level
   */
  public setGlobalLevel(level: LogLevel): void {
    this.globalConfig.level = level;

    // Update all existing loggers
    for (const logger of this.loggers.values()) {
      logger.setLevel(level);
    }
  }

  /**
   * Set global configuration
   */
  public setGlobalConfig(config: Partial<ILoggerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
  }

  /**
   * Shutdown all loggers
   */
  public async shutdown(): Promise<void> {
    const closePromises: Array<Promise<void>> = [];

    for (const logger of this.loggers.values()) {
      if (logger instanceof Logger) {
        closePromises.push(logger.close());
      }
    }

    await Promise.all(closePromises);
    this.loggers.clear();
  }

  /**
   * Get logger key
   */
  private getLoggerKey(name: string, category?: LogCategory): string {
    return category != null ? `${name}:${category}` : name;
  }

  /**
   * Get category from config
   */
  private getCategoryFromConfig(config?: Partial<ILoggerConfig>): LogCategory {
    const categories = config?.categories;
    return categories && categories.length > 0 ? categories[0]! : LogCategory.SYSTEM;
  }

  /**
   * Create system logger
   */
  public createSystemLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.SYSTEM],
    });
  }

  /**
   * Create security logger
   */
  public createSecurityLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.SECURITY],
      filePath: path.join(this.logsDirectory, 'security'),
    });
  }

  /**
   * Create performance logger
   */
  public createPerformanceLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.PERFORMANCE],
      filePath: path.join(this.logsDirectory, 'performance'),
    });
  }

  /**
   * Create audit logger
   */
  public createAuditLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.AUDIT],
      filePath: path.join(this.logsDirectory, 'audit'),
      level: 'info' as LogLevel,
    });
  }

  /**
   * Create API logger
   */
  public createApiLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.API],
      filePath: path.join(this.logsDirectory, 'api'),
    });
  }

  /**
   * Create agent logger
   */
  public createAgentLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.AGENT],
      filePath: path.join(this.logsDirectory, 'agents'),
    });
  }

  /**
   * Create CLI logger
   */
  public createCliLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.CLI],
      filePath: path.join(this.logsDirectory, 'cli'),
    });
  }

  /**
   * Create error logger
   */
  public createErrorLogger(name: string): ILogger {
    return this.createLogger(name, {
      ...this.globalConfig,
      categories: [LogCategory.ERROR],
      level: 'error' as LogLevel,
      filePath: path.join(this.logsDirectory, 'errors'),
    });
  }

  /**
   * Get or create logger
   */
  public getOrCreate(
    name: string,
    category?: LogCategory,
    config?: Partial<ILoggerConfig>
  ): ILogger {
    const key = this.getLoggerKey(name, category);
    let logger = this.loggers.get(key);

    if (!logger) {
      logger = this.createLogger(name, config);
    }

    return logger;
  }

  /**
   * Check if logger exists
   */
  public hasLogger(name: string, category?: LogCategory): boolean {
    const key = this.getLoggerKey(name, category);
    return this.loggers.has(key);
  }

  /**
   * Get logger count
   */
  public getLoggerCount(): number {
    return this.loggers.size;
  }

  /**
   * Clear all loggers
   */
  public clear(): void {
    void this.shutdown();
  }

  /**
   * Initialize default loggers for AIrchitect
   */
  public initializeDefaults(): void {
    // Set up default transports
    LoggerFactory.setDefaultConfig({
      ...this.globalConfig,
      file: true,
      dailyRotate: true,
    });

    // Create default loggers
    this.createSystemLogger('system');
    this.createSecurityLogger('security');
    this.createPerformanceLogger('performance');
    this.createAuditLogger('audit');
    this.createApiLogger('api');
    this.createAgentLogger('agent');
    this.createCliLogger('cli');
    this.createErrorLogger('error');
  }

  /**
   * Get logs directory
   */
  public getLogsDirectory(): string {
    return this.logsDirectory;
  }

  /**
   * Configure from environment
   */
  public configureFromEnvironment(): void {
    const env = process.env;

    if (env.LOG_LEVEL) {
      this.setGlobalLevel(env.LOG_LEVEL as LogLevel);
    }

    if (env.LOG_FORMAT) {
      this.globalConfig.format = env.LOG_FORMAT as 'json' | 'simple' | 'verbose';
    }

    if (env.LOG_COLORIZE) {
      this.globalConfig.colorize = env.LOG_COLORIZE === 'true';
    }

    if (env.LOG_CONSOLE) {
      this.globalConfig.console = env.LOG_CONSOLE === 'true';
    }

    if (env.LOG_FILE) {
      this.globalConfig.file = env.LOG_FILE === 'true';
    }

    if (env.LOG_DIR) {
      this.globalConfig.filePath = env.LOG_DIR;
    }
  }
}

/**
 * Global logger accessor
 */
export class GlobalLogger {
  private static manager: LogManager | null = null;

  /**
   * Initialize global logger
   */
  public static initialize(logsDirectory?: string): void {
    this.manager = LogManager.getInstance(logsDirectory);
    this.manager.initializeDefaults();
    this.manager.configureFromEnvironment();
  }

  /**
   * Get logger
   */
  public static getLogger(name: string, category?: LogCategory): ILogger {
    if (!this.manager) {
      this.initialize();
    }
    return this.manager!.getLogger(name, category);
  }

  /**
   * Get system logger
   */
  public static system(name: string = 'system'): ILogger {
    return this.getLogger(name, LogCategory.SYSTEM);
  }

  /**
   * Get security logger
   */
  public static security(name: string = 'security'): ILogger {
    return this.getLogger(name, LogCategory.SECURITY);
  }

  /**
   * Get performance logger
   */
  public static performance(name: string = 'performance'): ILogger {
    return this.getLogger(name, LogCategory.PERFORMANCE);
  }

  /**
   * Get audit logger
   */
  public static audit(name: string = 'audit'): ILogger {
    return this.getLogger(name, LogCategory.AUDIT);
  }

  /**
   * Get API logger
   */
  public static api(name: string = 'api'): ILogger {
    return this.getLogger(name, LogCategory.API);
  }

  /**
   * Get agent logger
   */
  public static agent(name: string = 'agent'): ILogger {
    return this.getLogger(name, LogCategory.AGENT);
  }

  /**
   * Get CLI logger
   */
  public static cli(name: string = 'cli'): ILogger {
    return this.getLogger(name, LogCategory.CLI);
  }

  /**
   * Get error logger
   */
  public static error(name: string = 'error'): ILogger {
    return this.getLogger(name, LogCategory.ERROR);
  }

  /**
   * Shutdown
   */
  public static async shutdown(): Promise<void> {
    if (this.manager) {
      await this.manager.shutdown();
      this.manager = null;
    }
  }

  /**
   * Get manager instance
   */
  public static getManager(): LogManager | null {
    return this.manager;
  }
}
