/**
 * Log Rotation - Advanced log rotation and archiving
 * Supports time-based, size-based rotation, compression, and retention policies
 */

import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat, unlink, rename, mkdir } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';

/**
 * Rotation strategy type
 */
export type RotationStrategy = 'size' | 'time' | 'daily' | 'hourly' | 'custom';

/**
 * Time unit for rotation
 */
export type TimeUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Rotation configuration
 */
export interface IRotationConfig {
  /** Rotation strategy */
  strategy: RotationStrategy;

  /** Maximum file size in bytes (for size-based rotation) */
  maxSize?: number;

  /** Time interval (for time-based rotation) */
  interval?: number;

  /** Time unit (for time-based rotation) */
  timeUnit?: TimeUnit;

  /** Maximum number of files to keep */
  maxFiles: number;

  /** Enable compression */
  compress: boolean;

  /** Archive directory */
  archiveDir?: string;

  /** Date pattern for file naming */
  datePattern?: string;

  /** Retention period in days */
  retentionDays?: number;

  /** Enable atomic rotation */
  atomic?: boolean;
}

/**
 * Rotation metadata
 */
export interface IRotationMetadata {
  /** File path */
  filePath: string;

  /** File size */
  size: number;

  /** Creation time */
  createdAt: Date;

  /** Last rotation time */
  lastRotation?: Date;

  /** Rotation count */
  rotationCount: number;

  /** Compressed flag */
  compressed: boolean;
}

/**
 * Rotation event
 */
export interface IRotationEvent {
  /** Event type */
  type: 'rotation' | 'compression' | 'deletion' | 'error';

  /** File path */
  filePath: string;

  /** Timestamp */
  timestamp: Date;

  /** Additional data */
  data?: Record<string, unknown>;

  /** Error if applicable */
  error?: Error;
}

/**
 * Rotation hook function
 */
export type RotationHook = (event: IRotationEvent) => void | Promise<void>;

/**
 * Log Rotation Manager
 */
export class LogRotation {
  private readonly config: IRotationConfig;
  private readonly metadata: Map<string, IRotationMetadata>;
  private readonly hooks: RotationHook[];
  private rotationTimer?: NodeJS.Timeout;
  private lastRotationCheck: Date;

  constructor(config: Partial<IRotationConfig>) {
    this.config = {
      strategy: config.strategy || 'daily',
      maxSize: config.maxSize || 10 * 1024 * 1024, // 10MB default
      interval: config.interval || 1,
      timeUnit: config.timeUnit || 'day',
      maxFiles: config.maxFiles || 10,
      compress: config.compress ?? true,
      archiveDir: config.archiveDir,
      datePattern: config.datePattern || 'YYYY-MM-DD',
      retentionDays: config.retentionDays,
      atomic: config.atomic ?? true,
    };
    this.metadata = new Map();
    this.hooks = [];
    this.lastRotationCheck = new Date();
  }

  /**
   * Register a rotation hook
   */
  public onRotation(hook: RotationHook): void {
    this.hooks.push(hook);
  }

  /**
   * Check if rotation is needed
   */
  public async shouldRotate(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);
      const meta = this.metadata.get(filePath);

      switch (this.config.strategy) {
        case 'size':
          return stats.size >= (this.config.maxSize || Infinity);

        case 'time':
        case 'daily':
        case 'hourly': {
          if (!meta?.lastRotation) {
            return false;
          }
          const elapsed = Date.now() - meta.lastRotation.getTime();
          const threshold = this.getRotationInterval();
          return elapsed >= threshold;
        }

        case 'custom':
          // Custom logic can be implemented via hooks
          return false;

        default:
          return false;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
      return false;
    }
  }

  /**
   * Rotate a log file
   */
  public async rotate(filePath: string): Promise<void> {
    try {
      // Check if file exists and has content
      const stats = await stat(filePath);
      if (stats.size === 0) {
        return;
      }

      // Generate rotated file name
      const rotatedPath = this.generateRotatedFileName(filePath);

      // Ensure archive directory exists
      if (this.config.archiveDir) {
        await mkdir(this.config.archiveDir, { recursive: true });
      }

      // Perform atomic rotation if configured
      if (this.config.atomic) {
        await this.atomicRotate(filePath, rotatedPath);
      } else {
        await rename(filePath, rotatedPath);
      }

      // Update metadata
      const meta: IRotationMetadata = {
        filePath: rotatedPath,
        size: stats.size,
        createdAt: stats.birthtime,
        lastRotation: new Date(),
        rotationCount: (this.metadata.get(filePath)?.rotationCount || 0) + 1,
        compressed: false,
      };
      this.metadata.set(rotatedPath, meta);

      // Trigger rotation event
      await this.triggerHooks({
        type: 'rotation',
        filePath: rotatedPath,
        timestamp: new Date(),
        data: { originalPath: filePath, size: stats.size },
      });

      // Compress if enabled
      if (this.config.compress) {
        await this.compress(rotatedPath);
      }

      // Clean up old files
      await this.cleanup(dirname(filePath));
    } catch (error) {
      await this.triggerHooks({
        type: 'error',
        filePath,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Compress a log file
   */
  public async compress(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;

    try {
      await pipeline(createReadStream(filePath), createGzip(), createWriteStream(compressedPath));

      // Delete original file
      await unlink(filePath);

      // Update metadata
      const meta = this.metadata.get(filePath);
      if (meta) {
        meta.compressed = true;
        meta.filePath = compressedPath;
        this.metadata.delete(filePath);
        this.metadata.set(compressedPath, meta);
      }

      // Trigger compression event
      await this.triggerHooks({
        type: 'compression',
        filePath: compressedPath,
        timestamp: new Date(),
        data: { originalPath: filePath },
      });

      return compressedPath;
    } catch (error) {
      await this.triggerHooks({
        type: 'error',
        filePath,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Clean up old log files
   */
  public async cleanup(directory: string): Promise<void> {
    try {
      const archiveDir = this.config.archiveDir || directory;
      const files = await readdir(archiveDir);

      // Get all log files with metadata
      const logFiles: Array<{ path: string; stats: { mtime: Date; size: number } }> = [];

      for (const file of files) {
        const filePath = join(archiveDir, file);
        try {
          const stats = await stat(filePath);
          if (stats.isFile() && this.isLogFile(file)) {
            logFiles.push({
              path: filePath,
              stats: { mtime: stats.mtime, size: stats.size },
            });
          }
        } catch {
          // Skip files that can't be accessed
        }
      }

      // Sort by modification time (oldest first)
      logFiles.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());

      // Delete files exceeding maxFiles
      const filesToDelete = logFiles.slice(0, Math.max(0, logFiles.length - this.config.maxFiles));

      for (const file of filesToDelete) {
        await this.deleteFile(file.path);
      }

      // Delete files exceeding retention period
      if (this.config.retentionDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

        for (const file of logFiles) {
          if (file.stats.mtime < cutoffDate) {
            await this.deleteFile(file.path);
          }
        }
      }
    } catch (error) {
      await this.triggerHooks({
        type: 'error',
        filePath: directory,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Start automatic rotation
   */
  public start(filePath: string, checkInterval = 60000): void {
    this.stop();

    this.rotationTimer = setInterval(async () => {
      try {
        if (await this.shouldRotate(filePath)) {
          await this.rotate(filePath);
        }
      } catch (error) {
        // Error already handled by rotate method
      }
    }, checkInterval);
  }

  /**
   * Stop automatic rotation
   */
  public stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  /**
   * Get rotation metadata
   */
  public getMetadata(filePath: string): IRotationMetadata | undefined {
    return this.metadata.get(filePath);
  }

  /**
   * Generate rotated file name
   */
  private generateRotatedFileName(filePath: string): string {
    const dir = this.config.archiveDir || dirname(filePath);
    const base = basename(filePath, extname(filePath));
    const ext = extname(filePath);
    const timestamp = this.formatDate(new Date());

    return join(dir, `${base}.${timestamp}${ext}`);
  }

  /**
   * Format date for file naming
   */
  private formatDate(date: Date): string {
    const pattern = this.config.datePattern || 'YYYY-MM-DD';
    return pattern
      .replace('YYYY', date.getFullYear().toString())
      .replace('MM', (date.getMonth() + 1).toString().padStart(2, '0'))
      .replace('DD', date.getDate().toString().padStart(2, '0'))
      .replace('HH', date.getHours().toString().padStart(2, '0'))
      .replace('mm', date.getMinutes().toString().padStart(2, '0'))
      .replace('ss', date.getSeconds().toString().padStart(2, '0'));
  }

  /**
   * Get rotation interval in milliseconds
   */
  private getRotationInterval(): number {
    const { interval = 1, timeUnit = 'day' } = this.config;

    const units: Record<TimeUnit, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000, // Approximate
    };

    return interval * units[timeUnit];
  }

  /**
   * Perform atomic rotation
   */
  private async atomicRotate(sourcePath: string, targetPath: string): Promise<void> {
    const tempPath = `${targetPath}.tmp`;

    try {
      // Copy to temp file
      await pipeline(createReadStream(sourcePath), createWriteStream(tempPath));

      // Rename temp to target
      await rename(tempPath, targetPath);

      // Truncate original file
      await createWriteStream(sourcePath, { flags: 'w' }).end();
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Check if file is a log file
   */
  private isLogFile(fileName: string): boolean {
    const logExtensions = ['.log', '.log.gz', '.txt', '.txt.gz'];
    return logExtensions.some((ext) => fileName.endsWith(ext));
  }

  /**
   * Delete a file and trigger event
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
      this.metadata.delete(filePath);

      await this.triggerHooks({
        type: 'deletion',
        filePath,
        timestamp: new Date(),
      });
    } catch (error) {
      await this.triggerHooks({
        type: 'error',
        filePath,
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Trigger rotation hooks
   */
  private async triggerHooks(event: IRotationEvent): Promise<void> {
    for (const hook of this.hooks) {
      try {
        await hook(event);
      } catch {
        // Ignore hook errors
      }
    }
  }
}

/**
 * Create a log rotation manager
 */
export function createLogRotation(config: Partial<IRotationConfig>): LogRotation {
  return new LogRotation(config);
}

export default LogRotation;
