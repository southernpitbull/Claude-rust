// vLLM provider implementation would typically use OpenAI-compatible interface
import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * vLLM Provider Implementation (using OpenAI-compatible interface)
 */
export class VLLMProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'vLLM';
    this.model = config.model || 'default';

    // vLLM provides an OpenAI-compatible API
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey || 'not-needed', // vLLM may or may not require an API key
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL || 'http://localhost:8000/v1', // Default vLLM endpoint
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('vLLM connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('vLLM generation error:', error);
      throw error;
    }
  }
}
