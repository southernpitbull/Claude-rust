/**
 * Base Provider Implementation
 *
 * Abstract base class for all AI providers with comprehensive support for:
 * - Streaming responses
 * - Rate limiting
 * - Health monitoring
 * - Retry logic with exponential backoff
 * - Event emission
 *
 * @module providers/provider-base
 */

import { EventEmitter } from 'events';
import {
  ProviderConfig,
  ProviderType,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
  HealthStatus,
  RateLimitInfo,
  InvalidRequestError,
  RateLimitError,
  ServiceUnavailableError,
} from './types';

/**
 * Base provider abstract class
 *
 * All providers must extend this class to ensure consistent behavior
 * across different AI service providers.
 */
export abstract class BaseProvider extends EventEmitter {
  protected config: ProviderConfig;
  protected lastHealthCheck: HealthStatus | null = null;
  protected requestCount = 0;
  protected tokenCount = 0;
  protected lastResetTime = Date.now();

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.validateConfig(config);
  }

  /**
   * Validate provider configuration
   */
  protected validateConfig(config: ProviderConfig): void {
    if (!config.name) {
      throw new InvalidRequestError('Provider name is required');
    }
    if (!config.type) {
      throw new InvalidRequestError('Provider type is required');
    }
  }

  /**
   * Get provider type
   */
  public getType(): ProviderType {
    return this.config.type;
  }

  /**
   * Get provider name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get provider configuration (cloned to prevent mutation)
   */
  public getConfig(): ProviderConfig {
    return { ...this.config };
  }

  /**
   * Test connection to provider
   */
  public abstract testConnection(): Promise<boolean>;

  /**
   * Complete a chat request
   */
  public abstract complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse>;

  /**
   * Stream a chat request
   */
  public abstract streamComplete(
    messages: Message[],
    options: CompletionOptions
  ): AsyncGenerator<StreamChunk, void, undefined>;

  /**
   * Get available models
   */
  public abstract getModels(): Promise<ModelInfo[]>;

  /**
   * Get health status
   */
  public async getHealth(): Promise<HealthStatus> {
    const startTime = Date.now();
    try {
      const isHealthy = await this.testConnection();
      const latency = Date.now() - startTime;

      this.lastHealthCheck = {
        healthy: isHealthy,
        latency_ms: latency,
        last_check: Date.now(),
      };

      return this.lastHealthCheck;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.lastHealthCheck = {
        healthy: false,
        latency_ms: latency,
        last_check: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return this.lastHealthCheck;
    }
  }

  /**
   * Get current rate limit status
   */
  public getRateLimitStatus(): RateLimitInfo {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counters every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastResetTime = now;
    }

    const rpm = this.config.rate_limit?.requests_per_minute ?? 60;
    const tpm = this.config.rate_limit?.tokens_per_minute ?? 90000;

    return {
      requests_per_minute: rpm,
      tokens_per_minute: tpm,
      requests_remaining: Math.max(0, rpm - this.requestCount),
      tokens_remaining: Math.max(0, tpm - this.tokenCount),
      reset_at: this.lastResetTime + 60000,
    };
  }

  /**
   * Check if request would exceed rate limits
   */
  protected checkRateLimit(estimatedTokens: number): void {
    const status = this.getRateLimitStatus();

    if (status.requests_remaining <= 0) {
      throw new RateLimitError('Request rate limit exceeded', status.reset_at);
    }

    if (status.tokens_remaining < estimatedTokens) {
      throw new RateLimitError('Token rate limit exceeded', status.reset_at);
    }
  }

  /**
   * Update rate limit counters
   */
  protected updateRateLimitCounters(tokens: number): void {
    this.requestCount += 1;
    this.tokenCount += tokens;
  }

  /**
   * Retry with exponential backoff
   */
  protected async retryWithBackoff<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> {
    const retries = maxRetries ?? this.config.max_retries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on rate limits or service unavailable errors
        if (error instanceof RateLimitError || error instanceof ServiceUnavailableError) {
          if (attempt < retries) {
            // Exponential backoff: 1s, 2s, 4s, up to max 10s
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        // Don't retry on other errors
        throw error;
      }
    }

    throw lastError ?? new Error('Max retries exceeded');
  }

  /**
   * Estimate token count for text (rough approximation)
   * Uses 4 characters ≈ 1 token heuristic
   */
  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Emit provider event
   */
  protected emitEvent(event: string, data?: unknown): void {
    this.emit(event, {
      provider: this.getName(),
      type: this.getType(),
      timestamp: Date.now(),
      data,
    });
  }
}
