#!/usr/bin/env node

/**
 * AIrchitect CLI - TypeScript Components
 *
 * This file contains the main entry point for the TypeScript-based
 * components of the AIrchitect CLI system.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import gradient from 'gradient-string';
import { ConfigManager } from './config/ConfigManager.js';
import { BaseError, ErrorCategory, ErrorSeverity } from './errors/BaseError.js';
import { CLIError } from './errors/CLIError.js';
import { LoggerFactory } from './logging/Logger.js';

// Create the main CLI program
const program = new Command();

// Initialize configuration
let configManager: ConfigManager;

async function initializeSystem() {
  try {
    configManager = new ConfigManager();
    await configManager.initialize();

    // Validate configuration
    const validation = configManager.validateConfig();
    if (!validation.valid) {
      console.warn(chalk.yellow('Configuration warnings:'));
      validation.errors.forEach((error) => {
        console.warn(chalk.yellow(`  - ${error}`));
      });
    }
  } catch (error) {
    console.error(chalk.red('Failed to initialize configuration:'), error);
    process.exit(1);
  }
}

// Initialize logger
const logger = LoggerFactory.createCliLogger('main');

// Initialize system
initializeSystem()
  .then(() => {
    logger.info('System initialized successfully');

    // Display banner
    console.log(gradient.pastel.multiline(figlet.textSync('AIrchitect', { font: 'Standard' })));
    console.log(chalk.blue.bold('AI-powered Development Assistant\n'));

    // Configure the CLI program
    program
      .name('ai')
      .description('AIrchitect CLI - Advanced AI-powered development assistant')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug mode')
      .option('-v, --verbose', 'Enable verbose output');

    // Add chat command
    program
      .command('chat')
      .description('Start an interactive AI chat session')
      .option('-m, --mode <type>', 'Set initial mode (planning or work)', 'planning')
      .option('-p, --provider <name>', 'Specify AI provider to use')
      .action(async (options) => {
        logger.info('Starting chat session', {
          mode: options.mode,
          provider: options.provider,
        });
        await startChatSession(options);
      });

    // Add plan command
    program
      .command('plan')
      .description('Start a planning session')
      .option('-t, --template <name>', 'Use a specific planning template')
      .action(async (options) => {
        logger.info('Starting planning session', {
          template: options.template,
        });
        await startPlanningSession(options);
      });

    // Add work command
    program
      .command('work')
      .description('Start a work session')
      .option('-p, --project <name>', 'Specify project to work on')
      .action(async (options) => {
        logger.info('Starting work session', {
          project: options.project,
        });
        await startWorkSession(options);
      });

    // Add providers command
    program
      .command('providers')
      .description('List available AI providers')
      .option('-a, --all', 'Show all providers including unavailable ones')
      .action(async (options) => {
        logger.info('Listing AI providers', {
          all: options.all,
        });
        await listProviders(options);
      });

    // Add creds command
    program
      .command('creds')
      .description('Manage credentials')
      .option('-l, --list', 'List configured credentials')
      .option('-a, --add <provider> <key>', 'Add a new credential')
      .option('-r, --remove <provider>', 'Remove a credential')
      .action(async (options) => {
        logger.info('Managing credentials', {
          list: options.list,
          add: options.add,
          remove: options.remove,
        });
        await manageCredentials(options);
      });

    // Parse command line arguments
    program.parse(process.argv);
  })
  .catch((error) => {
    logger.error('Failed to initialize system', { error: error.message });
    process.exit(1);
  });

/**
 * Start an interactive chat session
 */
async function startChatSession(options: any) {
  logger.info('Chat session initialization started');

  try {
    console.log(chalk.gray('Chat session started. Press Ctrl+C to exit.'));

    // In a full implementation, this would initialize the chat interface
    // with the selected provider and mode

    console.log(chalk.cyan('AI: Hello! How can I assist you today?'));
    logger.info('Chat session initialized successfully');
  } catch (error) {
    handleCLIError(error, 'chat session');
  }
}
async function startWorkSession(options: any) {
  logger.info('Work session initialization started');

  try {
    console.log(chalk.gray('Work session started. Initializing development environment...'));

    // In a full implementation, this would initialize the work interface
    // with appropriate authorizations and development tools

    console.log(chalk.cyan('Development environment ready. Happy coding!'));
    logger.info('Work session initialized successfully');
  } catch (error) {
    handleCLIError(error, 'work session');
  }
}

/**
 * List available AI providers
 */
async function listProviders(options: any) {
  logger.info('Retrieving provider information');

  try {
    // In a full implementation, we would check actual provider availability
    // For now, we'll check configuration
    const config = configManager.getConfig();
    const providers = Object.entries(config.providers)
      .filter(([key]) => key !== 'default')
      .map(([name, config]) => {
        if (typeof config === 'string') {
          return { name, status: '✗ Not configured', model: 'N/A' };
        }

        const status = config.enabled ? '✓ Available' : '✗ Disabled';
        const model = config.model || 'N/A';
        return { name, status, model };
      });

    console.log(chalk.blue.bold('\nAvailable AI Providers:'));
    providers.forEach((provider) => {
      console.log(chalk.green(`  • ${provider.name}: ${provider.status} (${provider.model})`));
    });

    logger.info('Provider list retrieved successfully', { count: providers.length });
  } catch (error) {
    handleCLIError(error, 'provider listing');
  }
}

/**
 * Manage credentials
 */
async function manageCredentials(options: any) {
  logger.info('Managing credentials', {
    action: options.list ? 'list' : options.add ? 'add' : options.remove ? 'remove' : 'view',
  });

  try {
    // In a full implementation, this would interact with the credential manager
    // For now, we'll just show how it would work

    if (options.list) {
      console.log(chalk.cyan('Listing configured credentials...'));
      // This would actually list the credentials
    } else if (options.add) {
      const [provider, key] = options.add.split(' ');
      console.log(chalk.cyan(`Adding credential for provider: ${provider}`));
      // This would actually add the credential
    } else if (options.remove) {
      console.log(chalk.cyan(`Removing credential for provider: ${options.remove}`));
      // This would actually remove the credential
    } else {
      console.log(chalk.cyan('Credential management interface ready.'));
    }

    logger.info('Credential management completed');
  } catch (error) {
    handleCLIError(error, 'credential management');
  }
}

/**
 * Handle CLI errors gracefully
 */
function handleCLIError(error: Error, operation: string) {
  if (error instanceof BaseError) {
    logger.error(`Error during ${operation}: ${error.userMessage}`, {
      code: error.code,
      severity: error.severity,
      category: error.category,
      stack: error.stack,
    });
    console.error(chalk.red(`Error (${error.code}): ${error.userMessage}`));
  } else {
    logger.error(`Unexpected error during ${operation}: ${error.message}`, {
      stack: error.stack,
    });
    console.error(chalk.red(`Error: ${error.message}`));
  }
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  console.log(chalk.yellow('\n\nShutting down AIrchitect CLI...'));
  process.exit(0);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  console.log(chalk.yellow('\n\nShutting down AIrchitect CLI...'));
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', {
    message: error.message,
    stack: error.stack,
  });
  console.error(chalk.red('Uncaught exception:'), error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
  console.error(chalk.red('Unhandled promise rejection:'), reason);
  process.exit(1);
});
