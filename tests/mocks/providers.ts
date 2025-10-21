/**
 * Mock implementations for AI providers used in testing
 * These mocks allow tests to run without making actual API calls
 */

import { jest } from '@jest/globals';
import { BaseMessage } from '@langchain/core/messages';
import type {
  AIProvider,
  ProviderConfig,
} from '@providers/base';

/**
 * Mock response for AI provider calls
 */
export const mockProviderResponse = {
  content: 'This is a mocked AI response for testing purposes.',
  role: 'assistant' as const,
  additional_kwargs: {},
};

/**
 * Create a mock AI provider for testing
 */
export const createMockProvider = (
  name: string = 'MockProvider',
  model: string = 'mock-model-v1'
): jest.Mocked<AIProvider> => {
  return {
    name,
    model,
    chat: {
      invoke: jest.fn().mockResolvedValue(mockProviderResponse),
      stream: jest.fn(),
      batch: jest.fn(),
      call: jest.fn(),
      bind: jest.fn(),
    } as any,
    testConnection: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockResolvedValue(mockProviderResponse),
  };
};

/**
 * Mock OpenAI Provider
 */
export class MockOpenAIProvider {
  public name = 'OpenAI';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'gpt-4';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'OpenAI mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'OpenAI mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Anthropic Provider
 */
export class MockAnthropicProvider {
  public name = 'Anthropic';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'claude-3-sonnet-20240229';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Anthropic mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'Anthropic mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Google Gemini Provider
 */
export class MockGoogleProvider {
  public name = 'Google';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'gemini-pro';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Google Gemini mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'Google Gemini mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Ollama Provider
 */
export class MockOllamaProvider {
  public name = 'Ollama';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'llama2';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Ollama mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'Ollama mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Qwen Provider
 */
export class MockQwenProvider {
  public name = 'Qwen';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'qwen-max';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Qwen mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'Qwen mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Cloudflare Provider
 */
export class MockCloudflareProvider {
  public name = 'Cloudflare';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || '@cf/meta/llama-2-7b-chat-fp16';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'Cloudflare mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'Cloudflare mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock LMStudio Provider
 */
export class MockLMStudioProvider {
  public name = 'LMStudio';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'local-model';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'LMStudio mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'LMStudio mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock VLLM Provider
 */
export class MockVLLMProvider {
  public name = 'VLLM';
  public model: string;
  public chat: any;

  constructor(config: ProviderConfig) {
    this.model = config.model || 'vllm-model';
    this.chat = {
      invoke: jest.fn().mockResolvedValue({
        content: 'VLLM mock response',
        role: 'assistant',
      }),
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateResponse(messages: BaseMessage[], options?: any): Promise<any> {
    return {
      content: 'VLLM mock response',
      role: 'assistant',
    };
  }
}

/**
 * Mock Provider Manager
 */
export class MockProviderManager {
  private providers: Map<string, any>;
  private activeProvider: string | null;

  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }

  public registerProvider(provider: any): void {
    this.providers.set(provider.name.toLowerCase(), provider);
    if (this.providers.size === 1) {
      this.activeProvider = provider.name.toLowerCase();
    }
  }

  public getProvider(name: string): any {
    return this.providers.get(name.toLowerCase());
  }

  public getActiveProvider(): any {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  public setActiveProvider(name: string): boolean {
    const provider = this.providers.get(name.toLowerCase());
    if (provider) {
      this.activeProvider = name.toLowerCase();
      return true;
    }
    return false;
  }

  public getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  public async testAllProviders(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    for (const [name] of this.providers) {
      results.set(name, true);
    }
    return results;
  }

  public async initializeProviders(configs: ProviderConfig[]): Promise<void> {
    for (const config of configs) {
      const provider = createMockProvider(config.name, config.model);
      this.registerProvider(provider);
    }
  }

  public getProviderCount(): number {
    return this.providers.size;
  }
}

/**
 * Helper function to create mock provider configurations
 */
export const createMockProviderConfig = (
  overrides?: Partial<ProviderConfig>
): ProviderConfig => {
  return {
    name: 'MockProvider',
    model: 'mock-model-v1',
    apiKey: 'mock-api-key',
    baseURL: 'https://mock.api.com',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
    ...overrides,
  };
};

/**
 * Mock factory for creating different provider types
 */
export const mockProviderFactory = {
  openai: (config?: Partial<ProviderConfig>) =>
    new MockOpenAIProvider(createMockProviderConfig({ name: 'openai', ...config })),
  anthropic: (config?: Partial<ProviderConfig>) =>
    new MockAnthropicProvider(createMockProviderConfig({ name: 'anthropic', ...config })),
  google: (config?: Partial<ProviderConfig>) =>
    new MockGoogleProvider(createMockProviderConfig({ name: 'google', ...config })),
  ollama: (config?: Partial<ProviderConfig>) =>
    new MockOllamaProvider(createMockProviderConfig({ name: 'ollama', ...config })),
  qwen: (config?: Partial<ProviderConfig>) =>
    new MockQwenProvider(createMockProviderConfig({ name: 'qwen', ...config })),
  cloudflare: (config?: Partial<ProviderConfig>) =>
    new MockCloudflareProvider(createMockProviderConfig({ name: 'cloudflare', ...config })),
  lmstudio: (config?: Partial<ProviderConfig>) =>
    new MockLMStudioProvider(createMockProviderConfig({ name: 'lmstudio', ...config })),
  vllm: (config?: Partial<ProviderConfig>) =>
    new MockVLLMProvider(createMockProviderConfig({ name: 'vllm', ...config })),
};

/**
 * Setup function for tests that need mocked providers
 */
export const setupMockProviders = (): MockProviderManager => {
  const manager = new MockProviderManager();

  // Register common providers
  manager.registerProvider(mockProviderFactory.openai());
  manager.registerProvider(mockProviderFactory.anthropic());
  manager.registerProvider(mockProviderFactory.google());

  return manager;
};
