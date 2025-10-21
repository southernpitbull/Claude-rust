/**
 * CompletionCommand.ts
 *
 * Implements the 'completion' command for managing shell completions.
 * Allows users to install, uninstall, or generate completion scripts.
 */

import { Command } from '../core/cli/Command';
import { ValidationService } from '../core/cli/ValidationService';
import { CompletionGenerator } from '../core/cli/CompletionGenerator';
import { CommandRegistry } from '../core/cli/CommandRegistry';
import { Logger } from '../utils/Logger';

export class CompletionCommand extends Command {
  public name = 'completion';
  public description = 'Install or generate shell completion scripts';

  public options = [
    {
      flags: '-s, --shell <shell>',
      description: 'Shell type (bash, zsh, fish, powershell)',
      defaultValue: 'auto',
    },
    {
      flags: '-i, --install',
      description: 'Install completion script to shell',
      required: false,
    },
    {
      flags: '-u, --uninstall',
      description: 'Uninstall completion script from shell',
      required: false,
    },
    {
      flags: '-o, --output <file>',
      description: 'Output file for completion script',
      required: false,
    },
    {
      flags: '--print',
      description: 'Print completion script to stdout',
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
    // Extract options passed to the command
    const options: any = args[args.length - 1] || {};

    const shell = options.shell || 'auto';
    const install = options.install || false;
    const uninstall = options.uninstall || false;
    const outputFile = options.output;
    const printToStdout = options.print || false;

    // Pre-execute validation
    if (this.preExecute) {
      await this.preExecute();
    }

    try {
      // Determine which shell to use
      let targetShell: 'bash' | 'zsh' | 'fish' | 'powershell';

      if (shell === 'auto') {
        // Auto-detect shell
        const detectedShell = process.env.SHELL;
        if (detectedShell?.includes('bash')) {
          targetShell = 'bash';
        } else if (detectedShell?.includes('zsh')) {
          targetShell = 'zsh';
        } else if (detectedShell?.includes('fish')) {
          targetShell = 'fish';
        } else if (process.platform === 'win32') {
          targetShell = 'powershell';
        } else {
          targetShell = 'bash'; // Default fallback
        }
        this.logger.info(`Auto-detected shell: ${targetShell}`);
      } else if (['bash', 'zsh', 'fish', 'powershell'].includes(shell)) {
        targetShell = shell as 'bash' | 'zsh' | 'fish' | 'powershell';
      } else {
        throw new Error(`Invalid shell: ${shell}. Use bash, zsh, fish, or powershell.`);
      }

      // Create completion generator
      const completionGenerator = new CompletionGenerator(this.commandRegistry);

      // Handle uninstall first
      if (uninstall) {
        await completionGenerator.uninstallCompletion({ shell: targetShell });
        this.logger.info(`Completion uninstalled for ${targetShell} shell`);
        return;
      }

      // Generate completion script
      const completionScript = completionGenerator.generateCompletionScript(targetShell);

      // Handle output options
      if (outputFile) {
        const fs = await import('fs');
        fs.writeFileSync(outputFile, completionScript);
        this.logger.info(`Completion script written to: ${outputFile}`);
      }

      if (printToStdout) {
        console.log(completionScript);
      }

      if (install) {
        await completionGenerator.installCompletion({ shell: targetShell, install: true });
        this.logger.info(`Completion installed for ${targetShell} shell`);
        this.logger.info(
          'Please restart your terminal or run `source ~/.bashrc` (or equivalent) to activate completions.'
        );
      } else if (!outputFile && !printToStdout && !install) {
        // Default behavior: install if no other options specified
        this.logger.info(`Completion script for ${targetShell} generated.`);
        this.logger.info(
          'Use --install to install automatically, --output to save to file, or --print to show on stdout.'
        );
      }

      // Post-execute actions
      if (this.postExecute) {
        await this.postExecute();
      }
    } catch (error) {
      this.logger.error('Completion command failed:', error);
      throw error;
    }
  }

  public getHelp(): string {
    return `
The completion command generates shell completion scripts for the AIrchitect CLI.

Examples:
  airchitect completion --install               # Install completion for your shell
  airchitect completion --shell zsh --install   # Install completion for zsh
  airchitect completion --print                 # Print completion script to stdout
  airchitect completion --output ~/.airchitect-completion.bash  # Save to file
  airchitect completion --uninstall             # Uninstall completion
    `;
  }

  /**
   * Validate command arguments
   * @param args - Arguments passed to the command
   * @returns Boolean indicating if arguments are valid
   */
  public validate(...args: any[]): boolean {
    const options: any = args[args.length - 1] || {};

    // Validate shell if provided
    if (options.shell && options.shell !== 'auto') {
      const validShells = ['bash', 'zsh', 'fish', 'powershell'];
      if (!validShells.includes(options.shell)) {
        console.error(
          `Invalid shell: ${options.shell}. Valid options are: ${validShells.join(', ')}`
        );
        return false;
      }
    }

    // Validate mutually exclusive options
    const install = options.install || false;
    const uninstall = options.uninstall || false;
    const print = options.print || false;

    if (install && uninstall) {
      console.error('Cannot specify both --install and --uninstall');
      return false;
    }

    if ((install || uninstall) && print) {
      console.error('Cannot combine --install/--uninstall with --print');
      return false;
    }

    return true;
  }
}
