/**
 * ErrorHandler.ts
 *
 * Comprehensive error handling system for the AIrchitect CLI.
 * Provides structured error handling, logging, and user-friendly error messages.
 */

import chalk from 'chalk';
import { Logger, LogLevel } from '../utils/Logger';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  FILE_SYSTEM = 'file_system',
  COMMAND_EXECUTION = 'command_execution',
  PLUGIN = 'plugin',
  PROVIDER = 'provider',
  UNKNOWN = 'unknown',
}

/**
 * Custom CLI Error class
 */
export class CLIError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly suggestions?: string[];

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    details?: Record<string, unknown>,
    suggestions?: string[]
  ) {
    super(message);
    this.name = 'CLIError';
    this.category = category;
    this.severity = severity;
    this.code = code ?? `${category.toUpperCase()}_ERROR`;
    this.details = details;
    this.suggestions = suggestions;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration for ErrorHandler
 */
export interface IErrorHandlerConfig {
  logger?: Logger;
  verbose?: boolean;
  exitOnError?: boolean;
  reportErrors?: boolean;
}

/**
 * Enhanced ErrorHandler class
 */
export class ErrorHandler {
  private logger: Logger;
  private verbose: boolean;
  private exitOnError: boolean;
  private reportErrors: boolean;
  private errorCount: number;

  /**
   * Creates a new ErrorHandler instance
   * @param config - ErrorHandler configuration
   */
  constructor(config: IErrorHandlerConfig = {}) {
    this.logger = config.logger ?? new Logger({ level: LogLevel.ERROR });
    this.verbose = config.verbose ?? false;
    this.exitOnError = config.exitOnError ?? true;
    this.reportErrors = config.reportErrors ?? false;
    this.errorCount = 0;
  }

  /**
   * Handle an error with appropriate logging and formatting
   * @param error - Error to handle
   * @param context - Additional context information
   */
  public handle(error: Error | CLIError | unknown, context?: string): void {
    this.errorCount++;

    if (error instanceof CLIError) {
      this.handleCLIError(error, context);
    } else if (error instanceof Error) {
      this.handleStandardError(error, context);
    } else {
      this.handleUnknownError(error, context);
    }

    if (this.exitOnError) {
      process.exit(1);
    }
  }

  /**
   * Handle a CLIError
   * @param error - CLIError to handle
   * @param context - Additional context
   */
  private handleCLIError(error: CLIError, context?: string): void {
    const prefix = this.getErrorPrefix(error.severity);
    const contextStr = context ? ` (${context})` : '';

    console.error(`${prefix}${contextStr}: ${error.message}`);

    if (error.code) {
      console.error(chalk.gray(`Error Code: ${error.code}`));
    }

    if (error.details && this.verbose) {
      console.error(chalk.gray('Details:'));
      console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
    }

    if (error.suggestions && error.suggestions.length > 0) {
      console.error(chalk.yellow('\nSuggestions:'));
      error.suggestions.forEach((suggestion, index) => {
        console.error(chalk.yellow(`  ${index + 1}. ${suggestion}`));
      });
    }

    if (this.verbose && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }

    this.logger.error(`[${error.category}] ${error.message}`, {
      code: error.code,
      severity: error.severity,
      context,
    });
  }

  /**
   * Handle a standard Error
   * @param error - Error to handle
   * @param context - Additional context
   */
  private handleStandardError(error: Error, context?: string): void {
    const prefix = this.getErrorPrefix(ErrorSeverity.MEDIUM);
    const contextStr = context ? ` (${context})` : '';

    console.error(`${prefix}${contextStr}: ${error.message}`);

    if (this.verbose && error.stack) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }

    this.logger.error(`${error.message}`, { context, stack: error.stack });
  }

  /**
   * Handle an unknown error type
   * @param error - Unknown error
   * @param context - Additional context
   */
  private handleUnknownError(error: unknown, context?: string): void {
    const prefix = this.getErrorPrefix(ErrorSeverity.MEDIUM);
    const contextStr = context ? ` (${context})` : '';
    const errorMessage = String(error);

    console.error(`${prefix}${contextStr}: ${errorMessage}`);

    this.logger.error(`Unknown error: ${errorMessage}`, { context });
  }

  /**
   * Get formatted error prefix based on severity
   * @param severity - Error severity
   * @returns Formatted prefix string
   */
  private getErrorPrefix(severity: ErrorSeverity): string {
    const prefixes: Record<ErrorSeverity, string> = {
      [ErrorSeverity.LOW]: chalk.blue('Info'),
      [ErrorSeverity.MEDIUM]: chalk.yellow('Warning'),
      [ErrorSeverity.HIGH]: chalk.red('Error'),
      [ErrorSeverity.CRITICAL]: chalk.bgRed.white(' CRITICAL '),
    };

    return prefixes[severity];
  }

  /**
   * Handle a validation error
   * @param field - Field that failed validation
   * @param message - Error message
   * @param suggestions - Optional suggestions
   */
  public validationError(field: string, message: string, suggestions?: string[]): void {
    const error = new CLIError(
      `Validation failed for '${field}': ${message}`,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      'VALIDATION_ERROR',
      { field },
      suggestions
    );

    this.handle(error);
  }

  /**
   * Handle a configuration error
   * @param message - Error message
   * @param configKey - Configuration key that caused the error
   * @param suggestions - Optional suggestions
   */
  public configError(message: string, configKey?: string, suggestions?: string[]): void {
    const error = new CLIError(
      message,
      ErrorCategory.CONFIGURATION,
      ErrorSeverity.MEDIUM,
      'CONFIG_ERROR',
      configKey ? { configKey } : undefined,
      suggestions
    );

    this.handle(error);
  }

  /**
   * Handle a network error
   * @param message - Error message
   * @param url - URL that caused the error
   * @param statusCode - HTTP status code
   */
  public networkError(message: string, url?: string, statusCode?: number): void {
    const error = new CLIError(
      message,
      ErrorCategory.NETWORK,
      ErrorSeverity.HIGH,
      'NETWORK_ERROR',
      { url, statusCode },
      ['Check your internet connection', 'Verify the URL is correct', 'Try again later']
    );

    this.handle(error);
  }

  /**
   * Handle an authentication error
   * @param message - Error message
   * @param provider - Provider that failed authentication
   */
  public authError(message: string, provider?: string): void {
    const error = new CLIError(
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'AUTH_ERROR',
      provider ? { provider } : undefined,
      [
        'Check your credentials',
        'Run "airchitect creds add" to configure credentials',
        'Verify your API key is valid',
      ]
    );

    this.handle(error);
  }

  /**
   * Handle a file system error
   * @param message - Error message
   * @param path - File path that caused the error
   */
  public fileSystemError(message: string, path?: string): void {
    const error = new CLIError(
      message,
      ErrorCategory.FILE_SYSTEM,
      ErrorSeverity.MEDIUM,
      'FS_ERROR',
      path ? { path } : undefined,
      ['Check file permissions', 'Verify the path exists', 'Ensure sufficient disk space']
    );

    this.handle(error);
  }

  /**
   * Handle a command execution error
   * @param command - Command that failed
   * @param message - Error message
   * @param exitCode - Exit code of the command
   */
  public commandError(command: string, message: string, exitCode?: number): void {
    const error = new CLIError(
      message,
      ErrorCategory.COMMAND_EXECUTION,
      ErrorSeverity.MEDIUM,
      'COMMAND_ERROR',
      { command, exitCode },
      ['Check command syntax', 'Run with --verbose for more details', 'Consult the documentation']
    );

    this.handle(error);
  }

  /**
   * Handle a plugin error
   * @param pluginName - Name of the plugin
   * @param message - Error message
   */
  public pluginError(pluginName: string, message: string): void {
    const error = new CLIError(
      `Plugin '${pluginName}' error: ${message}`,
      ErrorCategory.PLUGIN,
      ErrorSeverity.MEDIUM,
      'PLUGIN_ERROR',
      { pluginName },
      ['Check plugin installation', 'Verify plugin compatibility', 'Try reinstalling the plugin']
    );

    this.handle(error);
  }

  /**
   * Handle a provider error
   * @param providerName - Name of the provider
   * @param message - Error message
   */
  public providerError(providerName: string, message: string): void {
    const error = new CLIError(
      `Provider '${providerName}' error: ${message}`,
      ErrorCategory.PROVIDER,
      ErrorSeverity.MEDIUM,
      'PROVIDER_ERROR',
      { providerName },
      [
        'Check provider configuration',
        'Verify provider credentials',
        'Ensure the provider is available',
      ]
    );

    this.handle(error);
  }

  /**
   * Set verbose mode
   * @param verbose - Verbose flag
   */
  public setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Set exit on error behavior
   * @param exitOnError - Exit on error flag
   */
  public setExitOnError(exitOnError: boolean): void {
    this.exitOnError = exitOnError;
  }

  /**
   * Get error count
   * @returns Number of errors handled
   */
  public getErrorCount(): number {
    return this.errorCount;
  }

  /**
   * Reset error count
   */
  public resetErrorCount(): void {
    this.errorCount = 0;
  }

  /**
   * Wrap a function with error handling
   * @param fn - Function to wrap
   * @param context - Context for error messages
   * @returns Wrapped function
   */
  public wrap<T extends (...args: never[]) => Promise<unknown>>(
    fn: T,
    context?: string
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        return (await fn(...args)) as ReturnType<T>;
      } catch (error) {
        this.handle(error, context);
        throw error;
      }
    };
  }
}
