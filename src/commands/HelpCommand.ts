/**
 * HelpCommand.ts
 *
 * Implements the 'help' command for displaying help information.
 * Provides detailed information about commands, options, and usage.
 */

import { Command } from '../core/cli/Command';
import { ValidationService } from '../core/cli/ValidationService';
import { CommandRegistry } from '../core/cli/CommandRegistry';
import { HelpFormatter } from '../core/cli/HelpFormatter';
import { Logger } from '../utils/Logger';

export class HelpCommand extends Command {
  public name = 'help';
  public description = 'Show help information for commands';

  public arguments = [
    {
      name: 'command',
      description: 'Command to get help for (optional)',
      required: false,
    },
  ];

  public options = [
    {
      flags: '-f, --format <format>',
      description: 'Output format (text, table, json, markdown)',
      defaultValue: 'text',
    },
    {
      flags: '-c, --color',
      description: 'Enable colorized output',
      required: false,
    },
    {
      flags: '--no-color',
      description: 'Disable colorized output',
      required: false,
    },
    {
      flags: '-s, --search <query>',
      description: 'Search for commands matching the query',
      required: false,
    },
    {
      flags: '--examples',
      description: 'Show usage examples for a command',
      required: false,
    },
  ];

  private validationService: ValidationService;
  private commandRegistry: CommandRegistry;
  private logger: Logger;

  constructor(commandRegistry: CommandRegistry) {
    super();
    this.validationService = new ValidationService();
    this.commandRegistry = commandRegistry;
    this.logger = new Logger('info');
  }

  public async execute(...args: any[]): Promise<void> {
    // Extract arguments and options
    const options: any = args[args.length - 1] || {};
    const commandName = this.getArg(args, 0);

    const format = options.format || 'text';
    const enableColor = options.color || options.color === undefined; // Default to true if not specified
    const search = options.search;
    const showExamples = options.examples || false;

    // Pre-execute validation
    if (this.preExecute) {
      await this.preExecute();
    }

    try {
      // Create help formatter
      const helpFormatter = new HelpFormatter(this.commandRegistry, enableColor);

      let helpOutput = '';

      if (commandName) {
        // Show help for a specific command
        if (showExamples) {
          helpOutput = helpFormatter.formatUsageExamples(commandName);
        } else {
          helpOutput = helpFormatter.formatCommand(commandName, {
            format,
            color: enableColor,
            search,
          });
        }
      } else {
        // Show help for all commands
        helpOutput = helpFormatter.formatAllCommands({
          format,
          color: enableColor,
          search,
        });
      }

      console.log(helpOutput);

      // Post-execute actions
      if (this.postExecute) {
        await this.postExecute();
      }
    } catch (error) {
      this.logger.error('Help command failed:', error);
      throw error;
    }
  }

  public getHelp(): string {
    return `
The help command displays help information for AIrchitect CLI commands.

Examples:
  airchitect help                    # Show general help
  airchitect help chat              # Show help for chat command
  airchitect help --format json     # Output help in JSON format
  airchitect help --search agent    # Search for commands containing 'agent'
  airchitect help chat --examples   # Show usage examples for chat command
  airchitect help --color           # Show colorized help
  airchitect help --no-color        # Show plain text help
    `;
  }

  /**
   * Validate command arguments
   * @param args - Arguments passed to the command
   * @returns Boolean indicating if arguments are valid
   */
  public validate(...args: any[]): boolean {
    const options: any = args[args.length - 1] || {};

    // Validate format if provided
    if (options.format) {
      const validFormats = ['text', 'table', 'json', 'markdown'];
      if (!validFormats.includes(options.format)) {
        console.error(
          `Invalid format: ${options.format}. Valid options are: ${validFormats.join(', ')}`
        );
        return false;
      }
    }

    // Validate conflicting options
    if (options.color && options['no-color']) {
      console.error('Cannot specify both --color and --no-color');
      return false;
    }

    return true;
  }
}
