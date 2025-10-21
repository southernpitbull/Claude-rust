import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * Google Gemini Provider Implementation
 */
export class GoogleProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatGoogleGenerativeAI;

  constructor(config: ProviderConfig) {
    this.name = 'Google';
    this.model = config.model || 'gemini-1.5-pro';
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
