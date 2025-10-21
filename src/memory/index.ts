/**\n * ProjectMemorySystem - Main interface for project memory management
 *
 * This module provides the core project memory system that integrates
 * with LlamaIndex for intelligent context storage and retrieval.
 */

import { VectorStoreIndex, Document, storageContextFromDefaults } from 'llamaindex';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Interface for project memory configuration
 */
export interface ProjectMemoryConfig {
  /**
   * Storage directory for project memory
   */
  storageDir?: string;

  /**
   * Maximum number of tokens per document
   */
  maxTokensPerDocument?: number;

  /**
   * Default similarity top-k for queries
   */
  similarityTopK?: number;

  /**
   * Whether to enable persistence
   */
  enablePersistence?: boolean;

  /**
   * Chunk size for document splitting
   */
  chunkSize?: number;

  /**
   * Chunk overlap for document splitting
   */
  chunkOverlap?: number;
}

/**
 * Interface for memory query results
 */
export interface MemoryQueryResult {
  /**
   * Content of the retrieved memory item
   */
  content: string;

  /**
   * Relevance score (0-1)
   */
  score: number;

  /**
   * Metadata associated with the memory item
   */
  metadata: Record<string, any>;

  /**
   * Unique identifier for the memory item
   */
  id: string;
}

/**
 * Project Memory System using LlamaIndex
 */
export class ProjectMemorySystem {
  private index: VectorStoreIndex | null = null;
  private config: ProjectMemoryConfig;
  private initialized: boolean = false;
  private storageContext: any = null;

  constructor(config?: ProjectMemoryConfig) {
    this.config = {
      storageDir: './.aichitect/memory',
      maxTokensPerDocument: 4096,
      similarityTopK: 5,
      enablePersistence: true,
      chunkSize: 1024,
      chunkOverlap: 256,
      ...config,
    };
  }

  /**
   * Initialize the project memory system
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.config.storageDir!, { recursive: true });

      // Set up storage context
      this.storageContext = await storageContextFromDefaults({
        persistDir: this.config.storageDir,
      });

      // Initialize or create the index
      try {
        this.index = await VectorStoreIndex.init({
          storageContext: this.storageContext,
        });
      } catch (error) {
        // If initialization fails, create a new index
        console.log('Creating new project memory index...');
        this.index = await VectorStoreIndex.fromDocuments([], {
          storageContext: this.storageContext,
        });
      }

      this.initialized = true;
      console.log('Project memory system initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize project memory system:', error);
      return false;
    }
  }

  /**
   * Check if the memory system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.index;
  }

  /**
   * Store content in project memory
   */
  public async store(
    key: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    try {
      // Create a document with the content and metadata
      const document = new Document({
        id_: key,
        text: content,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata,
        },
      });

      // Insert the document into the index
      await this.index!.insert(document);

      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persist();
      }

      return true;
    } catch (error) {
      console.error(`Failed to store content with key ${key}:`, error);
      return false;
    }
  }

  /**
   * Store file content in project memory
   */
  public async storeFileContent(
    filePath: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const fileMetadata = {
      filePath,
      fileSize: content.length,
      fileType: path.extname(filePath),
      ...metadata,
    };

    return await this.store(`file:${filePath}`, content, fileMetadata);
  }

  /**
   * Retrieve content from project memory
   */
  public async retrieve(key: string): Promise<string | null> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    try {
      // In a real implementation, we would query the index for the specific document
      // For now, we'll return null as LlamaIndex doesn't have a direct get-by-id method
      console.log(`Retrieving content with key ${key} from project memory`);
      return null;
    } catch (error) {
      console.error(`Failed to retrieve content with key ${key}:`, error);
      return null;
    }
  }

  /**
   * Query project memory for relevant information
   */
  public async query(
    query: string,
    options: { maxResults?: number; minScore?: number } = {}
  ): Promise<MemoryQueryResult[]> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    const { maxResults = this.config.similarityTopK, minScore = 0.1 } = options;

    try {
      // Create a query engine
      const queryEngine = this.index!.asQueryEngine({
        similarityTopK: maxResults,
      });

      // Execute the query
      const response = await queryEngine.query({
        query,
      });

      // Process the response into our format
      const results: MemoryQueryResult[] = [];

      if (response.sourceNodes) {
        for (const node of response.sourceNodes) {
          if (node.score >= minScore) {
            results.push({
              content: node.node.text || '',
              score: node.score || 0,
              metadata: node.node.metadata || {},
              id: node.node.id_,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error(`Failed to query project memory for "${query}":`, error);
      return [];
    }
  }

  /**
   * Search project memory for content
   */
  public async search(
    searchTerm: string,
    options: { maxResults?: number; caseSensitive?: boolean } = {}
  ): Promise<MemoryQueryResult[]> {
    const { maxResults = this.config.similarityTopK, caseSensitive = false } = options;

    // For now, we'll use the query method with a search-oriented prompt
    // In a real implementation, we might use a more specific search method
    const searchQuery = caseSensitive
      ? `Find content containing: ${searchTerm}`
      : `Find content containing (case insensitive): ${searchTerm.toLowerCase()}`;

    return await this.query(searchQuery, { maxResults });
  }

  /**
   * Remove content from project memory
   */
  public async remove(key: string): Promise<boolean> {
    if (!this.isInitialized()) {
      await this.initialize();
    }

    try {
      // In a real implementation, we would remove the specific document
      // LlamaIndex doesn't have a direct remove-by-id method in this version
      console.log(`Removing content with key ${key} from project memory`);
      return true;
    } catch (error) {
      console.error(`Failed to remove content with key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all project memory
   */
  public async clear(): Promise<boolean> {
    try {
      // Create a new empty index
      this.index = await VectorStoreIndex.fromDocuments([], {
        storageContext: this.storageContext,
      });

      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persist();
      }

      return true;
    } catch (error) {
      console.error('Failed to clear project memory:', error);
      return false;
    }
  }

  /**
   * Get memory statistics
   */
  public async getStats(): Promise<{
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
   * Persist memory to storage
   */
  public async persist(): Promise<boolean> {
    try {
      // In LlamaIndex, the storage context handles persistence automatically
      // We'll just ensure the directory exists
      await fs.mkdir(this.config.storageDir!, { recursive: true });
      return true;
    } catch (error) {
      console.error('Failed to persist project memory:', error);
      return false;
    }
  }

  /**
   * Get all stored keys (document IDs)
   */
  public async getKeys(): Promise<string[]> {
    // In a real implementation, we would query the index for all document IDs
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Check if a key exists in memory
   */
  public async hasKey(key: string): Promise<boolean> {
    const keys = await this.getKeys();
    return keys.includes(key);
  }

  /**
   * Update content in memory
   */
  public async update(
    key: string,
    newContent: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      // Remove the old content
      await this.remove(key);

      // Store the new content
      return await this.store(key, newContent, metadata);
    } catch (error) {
      console.error(`Failed to update content with key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get similar documents to a query
   */
  public async getSimilar(
    query: string,
    options: { maxResults?: number; minScore?: number } = {}
  ): Promise<MemoryQueryResult[]> {
    return await this.query(query, options);
  }

  /**
   * Export memory to a file
   */
  public async exportToFile(filePath: string): Promise<boolean> {
    try {
      // Get all documents
      const keys = await this.getKeys();
      const documents: any[] = [];

      for (const key of keys) {
        const content = await this.retrieve(key);
        if (content) {
          documents.push({
            key,
            content,
            // In a real implementation, we would also export metadata
          });
        }
      }

      // Write to file
      await fs.writeFile(filePath, JSON.stringify(documents, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to export memory to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Import memory from a file
   */
  public async importFromFile(filePath: string): Promise<boolean> {
    try {
      // Read file
      const content = await fs.readFile(filePath, 'utf8');
      const documents = JSON.parse(content);

      // Store documents
      for (const doc of documents) {
        await this.store(doc.key, doc.content);
      }

      // Persist if enabled
      if (this.config.enablePersistence) {
        await this.persist();
      }

      return true;
    } catch (error) {
      console.error(`Failed to import memory from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Get project context for a specific query
   */
  public async getProjectContext(query: string): Promise<string> {
    const results = await this.query(query, { maxResults: 3 });

    if (results.length === 0) {
      return 'No relevant project context found.';
    }

    // Combine the most relevant results
    return results.map((result) => result.content).join('\n\n---\n\n');
  }

  /**
   * Store conversation history
   */
  public async storeConversation(
    role: 'user' | 'assistant',
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const conversationId = `conversation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const conversationContent = `${role}: ${content}`;

    const conversationMetadata = {
      type: 'conversation',
      role,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    return await this.store(conversationId, conversationContent, conversationMetadata);
  }

  /**
   * Get recent conversation history
   */
  public async getConversationHistory(
    limit: number = 10
  ): Promise<Array<{ role: string; content: string; timestamp: string }>> {
    // In a real implementation, we would query for conversation documents
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Store project documentation
   */
  public async storeDocumentation(
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const docId = `doc_${title.replace(/\s+/g, '_')}_${Date.now()}`;
    const docMetadata = {
      type: 'documentation',
      title,
      ...metadata,
    };

    return await this.store(docId, content, docMetadata);
  }

  /**
   * Get project documentation
   */
  public async getDocumentation(query: string): Promise<string[]> {
    const results = await this.query(`documentation about ${query}`, { maxResults: 5 });
    return results.map((result) => result.content);
  }

  /**
   * Store code snippet
   */
  public async storeCodeSnippet(
    filePath: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const snippetId = `code_${filePath.replace(/[\\/\\\\]/g, '_')}_${Date.now()}`;
    const snippetMetadata = {
      type: 'code-snippet',
      filePath,
      language: path.extname(filePath).substring(1),
      ...metadata,
    };

    return await this.store(snippetId, content, snippetMetadata);
  }

  /**
   * Get relevant code snippets
   */
  public async getCodeSnippets(query: string): Promise<string[]> {
    const results = await this.query(`code related to ${query}`, { maxResults: 5 });
    return results.map((result) => result.content);
  }

  /**
   * Store configuration
   */
  public async storeConfiguration(
    configName: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const configId = `config_${configName}_${Date.now()}`;
    const configMetadata = {
      type: 'configuration',
      configName,
      ...metadata,
    };

    return await this.store(configId, content, configMetadata);
  }

  /**
   * Get configuration
   */
  public async getConfiguration(configName: string): Promise<string | null> {
    const results = await this.query(`configuration ${configName}`, { maxResults: 1 });
    return results.length > 0 ? results[0].content : null;
  }

  /**
   * Store project requirements
   */
  public async storeRequirements(
    requirements: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const reqId = `requirements_${Date.now()}`;
    const reqMetadata = {
      type: 'requirements',
      ...metadata,
    };

    return await this.store(reqId, requirements, reqMetadata);
  }

  /**
   * Get project requirements
   */
  public async getRequirements(): Promise<string[]> {
    const results = await this.query('project requirements', { maxResults: 5 });
    return results.map((result) => result.content);
  }

  /**
   * Store project architecture
   */
  public async storeArchitecture(
    architecture: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const archId = `architecture_${Date.now()}`;
    const archMetadata = {
      type: 'architecture',
      ...metadata,
    };

    return await this.store(archId, architecture, archMetadata);
  }

  /**
   * Get project architecture
   */
  public async getArchitecture(): Promise<string | null> {
    const results = await this.query('project architecture', { maxResults: 1 });
    return results.length > 0 ? results[0].content : null;
  }

  /**
   * Store project plan
   */
  public async storeProjectPlan(
    plan: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const planId = `plan_${Date.now()}`;
    const planMetadata = {
      type: 'project-plan',
      ...metadata,
    };

    return await this.store(planId, plan, planMetadata);
  }

  /**
   * Get project plan
   */
  public async getProjectPlan(): Promise<string | null> {
    const results = await this.query('project plan', { maxResults: 1 });
    return results.length > 0 ? results[0].content : null;
  }
}

// Export the ProjectMemory class from project-memory.ts
export { ProjectMemory } from './project-memory';
