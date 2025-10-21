/**
 * Provider Type Definitions
 *
 * Comprehensive type system for AI providers supporting streaming,
 * function calling, cost tracking, and health monitoring.
 *
 * @module providers/types
 */

/**
 * Supported provider types
 */
export enum ProviderType {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  QWEN = 'qwen',
  CLOUDFLARE = 'cloudflare',
  OLLAMA = 'ollama',
  LMSTUDIO = 'lmstudio',
  VLLM = 'vllm',
}

/**
 * Message role types
 */
export enum MessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  FUNCTION = 'function',
}

/**
 * Message structure
 */
export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

/**
 * Function definition for function calling
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

/**
 * Completion request options
 */
export interface CompletionOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  functions?: FunctionDefinition[];
  function_call?: 'none' | 'auto' | { name: string };
  response_format?: { type: 'text' | 'json_object' };
  metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Completion response
 */
export interface CompletionResponse {
  id: string;
  model: string;
  content: string;
  finish_reason: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
  usage: TokenUsage;
  created_at: number;
  function_call?: {
    name: string;
    arguments: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Stream chunk
 */
export interface StreamChunk {
  id: string;
  model: string;
  delta: {
    role?: MessageRole;
    content?: string;
    function_call?: {
      name?: string;
      arguments?: string;
    };
  };
  finish_reason?: 'stop' | 'length' | 'function_call' | 'content_filter' | null;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_window: number;
  max_output_tokens: number;
  supports_functions: boolean;
  supports_streaming: boolean;
  supports_vision: boolean;
  pricing?: {
    input: number;
    output: number;
    currency: string;
  };
}

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean;
  latency_ms: number;
  last_check: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  requests_per_minute: number;
  tokens_per_minute: number;
  requests_remaining: number;
  tokens_remaining: number;
  reset_at: number;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string;
  type: ProviderType;
  api_key?: string;
  api_base?: string;
  organization?: string;
  timeout?: number;
  max_retries?: number;
  default_model?: string;
  rate_limit?: {
    requests_per_minute?: number;
    tokens_per_minute?: number;
  };
  custom_headers?: Record<string, string>;
}

/**
 * Provider error types
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(
    message: string,
    public resetAt: number
  ) {
    super(message, 'RATE_LIMIT', 429);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends ProviderError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION', 401);
    this.name = 'AuthenticationError';
  }
}

export class InvalidRequestError extends ProviderError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', 400);
    this.name = 'InvalidRequestError';
  }
}

export class ServiceUnavailableError extends ProviderError {
  constructor(message: string) {
    super(message, 'SERVICE_UNAVAILABLE', 503);
    this.name = 'ServiceUnavailableError';
  }
}
