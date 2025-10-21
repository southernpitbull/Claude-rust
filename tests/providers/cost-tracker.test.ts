/**
 * Cost Tracker Tests
 *
 * Comprehensive test suite for cost tracking functionality.
 */

import { CostTracker, BudgetConfig } from '../../src/providers/cost-tracker';
import { TokenUsage, ModelInfo } from '../../src/providers/types';

describe('CostTracker', () => {
  let tracker: CostTracker;
  const mockPricing: ModelInfo['pricing'] = {
    input: 0.03,
    output: 0.06,
    currency: 'USD',
  };

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('Cost Tracking', () => {
    it('should track cost correctly', () => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      const entry = tracker.trackCost('openai', 'gpt-4', usage, mockPricing);

      expect(entry.provider).toBe('openai');
      expect(entry.model).toBe('gpt-4');
      expect(entry.input_tokens).toBe(1000);
      expect(entry.output_tokens).toBe(500);
      expect(entry.total_tokens).toBe(1500);
      expect(entry.input_cost).toBeCloseTo(0.03, 2);
      expect(entry.output_cost).toBeCloseTo(0.03, 2);
      expect(entry.total_cost).toBeCloseTo(0.06, 2);
    });

    it('should throw error when pricing is missing', () => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      expect(() => {
        tracker.trackCost('openai', 'gpt-4', usage, undefined);
      }).toThrow('Pricing information required');
    });
  });

  describe('Cost Summary', () => {
    beforeEach(() => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);
      tracker.trackCost('openai', 'gpt-3.5-turbo', usage, {
        input: 0.0005,
        output: 0.0015,
        currency: 'USD',
      });
      tracker.trackCost('anthropic', 'claude-3-sonnet', usage, {
        input: 0.003,
        output: 0.015,
        currency: 'USD',
      });
    });

    it('should generate summary correctly', () => {
      const summary = tracker.getSummary();

      expect(summary.total_requests).toBe(3);
      expect(summary.total_tokens).toBe(4500);
      expect(summary.total_cost).toBeGreaterThan(0);
      expect(summary.currency).toBe('USD');
    });

    it('should summarize by provider', () => {
      const summary = tracker.getSummary();

      const openaiSummary = summary.by_provider.get('openai');
      expect(openaiSummary).toBeDefined();
      expect(openaiSummary?.total_requests).toBe(2);

      const anthropicSummary = summary.by_provider.get('anthropic');
      expect(anthropicSummary).toBeDefined();
      expect(anthropicSummary?.total_requests).toBe(1);
    });

    it('should summarize by model', () => {
      const summary = tracker.getSummary();

      const gpt4Summary = summary.by_model.get('gpt-4');
      expect(gpt4Summary).toBeDefined();
      expect(gpt4Summary?.total_requests).toBe(1);
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const summary = tracker.getSummary(now - 10000, now + 10000);

      expect(summary.total_requests).toBe(3);
    });
  });

  describe('Budget Management', () => {
    it('should set and get budget', () => {
      const budget: BudgetConfig = {
        daily: 10,
        monthly: 300,
        currency: 'USD',
      };

      tracker.setBudget(budget);
      const retrievedBudget = tracker.getBudget();

      expect(retrievedBudget).toEqual(budget);
    });

    it('should emit budget warning', (done) => {
      const budget: BudgetConfig = {
        daily: 1,
        currency: 'USD',
      };

      tracker.setBudget(budget);
      tracker.setAlertThreshold('daily', 50);

      tracker.on('budget_warning', (data) => {
        expect(data.period).toBe('daily');
        expect(data.percentage).toBeGreaterThan(50);
        done();
      });

      const usage: TokenUsage = {
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);
    });

    it('should emit budget exceeded', (done) => {
      const budget: BudgetConfig = {
        daily: 0.05,
        currency: 'USD',
      };

      tracker.setBudget(budget);

      tracker.on('budget_exceeded', (data) => {
        expect(data.period).toBe('daily');
        expect(data.percentage).toBeGreaterThanOrEqual(100);
        done();
      });

      const usage: TokenUsage = {
        prompt_tokens: 10000,
        completion_tokens: 5000,
        total_tokens: 15000,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);
    });
  });

  describe('Cost Estimation', () => {
    it('should estimate cost correctly', () => {
      const model: ModelInfo = {
        id: 'gpt-4',
        name: 'GPT-4',
        context_window: 8192,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: mockPricing,
      };

      const estimated = tracker.estimateCost(model, 1000, 500);

      expect(estimated).toBeCloseTo(0.06, 2);
    });

    it('should return 0 for models without pricing', () => {
      const model: ModelInfo = {
        id: 'test-model',
        name: 'Test Model',
        context_window: 4096,
        max_output_tokens: 2048,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: false,
      };

      const estimated = tracker.estimateCost(model, 1000, 500);

      expect(estimated).toBe(0);
    });
  });

  describe('Affordability Check', () => {
    it('should check if cost is affordable within budget', () => {
      const budget: BudgetConfig = {
        daily: 10,
        currency: 'USD',
      };

      tracker.setBudget(budget);

      expect(tracker.canAfford(5)).toBe(true);
      expect(tracker.canAfford(15)).toBe(false);
    });

    it('should always afford when no budget is set', () => {
      expect(tracker.canAfford(1000)).toBe(true);
    });
  });

  describe('Data Export', () => {
    beforeEach(() => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);
    });

    it('should export as JSON', () => {
      const exported = tracker.exportData('json');
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0]).toHaveProperty('provider', 'openai');
    });

    it('should export as CSV', () => {
      const exported = tracker.exportData('csv');

      expect(exported).toContain('timestamp,provider,model');
      expect(exported).toContain('openai,gpt-4');
    });
  });

  describe('Data Management', () => {
    it('should clear old data', () => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);

      const futureTimestamp = Date.now() + 10000;
      const removed = tracker.clearData(futureTimestamp);

      expect(removed).toBe(1);
      expect(tracker.getEntries().length).toBe(0);
    });

    it('should emit event when data is cleared', (done) => {
      const usage: TokenUsage = {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      };

      tracker.trackCost('openai', 'gpt-4', usage, mockPricing);

      tracker.on('data_cleared', (data) => {
        expect(data.removed).toBe(1);
        done();
      });

      tracker.clearData(Date.now() + 10000);
    });
  });
});
