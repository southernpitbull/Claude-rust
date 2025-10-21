/**
 * HelpFormatter.ts
 *
 * Formats and displays help information for the AIrchitect CLI commands.
 * Provides structured, colorized help output with search capabilities.
 */

import { BaseCommand } from './Command.interface';
import { CommandRegistry } from './CommandRegistry';
import chalk from 'chalk';
import cliTable3 from 'cli-table3';

export interface HelpOptions {
  format?: 'text' | 'table' | 'json' | 'markdown';
  color?: boolean;
  search?: string;
  category?: string;
}

export class HelpFormatter {
  private commandRegistry: CommandRegistry;
  private colorEnabled: boolean;

  constructor(commandRegistry: CommandRegistry, colorEnabled: boolean = true) {
    this.commandRegistry = commandRegistry;
    this.colorEnabled = colorEnabled;
  }

  /**
   * Format help for all commands
   * @param options - Formatting options
   * @returns Formatted help string
   */
  public formatAllCommands(options: HelpOptions = {}): string {
    const commands = this.commandRegistry.getAllCommands();

    if (options.search) {
      return this.formatFilteredCommands(commands, options.search, options);
    }

    if (options.category) {
      return this.formatCategoryCommands(options.category, options);
    }

    switch (options.format) {
      case 'json':
        return this.formatAsJson(commands);
      case 'markdown':
        return this.formatAsMarkdown(commands);
      case 'table':
        return this.formatAsTable(commands);
      default:
        return this.formatAsText(commands);
    }
  }

  /**
   * Format help for a specific command
   * @param commandName - Name of the command to format help for
   * @param options - Formatting options
   * @returns Formatted help string
   */
  public formatCommand(commandName: string, options: HelpOptions = {}): string {
    const command = this.commandRegistry.getCommand(commandName);

    if (!command) {
      return this.colorize(`Command '${commandName}' not found`, 'error');
    }

    switch (options.format) {
      case 'json':
        return this.formatCommandAsJson(command);
      case 'markdown':
        return this.formatCommandAsMarkdown(command);
      default:
        return this.formatCommandAsText(command);
    }
  }

  /**
   * Format help as plain text
   * @param commands - Commands to format
   * @returns Formatted help string
   */
  private formatAsText(commands: BaseCommand[]): string {
    let output = this.colorize(
      'AIrchitect CLI - Advanced AI-powered development assistant\n',
      'title'
    );
    output += this.colorize('='.repeat(60), 'title') + '\n\n';

    // Group commands by first character for alphabetical listing
    const groupedCommands: { [key: string]: BaseCommand[] } = {};

    for (const command of commands) {
      const firstChar = command.name.charAt(0).toUpperCase();
      if (!groupedCommands[firstChar]) {
        groupedCommands[firstChar] = [];
      }
      groupedCommands[firstChar].push(command);
    }

    // Sort groups by character
    const sortedGroups = Object.keys(groupedCommands).sort();

    for (const group of sortedGroups) {
      output += this.colorize(`${group} Commands:\n`, 'section');
      output += this.colorize('-'.repeat(20), 'section') + '\n';

      // Sort commands in this group
      groupedCommands[group]
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((cmd) => {
          output += `  ${this.colorize(cmd.name.padEnd(15), 'command')} - ${cmd.description}\n`;
        });

      output += '\n';
    }

    output += this.colorize('\nUsage:', 'section') + ' airchitect <command> [options]\n';
    output +=
      this.colorize('For more info about a command:', 'section') + ' airchitect help <command>\n';

    return output;
  }

  /**
   * Format a single command as text
   * @param command - Command to format
   * @returns Formatted help string
   */
  private formatCommandAsText(command: BaseCommand): string {
    let output = this.colorize(`Command: ${command.name}\n`, 'title');
    output += this.colorize('='.repeat(50), 'title') + '\n\n';

    output += this.colorize('Description:\n', 'section');
    output += `  ${command.description}\n\n`;

    if (command.arguments && command.arguments.length > 0) {
      output += this.colorize('Arguments:\n', 'section');
      command.arguments.forEach((arg) => {
        const required = arg.required ? '[required]' : '[optional]';
        output += `  ${this.colorize(arg.name, 'arg')} ${this.colorize(required, 'required')} - ${arg.description}\n`;
      });
      output += '\n';
    }

    if (command.options && command.options.length > 0) {
      output += this.colorize('Options:\n', 'section');
      command.options.forEach((option) => {
        output += `  ${this.colorize(option.flags, 'option')} - ${option.description}\n`;
      });
      output += '\n';
    }

    if (command.getHelp) {
      output += this.colorize('Details:\n', 'section');
      output += `  ${command.getHelp()}\n\n`;
    }

    output += this.colorize('Usage:\n', 'section');
    output += `  airchitect ${command.name}`;

    if (command.arguments) {
      command.arguments.forEach((arg) => {
        output += arg.required ? ` <${arg.name}>` : ` [${arg.name}]`;
      });
    }

    if (command.options) {
      output += ' [options]';
    }

    output += '\n';

    return output;
  }

  /**
   * Format help as a table
   * @param commands - Commands to format
   * @returns Formatted help string
   */
  private formatAsTable(commands: BaseCommand[]): string {
    const table = new cliTable3({
      head: [this.colorize('Command', 'header'), this.colorize('Description', 'header')],
      colWidths: [20, 50],
    });

    // Sort commands alphabetically
    const sortedCommands = [...commands].sort((a, b) => a.name.localeCompare(b.name));

    sortedCommands.forEach((cmd) => {
      table.push([this.colorize(cmd.name, 'command'), cmd.description]);
    });

    return table.toString();
  }

  /**
   * Format help as JSON
   * @param commands - Commands to format
   * @returns Formatted help string
   */
  private formatAsJson(commands: BaseCommand[]): string {
    const commandsJson = commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      arguments: cmd.arguments,
      options: cmd.options,
    }));

    return JSON.stringify(commandsJson, null, 2);
  }

  /**
   * Format a single command as JSON
   * @param command - Command to format
   * @returns Formatted help string
   */
  private formatCommandAsJson(command: BaseCommand): string {
    const commandJson = {
      name: command.name,
      description: command.description,
      arguments: command.arguments,
      options: command.options,
      help: command.getHelp ? command.getHelp() : undefined,
    };

    return JSON.stringify(commandJson, null, 2);
  }

  /**
   * Format help as Markdown
   * @param commands - Commands to format
   * @returns Formatted help string
   */
  private formatAsMarkdown(commands: BaseCommand[]): string {
    let markdown = '# AIrchitect CLI Commands\n\n';
    markdown += 'This document lists all available commands for the AIrchitect CLI.\n\n';

    // Group commands by first character
    const groupedCommands: { [key: string]: BaseCommand[] } = {};

    for (const command of commands) {
      const firstChar = command.name.charAt(0).toUpperCase();
      if (!groupedCommands[firstChar]) {
        groupedCommands[firstChar] = [];
      }
      groupedCommands[firstChar].push(command);
    }

    // Sort groups by character
    const sortedGroups = Object.keys(groupedCommands).sort();

    for (const group of sortedGroups) {
      markdown += `## ${group} Commands\n\n`;

      // Sort commands in this group
      groupedCommands[group]
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((cmd) => {
          markdown += `- **\`${cmd.name}\`** - ${cmd.description}\n`;
        });

      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Format a single command as Markdown
   * @param command - Command to format
   * @returns Formatted help string
   */
  private formatCommandAsMarkdown(command: BaseCommand): string {
    let markdown = `# ${command.name}\n\n`;
    markdown += `> ${command.description}\n\n`;

    if (command.arguments && command.arguments.length > 0) {
      markdown += '## Arguments\n\n';
      command.arguments.forEach((arg) => {
        const required = arg.required ? ' (required)' : ' (optional)';
        markdown += `- **\`${arg.name}\`**${required}: ${arg.description}\n`;
      });
      markdown += '\n';
    }

    if (command.options && command.options.length > 0) {
      markdown += '## Options\n\n';
      command.options.forEach((option) => {
        markdown += `- **\`${option.flags}\`**: ${option.description}\n`;
      });
      markdown += '\n';
    }

    if (command.getHelp) {
      markdown += '## Details\n\n';
      markdown += command.getHelp() + '\n\n';
    }

    markdown += '## Usage\n\n';
    markdown += '```bash\n';
    markdown += `airchitect ${command.name}`;

    if (command.arguments) {
      command.arguments.forEach((arg) => {
        markdown += arg.required ? ` <${arg.name}>` : ` [${arg.name}]`;
      });
    }

    if (command.options) {
      markdown += ' [options]';
    }

    markdown += '\n```\n';

    return markdown;
  }

  /**
   * Format commands that match a search query
   * @param commands - Commands to filter
   * @param search - Search query
   * @param options - Formatting options
   */
  private formatFilteredCommands(
    commands: BaseCommand[],
    search: string,
    options: HelpOptions
  ): string {
    const filtered = commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase())
    );

    if (filtered.length === 0) {
      return this.colorize(`No commands found matching: ${search}`, 'error');
    }

    // Reuse the appropriate formatting method
    switch (options.format) {
      case 'json':
        return this.formatAsJson(filtered);
      case 'markdown':
        return this.formatAsMarkdown(filtered);
      case 'table':
        return this.formatAsTable(filtered);
      default:
        return this.formatAsText(filtered);
    }
  }

  /**
   * Format commands for a specific category
   * @param category - Category to filter by
   * @param options - Formatting options
   */
  private formatCategoryCommands(category: string, options: HelpOptions): string {
    // Since we don't have categories in the BaseCommand interface,
    // we'd need to implement this differently in a real implementation
    // For now, we'll just return all commands
    const commands = this.commandRegistry.getAllCommands();

    return this.formatAsText(commands);
  }

  /**
   * Colorize text if color is enabled
   * @param text - Text to colorize
   * @param type - Type of text to determine color
   * @returns Colorized text or original text if color is disabled
   */
  private colorize(
    text: string,
    type:
      | 'title'
      | 'command'
      | 'option'
      | 'arg'
      | 'required'
      | 'section'
      | 'header'
      | 'error'
      | 'none' = 'none'
  ): string {
    if (!this.colorEnabled) {
      return text;
    }

    switch (type) {
      case 'title':
        return chalk.bold.blue(text);
      case 'command':
        return chalk.green.bold(text);
      case 'option':
        return chalk.yellow(text);
      case 'arg':
        return chalk.cyan(text);
      case 'required':
        return chalk.red.bold(text);
      case 'section':
        return chalk.bold.magenta(text);
      case 'header':
        return chalk.bold.underline.white(text);
      case 'error':
        return chalk.red.bold(text);
      default:
        return text;
    }
  }

  /**
   * Format usage examples for a command
   * @param commandName - Name of the command
   * @returns Formatted usage examples
   */
  public formatUsageExamples(commandName: string): string {
    const examples: { [key: string]: string[] } = {
      chat: [
        'airchitect chat',
        'airchitect chat --provider anthropic',
        'airchitect chat --model gpt-4 --temperature 0.8',
      ],
      init: [
        'airchitect init',
        'airchitect init --name myproject --dir ./projects',
        'airchitect init --template react --skip-creds',
      ],
      config: [
        'airchitect config list',
        'airchitect config get ai.defaultProvider',
        'airchitect config set ai.defaultModel gpt-4',
      ],
      agents: [
        'airchitect agents list',
        'airchitect agents info dev-agent',
        'airchitect agents enable research-agent',
      ],
      completion: [
        'airchitect completion --install',
        'airchitect completion --shell zsh --print',
        'airchitect completion --uninstall',
      ],
      help: ['airchitect help', 'airchitect help chat', 'airchitect help --format json'],
    };

    const commandExamples = examples[commandName];
    if (!commandExamples) {
      return `No usage examples for command: ${commandName}`;
    }

    let output = this.colorize('Usage Examples:\n', 'section');
    commandExamples.forEach((example) => {
      output += `  ${this.colorize(example, 'option')}\n`;
    });

    return output;
  }

  /**
   * Set whether color is enabled
   * @param enabled - Whether color should be enabled
   */
  public setColorEnabled(enabled: boolean): void {
    this.colorEnabled = enabled;
  }
}
