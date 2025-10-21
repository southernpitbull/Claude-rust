import { ProjectMemory, ProjectMemoryConfig } from './index';
import { Document } from 'llamaindex';

/**
 * Memory manager that coordinates multiple memory systems and provides
 * intelligent context distillation
 */
export class MemoryManager {
  private projectMemory: ProjectMemory;
  private contextWindowSize: number;
  private activeContext: string | null;

  constructor(config?: ProjectMemoryConfig) {
    this.projectMemory = new ProjectMemory(config);
    this.contextWindowSize = config?.maxTokens || 4096;
    this.activeContext = null;
  }

  /**
   * Initialize the memory manager
   */
  public async initialize(): Promise<void> {
    await this.projectMemory.initialize();
  }

  /**
   * Add project context to memory
   */
  public async addProjectContext(
    filePath: string,
    content: string,
    projectMetadata: Record<string, any>
  ): Promise<boolean> {
    const metadata = {
      ...projectMetadata,
      filePath,
      type: 'project-context',
      timestamp: new Date().toISOString(),
    };

    return await this.projectMemory.addToMemory(content, metadata);
  }

  /**
   * Add conversation history to memory
   */
  public async addConversationToMemory(
    role: 'user' | 'assistant',
    content: string
  ): Promise<boolean> {
    const metadata = {
      type: 'conversation',
      role,
      timestamp: new Date().toISOString(),
    };

    return await this.projectMemory.addToMemory(content, metadata);
  }

  /**
   * Distill relevant context for a specific query
   */
  public async distillContext(query: string, contextType?: string): Promise<string[]> {
    // Query memory for relevant information
    const results = await this.projectMemory.queryMemory(query);

    // Filter results by context type if specified
    const filteredResults = contextType
      ? results.filter((result) => result.metadata.type === contextType)
      : results;

    // Sort by relevance score
    const sortedResults = filteredResults.sort((a, b) => b.score - a.score);

    // Return the content of the most relevant results
    return sortedResults.map((result) => result.content);
  }

  /**
   * Get project-specific context
   */
  public async getProjectContext(projectId: string, query?: string): Promise<string[]> {
    const allContext = await this.distillContext(query || 'project information', 'project-context');

    // Filter for the specific project
    return allContext.filter(
      (context) =>
        context.includes(projectId) ||
        (context.toLowerCase().includes('project') &&
          context.toLowerCase().includes(projectId.toLowerCase()))
    );
  }

  /**
   * Get conversation history
   */
  public async getConversationHistory(
    limit: number = 10
  ): Promise<Array<{ role: string; content: string; timestamp: string }>> {
    // Query for conversation history
    const results = await this.projectMemory.queryMemory('conversation history', limit);

    // Format the results
    return results
      .filter((result) => result.metadata.type === 'conversation')
      .map((result) => ({
        role: result.metadata.role || 'assistant',
        content: result.content,
        timestamp: result.metadata.timestamp || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // Sort by newest first
      .slice(0, limit);
  }

  /**
   * Store file content in memory with intelligent chunking
   */
  public async storeFileContent(
    filePath: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    // For large files, chunk the content
    if (content.length > this.contextWindowSize * 3) {
      // 3x for safety margin
      const chunks = this.chunkContent(content, this.contextWindowSize * 2); // 2x for overlap

      for (let i = 0; i < chunks.length; i++) {
        const chunkMetadata = {
          ...metadata,
          filePath,
          chunkIndex: i,
          totalChunks: chunks.length,
          type: 'file-content',
        };

        await this.projectMemory.addToMemory(chunks[i], chunkMetadata);
      }

      return true;
    } else {
      // For smaller files, store as single document
      const combinedMetadata = {
        ...metadata,
        filePath,
        type: 'file-content',
      };

      return await this.projectMemory.addToMemory(content, combinedMetadata);
    }
  }

  /**
   * Chunk content into smaller pieces for processing
   */
  private chunkContent(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];

    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.substring(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Find relevant files for a query
   */
  public async findRelevantFiles(query: string): Promise<string[]> {
    const results = await this.projectMemory.queryMemory(query);

    // Extract unique file paths from results
    const filePaths = new Set<string>();
    results.forEach((result) => {
      if (result.metadata.filePath) {
        filePaths.add(result.metadata.filePath);
      }
    });

    return Array.from(filePaths);
  }

  /**
   * Get the current context window
   */
  public async getContextWindow(
    query: string,
    maxTokens: number = this.contextWindowSize
  ): Promise<string> {
    const relevantContexts = await this.distillContext(query);

    // Combine contexts until we reach the token limit
    let combinedContext = '';
    for (const context of relevantContexts) {
      // Simple token estimation (4 chars per token)
      const estimatedTokens = (combinedContext + context).length / 4;

      if (estimatedTokens > maxTokens) {
        break;
      }

      combinedContext += context + '\n\n';
    }

    return combinedContext.trim();
  }

  /**
   * Clear all project-specific memory
   */
  public async clearProjectMemory(): Promise<boolean> {
    return await this.projectMemory.clearMemory();
  }

  /**
   * Get memory statistics
   */
  public async getMemoryStats(): Promise<{
    projectDocs: number;
    conversationDocs: number;
    totalTokens: number;
    lastUpdated: Date | null;
  }> {
    const stats = await this.projectMemory.getMemoryStats();

    // In a real implementation, we would get separate counts for different types
    return {
      projectDocs: 0,
      conversationDocs: 0,
      totalTokens: stats.totalTokens,
      lastUpdated: stats.lastUpdated,
    };
  }

  /**
   * Persist all memory systems
   */
  public async persist(): Promise<boolean> {
    return await this.projectMemory.persist();
  }

  /**
   * Update content in memory
   */
  public async updateMemory(
    docId: string,
    newContent: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    return await this.projectMemory.updateInMemory(docId, newContent, metadata);
  }

  /**
   * Remove content from memory
   */
  public async removeMemory(docId: string): Promise<boolean> {
    return await this.projectMemory.removeFromMemory(docId);
  }

  /**
   * Check if memory manager is initialized
   */
  public isInitialized(): boolean {
    return this.projectMemory.isInitialized();
  }
}
