/**
 * CommandManager.ts
 *
 * Central command registry and execution manager for the AIrchitect CLI.
 * Provides command registration, discovery, and lifecycle management.
 */

import { BaseCommand } from '../core/cli/Command.interface';
import { CommandParser, IParsedArguments } from './CommandParser';
import { ErrorHandler, CLIError, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { Logger, LogLevel } from '../utils/Logger';
import { ProgressIndicator } from './ProgressIndicator';

/**
 * Command metadata
 */
export interface ICommandMetadata {
  name: string;
  description: string;
  category?: string;
  aliases?: string[];
  hidden?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
}

/**
 * Command execution context
 */
export interface ICommandContext {
  command: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  flags: Set<string>;
  logger: Logger;
  errorHandler: ErrorHandler;
  progress?: ProgressIndicator;
}

/**
 * Command hook types
 */
export type CommandHook = (context: ICommandContext) => Promise<void> | void;

/**
 * CommandManager class for managing CLI commands
 */
export class CommandManager {
  private commands: Map<string, BaseCommand>;
  private metadata: Map<string, ICommandMetadata>;
  private aliases: Map<string, string>;
  private beforeHooks: CommandHook[];
  private afterHooks: CommandHook[];
  private errorHandler: ErrorHandler;
  private logger: Logger;

  /**
   * Creates a new CommandManager instance
   */
  constructor() {
    this.commands = new Map();
    this.metadata = new Map();
    this.aliases = new Map();
    this.beforeHooks = [];
    this.afterHooks = [];
    this.errorHandler = new ErrorHandler({ exitOnError: false });
    this.logger = new Logger({ level: LogLevel.INFO, prefix: 'CommandManager' });
  }

  /**
   * Register a command
   * @param command - Command to register
   * @param metadata - Command metadata
   */
  public register(command: BaseCommand, metadata?: Partial<ICommandMetadata>): void {
    const commandMetadata: ICommandMetadata = {
      name: command.name,
      description: command.description,
      category: metadata?.category,
      aliases: metadata?.aliases ?? [],
      hidden: metadata?.hidden ?? false,
      deprecated: metadata?.deprecated ?? false,
      deprecationMessage: metadata?.deprecationMessage,
    };

    // Register command
    this.commands.set(command.name, command);
    this.metadata.set(command.name, commandMetadata);

    // Register aliases
    if (commandMetadata.aliases) {
      for (const alias of commandMetadata.aliases) {
        this.aliases.set(alias, command.name);
      }
    }

    this.logger.debug(`Registered command: ${command.name}`);
  }

  /**
   * Register multiple commands
   * @param commands - Array of commands with metadata
   */
  public registerMultiple(
    commands: Array<{ command: BaseCommand; metadata?: Partial<ICommandMetadata> }>
  ): void {
    for (const { command, metadata } of commands) {
      this.register(command, metadata);
    }
  }

  /**
   * Unregister a command
   * @param name - Command name to unregister
   */
  public unregister(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) {
      return false;
    }

    // Remove aliases
    const meta = this.metadata.get(name);
    if (meta?.aliases) {
      for (const alias of meta.aliases) {
        this.aliases.delete(alias);
      }
    }

    this.commands.delete(name);
    this.metadata.delete(name);
    this.logger.debug(`Unregistered command: ${name}`);
    return true;
  }

  /**
   * Get a command by name or alias
   * @param nameOrAlias - Command name or alias
   * @returns Command or undefined
   */
  public getCommand(nameOrAlias: string): BaseCommand | undefined {
    // Check direct name
    let command = this.commands.get(nameOrAlias);
    if (command) {
      return command;
    }

    // Check alias
    const actualName = this.aliases.get(nameOrAlias);
    if (actualName) {
      command = this.commands.get(actualName);
    }

    return command;
  }

  /**
   * Get command metadata
   * @param name - Command name
   * @returns Command metadata or undefined
   */
  public getMetadata(name: string): ICommandMetadata | undefined {
    return this.metadata.get(name);
  }

  /**
   * Check if a command exists
   * @param nameOrAlias - Command name or alias
   * @returns True if command exists
   */
  public hasCommand(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get all registered commands
   * @param includeHidden - Include hidden commands
   * @returns Array of command metadata
   */
  public getAllCommands(includeHidden: boolean = false): ICommandMetadata[] {
    const commands: ICommandMetadata[] = [];

    for (const [name, meta] of this.metadata.entries()) {
      if (!includeHidden && meta.hidden === true) {
        continue;
      }
      commands.push(meta);
    }

    return commands;
  }

  /**
   * Get commands by category
   * @param category - Category to filter by
   * @returns Array of command metadata
   */
  public getCommandsByCategory(category: string): ICommandMetadata[] {
    const commands: ICommandMetadata[] = [];

    for (const [name, meta] of this.metadata.entries()) {
      if (meta.category === category) {
        commands.push(meta);
      }
    }

    return commands;
  }

  /**
   * Execute a command
   * @param commandName - Command name to execute
   * @param parsedArgs - Parsed command arguments
   * @returns Execution result
   */
  public async execute(commandName: string, parsedArgs: IParsedArguments): Promise<void> {
    const command = this.getCommand(commandName);

    if (!command) {
      throw new CLIError(
        `Unknown command: ${commandName}`,
        ErrorCategory.COMMAND_EXECUTION,
        ErrorSeverity.MEDIUM,
        'UNKNOWN_COMMAND',
        { command: commandName },
        ['Run "ai help" to see available commands', 'Check for typos in the command name']
      );
    }

    const metadata = this.getMetadata(command.name);

    // Check if deprecated
    if (metadata?.deprecated === true) {
      const message = metadata.deprecationMessage ?? `Command "${command.name}" is deprecated`;
      this.logger.warn(message);
    }

    // Create execution context
    const context: ICommandContext = {
      command: command.name,
      args: parsedArgs.args,
      options: parsedArgs.options,
      flags: parsedArgs.flags,
      logger: this.logger.child(command.name),
      errorHandler: this.errorHandler,
    };

    try {
      // Run before hooks
      await this.runHooks(this.beforeHooks, context);

      // Execute command
      this.logger.debug(`Executing command: ${command.name}`);
      await command.execute(parsedArgs.args, parsedArgs.options, parsedArgs.flags);

      // Run after hooks
      await this.runHooks(this.afterHooks, context);

      this.logger.debug(`Command executed successfully: ${command.name}`);
    } catch (error) {
      this.logger.error(`Command execution failed: ${command.name}`);
      this.errorHandler.handle(error, `Command: ${command.name}`);
      throw error;
    }
  }

  /**
   * Run command hooks
   * @param hooks - Array of hooks to run
   * @param context - Command execution context
   */
  private async runHooks(hooks: CommandHook[], context: ICommandContext): Promise<void> {
    for (const hook of hooks) {
      try {
        await hook(context);
      } catch (error) {
        this.logger.warn(
          `Hook execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Add a before hook
   * @param hook - Hook to add
   */
  public addBeforeHook(hook: CommandHook): void {
    this.beforeHooks.push(hook);
  }

  /**
   * Add an after hook
   * @param hook - Hook to add
   */
  public addAfterHook(hook: CommandHook): void {
    this.afterHooks.push(hook);
  }

  /**
   * Remove a before hook
   * @param hook - Hook to remove
   */
  public removeBeforeHook(hook: CommandHook): void {
    const index = this.beforeHooks.indexOf(hook);
    if (index > -1) {
      this.beforeHooks.splice(index, 1);
    }
  }

  /**
   * Remove an after hook
   * @param hook - Hook to remove
   */
  public removeAfterHook(hook: CommandHook): void {
    const index = this.afterHooks.indexOf(hook);
    if (index > -1) {
      this.afterHooks.splice(index, 1);
    }
  }

  /**
   * Set error handler
   * @param errorHandler - Error handler to use
   */
  public setErrorHandler(errorHandler: ErrorHandler): void {
    this.errorHandler = errorHandler;
  }

  /**
   * Set logger
   * @param logger - Logger to use
   */
  public setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Validate command arguments
   * @param command - Command to validate
   * @param args - Arguments to validate
   * @returns True if valid
   */
  public validateCommand(command: BaseCommand, ...args: unknown[]): boolean {
    if (command.validate) {
      try {
        return command.validate(...args);
      } catch (error) {
        this.errorHandler.handle(error, `Validation: ${command.name}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Get command names (including aliases)
   * @returns Array of command names and aliases
   */
  public getCommandNames(): string[] {
    const names = Array.from(this.commands.keys());
    const aliasNames = Array.from(this.aliases.keys());
    return [...names, ...aliasNames];
  }

  /**
   * Clear all commands
   */
  public clear(): void {
    this.commands.clear();
    this.metadata.clear();
    this.aliases.clear();
    this.logger.debug('Cleared all commands');
  }
}
