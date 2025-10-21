import { ProviderManager } from './base';
import { OpenAIProvider } from './cloud/openai';
import { AnthropicProvider } from './cloud/claude';
import { GoogleProvider } from './cloud/gemini';
import { QwenProvider } from './cloud/qwen';
import { CloudflareProvider } from './cloud/cloudflare';
import { OllamaProvider } from './local/ollama';
import { LMStudioProvider } from './local/lmstudio';
import { VLLMProvider } from './local/vllm';
import { ProviderConfig } from './base';

// Export the original ProviderManager class as well as EnhancedProviderManager
export { ProviderManager };

/**
 * Enhanced Provider Manager with additional functionality
 */
export class EnhancedProviderManager extends ProviderManager {
  constructor() {
    super();
  }

  /**
   * Initialize providers based on configuration with type-specific handling
   */
  public async initializeProviders(configs: ProviderConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        let provider;

        switch (config.name.toLowerCase()) {
          case 'openai':
            provider = new OpenAIProvider(config);
            break;
          case 'anthropic':
            provider = new AnthropicProvider(config);
            break;
          case 'google':
          case 'gemini':
            provider = new GoogleProvider(config);
            break;
          case 'qwen':
            provider = new QwenProvider(config);
            break;
          case 'cloudflare':
            provider = new CloudflareProvider(config);
            break;
          case 'ollama':
            provider = new OllamaProvider(config);
            break;
          case 'lmstudio':
            provider = new LMStudioProvider(config);
            break;
          case 'vllm':
            provider = new VLLMProvider(config);
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
   * Get provider performance metrics
   */
  public async getProviderPerformance(): Promise<{ [key: string]: any }> {
    const performance: { [key: string]: any } = {};

    for (const [name, provider] of this.providers) {
      // This would typically track actual performance metrics
      performance[name] = {
        responseTime: 'N/A', // Would be calculated in a real implementation
        successRate: 'N/A', // Would be calculated in a real implementation
        lastUsed: 'N/A', // Would be tracked in a real implementation
      };
    }

    return performance;
  }

  /**
   * Get all providers status
   */
  public async getAllProvidersStatus(): Promise<
    Map<string, { available: boolean; details?: string }>
  > {
    const results = new Map<string, { available: boolean; details?: string }>();

    for (const [name, provider] of this.providers) {
      try {
        const isConnected = await provider.testConnection();
        results.set(name, {
          available: isConnected,
          details: isConnected ? 'Connected' : 'Connection failed',
        });
      } catch (error) {
        results.set(name, {
          available: false,
          details: `Error: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  /**
   * Select the best provider based on criteria
   */
  public selectBestProvider(
    criteria: {
      speed?: boolean;
      cost?: boolean;
      accuracy?: boolean;
      model?: string;
    } = {}
  ): string | null {
    // In a real implementation, this would use actual metrics
    // For now, we'll implement a basic selection based on availability

    if (criteria.model) {
      // Check if any provider supports the requested model
      for (const [name, provider] of this.providers) {
        if (provider.model === criteria.model) {
          return name;
        }
      }
    }

    // Default to first available provider
    for (const [name] of this.providers) {
      return name;
    }

    return null;
  }
}

// Create a default export for the enhanced provider manager
export default EnhancedProviderManager;
