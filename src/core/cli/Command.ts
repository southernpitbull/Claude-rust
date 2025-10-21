/**
 * Command.ts
 *
 * Base class abstraction for CLI commands in the AIrchitect application.
 * Provides common functionality and structure for all commands.
 */

import { BaseCommand, CommandOption, CommandArgument } from './Command.interface';

export abstract class Command implements BaseCommand {
  public abstract name: string;
  public abstract description: string;

  public options?: CommandOption[];
  public arguments?: CommandArgument[];

  /**
   * Execute the command with the provided arguments
   * @param args - Arguments passed to the command
   */
  public abstract execute(...args: any[]): Promise<void>;

  /**
   * Optional validation function for command arguments
   * @param args - Arguments to validate
   * @returns Boolean indicating if arguments are valid
   */
  public validate?(...args: any[]): boolean;

  /**
   * Optional help text for the command
   * @returns Detailed help text for the command
   */
  public getHelp?(): string;

  /**
   * Method to run before command execution (for validation or setup)
   */
  protected async preExecute?(): Promise<void>;

  /**
   * Method to run after command execution (for cleanup or logging)
   */
  protected async postExecute?(): Promise<void>;

  /**
   * Helper method to validate required arguments
   * @param args - Arguments passed to the command
   * @param requiredArgs - Number of required arguments
   * @returns Boolean indicating if the required arguments are present
   */
  protected validateRequiredArgs(args: any[], requiredArgs: number): boolean {
    if (args.length < requiredArgs) {
      console.error(`Error: ${this.name} requires at least ${requiredArgs} argument(s)`);
      return false;
    }
    return true;
  }

  /**
   * Helper method to validate argument types
   * @param args - Arguments passed to the command
   * @param expectedTypes - Expected types for each argument
   * @returns Boolean indicating if arguments match expected types
   */
  protected validateArgTypes(args: any[], expectedTypes: string[]): boolean {
    for (let i = 0; i < Math.min(args.length, expectedTypes.length); i++) {
      const arg = args[i];
      const expectedType = expectedTypes[i];

      if (typeof arg !== expectedType) {
        console.error(
          `Error: Argument ${i} of ${this.name} should be of type ${expectedType}, but got ${typeof arg}`
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Helper method to get argument by index with type safety
   * @param args - Arguments passed to the command
   * @param index - Index of the argument to retrieve
   * @param defaultValue - Default value if argument is not present
   * @returns The argument value or default value
   */
  protected getArg<T>(args: any[], index: number, defaultValue?: T): T | undefined {
    if (index < args.length) {
      return args[index] as T;
    }
    return defaultValue;
  }

  /**
   * Helper method to get validated argument by index
   * @param args - Arguments passed to the command
   * @param index - Index of the argument to retrieve
   * @param validator - Function to validate the argument value
   * @param defaultValue - Default value if argument is not present or invalid
   * @returns The validated argument value or default value
   */
  protected getValidatedArg<T>(
    args: any[],
    index: number,
    validator: (value: any) => boolean,
    defaultValue?: T
  ): T | undefined {
    if (index < args.length) {
      const value = args[index] as T;
      if (validator(value)) {
        return value;
      }
    }
    return defaultValue;
  }

  /**
   * Format help text for this command
   * @returns Formatted help text
   */
  public formatHelp(): string {
    let helpText = `\n${this.name} - ${this.description}\n\n`;

    if (this.arguments && this.arguments.length > 0) {
      helpText += 'Arguments:\n';
      for (const arg of this.arguments) {
        const required = arg.required ? '<required>' : '[optional]';
        helpText += `  ${arg.name} ${required} - ${arg.description}\n`;
      }
      helpText += '\n';
    }

    if (this.options && this.options.length > 0) {
      helpText += 'Options:\n';
      for (const option of this.options) {
        helpText += `  ${option.flags} - ${option.description}\n`;
      }
      helpText += '\n';
    }

    if (this.getHelp) {
      helpText += `${this.getHelp()}\n`;
    }

    return helpText;
  }
}
