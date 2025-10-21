/**
 * manager.test.ts
 *
 * Comprehensive unit tests for the MemoryManager class.
 * Tests memory storage, retrieval, context distillation, and lifecycle management.
 */

import { MemoryManager } from '../../src/memory/manager';
import { ProjectMemory, ProjectMemoryConfig } from '../../src/memory/index';

// Mock the ProjectMemory dependency
jest.mock('../../src/memory/index', () => ({
  ProjectMemory: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
    addToMemory: jest.fn(),
    queryMemory: jest.fn(),
    clearMemory: jest.fn(),
    getMemoryStats: jest.fn(),
    persist: jest.fn(),
    updateInMemory: jest.fn(),
    removeFromMemory: jest.fn(),
    isInitialized: jest.fn(),
  })),
}));

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let mockProjectMemory: jest.Mocked<ProjectMemory>;

  beforeEach(() => {
    // Arrange: Reset mocks and create fresh instances before each test
    jest.clearAllMocks();

    // Create mock ProjectMemory instance
    mockProjectMemory = {
      initialize: jest.fn(),
      addToMemory: jest.fn(),
      queryMemory: jest.fn(),
      clearMemory: jest.fn(),
      getMemoryStats: jest.fn(),
      persist: jest.fn(),
      updateInMemory: jest.fn(),
      removeFromMemory: jest.fn(),
      isInitialized: jest.fn(),
    } as any;

    (ProjectMemory as jest.Mock).mockImplementation(() => mockProjectMemory);

    manager = new MemoryManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new MemoryManager instance', () => {
      // Arrange & Act
      const newManager = new MemoryManager();

      // Assert
      expect(newManager).toBeInstanceOf(MemoryManager);
      expect(ProjectMemory).toHaveBeenCalled();
    });

    it('should initialize with default config when not provided', () => {
      // Arrange & Act
      const newManager = new MemoryManager();

      // Assert
      expect(newManager).toBeDefined();
    });

    it('should accept custom config', () => {
      // Arrange
      const config: ProjectMemoryConfig = {
        maxTokens: 8192,
        similarityTopK: 10,
      };

      // Act
      const newManager = new MemoryManager(config);

      // Assert
      expect(newManager).toBeDefined();
      expect(ProjectMemory).toHaveBeenCalledWith(config);
    });

    it('should create ProjectMemory instance', () => {
      // Arrange & Act
      const newManager = new MemoryManager();

      // Assert
      expect(ProjectMemory).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Arrange
      mockProjectMemory.initialize.mockResolvedValue(undefined);

      // Act
      await manager.initialize();

      // Assert
      expect(mockProjectMemory.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      // Arrange
      mockProjectMemory.initialize.mockRejectedValue(new Error('Init failed'));

      // Act & Assert
      await expect(manager.initialize()).rejects.toThrow('Init failed');
    });

    it('should be callable multiple times', async () => {
      // Arrange
      mockProjectMemory.initialize.mockResolvedValue(undefined);

      // Act
      await manager.initialize();
      await manager.initialize();

      // Assert
      expect(mockProjectMemory.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('addProjectContext', () => {
    it('should add project context successfully', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.addProjectContext(
        '/path/to/file.ts',
        'const x = 1;',
        { projectId: 'test-project' }
      );

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'const x = 1;',
        expect.objectContaining({
          filePath: '/path/to/file.ts',
          type: 'project-context',
          projectId: 'test-project',
        })
      );
    });

    it('should include timestamp in metadata', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      await manager.addProjectContext('/path/to/file.ts', 'content', {});

      // Assert
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'content',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it('should return false on failure', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(false);

      // Act
      const result = await manager.addProjectContext('/path', 'content', {});

      // Assert
      expect(result).toBe(false);
    });

    it('should handle empty content', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.addProjectContext('/path', '', {});

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('addConversationToMemory', () => {
    it('should add user conversation successfully', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.addConversationToMemory('user', 'Hello, how are you?');

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'Hello, how are you?',
        expect.objectContaining({
          type: 'conversation',
          role: 'user',
        })
      );
    });

    it('should add assistant conversation successfully', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.addConversationToMemory('assistant', 'I am doing well!');

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'I am doing well!',
        expect.objectContaining({
          type: 'conversation',
          role: 'assistant',
        })
      );
    });

    it('should include timestamp', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      await manager.addConversationToMemory('user', 'Test message');

      // Assert
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('distillContext', () => {
    it('should distill context from query', async () => {
      // Arrange
      const mockResults = [
        { content: 'Result 1', score: 0.9, metadata: { type: 'test' } },
        { content: 'Result 2', score: 0.7, metadata: { type: 'test' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.distillContext('test query');

      // Assert
      expect(result).toEqual(['Result 1', 'Result 2']);
      expect(mockProjectMemory.queryMemory).toHaveBeenCalledWith('test query');
    });

    it('should filter by context type', async () => {
      // Arrange
      const mockResults = [
        { content: 'Result 1', score: 0.9, metadata: { type: 'project-context' } },
        { content: 'Result 2', score: 0.8, metadata: { type: 'conversation' } },
        { content: 'Result 3', score: 0.7, metadata: { type: 'project-context' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.distillContext('test query', 'project-context');

      // Assert
      expect(result).toEqual(['Result 1', 'Result 3']);
    });

    it('should sort results by score', async () => {
      // Arrange
      const mockResults = [
        { content: 'Low score', score: 0.5, metadata: {} },
        { content: 'High score', score: 0.9, metadata: {} },
        { content: 'Medium score', score: 0.7, metadata: {} },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.distillContext('test query');

      // Assert
      expect(result[0]).toBe('High score');
      expect(result[1]).toBe('Medium score');
      expect(result[2]).toBe('Low score');
    });

    it('should handle empty results', async () => {
      // Arrange
      mockProjectMemory.queryMemory.mockResolvedValue([]);

      // Act
      const result = await manager.distillContext('test query');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getProjectContext', () => {
    it('should retrieve project-specific context', async () => {
      // Arrange
      const mockResults = [
        { content: 'Project test-id content', score: 0.9, metadata: { type: 'project-context' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getProjectContext('test-id', 'query');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('test-id');
    });

    it('should use default query when not provided', async () => {
      // Arrange
      mockProjectMemory.queryMemory.mockResolvedValue([]);

      // Act
      await manager.getProjectContext('test-id');

      // Assert
      expect(mockProjectMemory.queryMemory).toHaveBeenCalledWith('project information');
    });

    it('should filter results by project ID', async () => {
      // Arrange
      const mockResults = [
        { content: 'Project test-id content', score: 0.9, metadata: {} },
        { content: 'Other project content', score: 0.8, metadata: {} },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getProjectContext('test-id');

      // Assert
      expect(result).toHaveLength(1);
    });
  });

  describe('getConversationHistory', () => {
    it('should retrieve conversation history', async () => {
      // Arrange
      const mockResults = [
        {
          content: 'Message 1',
          score: 1,
          metadata: { type: 'conversation', role: 'user', timestamp: '2024-01-01T10:00:00Z' },
        },
        {
          content: 'Message 2',
          score: 1,
          metadata: { type: 'conversation', role: 'assistant', timestamp: '2024-01-01T10:01:00Z' },
        },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getConversationHistory(10);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].role).toBeDefined();
      expect(result[0].content).toBeDefined();
    });

    it('should filter conversation entries only', async () => {
      // Arrange
      const mockResults = [
        {
          content: 'Conversation',
          score: 1,
          metadata: { type: 'conversation', role: 'user', timestamp: '2024-01-01' },
        },
        { content: 'Project context', score: 1, metadata: { type: 'project-context' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getConversationHistory();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Conversation');
    });

    it('should sort by timestamp descending', async () => {
      // Arrange
      const mockResults = [
        {
          content: 'Old message',
          score: 1,
          metadata: { type: 'conversation', role: 'user', timestamp: '2024-01-01T10:00:00Z' },
        },
        {
          content: 'New message',
          score: 1,
          metadata: { type: 'conversation', role: 'user', timestamp: '2024-01-01T11:00:00Z' },
        },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getConversationHistory();

      // Assert
      expect(result[0].content).toBe('New message');
      expect(result[1].content).toBe('Old message');
    });

    it('should respect limit parameter', async () => {
      // Arrange
      const mockResults = Array.from({ length: 20 }, (_, i) => ({
        content: `Message ${i}`,
        score: 1,
        metadata: {
          type: 'conversation',
          role: 'user',
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
        },
      }));
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getConversationHistory(5);

      // Assert
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('storeFileContent', () => {
    it('should store small file content directly', async () => {
      // Arrange
      const content = 'Small file content';
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.storeFileContent('/path/to/file.ts', content);

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledTimes(1);
    });

    it('should chunk large file content', async () => {
      // Arrange
      const largeContent = 'x'.repeat(20000);
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.storeFileContent('/path/to/large.ts', largeContent);

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledTimes(2);
    });

    it('should include file metadata', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      await manager.storeFileContent('/path/to/file.ts', 'content', { language: 'typescript' });

      // Assert
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        'content',
        expect.objectContaining({
          filePath: '/path/to/file.ts',
          type: 'file-content',
          language: 'typescript',
        })
      );
    });

    it('should handle empty file content', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.storeFileContent('/path/to/empty.ts', '');

      // Assert
      expect(result).toBe(true);
    });

    it('should include chunk metadata for large files', async () => {
      // Arrange
      const largeContent = 'x'.repeat(20000);
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      await manager.storeFileContent('/path/to/large.ts', largeContent);

      // Assert
      expect(mockProjectMemory.addToMemory).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          chunkIndex: expect.any(Number),
          totalChunks: expect.any(Number),
        })
      );
    });
  });

  describe('findRelevantFiles', () => {
    it('should find relevant files from query', async () => {
      // Arrange
      const mockResults = [
        { content: 'Content 1', score: 0.9, metadata: { filePath: '/path/file1.ts' } },
        { content: 'Content 2', score: 0.8, metadata: { filePath: '/path/file2.ts' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.findRelevantFiles('test query');

      // Assert
      expect(result).toEqual(['/path/file1.ts', '/path/file2.ts']);
    });

    it('should return unique file paths', async () => {
      // Arrange
      const mockResults = [
        { content: 'Content 1', score: 0.9, metadata: { filePath: '/path/file1.ts' } },
        { content: 'Content 2', score: 0.8, metadata: { filePath: '/path/file1.ts' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.findRelevantFiles('test query');

      // Assert
      expect(result).toEqual(['/path/file1.ts']);
    });

    it('should handle results without filePath', async () => {
      // Arrange
      const mockResults = [
        { content: 'Content 1', score: 0.9, metadata: {} },
        { content: 'Content 2', score: 0.8, metadata: { filePath: '/path/file1.ts' } },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.findRelevantFiles('test query');

      // Assert
      expect(result).toEqual(['/path/file1.ts']);
    });
  });

  describe('getContextWindow', () => {
    it('should retrieve context within token limit', async () => {
      // Arrange
      const mockResults = [
        { content: 'Short content 1', score: 0.9, metadata: {} },
        { content: 'Short content 2', score: 0.8, metadata: {} },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getContextWindow('test query', 100);

      // Assert
      expect(result).toContain('Short content 1');
      expect(result).toContain('Short content 2');
    });

    it('should respect token limit', async () => {
      // Arrange
      const largeContent = 'x'.repeat(1000);
      const mockResults = [
        { content: largeContent, score: 0.9, metadata: {} },
        { content: largeContent, score: 0.8, metadata: {} },
      ];
      mockProjectMemory.queryMemory.mockResolvedValue(mockResults as any);

      // Act
      const result = await manager.getContextWindow('test query', 10);

      // Assert
      expect(result.length).toBeLessThan(1000);
    });

    it('should use default context window size', async () => {
      // Arrange
      mockProjectMemory.queryMemory.mockResolvedValue([]);

      // Act
      const result = await manager.getContextWindow('test query');

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe('clearProjectMemory', () => {
    it('should clear memory successfully', async () => {
      // Arrange
      mockProjectMemory.clearMemory.mockResolvedValue(true);

      // Act
      const result = await manager.clearProjectMemory();

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.clearMemory).toHaveBeenCalled();
    });

    it('should return false on failure', async () => {
      // Arrange
      mockProjectMemory.clearMemory.mockResolvedValue(false);

      // Act
      const result = await manager.clearProjectMemory();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', async () => {
      // Arrange
      const mockStats = {
        documentCount: 100,
        totalTokens: 5000,
        lastUpdated: new Date(),
      };
      mockProjectMemory.getMemoryStats.mockResolvedValue(mockStats);

      // Act
      const result = await manager.getMemoryStats();

      // Assert
      expect(result.totalTokens).toBe(5000);
      expect(result.lastUpdated).toBeDefined();
    });

    it('should include project and conversation doc counts', async () => {
      // Arrange
      mockProjectMemory.getMemoryStats.mockResolvedValue({
        documentCount: 50,
        totalTokens: 2000,
        lastUpdated: new Date(),
      });

      // Act
      const result = await manager.getMemoryStats();

      // Assert
      expect(result.projectDocs).toBeDefined();
      expect(result.conversationDocs).toBeDefined();
    });
  });

  describe('persist', () => {
    it('should persist memory successfully', async () => {
      // Arrange
      mockProjectMemory.persist.mockResolvedValue(true);

      // Act
      const result = await manager.persist();

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.persist).toHaveBeenCalled();
    });

    it('should return false on persist failure', async () => {
      // Arrange
      mockProjectMemory.persist.mockResolvedValue(false);

      // Act
      const result = await manager.persist();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('updateMemory', () => {
    it('should update memory entry', async () => {
      // Arrange
      mockProjectMemory.updateInMemory.mockResolvedValue(true);

      // Act
      const result = await manager.updateMemory('doc-id', 'new content', { updated: true });

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.updateInMemory).toHaveBeenCalledWith(
        'doc-id',
        'new content',
        { updated: true }
      );
    });

    it('should return false on update failure', async () => {
      // Arrange
      mockProjectMemory.updateInMemory.mockResolvedValue(false);

      // Act
      const result = await manager.updateMemory('doc-id', 'new content');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('removeMemory', () => {
    it('should remove memory entry', async () => {
      // Arrange
      mockProjectMemory.removeFromMemory.mockResolvedValue(true);

      // Act
      const result = await manager.removeMemory('doc-id');

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.removeFromMemory).toHaveBeenCalledWith('doc-id');
    });

    it('should return false on removal failure', async () => {
      // Arrange
      mockProjectMemory.removeFromMemory.mockResolvedValue(false);

      // Act
      const result = await manager.removeMemory('doc-id');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isInitialized', () => {
    it('should return initialization status', () => {
      // Arrange
      mockProjectMemory.isInitialized.mockReturnValue(true);

      // Act
      const result = manager.isInitialized();

      // Assert
      expect(result).toBe(true);
      expect(mockProjectMemory.isInitialized).toHaveBeenCalled();
    });

    it('should return false when not initialized', () => {
      // Arrange
      mockProjectMemory.isInitialized.mockReturnValue(false);

      // Act
      const result = manager.isInitialized();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should complete full workflow: initialize, store, query, clear', async () => {
      // Arrange
      mockProjectMemory.initialize.mockResolvedValue(undefined);
      mockProjectMemory.addToMemory.mockResolvedValue(true);
      mockProjectMemory.queryMemory.mockResolvedValue([
        { content: 'Test content', score: 0.9, metadata: {} },
      ] as any);
      mockProjectMemory.clearMemory.mockResolvedValue(true);

      // Act
      await manager.initialize();
      await manager.storeFileContent('/test.ts', 'content');
      const context = await manager.distillContext('query');
      await manager.clearProjectMemory();

      // Assert
      expect(context).toHaveLength(1);
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);
      mockProjectMemory.queryMemory.mockResolvedValue([]);

      // Act
      const promises = [
        manager.addProjectContext('/file1.ts', 'content1', {}),
        manager.addProjectContext('/file2.ts', 'content2', {}),
        manager.distillContext('query'),
      ];
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should handle query errors gracefully', async () => {
      // Arrange
      mockProjectMemory.queryMemory.mockRejectedValue(new Error('Query failed'));

      // Act & Assert
      await expect(manager.distillContext('query')).rejects.toThrow('Query failed');
    });

    it('should handle storage errors', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockRejectedValue(new Error('Storage failed'));

      // Act & Assert
      await expect(
        manager.storeFileContent('/test.ts', 'content')
      ).rejects.toThrow('Storage failed');
    });

    it('should recover from temporary failures', async () => {
      // Arrange
      mockProjectMemory.addToMemory
        .mockRejectedValueOnce(new Error('Temp failure'))
        .mockResolvedValueOnce(true);

      // Act
      try {
        await manager.addProjectContext('/test.ts', 'content', {});
      } catch (e) {
        // Expected first failure
      }
      const result = await manager.addProjectContext('/test.ts', 'content', {});

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null query results', async () => {
      // Arrange
      mockProjectMemory.queryMemory.mockResolvedValue(null as any);

      // Act & Assert
      await expect(manager.distillContext('query')).rejects.toThrow();
    });

    it('should handle empty metadata', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.addProjectContext('/test.ts', 'content', undefined as any);

      // Assert
      expect(mockProjectMemory.addToMemory).toHaveBeenCalled();
    });

    it('should handle very long content', async () => {
      // Arrange
      const veryLongContent = 'x'.repeat(100000);
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.storeFileContent('/test.ts', veryLongContent);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle special characters in content', async () => {
      // Arrange
      const specialContent = '{"test": "\\n\\t\\r"}';
      mockProjectMemory.addToMemory.mockResolvedValue(true);

      // Act
      const result = await manager.storeFileContent('/test.ts', specialContent);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('performance tests', () => {
    it('should create manager quickly', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const newManager = new MemoryManager();
      const duration = Date.now() - startTime;

      // Assert
      expect(newManager).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should handle rapid memory operations', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);
      const startTime = Date.now();

      // Act
      await Promise.all([
        manager.addProjectContext('/file1.ts', 'content1', {}),
        manager.addProjectContext('/file2.ts', 'content2', {}),
        manager.addProjectContext('/file3.ts', 'content3', {}),
      ]);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(500);
    });

    it('should handle large batch operations efficiently', async () => {
      // Arrange
      mockProjectMemory.addToMemory.mockResolvedValue(true);
      const promises = Array.from({ length: 50 }, (_, i) =>
        manager.addProjectContext(`/file${i}.ts`, `content${i}`, {})
      );

      // Act
      const startTime = Date.now();
      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Assert
      expect(duration).toBeLessThan(2000);
    });
  });
});
