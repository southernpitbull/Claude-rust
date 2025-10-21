/**
 * Provider Base Tests
 *
 * Comprehensive test suite for base provider functionality.
 */

import { BaseProvider } from '../../src/providers/provider-base';
import {
  ProviderConfig,
  ProviderType,
  Message,
  MessageRole,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
  RateLimitError,
  InvalidRequestError,
} from '../../src/providers/types';

class MockProvider extends BaseProvider {
  public async testConnection(): Promise<boolean> {
    return true;
  }

  public async complete(messages: Message[], options: CompletionOptions): Promise<CompletionResponse> {
    this.checkRateLimit(100);
    this.updateRateLimitCounters(100);

    return {
      id: 'test-123',
      model: options.model,
      content: 'Test response',
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 50,
        completion_tokens: 50,
        total_tokens: 100,
      },
      created_at: Date.now(),
    };
  }

  public async *streamComplete(): AsyncGenerator<StreamChunk, void, undefined> {
    yield {
      id: 'stream-123',
      model: 'test-model',
      delta: { content: 'Test' },
      finish_reason: null,
    };
  }

  public async getModels(): Promise<ModelInfo[]> {
    return [
      {
        id: 'test-model',
        name: 'Test Model',
        context_window: 4096,
        max_output_tokens: 2048,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
      },
    ];
  }
}

describe('BaseProvider', () => {
  let provider: MockProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    config = {
      name: 'test-provider',
      type: ProviderType.OPENAI,
      api_key: 'test-key',
      rate_limit: {
        requests_per_minute: 60,
        tokens_per_minute: 90000,
      },
    };

    provider = new MockProvider(config);
  });

  describe('Configuration', () => {
    it('should validate required config fields', () => {
      expect(() => {
        new MockProvider({} as ProviderConfig);
      }).toThrow(InvalidRequestError);
    });

    it('should return provider type', () => {
      expect(provider.getType()).toBe(ProviderType.OPENAI);
    });

    it('should return provider name', () => {
      expect(provider.getName()).toBe('test-provider');
    });

    it('should return cloned config', () => {
      const retrievedConfig = provider.getConfig();
      expect(retrievedConfig).toEqual(config);
      expect(retrievedConfig).not.toBe(config);
    });
  });

  describe('Health Monitoring', () => {
    it('should check health successfully', async () => {
      const health = await provider.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.latency_ms).toBeGreaterThanOrEqual(0);
      expect(health.last_check).toBeGreaterThan(0);
    });

    it('should cache health status', async () => {
      const health1 = await provider.getHealth();
      const health2 = await provider.getHealth();

      expect(health1.last_check).toBeLessThanOrEqual(health2.last_check);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limit status', () => {
      const status = provider.getRateLimitStatus();

      expect(status.requests_per_minute).toBe(60);
      expect(status.tokens_per_minute).toBe(90000);
      expect(status.requests_remaining).toBe(60);
      expect(status.tokens_remaining).toBe(90000);
    });

    it('should enforce rate limits', async () => {
      const messages: Message[] = [
        { role: MessageRole.USER, content: 'test' },
      ];
      const options: CompletionOptions = { model: 'test-model' };

      for (let i = 0; i < 60; i++) {
        await provider.complete(messages, options);
      }

      await expect(provider.complete(messages, options)).rejects.toThrow(RateLimitError);
    });

    it('should reset rate limits after time window', async () => {
      jest.useFakeTimers();

      const messages: Message[] = [{ role: MessageRole.USER, content: 'test' }];
      const options: CompletionOptions = { model: 'test-model' };

      await provider.complete(messages, options);

      jest.advanceTimersByTime(61000);

      const status = provider.getRateLimitStatus();
      expect(status.requests_remaining).toBe(60);

      jest.useRealTimers();
    });
  });

  describe('Event Emission', () => {
    it('should emit events', (done) => {
      provider.on('test_event', (data) => {
        expect(data.provider).toBe('test-provider');
        expect(data.type).toBe(ProviderType.OPENAI);
        expect(data.timestamp).toBeGreaterThan(0);
        done();
      });

      provider['emitEvent']('test_event', { test: 'data' });
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test message';
      const estimated = provider['estimateTokens'](text);

      expect(estimated).toBeGreaterThan(0);
      expect(estimated).toBe(Math.ceil(text.length / 4));
    });
  });

  describe('Retry Logic', () => {
    it('should retry on rate limit errors', async () => {
      jest.useFakeTimers();

      let attemptCount = 0;
      const testFn = async (): Promise<string> => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new RateLimitError('Rate limited', Date.now() + 1000);
        }
        return 'success';
      };

      const promise = provider['retryWithBackoff'](testFn);

      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(2000);
      }

      const result = await promise;

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);

      jest.useRealTimers();
    });

    it('should not retry on authentication errors', async () => {
      let attemptCount = 0;
      const testFn = async (): Promise<string> => {
        attemptCount++;
        throw new InvalidRequestError('Invalid request');
      };

      await expect(provider['retryWithBackoff'](testFn)).rejects.toThrow(InvalidRequestError);
      expect(attemptCount).toBe(1);
    });
  });
});
