import { CredentialManager } from '../credentials/CredentialManager';
import type { AICliConfig } from '../../ai-cli.config';
import { EnhancedProviderManager, ProviderConfig } from './index.js';
import { Logger } from '../logging/Logger.js';

export class ProviderManager {
  private credentialManager: CredentialManager;
  private config: AICliConfig;
  private enhancedProviderManager: EnhancedProviderManager;
  private logger: Logger;

  constructor(credentialManager: CredentialManager, config: AICliConfig) {
    this.credentialManager = credentialManager;
    this.config = config;
    this.enhancedProviderManager = new EnhancedProviderManager();
    this.logger = new Logger('ProviderManager', 'SYSTEM');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing ProviderManager');
    await this.initializeProviders();
  }

  async initializeProviders(): Promise<void> {
    this.logger.info('Initializing AI providers...');

    const configs: ProviderConfig[] = [];

    // Extract provider configurations from the main config
    for (const [providerName, providerConfig] of Object.entries(this.config.providers)) {
      if (providerName === 'default') {
        continue;
      }

      if (typeof providerConfig !== 'string' && providerConfig.enabled) {
        const config: ProviderConfig = {
          name: providerName,
          apiKey: await this.credentialManager.getCredential(providerName),
          baseURL: (providerConfig as any).baseUrl,
          model: (providerConfig as any).model || this.getDefaultModel(providerName),
          temperature: (providerConfig as any).temperature,
          maxTokens: (providerConfig as any).maxTokens || 4096,
          timeout: (providerConfig as any).timeout || 30000,
        };

        configs.push(config);
      }
    }

    // Initialize providers using the enhanced provider manager
    await this.enhancedProviderManager.initializeProviders(configs);

    const providerCount = this.enhancedProviderManager.getProviderCount();
    this.logger.info(`Initialized ${providerCount} AI providers successfully`);
  }

  private getDefaultModel(providerName: string): string {
    const defaults: { [key: string]: string } = {
      openai: 'gpt-4-turbo',
      anthropic: 'claude-3-5-sonnet-20241022',
      google: 'gemini-1.5-pro',
      qwen: 'qwen-max',
      cloudflare: '@cf/meta/llama-3-8b-instruct-fast',
      ollama: 'llama3',
      lmstudio: 'default',
      vllm: 'default',
    };

    return defaults[providerName] || 'default';
  }

  getAvailableProviders(): string[] {
    return this.enhancedProviderManager.getProviderNames();
  }

  async getProviderStatus(provider: string): Promise<{ available: boolean; details?: string }> {
    return await this.enhancedProviderManager.getProviderStatus(provider);
  }

  getProviderCount(): number {
    return this.enhancedProviderManager.getProviderCount();
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up provider resources...');
    this.enhancedProviderManager.cleanup();
  }

  /**
   * Get a specific provider by name
   */
  getProvider(providerName: string) {
    return this.enhancedProviderManager.getProvider(providerName);
  }

  /**
   * Get the active provider
   */
  getActiveProvider() {
    return this.enhancedProviderManager.getActiveProvider();
  }

  /**
   * Set the active provider by name
   */
  setActiveProvider(providerName: string): boolean {
    return this.enhancedProviderManager.setActiveProvider(providerName);
  }

  /**
   * Test all providers
   */
  async testAllProviders(): Promise<Map<string, boolean>> {
    return await this.enhancedProviderManager.testAllProviders();
  }

  /**
   * Get all providers status
   */
  async getAllProvidersStatus(): Promise<Map<string, { available: boolean; details?: string }>> {
    return await this.enhancedProviderManager.getAllProvidersStatus();
  }

  /**
   * Generate a response using the active provider
   */
  async generateResponse(providerName: string, messages: any[], options?: any) {
    const provider = this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not available`);
    }

    return await provider.generateResponse(messages, options);
  }

  /**
   * Select the best provider based on criteria
   */
  selectBestProvider(criteria?: {
    speed?: boolean;
    cost?: boolean;
    accuracy?: boolean;
    model?: string;
  }): string | null {
    return this.enhancedProviderManager.selectBestProvider(criteria);
  }

  /**
   * Get provider performance metrics
   */
  async getProviderPerformance() {
    return await this.enhancedProviderManager.getProviderPerformance();
  }
}
