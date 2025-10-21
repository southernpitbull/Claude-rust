/**
 * Checkpoint and Rollback System for AIrchitect CLI
 *
 * This module provides the checkpoint and rollback functionality
 * that allows users to save project states and restore them when needed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { AIrchitectApp } from '../main';

/**
 * Interface for checkpoint metadata
 */
export interface CheckpointMetadata {
  /**
   * Unique identifier for the checkpoint
   */
  id: string;

  /**
   * Checkpoint name
   */
  name: string;

  /**
   * Checkpoint description
   */
  description?: string;

  /**
   * Timestamp when checkpoint was created
   */
  createdAt: Date;

  /**
   * Hash of the project state at the time of checkpoint
   */
  stateHash: string;

  /**
   * Tags associated with the checkpoint
   */
  tags: string[];

  /**
   * Size of the checkpoint in bytes
   */
  size: number;

  /**
   * Parent checkpoint ID (for chaining)
   */
  parentId?: string;
}

/**
 * Interface for checkpoint storage
 */
export interface CheckpointStorage {
  /**
   * Save a checkpoint
   */
  save(checkpoint: CheckpointMetadata, data: Buffer): Promise<boolean>;

  /**
   * Load a checkpoint
   */
  load(id: string): Promise<{ metadata: CheckpointMetadata; data: Buffer } | null>;

  /**
   * Delete a checkpoint
   */
  delete(id: string): Promise<boolean>;

  /**
   * List all checkpoints
   */
  list(): Promise<CheckpointMetadata[]>;

  /**
   * Get checkpoint by name
   */
  getByName(name: string): Promise<CheckpointMetadata | null>;
}

/**
 * File-based checkpoint storage implementation
 */
export class FileCheckpointStorage implements CheckpointStorage {
  private storagePath: string;

  constructor(storagePath: string = './.aichitect/checkpoints') {
    this.storagePath = storagePath;
  }

  /**
   * Initialize the storage
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
  }

  /**
   * Save a checkpoint
   */
  public async save(checkpoint: CheckpointMetadata, data: Buffer): Promise<boolean> {
    try {
      // Create checkpoint directory
      const checkpointDir = path.join(this.storagePath, checkpoint.id);
      await fs.mkdir(checkpointDir, { recursive: true });

      // Save metadata
      const metadataPath = path.join(checkpointDir, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(checkpoint, null, 2));

      // Save data
      const dataPath = path.join(checkpointDir, 'data.bin');
      await fs.writeFile(dataPath, data);

      return true;
    } catch (error) {
      console.error(`Failed to save checkpoint ${checkpoint.id}:`, error);
      return false;
    }
  }

  /**
   * Load a checkpoint
   */
  public async load(id: string): Promise<{ metadata: CheckpointMetadata; data: Buffer } | null> {
    try {
      const checkpointDir = path.join(this.storagePath, id);

      // Check if checkpoint exists
      try {
        await fs.access(checkpointDir);
      } catch {
        return null;
      }

      // Load metadata
      const metadataPath = path.join(checkpointDir, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent) as CheckpointMetadata;

      // Load data
      const dataPath = path.join(checkpointDir, 'data.bin');
      const data = await fs.readFile(dataPath);

      return { metadata, data };
    } catch (error) {
      console.error(`Failed to load checkpoint ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete a checkpoint
   */
  public async delete(id: string): Promise<boolean> {
    try {
      const checkpointDir = path.join(this.storagePath, id);
      await fs.rm(checkpointDir, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error(`Failed to delete checkpoint ${id}:`, error);
      return false;
    }
  }

  /**
   * List all checkpoints
   */
  public async list(): Promise<CheckpointMetadata[]> {
    try {
      const checkpointDirs = await fs.readdir(this.storagePath);
      const checkpoints: CheckpointMetadata[] = [];

      for (const dir of checkpointDirs) {
        const metadataPath = path.join(this.storagePath, dir, 'metadata.json');
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent) as CheckpointMetadata;
          checkpoints.push(metadata);
        } catch (error) {
          // Skip invalid checkpoint directories
          console.warn(`Skipping invalid checkpoint directory ${dir}:`, error);
        }
      }

      // Sort by creation date (newest first)
      return checkpoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      console.error('Failed to list checkpoints:', error);
      return [];
    }
  }

  /**
   * Get checkpoint by name
   */
  public async getByName(name: string): Promise<CheckpointMetadata | null> {
    try {
      const checkpoints = await this.list();
      return checkpoints.find((cp) => cp.name === name) || null;
    } catch (error) {
      console.error(`Failed to get checkpoint by name ${name}:`, error);
      return null;
    }
  }
}

/**
 * Checkpoint and rollback manager
 */
export class CheckpointManager {
  private storage: CheckpointStorage;
  private app: AIrchitectApp;
  private maxCheckpoints: number;

  constructor(app: AIrchitectApp, storage?: CheckpointStorage, maxCheckpoints: number = 50) {
    this.app = app;
    this.storage = storage || new FileCheckpointStorage();
    this.maxCheckpoints = maxCheckpoints;
  }

  /**
   * Initialize the checkpoint manager
   */
  public async initialize(): Promise<boolean> {
    try {
      await this.storage.initialize();
      return true;
    } catch (error) {
      console.error('Failed to initialize checkpoint manager:', error);
      return false;
    }
  }

  /**
   * Create a new checkpoint
   */
  public async createCheckpoint(
    name: string,
    description?: string,
    tags: string[] = []
  ): Promise<string | null> {
    try {
      // Capture current project state
      const projectState = await this.captureProjectState();

      // Generate state hash
      const stateHash = this.calculateStateHash(projectState);

      // Create checkpoint metadata
      const checkpoint: CheckpointMetadata = {
        id: this.generateCheckpointId(),
        name,
        description,
        createdAt: new Date(),
        stateHash,
        tags,
        size: projectState.length,
        parentId: undefined, // TODO: Implement checkpoint chaining
      };

      // Save checkpoint
      const success = await this.storage.save(checkpoint, projectState);

      if (success) {
        console.log(`Checkpoint "${name}" created successfully`);

        // Enforce checkpoint limit
        await this.enforceCheckpointLimit();

        return checkpoint.id;
      } else {
        console.error(`Failed to create checkpoint "${name}"`);
        return null;
      }
    } catch (error) {
      console.error(`Error creating checkpoint "${name}":`, error);
      return null;
    }
  }

  /**
   * Restore a checkpoint
   */
  public async restoreCheckpoint(id: string): Promise<boolean> {
    try {
      // Load checkpoint
      const checkpointData = await this.storage.load(id);

      if (!checkpointData) {
        console.error(`Checkpoint ${id} not found`);
        return false;
      }

      const { metadata, data } = checkpointData;

      // Validate state hash
      const currentState = await this.captureProjectState();
      const currentStateHash = this.calculateStateHash(currentState);

      if (currentStateHash !== metadata.stateHash) {
        console.warn(`Current state differs from checkpoint state. Proceeding with restoration...`);
      }

      // Restore project state
      const success = await this.restoreProjectState(data);

      if (success) {
        console.log(`Checkpoint "${metadata.name}" restored successfully`);
        return true;
      } else {
        console.error(`Failed to restore checkpoint "${metadata.name}"`);
        return false;
      }
    } catch (error) {
      console.error(`Error restoring checkpoint ${id}:`, error);
      return false;
    }
  }

  /**
   * List all checkpoints
   */
  public async listCheckpoints(): Promise<CheckpointMetadata[]> {
    try {
      return await this.storage.list();
    } catch (error) {
      console.error('Failed to list checkpoints:', error);
      return [];
    }
  }

  /**
   * Delete a checkpoint
   */
  public async deleteCheckpoint(id: string): Promise<boolean> {
    try {
      const success = await this.storage.delete(id);

      if (success) {
        console.log(`Checkpoint ${id} deleted successfully`);
      } else {
        console.error(`Failed to delete checkpoint ${id}`);
      }

      return success;
    } catch (error) {
      console.error(`Error deleting checkpoint ${id}:`, error);
      return false;
    }
  }

  /**
   * Get checkpoint by name
   */
  public async getCheckpointByName(name: string): Promise<CheckpointMetadata | null> {
    try {
      return await this.storage.getByName(name);
    } catch (error) {
      console.error(`Error getting checkpoint by name ${name}:`, error);
      return null;
    }
  }

  /**
   * Capture current project state
   */
  private async captureProjectState(): Promise<Buffer> {
    // In a real implementation, this would capture the entire project state
    // For now, we'll simulate with some basic project information

    const projectInfo = {
      timestamp: new Date().toISOString(),
      cwd: process.cwd(),
      gitBranch: await this.getCurrentGitBranch(),
      files: await this.getProjectFiles(),
      memory: await this.app.getProjectMemory().getAllEntries(),
      config: await this.app.getConfig(),
    };

    return Buffer.from(JSON.stringify(projectInfo));
  }

  /**
   * Restore project state from data
   */
  private async restoreProjectState(data: Buffer): Promise<boolean> {
    try {
      const projectInfo = JSON.parse(data.toString());

      // In a real implementation, this would restore the project state
      // For now, we'll just log the restoration
      console.log('Restoring project state:', projectInfo);

      // Update application state
      await this.app.updateConfig(projectInfo.config);

      // Restore memory
      for (const [key, value] of Object.entries(projectInfo.memory)) {
        await this.app.getProjectMemory().store(key, value);
      }

      return true;
    } catch (error) {
      console.error('Failed to restore project state:', error);
      return false;
    }
  }

  /**
   * Calculate hash of project state
   */
  private calculateStateHash(state: Buffer): string {
    return crypto.createHash('sha256').update(state).digest('hex');
  }

  /**
   * Generate a unique checkpoint ID
   */
  private generateCheckpointId(): string {
    return `cp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Get current Git branch
   */
  private async getCurrentGitBranch(): Promise<string | null> {
    try {
      // In a real implementation, this would execute a Git command
      // For now, we'll return a placeholder
      return 'main'; // Placeholder
    } catch (error) {
      return null;
    }
  }

  /**
   * Get project files
   */
  private async getProjectFiles(): Promise<string[]> {
    try {
      // In a real implementation, this would scan the project directory
      // For now, we'll return a placeholder list
      return ['package.json', 'tsconfig.json', 'README.md']; // Placeholder
    } catch (error) {
      return [];
    }
  }

  /**
   * Enforce checkpoint limit by deleting oldest checkpoints
   */
  private async enforceCheckpointLimit(): Promise<void> {
    try {
      const checkpoints = await this.listCheckpoints();

      if (checkpoints.length > this.maxCheckpoints) {
        // Sort by creation date (oldest first)
        const sortedCheckpoints = checkpoints.sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        );

        // Delete excess checkpoints
        const excessCount = checkpoints.length - this.maxCheckpoints;
        for (let i = 0; i < excessCount; i++) {
          await this.deleteCheckpoint(sortedCheckpoints[i].id);
        }
      }
    } catch (error) {
      console.error('Failed to enforce checkpoint limit:', error);
    }
  }

  /**
   * Create an automatic checkpoint
   */
  public async createAutomaticCheckpoint(reason: string): Promise<string | null> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const name = `auto-${reason}-${timestamp}`;
    const description = `Automatic checkpoint created for ${reason}`;
    const tags = ['automatic', reason];

    return await this.createCheckpoint(name, description, tags);
  }

  /**
   * Create a checkpoint before a risky operation
   */
  public async createPreOperationCheckpoint(operation: string): Promise<string | null> {
    return await this.createAutomaticCheckpoint(`before-${operation}`);
  }

  /**
   * Get checkpoint statistics
   */
  public async getStatistics(): Promise<{
    totalCheckpoints: number;
    oldestCheckpoint: Date | null;
    newestCheckpoint: Date | null;
    totalSize: number;
  }> {
    try {
      const checkpoints = await this.listCheckpoints();

      if (checkpoints.length === 0) {
        return {
          totalCheckpoints: 0,
          oldestCheckpoint: null,
          newestCheckpoint: null,
          totalSize: 0,
        };
      }

      const sortedCheckpoints = checkpoints.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );

      const totalSize = checkpoints.reduce((sum, cp) => sum + cp.size, 0);

      return {
        totalCheckpoints: checkpoints.length,
        oldestCheckpoint: sortedCheckpoints[0].createdAt,
        newestCheckpoint: sortedCheckpoints[sortedCheckpoints.length - 1].createdAt,
        totalSize,
      };
    } catch (error) {
      console.error('Failed to get checkpoint statistics:', error);
      return {
        totalCheckpoints: 0,
        oldestCheckpoint: null,
        newestCheckpoint: null,
        totalSize: 0,
      };
    }
  }
}
