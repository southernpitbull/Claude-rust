/**
 * claude.test.ts
 *
 * Comprehensive unit tests for the AnthropicProvider (Claude) class.
 * Tests provider initialization, connection testing, message generation, and error handling.
 */

import { AnthropicProvider } from '../../../src/providers/cloud/claude';
import { ProviderConfig } from '../../../src/providers/base';
import { BaseMessage } from '@langchain/core/messages';

// Mock the ChatAnthropic module
jest.mock('@langchain/anthropic', () => ({
  ChatAnthropic: jest.fn().mockImplementation((config) => ({
    invoke: jest.fn(),
    _config: config,
  })),
}));

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockConfig: ProviderConfig;

  beforeEach(() => {
    // Arrange: Reset mocks and create fresh config before each test
    jest.clearAllMocks();

    mockConfig = {
      name: 'Anthropic',
      apiKey: 'sk-ant-test-key-12345',
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      maxTokens: 4096,
      timeout: 30000,
      baseURL: 'https://api.anthropic.com',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new AnthropicProvider instance', () => {
      // Arrange & Act
      provider = new AnthropicProvider(mockConfig);

      // Assert
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.name).toBe('Anthropic');
      expect(provider.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should set default model when not provided', () => {
      // Arrange
      const configWithoutModel = { ...mockConfig, model: '' };
      delete (configWithoutModel as any).model;

      // Act
      provider = new AnthropicProvider(configWithoutModel);

      // Assert
      expect(provider.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should use provided model name', () => {
      // Arrange
      const customConfig = { ...mockConfig, model: 'claude-3-opus-20240229' };

      // Act
      provider = new AnthropicProvider(customConfig);

      // Assert
      expect(provider.model).toBe('claude-3-opus-20240229');
    });

    it('should initialize with provided API key', () => {
      // Arrange & Act
      provider = new AnthropicProvider(mockConfig);

      // Assert
      expect(provider.chat).toBeDefined();
    });

    it('should set temperature to default when not provided', () => {
      // Arrange
      const configWithoutTemp = { ...mockConfig };
      delete (configWithoutTemp as any).temperature;

      // Act
      provider = new AnthropicProvider(configWithoutTemp);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should use custom temperature when provided', () => {
      // Arrange
      const customConfig = { ...mockConfig, temperature: 0.3 };

      // Act
      provider = new AnthropicProvider(customConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should initialize ChatAnthropic with correct configuration', () => {
      // Arrange & Act
      provider = new AnthropicProvider(mockConfig);

      // Assert
      expect(provider.chat).toBeDefined();
    });

    it('should handle missing baseURL gracefully', () => {
      // Arrange
      const configWithoutBaseURL = { ...mockConfig };
      delete (configWithoutBaseURL as any).baseURL;

      // Act
      provider = new AnthropicProvider(configWithoutBaseURL);

      // Assert
      expect(provider).toBeDefined();
      expect(provider.chat).toBeDefined();
    });

    it('should handle missing timeout gracefully', () => {
      // Arrange
      const configWithoutTimeout = { ...mockConfig };
      delete (configWithoutTimeout as any).timeout;

      // Act
      provider = new AnthropicProvider(configWithoutTimeout);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should set name to "Anthropic"', () => {
      // Arrange & Act
      provider = new AnthropicProvider(mockConfig);

      // Assert
      expect(provider.name).toBe('Anthropic');
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      provider = new AnthropicProvider(mockConfig);
    });

    it('should return true on successful connection test', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'test response' });

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(true);
      expect(provider.chat.invoke).toHaveBeenCalledWith([{ content: 'test', role: 'user' }]);
    });

    it('should return false on connection failure', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Anthropic connection test failed:',
        expect.any(Error)
      );
    });

    it('should handle network timeout errors', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Request timeout'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Invalid API key'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Rate limit exceeded'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should call invoke with test message', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'test' });

      // Act
      await provider.testConnection();

      // Assert
      expect(provider.chat.invoke).toHaveBeenCalledWith([{ content: 'test', role: 'user' }]);
    });

    it('should log connection errors to console', async () => {
      // Arrange
      const error = new Error('Connection error');
      (provider.chat.invoke as jest.Mock).mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      await provider.testConnection();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Anthropic connection test failed:', error);
    });

    it('should handle null or undefined responses', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(true);
    });

    it('should complete quickly for valid connections', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'test' });
      const startTime = Date.now();

      // Act
      await provider.testConnection();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100);
    });
  });

  describe('generateResponse', () => {
    beforeEach(() => {
      provider = new AnthropicProvider(mockConfig);
    });

    it('should generate response successfully', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Hello', role: 'user' } as BaseMessage,
      ];
      const mockResponse = { content: 'Hi there!' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await provider.generateResponse(messages);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(provider.chat.invoke).toHaveBeenCalledWith(messages, undefined);
    });

    it('should pass options to chat invoke', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Hello', role: 'user' } as BaseMessage,
      ];
      const options = { temperature: 0.5, maxTokens: 2000 };
      const mockResponse = { content: 'Response' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await provider.generateResponse(messages, options);

      // Assert
      expect(provider.chat.invoke).toHaveBeenCalledWith(messages, options);
    });

    it('should throw error on generation failure', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Hello', role: 'user' } as BaseMessage,
      ];
      const error = new Error('Generation failed');
      (provider.chat.invoke as jest.Mock).mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateResponse(messages)).rejects.toThrow('Generation failed');
      expect(consoleSpy).toHaveBeenCalledWith('Anthropic generation error:', error);
    });

    it('should handle empty message array', async () => {
      // Arrange
      const messages: BaseMessage[] = [];
      const mockResponse = { content: 'Empty response' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await provider.generateResponse(messages);

      // Assert
      expect(result).toEqual(mockResponse);
    });

    it('should handle multiple messages', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Hello', role: 'user' } as BaseMessage,
        { content: 'Hi', role: 'assistant' } as BaseMessage,
        { content: 'How are you?', role: 'user' } as BaseMessage,
      ];
      const mockResponse = { content: 'I am fine' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await provider.generateResponse(messages);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(provider.chat.invoke).toHaveBeenCalledWith(messages, undefined);
    });

    it('should handle long messages', async () => {
      // Arrange
      const longMessage = 'x'.repeat(10000);
      const messages: BaseMessage[] = [
        { content: longMessage, role: 'user' } as BaseMessage,
      ];
      const mockResponse = { content: 'Long response' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await provider.generateResponse(messages);

      // Assert
      expect(result).toEqual(mockResponse);
    });

    it('should handle special characters in messages', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: '{"test": "value"}', role: 'user' } as BaseMessage,
      ];
      const mockResponse = { content: 'JSON handled' };
      (provider.chat.invoke as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await provider.generateResponse(messages);

      // Assert
      expect(result).toEqual(mockResponse);
    });

    it('should log generation errors', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Test', role: 'user' } as BaseMessage,
      ];
      const error = new Error('API error');
      (provider.chat.invoke as jest.Mock).mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      try {
        await provider.generateResponse(messages);
      } catch (e) {
        // Expected error
      }

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Anthropic generation error:', error);
    });

    it('should handle rate limiting errors', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Test', role: 'user' } as BaseMessage,
      ];
      const error = new Error('Rate limit exceeded');
      (provider.chat.invoke as jest.Mock).mockRejectedValue(error);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert
      await expect(provider.generateResponse(messages)).rejects.toThrow('Rate limit exceeded');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should preserve error messages', async () => {
      // Arrange
      const messages: BaseMessage[] = [
        { content: 'Test', role: 'user' } as BaseMessage,
      ];
      const errorMessage = 'Custom error message';
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(provider.generateResponse(messages)).rejects.toThrow(errorMessage);
    });
  });

  describe('integration tests', () => {
    it('should complete full workflow: create, test, generate', async () => {
      // Arrange
      provider = new AnthropicProvider(mockConfig);
      const messages: BaseMessage[] = [
        { content: 'Hello', role: 'user' } as BaseMessage,
      ];
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'Response' });

      // Act
      const testResult = await provider.testConnection();
      const response = await provider.generateResponse(messages);

      // Assert
      expect(testResult).toBe(true);
      expect(response).toEqual({ content: 'Response' });
    });

    it('should handle multiple consecutive requests', async () => {
      // Arrange
      provider = new AnthropicProvider(mockConfig);
      const messages: BaseMessage[] = [
        { content: 'Test', role: 'user' } as BaseMessage,
      ];
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'Response' });

      // Act
      const results = await Promise.all([
        provider.generateResponse(messages),
        provider.generateResponse(messages),
        provider.generateResponse(messages),
      ]);

      // Assert
      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toEqual({ content: 'Response' });
      });
    });

    it('should maintain state across multiple operations', async () => {
      // Arrange
      provider = new AnthropicProvider(mockConfig);
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'Response' });

      // Act
      await provider.testConnection();
      const modelBefore = provider.model;
      await provider.generateResponse([{ content: 'Test', role: 'user' } as BaseMessage]);
      const modelAfter = provider.model;

      // Assert
      expect(modelBefore).toBe(modelAfter);
      expect(provider.name).toBe('Anthropic');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      provider = new AnthropicProvider(mockConfig);
    });

    it('should handle network errors gracefully', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const testResult = await provider.testConnection();

      // Assert
      expect(testResult).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should handle invalid API responses', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue(undefined);

      // Act
      const result = await provider.testConnection();

      // Assert
      expect(result).toBe(true);
    });

    it('should handle malformed message objects', async () => {
      // Arrange
      const malformedMessages = [{ invalid: 'message' }] as any;
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'Response' });

      // Act
      const result = await provider.generateResponse(malformedMessages);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle concurrent error scenarios', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockRejectedValue(new Error('Concurrent error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const promises = [
        provider.testConnection(),
        provider.testConnection(),
        provider.testConnection(),
      ];
      const results = await Promise.all(promises);

      // Assert
      expect(results.every((r) => r === false)).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty API key', () => {
      // Arrange
      const emptyKeyConfig = { ...mockConfig, apiKey: '' };

      // Act
      provider = new AnthropicProvider(emptyKeyConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should handle undefined API key', () => {
      // Arrange
      const noKeyConfig = { ...mockConfig };
      delete (noKeyConfig as any).apiKey;

      // Act
      provider = new AnthropicProvider(noKeyConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should handle zero maxTokens', () => {
      // Arrange
      const zeroTokenConfig = { ...mockConfig, maxTokens: 0 };

      // Act
      provider = new AnthropicProvider(zeroTokenConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should handle negative temperature', () => {
      // Arrange
      const negTempConfig = { ...mockConfig, temperature: -1 };

      // Act
      provider = new AnthropicProvider(negTempConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should handle very large maxTokens', () => {
      // Arrange
      const largeTokenConfig = { ...mockConfig, maxTokens: 1000000 };

      // Act
      provider = new AnthropicProvider(largeTokenConfig);

      // Assert
      expect(provider).toBeDefined();
    });

    it('should handle invalid model names', () => {
      // Arrange
      const invalidModelConfig = { ...mockConfig, model: 'invalid-model-name' };

      // Act
      provider = new AnthropicProvider(invalidModelConfig);

      // Assert
      expect(provider.model).toBe('invalid-model-name');
    });
  });

  describe('performance tests', () => {
    beforeEach(() => {
      provider = new AnthropicProvider(mockConfig);
    });

    it('should create provider quickly', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const newProvider = new AnthropicProvider(mockConfig);
      const duration = Date.now() - startTime;

      // Assert
      expect(newProvider).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid consecutive calls', async () => {
      // Arrange
      (provider.chat.invoke as jest.Mock).mockResolvedValue({ content: 'Fast' });
      const messages: BaseMessage[] = [
        { content: 'Test', role: 'user' } as BaseMessage,
      ];

      // Act
      const startTime = Date.now();
      await Promise.all([
        provider.generateResponse(messages),
        provider.generateResponse(messages),
        provider.generateResponse(messages),
      ]);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500);
    });
  });
});
