import { ChatOllama } from '@langchain/ollama';
import { BaseMessage } from '@langchain/core/messages';
import { ProviderConfig, AIProvider } from '../base';

/**
 * Ollama Provider Implementation
 */
export class OllamaProvider implements AIProvider {
  public name: string;
  public model: string;
  public chat: ChatOllama;

  constructor(config: ProviderConfig) {
    this.name = 'Ollama';
    this.model = config.model || 'llama3';
    this.chat = new ChatOllama({
      baseUrl: config.baseURL || 'http://localhost:11434',
      model: this.model,
      temperature: config.temperature || 0.7,
      numCtx: config.maxTokens || 2048,
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
