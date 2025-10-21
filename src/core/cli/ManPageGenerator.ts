/**
 * ManPageGenerator.ts
 *
 * Generates traditional Unix man pages for AIrchitect CLI commands.
 * Creates properly formatted man pages in troff format.
 */

import { BaseCommand } from './Command.interface';
import { CommandRegistry } from './CommandRegistry';

export interface ManPageOptions {
  section?: number; // Man page section (1 for user commands, 8 for admin commands, etc.)
  name?: string; // Name of the command
  title?: string; // Title for the man page
  version?: string; // Version of the software
  date?: string; // Date of the man page
  manual?: string; // Manual name
}

export class ManPageGenerator {
  private commandRegistry: CommandRegistry;

  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
  }

  /**
   * Generate a man page for a specific command
   * @param commandName - Name of the command to generate man page for
   * @param options - Man page options
   * @returns Man page content in troff format
   */
  public generateManPage(commandName: string, options: ManPageOptions = {}): string {
    const command = this.commandRegistry.getCommand(commandName);
    if (!command) {
      throw new Error(`Command '${commandName}' not found`);
    }

    // Set default options
    const opts: ManPageOptions = {
      section: options.section || 1, // User commands section by default
      name: commandName,
      title: options.title || `${commandName.toUpperCase()} - AIrchitect CLI Command`,
      version: options.version || '0.1.0',
      date: options.date || new Date().toISOString().split('T')[0],
      manual: options.manual || 'AIrchitect Manual',
      ...options,
    };

    let manPage = '';

    // Header
    manPage += `.TH ${commandName.toUpperCase()} ${opts.section} "${opts.date}" "v${opts.version}" "${opts.manual}"\n`;

    // Name section
    manPage += `.SH NAME\n`;
    manPage += `${commandName} \\- ${command.description}\n`;

    // Synopsis section
    manPage += `\n.SH SYNOPSIS\n`;
    manPage += `.B ${commandName}\n`;

    if (command.options) {
      for (const option of command.options) {
        const flags = option.flags.split(' ')[0]; // Get the first flag
        manPage += `[\\fB${flags}\\fP] `;
      }
    }

    if (command.arguments) {
      for (const arg of command.arguments) {
        const bracket = arg.required ? '<' : '[';
        const endBracket = arg.required ? '>' : ']';
        manPage += `[\\fI${bracket}${arg.name}${endBracket}\\fP] `;
      }
    }

    manPage += `\n`;

    // Description section
    manPage += `\n.SH DESCRIPTION\n`;
    manPage += command.description + `\n`;

    // Add full help if available
    if (command.getHelp) {
      manPage += `\n` + this.escapeForMan(command.getHelp()) + `\n`;
    }

    // Options section
    if (command.options && command.options.length > 0) {
      manPage += `\n.SH OPTIONS\n`;

      for (const option of command.options) {
        manPage += `.TP\n`;
        manPage += `.B ${option.flags}\n`;
        manPage += `${option.description}\n`;

        if (option.defaultValue !== undefined) {
          manPage += `Default value: ${option.defaultValue}\n`;
        }
        manPage += `\n`;
      }
    }

    // Arguments section
    if (command.arguments && command.arguments.length > 0) {
      manPage += `\n.SH ARGUMENTS\n`;

      for (const arg of command.arguments) {
        manPage += `.TP\n`;
        const bracket = arg.required ? '<' : '[';
        const endBracket = arg.required ? '>' : ']';
        manPage += `.B ${bracket}${arg.name}${endBracket}\n`;
        const requiredStatus = arg.required ? ' (required)' : ' (optional)';
        manPage += `${arg.description}${requiredStatus}\n\n`;
      }
    }

    // Examples section
    manPage += `\n.SH EXAMPLES\n`;
    manPage += this.generateExamples(commandName);

    // See also section
    manPage += `\n.SH SEE ALSO\n`;
    manPage += this.generateSeeAlso(commandName);

    // Authors section
    manPage += `\n.SH AUTHOR\n`;
    manPage += `The AIrchitect team.\n`;

    // Custom footer
    manPage += `\n.SH COPYRIGHT\n`;
    manPage += `This software is licensed under the MIT license.\n`;

    return manPage;
  }

  /**
   * Generate man page content for all commands
   * @param options - Man page options
   * @returns Array of man page contents with filenames
   */
  public generateAllManPages(
    options: ManPageOptions = {}
  ): Array<{ filename: string; content: string }> {
    const commands = this.commandRegistry.getAllCommands();
    const manPages: Array<{ filename: string; content: string }> = [];

    for (const command of commands) {
      const content = this.generateManPage(command.name, options);
      const filename = `${command.name}.${options.section || 1}`;
      manPages.push({ filename, content });
    }

    return manPages;
  }

  /**
   * Generate usage examples for the EXAMPLES section
   * @param commandName - Name of the command
   * @returns Formatted examples
   */
  private generateExamples(commandName: string): string {
    // Define example templates for known commands
    const examples: { [key: string]: string[] } = {
      chat: [
        '.B "airchitect chat"',
        'Start an interactive chat session with the default AI provider',
        '',
        '.B "airchitect chat --provider anthropic --model claude-3-opus"',
        "Start a chat session with Anthropic's Claude 3 Opus model",
      ],
      init: [
        '.B "airchitect init"',
        'Initialize a new AIrchitect project with default settings',
        '',
        '.B "airchitect init --name myproject --template react"',
        'Initialize a new project named "myproject" using the React template',
      ],
      config: [
        '.B "airchitect config list"',
        'List all configuration values',
        '',
        '.B "airchitect config get ai.defaultProvider"',
        'Get the default AI provider setting',
      ],
      agents: [
        '.B "airchitect agents list"',
        'List all available agents',
        '',
        '.B "airchitect agents enable research-agent"',
        'Enable the research-agent',
      ],
      completion: [
        '.B "airchitect completion --install"',
        'Install shell completion for your current shell',
        '',
        '.B "airchitect completion --shell zsh --print"',
        'Print the zsh completion script to stdout',
      ],
      help: [
        '.B "airchitect help"',
        'Show general help information',
        '',
        '.B "airchitect help chat"',
        'Show help for the chat command',
      ],
    };

    const commandExamples = examples[commandName];
    if (commandExamples) {
      return commandExamples.join('\n') + '\n';
    }

    // Generic example for unknown commands
    return (
      `.B "airchitect ${commandName}"\n` +
      `Run the ${commandName} command with default settings\n\n`
    );
  }

  /**
   * Generate content for the SEE ALSO section
   * @param commandName - Name of the current command
   * @returns Formatted see also content
   */
  private generateSeeAlso(commandName: string): string {
    // Define related commands
    const related: { [key: string]: string[] } = {
      chat: ['airchitect(1)', 'completion(1)', 'config(1)'],
      init: ['airchitect(1)', 'config(1)'],
      config: ['airchitect(1)', 'completion(1)'],
      agents: ['airchitect(1)', 'chat(1)'],
      completion: ['airchitect(1)', 'help(1)'],
      help: ['airchitect(1)'],
    };

    // Add generic AIrchitect reference
    const seeAlsoList = ['airchitect(1)', ...(related[commandName] || [])];
    return seeAlsoList.join(', ') + '\n';
  }

  /**
   * Escape text for man page format
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeForMan(text: string): string {
    // Escape special man page characters
    return text
      .replace(/\\/g, '\\\\') // Escape backslashes
      .replace(/\-/g, '\\-') // Escape hyphens
      .replace(/\./g, '\\&.') // Escape dots
      .replace(/'/g, '\\[cq]') // Replace single quotes
      .replace(/"/g, '\\[dq]'); // Replace double quotes
  }

  /**
   * Generate a man page for the main airchitect command
   * @param options - Man page options
   * @returns Main man page content
   */
  public generateMainManPage(options: ManPageOptions = {}): string {
    const opts: ManPageOptions = {
      section: options.section || 1,
      name: 'airchitect',
      title: 'AIRCHITECT - Advanced AI-powered development assistant',
      version: options.version || '0.1.0',
      date: options.date || new Date().toISOString().split('T')[0],
      manual: options.manual || 'AIrchitect Manual',
      ...options,
    };

    let manPage = '';

    // Header
    manPage += `.TH AIRCHITECT ${opts.section} "${opts.date}" "v${opts.version}" "${opts.manual}"\n`;

    // Name section
    manPage += `.SH NAME\n`;
    manPage += `airchitect \\- Advanced AI-powered development assistant CLI\n`;

    // Synopsis section
    manPage += `\n.SH SYNOPSIS\n`;
    manPage += `.B airchitect\n`;
    manPage += `[\\fICOMMAND\\fP] [\\fIOPTIONS\\fP] [\\fIARGUMENTS\\fP]\n`;

    // Description section
    manPage += `\n.SH DESCRIPTION\n`;
    manPage +=
      `AIrchitect is an advanced AI-powered development assistant CLI that helps developers ` +
      `interact with AI models, manage projects, and automate development tasks. ` +
      `It provides a rich command-line interface to various AI services and development tools.\n\n`;

    manPage += `The CLI is organized into several main commands:\n`;
    manPage += `.IP "\\[bu]" 4\n`;
    manPage += `Development: chat, plan, work\n`;
    manPage += `.IP "\\[bu]" 4\n`;
    manPage += `Configuration: config, creds, providers\n`;
    manPage += `.IP "\\[bu]" 4\n`;
    manPage += `Project Management: project, memory, checkpoint\n`;
    manPage += `.IP "\\[bu]" 4\n`;
    manPage += `Agent Management: agents, plugins\n`;

    // Options section (common options)
    manPage += `\n.SH OPTIONS\n`;
    manPage += `.TP\n`;
    manPage += `.B -h, --help\n`;
    manPage += `Show help information for the specified command\n`;
    manPage += `.TP\n`;
    manPage += `.B -V, --version\n`;
    manPage += `Show version information\n`;
    manPage += `.TP\n`;
    manPage += `.B -v, --verbose\n`;
    manPage += `Enable verbose output\n`;
    manPage += `.TP\n`;
    manPage += `.B --config <file>\n`;
    manPage += `Specify configuration file path\n`;

    // Commands section
    manPage += `\n.SH COMMANDS\n`;
    const commands = this.commandRegistry.getAllCommands();
    for (const command of commands) {
      manPage += `.TP\n`;
      manPage += `.B ${command.name}\n`;
      manPage += `${command.description}\n`;
    }

    // Examples section
    manPage += `\n.SH EXAMPLES\n`;
    manPage += `.B "airchitect chat"\n`;
    manPage += `Start an interactive chat session with the default AI provider\n`;
    manPage += `\n.B "airchitect init --name myproject"\n`;
    manPage += `Initialize a new AIrchitect project named "myproject"\n`;
    manPage += `\n.B "airchitect help config"\n`;
    manPage += `Show help information for the config command\n`;

    // Environment section
    manPage += `\n.SH ENVIRONMENT\n`;
    manPage += `.TP\n`;
    manPage += `.B AIRCHITECT_CONFIG_PATH\n`;
    manPage += `Path to the configuration file\n`;
    manPage += `.TP\n`;
    manPage += `.B AIRCHITECT_DEFAULT_PROVIDER\n`;
    manPage += `Default AI provider to use\n`;
    manPage += `.TP\n`;
    manPage += `.B AIRCHITECT_VERBOSE\n`;
    manPage += `Set to any value to enable verbose output\n`;

    // Files section
    manPage += `\n.SH FILES\n`;
    manPage += `.TP\n`;
    manPage += `.I ~/.airchitect/config.json\n`;
    manPage += `Default location for user configuration\n`;
    manPage += `.TP\n`;
    manPage += `.I $AIRCHITECT_CONFIG_PATH or .airchitect/config.json\n`;
    manPage += `Configuration file path\n`;

    // See also section
    manPage += `\n.SH SEE ALSO\n`;
    manPage += `Manual pages for individual commands: `;

    const commandRefs = commands.map((cmd) => `${cmd.name}(${opts.section})`);
    manPage += commandRefs.join(', ') + '\n';

    // Authors section
    manPage += `\n.SH AUTHOR\n`;
    manPage += `The AIrchitect team.\n`;

    // Custom footer
    manPage += `\n.SH COPYRIGHT\n`;
    manPage += `This software is licensed under the MIT license.\n`;

    return manPage;
  }
}
