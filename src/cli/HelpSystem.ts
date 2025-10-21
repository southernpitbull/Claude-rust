/**
 * HelpSystem.ts
 *
 * Comprehensive help and documentation system for the AIrchitect CLI.
 * Provides interactive help, command discovery, and auto-complete generation.
 */

import chalk from 'chalk';
import { BaseCommand } from '../core/cli/Command.interface';
import { ICommandMetadata } from './CommandManager';
import { Logger, LogLevel } from '../utils/Logger';

/**
 * Help content structure
 */
export interface HelpContent {
  title: string;
  description: string;
  usage?: string;
  examples?: HelpExample[];
  options?: HelpOption[];
  arguments?: HelpArgument[];
  subcommands?: HelpSubcommand[];
  relatedCommands?: string[];
  notes?: string[];
  aliases?: string[];
  category?: string;
}

/**
 * Help example
 */
export interface HelpExample {
  description: string;
  command: string;
  output?: string;
}

/**
 * Help option
 */
export interface HelpOption {
  flags: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
}

/**
 * Help argument
 */
export interface HelpArgument {
  name: string;
  description: string;
  required?: boolean;
  type?: string;
}

/**
 * Help subcommand
 */
export interface HelpSubcommand {
  name: string;
  description: string;
  aliases?: string[];
}

/**
 * Command category
 */
export interface CommandCategory {
  name: string;
  description: string;
  commands: string[];
}

/**
 * Help system configuration
 */
export interface IHelpSystemConfig {
  logger?: Logger;
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  useColors?: boolean;
  maxWidth?: number;
}

/**
 * Search result
 */
export interface SearchResult {
  command: string;
  relevance: number;
  match: string;
}

/**
 * HelpSystem class for managing help content
 */
export class HelpSystem {
  private helpContent: Map<string, HelpContent>;
  private categories: Map<string, CommandCategory>;
  private logger: Logger;
  private appName: string;
  private appVersion: string;
  private appDescription: string;
  private useColors: boolean;
  private maxWidth: number;

  /**
   * Creates a new HelpSystem instance
   * @param config - Help system configuration
   */
  constructor(config: IHelpSystemConfig = {}) {
    this.helpContent = new Map();
    this.categories = new Map();
    this.logger = config.logger ?? new Logger({ level: LogLevel.INFO, prefix: 'Help' });
    this.appName = config.appName ?? 'airchitect';
    this.appVersion = config.appVersion ?? '0.1.0';
    this.appDescription = config.appDescription ?? 'AI-powered development assistant';
    this.useColors = config.useColors ?? true;
    this.maxWidth = config.maxWidth ?? 80;
  }

  /**
   * Register help content for a command
   * @param commandName - Command name
   * @param content - Help content
   */
  public register(commandName: string, content: HelpContent): void {
    this.helpContent.set(commandName, content);

    // Update category
    if (content.category) {
      this.addToCategory(content.category, commandName);
    }

    this.logger.debug(`Registered help for command: ${commandName}`);
  }

  /**
   * Register help from command metadata
   * @param command - Command instance
   * @param metadata - Command metadata
   */
  public registerFromCommand(command: BaseCommand, metadata?: ICommandMetadata): void {
    const content: HelpContent = {
      title: command.name,
      description: command.description,
      usage: this.generateUsage(command),
      options: this.extractOptions(command),
      arguments: this.extractArguments(command),
      category: metadata?.category,
      aliases: metadata?.aliases,
    };

    // Get custom help if available
    if (command.getHelp) {
      const customHelp = command.getHelp();
      content.notes = [customHelp];
    }

    this.register(command.name, content);
  }

  /**
   * Get help content for a command
   * @param commandName - Command name
   * @returns Help content or undefined
   */
  public getHelp(commandName: string): HelpContent | undefined {
    return this.helpContent.get(commandName);
  }

  /**
   * Display help for a command
   * @param commandName - Command name (optional, shows general help if not specified)
   */
  public showHelp(commandName?: string): void {
    if (!commandName) {
      this.showGeneralHelp();
      return;
    }

    const content = this.getHelp(commandName);

    if (!content) {
      console.log(chalk.yellow(`No help available for command: ${commandName}`));
      this.showCommandSuggestions(commandName);
      return;
    }

    this.displayHelpContent(content);
  }

  /**
   * Display general help
   */
  public showGeneralHelp(): void {
    const lines: string[] = [];

    // Header
    lines.push(this.colorize(chalk.bold.cyan, `${this.appName} v${this.appVersion}`));
    lines.push(this.colorize(chalk.dim, this.appDescription));
    lines.push('');

    // Usage
    lines.push(this.colorize(chalk.bold, 'USAGE'));
    lines.push(`  ${this.appName} <command> [options]`);
    lines.push('');

    // Categories
    if (this.categories.size > 0) {
      lines.push(this.colorize(chalk.bold, 'COMMANDS'));
      for (const [categoryName, category] of this.categories.entries()) {
        lines.push('');
        lines.push(this.colorize(chalk.yellow, `  ${category.name}`));
        lines.push(this.colorize(chalk.dim, `  ${category.description}`));
        lines.push('');

        for (const commandName of category.commands) {
          const content = this.getHelp(commandName);
          if (content) {
            const aliases = content.aliases ? ` (${content.aliases.join(', ')})` : '';
            lines.push(`    ${this.pad(commandName + aliases, 20)} ${content.description}`);
          }
        }
      }
    } else {
      // Show all commands if no categories
      lines.push(this.colorize(chalk.bold, 'COMMANDS'));
      for (const [commandName, content] of this.helpContent.entries()) {
        const aliases = content.aliases ? ` (${content.aliases.join(', ')})` : '';
        lines.push(`  ${this.pad(commandName + aliases, 20)} ${content.description}`);
      }
    }

    lines.push('');
    lines.push(this.colorize(chalk.bold, 'OPTIONS'));
    lines.push('  --help, -h       Show help information');
    lines.push('  --version, -v    Show version information');
    lines.push('  --verbose        Enable verbose output');
    lines.push('');
    lines.push(`Run "${this.appName} <command> --help" for more information on a command.`);

    console.log(lines.join('\n'));
  }

  /**
   * Display help content
   * @param content - Help content to display
   */
  private displayHelpContent(content: HelpContent): void {
    const lines: string[] = [];

    // Title and description
    lines.push(this.colorize(chalk.bold.cyan, content.title.toUpperCase()));
    lines.push('');
    lines.push(this.wrap(content.description));
    lines.push('');

    // Usage
    if (content.usage) {
      lines.push(this.colorize(chalk.bold, 'USAGE'));
      lines.push(`  ${content.usage}`);
      lines.push('');
    }

    // Arguments
    if (content.arguments && content.arguments.length > 0) {
      lines.push(this.colorize(chalk.bold, 'ARGUMENTS'));
      for (const arg of content.arguments) {
        const required = arg.required ? '<required>' : '[optional]';
        const type = arg.type ? ` (${arg.type})` : '';
        lines.push(`  ${this.pad(arg.name, 20)} ${required}${type}`);
        lines.push(`  ${this.pad('', 20)} ${this.colorize(chalk.dim, arg.description)}`);
      }
      lines.push('');
    }

    // Options
    if (content.options && content.options.length > 0) {
      lines.push(this.colorize(chalk.bold, 'OPTIONS'));
      for (const option of content.options) {
        const required = option.required ? '<required>' : '[optional]';
        const defaultValue = option.defaultValue ? ` (default: ${option.defaultValue})` : '';
        const type = option.type ? ` (${option.type})` : '';
        lines.push(`  ${this.pad(option.flags, 20)} ${required}${type}${defaultValue}`);
        lines.push(`  ${this.pad('', 20)} ${this.colorize(chalk.dim, option.description)}`);
      }
      lines.push('');
    }

    // Subcommands
    if (content.subcommands && content.subcommands.length > 0) {
      lines.push(this.colorize(chalk.bold, 'SUBCOMMANDS'));
      for (const subcommand of content.subcommands) {
        const aliases = subcommand.aliases ? ` (${subcommand.aliases.join(', ')})` : '';
        lines.push(`  ${this.pad(subcommand.name + aliases, 20)} ${subcommand.description}`);
      }
      lines.push('');
    }

    // Examples
    if (content.examples && content.examples.length > 0) {
      lines.push(this.colorize(chalk.bold, 'EXAMPLES'));
      for (const example of content.examples) {
        lines.push(`  ${this.colorize(chalk.dim, example.description)}`);
        lines.push(`  ${this.colorize(chalk.green, `$ ${example.command}`)}`);
        if (example.output) {
          lines.push(`  ${this.colorize(chalk.gray, example.output)}`);
        }
        lines.push('');
      }
    }

    // Related commands
    if (content.relatedCommands && content.relatedCommands.length > 0) {
      lines.push(this.colorize(chalk.bold, 'RELATED COMMANDS'));
      lines.push(`  ${content.relatedCommands.join(', ')}`);
      lines.push('');
    }

    // Notes
    if (content.notes && content.notes.length > 0) {
      lines.push(this.colorize(chalk.bold, 'NOTES'));
      for (const note of content.notes) {
        lines.push(this.wrap(`  ${note}`));
      }
      lines.push('');
    }

    // Aliases
    if (content.aliases && content.aliases.length > 0) {
      lines.push(this.colorize(chalk.bold, 'ALIASES'));
      lines.push(`  ${content.aliases.join(', ')}`);
      lines.push('');
    }

    console.log(lines.join('\n'));
  }

  /**
   * Search for commands
   * @param query - Search query
   * @returns Array of search results
   */
  public search(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const [commandName, content] of this.helpContent.entries()) {
      let relevance = 0;
      let match = '';

      // Exact name match
      if (commandName === query) {
        relevance = 100;
        match = 'exact match';
      }
      // Name starts with query
      else if (commandName.startsWith(lowerQuery)) {
        relevance = 80;
        match = 'name prefix';
      }
      // Name contains query
      else if (commandName.includes(lowerQuery)) {
        relevance = 60;
        match = 'name contains';
      }
      // Description contains query
      else if (content.description.toLowerCase().includes(lowerQuery)) {
        relevance = 40;
        match = 'description';
      }
      // Alias match
      else if (content.aliases?.some((alias) => alias.toLowerCase().includes(lowerQuery))) {
        relevance = 70;
        match = 'alias';
      }

      if (relevance > 0) {
        results.push({ command: commandName, relevance, match });
      }
    }

    // Sort by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Show command suggestions based on partial input
   * @param partialCommand - Partial command name
   */
  public showCommandSuggestions(partialCommand: string): void {
    const results = this.search(partialCommand);

    if (results.length === 0) {
      console.log(chalk.yellow('No matching commands found.'));
      console.log(`Run "${this.appName} help" to see all available commands.`);
      return;
    }

    console.log(chalk.yellow('\nDid you mean one of these?'));
    const topResults = results.slice(0, 5);
    for (const result of topResults) {
      const content = this.getHelp(result.command);
      console.log(`  ${chalk.cyan(result.command)} - ${content?.description ?? ''}`);
    }
    console.log('');
  }

  /**
   * Generate shell completion script
   * @param shell - Shell type (bash, zsh, fish, powershell)
   * @returns Completion script
   */
  public generateCompletionScript(shell: 'bash' | 'zsh' | 'fish' | 'powershell'): string {
    const commands = Array.from(this.helpContent.keys());

    switch (shell) {
      case 'bash':
        return this.generateBashCompletion(commands);
      case 'zsh':
        return this.generateZshCompletion(commands);
      case 'fish':
        return this.generateFishCompletion(commands);
      case 'powershell':
        return this.generatePowerShellCompletion(commands);
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  /**
   * Generate autocomplete suggestions
   * @param partial - Partial command
   * @returns Array of completion suggestions
   */
  public getCompletions(partial: string): string[] {
    const completions: string[] = [];

    for (const commandName of this.helpContent.keys()) {
      if (commandName.startsWith(partial)) {
        completions.push(commandName);
      }
    }

    return completions.sort();
  }

  /**
   * Add category
   * @param name - Category name
   * @param description - Category description
   */
  public addCategory(name: string, description: string): void {
    this.categories.set(name, { name, description, commands: [] });
  }

  /**
   * Add command to category
   * @param categoryName - Category name
   * @param commandName - Command name
   */
  private addToCategory(categoryName: string, commandName: string): void {
    let category = this.categories.get(categoryName);

    if (!category) {
      category = { name: categoryName, description: '', commands: [] };
      this.categories.set(categoryName, category);
    }

    if (!category.commands.includes(commandName)) {
      category.commands.push(commandName);
    }
  }

  /**
   * Generate usage string from command
   * @param command - Command instance
   * @returns Usage string
   */
  private generateUsage(command: BaseCommand): string {
    const parts: string[] = [this.appName, command.name];

    if (command.arguments && command.arguments.length > 0) {
      for (const arg of command.arguments) {
        const argStr = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
        parts.push(argStr);
      }
    }

    if (command.options && command.options.length > 0) {
      parts.push('[options]');
    }

    return parts.join(' ');
  }

  /**
   * Extract options from command
   * @param command - Command instance
   * @returns Array of help options
   */
  private extractOptions(command: BaseCommand): HelpOption[] {
    if (!command.options) {
      return [];
    }

    return command.options.map((opt) => ({
      flags: opt.flags,
      description: opt.description,
      required: opt.required,
      defaultValue: opt.defaultValue !== undefined ? String(opt.defaultValue) : undefined,
    }));
  }

  /**
   * Extract arguments from command
   * @param command - Command instance
   * @returns Array of help arguments
   */
  private extractArguments(command: BaseCommand): HelpArgument[] {
    if (!command.arguments) {
      return [];
    }

    return command.arguments.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required,
    }));
  }

  /**
   * Generate bash completion script
   * @param commands - Array of command names
   * @returns Bash completion script
   */
  private generateBashCompletion(commands: string[]): string {
    const commandList = commands.join(' ');
    return `
# ${this.appName} completion script for bash

_${this.appName}_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${commandList}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    return 0
  fi
}

complete -F _${this.appName}_completions ${this.appName}
`;
  }

  /**
   * Generate zsh completion script
   * @param commands - Array of command names
   * @returns Zsh completion script
   */
  private generateZshCompletion(commands: string[]): string {
    const commandList = commands
      .map((cmd) => {
        const content = this.getHelp(cmd);
        const desc = content?.description ?? '';
        return `    "${cmd}:${desc}"`;
      })
      .join('\n');

    return `
#compdef ${this.appName}

# ${this.appName} completion script for zsh

_${this.appName}() {
  local -a commands

  commands=(
${commandList}
  )

  _arguments -C \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'command' commands
      ;;
  esac
}

_${this.appName} "\$@"
`;
  }

  /**
   * Generate fish completion script
   * @param commands - Array of command names
   * @returns Fish completion script
   */
  private generateFishCompletion(commands: string[]): string {
    const lines: string[] = [`# ${this.appName} completion script for fish`];

    for (const cmd of commands) {
      const content = this.getHelp(cmd);
      const desc = content?.description ?? '';
      lines.push(`complete -c ${this.appName} -n "__fish_use_subcommand" -a "${cmd}" -d "${desc}"`);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Generate PowerShell completion script
   * @param commands - Array of command names
   * @returns PowerShell completion script
   */
  private generatePowerShellCompletion(commands: string[]): string {
    const commandList = commands.map((cmd) => `'${cmd}'`).join(', ');

    return `
# ${this.appName} completion script for PowerShell

Register-ArgumentCompleter -Native -CommandName ${this.appName} -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $commands = @(${commandList})

  $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
  }

  /**
   * Colorize text if colors are enabled
   * @param colorFn - Chalk color function
   * @param text - Text to colorize
   * @returns Colorized or plain text
   */
  private colorize(colorFn: (text: string) => string, text: string): string {
    return this.useColors ? colorFn(text) : text;
  }

  /**
   * Pad string to specified length
   * @param str - String to pad
   * @param length - Target length
   * @returns Padded string
   */
  private pad(str: string, length: number): string {
    return str.padEnd(length, ' ');
  }

  /**
   * Wrap text to max width
   * @param text - Text to wrap
   * @returns Wrapped text
   */
  private wrap(text: string): string {
    if (text.length <= this.maxWidth) {
      return text;
    }

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length <= this.maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.join('\n');
  }

  /**
   * Get all command names
   * @returns Array of command names
   */
  public getCommandNames(): string[] {
    return Array.from(this.helpContent.keys());
  }

  /**
   * Clear all help content
   */
  public clear(): void {
    this.helpContent.clear();
    this.categories.clear();
    this.logger.debug('Cleared all help content');
  }
}
