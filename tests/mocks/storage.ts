/**
 * Mock implementations for storage and persistence layers
 */

import { jest } from '@jest/globals';

/**
 * Mock File System
 */
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  async readFile(path: string, encoding?: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  async writeFile(path: string, data: string, encoding?: string): Promise<void> {
    this.files.set(path, data);
  }

  async appendFile(path: string, data: string, encoding?: string): Promise<void> {
    const existing = this.files.get(path) || '';
    this.files.set(path, existing + data);
  }

  async unlink(path: string): Promise<void> {
    if (!this.files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    this.files.delete(path);
  }

  async mkdir(path: string, options?: any): Promise<void> {
    this.directories.add(path);
  }

  async rmdir(path: string): Promise<void> {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
    }
    this.directories.delete(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path);
  }

  async readdir(path: string): Promise<string[]> {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }
    const results: string[] = [];
    for (const [filePath] of this.files) {
      if (filePath.startsWith(path)) {
        const relative = filePath.substring(path.length + 1);
        if (!relative.includes('/') && !relative.includes('\\')) {
          results.push(relative);
        }
      }
    }
    return results;
  }

  async stat(path: string): Promise<any> {
    if (this.files.has(path)) {
      return {
        isFile: () => true,
        isDirectory: () => false,
        size: this.files.get(path)?.length || 0,
      };
    }
    if (this.directories.has(path)) {
      return {
        isFile: () => false,
        isDirectory: () => true,
        size: 0,
      };
    }
    throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

/**
 * Mock Storage (Key-Value Store)
 */
export class MockStorage {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.store.get(key);
  }

  async set(key: string, value: any): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async values(): Promise<any[]> {
    return Array.from(this.store.values());
  }

  async entries(): Promise<Array<[string, any]>> {
    return Array.from(this.store.entries());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    return this.store.size;
  }
}

/**
 * Mock Database
 */
export class MockDatabase {
  private collections: Map<string, Map<string, any>> = new Map();

  getCollection(name: string): Map<string, any> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  async insert(collection: string, id: string, data: any): Promise<void> {
    const coll = this.getCollection(collection);
    coll.set(id, { ...data, id, createdAt: new Date(), updatedAt: new Date() });
  }

  async findOne(collection: string, id: string): Promise<any> {
    const coll = this.getCollection(collection);
    return coll.get(id);
  }

  async find(collection: string, query?: any): Promise<any[]> {
    const coll = this.getCollection(collection);
    return Array.from(coll.values());
  }

  async update(collection: string, id: string, data: any): Promise<void> {
    const coll = this.getCollection(collection);
    const existing = coll.get(id);
    if (!existing) {
      throw new Error(`Document with id ${id} not found in ${collection}`);
    }
    coll.set(id, { ...existing, ...data, updatedAt: new Date() });
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const coll = this.getCollection(collection);
    return coll.delete(id);
  }

  async count(collection: string): Promise<number> {
    const coll = this.getCollection(collection);
    return coll.size;
  }

  async clear(collection?: string): Promise<void> {
    if (collection) {
      this.collections.delete(collection);
    } else {
      this.collections.clear();
    }
  }
}

/**
 * Mock Cache
 */
export class MockCache {
  private cache: Map<string, { value: any; expiry?: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expiry = ttl ? Date.now() + ttl * 1000 : undefined;
    this.cache.set(key, { value, expiry });
  }

  async delete(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }
}

/**
 * Mock Logger
 */
export class MockLogger {
  public logs: Array<{ level: string; message: string; meta?: any }> = [];

  log(level: string, message: string, meta?: any): void {
    this.logs.push({ level, message, meta });
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(level?: string): Array<{ level: string; message: string; meta?: any }> {
    if (!level) return this.logs;
    return this.logs.filter((log) => log.level === level);
  }
}

/**
 * Mock Configuration Manager
 */
export class MockConfigManager {
  private config: Map<string, any> = new Map();

  async get(key: string, defaultValue?: any): Promise<any> {
    return this.config.get(key) ?? defaultValue;
  }

  async set(key: string, value: any): Promise<void> {
    this.config.set(key, value);
  }

  async has(key: string): Promise<boolean> {
    return this.config.has(key);
  }

  async delete(key: string): Promise<boolean> {
    return this.config.delete(key);
  }

  async getAll(): Promise<Record<string, any>> {
    return Object.fromEntries(this.config.entries());
  }

  async clear(): Promise<void> {
    this.config.clear();
  }

  async load(config: Record<string, any>): Promise<void> {
    this.config.clear();
    Object.entries(config).forEach(([key, value]) => {
      this.config.set(key, value);
    });
  }
}

/**
 * Helper to create mock storage instances
 */
export const createMockStorage = () => ({
  fileSystem: new MockFileSystem(),
  storage: new MockStorage(),
  database: new MockDatabase(),
  cache: new MockCache(),
  logger: new MockLogger(),
  config: new MockConfigManager(),
});
