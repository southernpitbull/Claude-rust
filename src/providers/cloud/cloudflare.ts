import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * Cloudflare Provider Implementation (using OpenAI-compatible interface)
 */
export class CloudflareProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'Cloudflare';
    this.model = config.model || '@cf/meta/llama-3.1-8b-instruct';

    // Using OpenAI-compatible interface for Cloudflare Workers AI
    // Note: The actual implementation would need to use Cloudflare's specific API
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey, // For Cloudflare, this would be the API token
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL:
          config.baseURL || 'https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      // Note: The actual test would need to be adapted for Cloudflare's API
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('Cloudflare connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      // Note: The actual implementation would need to be adapted for Cloudflare's API
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('Cloudflare generation error:', error);
      throw error;
    }
  }
}
