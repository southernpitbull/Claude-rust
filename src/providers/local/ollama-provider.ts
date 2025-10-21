/**
 * Ollama Provider Implementation
 *
 * Local model support with Llama 2, Mistral, and other open-source models.
 *
 * @module providers/local/ollama-provider
 */

import axios, { AxiosInstance } from 'axios';
import {
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
  ProviderConfig,
  ProviderType,
  InvalidRequestError,
  ServiceUnavailableError,
  MessageRole,
} from '../types';
import { BaseProvider } from '../provider-base';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider extends BaseProvider {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super({ ...config, type: ProviderType.OLLAMA });

    this.baseUrl = config.api_base || 'http://localhost:11434';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 120000,
      headers: {
        'Content-Type': 'application/json',
        ...config.custom_headers,
      },
    });
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/api/tags');
      return true;
    } catch (error) {
      this.emitEvent('connection_failed', { error });
      return false;
    }
  }

  public async complete(
    messages: Message[],
    options: CompletionOptions
  ): Promise<CompletionResponse> {
    const estimatedTokens = this.estimateTokens(messages.map((m) => m.content).join(' '));
    this.checkRateLimit(estimatedTokens);

    return this.retryWithBackoff(async () => {
      try {
        const ollamaMessages = messages.map((m) => ({
          role:
            m.role === MessageRole.ASSISTANT
              ? 'assistant'
              : m.role === MessageRole.SYSTEM
                ? 'system'
                : 'user',
          content: m.content,
        }));

        const response = await this.client.post<OllamaResponse>('/api/chat', {
          model: options.model,
          messages: ollamaMessages,
          stream: false,
          options: {
            temperature: options.temperature,
            top_p: options.top_p,
            num_predict: options.max_tokens,
            stop: options.stop,
          },
        });

        const promptTokens = response.data.prompt_eval_count || estimatedTokens;
        const completionTokens =
          response.data.eval_count || this.estimateTokens(response.data.message.content);
        const totalTokens = promptTokens + completionTokens;

        this.updateRateLimitCounters(totalTokens);

        const result: CompletionResponse = {
          id: `ollama-${Date.now()}`,
          model: response.data.model,
          content: response.data.message.content,
          finish_reason: response.data.done ? 'stop' : null,
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
          created_at: new Date(response.data.created_at).getTime(),
          metadata: options.metadata,
        };

        this.emitEvent('completion', result);
        return result;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const message = error.response?.data?.error || error.message;
          const status = error.response?.status;

          if (status === 503 || error.code === 'ECONNREFUSED') {
            throw new ServiceUnavailableError(
              'Ollama service is not available. Make sure Ollama is running.'
            );
          }
          if (status && status >= 400 && status < 500) {
            throw new InvalidRequestError(message);
          }
        }
        throw error;
      }
    });
  }

  public async *streamComplete(
    messages: Message[],
    options: CompletionOptions
  ): AsyncGenerator<StreamChunk, void, undefined> {
    const estimatedTokens = this.estimateTokens(messages.map((m) => m.content).join(' '));
    this.checkRateLimit(estimatedTokens);

    const ollamaMessages = messages.map((m) => ({
      role:
        m.role === MessageRole.ASSISTANT
          ? 'assistant'
          : m.role === MessageRole.SYSTEM
            ? 'system'
            : 'user',
      content: m.content,
    }));

    const response = await this.client.post(
      '/api/chat',
      {
        model: options.model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: options.temperature,
          top_p: options.top_p,
          num_predict: options.max_tokens,
          stop: options.stop,
        },
      },
      { responseType: 'stream' }
    );

    let buffer = '';
    let totalTokens = 0;

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);

            if (parsed.message?.content) {
              const text = parsed.message.content;
              totalTokens += this.estimateTokens(text);

              const streamChunk: StreamChunk = {
                id: `ollama-stream-${Date.now()}`,
                model: parsed.model,
                delta: { content: text },
                finish_reason: parsed.done ? 'stop' : null,
              };

              this.emitEvent('stream_chunk', streamChunk);
              yield streamChunk;
            }
          } catch {
            continue;
          }
        }
      }
    }

    this.updateRateLimitCounters(totalTokens);
  }

  public async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get<{
        models: Array<{ name: string; size: number; modified_at: string }>;
      }>('/api/tags');

      return response.data.models.map((model) => ({
        id: model.name,
        name: model.name,
        description: `Local Ollama model: ${model.name}`,
        context_window: 4096,
        max_output_tokens: 2048,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: false,
      }));
    } catch (error) {
      this.emitEvent('get_models_failed', { error });
      return [];
    }
  }

  public async pullModel(modelName: string): Promise<boolean> {
    try {
      await this.client.post('/api/pull', { name: modelName }, { timeout: 600000 });
      this.emitEvent('model_pulled', { model: modelName });
      return true;
    } catch (error) {
      this.emitEvent('model_pull_failed', { model: modelName, error });
      return false;
    }
  }

  public async deleteModel(modelName: string): Promise<boolean> {
    try {
      await this.client.delete('/api/delete', { data: { name: modelName } });
      this.emitEvent('model_deleted', { model: modelName });
      return true;
    } catch (error) {
      this.emitEvent('model_delete_failed', { model: modelName, error });
      return false;
    }
  }
}
