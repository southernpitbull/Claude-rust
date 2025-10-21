/**
 * Remote Logger - Remote logging support with HTTP/WebSocket transports
 * Provides batch sending, retry logic, queue management, and compression
 */

import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import type { ILogEntry } from './types.js';

const gzipAsync = promisify(gzip);

/**
 * Transport protocol
 */
export type TransportProtocol = 'http' | 'https' | 'websocket' | 'tcp' | 'udp';

/**
 * Remote logger configuration
 */
export interface IRemoteLoggerConfig {
  /** Endpoint URL */
  endpoint: string;

  /** Transport protocol */
  protocol: TransportProtocol;

  /** Authentication token */
  authToken?: string;

  /** API key */
  apiKey?: string;

  /** Enable batch sending */
  batch: boolean;

  /** Batch size */
  batchSize?: number;

  /** Batch interval in milliseconds */
  batchIntervalMs?: number;

  /** Enable compression */
  compress: boolean;

  /** Enable retry */
  retry: boolean;

  /** Max retry attempts */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelayMs?: number;

  /** Exponential backoff */
  exponentialBackoff?: boolean;

  /** Queue size limit */
  maxQueueSize?: number;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Custom headers */
  headers?: Record<string, string>;

  /** Enable TLS */
  tls?: boolean;

  /** File fallback path */
  fallbackPath?: string;
}

/**
 * Send status
 */
export type SendStatus = 'pending' | 'sending' | 'success' | 'failed' | 'retrying';

/**
 * Send result
 */
export interface ISendResult {
  /** Success flag */
  success: boolean;

  /** Status */
  status: SendStatus;

  /** Response code */
  statusCode?: number;

  /** Error if failed */
  error?: Error;

  /** Retry count */
  retryCount: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Queue item
 */
interface IQueueItem {
  id: string;
  entry: ILogEntry;
  retryCount: number;
  addedAt: Date;
}

/**
 * Remote Logger implementation
 */
export class RemoteLogger {
  private readonly config: Required<IRemoteLoggerConfig>;
  private readonly queue: IQueueItem[];
  private batchTimer?: NodeJS.Timeout;
  private isSending = false;
  private sendStats = {
    sent: 0,
    failed: 0,
    retried: 0,
    dropped: 0,
  };

  constructor(config: IRemoteLoggerConfig) {
    this.config = {
      endpoint: config.endpoint,
      protocol: config.protocol || 'https',
      authToken: config.authToken,
      apiKey: config.apiKey,
      batch: config.batch ?? true,
      batchSize: config.batchSize || 100,
      batchIntervalMs: config.batchIntervalMs || 5000,
      compress: config.compress ?? true,
      retry: config.retry ?? true,
      maxRetries: config.maxRetries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
      exponentialBackoff: config.exponentialBackoff ?? true,
      maxQueueSize: config.maxQueueSize || 10000,
      timeoutMs: config.timeoutMs || 30000,
      headers: config.headers || {},
      tls: config.tls ?? true,
      fallbackPath: config.fallbackPath,
    };

    this.queue = [];
  }

  /**
   * Send a log entry
   */
  public async send(entry: ILogEntry): Promise<ISendResult> {
    // Add to queue
    const item: IQueueItem = {
      id: `${Date.now()}-${Math.random()}`,
      entry,
      retryCount: 0,
      addedAt: new Date(),
    };

    // Check queue size
    if (this.queue.length >= this.config.maxQueueSize) {
      this.sendStats.dropped++;
      return {
        success: false,
        status: 'failed',
        error: new Error('Queue full'),
        retryCount: 0,
        timestamp: new Date(),
      };
    }

    this.queue.push(item);

    // Send immediately if not batching
    if (!this.config.batch) {
      return this.sendImmediately(item);
    }

    // Start batch timer if not already running
    if (!this.batchTimer) {
      this.startBatchTimer();
    }

    // Send batch if size reached
    if (this.queue.length >= this.config.batchSize) {
      await this.sendBatch();
    }

    return {
      success: true,
      status: 'pending',
      retryCount: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Send multiple entries
   */
  public async sendBatch(): Promise<ISendResult> {
    if (this.isSending || this.queue.length === 0) {
      return {
        success: true,
        status: 'success',
        retryCount: 0,
        timestamp: new Date(),
      };
    }

    this.isSending = true;

    try {
      // Get batch
      const batch = this.queue.splice(0, this.config.batchSize);
      const entries = batch.map((item) => item.entry);

      // Prepare payload
      let payload: string | Buffer = JSON.stringify(entries);

      // Compress if enabled
      if (this.config.compress) {
        payload = await gzipAsync(payload);
      }

      // Send to remote
      const result = await this.sendToRemote(payload);

      if (result.success) {
        this.sendStats.sent += entries.length;
      } else {
        // Re-queue failed items for retry
        for (const item of batch) {
          if (this.config.retry && item.retryCount < this.config.maxRetries) {
            item.retryCount++;
            this.queue.push(item);
            this.sendStats.retried++;
          } else {
            this.sendStats.failed++;
            // Fallback to file if configured
            if (this.config.fallbackPath) {
              await this.writeToFallback(item.entry);
            }
          }
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        retryCount: 0,
        timestamp: new Date(),
      };
    } finally {
      this.isSending = false;
    }
  }

  /**
   * Flush all pending logs
   */
  public async flush(): Promise<void> {
    this.stopBatchTimer();

    while (this.queue.length > 0) {
      await this.sendBatch();
      // Add small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get send statistics
   */
  public getStats(): typeof this.sendStats {
    return { ...this.sendStats };
  }

  /**
   * Clear queue
   */
  public clear(): void {
    this.queue.length = 0;
    this.stopBatchTimer();
  }

  /**
   * Send immediately without queuing
   */
  private async sendImmediately(item: IQueueItem): Promise<ISendResult> {
    try {
      let payload: string | Buffer = JSON.stringify(item.entry);

      if (this.config.compress) {
        payload = await gzipAsync(payload);
      }

      const result = await this.sendToRemote(payload);

      if (result.success) {
        this.sendStats.sent++;
      } else {
        this.sendStats.failed++;
        if (this.config.fallbackPath) {
          await this.writeToFallback(item.entry);
        }
      }

      return result;
    } catch (error) {
      this.sendStats.failed++;
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
        retryCount: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Send to remote endpoint
   */
  private async sendToRemote(payload: string | Buffer): Promise<ISendResult> {
    const result: ISendResult = {
      success: false,
      status: 'sending',
      retryCount: 0,
      timestamp: new Date(),
    };

    let attempt = 0;
    while (attempt <= this.config.maxRetries) {
      try {
        const response = await this.performHttpRequest(payload);

        if (response.ok) {
          result.success = true;
          result.status = 'success';
          result.statusCode = response.status;
          return result;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        result.error = error instanceof Error ? error : new Error(String(error));
        result.retryCount = attempt;

        if (attempt < this.config.maxRetries && this.config.retry) {
          result.status = 'retrying';
          const delay = this.calculateRetryDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
        } else {
          result.status = 'failed';
          return result;
        }
      }
    }

    result.status = 'failed';
    return result;
  }

  /**
   * Perform HTTP request
   */
  private async performHttpRequest(payload: string | Buffer): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': this.config.compress ? 'application/json+gzip' : 'application/json',
      ...this.config.headers,
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelayMs;
    }

    return this.config.retryDelayMs * Math.pow(2, attempt);
  }

  /**
   * Write to fallback file
   */
  private async writeToFallback(entry: ILogEntry): Promise<void> {
    if (!this.config.fallbackPath) {
      return;
    }

    try {
      const { appendFile } = await import('node:fs/promises');
      const line = JSON.stringify(entry) + '\n';
      await appendFile(this.config.fallbackPath, line, 'utf8');
    } catch {
      // Ignore fallback errors
    }
  }

  /**
   * Start batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      void this.sendBatch();
    }, this.config.batchIntervalMs);
  }

  /**
   * Stop batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }
  }
}

/**
 * Create a remote logger
 */
export function createRemoteLogger(config: IRemoteLoggerConfig): RemoteLogger {
  return new RemoteLogger(config);
}

export default RemoteLogger;
