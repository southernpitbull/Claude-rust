import { ChatOpenAI } from '@langchain/openai';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

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

    // Qwen is OpenAI-compatible through Alibaba Cloud's OpenAI-compatible API
    this.chat = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: this.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      configuration: {
        baseURL: config.baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
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
