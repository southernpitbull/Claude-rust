/**
 * Cost Tracker
 *
 * Track and manage API costs with:
 * - Per-provider cost tracking
 * - Budget management
 * - Cost alerts
 * - Historical cost data
 *
 * @module providers/cost-tracker
 */

import { EventEmitter } from 'events';
import { TokenUsage, ModelInfo, ProviderType } from './types';

export interface CostEntry {
  id: string;
  provider: string;
  model: string;
  timestamp: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface BudgetConfig {
  daily?: number;
  weekly?: number;
  monthly?: number;
  total?: number;
  currency: string;
}

export interface CostSummary {
  total_cost: number;
  total_tokens: number;
  total_requests: number;
  by_provider: Map<string, ProviderCostSummary>;
  by_model: Map<string, ModelCostSummary>;
  currency: string;
}

export interface ProviderCostSummary {
  provider: string;
  total_cost: number;
  total_tokens: number;
  total_requests: number;
}

export interface ModelCostSummary {
  model: string;
  total_cost: number;
  total_tokens: number;
  total_requests: number;
}

export class CostTracker extends EventEmitter {
  private entries: CostEntry[] = [];
  private budget: BudgetConfig | null = null;
  private alertThresholds = new Map<string, number>();

  constructor(budget?: BudgetConfig) {
    super();
    if (budget) {
      this.budget = budget;
    }
  }

  public trackCost(
    provider: string,
    model: string,
    usage: TokenUsage,
    pricing: ModelInfo['pricing'],
    metadata?: Record<string, unknown>
  ): CostEntry {
    if (!pricing) {
      throw new Error('Pricing information required to track costs');
    }

    const inputCost = (usage.prompt_tokens / 1000) * pricing.input;
    const outputCost = (usage.completion_tokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    const entry: CostEntry = {
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider,
      model,
      timestamp: Date.now(),
      input_tokens: usage.prompt_tokens,
      output_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      input_cost: inputCost,
      output_cost: outputCost,
      total_cost: totalCost,
      currency: pricing.currency,
      metadata,
    };

    this.entries.push(entry);

    this.emit('cost_tracked', entry);

    this.checkBudgetAlerts();

    return entry;
  }

  public getSummary(startTime?: number, endTime?: number): CostSummary {
    const now = Date.now();
    const start = startTime || 0;
    const end = endTime || now;

    const filteredEntries = this.entries.filter((e) => e.timestamp >= start && e.timestamp <= end);

    const byProvider = new Map<string, ProviderCostSummary>();
    const byModel = new Map<string, ModelCostSummary>();

    let totalCost = 0;
    let totalTokens = 0;
    const totalRequests = filteredEntries.length;
    let currency = 'USD';

    for (const entry of filteredEntries) {
      totalCost += entry.total_cost;
      totalTokens += entry.total_tokens;
      currency = entry.currency;

      const providerSummary = byProvider.get(entry.provider) || {
        provider: entry.provider,
        total_cost: 0,
        total_tokens: 0,
        total_requests: 0,
      };
      providerSummary.total_cost += entry.total_cost;
      providerSummary.total_tokens += entry.total_tokens;
      providerSummary.total_requests += 1;
      byProvider.set(entry.provider, providerSummary);

      const modelSummary = byModel.get(entry.model) || {
        model: entry.model,
        total_cost: 0,
        total_tokens: 0,
        total_requests: 0,
      };
      modelSummary.total_cost += entry.total_cost;
      modelSummary.total_tokens += entry.total_tokens;
      modelSummary.total_requests += 1;
      byModel.set(entry.model, modelSummary);
    }

    return {
      total_cost: totalCost,
      total_tokens: totalTokens,
      total_requests: totalRequests,
      by_provider: byProvider,
      by_model: byModel,
      currency,
    };
  }

  public getDailySummary(): CostSummary {
    const now = Date.now();
    const dayStart = now - (now % 86400000);
    return this.getSummary(dayStart, now);
  }

  public getWeeklySummary(): CostSummary {
    const now = Date.now();
    const weekStart = now - 7 * 86400000;
    return this.getSummary(weekStart, now);
  }

  public getMonthlySummary(): CostSummary {
    const now = Date.now();
    const monthStart = now - 30 * 86400000;
    return this.getSummary(monthStart, now);
  }

  public setBudget(budget: BudgetConfig): void {
    this.budget = budget;
    this.emit('budget_set', budget);
    this.checkBudgetAlerts();
  }

  public getBudget(): BudgetConfig | null {
    return this.budget ? { ...this.budget } : null;
  }

  public setAlertThreshold(period: 'daily' | 'weekly' | 'monthly', percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Alert threshold must be between 0 and 100');
    }
    this.alertThresholds.set(period, percentage);
  }

  private checkBudgetAlerts(): void {
    if (!this.budget) {
      return;
    }

    const dailySummary = this.getDailySummary();
    const weeklySummary = this.getWeeklySummary();
    const monthlySummary = this.getMonthlySummary();
    const totalSummary = this.getSummary();

    this.checkPeriodAlert('daily', dailySummary.total_cost, this.budget.daily);
    this.checkPeriodAlert('weekly', weeklySummary.total_cost, this.budget.weekly);
    this.checkPeriodAlert('monthly', monthlySummary.total_cost, this.budget.monthly);
    this.checkPeriodAlert('total', totalSummary.total_cost, this.budget.total);
  }

  private checkPeriodAlert(period: string, currentCost: number, budgetLimit?: number): void {
    if (!budgetLimit) {
      return;
    }

    const percentage = (currentCost / budgetLimit) * 100;
    const threshold = this.alertThresholds.get(period) || 80;

    if (percentage >= 100) {
      this.emit('budget_exceeded', {
        period,
        current: currentCost,
        limit: budgetLimit,
        percentage,
      });
    } else if (percentage >= threshold) {
      this.emit('budget_warning', {
        period,
        current: currentCost,
        limit: budgetLimit,
        percentage,
        threshold,
      });
    }
  }

  public estimateCost(model: ModelInfo, inputTokens: number, outputTokens: number): number {
    if (!model.pricing) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * model.pricing.input;
    const outputCost = (outputTokens / 1000) * model.pricing.output;

    return inputCost + outputCost;
  }

  public canAfford(estimatedCost: number): boolean {
    if (!this.budget) {
      return true;
    }

    const dailySummary = this.getDailySummary();
    const monthlySummary = this.getMonthlySummary();

    if (this.budget.daily && dailySummary.total_cost + estimatedCost > this.budget.daily) {
      return false;
    }

    if (this.budget.monthly && monthlySummary.total_cost + estimatedCost > this.budget.monthly) {
      return false;
    }

    if (this.budget.total) {
      const totalSummary = this.getSummary();
      if (totalSummary.total_cost + estimatedCost > this.budget.total) {
        return false;
      }
    }

    return true;
  }

  public getEntries(startTime?: number, endTime?: number): CostEntry[] {
    const now = Date.now();
    const start = startTime || 0;
    const end = endTime || now;

    return this.entries.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const header =
        'timestamp,provider,model,input_tokens,output_tokens,total_tokens,input_cost,output_cost,total_cost,currency\n';
      const rows = this.entries
        .map((e) =>
          [
            new Date(e.timestamp).toISOString(),
            e.provider,
            e.model,
            e.input_tokens,
            e.output_tokens,
            e.total_tokens,
            e.input_cost.toFixed(6),
            e.output_cost.toFixed(6),
            e.total_cost.toFixed(6),
            e.currency,
          ].join(',')
        )
        .join('\n');
      return header + rows;
    }

    return JSON.stringify(this.entries, null, 2);
  }

  public clearData(beforeTimestamp?: number): number {
    const before = beforeTimestamp || Date.now();
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => e.timestamp >= before);
    const removed = initialLength - this.entries.length;

    if (removed > 0) {
      this.emit('data_cleared', { removed, before });
    }

    return removed;
  }
}
