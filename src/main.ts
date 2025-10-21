#!/usr/bin/env node

/**
 * main.ts
 *
 * Main entry point for the AIrchitect CLI application.
 * Initializes the CLI framework, sets up signal handlers, and coordinates command execution.
 */

import { Command } from 'commander';
import { Logger, LogLevel } from './utils/Logger';
import { CommandRunner } from './cli/runner';
import { registerCommands } from './cli/commands/index';
import { ErrorHandler } from './cli/ErrorHandler';
import chalk from 'chalk';
import * as figlet from 'figlet';

// Package version
const VERSION = '0.1.0';

/**
 * Global logger instance
 */
let logger: Logger;

/**
 * Command runner instance
 */
let runner: CommandRunner;

/**
 * Graceful shutdown flag
 */
let isShuttingDown = false;

/**
 * Initialize the CLI application
 */
async function initialize(): Promise<void> {
  // Create logger with default settings
  logger = new Logger({
    level: LogLevel.INFO,
    prefix: 'AIrchitect',
    useColors: true,
    useTimestamp: true,
    logToFile: false,
  });

  // Create command runner
  runner = new CommandRunner({ logger });

  // Setup signal handlers
  setupSignalHandlers();

  // Setup error handlers
  setupErrorHandlers();
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', async () => {
    if (isShuttingDown) {
      logger.warn('Force shutdown initiated');
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info('Received SIGINT signal, shutting down gracefully...');
    await gracefulShutdown('SIGINT');
  });

  // Handle SIGTERM
  process.on('SIGTERM', async () => {
    if (isShuttingDown) {
      logger.warn('Force shutdown initiated');
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info('Received SIGTERM signal, shutting down gracefully...');
    await gracefulShutdown('SIGTERM');
  });
}

/**
 * Setup error handlers for uncaught exceptions and rejections
 */
function setupErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception:', error);
    const errorHandler = new ErrorHandler({ logger, exitOnError: false });
    errorHandler.handle(error);
    process.exit(1);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const errorHandler = new ErrorHandler({ logger, exitOnError: false });
    errorHandler.handle(error);
    process.exit(1);
  });
}

/**
 * Graceful shutdown handler
 * @param signal - Signal that triggered shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  try {
    logger.info(`Graceful shutdown initiated by ${signal}`);

    // Cleanup runner
    if (runner) {
      await runner.cleanup();
    }

    // Close logger file stream
    if (logger) {
      logger.close();
    }

    logger.success('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Print banner
 */
function printBanner(): void {
  const banner = figlet.textSync('AIrchitect', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });

  console.log(chalk.cyan(banner));
  console.log(chalk.gray(`Version ${VERSION}`));
  console.log(chalk.gray('Advanced AI-powered development assistant'));
  console.log();
}

/**
 * Main CLI program
 */
async function main(): Promise<void> {
  try {
    // Initialize application
    await initialize();

    // Create Commander program
    const program = new Command();

    // Configure program
    program
      .name('airchitect')
      .description('AIrchitect CLI - Advanced AI-powered development assistant')
      .version(VERSION, '-V, --version', 'Output the current version')
      .option('-v, --verbose', 'Enable verbose output')
      .option('-d, --debug', 'Enable debug output')
      .option('--no-color', 'Disable colored output')
      .option('--log-file <path>', 'Log to file')
      .helpOption('-h, --help', 'Display help for command');

    // Handle global options
    program.hook('preAction', (thisCommand) => {
      const options = thisCommand.opts();

      // Update logger level based on flags
      if (options.debug) {
        logger.setLevel(LogLevel.DEBUG);
        logger.debug('Debug mode enabled');
      } else if (options.verbose) {
        logger.setLevel(LogLevel.DEBUG);
        logger.debug('Verbose mode enabled');
      }

      // Handle log file
      if (options.logFile) {
        logger.info(`Logging to file: ${options.logFile}`);
        // Reinitialize logger with file logging
        logger = new Logger({
          level: logger.getLevel(),
          prefix: 'AIrchitect',
          useColors: !options.noColor,
          useTimestamp: true,
          logToFile: true,
          logFilePath: options.logFile,
        });
      }
    });

    // Register all commands
    await registerCommands(program, runner, logger);

    // Show banner if no args provided
    if (process.argv.length === 2) {
      printBanner();
    }

    // Parse command line arguments
    await program.parseAsync(process.argv);

    // If no command was provided, show help
    if (process.argv.length === 2) {
      program.help();
    }
  } catch (error) {
    if (logger) {
      logger.error('Fatal error:', error);
    } else {
      console.error('Fatal error:', error);
    }
    const errorHandler = new ErrorHandler({ logger, exitOnError: false });
    errorHandler.handle(error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error in main:', error);
  process.exit(1);
});

// Export for testing
export { main, initialize, gracefulShutdown };
