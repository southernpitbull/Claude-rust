/**
 * OpenAI Provider Implementation
 *
 * Full support for GPT-4, GPT-3.5 Turbo models with function calling,
 * streaming responses, and vision capabilities.
 *
 * @module providers/cloud/openai-provider
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
} from '../types';
import { BaseProvider } from '../provider-base';

interface OpenAIMessage {
  role: string;
  content: string;
  name?: string;
  function_call?: { name: string; arguments: string };
}

interface OpenAICompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends BaseProvider {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super({ ...config, type: ProviderType.OPENAI });

    if (!config.api_key) {
      throw new AuthenticationError('OpenAI API key is required');
    }

    this.apiKey = config.api_key;
    this.client = axios.create({
      baseURL: config.api_base || 'https://api.openai.com/v1',
      timeout: config.timeout || 30000,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.organization && { 'OpenAI-Organization': config.organization }),
        ...config.custom_headers,
      },
    });
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/models');
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
        const response = await this.client.post<OpenAICompletionResponse>('/chat/completions', {
          model: options.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.name && { name: m.name }),
            ...(m.function_call && { function_call: m.function_call }),
          })),
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          top_p: options.top_p,
          frequency_penalty: options.frequency_penalty,
          presence_penalty: options.presence_penalty,
          stop: options.stop,
          functions: options.functions,
          function_call: options.function_call,
          response_format: options.response_format,
          stream: false,
        });

        const choice = response.data.choices[0];
        if (!choice) {
          throw new InvalidRequestError('No completion choices returned');
        }

        this.updateRateLimitCounters(response.data.usage.total_tokens);

        const result: CompletionResponse = {
          id: response.data.id,
          model: response.data.model,
          content: choice.message.content,
          finish_reason: choice.finish_reason as CompletionResponse['finish_reason'],
          usage: response.data.usage,
          created_at: response.data.created,
          function_call: choice.message.function_call,
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
          if (status === 503) {
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

    const response = await this.client.post(
      '/chat/completions',
      {
        model: options.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.name && { name: m.name }),
        })),
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        top_p: options.top_p,
        frequency_penalty: options.frequency_penalty,
        presence_penalty: options.presence_penalty,
        stop: options.stop,
        functions: options.functions,
        function_call: options.function_call,
        stream: true,
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            this.updateRateLimitCounters(totalTokens);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices[0]?.delta;

            if (delta) {
              totalTokens += this.estimateTokens(delta.content || '');
              const chunk: StreamChunk = {
                id: parsed.id,
                model: parsed.model,
                delta: {
                  role: delta.role,
                  content: delta.content,
                  function_call: delta.function_call,
                },
                finish_reason: parsed.choices[0]?.finish_reason,
              };
              this.emitEvent('stream_chunk', chunk);
              yield chunk;
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
      const response = await this.client.get<{ data: Array<{ id: string }> }>('/models');
      return response.data.data
        .filter((model) => model.id.startsWith('gpt'))
        .map((model) => this.getModelInfo(model.id));
    } catch (error) {
      this.emitEvent('get_models_failed', { error });
      return [];
    }
  }

  private getModelInfo(modelId: string): ModelInfo {
    const modelSpecs: Record<string, Partial<ModelInfo>> = {
      'gpt-4': {
        context_window: 8192,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: { input: 0.03, output: 0.06, currency: 'USD' },
      },
      'gpt-4-32k': {
        context_window: 32768,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: { input: 0.06, output: 0.12, currency: 'USD' },
      },
      'gpt-4-turbo': {
        context_window: 128000,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: true,
        pricing: { input: 0.01, output: 0.03, currency: 'USD' },
      },
      'gpt-3.5-turbo': {
        context_window: 4096,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: { input: 0.0005, output: 0.0015, currency: 'USD' },
      },
      'gpt-3.5-turbo-16k': {
        context_window: 16384,
        max_output_tokens: 4096,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: { input: 0.003, output: 0.004, currency: 'USD' },
      },
    };

    const specs = modelSpecs[modelId] || modelSpecs['gpt-3.5-turbo'];

    return {
      id: modelId,
      name: modelId,
      description: `OpenAI ${modelId} model`,
      context_window: specs.context_window!,
      max_output_tokens: specs.max_output_tokens!,
      supports_functions: specs.supports_functions!,
      supports_streaming: specs.supports_streaming!,
      supports_vision: specs.supports_vision!,
      pricing: specs.pricing,
    };
  }
}
