/**
 * CLIApp.ts
 *
 * Main application class for the AIrchitect CLI.
 * Orchestrates command registration, configuration, and execution.
 */

import { CommandRegistry } from './CommandRegistry';
import { BaseCommand } from './Command.interface';
import { ConfigManager } from '../../config/ConfigManager';
import { Logger } from '../../utils/Logger';
import { AIProviderManager } from '../../providers/AIProviderManager';
import { ProjectMemory } from '../../memory/ProjectMemory';
import { AgentRegistry } from '../../agents/AgentRegistry';

export interface CLIAppConfig {
  debug?: boolean;
  verbose?: boolean;
  configPath?: string;
  theme?: string;
  mode?: 'planning' | 'work';
  providers?: string[];
}

export class CLIApp {
  private commandRegistry: CommandRegistry;
  private config: CLIAppConfig;
  private configManager: ConfigManager;
  private logger: Logger;
  private aiProviderManager: AIProviderManager;
  private projectMemory: ProjectMemory;
  private agentRegistry: AgentRegistry;
  private initialized: boolean;

  constructor(config?: CLIAppConfig) {
    this.config = {
      debug: false,
      verbose: false,
      theme: 'default',
      mode: 'planning',
      ...config,
    };

    this.commandRegistry = new CommandRegistry();
    this.configManager = new ConfigManager();
    this.logger = new Logger(this.config.debug ? 'debug' : 'info');
    this.aiProviderManager = new AIProviderManager();
    this.projectMemory = new ProjectMemory();
    this.agentRegistry = new AgentRegistry();
    this.initialized = false;
  }

  /**
   * Initialize the CLI application and its components
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('Initializing AIrchitect CLI application...');

    try {
      // Initialize configuration manager
      await this.configManager.initialize(this.config.configPath);

      // Initialize AI provider manager
      await this.aiProviderManager.initialize();

      // Initialize project memory
      await this.projectMemory.initialize();

      // Initialize agent registry
      await this.agentRegistry.initialize();

      // Set up event listeners and other initialization tasks
      this.setupEventHandlers();

      this.initialized = true;
      this.logger.info('AIrchitect CLI application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AIrchitect CLI application:', error);
      throw error;
    }
  }

  /**
   * Register a command with the application
   * @param command - The command to register
   */
  public registerCommand(command: BaseCommand): void {
    this.commandRegistry.register(command);
  }

  /**
   * Register multiple commands with the application
   * @param commands - Array of commands to register
   */
  public registerCommands(commands: BaseCommand[]): void {
    this.commandRegistry.registerMultiple(commands);
  }

  /**
   * Execute commands based on command line arguments
   * @param args - Command line arguments
   */
  public async execute(args?: string[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.commandRegistry.execute(args);
  }

  /**
   * Print help information to console
   */
  public printHelp(): void {
    this.commandRegistry.printHelp();
  }

  /**
   * Get application configuration
   */
  public getConfig(): CLIAppConfig {
    return { ...this.config };
  }

  /**
   * Update application configuration
   * @param newConfig - New configuration values
   */
  public updateConfig(newConfig: Partial<CLIAppConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update logger level if debug changed
    if (newConfig.debug !== undefined) {
      this.logger.setLevel(newConfig.debug ? 'debug' : 'info');
    }
  }

  /**
   * Get the command registry
   */
  public getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  /**
   * Get the configuration manager
   */
  public getConfigManager(): ConfigManager {
    return this.configManager;
  }

  /**
   * Get the logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Get the AI provider manager
   */
  public getAIProviderManager(): AIProviderManager {
    return this.aiProviderManager;
  }

  /**
   * Get the project memory instance
   */
  public getProjectMemory(): ProjectMemory {
    return this.projectMemory;
  }

  /**
   * Get the agent registry
   */
  public getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * Set up event handlers for the application
   */
  private setupEventHandlers(): void {
    // Handle exit events
    process.on('exit', () => {
      this.cleanup();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger.info('\nShutting down AIrchitect CLI...');
      this.cleanup();
      process.exit(0);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception:', error);
      this.cleanup();
      process.exit(1);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.cleanup();
      process.exit(1);
    });
  }

  /**
   * Clean up application resources
   */
  private cleanup(): void {
    this.logger.info('Cleaning up AIrchitect CLI resources...');

    // Clean up components
    this.aiProviderManager.cleanup();
    this.projectMemory.cleanup();
    this.agentRegistry.cleanup();

    this.logger.info('AIrchitect CLI cleaned up');
  }
}
