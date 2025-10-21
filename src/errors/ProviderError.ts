/**
 * Provider Error Classes
 *
 * Handles errors related to AI provider integrations (OpenAI, Anthropic, Google, etc.)
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * Provider error codes
 */
export enum ProviderErrorCode {
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMITED = 'PROVIDER_RATE_LIMITED',
  PROVIDER_AUTH_FAILED = 'PROVIDER_AUTH_FAILED',
  PROVIDER_INVALID_REQUEST = 'PROVIDER_INVALID_REQUEST',
  PROVIDER_INVALID_RESPONSE = 'PROVIDER_INVALID_RESPONSE',
  PROVIDER_API_ERROR = 'PROVIDER_API_ERROR',
  PROVIDER_QUOTA_EXCEEDED = 'PROVIDER_QUOTA_EXCEEDED',
  PROVIDER_MODEL_NOT_FOUND = 'PROVIDER_MODEL_NOT_FOUND',
  PROVIDER_CONTEXT_LENGTH_EXCEEDED = 'PROVIDER_CONTEXT_LENGTH_EXCEEDED',
  PROVIDER_CONTENT_FILTERED = 'PROVIDER_CONTENT_FILTERED',
}

/**
 * Base Provider Error
 */
export class ProviderError extends BaseError {
  public readonly provider: string;

  constructor(provider: string, message: string, options: BaseErrorOptions = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.PROVIDER,
      code: options.code ?? ProviderErrorCode.PROVIDER_API_ERROR,
      context: {
        ...options.context,
        provider,
      },
    });

    this.provider = provider;
  }

  protected generateUserMessage(): string {
    return `AI Provider (${this.provider}) error: ${this.message}`;
  }
}

/**
 * Provider Not Found Error
 */
export class ProviderNotFoundError extends ProviderError {
  constructor(provider: string, availableProviders: string[] = [], options: BaseErrorOptions = {}) {
    super(provider, `Provider '${provider}' not found`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...options.context,
        availableProviders,
      },
    });
  }

  protected generateUserMessage(): string {
    const availableProviders = (this.context.availableProviders as string[]) ?? [];

    if (availableProviders.length > 0) {
      return `Provider '${this.provider}' not found. Available providers: ${availableProviders.join(', ')}`;
    }

    return `Provider '${this.provider}' not found. Check your configuration.`;
  }
}

/**
 * Provider Unavailable Error
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(provider: string, reason?: string, options: BaseErrorOptions = {}) {
    super(provider, `Provider '${provider}' is unavailable${reason ? `: ${reason}` : ''}`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_UNAVAILABLE,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    const reason = this.context.reason;
    return `Provider '${this.provider}' is currently unavailable${reason ? `: ${reason}` : ''}. Please try again later.`;
  }
}

/**
 * Provider Timeout Error
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, timeoutMs: number, options: BaseErrorOptions = {}) {
    super(provider, `Provider '${provider}' request timed out after ${timeoutMs}ms`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      context: {
        ...options.context,
        timeoutMs,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Request to ${this.provider} timed out. Please try again.`;
  }
}

/**
 * Provider Rate Limited Error
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, retryAfterSeconds?: number, options: BaseErrorOptions = {}) {
    super(provider, `Provider '${provider}' rate limit exceeded`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_RATE_LIMITED,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      context: {
        ...options.context,
        retryAfterSeconds,
      },
    });
  }

  protected generateUserMessage(): string {
    const retryAfter = this.context.retryAfterSeconds;

    if (retryAfter) {
      return `Rate limit exceeded for ${this.provider}. Please retry after ${retryAfter} seconds.`;
    }

    return `Rate limit exceeded for ${this.provider}. Please try again later.`;
  }
}

/**
 * Provider Authentication Failed Error
 */
export class ProviderAuthenticationError extends ProviderError {
  constructor(provider: string, reason?: string, options: BaseErrorOptions = {}) {
    super(
      provider,
      `Authentication failed for provider '${provider}'${reason ? `: ${reason}` : ''}`,
      {
        ...options,
        code: ProviderErrorCode.PROVIDER_AUTH_FAILED,
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.AUTHENTICATION,
        context: {
          ...options.context,
          reason,
        },
      }
    );
  }

  protected generateUserMessage(): string {
    return `Authentication failed for ${this.provider}. Please check your API key.`;
  }
}

/**
 * Provider Invalid Request Error
 */
export class ProviderInvalidRequestError extends ProviderError {
  constructor(provider: string, reason: string, options: BaseErrorOptions = {}) {
    super(provider, `Invalid request to provider '${provider}': ${reason}`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_INVALID_REQUEST,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Invalid request to ${this.provider}: ${this.context.reason}`;
  }
}

/**
 * Provider Invalid Response Error
 */
export class ProviderInvalidResponseError extends ProviderError {
  constructor(provider: string, reason: string, options: BaseErrorOptions = {}) {
    super(provider, `Invalid response from provider '${provider}': ${reason}`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_INVALID_RESPONSE,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Received invalid response from ${this.provider}. Please try again.`;
  }
}

/**
 * Provider Quota Exceeded Error
 */
export class ProviderQuotaExceededError extends ProviderError {
  constructor(provider: string, quotaType: string, options: BaseErrorOptions = {}) {
    super(provider, `Quota exceeded for provider '${provider}': ${quotaType}`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_QUOTA_EXCEEDED,
      severity: ErrorSeverity.HIGH,
      context: {
        ...options.context,
        quotaType,
      },
    });
  }

  protected generateUserMessage(): string {
    return `${this.context.quotaType} quota exceeded for ${this.provider}. Please check your account limits.`;
  }
}

/**
 * Provider Model Not Found Error
 */
export class ProviderModelNotFoundError extends ProviderError {
  constructor(
    provider: string,
    model: string,
    availableModels: string[] = [],
    options: BaseErrorOptions = {}
  ) {
    super(provider, `Model '${model}' not found for provider '${provider}'`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_MODEL_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...options.context,
        model,
        availableModels,
      },
    });
  }

  protected generateUserMessage(): string {
    const availableModels = (this.context.availableModels as string[]) ?? [];

    if (availableModels.length > 0) {
      return `Model '${this.context.model}' not found for ${this.provider}. Available models: ${availableModels.join(', ')}`;
    }

    return `Model '${this.context.model}' not found for ${this.provider}.`;
  }
}

/**
 * Provider Context Length Exceeded Error
 */
export class ProviderContextLengthError extends ProviderError {
  constructor(
    provider: string,
    tokensUsed: number,
    maxTokens: number,
    options: BaseErrorOptions = {}
  ) {
    super(
      provider,
      `Context length exceeded for provider '${provider}': ${tokensUsed}/${maxTokens} tokens`,
      {
        ...options,
        code: ProviderErrorCode.PROVIDER_CONTEXT_LENGTH_EXCEEDED,
        severity: ErrorSeverity.MEDIUM,
        context: {
          ...options.context,
          tokensUsed,
          maxTokens,
        },
      }
    );
  }

  protected generateUserMessage(): string {
    return `Context length exceeded for ${this.provider}: ${this.context.tokensUsed}/${this.context.maxTokens} tokens. Please reduce input size.`;
  }
}

/**
 * Provider Content Filtered Error
 */
export class ProviderContentFilteredError extends ProviderError {
  constructor(provider: string, reason: string, options: BaseErrorOptions = {}) {
    super(provider, `Content filtered by provider '${provider}': ${reason}`, {
      ...options,
      code: ProviderErrorCode.PROVIDER_CONTENT_FILTERED,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Content was filtered by ${this.provider}: ${this.context.reason}`;
  }
}
