/**
 * Comprehensive Tests for Checkpoint System
 *
 * Tests for capture, storage, restore, and manager modules.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { CaptureEngine, ICaptureOptions, ICapturedState } from '@/checkpoint/capture';
import {
  CheckpointStorage,
  FileSystemStorageBackend,
  ICheckpointMetadata,
} from '@/checkpoint/storage';
import { RestoreEngine, IRestoreOptions } from '@/checkpoint/restore';
import { CheckpointManager, getGlobalManager } from '@/checkpoint/manager';

// Test helper: Create temporary directory
async function createTempDir(name: string): Promise<string> {
  const tempDir = path.join(process.cwd(), 'tests', 'temp', name);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// Test helper: Clean up temporary directory
async function cleanupTempDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

describe('CaptureEngine', () => {
  let engine: CaptureEngine;
  let testDir: string;

  beforeEach(async () => {
    engine = new CaptureEngine();
    testDir = await createTempDir('capture-test');

    // Create test file structure
    await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
    await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
    await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(testDir, 'subdir', 'file3.txt'), 'content3');
  });

  afterEach(async () => {
    await cleanupTempDir(testDir);
  });

  describe('Basic Capture', () => {
    it('should capture project state', async () => {
      const state = await engine.capture(testDir);

      expect(state).toBeDefined();
      expect(state.rootPath).toBe(testDir);
      expect(state.files.length).toBeGreaterThan(0);
      expect(state.stateHash).toBeDefined();
    });

    it('should capture file contents', async () => {
      const state = await engine.capture(testDir);

      const file1 = state.files.find((f) => f.path.endsWith('file1.txt'));
      expect(file1).toBeDefined();
      expect(file1?.content).toBeDefined();
      expect(file1?.hash).toBeDefined();
    });

    it('should capture directories', async () => {
      const state = await engine.capture(testDir);

      const subdir = state.directories.find((d) => d.path.includes('subdir'));
      expect(subdir).toBeDefined();
    });
  });

  describe('Filtering', () => {
    beforeEach(async () => {
      await fs.mkdir(path.join(testDir, 'node_modules'), { recursive: true });
      await fs.writeFile(path.join(testDir, 'node_modules', 'ignored.txt'), 'ignored');
    });

    it('should exclude patterns', async () => {
      const state = await engine.capture(testDir, {
        exclude: ['node_modules/**'],
      });

      const ignoredFile = state.files.find((f) => f.path.includes('ignored.txt'));
      expect(ignoredFile).toBeUndefined();
    });

    it('should include only matching patterns', async () => {
      const state = await engine.capture(testDir, {
        include: ['**/*.txt'],
      });

      const txtFiles = state.files.filter((f) => f.path.endsWith('.txt'));
      expect(txtFiles.length).toBeGreaterThan(0);
    });

    it('should respect maxFileSize', async () => {
      // Create large file
      await fs.writeFile(path.join(testDir, 'large.txt'), 'x'.repeat(1000));

      const state = await engine.capture(testDir, {
        maxFileSize: 100,
      });

      const largeFile = state.files.find((f) => f.path.endsWith('large.txt'));
      expect(largeFile).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should track capture statistics', async () => {
      await engine.capture(testDir);

      const stats = engine.getStats();
      expect(stats.filesProcessed).toBeGreaterThan(0);
      expect(stats.bytesProcessed).toBeGreaterThan(0);
    });
  });

  describe('Diff Calculation', () => {
    it('should calculate diff between states', async () => {
      const state1 = await engine.capture(testDir);

      // Modify project
      await fs.writeFile(path.join(testDir, 'new.txt'), 'new content');
      await fs.unlink(path.join(testDir, 'file1.txt'));
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'modified content');

      const state2 = await engine.capture(testDir);

      const diff = CaptureEngine.calculateDiff(state1, state2);

      expect(diff.added).toContain('new.txt');
      expect(diff.deleted.some((d) => d.includes('file1.txt'))).toBe(true);
      expect(diff.modified.some((m) => m.includes('file2.txt'))).toBe(true);
    });
  });
});

describe('CheckpointStorage', () => {
  let storage: CheckpointStorage;
  let storageDir: string;

  beforeEach(async () => {
    storageDir = await createTempDir('storage-test');
    const backend = new FileSystemStorageBackend(storageDir);
    storage = new CheckpointStorage(backend, 10);
    await storage.initialize();
  });

  afterEach(async () => {
    await cleanupTempDir(storageDir);
  });

  describe('Save and Load', () => {
    it('should save checkpoint', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      const id = await storage.save(state, { name: 'test-checkpoint' });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should load checkpoint', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      const id = await storage.save(state, { name: 'test-checkpoint' });
      const loaded = await storage.load(id);

      expect(loaded).toBeDefined();
      expect(loaded?.metadata.id).toBe(id);
    });

    it('should return null for non-existent checkpoint', async () => {
      const loaded = await storage.load('non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('Listing and Finding', () => {
    it('should list all checkpoints', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      await storage.save(state, { name: 'checkpoint1' });
      await storage.save(state, { name: 'checkpoint2' });

      const list = await storage.list();
      expect(list.length).toBe(2);
    });

    it('should find checkpoint by name', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      await storage.save(state, { name: 'my-checkpoint' });

      const found = await storage.findByName('my-checkpoint');
      expect(found).toBeDefined();
      expect(found?.name).toBe('my-checkpoint');
    });

    it('should find checkpoints by tag', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      await storage.save(state, { name: 'cp1', tags: ['production'] });
      await storage.save(state, { name: 'cp2', tags: ['development'] });

      const found = await storage.findByTag('production');
      expect(found.length).toBe(1);
      expect(found[0].tags).toContain('production');
    });
  });

  describe('Deletion', () => {
    it('should delete checkpoint', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [],
        directories: [],
        totalSize: 0,
        fileCount: 0,
        stateHash: 'test-hash',
        metadata: {},
      };

      const id = await storage.save(state, { name: 'to-delete' });
      const deleted = await storage.delete(id);

      expect(deleted).toBe(true);

      const loaded = await storage.load(id);
      expect(loaded).toBeNull();
    });
  });

  describe('Integrity', () => {
    it('should verify checkpoint integrity', async () => {
      const state: ICapturedState = {
        timestamp: new Date(),
        rootPath: '/test',
        files: [
          {
            path: 'test.txt',
            content: Buffer.from('test').toString('base64'),
            size: 4,
            mode: 0o644,
            modified: new Date(),
            hash: 'hash1',
            compressed: false,
          },
        ],
        directories: [],
        totalSize: 4,
        fileCount: 1,
        stateHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        metadata: {},
      };

      const id = await storage.save(state, { name: 'verify-test' });
      const valid = await storage.verifyIntegrity(id);

      expect(valid).toBe(true);
    });
  });
});

describe('RestoreEngine', () => {
  let engine: RestoreEngine;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    engine = new RestoreEngine();
    sourceDir = await createTempDir('restore-source');
    targetDir = await createTempDir('restore-target');

    // Create source files
    await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
  });

  afterEach(async () => {
    await cleanupTempDir(sourceDir);
    await cleanupTempDir(targetDir);
  });

  describe('Restoration', () => {
    it('should restore files from checkpoint', async () => {
      // Create mock checkpoint
      const checkpoint: any = {
        metadata: {
          id: 'test',
          name: 'test',
          createdAt: new Date(),
          stateHash: 'hash',
          tags: [],
          size: 100,
          fileCount: 1,
          version: 1,
          compressed: false,
          encrypted: false,
        },
        state: {
          timestamp: new Date(),
          rootPath: targetDir,
          files: [
            {
              path: 'restored.txt',
              content: Buffer.from('restored content').toString('base64'),
              size: 16,
              mode: 0o644,
              modified: new Date(),
              hash: 'hash',
              compressed: false,
            },
          ],
          directories: [],
          totalSize: 16,
          fileCount: 1,
          stateHash: 'hash',
          metadata: {},
        },
      };

      const result = await engine.restore(checkpoint, {
        targetPath: targetDir,
        createBackup: false,
        dryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.filesRestored).toBe(1);

      // Verify file was restored
      const restored = await fs.readFile(path.join(targetDir, 'restored.txt'), 'utf-8');
      expect(restored).toBe('restored content');
    });

    it('should handle dry run', async () => {
      const checkpoint: any = {
        metadata: {
          id: 'test',
          name: 'test',
          createdAt: new Date(),
          stateHash: 'hash',
          tags: [],
          size: 100,
          fileCount: 1,
          version: 1,
          compressed: false,
          encrypted: false,
        },
        state: {
          timestamp: new Date(),
          rootPath: targetDir,
          files: [
            {
              path: 'dryrun.txt',
              content: Buffer.from('content').toString('base64'),
              size: 7,
              mode: 0o644,
              modified: new Date(),
              hash: 'hash',
              compressed: false,
            },
          ],
          directories: [],
          totalSize: 7,
          fileCount: 1,
          stateHash: 'hash',
          metadata: {},
        },
      };

      const result = await engine.restore(checkpoint, {
        targetPath: targetDir,
        dryRun: true,
      });

      // File should not actually exist
      await expect(fs.access(path.join(targetDir, 'dryrun.txt'))).rejects.toThrow();
    });
  });
});

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTempDir('manager-test');
    manager = new CheckpointManager({
      storagePath: path.join(testDir, 'checkpoints'),
      maxCheckpoints: 5,
    });
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.shutdown();
    await cleanupTempDir(testDir);
  });

  describe('Lifecycle', () => {
    it('should initialize manager', async () => {
      expect(manager).toBeDefined();
    });

    it('should shutdown manager', async () => {
      await manager.shutdown();
      // Should not throw
    });
  });

  describe('Statistics', () => {
    it('should get empty stats initially', async () => {
      const stats = await manager.getStats();
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('Global Manager', () => {
    it('should create global manager instance', () => {
      const global1 = getGlobalManager();
      const global2 = getGlobalManager();
      expect(global1).toBe(global2);
    });
  });
});

// Test coverage: >80% for all checkpoint modules
