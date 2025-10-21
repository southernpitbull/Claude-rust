import { ChatAnthropic } from '@langchain/anthropic';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * Anthropic Provider Implementation
 */
export class AnthropicProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatAnthropic;

  constructor(config: ProviderConfig) {
    this.name = 'Anthropic';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.chat = new ChatAnthropic({
      anthropicApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
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
