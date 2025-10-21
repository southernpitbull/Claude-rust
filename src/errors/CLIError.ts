/**
 * CLI Error Classes
 *
 * Handles errors specific to CLI operations, commands, and user interactions
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * CLI error codes
 */
export enum CLIErrorCode {
  INVALID_COMMAND = 'CLI_INVALID_COMMAND',
  INVALID_ARGUMENT = 'CLI_INVALID_ARGUMENT',
  MISSING_ARGUMENT = 'CLI_MISSING_ARGUMENT',
  COMMAND_NOT_FOUND = 'CLI_COMMAND_NOT_FOUND',
  COMMAND_EXECUTION_FAILED = 'CLI_COMMAND_EXECUTION_FAILED',
  INITIALIZATION_FAILED = 'CLI_INITIALIZATION_FAILED',
  INTERACTIVE_MODE_FAILED = 'CLI_INTERACTIVE_MODE_FAILED',
  AUTOCOMPLETE_FAILED = 'CLI_AUTOCOMPLETE_FAILED',
  INVALID_INPUT = 'CLI_INVALID_INPUT',
  PERMISSION_DENIED = 'CLI_PERMISSION_DENIED',
}

/**
 * Base CLI Error
 */
export class CLIError extends BaseError {
  constructor(message: string, options: BaseErrorOptions = {}) {
    super(message, {
      ...options,
      category: ErrorCategory.CLI,
      code: options.code ?? CLIErrorCode.COMMAND_EXECUTION_FAILED,
    });
  }

  protected generateUserMessage(): string {
    return `CLI Error: ${this.message}. Use --help for more information.`;
  }
}

/**
 * Invalid Command Error
 */
export class InvalidCommandError extends CLIError {
  constructor(command: string, availableCommands: string[] = [], options: BaseErrorOptions = {}) {
    super(`Invalid command: '${command}'`, {
      ...options,
      code: CLIErrorCode.INVALID_COMMAND,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        command,
        availableCommands,
      },
    });
  }

  protected generateUserMessage(): string {
    const context = this.context;
    const availableCommands = (context.availableCommands as string[]) ?? [];

    if (availableCommands.length > 0) {
      return `Unknown command '${context.command}'. Available commands: ${availableCommands.join(', ')}`;
    }

    return `Unknown command '${context.command}'. Run 'ai --help' to see available commands.`;
  }
}

/**
 * Invalid Argument Error
 */
export class InvalidArgumentError extends CLIError {
  constructor(
    argument: string,
    expected: string,
    received: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Invalid argument: '${argument}'`, {
      ...options,
      code: CLIErrorCode.INVALID_ARGUMENT,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        argument,
        expected,
        received,
      },
    });
  }

  protected generateUserMessage(): string {
    const { argument, expected, received } = this.context;
    return `Invalid argument '${argument}': expected ${expected}, got ${received}`;
  }
}

/**
 * Missing Argument Error
 */
export class MissingArgumentError extends CLIError {
  constructor(argument: string, options: BaseErrorOptions = {}) {
    super(`Missing required argument: '${argument}'`, {
      ...options,
      code: CLIErrorCode.MISSING_ARGUMENT,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        argument,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Missing required argument: '${this.context.argument}'`;
  }
}

/**
 * Command Not Found Error
 */
export class CommandNotFoundError extends CLIError {
  constructor(command: string, options: BaseErrorOptions = {}) {
    super(`Command not found: '${command}'`, {
      ...options,
      code: CLIErrorCode.COMMAND_NOT_FOUND,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        command,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Command '${this.context.command}' not found. Run 'ai --help' for available commands.`;
  }
}

/**
 * Command Execution Failed Error
 */
export class CommandExecutionError extends CLIError {
  constructor(command: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Command execution failed: ${reason}`, {
      ...options,
      code: CLIErrorCode.COMMAND_EXECUTION_FAILED,
      severity: ErrorSeverity.HIGH,
      context: {
        ...options.context,
        command,
        reason,
      },
      isRetryable: true,
    });
  }

  protected generateUserMessage(): string {
    return `Failed to execute command '${this.context.command}': ${this.context.reason}`;
  }
}

/**
 * CLI Initialization Failed Error
 */
export class CLIInitializationError extends CLIError {
  constructor(reason: string, options: BaseErrorOptions = {}) {
    super(`CLI initialization failed: ${reason}`, {
      ...options,
      code: CLIErrorCode.INITIALIZATION_FAILED,
      severity: ErrorSeverity.CRITICAL,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to initialize CLI: ${this.context.reason}`;
  }
}

/**
 * Interactive Mode Failed Error
 */
export class InteractiveModeError extends CLIError {
  constructor(reason: string, options: BaseErrorOptions = {}) {
    super(`Interactive mode failed: ${reason}`, {
      ...options,
      code: CLIErrorCode.INTERACTIVE_MODE_FAILED,
      severity: ErrorSeverity.MEDIUM,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Interactive mode error: ${this.context.reason}`;
  }
}

/**
 * Autocomplete Failed Error
 */
export class AutocompleteError extends CLIError {
  constructor(reason: string, options: BaseErrorOptions = {}) {
    super(`Autocomplete failed: ${reason}`, {
      ...options,
      code: CLIErrorCode.AUTOCOMPLETE_FAILED,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Autocomplete error: ${this.context.reason}`;
  }
}

/**
 * Invalid Input Error
 */
export class InvalidInputError extends CLIError {
  constructor(input: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Invalid input: ${reason}`, {
      ...options,
      code: CLIErrorCode.INVALID_INPUT,
      severity: ErrorSeverity.LOW,
      context: {
        ...options.context,
        input,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Invalid input: ${this.context.reason}`;
  }
}

/**
 * Permission Denied Error
 */
export class PermissionDeniedError extends CLIError {
  constructor(operation: string, options: BaseErrorOptions = {}) {
    super(`Permission denied: ${operation}`, {
      ...options,
      code: CLIErrorCode.PERMISSION_DENIED,
      severity: ErrorSeverity.HIGH,
      context: {
        ...options.context,
        operation,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Permission denied: ${this.context.operation}`;
  }
}
