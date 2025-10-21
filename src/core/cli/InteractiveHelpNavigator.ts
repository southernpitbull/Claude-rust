/**
 * InteractiveHelpNavigator.ts
 *
 * Provides interactive navigation through AIrchitect CLI help information.
 * Allows users to browse commands and options interactively.
 */

import { CommandRegistry } from './CommandRegistry';
import { BaseCommand } from './Command.interface';
import { HelpFormatter } from './HelpFormatter';
import readline from 'readline';
import chalk from 'chalk';

export interface NavigationState {
  currentView: 'main' | 'command' | 'search' | 'examples';
  currentCommand?: string;
  searchTerm?: string;
  selectedIndex: number;
  items: any[];
}

export class InteractiveHelpNavigator {
  private commandRegistry: CommandRegistry;
  private helpFormatter: HelpFormatter;
  private rl: readline.Interface;
  private state: NavigationState;

  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
    this.helpFormatter = new HelpFormatter(commandRegistry, true); // Enable colors
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.state = {
      currentView: 'main',
      selectedIndex: 0,
      items: [],
    };
  }

  /**
   * Start the interactive help session
   */
  public async start(): Promise<void> {
    console.log(chalk.bold.blue('AIrchitect CLI Interactive Help'));
    console.log(chalk.gray('Use arrow keys to navigate, Enter to select, q to quit\n'));

    await this.renderCurrentView();
    await this.handleInput();
  }

  /**
   * Render the current help view based on navigation state
   */
  private async renderCurrentView(): Promise<void> {
    console.clear();

    switch (this.state.currentView) {
      case 'main':
        await this.renderMainView();
        break;
      case 'command':
        await this.renderCommandView();
        break;
      case 'search':
        await this.renderSearchView();
        break;
      case 'examples':
        await this.renderExamplesView();
        break;
    }
  }

  /**
   * Render the main help view with all commands
   */
  private async renderMainView(): Promise<void> {
    const commands = this.commandRegistry.getAllCommands();
    this.state.items = commands;

    console.log(chalk.bold.blue('Available Commands:\n'));

    commands.forEach((cmd, index) => {
      const isSelected = index === this.state.selectedIndex;
      const marker = isSelected ? chalk.green('> ') : '  ';
      const name = isSelected ? chalk.bold.green(cmd.name) : chalk.green(cmd.name);

      console.log(`${marker}${name} - ${cmd.description}`);
    });

    console.log(
      '\n' + chalk.gray('Use ↑/↓ to navigate, Enter to view details, / for search, q to quit')
    );
  }

  /**
   * Render a specific command's help view
   */
  private async renderCommandView(): Promise<void> {
    if (!this.state.currentCommand) {
      await this.goBackToMain();
      return;
    }

    const command = this.commandRegistry.getCommand(this.state.currentCommand);
    if (!command) {
      console.log(chalk.red(`Command "${this.state.currentCommand}" not found`));
      await this.goBackToMain();
      return;
    }

    // Show command help
    console.log(this.helpFormatter.formatCommand(this.state.currentCommand));

    // Show usage examples
    console.log('\n' + this.helpFormatter.formatUsageExamples(this.state.currentCommand));

    console.log('\n' + chalk.gray('Use b to go back, e for examples, q to quit'));
  }

  /**
   * Render search view
   */
  private async renderSearchView(): Promise<void> {
    console.log(chalk.bold.blue('Search Commands:\n'));

    if (this.state.searchTerm) {
      console.log(chalk.gray(`Search results for: "${this.state.searchTerm}"\n`));

      const commands = this.commandRegistry.getAllCommands();
      const results = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(this.state.searchTerm!.toLowerCase()) ||
          cmd.description.toLowerCase().includes(this.state.searchTerm!.toLowerCase())
      );

      this.state.items = results;

      if (results.length === 0) {
        console.log(chalk.yellow('No commands found matching your search.'));
      } else {
        results.forEach((cmd, index) => {
          const isSelected = index === this.state.selectedIndex;
          const marker = isSelected ? chalk.green('> ') : '  ';
          const name = isSelected ? chalk.bold.green(cmd.name) : chalk.green(cmd.name);

          console.log(`${marker}${name} - ${cmd.description}`);
        });
      }
    } else {
      console.log(chalk.gray('Enter search term at the prompt below.'));
    }

    console.log(
      '\n' + chalk.gray('Use ↑/↓ to navigate, Enter to view details, b to go back, q to quit')
    );
  }

  /**
   * Render usage examples view
   */
  private async renderExamplesView(): Promise<void> {
    if (!this.state.currentCommand) {
      await this.goBackToMain();
      return;
    }

    const examples = this.helpFormatter.formatUsageExamples(this.state.currentCommand);
    console.log(chalk.bold.blue(`Usage Examples for ${this.state.currentCommand}:\n`));
    console.log(examples);

    console.log('\n' + chalk.gray('Use b to go back to command, q to quit'));
  }

  /**
   * Handle user input
   */
  private async handleInput(): Promise<void> {
    const prompt = this.getPrompt();
    this.rl.question(prompt, async (input) => {
      const key = input.toLowerCase().trim();

      // Handle navigation keys
      switch (key) {
        case 'q':
        case 'quit':
        case 'exit':
          console.log(chalk.blue('\nExiting interactive help. Goodbye!'));
          this.rl.close();
          return;

        case 'b':
        case 'back':
          await this.goBack();
          break;

        case 'e':
        case 'examples':
          if (this.state.currentView === 'command') {
            this.state.currentView = 'examples';
          }
          break;

        case '/':
          if (this.state.currentView === 'main') {
            this.state.currentView = 'search';
            this.state.selectedIndex = 0;
          }
          break;

        case 'arrowup':
        case 'up':
          if (this.state.items.length > 0) {
            this.state.selectedIndex = Math.max(0, this.state.selectedIndex - 1);
          }
          break;

        case 'arrowdown':
        case 'down':
          if (this.state.items.length > 0) {
            this.state.selectedIndex = Math.min(
              this.state.items.length - 1,
              this.state.selectedIndex + 1
            );
          }
          break;

        case 'enter':
        case '\r':
        case '\n':
          await this.handleEnter();
          break;

        default:
          // Handle search term input
          if (this.state.currentView === 'search') {
            this.state.searchTerm = input;
            this.state.selectedIndex = 0;
          }
          break;
      }

      await this.renderCurrentView();
      await this.handleInput();
    });
  }

  /**
   * Get appropriate prompt for current view
   */
  private getPrompt(): string {
    switch (this.state.currentView) {
      case 'search':
        return chalk.gray('\nEnter search term: ');
      default:
        return chalk.gray('\nEnter command or key: ');
    }
  }

  /**
   * Handle Enter key press based on current view
   */
  private async handleEnter(): Promise<void> {
    switch (this.state.currentView) {
      case 'main':
        await this.selectCommand();
        break;
      case 'search':
        await this.selectSearchResult();
        break;
      case 'examples':
        this.state.currentView = 'command';
        break;
    }
  }

  /**
   * Select a command from the main view
   */
  private async selectCommand(): Promise<void> {
    const commands = this.commandRegistry.getAllCommands();

    if (this.state.selectedIndex >= 0 && this.state.selectedIndex < commands.length) {
      const selectedCommand = commands[this.state.selectedIndex];
      this.state.currentCommand = selectedCommand.name;
      this.state.currentView = 'command';
      this.state.selectedIndex = 0;
    }
  }

  /**
   * Select a command from search results
   */
  private async selectSearchResult(): Promise<void> {
    const commands = this.commandRegistry.getAllCommands();
    const searchResults = commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(this.state.searchTerm!.toLowerCase()) ||
        cmd.description.toLowerCase().includes(this.state.searchTerm!.toLowerCase())
    );

    if (this.state.selectedIndex >= 0 && this.state.selectedIndex < searchResults.length) {
      const selectedCommand = searchResults[this.state.selectedIndex];
      this.state.currentCommand = selectedCommand.name;
      this.state.currentView = 'command';
      this.state.selectedIndex = 0;
    }
  }

  /**
   * Go back to previous view
   */
  private async goBack(): Promise<void> {
    switch (this.state.currentView) {
      case 'command':
      case 'examples':
        await this.goBackToMain();
        break;
      case 'search':
        this.state.currentView = 'main';
        this.state.selectedIndex = 0;
        this.state.searchTerm = undefined;
        break;
      default:
        // In main view, quit
        console.log(chalk.blue('\nExiting interactive help. Goodbye!'));
        this.rl.close();
        break;
    }
  }

  /**
   * Go back to main view
   */
  private async goBackToMain(): Promise<void> {
    this.state.currentView = 'main';
    this.state.currentCommand = undefined;
    this.state.selectedIndex = 0;
    this.state.searchTerm = undefined;
    this.state.items = this.commandRegistry.getAllCommands();
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.rl.close();
  }
}
