import {
  VectorStoreIndex,
  storageContextFromDefaults,
  Document,
  serviceContextFromDefaults,
  Settings,
  TextNode,
  SimpleNodeParser,
} from 'llamaindex';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CredentialManager } from '../credentials';

/**
 * Interface for LlamaIndex document metadata
 */
export interface LlamaIndexMetadata {
  source: string;
  filePath?: string;
  fileType?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Interface for search results
 */
export interface LlamaIndexSearchResult {
  content: string;
  score: number;
  metadata: LlamaIndexMetadata;
  nodeId: string;
}

/**
 * LlamaIndex integration for AIrchitect CLI
 */
export class LlamaIndexIntegration {
  private index: VectorStoreIndex | null = null;
  private storageDir: string;
  private credentialManager: CredentialManager;
  private initialized: boolean = false;

  constructor(credentialManager: CredentialManager, storageDir?: string) {
    this.credentialManager = credentialManager;
    this.storageDir = storageDir || './.aichitect/memory';
  }

  /**
   * Initialize the LlamaIndex integration
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storageDir, { recursive: true });

      // Set up storage context
      const storageContext = await storageContextFromDefaults({
        persistDir: this.storageDir,
      });

      // Initialize the index
      try {
        // Try to load existing index
        this.index = await VectorStoreIndex.init({
          storageContext,
        });
      } catch (error) {
        // If loading fails, create a new index
        console.log('Creating new index...');
        this.index = await VectorStoreIndex.fromDocuments([], {
          storageContext,
        });
      }

      this.initialized = true;
      console.log('LlamaIndex integration initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize LlamaIndex integration:', error);
      return false;
    }
  }

  /**
   * Check if the integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.index;
  }

  /**
   * Add a document to the index
   */
  public async addToMemory(content: string, metadata: LlamaIndexMetadata): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      const document = new Document({
        id_: metadata.source + '_' + Date.now(),
        text: content,
        metadata: {
          ...metadata,
          updatedAt: new Date().toISOString(),
        },
      });

      await this.index!.insert(document);
      return true;
    } catch (error) {
      console.error('Failed to add document to memory:', error);
      return false;
    }
  }

  /**
   * Add multiple documents to the index
   */
  public async addBatchToMemory(
    documents: Array<{ content: string; metadata: LlamaIndexMetadata }>
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      for (const doc of documents) {
        const document = new Document({
          id_: doc.metadata.source + '_' + Date.now(),
          text: doc.content,
          metadata: {
            ...doc.metadata,
            updatedAt: new Date().toISOString(),
          },
        });

        await this.index!.insert(document);
      }

      return true;
    } catch (error) {
      console.error('Failed to add documents to index:', error);
      return false;
    }
  }

  /**
   * Index a file
   */
  public async indexFile(filePath: string, tags?: string[]): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // Read the file content
      const content = await fs.readFile(filePath, 'utf8');

      // Create metadata
      const fileStat = await fs.stat(filePath);
      const metadata: LlamaIndexMetadata = {
        source: filePath,
        filePath,
        fileType: path.extname(filePath).substring(1), // Remove the dot
        createdAt: fileStat.birthtime.toISOString(),
        updatedAt: new Date().toISOString(),
        tags: tags || [],
      };

      return await this.addToMemory(content, metadata);
    } catch (error) {
      console.error(`Failed to index file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Index all files in a directory
   */
  public async indexDirectory(
    dirPath: string,
    fileExtensions: string[] = ['.ts', '.js', '.py', '.md', '.txt', '.json'],
    tags?: string[]
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      const files = await this.getFilesInDirectory(dirPath, fileExtensions);

      for (const file of files) {
        await this.indexFile(file, tags);
      }

      return true;
    } catch (error) {
      console.error(`Failed to index directory ${dirPath}:`, error);
      return false;
    }
  }

  /**
   * Get all files in a directory with specified extensions
   */
  private async getFilesInDirectory(dirPath: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        const subDirFiles = await this.getFilesInDirectory(itemPath, extensions);
        files.push(...subDirFiles);
      } else if (item.isFile() && extensions.includes(path.extname(item.name))) {
        files.push(itemPath);
      }
    }

    return files;
  }

  /**
   * Query the index
   */
  public async queryMemory(query: string, topK: number = 5): Promise<LlamaIndexSearchResult[]> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      const queryEngine = this.index!.asQueryEngine({
        similarityTopK: topK,
      });

      const response = await queryEngine.query({
        query,
      });

      // Process the response into our format
      const results: LlamaIndexSearchResult[] = [];

      if (response.sourceNodes) {
        for (const node of response.sourceNodes) {
          results.push({
            content: node.node.text || '',
            score: node.score || 0,
            metadata: (node.node.metadata as LlamaIndexMetadata) || {},
            nodeId: node.node.id_,
          });
        }
      } else {
        // If no source nodes, return the response content
        results.push({
          content: response.response || '',
          score: 1,
          metadata: { source: 'query-response', createdAt: new Date().toISOString() },
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
   * Find similar documents to the provided text
   */
  public async findSimilar(content: string, topK: number = 5): Promise<LlamaIndexSearchResult[]> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    // This would use embedding similarity to find related documents
    // For now, we'll use the query method
    return await this.queryMemory(content, topK);
  }

  /**
   * Delete a document from the index
   */
  public async deleteFromMemory(docId: string): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // Note: In LlamaIndex, the method for deletion might be different
      // This is a placeholder implementation
      // In a real implementation, we would use the index's delete method
      console.log(`Document deletion for ${docId} would happen here`);
      return true;
    } catch (error) {
      console.error(`Failed to delete document ${docId}:`, error);
      return false;
    }
  }

  /**
   * Update a document in the index
   */
  public async updateInMemory(
    docId: string,
    newContent: string,
    newMetadata?: LlamaIndexMetadata
  ): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // Delete the old document
      await this.deleteFromMemory(docId);

      // Create a new document with updated content
      const document = new Document({
        id_: docId,
        text: newContent,
        metadata: {
          ...newMetadata,
          updatedAt: new Date().toISOString(),
        },
      });

      // Insert the new document
      await this.index!.insert(document);
      return true;
    } catch (error) {
      console.error(`Failed to update document ${docId}:`, error);
      return false;
    }
  }

  /**
   * Get the count of indexed documents
   */
  public async getDocumentCount(): Promise<number> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    // In a real implementation, this would use the index's count method
    // For now, we'll return a placeholder
    return 0;
  }

  /**
   * Get indexed documents by tag
   */
  public async getDocumentsByTag(tag: string): Promise<LlamaIndexSearchResult[]> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    // This would query the index for documents with a specific tag
    // For now, we'll return an empty array
    return [];
  }

  /**
   * Create an index from project files
   */
  public async createProjectIndex(projectPath: string, tags?: string[]): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // Common file extensions for code projects
      const codeExtensions = [
        '.ts',
        '.js',
        '.py',
        '.java',
        '.cpp',
        '.c',
        '.cs',
        '.go',
        '.rs',
        '.vue',
        '.tsx',
        '.jsx',
      ];
      const docExtensions = ['.md', '.txt', '.rst', '.yaml', '.yml'];
      const configExtensions = ['.json', '.xml', '.env', '.config'];

      // Combine all extensions
      const allExtensions = [...codeExtensions, ...docExtensions, ...configExtensions];

      return await this.indexDirectory(projectPath, allExtensions, tags);
    } catch (error) {
      console.error('Failed to create project index:', error);
      return false;
    }
  }

  /**
   * Get the storage directory path
   */
  public getStorageDir(): string {
    return this.storageDir;
  }

  /**
   * Clear the entire index
   */
  public async clearMemory(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // Reinitialize the index as an empty one
      const storageContext = await storageContextFromDefaults({
        persistDir: this.storageDir,
      });

      this.index = await VectorStoreIndex.fromDocuments([], {
        storageContext,
      });

      return true;
    } catch (error) {
      console.error('Failed to clear memory:', error);
      return false;
    }
  }

  /**
   * Persist the index to storage
   */
  public async persist(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('LlamaIndex integration not initialized');
    }

    try {
      // In LlamaIndex, the storage context handles persistence automatically
      // We'll just ensure the directory exists
      await fs.mkdir(this.storageDir, { recursive: true });
      return true;
    } catch (error) {
      console.error('Failed to persist memory:', error);
      return false;
    }
  }
}
