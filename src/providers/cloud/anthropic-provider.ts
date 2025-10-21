/**
 * Anthropic Provider Implementation
 *
 * Claude models with 200K context window support, streaming, and advanced reasoning.
 *
 * @module providers/cloud/anthropic-provider
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
  AuthenticationError,
  InvalidRequestError,
  ServiceUnavailableError,
  RateLimitError,
  MessageRole,
} from '../types';
import { BaseProvider } from '../provider-base';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicCompletionResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider extends BaseProvider {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super({ ...config, type: ProviderType.ANTHROPIC });

    if (!config.api_key) {
      throw new AuthenticationError('Anthropic API key is required');
    }

    this.apiKey = config.api_key;
    this.client = axios.create({
      baseURL: config.api_base || 'https://api.anthropic.com/v1',
      timeout: config.timeout || 60000,
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        ...config.custom_headers,
      },
    });
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.complete([{ role: MessageRole.USER, content: 'test' }], {
        model: this.config.default_model || 'claude-3-sonnet-20240229',
        max_tokens: 10,
      });
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
        const systemMessage = messages.find((m) => m.role === MessageRole.SYSTEM);
        const conversationMessages = messages
          .filter((m) => m.role !== MessageRole.SYSTEM)
          .map((m) => ({
            role: m.role === MessageRole.ASSISTANT ? 'assistant' : 'user',
            content: m.content,
          }));

        const response = await this.client.post<AnthropicCompletionResponse>('/messages', {
          model: options.model,
          messages: conversationMessages,
          ...(systemMessage && { system: systemMessage.content }),
          max_tokens: options.max_tokens || 4096,
          temperature: options.temperature,
          top_p: options.top_p,
          stop_sequences: options.stop,
          stream: false,
        });

        const totalTokens = response.data.usage.input_tokens + response.data.usage.output_tokens;
        this.updateRateLimitCounters(totalTokens);

        const result: CompletionResponse = {
          id: response.data.id,
          model: response.data.model,
          content: response.data.content[0]?.text || '',
          finish_reason: this.mapStopReason(response.data.stop_reason),
          usage: {
            prompt_tokens: response.data.usage.input_tokens,
            completion_tokens: response.data.usage.output_tokens,
            total_tokens: totalTokens,
          },
          created_at: Date.now(),
          metadata: options.metadata,
        };

        this.emitEvent('completion', result);
        return result;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const message = error.response?.data?.error?.message || error.message;

          if (status === 401) {
            throw new AuthenticationError(message);
          }
          if (status === 429) {
            throw new RateLimitError(message, Date.now() + 60000);
          }
          if (status === 529) {
            throw new ServiceUnavailableError(message);
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

    const systemMessage = messages.find((m) => m.role === MessageRole.SYSTEM);
    const conversationMessages = messages
      .filter((m) => m.role !== MessageRole.SYSTEM)
      .map((m) => ({
        role: m.role === MessageRole.ASSISTANT ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await this.client.post(
      '/messages',
      {
        model: options.model,
        messages: conversationMessages,
        ...(systemMessage && { system: systemMessage.content }),
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature,
        top_p: options.top_p,
        stop_sequences: options.stop,
        stream: true,
      },
      { responseType: 'stream' }
    );

    let buffer = '';
    let totalTokens = 0;
    let messageId = '';

    for await (const chunk of response.data) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'message_start') {
              messageId = parsed.message.id;
            } else if (parsed.type === 'content_block_delta') {
              const text = parsed.delta?.text || '';
              totalTokens += this.estimateTokens(text);

              const streamChunk: StreamChunk = {
                id: messageId,
                model: options.model,
                delta: { content: text },
                finish_reason: null,
              };

              this.emitEvent('stream_chunk', streamChunk);
              yield streamChunk;
            } else if (parsed.type === 'message_delta') {
              const finishReason = this.mapStopReason(parsed.delta?.stop_reason);
              const streamChunk: StreamChunk = {
                id: messageId,
                model: options.model,
                delta: {},
                finish_reason: finishReason,
              };
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
    return [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex tasks',
        context_window: 200000,
        max_output_tokens: 4096,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: true,
        pricing: { input: 0.015, output: 0.075, currency: 'USD' },
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed',
        context_window: 200000,
        max_output_tokens: 4096,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: true,
        pricing: { input: 0.003, output: 0.015, currency: 'USD' },
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest model for simple tasks',
        context_window: 200000,
        max_output_tokens: 4096,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: true,
        pricing: { input: 0.00025, output: 0.00125, currency: 'USD' },
      },
    ];
  }

  private mapStopReason(reason: string | null): CompletionResponse['finish_reason'] {
    const mapping: Record<string, CompletionResponse['finish_reason']> = {
      end_turn: 'stop',
      max_tokens: 'length',
      stop_sequence: 'stop',
    };
    return reason ? mapping[reason] || null : null;
  }
}
