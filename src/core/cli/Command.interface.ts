/**
 * Command.interface.ts
 *
 * Defines the interface for CLI commands in the AIrchitect application.
 * Provides type definitions for consistent command structure.
 */

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: any;
  required?: boolean;
}

export interface CommandArgument {
  name: string;
  description: string;
  required?: boolean;
}

export interface BaseCommand {
  /**
   * The name of the command (used in CLI)
   */
  name: string;

  /**
   * A short description of what the command does
   */
  description: string;

  /**
   * Options that can be passed to the command
   */
  options?: CommandOption[];

  /**
   * Arguments the command accepts
   */
  arguments?: CommandArgument[];

  /**
   * Execute the command with the provided arguments
   * @param args - Arguments passed to the command
   */
  execute: (...args: any[]) => Promise<void>;

  /**
   * Optional validation function for command arguments
   * @param args - Arguments to validate
   * @returns Boolean indicating if arguments are valid
   */
  validate?: (...args: any[]) => boolean;

  /**
   * Optional help text for the command
   * @returns Detailed help text for the command
   */
  getHelp?: () => string;
}

export interface CommandMetadata {
  /**
   * The command category (e.g., 'development', 'deployment', 'utility')
   */
  category: string;

  /**
   * Aliases for the command
   */
  aliases?: string[];

  /**
   * Minimum required arguments
   */
  minArgs?: number;

  /**
   * Maximum allowed arguments
   */
  maxArgs?: number;

  /**
   * Whether the command requires authentication
   */
  requiresAuth?: boolean;

  /**
   * Whether the command requires a specific environment
   */
  requiresEnvironment?: string;

  /**
   * Permissions required to execute the command
   */
  permissions?: string[];
}
