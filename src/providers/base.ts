import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Interface for AI provider configuration
 */
export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseURL?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

/**
 * Interface for AI provider implementations
 */
export interface AIProvider {
  name: string;
  model: string;
  chat: BaseChatModel;
  testConnection(): Promise<boolean>;
  generateResponse(messages: BaseMessage[], options?: any): Promise<any>;
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'OpenAI';
    this.model = config.model || 'gpt-4';
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL,
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('OpenAI generation error:', error);
      throw error;
    }
  }
}

/**
 * Anthropic Provider Implementation
 */
export class AnthropicProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatAnthropic;

  constructor(config: ProviderConfig) {
    this.name = 'Anthropic';
    this.model = config.model || 'claude-3-sonnet-20240229';
    this.chat = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL,
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Anthropic generation error:', error);
      throw error;
    }
  }
}

/**
 * Google Gemini Provider Implementation
 */
export class GeminiProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatGoogleGenerativeAI;

  constructor(config: ProviderConfig) {
    this.name = 'Google';
    this.model = config.model || 'gemini-pro';
    this.chat = new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxOutputTokens: config.maxTokens,
      timeout: config.timeout,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Google Gemini connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Google Gemini generation error:', error);
      throw error;
    }
  }
}

/**
 * Ollama Provider Implementation
 */
export class OllamaProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOllama;

  constructor(config: ProviderConfig) {
    this.name = 'Ollama';
    this.model = config.model || 'llama2';
    this.chat = new ChatOllama({
      baseUrl: config.baseURL || 'http://localhost:11434',
      model: this.model,
      temperature: config.temperature || 0.7,
      numCtx: config.maxTokens,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Ollama generation error:', error);
      throw error;
    }
  }
}

/**
 * Qwen Provider Implementation (using OpenAI-compatible interface)
 */
export class QwenProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'Qwen';
    this.model = config.model || 'qwen-max';

    // Qwen is OpenAI-compatible, so we use the OpenAI adapter
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1', // Alibaba Cloud API
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Qwen connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Qwen generation error:', error);
      throw error;
    }
  }
}

/**
 * Cloudflare Provider Implementation (using OpenAI-compatible interface)
 */
export class CloudflareProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'Cloudflare';
    this.model = config.model || '@cf/meta/llama-2-7b-chat-fp16';

    // Using OpenAI-compatible interface for Cloudflare Workers AI
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey, // For Cloudflare, this would be the API token
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL:
          config.baseURL || 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1', // This would need to be configured properly
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Cloudflare connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Cloudflare generation error:', error);
      throw error;
    }
  }
}

/**
 * Provider manager to handle multiple AI providers
 */
export class ProviderManager {
  private providers: Map<string, AIProvider>;
  private activeProvider: string | null;

  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }

  /**
   * Registers a new provider
   */
  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);

    // If this is the first provider, set it as active
    if (this.providers.size === 1) {
      this.activeProvider = provider.name.toLowerCase();
    }
  }

  /**
   * Gets a registered provider by name
   */
  public getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * Gets the currently active provider
   */
  public getActiveProvider(): AIProvider | null {
    if (!this.activeProvider) {
      return null;
    }
    return this.providers.get(this.activeProvider) || null;
  }

  /**
   * Sets the active provider
   */
  public setActiveProvider(name: string): boolean {
    const provider = this.providers.get(name.toLowerCase());
    if (provider) {
      this.activeProvider = name.toLowerCase();
      return true;
    }
    return false;
  }

  /**
   * Gets a list of all registered provider names
   */
  public getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Tests all registered providers
   */
  public async testAllProviders(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, provider] of this.providers) {
      try {
        const isConnected = await provider.testConnection();
        results.set(name, isConnected);
      } catch (error) {
        results.set(name, false);
      }
    }

    return results;
  }

  /**
   * Creates and registers providers from configuration
   */
  public async initializeProviders(configs: ProviderConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        let provider: AIProvider;

        switch (config.name.toLowerCase()) {
          case 'openai':
            provider = new OpenAIProvider(config);
            break;
          case 'anthropic':
            provider = new AnthropicProvider(config);
            break;
          case 'google':
          case 'gemini':
            provider = new GeminiProvider(config);
            break;
          case 'ollama':
            provider = new OllamaProvider(config);
            break;
          case 'qwen':
            provider = new QwenProvider(config);
            break;
          case 'cloudflare':
            provider = new CloudflareProvider(config);
            break;
          default:
            console.warn(`Unknown provider: ${config.name}`);
            continue;
        }

        // Test connection before registering
        const isConnected = await provider.testConnection();
        if (isConnected) {
          this.registerProvider(provider);
          console.log(`Successfully connected to ${config.name}`);
        } else {
          console.warn(`Failed to connect to ${config.name}`);
        }
      } catch (error) {
        console.error(`Error initializing provider ${config.name}:`, error);
      }
    }
  }

  /**
   * Get the list of available providers
   */
  public async getAvailableProviders(): Promise<string[]> {
    return this.getProviderNames();
  }

  /**
   * Get the status of a provider
   */
  public async getProviderStatus(
    providerName: string
  ): Promise<{ available: boolean; details?: string }> {
    const provider = this.getProvider(providerName);
    if (!provider) {
      return { available: false, details: 'Provider not found' };
    }

    try {
      const isConnected = await provider.testConnection();
      return { available: isConnected, details: isConnected ? 'Connected' : 'Connection failed' };
    } catch (error) {
      return { available: false, details: `Error: ${(error as Error).message}` };
    }
  }

  /**
   * Get provider count
   */
  public getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * Cleanup method
   */
  public cleanup(): void {
    // In a real implementation, this might clean up resources
    // For now, we'll just log
    console.log('Provider manager cleaned up');
  }
}
