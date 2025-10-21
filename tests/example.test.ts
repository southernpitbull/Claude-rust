/**
 * Example test file demonstrating Jest configuration and mock usage
 * This file can be used as a template for writing new tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createMockProvider,
  MockProviderManager,
  setupMockProviders,
  mockProviderFactory,
} from './mocks/providers';
import { MockStorage, MockCache, MockLogger } from './mocks/storage';
import { createMockMessages, MockChatModel } from './mocks/langchain';

describe('Example Test Suite', () => {
  describe('Mock Provider Tests', () => {
    let providerManager: MockProviderManager;

    beforeEach(() => {
      providerManager = setupMockProviders();
    });

    it('should create a mock provider', () => {
      const provider = createMockProvider('TestProvider', 'test-model-v1');
      expect(provider.name).toBe('TestProvider');
      expect(provider.model).toBe('test-model-v1');
    });

    it('should register and retrieve providers', () => {
      const provider = mockProviderFactory.openai();
      providerManager.registerProvider(provider);

      const retrieved = providerManager.getProvider('openai');
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('OpenAI');
    });

    it('should set active provider', () => {
      const success = providerManager.setActiveProvider('openai');
      expect(success).toBe(true);

      const activeProvider = providerManager.getActiveProvider();
      expect(activeProvider).toBeDefined();
      expect(activeProvider.name).toBe('OpenAI');
    });

    it('should list all provider names', () => {
      const names = providerManager.getProviderNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('openai');
    });

    it('should test all providers', async () => {
      const results = await providerManager.testAllProviders();
      expect(results.size).toBeGreaterThan(0);

      for (const [name, status] of results) {
        expect(status).toBe(true);
      }
    });
  });

  describe('Mock Storage Tests', () => {
    let storage: MockStorage;

    beforeEach(() => {
      storage = new MockStorage();
    });

    it('should store and retrieve values', async () => {
      await storage.set('key1', 'value1');
      const value = await storage.get('key1');
      expect(value).toBe('value1');
    });

    it('should delete values', async () => {
      await storage.set('key1', 'value1');
      const deleted = await storage.delete('key1');
      expect(deleted).toBe(true);

      const value = await storage.get('key1');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await storage.set('key1', 'value1');
      const exists = await storage.has('key1');
      expect(exists).toBe(true);

      const notExists = await storage.has('nonexistent');
      expect(notExists).toBe(false);
    });

    it('should list all keys', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');

      const keys = await storage.keys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should clear all data', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();

      const size = await storage.size();
      expect(size).toBe(0);
    });
  });

  describe('Mock Cache Tests', () => {
    let cache: MockCache;

    beforeEach(() => {
      cache = new MockCache();
    });

    it('should cache values', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      expect(value).toBe('value1');
    });

    it('should expire values after TTL', async () => {
      await cache.set('key1', 'value1', 0.1); // 0.1 seconds TTL

      // Wait for expiration
      await global.testUtils.wait(150);

      const value = await cache.get('key1');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', 'value1');
      const exists = await cache.has('key1');
      expect(exists).toBe(true);
    });

    it('should delete cached values', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);

      const exists = await cache.has('key1');
      expect(exists).toBe(false);
    });
  });

  describe('Mock Logger Tests', () => {
    let logger: MockLogger;

    beforeEach(() => {
      logger = new MockLogger();
    });

    it('should log messages', () => {
      logger.info('Test info message');
      logger.error('Test error message');

      expect(logger.logs).toHaveLength(2);
      expect(logger.logs[0].level).toBe('info');
      expect(logger.logs[1].level).toBe('error');
    });

    it('should filter logs by level', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.error('Error message');

      const errorLogs = logger.getLogs('error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('Error message');
    });

    it('should clear logs', () => {
      logger.info('Test message');
      logger.clear();

      expect(logger.logs).toHaveLength(0);
    });
  });

  describe('Mock LangChain Tests', () => {
    let chatModel: MockChatModel;

    beforeEach(() => {
      chatModel = new MockChatModel({
        modelName: 'test-model',
        temperature: 0.5,
      });
    });

    it('should create mock messages', () => {
      const messages = createMockMessages(3);
      expect(messages).toHaveLength(3);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });

    it('should invoke chat model', async () => {
      const messages = createMockMessages(1);
      const response = await chatModel.invoke(messages);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.role).toBe('assistant');
    });

    it('should batch process messages', async () => {
      const batch = [
        createMockMessages(1),
        createMockMessages(1),
      ];

      const responses = await chatModel.batch(batch);
      expect(responses).toHaveLength(2);

      for (const response of responses) {
        expect(response.content).toBeTruthy();
      }
    });
  });

  describe('Global Test Utilities', () => {
    it('should generate random strings', () => {
      const str1 = global.testUtils.randomString(10);
      const str2 = global.testUtils.randomString(10);

      expect(str1).toHaveLength(10);
      expect(str2).toHaveLength(10);
      expect(str1).not.toBe(str2);
    });

    it('should generate random numbers', () => {
      const num = global.testUtils.randomNumber(1, 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(10);
    });

    it('should wait for specified time', async () => {
      const start = Date.now();
      await global.testUtils.wait(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
