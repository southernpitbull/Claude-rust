import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * LM Studio Provider Implementation (using OpenAI-compatible interface)
 */
export class LMStudioProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOpenAI;

  constructor(config: ProviderConfig) {
    this.name = 'LMStudio';
    this.model = config.model || 'default'; // LM Studio typically uses a default model

    // LM Studio provides an OpenAI-compatible API
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey || 'not-needed', // LM Studio doesn't typically require an API key
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL || 'http://localhost:1234/v1', // Default LM Studio endpoint
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.chat.invoke([{ content: 'test', role: 'user' }]);
      return true;
    } catch (error) {
      console.error('LM Studio connection test failed:', error);
      return false;
    }
  }

  async generateResponse(messages: BaseMessage[], options?: any) {
    try {
      const response = await this.chat.invoke(messages, options);
      return response;
    } catch (error) {
      console.error('LM Studio generation error:', error);
      throw error;
    }
  }
}
