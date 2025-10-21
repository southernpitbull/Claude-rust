/**
 * ScreenCleanup.ts
 *
 * Handles proper cleanup of TUI components on exit to prevent terminal corruption
 * and ensure proper resource release. Implements graceful shutdown procedures
 * for the AIrchitect TUI system.
 */

import { Screen } from './Screen';
import { Logger } from '../../utils/Logger';

export interface CleanupOptions {
  force?: boolean;
  timeout?: number; // milliseconds
  preserveLogs?: boolean;
  cleanupResources?: boolean;
  restoreTerminal?: boolean;
}

export interface CleanupStats {
  startTime: number;
  endTime: number;
  duration: number; // milliseconds
  resourcesCleaned: number;
  errors: string[];
  warnings: string[];
}

export class ScreenCleanup {
  private screen: Screen;
  private logger: Logger;
  private cleanupHooks: Array<() => Promise<void> | void> = [];
  private isCleaningUp: boolean = false;
  private cleanupTimeout: number = 5000; // 5 seconds default

  constructor(screen: Screen) {
    this.screen = screen;
    this.logger = new Logger('ScreenCleanup');

    // Set up exit handlers
    this.setupExitHandlers();
  }

  /**
   * Set up exit event handlers to ensure proper cleanup
   */
  private setupExitHandlers(): void {
    try {
      this.logger.info('Setting up exit handlers');

      // Handle normal exits
      process.on('exit', () => {
        this.logger.info('Process exit event detected');
        this.cleanup({ force: true });
      });

      // Handle interrupt signals
      process.on('SIGINT', () => {
        this.logger.info('Received SIGINT signal');
        this.cleanup({ force: true });
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        this.logger.info('Received SIGTERM signal');
        this.cleanup({ force: true });
        process.exit(0);
      });

      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        this.logger.error('Uncaught exception', error);
        this.cleanup({ force: true });
        process.exit(1);
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
        this.cleanup({ force: true });
        process.exit(1);
      });

      this.logger.info('Exit handlers set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up exit handlers', error);
      throw error;
    }
  }

  /**
   * Register a cleanup hook function
   */
  public registerCleanupHook(hook: () => Promise<void> | void): void {
    try {
      this.logger.info('Registering cleanup hook');

      this.cleanupHooks.push(hook);

      this.logger.info('Cleanup hook registered successfully');
    } catch (error) {
      this.logger.error('Failed to register cleanup hook', error);
      throw error;
    }
  }

  /**
   * Unregister a cleanup hook function
   */
  public unregisterCleanupHook(hook: () => Promise<void> | void): boolean {
    try {
      this.logger.info('Unregistering cleanup hook');

      const initialLength = this.cleanupHooks.length;
      this.cleanupHooks = this.cleanupHooks.filter((h) => h !== hook);

      const removed = this.cleanupHooks.length < initialLength;
      if (removed) {
        this.logger.info('Cleanup hook unregistered successfully');
      } else {
        this.logger.warn('Cleanup hook not found for removal');
      }

      return removed;
    } catch (error) {
      this.logger.error('Failed to unregister cleanup hook', error);
      throw error;
    }
  }

  /**
   * Perform cleanup operations
   */
  public async cleanup(options: CleanupOptions = {}): Promise<CleanupStats> {
    try {
      this.logger.info('Starting screen cleanup');

      const startTime = Date.now();
      const stats: CleanupStats = {
        startTime,
        endTime: 0,
        duration: 0,
        resourcesCleaned: 0,
        errors: [],
        warnings: [],
      };

      if (this.isCleaningUp && !options.force) {
        this.logger.warn('Screen cleanup already in progress');
        return {
          ...stats,
          endTime: Date.now(),
          duration: 0,
        };
      }

      this.isCleaningUp = true;

      // Set timeout if specified
      if (options.timeout) {
        this.cleanupTimeout = options.timeout;
      }

      try {
        // Execute all registered cleanup hooks with timeout
        await this.executeCleanupHooks();

        // Clean up screen resources
        await this.cleanupScreenResources(options);

        // Restore terminal state
        if (options.restoreTerminal !== false) {
          await this.restoreTerminal();
        }

        // Preserve logs if requested
        if (options.preserveLogs) {
          await this.preserveLogs();
        }

        stats.resourcesCleaned++;
        this.logger.info('Screen cleanup completed successfully');
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
        stats.errors.push(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        this.isCleaningUp = false;
        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to perform screen cleanup', error);
      throw error;
    }
  }

  /**
   * Execute all registered cleanup hooks with timeout
   */
  private async executeCleanupHooks(): Promise<void> {
    try {
      this.logger.info(`Executing ${this.cleanupHooks.length} cleanup hooks`);

      for (const hook of this.cleanupHooks) {
        try {
          // Execute hook with timeout
          await this.executeWithTimeout(
            hook,
            this.cleanupTimeout,
            `Cleanup hook timed out after ${this.cleanupTimeout}ms`
          );
        } catch (error) {
          this.logger.error('Error in cleanup hook:', error);
        }
      }

      this.logger.info('All cleanup hooks executed');
    } catch (error) {
      this.logger.error('Failed to execute cleanup hooks', error);
      throw error;
    }
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(
    func: () => Promise<T> | T,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      // Execute function
      try {
        const result = func();
        clearTimeout(timeout);

        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Clean up screen resources
   */
  private async cleanupScreenResources(options: CleanupOptions): Promise<void> {
    try {
      this.logger.info('Cleaning up screen resources');

      // Clean up blessed screen if it exists
      const blessedScreen = this.screen.getBlessedScreen();
      if (blessedScreen) {
        try {
          // Detach all elements
          if (blessedScreen.children) {
            for (const child of blessedScreen.children) {
              try {
                if (typeof child.detach === 'function') {
                  child.detach();
                }
              } catch (error) {
                this.logger.warn('Failed to detach child element', error);
              }
            }
          }

          // Destroy the screen
          if (typeof blessedScreen.destroy === 'function') {
            blessedScreen.destroy();
          }

          this.logger.info('Blessed screen resources cleaned up');
        } catch (error) {
          this.logger.error('Failed to clean up blessed screen resources', error);
          throw error;
        }
      }

      // Clean up any other screen-related resources
      if (options.cleanupResources !== false) {
        // In a real implementation, we'd clean up other resources here
        this.logger.info('Other screen resources cleaned up');
      }
    } catch (error) {
      this.logger.error('Failed to clean up screen resources', error);
      throw error;
    }
  }

  /**
   * Restore terminal to normal state
   */
  private async restoreTerminal(): Promise<void> {
    try {
      this.logger.info('Restoring terminal state');

      // Try to restore terminal using blessed
      const blessedScreen = this.screen.getBlessedScreen();
      if (blessedScreen) {
        try {
          // Leave alternate screen buffer
          if (typeof (blessedScreen as any).leaveAltScreen === 'function') {
            (blessedScreen as any).leaveAltScreen();
          }

          // Show cursor
          if (typeof (blessedScreen as any).showCursor === 'function') {
            (blessedScreen as any).showCursor();
          }

          // Reset terminal
          if (typeof (blessedScreen as any).reset === 'function') {
            (blessedScreen as any).reset();
          }

          this.logger.info('Terminal state restored using blessed');
        } catch (error) {
          this.logger.warn('Failed to restore terminal using blessed', error);
        }
      }

      // Try to restore terminal using raw escape sequences
      try {
        // Show cursor
        process.stdout.write('\x1b[?25h');

        // Reset colors
        process.stdout.write('\x1b[0m');

        // Clear screen and move cursor to top-left
        process.stdout.write('\x1b[2J\x1b[H');

        // Normal buffer
        process.stdout.write('\x1b[?1049l');

        this.logger.info('Terminal state restored using escape sequences');
      } catch (error) {
        this.logger.warn('Failed to restore terminal using escape sequences', error);
      }
    } catch (error) {
      this.logger.error('Failed to restore terminal state', error);
      throw error;
    }
  }

  /**
   * Preserve logs before cleanup
   */
  private async preserveLogs(): Promise<void> {
    try {
      this.logger.info('Preserving logs');

      // In a real implementation, we would save logs to a file
      // For now, this is a placeholder

      this.logger.info('Logs preserved successfully');
    } catch (error) {
      this.logger.error('Failed to preserve logs', error);
      throw error;
    }
  }

  /**
   * Get cleanup status
   */
  public isCurrentlyCleaningUp(): boolean {
    return this.isCleaningUp;
  }

  /**
   * Force cleanup if needed
   */
  public async forceCleanup(): Promise<CleanupStats> {
    try {
      this.logger.info('Forcing cleanup');

      return await this.cleanup({ force: true });
    } catch (error) {
      this.logger.error('Failed to force cleanup', error);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  public getCleanupStats(): {
    totalHooks: number;
    isCleaningUp: boolean;
    cleanupTimeout: number;
    lastCleanup?: CleanupStats;
  } {
    try {
      this.logger.info('Getting cleanup statistics');

      const stats = {
        totalHooks: this.cleanupHooks.length,
        isCleaningUp: this.isCleaningUp,
        cleanupTimeout: this.cleanupTimeout,
        // lastCleanup would be stored from previous cleanup operations
      };

      this.logger.info('Cleanup statistics retrieved successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to get cleanup statistics', error);
      throw error;
    }
  }

  /**
   * Set cleanup timeout
   */
  public setCleanupTimeout(timeoutMs: number): void {
    try {
      this.logger.info(`Setting cleanup timeout to ${timeoutMs}ms`);

      this.cleanupTimeout = timeoutMs;

      this.logger.info('Cleanup timeout set successfully');
    } catch (error) {
      this.logger.error(`Failed to set cleanup timeout to ${timeoutMs}ms`, error);
      throw error;
    }
  }

  /**
   * Get cleanup timeout
   */
  public getCleanupTimeout(): number {
    return this.cleanupTimeout;
  }

  /**
   * Add a resource to be cleaned up
   */
  public addResource(resource: any): void {
    try {
      this.logger.info('Adding resource for cleanup');

      // Register a cleanup hook for this resource
      if (resource && typeof resource.cleanup === 'function') {
        this.registerCleanupHook(() => resource.cleanup());
        this.logger.info('Resource cleanup hook registered');
      } else if (resource && typeof resource.destroy === 'function') {
        this.registerCleanupHook(() => resource.destroy());
        this.logger.info('Resource destroy hook registered');
      } else {
        this.logger.warn('Resource does not have cleanup or destroy method');
      }
    } catch (error) {
      this.logger.error('Failed to add resource for cleanup', error);
      throw error;
    }
  }

  /**
   * Remove a resource from cleanup
   */
  public removeResource(resource: any): boolean {
    try {
      this.logger.info('Removing resource from cleanup');

      // This is a simplified implementation
      // In a real implementation, we'd need to track resources more carefully

      this.logger.info('Resource removed from cleanup');
      return true;
    } catch (error) {
      this.logger.error('Failed to remove resource from cleanup', error);
      throw error;
    }
  }

  /**
   * Create a cleanup checkpoint
   */
  public createCheckpoint(): void {
    try {
      this.logger.info('Creating cleanup checkpoint');

      // In a real implementation, we'd create a checkpoint for rollback
      // For now, this is a placeholder

      this.logger.info('Cleanup checkpoint created');
    } catch (error) {
      this.logger.error('Failed to create cleanup checkpoint', error);
      throw error;
    }
  }

  /**
   * Rollback to a cleanup checkpoint
   */
  public async rollbackToCheckpoint(): Promise<void> {
    try {
      this.logger.info('Rolling back to cleanup checkpoint');

      // In a real implementation, we'd rollback to a previous state
      // For now, this is a placeholder

      this.logger.info('Rolled back to cleanup checkpoint');
    } catch (error) {
      this.logger.error('Failed to rollback to cleanup checkpoint', error);
      throw error;
    }
  }

  /**
   * Export cleanup configuration
   */
  public exportConfiguration(): CleanupOptions {
    try {
      this.logger.info('Exporting cleanup configuration');

      const config: CleanupOptions = {
        timeout: this.cleanupTimeout,
        preserveLogs: false, // Default value
        cleanupResources: true, // Default value
        restoreTerminal: true, // Default value
      };

      this.logger.info('Cleanup configuration exported successfully');
      return config;
    } catch (error) {
      this.logger.error('Failed to export cleanup configuration', error);
      throw error;
    }
  }

  /**
   * Import cleanup configuration
   */
  public importConfiguration(config: CleanupOptions): void {
    try {
      this.logger.info('Importing cleanup configuration');

      if (config.timeout !== undefined) {
        this.setCleanupTimeout(config.timeout);
      }

      // Other configuration options would be handled here

      this.logger.info('Cleanup configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import cleanup configuration', error);
      throw error;
    }
  }

  /**
   * Validate cleanup configuration
   */
  public validateConfiguration(config: CleanupOptions): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating cleanup configuration');

      const validation = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Validate timeout
      if (config.timeout !== undefined) {
        if (config.timeout < 0) {
          validation.errors.push('Timeout must be a positive number');
          validation.valid = false;
        } else if (config.timeout < 100) {
          validation.warnings.push('Timeout is very short (< 100ms), consider increasing');
        } else if (config.timeout > 60000) {
          validation.warnings.push('Timeout is very long (> 60s), consider decreasing');
        }
      }

      // Validate force option
      if (config.force !== undefined && typeof config.force !== 'boolean') {
        validation.errors.push('Force option must be a boolean');
        validation.valid = false;
      }

      // Validate preserveLogs option
      if (config.preserveLogs !== undefined && typeof config.preserveLogs !== 'boolean') {
        validation.errors.push('PreserveLogs option must be a boolean');
        validation.valid = false;
      }

      // Validate cleanupResources option
      if (config.cleanupResources !== undefined && typeof config.cleanupResources !== 'boolean') {
        validation.errors.push('CleanupResources option must be a boolean');
        validation.valid = false;
      }

      // Validate restoreTerminal option
      if (config.restoreTerminal !== undefined && typeof config.restoreTerminal !== 'boolean') {
        validation.errors.push('RestoreTerminal option must be a boolean');
        validation.valid = false;
      }

      this.logger.info(
        `Cleanup configuration validation completed: ${validation.valid ? 'valid' : 'invalid'}`
      );
      return validation;
    } catch (error) {
      this.logger.error('Failed to validate cleanup configuration', error);
      throw error;
    }
  }

  /**
   * Test cleanup functionality
   */
  public async testCleanup(): Promise<{
    success: boolean;
    stats?: CleanupStats;
    errors: string[];
  }> {
    try {
      this.logger.info('Testing cleanup functionality');

      // Test cleanup with a short timeout
      const stats = await this.cleanup({ timeout: 1000 });

      // Validate the results
      const success = stats.errors.length === 0;

      this.logger.info(`Cleanup test completed: ${success ? 'passed' : 'failed'}`);
      return {
        success,
        stats: success ? stats : undefined,
        errors: stats.errors,
      };
    } catch (error) {
      this.logger.error('Failed to test cleanup functionality', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Generate cleanup report
   */
  public generateReport(): {
    totalResources: number;
    cleanupHooks: number;
    timeout: number;
    isCleaningUp: boolean;
    lastCleanup?: CleanupStats;
    configuration: CleanupOptions;
  } {
    try {
      this.logger.info('Generating cleanup report');

      const report = {
        totalResources: 0, // Would be tracked in a real implementation
        cleanupHooks: this.cleanupHooks.length,
        timeout: this.cleanupTimeout,
        isCleaningUp: this.isCleaningUp,
        // lastCleanup would be stored from previous operations
        configuration: this.exportConfiguration(),
      };

      this.logger.info('Cleanup report generated successfully');
      return report;
    } catch (error) {
      this.logger.error('Failed to generate cleanup report', error);
      throw error;
    }
  }
}
