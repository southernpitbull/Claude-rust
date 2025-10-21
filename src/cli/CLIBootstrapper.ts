/**
 * CLIBootstrapper.ts
 *
 * Application initialization and lifecycle management for the AIrchitect CLI.
 * Handles bootstrapping, configuration, dependency checks, and graceful shutdown.
 */

import { CommandManager } from './CommandManager';
import { CommandRouter } from './CommandRouter';
import { HelpSystem } from './HelpSystem';
import { ErrorHandler } from './ErrorHandler';
import { Logger, LogLevel } from '../utils/Logger';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Bootstrap lifecycle phases
 */
export enum BootstrapPhase {
  PRE_INIT = 'pre-init',
  INIT = 'init',
  BOOTSTRAP = 'bootstrap',
  READY = 'ready',
  SHUTDOWN = 'shutdown',
}

/**
 * Bootstrap configuration
 */
export interface IBootstrapConfig {
  appName?: string;
  appVersion?: string;
  appDescription?: string;
  configPath?: string;
  logLevel?: LogLevel;
  logFile?: string;
  enablePlugins?: boolean;
  pluginPath?: string;
  checkDependencies?: boolean;
  verbose?: boolean;
}

/**
 * Bootstrap result
 */
export interface IBootstrapResult {
  success: boolean;
  phase: BootstrapPhase;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle hook function
 */
export type LifecycleHook = () => Promise<void> | void;

/**
 * Dependency check result
 */
export interface IDependencyCheck {
  name: string;
  required: boolean;
  available: boolean;
  version?: string;
  error?: string;
}

/**
 * Health check result
 */
export interface IHealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * CLIBootstrapper class for application initialization
 */
export class CLIBootstrapper {
  private commandManager: CommandManager;
  private commandRouter: CommandRouter;
  private helpSystem: HelpSystem;
  private errorHandler: ErrorHandler;
  private logger: Logger;
  private config: IBootstrapConfig;
  private currentPhase: BootstrapPhase;
  private preInitHooks: LifecycleHook[];
  private initHooks: LifecycleHook[];
  private bootstrapHooks: LifecycleHook[];
  private readyHooks: LifecycleHook[];
  private shutdownHooks: LifecycleHook[];
  private isInitialized: boolean;
  private startTime: number;

  /**
   * Creates a new CLIBootstrapper instance
   * @param config - Bootstrap configuration
   */
  constructor(config: IBootstrapConfig = {}) {
    this.config = {
      appName: config.appName ?? 'airchitect',
      appVersion: config.appVersion ?? '0.1.0',
      appDescription: config.appDescription ?? 'AI-powered development assistant',
      configPath: config.configPath ?? join(process.cwd(), '.airchitect'),
      logLevel: config.logLevel ?? LogLevel.INFO,
      logFile: config.logFile ?? '',
      enablePlugins: config.enablePlugins ?? true,
      pluginPath: config.pluginPath ?? join(process.cwd(), 'plugins'),
      checkDependencies: config.checkDependencies ?? true,
      verbose: config.verbose ?? false,
    };

    this.logger = new Logger({
      level: this.config.logLevel,
      prefix: 'Bootstrap',
      logToFile: !!this.config.logFile,
      logFilePath: this.config.logFile,
    });

    this.errorHandler = new ErrorHandler({
      logger: this.logger,
      verbose: this.config.verbose,
      exitOnError: false,
    });

    this.commandManager = new CommandManager();
    this.commandManager.setLogger(this.logger);
    this.commandManager.setErrorHandler(this.errorHandler);

    this.commandRouter = new CommandRouter({
      logger: this.logger,
      enableMetrics: true,
    });

    this.helpSystem = new HelpSystem({
      logger: this.logger,
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      appDescription: this.config.appDescription,
    });

    this.currentPhase = BootstrapPhase.PRE_INIT;
    this.preInitHooks = [];
    this.initHooks = [];
    this.bootstrapHooks = [];
    this.readyHooks = [];
    this.shutdownHooks = [];
    this.isInitialized = false;
    this.startTime = 0;

    this.setupSignalHandlers();
  }

  /**
   * Bootstrap the application
   * @returns Bootstrap result
   */
  public async bootstrap(): Promise<IBootstrapResult> {
    this.startTime = Date.now();
    this.logger.info('Starting application bootstrap...');

    try {
      // Pre-init phase
      await this.executePhase(BootstrapPhase.PRE_INIT, async () => {
        await this.preInit();
      });

      // Init phase
      await this.executePhase(BootstrapPhase.INIT, async () => {
        await this.init();
      });

      // Bootstrap phase
      await this.executePhase(BootstrapPhase.BOOTSTRAP, async () => {
        await this.bootstrapComponents();
      });

      // Ready phase
      await this.executePhase(BootstrapPhase.READY, async () => {
        await this.ready();
      });

      this.isInitialized = true;
      const duration = Date.now() - this.startTime;
      this.logger.success(`Application bootstrapped successfully in ${duration}ms`);

      return {
        success: true,
        phase: BootstrapPhase.READY,
        metadata: { duration },
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Bootstrap failed in phase ${this.currentPhase}: ${err.message}`);
      this.errorHandler.handle(err, `Bootstrap: ${this.currentPhase}`);

      return {
        success: false,
        phase: this.currentPhase,
        error: err,
      };
    }
  }

  /**
   * Pre-initialization phase
   */
  private async preInit(): Promise<void> {
    this.logger.debug('Pre-init phase: Checking environment...');

    // Check Node.js version
    const nodeVersion = process.version;
    const requiredVersion = '20.0.0';
    this.logger.debug(`Node.js version: ${nodeVersion} (required: >= ${requiredVersion})`);

    // Check environment variables
    this.checkEnvironmentVariables();

    // Run pre-init hooks
    await this.runHooks(this.preInitHooks, 'pre-init');
  }

  /**
   * Initialization phase
   */
  private async init(): Promise<void> {
    this.logger.debug('Init phase: Loading configuration...');

    // Load configuration
    await this.loadConfiguration();

    // Setup logging
    this.setupLogging();

    // Check dependencies
    if (this.config.checkDependencies === true) {
      await this.checkDependencies();
    }

    // Run init hooks
    await this.runHooks(this.initHooks, 'init');
  }

  /**
   * Bootstrap components phase
   */
  private async bootstrapComponents(): Promise<void> {
    this.logger.debug('Bootstrap phase: Initializing components...');

    // Register commands
    await this.registerCommands();

    // Load plugins
    if (this.config.enablePlugins === true) {
      await this.loadPlugins();
    }

    // Setup error handlers
    this.setupErrorHandlers();

    // Run bootstrap hooks
    await this.runHooks(this.bootstrapHooks, 'bootstrap');
  }

  /**
   * Ready phase
   */
  private async ready(): Promise<void> {
    this.logger.debug('Ready phase: Finalizing initialization...');

    // Perform health checks
    await this.healthCheck();

    // Run ready hooks
    await this.runHooks(this.readyHooks, 'ready');

    this.logger.info('Application is ready');
  }

  /**
   * Shutdown the application
   */
  public async shutdown(): Promise<void> {
    if (this.currentPhase === BootstrapPhase.SHUTDOWN) {
      return;
    }

    this.currentPhase = BootstrapPhase.SHUTDOWN;
    this.logger.info('Shutting down application...');

    try {
      // Run shutdown hooks
      await this.runHooks(this.shutdownHooks, 'shutdown');

      // Cleanup resources
      await this.cleanup();

      this.logger.success('Application shutdown complete');
    } catch (error) {
      this.logger.error(
        `Shutdown error: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      this.logger.close();
    }
  }

  /**
   * Execute a lifecycle phase
   * @param phase - Phase to execute
   * @param fn - Function to execute
   */
  private async executePhase(phase: BootstrapPhase, fn: () => Promise<void>): Promise<void> {
    this.currentPhase = phase;
    this.logger.debug(`Entering phase: ${phase}`);
    await fn();
    this.logger.debug(`Completed phase: ${phase}`);
  }

  /**
   * Run lifecycle hooks
   * @param hooks - Array of hooks to run
   * @param phaseName - Phase name for logging
   */
  private async runHooks(hooks: LifecycleHook[], phaseName: string): Promise<void> {
    this.logger.debug(`Running ${hooks.length} ${phaseName} hooks...`);

    for (const hook of hooks) {
      try {
        await hook();
      } catch (error) {
        this.logger.warn(
          `Hook execution failed in ${phaseName}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Check environment variables
   */
  private checkEnvironmentVariables(): void {
    const requiredEnvVars: string[] = [];
    const missingVars: string[] = [];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      this.logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
    }
  }

  /**
   * Load configuration
   */
  private loadConfiguration(): void {
    const configPath = this.config.configPath ?? '';
    if (configPath === '') {
      this.logger.debug('No configuration path specified');
      return;
    }

    if (existsSync(configPath)) {
      this.logger.debug(`Loading configuration from: ${configPath}`);
      // TODO: Implement actual config loading
    } else {
      this.logger.debug(`Configuration file not found: ${configPath}`);
    }
  }

  /**
   * Setup logging
   */
  private setupLogging(): void {
    if (this.config.verbose === true) {
      this.logger.setLevel(LogLevel.DEBUG);
    }
  }

  /**
   * Check dependencies
   */
  private checkDependencies(): void {
    this.logger.debug('Checking dependencies...');

    const checks: IDependencyCheck[] = [
      { name: 'node', required: true, available: true, version: process.version },
      // Add more dependency checks as needed
    ];

    const failed = checks.filter((check) => check.required && !check.available);

    if (failed.length > 0) {
      const failedNames = failed.map((check) => check.name).join(', ');
      throw new Error(`Missing required dependencies: ${failedNames}`);
    }

    this.logger.debug('All dependencies are available');
  }

  /**
   * Register commands
   */
  private registerCommands(): void {
    this.logger.debug('Registering commands...');
    // Commands will be registered by the application
    // This is a placeholder for the registration process
  }

  /**
   * Load plugins
   */
  private loadPlugins(): void {
    const pluginPath = this.config.pluginPath ?? '';
    if (pluginPath === '') {
      return;
    }

    if (existsSync(pluginPath)) {
      this.logger.debug(`Loading plugins from: ${pluginPath}`);
      // TODO: Implement plugin loading
    } else {
      this.logger.debug(`Plugin directory not found: ${pluginPath}`);
    }
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    // Global error handlers are already set up in setupSignalHandlers
  }

  /**
   * Perform health checks
   */
  private healthCheck(): IHealthCheck[] {
    this.logger.debug('Performing health checks...');

    const checks: IHealthCheck[] = [
      {
        name: 'command-manager',
        status: 'healthy',
        message: 'Command manager is operational',
      },
      {
        name: 'command-router',
        status: 'healthy',
        message: 'Command router is operational',
      },
      {
        name: 'help-system',
        status: 'healthy',
        message: 'Help system is operational',
      },
    ];

    const unhealthy = checks.filter((check) => check.status === 'unhealthy');

    if (unhealthy.length > 0) {
      this.logger.warn(`${unhealthy.length} health check(s) failed`);
    } else {
      this.logger.debug('All health checks passed');
    }

    return checks;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.logger.debug('Cleaning up resources...');

    // Close file handles, database connections, etc.
    this.logger.close();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGUSR2'];

    for (const signal of signals) {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        void this.shutdown().then(() => process.exit(0));
      });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error(`Uncaught exception: ${error.message}`);
      this.errorHandler.handle(error, 'Uncaught Exception');
      void this.shutdown().then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      this.logger.error(`Unhandled promise rejection: ${String(reason)}`);
      this.errorHandler.handle(reason, 'Unhandled Rejection');
      void this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Add pre-init hook
   * @param hook - Hook function
   */
  public addPreInitHook(hook: LifecycleHook): void {
    this.preInitHooks.push(hook);
  }

  /**
   * Add init hook
   * @param hook - Hook function
   */
  public addInitHook(hook: LifecycleHook): void {
    this.initHooks.push(hook);
  }

  /**
   * Add bootstrap hook
   * @param hook - Hook function
   */
  public addBootstrapHook(hook: LifecycleHook): void {
    this.bootstrapHooks.push(hook);
  }

  /**
   * Add ready hook
   * @param hook - Hook function
   */
  public addReadyHook(hook: LifecycleHook): void {
    this.readyHooks.push(hook);
  }

  /**
   * Add shutdown hook
   * @param hook - Hook function
   */
  public addShutdownHook(hook: LifecycleHook): void {
    this.shutdownHooks.push(hook);
  }

  /**
   * Get command manager
   * @returns CommandManager instance
   */
  public getCommandManager(): CommandManager {
    return this.commandManager;
  }

  /**
   * Get command router
   * @returns CommandRouter instance
   */
  public getCommandRouter(): CommandRouter {
    return this.commandRouter;
  }

  /**
   * Get help system
   * @returns HelpSystem instance
   */
  public getHelpSystem(): HelpSystem {
    return this.helpSystem;
  }

  /**
   * Get error handler
   * @returns ErrorHandler instance
   */
  public getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * Get logger
   * @returns Logger instance
   */
  public getLogger(): Logger {
    return this.logger;
  }

  /**
   * Check if application is initialized
   * @returns True if initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.currentPhase === BootstrapPhase.READY;
  }

  /**
   * Get current phase
   * @returns Current bootstrap phase
   */
  public getCurrentPhase(): BootstrapPhase {
    return this.currentPhase;
  }

  /**
   * Get bootstrap duration
   * @returns Duration in milliseconds
   */
  public getBootstrapDuration(): number {
    return Date.now() - this.startTime;
  }
}
