/**
 * runner.ts
 *
 * Command execution engine for the AIrchitect CLI.
 * Handles command routing, execution, error handling, and performance tracking.
 */

import { Logger, LogLevel } from '../utils/Logger';
import { ErrorHandler, CLIError, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Command handler function type
 */
export type CommandHandler = (context: CommandContext) => Promise<CommandResult>;

/**
 * Command execution context
 */
export interface CommandContext {
  command: string;
  subcommand?: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  flags: Set<string>;
  logger: Logger;
  errorHandler: typeof ErrorHandler;
  metadata?: Record<string, unknown>;
}

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  exitCode: number;
  data?: unknown;
  error?: Error;
  message?: string;
  executionTime?: number;
}

/**
 * Command registration options
 */
export interface CommandRegistration {
  name: string;
  handler: CommandHandler;
  description?: string;
  aliases?: string[];
  retryable?: boolean;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Runner configuration
 */
export interface RunnerConfig {
  logger?: Logger;
  enableMetrics?: boolean;
  defaultTimeout?: number;
  maxRetries?: number;
}

/**
 * Command execution metrics
 */
interface CommandMetrics {
  count: number;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecuted: Date;
}

/**
 * CommandRunner class for executing commands
 */
export class CommandRunner {
  private commands: Map<string, CommandRegistration>;
  private metrics: Map<string, CommandMetrics>;
  private logger: Logger;
  private enableMetrics: boolean;
  private defaultTimeout: number;
  private maxRetries: number;
  private activeExecutions: Set<string>;

  /**
   * Creates a new CommandRunner instance
   * @param config - Runner configuration
   */
  constructor(config: RunnerConfig = {}) {
    this.commands = new Map();
    this.metrics = new Map();
    this.logger = config.logger ?? new Logger({ level: LogLevel.INFO, prefix: 'Runner' });
    this.enableMetrics = config.enableMetrics ?? true;
    this.defaultTimeout = config.defaultTimeout ?? 300000; // 5 minutes default
    this.maxRetries = config.maxRetries ?? 3;
    this.activeExecutions = new Set();
  }

  /**
   * Register a command handler
   * @param registration - Command registration details
   */
  public register(registration: CommandRegistration): void {
    const { name, handler, description, aliases, retryable, maxRetries, timeout } = registration;

    const commandReg: CommandRegistration = {
      name,
      handler,
      description,
      aliases: aliases ?? [],
      retryable: retryable ?? false,
      maxRetries: maxRetries ?? this.maxRetries,
      timeout: timeout ?? this.defaultTimeout,
    };

    // Register main command
    this.commands.set(name, commandReg);

    // Register aliases
    if (commandReg.aliases) {
      for (const alias of commandReg.aliases) {
        this.commands.set(alias, commandReg);
      }
    }

    this.logger.debug(`Registered command: ${name}`);
  }

  /**
   * Unregister a command
   * @param name - Command name
   * @returns True if command was unregistered
   */
  public unregister(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) {
      return false;
    }

    // Remove main command
    this.commands.delete(name);

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.delete(alias);
      }
    }

    this.logger.debug(`Unregistered command: ${name}`);
    return true;
  }

  /**
   * Execute a command
   * @param context - Command execution context
   * @returns Command execution result
   */
  public async execute(context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const commandKey = `${context.command}:${Date.now()}`;

    try {
      // Check if command exists
      const command = this.commands.get(context.command);
      if (!command) {
        throw new CLIError(
          `Unknown command: ${context.command}`,
          ErrorCategory.COMMAND_EXECUTION,
          ErrorSeverity.MEDIUM,
          'UNKNOWN_COMMAND',
          { command: context.command },
          [
            'Run "airchitect --help" to see available commands',
            'Check for typos in the command name',
          ]
        );
      }

      // Track active execution
      this.activeExecutions.add(commandKey);

      // Log command execution
      this.logger.debug(`Executing command: ${context.command}`);

      // Execute with timeout and retry logic
      const result = await this.executeWithRetry(command, context);

      // Calculate execution time
      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      // Record metrics
      if (this.enableMetrics) {
        this.recordMetrics(context.command, executionTime, result.success);
      }

      // Log completion
      this.logger.debug(
        `Command completed: ${context.command} (${result.success ? 'success' : 'failure'}, ${executionTime}ms)`
      );

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record metrics
      if (this.enableMetrics) {
        this.recordMetrics(context.command, executionTime, false);
      }

      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Command failed: ${context.command}`, error);

      return {
        success: false,
        exitCode: this.getExitCode(error),
        error: error instanceof Error ? error : new Error(String(error)),
        message: errorMessage,
        executionTime,
      };
    } finally {
      // Remove from active executions
      this.activeExecutions.delete(commandKey);
    }
  }

  /**
   * Execute command with retry logic
   * @param command - Command registration
   * @param context - Command context
   * @returns Command result
   */
  private async executeWithRetry(
    command: CommandRegistration,
    context: CommandContext
  ): Promise<CommandResult> {
    const maxRetries = command.retryable === true ? (command.maxRetries ?? this.maxRetries) : 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(command, context);

        // If successful or not retryable, return result
        if (result.success || !command.retryable) {
          return result;
        }

        // If failed and retryable, log retry attempt
        if (attempt < maxRetries) {
          this.logger.warn(`Command failed (attempt ${attempt}/${maxRetries}), retrying...`);
          await this.delay(this.calculateRetryDelay(attempt));
        }

        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries && command.retryable) {
          this.logger.warn(`Command failed (attempt ${attempt}/${maxRetries}), retrying...`);
          await this.delay(this.calculateRetryDelay(attempt));
        } else {
          throw error;
        }
      }
    }

    // All retries exhausted
    throw lastError ?? new Error(`Command failed after ${maxRetries} attempts`);
  }

  /**
   * Execute command with timeout
   * @param command - Command registration
   * @param context - Command context
   * @returns Command result
   */
  private async executeWithTimeout(
    command: CommandRegistration,
    context: CommandContext
  ): Promise<CommandResult> {
    const timeout = command.timeout ?? this.defaultTimeout;

    return Promise.race([
      command.handler(context),
      this.createTimeoutPromise(timeout, context.command),
    ]);
  }

  /**
   * Create a timeout promise
   * @param timeout - Timeout in milliseconds
   * @param commandName - Command name for error message
   * @returns Promise that rejects after timeout
   */
  private createTimeoutPromise(timeout: number, commandName: string): Promise<CommandResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new CLIError(
            `Command timed out after ${timeout}ms`,
            ErrorCategory.COMMAND_EXECUTION,
            ErrorSeverity.HIGH,
            'COMMAND_TIMEOUT',
            { command: commandName, timeout }
          )
        );
      }, timeout);
    });
  }

  /**
   * Calculate retry delay with exponential backoff
   * @param attempt - Attempt number
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc.
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  }

  /**
   * Delay execution
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get exit code from error
   * @param error - Error object
   * @returns Exit code
   */
  private getExitCode(error: unknown): number {
    if (error instanceof CLIError) {
      switch (error.severity) {
        case ErrorSeverity.LOW:
          return 2; // Usage error
        case ErrorSeverity.MEDIUM:
          return 1; // General error
        case ErrorSeverity.HIGH:
        case ErrorSeverity.CRITICAL:
          return 1; // Fatal error
        default:
          return 1;
      }
    }
    return 1; // Default error code
  }

  /**
   * Record command metrics
   * @param commandName - Command name
   * @param executionTime - Execution time in milliseconds
   * @param success - Whether execution was successful
   */
  private recordMetrics(commandName: string, executionTime: number, success: boolean): void {
    let metrics = this.metrics.get(commandName);

    if (!metrics) {
      metrics = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalExecutionTime: 0,
        avgExecutionTime: 0,
        minExecutionTime: Infinity,
        maxExecutionTime: 0,
        lastExecuted: new Date(),
      };
      this.metrics.set(commandName, metrics);
    }

    metrics.count++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    metrics.totalExecutionTime += executionTime;
    metrics.avgExecutionTime = metrics.totalExecutionTime / metrics.count;
    metrics.minExecutionTime = Math.min(metrics.minExecutionTime, executionTime);
    metrics.maxExecutionTime = Math.max(metrics.maxExecutionTime, executionTime);
    metrics.lastExecuted = new Date();
  }

  /**
   * Get metrics for a command
   * @param commandName - Command name
   * @returns Command metrics or undefined
   */
  public getMetrics(commandName: string): CommandMetrics | undefined {
    return this.metrics.get(commandName);
  }

  /**
   * Get all metrics
   * @returns Map of command names to metrics
   */
  public getAllMetrics(): Map<string, CommandMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics.clear();
    this.logger.debug('Reset all metrics');
  }

  /**
   * Check if command exists
   * @param name - Command name
   * @returns True if command exists
   */
  public hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered commands
   * @returns Array of command names
   */
  public getCommands(): string[] {
    return Array.from(new Set(Array.from(this.commands.keys())));
  }

  /**
   * Get command registration
   * @param name - Command name
   * @returns Command registration or undefined
   */
  public getCommand(name: string): CommandRegistration | undefined {
    return this.commands.get(name);
  }

  /**
   * Wait for all active executions to complete
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves when all executions complete
   */
  public async waitForActiveExecutions(timeout?: number): Promise<void> {
    const startTime = Date.now();
    const maxWait = timeout ?? 30000; // 30 seconds default

    while (this.activeExecutions.size > 0) {
      if (Date.now() - startTime > maxWait) {
        this.logger.warn(`Timeout waiting for ${this.activeExecutions.size} active executions`);
        break;
      }
      await this.delay(100);
    }
  }

  /**
   * Cleanup runner resources
   */
  public async cleanup(): Promise<void> {
    this.logger.debug('Cleaning up command runner...');

    // Wait for active executions
    await this.waitForActiveExecutions();

    // Clear commands and metrics
    this.commands.clear();
    this.metrics.clear();
    this.activeExecutions.clear();

    this.logger.debug('Command runner cleanup complete');
  }

  /**
   * Get runner status
   * @returns Runner status information
   */
  public getStatus(): {
    totalCommands: number;
    activeExecutions: number;
    metricsEnabled: boolean;
  } {
    return {
      totalCommands: this.commands.size,
      activeExecutions: this.activeExecutions.size,
      metricsEnabled: this.enableMetrics,
    };
  }
}
