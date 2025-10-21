import { CredentialManager } from './discovery';
import { SecureCredentialStorage } from './storage';

/**
 * Interface for credential validation results
 */
export interface ValidationResponse {
  isValid: boolean;
  provider: string;
  message?: string;
  responseTime?: number;
}

/**
 * Credential validator to test API keys with their respective providers
 */
export class CredentialValidator {
  private credentialManager: CredentialManager;
  private secureStorage: SecureCredentialStorage;

  constructor(credentialManager: CredentialManager, secureStorage: SecureCredentialStorage) {
    this.credentialManager = credentialManager;
    this.secureStorage = secureStorage;
  }

  /**
   * Validate all discovered credentials
   */
  public async validateAllCredentials(): Promise<ValidationResponse[]> {
    const results: ValidationResponse[] = [];
    const credentials = this.credentialManager.getAllCredentials();

    for (const credential of credentials) {
      const result = await this.validateCredential(credential.provider, credential.key);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate a specific credential with its provider
   */
  public async validateCredential(provider: string, key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      switch (provider.toLowerCase()) {
        case 'openai':
          return await this.validateOpenAI(key);
        case 'anthropic':
          return await this.validateAnthropic(key);
        case 'google':
        case 'gemini':
          return await this.validateGoogle(key);
        case 'qwen':
          return await this.validateQwen(key);
        case 'cloudflare':
          return await this.validateCloudflare(key);
        case 'ollama':
          return await this.validateOllama(key);
        case 'lmstudio':
          return await this.validateLMStudio(key);
        case 'vllm':
          return await this.validateVLLM(key);
        default:
          return {
            isValid: false,
            provider,
            message: `Unsupported provider: ${provider}`,
          };
      }
    } catch (error) {
      return {
        isValid: false,
        provider,
        message: `Validation error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate OpenAI API key
   */
  private async validateOpenAI(key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Using a simple API call to validate the key
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      });

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'openai',
        message: isValid
          ? 'Valid OpenAI API key'
          : `Invalid OpenAI API key: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'openai',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Anthropic API key
   */
  private async validateAnthropic(key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Using a simple API call to validate the key
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
      });

      // The API will return 400 (bad request) because we didn't provide proper parameters,
      // but it will be 401 (unauthorized) if the API key is invalid
      const isValid = response.status !== 401;

      return {
        isValid,
        provider: 'anthropic',
        message: isValid
          ? 'Valid Anthropic API key'
          : `Invalid Anthropic API key: ${response.status}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'anthropic',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Google API key
   */
  private async validateGoogle(key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Using a simple API call to validate the key
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${key}`
      );

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'google',
        message: isValid
          ? 'Valid Google API key'
          : `Invalid Google API key: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'google',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Qwen API key (using DashScope)
   */
  private async validateQwen(key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Using DashScope API to validate the key
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/models', {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      });

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'qwen',
        message: isValid
          ? 'Valid Qwen API key'
          : `Invalid Qwen API key: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'qwen',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Cloudflare API key
   */
  private async validateCloudflare(key: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Cloudflare Workers AI requires account ID as well, so we'll just check format
      // In a real scenario, we'd need the account ID too
      const isValid = key.startsWith('Bearer ') || /^[a-zA-Z0-9_-]+$/.test(key);

      return {
        isValid,
        provider: 'cloudflare',
        message: isValid ? 'Valid format Cloudflare API key' : 'Invalid Cloudflare API key format',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'cloudflare',
        message: `Validation error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate Ollama endpoint
   */
  private async validateOllama(url: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // Extract URL from config - default to localhost if not provided
      const testUrl = url.startsWith('http') ? url : `http://${url}`;
      const normalizedUrl = testUrl.endsWith('/api/tags') ? testUrl : `${testUrl}/api/tags`;

      const response = await fetch(normalizedUrl);

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'ollama',
        message: isValid
          ? 'Valid Ollama endpoint'
          : `Invalid Ollama endpoint: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'ollama',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate LM Studio endpoint
   */
  private async validateLMStudio(url: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // LM Studio uses OpenAI-compatible API
      const testUrl = url.startsWith('http') ? url : `http://${url}`;
      const normalizedUrl = testUrl.endsWith('/v1/models') ? testUrl : `${testUrl}/v1/models`;

      const response = await fetch(normalizedUrl);

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'lmstudio',
        message: isValid
          ? 'Valid LM Studio endpoint'
          : `Invalid LM Studio endpoint: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'lmstudio',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Validate vLLM endpoint
   */
  private async validateVLLM(url: string): Promise<ValidationResponse> {
    const startTime = Date.now();

    try {
      // vLLM uses OpenAI-compatible API
      const testUrl = url.startsWith('http') ? url : `http://${url}`;
      const normalizedUrl = testUrl.endsWith('/v1/models') ? testUrl : `${testUrl}/v1/models`;

      const response = await fetch(normalizedUrl);

      const isValid = response.status === 200;

      return {
        isValid,
        provider: 'vllm',
        message: isValid
          ? 'Valid vLLM endpoint'
          : `Invalid vLLM endpoint: ${response.status} ${response.statusText}`,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        isValid: false,
        provider: 'vllm',
        message: `Network error: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get validation summary for all credentials
   */
  public async getValidationSummary(): Promise<{
    total: number;
    valid: number;
    invalid: number;
    providers: ValidationResponse[];
  }> {
    const providers = await this.validateAllCredentials();

    const valid = providers.filter((p) => p.isValid).length;
    const invalid = providers.length - valid;

    return {
      total: providers.length,
      valid,
      invalid,
      providers,
    };
  }
}
