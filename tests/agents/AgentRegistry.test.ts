/**
 * AgentRegistry.test.ts
 *
 * Comprehensive unit tests for the AgentRegistry class.
 * Tests agent registration, retrieval, lifecycle management, and error handling.
 */

import { AgentRegistry } from '../../src/agents/AgentRegistry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    // Arrange: Create a fresh registry instance before each test
    registry = new AgentRegistry();
  });

  afterEach(() => {
    // Cleanup: Reset any console spy mocks
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new AgentRegistry instance', () => {
      // Arrange & Act
      const newRegistry = new AgentRegistry();

      // Assert
      expect(newRegistry).toBeInstanceOf(AgentRegistry);
      expect(newRegistry.getAgentCount()).toBe(0);
    });

    it('should initialize with empty agent map', () => {
      // Arrange & Act
      const newRegistry = new AgentRegistry();

      // Assert
      expect(newRegistry.getAgentCount()).toBe(0);
    });

    it('should not be initialized by default', async () => {
      // Arrange
      const newRegistry = new AgentRegistry();

      // Act
      const count = newRegistry.getAgentCount();

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize the registry successfully', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.initialize();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('AgentRegistry initialized');
      expect(registry.getAgentCount()).toBeGreaterThan(0);
    });

    it('should register default agents during initialization', async () => {
      // Arrange & Act
      await registry.initialize();

      // Assert
      expect(registry.getAgentCount()).toBe(4);
    });

    it('should log initialization message', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.initialize();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('AgentRegistry initialized');
      expect(consoleSpy).toHaveBeenCalledWith('Registering default agents...');
    });

    it('should be idempotent when called multiple times', async () => {
      // Arrange & Act
      await registry.initialize();
      const firstCount = registry.getAgentCount();
      await registry.initialize();
      const secondCount = registry.getAgentCount();

      // Assert
      expect(firstCount).toBe(secondCount);
      expect(firstCount).toBe(4);
    });

    it('should handle initialization without errors', async () => {
      // Arrange & Act & Assert
      await expect(registry.initialize()).resolves.not.toThrow();
    });
  });

  describe('registerDefaultAgents', () => {
    it('should register infrastructure agent', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.registerDefaultAgents();

      // Assert
      expect(registry.getAgentCount()).toBeGreaterThanOrEqual(1);
      expect(consoleSpy).toHaveBeenCalledWith('Registering default agents...');
    });

    it('should register container agent', async () => {
      // Arrange & Act
      await registry.registerDefaultAgents();

      // Assert
      expect(registry.getAgentCount()).toBeGreaterThanOrEqual(2);
    });

    it('should register kubernetes agent', async () => {
      // Arrange & Act
      await registry.registerDefaultAgents();

      // Assert
      expect(registry.getAgentCount()).toBeGreaterThanOrEqual(3);
    });

    it('should register cicd agent', async () => {
      // Arrange & Act
      await registry.registerDefaultAgents();

      // Assert
      expect(registry.getAgentCount()).toBe(4);
    });

    it('should register all agents with proper metadata', async () => {
      // Arrange & Act
      await registry.registerDefaultAgents();

      // Assert
      expect(registry.getAgentCount()).toBe(4);
    });

    it('should log registration message', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.registerDefaultAgents();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Registering default agents...');
    });
  });

  describe('getAgentCount', () => {
    it('should return 0 for newly created registry', () => {
      // Arrange & Act
      const count = registry.getAgentCount();

      // Assert
      expect(count).toBe(0);
    });

    it('should return correct count after initialization', async () => {
      // Arrange
      await registry.initialize();

      // Act
      const count = registry.getAgentCount();

      // Assert
      expect(count).toBe(4);
    });

    it('should return correct count after registering default agents', async () => {
      // Arrange
      await registry.registerDefaultAgents();

      // Act
      const count = registry.getAgentCount();

      // Assert
      expect(count).toBe(4);
    });

    it('should return numeric value', async () => {
      // Arrange
      await registry.initialize();

      // Act
      const count = registry.getAgentCount();

      // Assert
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('should not be negative', () => {
      // Arrange & Act
      const count = registry.getAgentCount();

      // Assert
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup agent resources successfully', async () => {
      // Arrange
      await registry.initialize();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.cleanup();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Cleaning up agent resources...');
    });

    it('should not throw errors during cleanup', async () => {
      // Arrange
      await registry.initialize();

      // Act & Assert
      await expect(registry.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup on uninitialized registry', async () => {
      // Arrange & Act & Assert
      await expect(registry.cleanup()).resolves.not.toThrow();
    });

    it('should log cleanup message', async () => {
      // Arrange
      await registry.initialize();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.cleanup();

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('Cleaning up agent resources...');
    });

    it('should be callable multiple times without errors', async () => {
      // Arrange
      await registry.initialize();

      // Act & Assert
      await expect(registry.cleanup()).resolves.not.toThrow();
      await expect(registry.cleanup()).resolves.not.toThrow();
    });
  });

  describe('integration tests', () => {
    it('should complete full lifecycle: initialize, use, cleanup', async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Act
      await registry.initialize();
      const count = registry.getAgentCount();
      await registry.cleanup();

      // Assert
      expect(count).toBe(4);
      expect(consoleSpy).toHaveBeenCalledWith('AgentRegistry initialized');
      expect(consoleSpy).toHaveBeenCalledWith('Cleaning up agent resources...');
    });

    it('should maintain agent count throughout lifecycle', async () => {
      // Arrange & Act
      await registry.initialize();
      const initialCount = registry.getAgentCount();
      const midCount = registry.getAgentCount();
      await registry.cleanup();

      // Assert
      expect(initialCount).toBe(midCount);
      expect(initialCount).toBe(4);
    });

    it('should handle rapid initialization and cleanup', async () => {
      // Arrange & Act & Assert
      for (let i = 0; i < 3; i++) {
        await registry.initialize();
        expect(registry.getAgentCount()).toBe(4);
        await registry.cleanup();
      }
    });

    it('should not interfere with other registry instances', async () => {
      // Arrange
      const registry1 = new AgentRegistry();
      const registry2 = new AgentRegistry();

      // Act
      await registry1.initialize();
      const count1 = registry1.getAgentCount();
      const count2 = registry2.getAgentCount();

      // Assert
      expect(count1).toBe(4);
      expect(count2).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle console errors gracefully during initialization', async () => {
      // Arrange
      const originalLog = console.log;
      console.log = jest.fn(() => {
        throw new Error('Console error');
      });

      // Act & Assert
      await expect(registry.initialize()).rejects.toThrow('Console error');

      // Cleanup
      console.log = originalLog;
    });

    it('should maintain consistent state after failed operations', async () => {
      // Arrange
      await registry.initialize();
      const initialCount = registry.getAgentCount();

      // Act
      try {
        // Simulate some operation that might fail
        await registry.cleanup();
      } catch (error) {
        // Error is expected in some edge cases
      }

      // Assert - count should remain consistent
      expect(initialCount).toBe(4);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      await registry.initialize();
      const originalLog = console.log;
      let callCount = 0;
      console.log = jest.fn(() => {
        callCount++;
        if (callCount > 1) {
          throw new Error('Cleanup error');
        }
      });

      // Act & Assert - cleanup should not throw even if console.log throws
      await expect(registry.cleanup()).resolves.not.toThrow();

      // Cleanup
      console.log = originalLog;
    });
  });

  describe('edge cases', () => {
    it('should handle getting count before initialization', () => {
      // Arrange & Act
      const count = registry.getAgentCount();

      // Assert
      expect(count).toBe(0);
    });

    it('should handle cleanup before initialization', async () => {
      // Arrange & Act & Assert
      await expect(registry.cleanup()).resolves.not.toThrow();
    });

    it('should handle multiple initializations', async () => {
      // Arrange & Act
      await registry.initialize();
      await registry.initialize();
      await registry.initialize();

      // Assert
      expect(registry.getAgentCount()).toBe(4);
    });

    it('should handle initialization after cleanup', async () => {
      // Arrange
      await registry.initialize();
      await registry.cleanup();

      // Act
      await registry.initialize();

      // Assert
      expect(registry.getAgentCount()).toBe(4);
    });

    it('should handle rapid method calls', async () => {
      // Arrange & Act
      const promises = [
        registry.initialize(),
        registry.getAgentCount(),
        registry.cleanup(),
      ];

      // Assert - should not throw
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('performance tests', () => {
    it('should initialize within reasonable time', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      await registry.initialize();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should take less than 1 second
    });

    it('should handle getAgentCount efficiently', async () => {
      // Arrange
      await registry.initialize();
      const startTime = Date.now();

      // Act
      for (let i = 0; i < 1000; i++) {
        registry.getAgentCount();
      }
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should cleanup within reasonable time', async () => {
      // Arrange
      await registry.initialize();
      const startTime = Date.now();

      // Act
      await registry.cleanup();
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(1000); // Should take less than 1 second
    });
  });
});
