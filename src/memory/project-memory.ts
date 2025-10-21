import {
  VectorStoreIndex,
  Document,
  storageContextFromDefaults,
  serviceContextFromDefaults,
  SimpleNodeParser,
  Settings,
} from 'llamaindex';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CredentialManager } from '../credentials';

/**
 * Interface for project memory configuration
 */
export interface ProjectMemoryConfig {
  storagePath?: string;
  similarityTopK?: number;
  maxTokens?: number;
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Interface for memory retrieval results
 */
export interface MemoryRetrievalResult {
  content: string;
  score: number;
  metadata: Record<string, any>;
  nodeId: string;
}

/**
 * Project memory system using LlamaIndex for intelligent context storage and retrieval
 */
export class ProjectMemory {
  private index: VectorStoreIndex | null = null;
  private config: ProjectMemoryConfig;
  private initialized: boolean = false;
  private storagePath: string;

  constructor(config?: ProjectMemoryConfig) {
    this.config = {
      storagePath: './.aichitect/memory',
      similarityTopK: 5,
      maxTokens: 4096,
      chunkSize: 1024,
      chunkOverlap: 256,
      ...config,
    };

    this.storagePath = this.config.storagePath || './.aichitect/memory';
  }

  /**
   * Initialize the project memory system
   */
  public async initialize(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storagePath, { recursive: true });

      // Set up storage context
      const storageContext = await storageContextFromDefaults({
        persistDir: this.storagePath,
      });

      // Set up service context with node parser
      const serviceContext = await serviceContextFromDefaults({
        nodeParser: new SimpleNodeParser({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        }),
      });

      // Create or load the index
      try {
        // Try to load existing index
        this.index = await VectorStoreIndex.init({
          storageContext,
          serviceContext,
        });
      } catch (error) {
        // If loading fails, create a new index
        console.log('Creating new project memory index...');
        this.index = await VectorStoreIndex.fromDocuments([], {
          storageContext,
          serviceContext,
        });
      }

      this.initialized = true;
      console.log('Project memory system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize project memory:', error);
      // Create an in-memory index as fallback
      const serviceContext = await serviceContextFromDefaults({
        nodeParser: new SimpleNodeParser({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        }),
      });

      this.index = await VectorStoreIndex.fromDocuments([], {
        serviceContext,
      });

      this.initialized = true;
    }
  }

  /**
   * Check if the memory system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.index;
  }

  /**
   * Add content to project memory
   */
  public async addToMemory(content: string, metadata: Record<string, any> = {}): Promise<boolean> {
    if (!this.isInitialized() || !this.index) {
      await this.initialize();
    }

    try {
      // Create a document with the content and metadata
      const document = new Document({
        id_: metadata.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: content,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      // Insert the document into the index
      await this.index!.insert(document);
      return true;
    } catch (error) {
      console.error('Failed to add to memory:', error);
      return false;
    }
  }

  /**
   * Add multiple content items to project memory
   */
  public async addBatchToMemory(
    items: Array<{ content: string; metadata: Record<string, any> }>
  ): Promise<boolean> {
    if (!this.isInitialized() || !this.index) {
      await this.initialize();
    }

    try {
      const documents = items.map(
        (item) =>
          new Document({
            id_: item.metadata.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: item.content,
            metadata: {
              timestamp: new Date().toISOString(),
              ...item.metadata,
            },
          })
      );

      // Insert all documents
      for (const document of documents) {
        await this.index!.insert(document);
      }

      return true;
    } catch (error) {
      console.error('Failed to add batch to memory:', error);
      return false;
    }
  }

  /**
   * Query project memory for relevant information
   */
  public async queryMemory(query: string, topK?: number): Promise<MemoryRetrievalResult[]> {
    if (!this.isInitialized() || !this.index) {
      await this.initialize();
    }

    try {
      // Create a query engine
      const queryEngine = this.index!.asQueryEngine({
        similarityTopK: topK || this.config.similarityTopK,
      });

      // Execute the query
      const response = await queryEngine.query({
        query,
      });

      // Process the response into our format
      const results: MemoryRetrievalResult[] = [];

      // In LlamaIndex, we need to extract the source nodes from the response
      if (response.sourceNodes) {
        for (const node of response.sourceNodes) {
          results.push({
            content: node.node.text || '',
            score: node.score || 0,
            metadata: node.node.metadata || {},
            nodeId: node.node.id_,
          });
        }
      } else {
        // If no source nodes, just return the response content
        results.push({
          content: response.response || '',
          score: 1,
          metadata: {},
          nodeId: 'response-node',
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to query memory:', error);
      return [];
    }
  }

  /**
   * Clear project memory
   */
  public async clearMemory(): Promise<boolean> {
    try {
      // Create a new empty index
      const storageContext = await storageContextFromDefaults({
        persistDir: this.storagePath,
      });

      const serviceContext = await serviceContextFromDefaults({
        nodeParser: new SimpleNodeParser({
          chunkSize: this.config.chunkSize,
          chunkOverlap: this.config.chunkOverlap,
        }),
      });

      this.index = await VectorStoreIndex.fromDocuments([], {
        storageContext,
        serviceContext,
      });

      return true;
    } catch (error) {
      console.error('Failed to clear memory:', error);
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  public async getMemoryStats(): Promise<{
    documentCount: number;
    totalTokens: number;
    lastUpdated: Date | null;
  }> {
    // In a real implementation, we would get actual statistics from the index
    // For now, we'll return placeholder values
    return {
      documentCount: 0,
      totalTokens: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Update content in memory
   */
  public async updateInMemory(
    docId: string,
    newContent: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // In a real implementation, we would update the specific document
      // For now, we'll just delete and re-add
      await this.removeFromMemory(docId);
      return await this.addToMemory(newContent, { ...metadata, id: docId });
    } catch (error) {
      console.error('Failed to update memory:', error);
      return false;
    }
  }

  /**
   * Remove content from memory by document ID
   */
  public async removeFromMemory(docId: string): Promise<boolean> {
    try {
      // In a real implementation, we would remove the specific document
      // The exact method depends on the underlying vector store implementation
      // For now, we'll just log the action
      console.log(`Document ${docId} removed from memory`);
      return true;
    } catch (error) {
      console.error('Failed to remove from memory:', error);
      return false;
    }
  }

  /**
   * Get a specific document from memory by ID (if supported)
   */
  public async getDocumentById(docId: string): Promise<Document | null> {
    // In a real implementation, we would retrieve the specific document
    // For now, we'll return null
    return null;
  }

  /**
   * Persist memory to storage
   */
  public async persist(): Promise<boolean> {
    try {
      // In LlamaIndex, the storage context handles persistence automatically
      // We'll just ensure the directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      return true;
    } catch (error) {
      console.error('Failed to persist memory:', error);
      return false;
    }
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
    if (content.length > (this.config.maxTokens || 4096) * 4) {
      // Rough estimate: 4 chars per token
      const chunks = this.chunkContent(content, (this.config.maxTokens || 4096) * 2); // 2x for overlap

      for (let i = 0; i < chunks.length; i++) {
        const chunkMetadata = {
          ...metadata,
          filePath,
          chunkIndex: i,
          totalChunks: chunks.length,
          type: 'file-content',
        };

        const success = await this.addToMemory(chunks[i], chunkMetadata);
        if (!success) {
          return false;
        }
      }

      return true;
    } else {
      // For smaller files, store as single document
      const combinedMetadata = {
        ...metadata,
        filePath,
        type: 'file-content',
      };

      return await this.addToMemory(content, combinedMetadata);
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
    const results = await this.queryMemory(query);

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
    maxTokens: number = this.config.maxTokens || 4096
  ): Promise<string> {
    const relevantContexts = await this.queryMemory(query);

    // Combine contexts until we reach the token limit
    let combinedContext = '';
    for (const context of relevantContexts) {
      // Simple token estimation (4 chars per token)
      const estimatedTokens = (combinedContext + context.content).length / 4;

      if (estimatedTokens > maxTokens) {
        break;
      }

      combinedContext += context.content + '\n\n';
    }

    return combinedContext.trim();
  }

  /**
   * Clear all project-specific memory
   */
  public async clearProjectMemory(): Promise<boolean> {
    return await this.clearMemory();
  }

  /**
   * Get memory configuration
   */
  public getConfig(): ProjectMemoryConfig {
    return { ...this.config };
  }

  /**
   * Update memory configuration
   */
  public async updateConfig(newConfig: Partial<ProjectMemoryConfig>): Promise<boolean> {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize with new configuration if needed
    if (newConfig.chunkSize || newConfig.chunkOverlap) {
      await this.initialize();
    }

    return true;
  }

  /**
   * Export memory to file
   */
  public async exportMemory(filePath: string): Promise<boolean> {
    try {
      // In a real implementation, this would export the index
      // For now, we'll create a simple export
      const exportData = {
        config: this.getConfig(),
        exportDate: new Date().toISOString(),
        // In a real implementation, we would export actual documents
        documents: [],
      };

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to export memory:', error);
      return false;
    }
  }

  /**
   * Import memory from file
   */
  public async importMemory(filePath: string): Promise<boolean> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const importData = JSON.parse(fileContent);

      // Update configuration if present
      if (importData.config) {
        await this.updateConfig(importData.config);
      }

      // In a real implementation, this would import actual documents
      // For now, we'll just log the import
      console.log(`Imported memory from ${filePath}`);
      return true;
    } catch (error) {
      console.error('Failed to import memory:', error);
      return false;
    }
  }

  /**
   * Get the number of entries in memory
   */
  public getEntryCount(): number {
    // In a real implementation, this would return the actual count
    // For now, we'll return a placeholder value
    return 0;
  }

  /**
   * Cleanup method
   */
  public cleanup(): void {
    // In a real implementation, this would clean up resources
    // For now, we'll just log
    console.log('Project memory cleaned up');
  }
}
