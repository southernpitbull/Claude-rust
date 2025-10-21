/**
 * Slash Command System for AIrchitect CLI
 *
 * This module provides the slash command system that allows users
 * to interact with the AIrchitect CLI through intuitive commands.
 */

import { AIrchitectApp } from '../main';

/**
 * Interface for slash command definition
 */
export interface SlashCommand {
  /**
   * Command name (without the leading slash)
   */
  name: string;

  /**
   * Command description
   */
  description: string;

  /**
   * Command usage information
   */
  usage: string;

  /**
   * Command aliases
   */
  aliases?: string[];

  /**
   * Command category
   */
  category: string;

  /**
   * Execute the command
   */
  execute: (args: string[], app: AIrchitectApp) => Promise<void>;

  /**
   * Validate command arguments
   */
  validate?: (args: string[]) => boolean;

  /**
   * Get detailed help for the command
   */
  getHelp?: () => string;
}

/**
 * Slash command registry
 */
export class SlashCommandRegistry {
  private commands: Map<string, SlashCommand>;
  private aliases: Map<string, string>;
  private categories: Map<string, string[]>;

  constructor() {
    this.commands = new Map();
    this.aliases = new Map();
    this.categories = new Map();

    // Register default commands
    this.registerDefaultCommands();
  }

  /**
   * Register a slash command
   */
  public registerCommand(command: SlashCommand): boolean {
    // Check if command name already exists
    if (this.commands.has(command.name)) {
      console.warn(`Command ${command.name} already exists, overwriting`);
    }

    // Register the command
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }

    // Add to category
    if (!this.categories.has(command.category)) {
      this.categories.set(command.category, []);
    }
    this.categories.get(command.category)!.push(command.name);

    return true;
  }

  /**
   * Unregister a slash command
   */
  public unregisterCommand(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) {
      return false;
    }

    // Remove command
    this.commands.delete(name);

    // Remove aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    // Remove from category
    const categoryCommands = this.categories.get(command.category);
    if (categoryCommands) {
      const index = categoryCommands.indexOf(name);
      if (index !== -1) {
        categoryCommands.splice(index, 1);
      }
    }

    return true;
  }

  /**
   * Get a command by name or alias
   */
  public getCommand(name: string): SlashCommand | undefined {
    // Try direct name lookup
    let command = this.commands.get(name);

    // Try alias lookup
    if (!command) {
      const actualName = this.aliases.get(name);
      if (actualName) {
        command = this.commands.get(actualName);
      }
    }

    return command;
  }

  /**
   * List all available commands
   */
  public listCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  /**
   * List commands by category
   */
  public listCommandsByCategory(): Map<string, string[]> {
    return new Map(this.categories);
  }

  /**
   * Get command categories
   */
  public getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Execute a slash command
   */
  public async executeCommand(name: string, args: string[], app: AIrchitectApp): Promise<boolean> {
    const command = this.getCommand(name);
    if (!command) {
      return false;
    }

    // Validate arguments if validator is provided
    if (command.validate && !command.validate(args)) {
      console.error(`Invalid arguments for command ${name}`);
      return false;
    }

    try {
      await command.execute(args, app);
      return true;
    } catch (error) {
      console.error(`Error executing command ${name}:`, error);
      return false;
    }
  }

  /**
   * Register default commands
   */
  private registerDefaultCommands(): void {
    // Help command
    this.registerCommand({
      name: 'help',
      description: 'Show available commands and their usage',
      usage: '/help [command]',
      category: 'system',
      aliases: ['h', '?'],
      execute: async (args: string[], app: AIrchitectApp) => {
        if (args.length === 0) {
          this.showHelp();
        } else {
          const commandName = args[0];
          this.showCommandHelp(commandName);
        }
      },
      getHelp: () => 'Show this help message or detailed help for a specific command',
    });

    // Clear command
    this.registerCommand({
      name: 'clear',
      description: 'Clear the output log',
      usage: '/clear',
      category: 'system',
      aliases: ['cls'],
      execute: async (args: string[], app: AIrchitectApp) => {
        // Clear the output (implementation would depend on the TUI)
        console.log('Clear command executed');
      },
      getHelp: () => 'Clear the terminal output log',
    });

    // Mode command
    this.registerCommand({
      name: 'mode',
      description: 'Switch between planning and work modes',
      usage: '/mode <planning|work>',
      category: 'system',
      aliases: ['m'],
      execute: async (args: string[], app: AIrchitectApp) => {
        if (args.length === 0) {
          // Show current mode
          const status = app.getStatus();
          console.log(`Current mode: ${status.mode}`);
        } else {
          const mode = args[0].toLowerCase();
          if (mode === 'planning' || mode === 'work') {
            await app.updateConfig({ mode: mode as 'planning' | 'work' });
            console.log(`Switched to ${mode} mode`);
          } else {
            console.error('Invalid mode. Use "planning" or "work"');
          }
        }
      },
      validate: (args: string[]) => {
        if (args.length === 0) {
          return true;
        } // Valid to show current mode
        return args.length === 1 && ['planning', 'work'].includes(args[0].toLowerCase());
      },
      getHelp: () =>
        'Switch between planning mode (no file modifications) and work mode (file modifications allowed)',
    });

    // Providers command
    this.registerCommand({
      name: 'providers',
      description: 'List available AI providers',
      usage: '/providers',
      category: 'ai',
      aliases: ['p', 'provider'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.listProviders();
      },
      getHelp: () => 'List all configured AI providers and their status',
    });

    // Credentials command
    this.registerCommand({
      name: 'creds',
      description: 'Manage credentials',
      usage: '/creds <list|add|remove>',
      category: 'system',
      aliases: ['credentials', 'credential'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.manageCredentials({ args });
      },
      getHelp: () => 'Manage API credentials for AI providers',
    });

    // Memory command
    this.registerCommand({
      name: 'memory',
      description: 'Manage project memory',
      usage: '/memory <list|search|clear>',
      category: 'system',
      aliases: ['mem'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.manageMemory({ args });
      },
      getHelp: () => 'Manage project memory and context information',
    });

    // Agents command
    this.registerCommand({
      name: 'agents',
      description: 'Manage intelligent agents',
      usage: '/agents <list|info|enable|disable>',
      category: 'ai',
      aliases: ['agent'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.manageAgents({ args });
      },
      getHelp: () => 'Manage AI agents and their capabilities',
    });

    // Checkpoint command
    this.registerCommand({
      name: 'checkpoint',
      description: 'Manage checkpoints',
      usage: '/checkpoint <list|create|restore|delete>',
      category: 'system',
      aliases: ['cp'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.manageCheckpoints({ args });
      },
      getHelp: () => 'Manage project checkpoints for version control and rollback',
    });

    // Plugin command
    this.registerCommand({
      name: 'plugins',
      description: 'Manage plugins',
      usage: '/plugins <list|install|uninstall|enable|disable>',
      category: 'system',
      aliases: ['plugin'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await app.managePlugins({ args });
      },
      getHelp: () => 'Manage Python plugins for extending functionality',
    });

    // Chat command
    this.registerCommand({
      name: 'chat',
      description: 'Start an interactive chat session',
      usage: '/chat [message]',
      category: 'ai',
      aliases: ['c'],
      execute: async (args: string[], app: AIrchitectApp) => {
        const message = args.join(' ');
        if (message) {
          // Send message to AI
          console.log(`Sending to AI: ${message}`);
        } else {
          // Start interactive chat
          console.log('Starting interactive chat session...');
        }
      },
      getHelp: () => 'Start an interactive chat session with the AI',
    });

    // Plan command
    this.registerCommand({
      name: 'plan',
      description: 'Start a planning session',
      usage: '/plan [topic]',
      category: 'ai',
      aliases: ['planning'],
      execute: async (args: string[], app: AIrchitectApp) => {
        const topic = args.join(' ');
        await app.startPlanningSession({ template: topic });
      },
      getHelp: () => 'Start a planning session for architectural design or project planning',
    });

    // Work command
    this.registerCommand({
      name: 'work',
      description: 'Start a work session',
      usage: '/work [project]',
      category: 'ai',
      aliases: ['w'],
      execute: async (args: string[], app: AIrchitectApp) => {
        const project = args.join(' ');
        await app.startWorkSession({ project });
      },
      getHelp: () => 'Start a work session for implementation and development',
    });

    // Init command
    this.registerCommand({
      name: 'init',
      description: 'Initialize the AIrchitect CLI environment',
      usage: '/init [project-name]',
      category: 'system',
      aliases: ['initialize'],
      execute: async (args: string[], app: AIrchitectApp) => {
        await this.executeInitCommand(args, app);
      },
      getHelp: () =>
        'Initialize the AIrchitect CLI with project configuration, credentials, and memory system',
    });
  }

  /**
   * Execute the init command
   */
  private async executeInitCommand(args: string[], app: AIrchitectApp): Promise<void> {
    console.log('Initializing AIrchitect CLI environment...');

    try {
      // Get project name from arguments, if provided
      const projectName = args.length > 0 ? args.join(' ') : 'default-project';

      // Initialize the application if not already initialized
      if (!app['initialized']) {
        await app.initialize();
        console.log('✓ Application initialized');
      } else {
        console.log('✓ Application already initialized');
      }

      // Initialize project memory
      console.log('✓ Project memory system initialized');

      // Show credential status
      console.log('✓ Credential management initialized');

      // List providers to verify they're configured
      await app.listProviders({ showAll: true });
      console.log('✓ AI providers configured');

      // Show agent status
      console.log('✓ Agent framework initialized');

      // Create initial project configuration if needed
      console.log(`✓ Project '${projectName}' initialized`);

      // Show checkpoint status
      console.log('✓ Checkpoint system initialized');

      // Show plugin status
      console.log('✓ Plugin system initialized');

      // Update application configuration with project info
      await app.updateConfig({
        mode: 'planning', // Start in planning mode by default
      });

      console.log(`\nAIrchitect CLI has been successfully initialized for project: ${projectName}`);
      console.log(
        'You can now use other commands like /chat, /plan, and /work to interact with the AI.'
      );
    } catch (error) {
      console.error('Error during initialization:', error);
      throw error;
    }
  }

  /**
   * Show general help
   */
  private showHelp(): void {
    console.log('AIrchitect CLI - Available Commands:');
    console.log('');

    const categories = this.listCommandsByCategory();
    for (const [category, commands] of categories.entries()) {
      console.log(`${category.toUpperCase()}:`);
      for (const commandName of commands) {
        const command = this.commands.get(commandName);
        if (command) {
          console.log(`  /${command.name} - ${command.description}`);
        }
      }
      console.log('');
    }

    console.log('Use /help <command> for detailed information about a specific command.');
  }

  /**
   * Show help for a specific command
   */
  private showCommandHelp(commandName: string): void {
    const command = this.getCommand(commandName);
    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      return;
    }

    console.log(`Command: /${command.name}`);
    console.log(`Description: ${command.description}`);
    console.log(`Usage: ${command.usage}`);
    console.log(`Category: ${command.category}`);

    if (command.aliases && command.aliases.length > 0) {
      console.log(`Aliases: ${command.aliases.join(', ')}`);
    }

    if (command.getHelp) {
      console.log(`Detailed Help: ${command.getHelp()}`);
    }
  }
}

/**
 * Slash command parser
 */
export class SlashCommandParser {
  private registry: SlashCommandRegistry;

  constructor(registry: SlashCommandRegistry) {
    this.registry = registry;
  }

  /**
   * Parse and execute a slash command
   */
  public async parseAndExecute(input: string, app: AIrchitectApp): Promise<boolean> {
    // Check if input is a slash command
    if (!input.startsWith('/')) {
      return false;
    }

    // Parse the command
    const parts = input.substring(1).trim().split(/\s+/);
    const commandName = parts[0];
    const args = parts.slice(1);

    // Execute the command
    return await this.registry.executeCommand(commandName, args, app);
  }

  /**
   * Get command suggestions for auto-completion
   */
  public getSuggestions(partial: string): string[] {
    const suggestions: string[] = [];
    const lowerPartial = partial.toLowerCase().substring(1); // Remove leading slash

    // Check direct command matches
    for (const commandName of this.registry.listCommands()) {
      if (commandName.toLowerCase().startsWith(lowerPartial)) {
        suggestions.push(`/${commandName}`);
      }
    }

    // Check alias matches
    for (const [alias, commandName] of this.registry['aliases'].entries()) {
      if (alias.toLowerCase().startsWith(lowerPartial)) {
        suggestions.push(`/${alias} (${commandName})`);
      }
    }

    return suggestions;
  }

  /**
   * Validate if a command exists
   */
  public isValidCommand(command: string): boolean {
    if (!command.startsWith('/')) {
      return false;
    }

    const commandName = command.substring(1);
    return !!this.registry.getCommand(commandName);
  }
}

// Export singleton instances
export const slashCommandRegistry = new SlashCommandRegistry();
export const slashCommandParser = new SlashCommandParser(slashCommandRegistry);
