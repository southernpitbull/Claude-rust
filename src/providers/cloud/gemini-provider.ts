/**
 * Google Gemini Provider Implementation
 *
 * Gemini Pro with multimodal support (text, images, video).
 *
 * @module providers/cloud/gemini-provider
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

interface GeminiContent {
  parts: Array<{ text: string }>;
  role: string;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiProvider extends BaseProvider {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: ProviderConfig) {
    super({ ...config, type: ProviderType.GOOGLE });

    if (!config.api_key) {
      throw new AuthenticationError('Google API key is required');
    }

    this.apiKey = config.api_key;
    this.client = axios.create({
      baseURL: config.api_base || 'https://generativelanguage.googleapis.com/v1beta',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.custom_headers,
      },
    });
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.getModels();
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
        const contents = messages.map((m) => ({
          parts: [{ text: m.content }],
          role: m.role === 'assistant' ? 'model' : 'user',
        }));

        const response = await this.client.post<GeminiResponse>(
          `/models/${options.model}:generateContent`,
          {
            contents,
            generationConfig: {
              temperature: options.temperature,
              maxOutputTokens: options.max_tokens,
              topP: options.top_p,
              stopSequences: options.stop,
            },
          },
          { params: { key: this.apiKey } }
        );

        const candidate = response.data.candidates?.[0];
        if (!candidate) {
          throw new InvalidRequestError('No candidates returned');
        }

        const usage = response.data.usageMetadata || {
          promptTokenCount: estimatedTokens,
          candidatesTokenCount: this.estimateTokens(candidate.content.parts[0]?.text || ''),
          totalTokenCount: 0,
        };
        usage.totalTokenCount = usage.promptTokenCount + usage.candidatesTokenCount;

        this.updateRateLimitCounters(usage.totalTokenCount);

        const result: CompletionResponse = {
          id: `gemini-${Date.now()}`,
          model: options.model,
          content: candidate.content.parts[0]?.text || '',
          finish_reason: this.mapFinishReason(candidate.finishReason),
          usage: {
            prompt_tokens: usage.promptTokenCount,
            completion_tokens: usage.candidatesTokenCount,
            total_tokens: usage.totalTokenCount,
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

          if (status === 401 || status === 403) {
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

    const contents = messages.map((m) => ({
      parts: [{ text: m.content }],
      role: m.role === 'assistant' ? 'model' : 'user',
    }));

    const response = await this.client.post(
      `/models/${options.model}:streamGenerateContent`,
      {
        contents,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
          topP: options.top_p,
          stopSequences: options.stop,
        },
      },
      { params: { key: this.apiKey, alt: 'sse' }, responseType: 'stream' }
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

          try {
            const parsed = JSON.parse(data);
            const candidate = parsed.candidates?.[0];

            if (candidate?.content?.parts?.[0]?.text) {
              const text = candidate.content.parts[0].text;
              totalTokens += this.estimateTokens(text);

              const streamChunk: StreamChunk = {
                id: `gemini-stream-${Date.now()}`,
                model: options.model,
                delta: { content: text },
                finish_reason: candidate.finishReason
                  ? this.mapFinishReason(candidate.finishReason)
                  : null,
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
      const response = await this.client.get('/models', { params: { key: this.apiKey } });

      return response.data.models
        .filter((m: { name: string }) => m.name.includes('gemini'))
        .map((m: { name: string }) => this.getModelInfo(m.name.split('/').pop() || m.name));
    } catch (error) {
      this.emitEvent('get_models_failed', { error });
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Optimized for text tasks',
        context_window: 32768,
        max_output_tokens: 8192,
        supports_functions: true,
        supports_streaming: true,
        supports_vision: false,
        pricing: { input: 0.000125, output: 0.000375, currency: 'USD' },
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        description: 'Multimodal model for text and images',
        context_window: 16384,
        max_output_tokens: 4096,
        supports_functions: false,
        supports_streaming: true,
        supports_vision: true,
        pricing: { input: 0.000125, output: 0.000375, currency: 'USD' },
      },
    ];
  }

  private getModelInfo(modelId: string): ModelInfo {
    const models = this.getDefaultModels();
    return models.find((m) => m.id === modelId) || models[0]!;
  }

  private mapFinishReason(reason: string): CompletionResponse['finish_reason'] {
    const mapping: Record<string, CompletionResponse['finish_reason']> = {
      STOP: 'stop',
      MAX_TOKENS: 'length',
      SAFETY: 'content_filter',
    };
    return mapping[reason] || null;
  }
}
