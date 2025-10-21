/**
 * ConfigMigration.ts
 *
 * Configuration migration system for handling version upgrades.
 * Supports forward and backward migrations with validation and rollback.
 *
 * @module config/ConfigMigration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { Config, PartialConfig } from './ConfigSchema';
import { ConfigValidator } from './ConfigValidator';
import { DEFAULT_CONFIG } from './ConfigDefaults';

/**
 * Migration direction
 */
export type MigrationDirection = 'up' | 'down';

/**
 * Migration function type
 */
export type MigrationFn = (config: unknown) => Promise<unknown> | unknown;

/**
 * Migration definition
 */
export interface Migration {
  version: string;
  description: string;
  up: MigrationFn;
  down: MigrationFn;
}

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migrationsApplied: string[];
  errors?: string[];
}

/**
 * Migration options
 */
export interface MigrationOptions {
  backupPath?: string;
  validateAfter?: boolean;
  dryRun?: boolean;
}

/**
 * Configuration migration manager
 *
 * Handles version migrations for configuration files:
 * - Version detection
 * - Sequential migration execution
 * - Backup before migration
 * - Validation after migration
 * - Rollback support
 */
export class ConfigMigration {
  private migrations: Map<string, Migration> = new Map();
  private validator: ConfigValidator;
  private options: Required<MigrationOptions>;

  /**
   * Create a new ConfigMigration instance
   *
   * @param {MigrationOptions} options - Migration options
   */
  constructor(options: MigrationOptions = {}) {
    this.validator = new ConfigValidator('strict');
    this.options = {
      backupPath: options.backupPath || './.aichitect/backups',
      validateAfter: options.validateAfter ?? true,
      dryRun: options.dryRun ?? false,
    };

    this.initializeMigrations();
  }

  /**
   * Initialize built-in migrations
   */
  private initializeMigrations(): void {
    // Migration from 0.x to 1.0.0
    this.registerMigration({
      version: '1.0.0',
      description: 'Initial migration to v1.0.0 structure',
      up: async (config: unknown) => {
        const cfg = config as Record<string, unknown>;

        // Add new fields introduced in 1.0.0
        return {
          ...cfg,
          version: '1.0.0',
          checkpoint: cfg.checkpoint || {
            enabled: true,
            interval: 30,
            maxCheckpoints: 50,
            autoCleanup: true,
          },
        };
      },
      down: async (config: unknown) => {
        const cfg = config as Record<string, unknown>;
        const { checkpoint, ...rest } = cfg;
        return rest;
      },
    });

    // Example: Migration from 1.0.0 to 1.1.0
    this.registerMigration({
      version: '1.1.0',
      description: 'Add memory configuration',
      up: async (config: unknown) => {
        const cfg = config as Record<string, unknown>;

        // Add memory field if not present
        if (!cfg.memory) {
          cfg.memory = {
            provider: 'llamaindex',
            vectorStore: {
              provider: 'llamaindex',
              dimensions: 1536,
              indexType: 'flat',
            },
            maxSize: 500 * 1024 * 1024,
            enabled: true,
          };
        }

        cfg.version = '1.1.0';
        return cfg;
      },
      down: async (config: unknown) => {
        const cfg = config as Record<string, unknown>;
        const { memory, ...rest } = cfg;
        rest.version = '1.0.0';
        return rest;
      },
    });
  }

  /**
   * Register a migration
   *
   * @param {Migration} migration - Migration to register
   */
  public registerMigration(migration: Migration): void {
    this.migrations.set(migration.version, migration);
  }

  /**
   * Remove a migration
   *
   * @param {string} version - Version to remove
   * @returns {boolean} True if removed
   */
  public unregisterMigration(version: string): boolean {
    return this.migrations.delete(version);
  }

  /**
   * Migrate configuration to a specific version
   *
   * @param {unknown} config - Configuration to migrate
   * @param {string} targetVersion - Target version
   * @returns {Promise<MigrationResult>} Migration result
   */
  public async migrate(config: unknown, targetVersion: string): Promise<MigrationResult> {
    const cfg = config as PartialConfig;
    const currentVersion = this.detectVersion(cfg);

    // Check if migration is needed
    if (currentVersion === targetVersion) {
      return {
        success: true,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsApplied: [],
      };
    }

    // Get migration path
    const migrationPath = this.getMigrationPath(currentVersion, targetVersion);

    if (migrationPath.length === 0) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsApplied: [],
        errors: [`No migration path found from ${currentVersion} to ${targetVersion}`],
      };
    }

    // Backup configuration
    if (!this.options.dryRun) {
      await this.backupConfig(config, currentVersion);
    }

    // Apply migrations
    let migratedConfig = config;
    const applied: string[] = [];
    const errors: string[] = [];

    try {
      for (const version of migrationPath) {
        const migration = this.migrations.get(version);
        if (!migration) {
          throw new Error(`Migration for version ${version} not found`);
        }

        // Apply migration
        const direction: MigrationDirection =
          this.compareVersions(currentVersion, targetVersion) < 0 ? 'up' : 'down';

        migratedConfig =
          direction === 'up'
            ? await migration.up(migratedConfig)
            : await migration.down(migratedConfig);

        applied.push(version);
      }

      // Validate after migration
      if (this.options.validateAfter) {
        const result = this.validator.validate(migratedConfig);
        if (!result.success) {
          errors.push(...(result.errors?.map((e) => e.message) || []));
        }
      }

      return {
        success: errors.length === 0,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsApplied: applied,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        migrationsApplied: applied,
        errors: [error instanceof Error ? error.message : 'Unknown migration error'],
      };
    }
  }

  /**
   * Detect configuration version
   *
   * @param {PartialConfig} config - Configuration to check
   * @returns {string} Detected version
   */
  public detectVersion(config: PartialConfig): string {
    return config.version || '0.0.0';
  }

  /**
   * Get migration path between versions
   *
   * @param {string} fromVersion - Starting version
   * @param {string} toVersion - Target version
   * @returns {string[]} Array of versions to migrate through
   */
  public getMigrationPath(fromVersion: string, toVersion: string): string[] {
    const allVersions = Array.from(this.migrations.keys()).sort(this.compareVersions);

    const fromIndex = allVersions.indexOf(fromVersion);
    const toIndex = allVersions.indexOf(toVersion);

    if (fromIndex === -1 || toIndex === -1) {
      return [];
    }

    if (fromIndex < toIndex) {
      // Upgrade: get versions between from and to (inclusive of to)
      return allVersions.slice(fromIndex + 1, toIndex + 1);
    } else {
      // Downgrade: get versions between to and from (inclusive of from, reversed)
      return allVersions.slice(toIndex, fromIndex).reverse();
    }
  }

  /**
   * Check if a migration is needed
   *
   * @param {PartialConfig} config - Configuration to check
   * @param {string} targetVersion - Target version
   * @returns {boolean} True if migration is needed
   */
  public needsMigration(config: PartialConfig, targetVersion: string): boolean {
    const currentVersion = this.detectVersion(config);
    return currentVersion !== targetVersion;
  }

  /**
   * Get available migrations
   *
   * @returns {Migration[]} Array of available migrations
   */
  public getAvailableMigrations(): Migration[] {
    return Array.from(this.migrations.values());
  }

  /**
   * Backup configuration before migration
   *
   * @param {unknown} config - Configuration to backup
   * @param {string} version - Current version
   * @returns {Promise<string>} Path to backup file
   */
  public async backupConfig(config: unknown, version: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `config-${version}-${timestamp}.json`;
    const backupFilePath = path.join(this.options.backupPath, backupFileName);

    // Ensure backup directory exists
    await fs.mkdir(this.options.backupPath, { recursive: true });

    // Write backup
    await fs.writeFile(backupFilePath, JSON.stringify(config, null, 2), 'utf-8');

    return backupFilePath;
  }

  /**
   * Restore configuration from backup
   *
   * @param {string} backupPath - Path to backup file
   * @returns {Promise<unknown>} Restored configuration
   */
  public async restoreFromBackup(backupPath: string): Promise<unknown> {
    const content = await fs.readFile(backupPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * List available backups
   *
   * @returns {Promise<string[]>} Array of backup file paths
   */
  public async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.options.backupPath);
      return files
        .filter((f) => f.startsWith('config-') && f.endsWith('.json'))
        .map((f) => path.join(this.options.backupPath, f));
    } catch {
      return [];
    }
  }

  /**
   * Clean old backups (keep last N)
   *
   * @param {number} keepCount - Number of backups to keep
   * @returns {Promise<number>} Number of backups deleted
   */
  public async cleanBackups(keepCount: number = 10): Promise<number> {
    const backups = await this.listBackups();

    if (backups.length <= keepCount) {
      return 0;
    }

    // Sort by modification time (newest first)
    const backupsWithStats = await Promise.all(
      backups.map(async (backup) => ({
        path: backup,
        mtime: (await fs.stat(backup)).mtime,
      }))
    );

    backupsWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Delete old backups
    const toDelete = backupsWithStats.slice(keepCount);
    await Promise.all(toDelete.map((b) => fs.unlink(b.path)));

    return toDelete.length;
  }

  /**
   * Compare version strings
   *
   * @param {string} v1 - First version
   * @param {string} v2 - Second version
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
    const parts2 = v2.split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 < p2) {
        return -1;
      }
      if (p1 > p2) {
        return 1;
      }
    }

    return 0;
  }
}

/**
 * Create a migration instance
 *
 * @param {MigrationOptions} options - Migration options
 * @returns {ConfigMigration} Migration instance
 */
export function createMigration(options?: MigrationOptions): ConfigMigration {
  return new ConfigMigration(options);
}

/**
 * Quick migration helper
 *
 * @param {unknown} config - Configuration to migrate
 * @param {string} targetVersion - Target version
 * @returns {Promise<MigrationResult>} Migration result
 */
export async function migrateConfig(
  config: unknown,
  targetVersion: string
): Promise<MigrationResult> {
  const migration = new ConfigMigration();
  return await migration.migrate(config, targetVersion);
}
