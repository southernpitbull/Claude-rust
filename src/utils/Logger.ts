/**
 * Logger.ts
 *
 * Enhanced logging utility for the AIrchitect CLI application.
 * Provides flexible, configurable logging with multiple output formats and levels.
 */

import chalk from 'chalk';
import { createWriteStream, existsSync, mkdirSync, WriteStream } from 'fs';
import { join } from 'path';
import { format } from 'util';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * Configuration options for Logger
 */
export interface ILoggerConfig {
  level?: LogLevel;
  prefix?: string;
  useColors?: boolean;
  useTimestamp?: boolean;
  logToFile?: boolean;
  logFilePath?: string;
}

/**
 * Enhanced Logger class with comprehensive logging features
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;
  private useColors: boolean;
  private useTimestamp: boolean;
  private logToFile: boolean;
  private logFilePath: string | null;
  private fileStream: WriteStream | null;

  /**
   * Creates a new Logger instance
   * @param config - Logger configuration options
   */
  constructor(config: ILoggerConfig | LogLevel | string = LogLevel.INFO) {
    // Handle backward compatibility with old API
    if (typeof config === 'string' || typeof config === 'number') {
      this.level = this.parseLogLevel(config);
      this.prefix = '';
      this.useColors = true;
      this.useTimestamp = true;
      this.logToFile = false;
      this.logFilePath = null;
      this.fileStream = null;
    } else {
      this.level = config.level ?? LogLevel.INFO;
      this.prefix = config.prefix ?? '';
      this.useColors = config.useColors ?? true;
      this.useTimestamp = config.useTimestamp ?? true;
      this.logToFile = config.logToFile ?? false;
      this.logFilePath = config.logFilePath ?? null;
      this.fileStream = null;

      if (this.logToFile && this.logFilePath !== null) {
        this.initializeFileLogging(this.logFilePath);
      }
    }
  }

  /**
   * Parse log level from string or number
   * @param level - Level to parse
   * @returns Parsed LogLevel
   */
  private parseLogLevel(level: string | number): LogLevel {
    if (typeof level === 'number') {
      return level;
    }

    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
      silent: LogLevel.SILENT,
    };

    return levelMap[level.toLowerCase()] ?? LogLevel.INFO;
  }

  /**
   * Initialize file logging
   * @param filePath - Path to log file
   */
  private initializeFileLogging(filePath: string): void {
    try {
      const logDir = filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'));
      if (logDir && !existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }

      this.fileStream = createWriteStream(filePath, { flags: 'a' });
    } catch (error) {
      console.error('Failed to initialize file logging:', error);
      this.logToFile = false;
    }
  }

  /**
   * Set the log level
   * @param level - New log level
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level
   * @returns Current log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Format a log message
   * @param message - Message to format
   * @param level - Log level
   * @param args - Additional arguments
   * @returns Formatted message
   */
  private formatMessage(message: string, level: string, ...args: unknown[]): string {
    const parts: string[] = [];

    if (this.useTimestamp) {
      const timestamp = new Date().toISOString();
      parts.push(`[${timestamp}]`);
    }

    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    parts.push(`[${level.toUpperCase()}]`);
    parts.push(message);

    if (args.length > 0) {
      parts.push(format(...args));
    }

    return parts.join(' ');
  }

  /**
   * Colorize a message based on log level
   * @param message - Message to colorize
   * @param level - Log level
   * @returns Colorized message
   */
  private colorize(message: string, level: string): string {
    if (!this.useColors) {
      return message;
    }

    const levelColors: Record<string, (text: string) => string> = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
    };

    const colorFn = levelColors[level.toLowerCase()] ?? chalk.white;
    return colorFn(message);
  }

  /**
   * Write log message to file if enabled
   * @param message - Message to write
   */
  private writeToFile(message: string): void {
    if (this.logToFile && this.fileStream !== null) {
      this.fileStream.write(`${message}\n`);
    }
  }

  /**
   * Log a message at the specified level
   * @param level - Log level
   * @param levelName - Name of the log level
   * @param message - Message to log
   * @param args - Additional arguments
   */
  private log(level: LogLevel, levelName: string, message: string, ...args: unknown[]): void {
    if (level < this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(message, levelName, ...args);
    const plainMessage = formattedMessage;
    const colorizedMessage = this.colorize(formattedMessage, levelName);

    // Write to console
    if (level === LogLevel.ERROR) {
      console.error(colorizedMessage);
    } else {
      console.log(colorizedMessage);
    }

    // Write to file without colors
    this.writeToFile(plainMessage);
  }

  /**
   * Log debug message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  public debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, 'debug', message, ...args);
  }

  /**
   * Log info message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  public info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, 'info', message, ...args);
  }

  /**
   * Log warning message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  public warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, 'warn', message, ...args);
  }

  /**
   * Log error message
   * @param message - Message to log
   * @param args - Additional arguments
   */
  public error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, 'error', message, ...args);
  }

  /**
   * Log success message (info level with green color)
   * @param message - Message to log
   * @param args - Additional arguments
   */
  public success(message: string, ...args: unknown[]): void {
    if (LogLevel.INFO < this.level) {
      return;
    }

    const formattedMessage = this.formatMessage(message, 'success', ...args);
    const colorizedMessage = this.useColors ? chalk.green(formattedMessage) : formattedMessage;

    console.log(colorizedMessage);
    this.writeToFile(formattedMessage);
  }

  /**
   * Log a message without formatting (raw)
   * @param message - Message to log
   */
  public raw(message: string): void {
    console.log(message);
    this.writeToFile(message);
  }

  /**
   * Create a child logger with a specific prefix
   * @param prefix - Prefix for child logger
   * @returns New Logger instance
   */
  public child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      useColors: this.useColors,
      useTimestamp: this.useTimestamp,
      logToFile: this.logToFile,
      logFilePath: this.logFilePath ?? undefined,
    });
  }

  /**
   * Close file stream if logging to file
   */
  public close(): void {
    if (this.fileStream !== null) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }

  /**
   * Static methods for backward compatibility
   */

  /**
   * Static log method
   * @param message - Message to log
   * @param level - Log level
   */
  public static log(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
    const timestamp = new Date().toISOString();
    const levelColors = {
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray,
    };

    const color = levelColors[level];
    console.log(`${color(`[${level.toUpperCase()}]`)} ${chalk.dim(`[${timestamp}]`)} ${message}`);
  }

  /**
   * Static info method
   * @param message - Message to log
   */
  public static info(message: string): void {
    this.log(message, 'info');
  }

  /**
   * Static warn method
   * @param message - Message to log
   */
  public static warn(message: string): void {
    this.log(message, 'warn');
  }

  /**
   * Static error method
   * @param message - Message to log
   */
  public static error(message: string): void {
    this.log(message, 'error');
  }

  /**
   * Static debug method
   * @param message - Message to log
   */
  public static debug(message: string): void {
    this.log(message, 'debug');
  }
}
