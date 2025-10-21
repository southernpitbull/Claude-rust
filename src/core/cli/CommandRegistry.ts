/**
 * CommandRegistry.ts
 *
 * Implements a registry for CLI commands with validation, parsing, and execution capabilities.
 * Provides a centralized system for managing all application commands.
 */

import { Command } from 'commander';
import { BaseCommand } from './Command.interface';

export class CommandRegistry {
  private commands: Map<string, BaseCommand>;
  private program: Command;
  private initialized: boolean;

  constructor() {
    this.commands = new Map();
    this.program = new Command();
    this.initialized = false;
  }

  /**
   * Initialize the command registry and set up the main program
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    // Configure the main program
    this.program
      .name('airchitect')
      .description('Advanced AI-powered development assistant CLI')
      .version('0.1.0');

    this.initialized = true;
  }

  /**
   * Register a command with the registry
   * @param command - The command to register
   */
  public register(command: BaseCommand): void {
    if (!this.initialized) {
      this.initialize();
    }

    // Add command to internal registry
    this.commands.set(command.name, command);

    // Create a subcommand in the main program
    const subCommand = this.program
      .command(command.name)
      .description(command.description)
      .action(async (...args: any[]) => {
        try {
          await command.execute(...args);
        } catch (error) {
          console.error(`Error executing command ${command.name}:`, error);
          process.exit(1);
        }
      });

    // Add options if available
    if (command.options) {
      for (const option of command.options) {
        subCommand.option(option.flags, option.description, option.defaultValue);
      }
    }

    // Add arguments if available
    if (command.arguments) {
      for (const arg of command.arguments) {
        if (arg.required) {
          subCommand.argument(arg.name, arg.description);
        } else {
          subCommand.argument(`[<${arg.name}>]`, arg.description);
        }
      }
    }
  }

  /**
   * Register multiple commands at once
   * @param commands - Array of commands to register
   */
  public registerMultiple(commands: BaseCommand[]): void {
    for (const command of commands) {
      this.register(command);
    }
  }

  /**
   * Get a command by name
   * @param name - The name of the command to retrieve
   * @returns The command if found, undefined otherwise
   */
  public getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command exists in the registry
   * @param name - The name of the command to check
   * @returns True if the command exists, false otherwise
   */
  public hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered commands
   * @returns Array of all registered commands
   */
  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute the parsed commands
   * @param args - Command line arguments to parse and execute
   */
  public async execute(args?: string[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('CommandRegistry must be initialized before execution');
    }

    // Parse and execute commands
    if (args) {
      await this.program.parseAsync(args);
    } else {
      await this.program.parseAsync();
    }
  }

  /**
   * Get the help text for all commands
   * @returns The help text as a string
   */
  public getHelp(): string {
    return this.program.helpInformation();
  }

  /**
   * Print help information to console
   */
  public printHelp(): void {
    this.program.outputHelp();
  }

  /**
   * Get registered command names
   * @returns Array of registered command names
   */
  public getCommandNames(): string[] {
    return Array.from(this.commands.keys());
  }
}
