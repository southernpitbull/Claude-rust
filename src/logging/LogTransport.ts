/**
 * Log Transport Configuration
 * Custom transports for different log outputs
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';
import type { TransportType, ITransportConfig, ILogRotationConfig } from './types.js';
import { LogFormatter } from './LogFormatter.js';

/**
 * Transport factory for creating Winston transports
 */
export class LogTransportFactory {
  /**
   * Create a console transport
   */
  public static createConsoleTransport(config: {
    level?: string;
    colorize?: boolean;
    format?: 'json' | 'simple' | 'verbose';
  }): winston.transport {
    const { level = 'info', colorize = true, format: formatType = 'simple' } = config;

    return new winston.transports.Console({
      level,
      format: LogFormatter.createFormat(formatType, colorize),
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * Create a file transport
   */
  public static createFileTransport(config: {
    level?: string;
    filename: string;
    maxsize?: number;
    maxFiles?: number;
    format?: 'json' | 'simple' | 'verbose';
  }): winston.transport {
    const {
      level = 'info',
      filename,
      maxsize = 5242880, // 5MB
      maxFiles = 5,
      format: formatType = 'json',
    } = config;

    // Ensure directory exists
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    return new winston.transports.File({
      level,
      filename,
      maxsize,
      maxFiles,
      format: LogFormatter.createFormat(formatType, false),
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * Create a daily rotate file transport
   */
  public static createDailyRotateTransport(config: {
    level?: string;
    dirname: string;
    filename: string;
    datePattern?: string;
    maxSize?: string;
    maxFiles?: string;
    compress?: boolean;
    format?: 'json' | 'simple' | 'verbose';
  }): DailyRotateFile {
    const {
      level = 'info',
      dirname,
      filename,
      datePattern = 'YYYY-MM-DD',
      maxSize = '20m',
      maxFiles = '14d',
      compress = true,
      format: formatType = 'json',
    } = config;

    // Ensure directory exists
    if (!fs.existsSync(dirname)) {
      fs.mkdirSync(dirname, { recursive: true });
    }

    return new DailyRotateFile({
      level,
      dirname,
      filename,
      datePattern,
      maxSize,
      maxFiles,
      zippedArchive: compress,
      format: LogFormatter.createFormat(formatType, false),
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * Create transport from configuration
   */
  public static createFromConfig(config: ITransportConfig): winston.transport | null {
    if (!config.enabled) {
      return null;
    }

    switch (config.type) {
      case TransportType.CONSOLE:
        return this.createConsoleTransport({
          level: config.level,
          colorize: config.options.colorize as boolean | undefined,
          format: config.options.format as 'json' | 'simple' | 'verbose' | undefined,
        });

      case TransportType.FILE:
        return this.createFileTransport({
          level: config.level,
          filename: config.options.filename as string,
          maxsize: config.options.maxsize as number | undefined,
          maxFiles: config.options.maxFiles as number | undefined,
          format: config.options.format as 'json' | 'simple' | 'verbose' | undefined,
        });

      case TransportType.DAILY_ROTATE:
        return this.createDailyRotateTransport({
          level: config.level,
          dirname: config.options.dirname as string,
          filename: config.options.filename as string,
          datePattern: config.options.datePattern as string | undefined,
          maxSize: config.options.maxSize as string | undefined,
          maxFiles: config.options.maxFiles as string | undefined,
          compress: config.options.compress as boolean | undefined,
          format: config.options.format as 'json' | 'simple' | 'verbose' | undefined,
        });

      default:
        return null;
    }
  }
}

/**
 * Transport manager for managing multiple transports
 */
export class TransportManager {
  private readonly transports: Map<string, winston.transport>;
  private readonly configs: Map<string, ITransportConfig>;

  constructor() {
    this.transports = new Map();
    this.configs = new Map();
  }

  /**
   * Add a transport
   */
  public addTransport(name: string, config: ITransportConfig): void {
    const transport = LogTransportFactory.createFromConfig(config);
    if (transport) {
      this.transports.set(name, transport);
      this.configs.set(name, config);
    }
  }

  /**
   * Remove a transport
   */
  public removeTransport(name: string): void {
    const transport = this.transports.get(name);
    if (transport) {
      // Close transport if it has a close method
      if ('close' in transport && typeof transport.close === 'function') {
        transport.close();
      }
      this.transports.delete(name);
      this.configs.delete(name);
    }
  }

  /**
   * Get a transport
   */
  public getTransport(name: string): winston.transport | undefined {
    return this.transports.get(name);
  }

  /**
   * Get all transports
   */
  public getAllTransports(): winston.transport[] {
    return Array.from(this.transports.values());
  }

  /**
   * Get all transport configs
   */
  public getAllConfigs(): Map<string, ITransportConfig> {
    return new Map(this.configs);
  }

  /**
   * Clear all transports
   */
  public clear(): void {
    for (const transport of this.transports.values()) {
      if ('close' in transport && typeof transport.close === 'function') {
        transport.close();
      }
    }
    this.transports.clear();
    this.configs.clear();
  }

  /**
   * Enable a transport
   */
  public enableTransport(name: string): void {
    const config = this.configs.get(name);
    if (config && !config.enabled) {
      config.enabled = true;
      this.removeTransport(name);
      this.addTransport(name, config);
    }
  }

  /**
   * Disable a transport
   */
  public disableTransport(name: string): void {
    const config = this.configs.get(name);
    if (config && config.enabled) {
      config.enabled = false;
      this.removeTransport(name);
    }
  }

  /**
   * Check if transport is enabled
   */
  public isEnabled(name: string): boolean {
    const config = this.configs.get(name);
    return config?.enabled ?? false;
  }
}

/**
 * Default transport configurations
 */
export class DefaultTransports {
  /**
   * Create default console transport config
   */
  public static console(level: string = 'info'): ITransportConfig {
    return {
      type: TransportType.CONSOLE,
      level: level as never,
      enabled: true,
      options: {
        colorize: true,
        format: 'simple',
      },
    };
  }

  /**
   * Create default file transport config
   */
  public static file(filename: string, level: string = 'info'): ITransportConfig {
    return {
      type: TransportType.FILE,
      level: level as never,
      enabled: true,
      options: {
        filename,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: 'json',
      },
    };
  }

  /**
   * Create default daily rotate transport config
   */
  public static dailyRotate(
    dirname: string,
    filename: string = 'app-%DATE%.log',
    level: string = 'info'
  ): ITransportConfig {
    return {
      type: TransportType.DAILY_ROTATE,
      level: level as never,
      enabled: true,
      options: {
        dirname,
        filename,
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        compress: true,
        format: 'json',
      },
    };
  }

  /**
   * Create error file transport config
   */
  public static errorFile(filename: string): ITransportConfig {
    return {
      type: TransportType.FILE,
      level: 'error' as never,
      enabled: true,
      options: {
        filename,
        maxsize: 5242880,
        maxFiles: 10,
        format: 'json',
      },
    };
  }

  /**
   * Create combined log transport config
   */
  public static combinedFile(filename: string): ITransportConfig {
    return {
      type: TransportType.FILE,
      level: 'info' as never,
      enabled: true,
      options: {
        filename,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        format: 'json',
      },
    };
  }

  /**
   * Create audit log transport config
   */
  public static auditLog(dirname: string): ITransportConfig {
    return {
      type: TransportType.DAILY_ROTATE,
      level: 'info' as never,
      enabled: true,
      options: {
        dirname,
        filename: 'audit-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '90d', // Keep for 90 days
        compress: true,
        format: 'json',
      },
    };
  }

  /**
   * Create performance log transport config
   */
  public static performanceLog(dirname: string): ITransportConfig {
    return {
      type: TransportType.DAILY_ROTATE,
      level: 'info' as never,
      enabled: true,
      options: {
        dirname,
        filename: 'performance-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        compress: true,
        format: 'json',
      },
    };
  }

  /**
   * Create all default transports for AIrchitect
   */
  public static createDefaults(logsDir: string = './logs'): ITransportConfig[] {
    return [
      this.console('info'),
      this.dailyRotate(path.join(logsDir, 'combined'), 'app-%DATE%.log', 'info'),
      this.dailyRotate(path.join(logsDir, 'errors'), 'error-%DATE%.log', 'error'),
      this.auditLog(path.join(logsDir, 'audit')),
      this.performanceLog(path.join(logsDir, 'performance')),
    ];
  }
}

/**
 * Log rotation utilities
 */
export class LogRotation {
  /**
   * Parse rotation config
   */
  public static parseConfig(config: Partial<ILogRotationConfig>): ILogRotationConfig {
    return {
      maxSize: config.maxSize ?? '20m',
      maxFiles: config.maxFiles ?? '14d',
      datePattern: config.datePattern ?? 'YYYY-MM-DD',
      compress: config.compress ?? true,
      archivePath: config.archivePath,
    };
  }

  /**
   * Convert size string to bytes
   */
  public static parseSizeToBytes(size: string): number {
    const units: Record<string, number> = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };

    const match = size.toLowerCase().match(/^(\d+)([kmg]?)$/);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }

    const value = parseInt(match[1] ?? '0', 10);
    const unit = match[2] ?? 'b';

    return value * (units[unit] ?? 1);
  }

  /**
   * Format bytes to human-readable size
   */
  public static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex] ?? 'B'}`;
  }

  /**
   * Calculate next rotation time
   */
  public static getNextRotationTime(datePattern: string): Date {
    const now = new Date();

    switch (datePattern) {
      case 'YYYY-MM-DD':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'YYYY-MM-DD-HH':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
      case 'YYYY-MM':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
  }
}
