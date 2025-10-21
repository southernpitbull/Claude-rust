/**
 * CompletionGenerator.ts
 *
 * Generates shell completion scripts for the AIrchitect CLI.
 * Supports bash, zsh, fish, and PowerShell completion.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CommandRegistry } from './CommandRegistry';
import { BaseCommand } from './Command.interface';
import { Logger } from '../../utils/Logger';

export interface CompletionOptions {
  shell?: 'bash' | 'zsh' | 'fish' | 'powershell';
  install?: boolean;
  uninstall?: boolean;
}

export class CompletionGenerator {
  private commandRegistry: CommandRegistry;
  private logger: Logger;
  private scriptDir: string;

  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
    this.logger = new Logger('info');
    this.scriptDir = path.join(__dirname, '..', '..', '..', 'scripts', 'completions');

    // Ensure the script directory exists
    if (!fs.existsSync(this.scriptDir)) {
      fs.mkdirSync(this.scriptDir, { recursive: true });
    }
  }

  /**
   * Generate completion script for the specified shell
   * @param shell - The shell to generate completion for
   * @returns The completion script as a string
   */
  public generateCompletionScript(shell: 'bash' | 'zsh' | 'fish' | 'powershell' = 'bash'): string {
    switch (shell) {
      case 'bash':
        return this.generateBashCompletion();
      case 'zsh':
        return this.generateZshCompletion();
      case 'fish':
        return this.generateFishCompletion();
      case 'powershell':
        return this.generatePowerShellCompletion();
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  /**
   * Install completion script for the specified shell
   * @param options - Installation options
   */
  public async installCompletion(options: CompletionOptions = {}): Promise<void> {
    const shell = options.shell || this.detectShell();
    const script = this.generateCompletionScript(shell);
    const fileName = `airchitect.${this.getFileExtension(shell)}`;

    // Write the completion script to the appropriate location
    const scriptPath = path.join(this.scriptDir, fileName);
    fs.writeFileSync(scriptPath, script);
    this.logger.info(`Completion script generated: ${scriptPath}`);

    if (options.install !== false) {
      // Default to true if not explicitly false
      await this.installToShell(shell, scriptPath);
    }
  }

  /**
   * Uninstall completion script for the specified shell
   * @param options - Uninstallation options
   */
  public async uninstallCompletion(options: CompletionOptions = {}): Promise<void> {
    const shell = options.shell || this.detectShell();
    await this.uninstallFromShell(shell);
  }

  /**
   * Generate bash completion script
   */
  private generateBashCompletion(): string {
    const commands = this.commandRegistry.getCommandNames();
    const commandsList = commands.join(' ');

    return `#!/bin/bash
# Bash completion script for airchitect CLI

_airchitect_completion() {
    local cur prev words cword
    _init_completion || return

    case $cword in
        1)
            # Complete command names
            COMPREPLY=( $(compgen -W "${commandsList}" -- \\$cur) )
            ;;
        *)
            prev="\\${words[cword - 1]}"
            case "\\$prev" in
                ${commands.map((cmd) => `"${cmd}"`).join('\n                | ')}
                )
                    # Add specific completions for each command here if needed
                    ;;
                -p|--provider)
                    COMPREPLY=( $(compgen -W "openai anthropic google ollama" -- \\$cur) )
                    ;;
                -m|--model)
                    # Model completions would go here
                    ;;
                *)
                    # Default file path completion
                    _filedir
                    ;;
            esac
            ;;
    esac
}

complete -F _airchitect_completion airchitect
`;
  }

  /**
   * Generate zsh completion script
   */
  private generateZshCompletion(): string {
    const commands = this.commandRegistry.getCommandNames();
    const commandsList = commands.join(' ');

    return `#compdef airchitect

local -a _1st_arguments
_1st_arguments=(
    '${commandsList
      .split(' ')
      .map((cmd) => `${cmd}:description for ${cmd}`)
      .join('\n    | ')}'
)

_arguments -C \\
    '1: :->cmds' \\
    '*::arg:->args'

case $state in
    cmds)
        _describe -t commands 'airchitect commands' _1st_arguments
        ;;
    args)
        case $words[2] in
            ${commands
              .map(
                (cmd) => `${cmd})
                # Specific completions for ${cmd}
                ;;
            `
              )
              .join('            | ')}
        esac
        ;;
esac
`;
  }

  /**
   * Generate fish completion script
   */
  private generateFishCompletion(): string {
    const commands = this.commandRegistry.getCommandNames();

    let fishCompletions = `# Fish completion script for airchitect CLI

# Base command
complete -c airchitect -n '__fish_use_subcommand' -xa '${commands.join(' ')}'

# Subcommands and their options
`;

    // Add command-specific completions
    for (const cmd of commands) {
      const command = this.commandRegistry.getCommand(cmd);
      fishCompletions += `\n# ${cmd} command\n`;
      fishCompletions += `complete -c airchitect -n '__fish_seen_subcommand_from ${cmd}' `;

      if (command && command.options) {
        for (const option of command.options) {
          fishCompletions += `-l ${option.flags.replace(/^-+/, '').replace(/\s.*/, '')} `;
          fishCompletions += `-d "${option.description}" `;
        }
      }
      fishCompletions += `-xa ""\n`;
    }

    return fishCompletions;
  }

  /**
   * Generate PowerShell completion script
   */
  private generatePowerShellCompletion(): string {
    const commands = this.commandRegistry.getCommandNames();
    const commandsList = commands.map((cmd) => `'${cmd}'`).join(', ');

    return `# PowerShell completion script for airchitect CLI

Register-ArgumentCompleter -CommandName 'airchitect' -ScriptBlock {
    param($commandName, $parameterName, $wordToComplete, $commandAst, $fakeBoundParameter)

    $availableCommands = @(${commandsList})

    if ($parameterName -eq 'action') {
        return $availableCommands | Where-Object { $_ -like "\\*$wordToComplete*" }
    }

    # Add more specific completions as needed
    return @()
}
`;
  }

  /**
   * Detect the current shell
   */
  private detectShell(): 'bash' | 'zsh' | 'fish' | 'powershell' {
    const shellEnv = process.env.SHELL;
    if (shellEnv) {
      if (shellEnv.includes('bash')) {
        return 'bash';
      }
      if (shellEnv.includes('zsh')) {
        return 'zsh';
      }
      if (shellEnv.includes('fish')) {
        return 'fish';
      }
    }

    // On Windows, check if we're in PowerShell
    if (process.platform === 'win32') {
      return 'powershell';
    }

    // Default to bash
    return 'bash';
  }

  /**
   * Get the appropriate file extension for the shell
   */
  private getFileExtension(shell: 'bash' | 'zsh' | 'fish' | 'powershell'): string {
    switch (shell) {
      case 'bash':
        return 'bash';
      case 'zsh':
        return 'zsh';
      case 'fish':
        return 'fish';
      case 'powershell':
        return 'ps1';
    }
  }

  /**
   * Install the completion script to the appropriate shell location
   */
  private async installToShell(
    shell: 'bash' | 'zsh' | 'fish' | 'powershell',
    scriptPath: string
  ): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('Could not determine home directory');
    }

    let targetPath = '';
    let appendToConfig = '';

    switch (shell) {
      case 'bash':
        targetPath = path.join(homeDir, '.bash_completion');
        if (!fs.existsSync(targetPath)) {
          targetPath = path.join(homeDir, '.bashrc');
        }
        appendToConfig = `\n# AIrchitect CLI completions\n[[ -f '${scriptPath}' ]] && source '${scriptPath}'\n`;
        break;

      case 'zsh':
        targetPath = path.join(homeDir, '.zshrc');
        appendToConfig = `\n# AIrchitect CLI completions\nfpath+=('${path.dirname(scriptPath)}')\nautoload -Uz compinit && compinit\n`;
        break;

      case 'fish':
        const fishCompletionsDir = path.join(homeDir, '.config', 'fish', 'completions');
        if (!fs.existsSync(fishCompletionsDir)) {
          fs.mkdirSync(fishCompletionsDir, { recursive: true });
        }
        targetPath = path.join(fishCompletionsDir, 'airchitect.fish');
        fs.copyFileSync(scriptPath, targetPath);
        this.logger.info(`Fish completion installed to: ${targetPath}`);
        return; // Return early as fish is handled differently

      case 'powershell':
        // For PowerShell, we'd add to the profile
        const psProfile =
          process.env.PROFILE ||
          path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
        targetPath = psProfile;
        appendToConfig = `\n# AIrchitect CLI completions\n. '${scriptPath}'\n`;
        break;
    }

    // Append the source command to the shell config file
    if (appendToConfig) {
      fs.appendFileSync(targetPath, appendToConfig);
      this.logger.info(`${shell} completion installed to: ${targetPath}`);
    }
  }

  /**
   * Uninstall the completion script from the shell
   */
  private async uninstallFromShell(shell: 'bash' | 'zsh' | 'fish' | 'powershell'): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      throw new Error('Could not determine home directory');
    }

    let configPath = '';

    switch (shell) {
      case 'bash':
        configPath = path.join(homeDir, '.bash_completion');
        if (!fs.existsSync(configPath)) {
          configPath = path.join(homeDir, '.bashrc');
        }
        break;

      case 'zsh':
        configPath = path.join(homeDir, '.zshrc');
        break;

      case 'fish':
        const fishCompletionsDir = path.join(homeDir, '.config', 'fish', 'completions');
        configPath = path.join(fishCompletionsDir, 'airchitect.fish');
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
          this.logger.info(`Fish completion uninstalled from: ${configPath}`);
        }
        return; // Return early as fish is handled differently

      case 'powershell':
        const psProfile =
          process.env.PROFILE ||
          path.join(homeDir, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
        configPath = psProfile;
        break;
    }

    // Remove the AIrchitect completion line from the config file
    if (configPath && fs.existsSync(configPath)) {
      let content = fs.readFileSync(configPath, 'utf8');
      const lines = content.split('\n');
      const filteredLines = lines.filter(
        (line) => !line.includes('AIrchitect CLI completions') && !line.includes('airchitect')
      );
      content = filteredLines.join('\n');

      fs.writeFileSync(configPath, content);
      this.logger.info(`${shell} completion uninstalled from: ${configPath}`);
    }
  }

  /**
   * Generate dynamic completions based on context
   */
  public generateDynamicCompletions(command: string, partial: string, args: string[]): string[] {
    // This would provide context-aware completions based on the current command
    // and previous arguments
    const completions: string[] = [];

    switch (command) {
      case 'chat':
        if (args.some((arg) => ['-p', '--provider'].includes(arg))) {
          // If provider option was specified, suggest providers
          return ['openai', 'anthropic', 'google', 'ollama'];
        } else if (args.includes('--model')) {
          // If model option was specified, suggest models
          return ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'];
        }
        break;

      case 'agents':
        // If we're dealing with the agents command
        if (args.length === 0) {
          // Suggest agent actions
          return ['list', 'info', 'enable', 'disable', 'create', 'remove'];
        }
        break;

      case 'config':
        if (args.length === 0) {
          // Suggest config actions
          return ['get', 'set', 'list'];
        }
        break;

      default:
        // For other commands, suggest options or subcommands
        const cmd = this.commandRegistry.getCommand(command);
        if (cmd && cmd.options) {
          const availableOptions = cmd.options
            .map((opt) => opt.flags.split(' ')[0]) // Get the main flag
            .filter((opt) => !args.includes(opt)); // Filter out already specified options
          return availableOptions;
        }
    }

    return completions;
  }
}
