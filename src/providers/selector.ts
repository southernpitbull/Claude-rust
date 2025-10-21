/**
 * Provider Selector
 *
 * Dynamic provider selection with:
 * - Automatic failover
 * - Load balancing
 * - Cost optimization
 * - Health-based routing
 *
 * @module providers/selector
 */

import { EventEmitter } from 'events';
import {
  BaseProvider,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
  HealthStatus,
  ProviderError,
} from './types';

export interface SelectionCriteria {
  preferCost?: boolean;
  preferSpeed?: boolean;
  preferQuality?: boolean;
  requireFunctions?: boolean;
  requireVision?: boolean;
  requireStreaming?: boolean;
  maxCostPerRequest?: number;
  minContextWindow?: number;
}

export interface ProviderScore {
  provider: BaseProvider;
  score: number;
  health: HealthStatus;
  estimatedCost: number;
}

export class ProviderSelector extends EventEmitter {
  private providers: BaseProvider[] = [];
  private healthCache = new Map<string, HealthStatus>();
  private failureCount = new Map<string, number>();
  private lastUsed = new Map<string, number>();

  constructor(providers: BaseProvider[] = []) {
    super();
    this.providers = providers;
  }

  public addProvider(provider: BaseProvider): void {
    if (!this.providers.find((p) => p.getName() === provider.getName())) {
      this.providers.push(provider);
      this.emit('provider_added', { provider: provider.getName() });
    }
  }

  public removeProvider(providerName: string): boolean {
    const index = this.providers.findIndex((p) => p.getName() === providerName);
    if (index !== -1) {
      this.providers.splice(index, 1);
      this.healthCache.delete(providerName);
      this.failureCount.delete(providerName);
      this.lastUsed.delete(providerName);
      this.emit('provider_removed', { provider: providerName });
      return true;
    }
    return false;
  }

  public getProviders(): BaseProvider[] {
    return [...this.providers];
  }

  public async selectProvider(
    messages: Message[],
    options: CompletionOptions,
    criteria: SelectionCriteria = {}
  ): Promise<BaseProvider> {
    if (this.providers.length === 0) {
      throw new Error('No providers available');
    }

    const availableProviders = await this.getHealthyProviders();

    if (availableProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    const scoredProviders = await this.scoreProviders(
      availableProviders,
      messages,
      options,
      criteria
    );

    scoredProviders.sort((a, b) => b.score - a.score);

    const selected = scoredProviders[0];
    if (!selected) {
      throw new Error('No suitable provider found');
    }

    this.lastUsed.set(selected.provider.getName(), Date.now());
    this.emit('provider_selected', {
      provider: selected.provider.getName(),
      score: selected.score,
      criteria,
    });

    return selected.provider;
  }

  public async completeWithFailover(
    messages: Message[],
    options: CompletionOptions,
    criteria: SelectionCriteria = {}
  ): Promise<CompletionResponse> {
    const availableProviders = await this.getHealthyProviders();

    if (availableProviders.length === 0) {
      throw new Error('No healthy providers available');
    }

    const scoredProviders = await this.scoreProviders(
      availableProviders,
      messages,
      options,
      criteria
    );

    scoredProviders.sort((a, b) => b.score - a.score);

    let lastError: Error | undefined;

    for (const scored of scoredProviders) {
      try {
        this.emit('attempting_provider', { provider: scored.provider.getName() });
        const result = await scored.provider.complete(messages, options);
        this.markSuccess(scored.provider.getName());
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.markFailure(scored.provider.getName());
        this.emit('provider_failed', {
          provider: scored.provider.getName(),
          error: lastError.message,
        });

        if (error instanceof ProviderError && error.code === 'AUTHENTICATION') {
          continue;
        }

        if (scoredProviders.indexOf(scored) < scoredProviders.length - 1) {
          continue;
        }
      }
    }

    throw lastError || new Error('All providers failed');
  }

  public async *streamCompleteWithFailover(
    messages: Message[],
    options: CompletionOptions,
    criteria: SelectionCriteria = {}
  ): AsyncGenerator<StreamChunk, void, undefined> {
    const provider = await this.selectProvider(messages, options, criteria);

    try {
      for await (const chunk of provider.streamComplete(messages, options)) {
        yield chunk;
      }
      this.markSuccess(provider.getName());
    } catch (error) {
      this.markFailure(provider.getName());
      throw error;
    }
  }

  private async getHealthyProviders(): Promise<BaseProvider[]> {
    const healthChecks = await Promise.all(
      this.providers.map(async (provider) => {
        const health = await this.getHealthStatus(provider);
        return { provider, health };
      })
    );

    return healthChecks.filter(({ health }) => health.healthy).map(({ provider }) => provider);
  }

  private async getHealthStatus(provider: BaseProvider): Promise<HealthStatus> {
    const cached = this.healthCache.get(provider.getName());
    const now = Date.now();

    if (cached && now - cached.last_check < 60000) {
      return cached;
    }

    const failures = this.failureCount.get(provider.getName()) || 0;
    if (failures >= 3) {
      const backoffTime = Math.min(60000 * Math.pow(2, failures - 3), 300000);
      const lastUsedTime = this.lastUsed.get(provider.getName()) || 0;

      if (now - lastUsedTime < backoffTime) {
        return {
          healthy: false,
          latency_ms: 0,
          last_check: now,
          error: 'Circuit breaker open due to consecutive failures',
        };
      }
    }

    const health = await provider.getHealth();
    this.healthCache.set(provider.getName(), health);
    return health;
  }

  private async scoreProviders(
    providers: BaseProvider[],
    messages: Message[],
    options: CompletionOptions,
    criteria: SelectionCriteria
  ): Promise<ProviderScore[]> {
    const scores = await Promise.all(
      providers.map(async (provider) => {
        const health = await this.getHealthStatus(provider);
        const models = await provider.getModels();
        const model = models.find((m) => m.id === options.model) || models[0];

        let score = 100;

        if (!health.healthy) {
          score -= 50;
        } else {
          score -= health.latency_ms / 100;
        }

        const failures = this.failureCount.get(provider.getName()) || 0;
        score -= failures * 10;

        if (criteria.requireFunctions && !model?.supports_functions) {
          score -= 100;
        }
        if (criteria.requireVision && !model?.supports_vision) {
          score -= 100;
        }
        if (criteria.requireStreaming && !model?.supports_streaming) {
          score -= 100;
        }

        const estimatedTokens = this.estimateTokens(messages.map((m) => m.content).join(' '));
        const estimatedCost = this.estimateCost(model, estimatedTokens, options.max_tokens || 1000);

        if (criteria.maxCostPerRequest && estimatedCost > criteria.maxCostPerRequest) {
          score -= 100;
        }

        if (criteria.preferCost) {
          score += (1 - estimatedCost / 0.1) * 20;
        }

        if (criteria.preferSpeed) {
          score += (1000 - health.latency_ms) / 50;
        }

        if (criteria.preferQuality) {
          if (model?.id.includes('gpt-4') || model?.id.includes('claude-3-opus')) {
            score += 30;
          }
        }

        return { provider, score, health, estimatedCost };
      })
    );

    return scores;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateCost(
    model: ModelInfo | undefined,
    inputTokens: number,
    outputTokens: number
  ): number {
    if (!model?.pricing) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * model.pricing.input;
    const outputCost = (outputTokens / 1000) * model.pricing.output;

    return inputCost + outputCost;
  }

  private markSuccess(providerName: string): void {
    this.failureCount.set(providerName, 0);
  }

  private markFailure(providerName: string): void {
    const current = this.failureCount.get(providerName) || 0;
    this.failureCount.set(providerName, current + 1);
  }

  public getFailureCount(providerName: string): number {
    return this.failureCount.get(providerName) || 0;
  }

  public resetFailureCount(providerName: string): void {
    this.failureCount.set(providerName, 0);
  }

  public async getAllHealthStatuses(): Promise<Map<string, HealthStatus>> {
    const statuses = new Map<string, HealthStatus>();

    await Promise.all(
      this.providers.map(async (provider) => {
        const health = await this.getHealthStatus(provider);
        statuses.set(provider.getName(), health);
      })
    );

    return statuses;
  }
}
