/**
 * CommandParser.ts
 *
 * Advanced command-line argument parsing with validation and type coercion.
 * Provides flexible parsing capabilities for the AIrchitect CLI.
 */

import { CLIError, ErrorCategory, ErrorSeverity } from './ErrorHandler';

/**
 * Argument types supported by the parser
 */
export enum ArgumentType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  JSON = 'json',
  FILE = 'file',
  DIRECTORY = 'directory',
}

/**
 * Argument definition
 */
export interface IArgumentDefinition {
  name: string;
  type: ArgumentType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validator?: (value: unknown) => boolean | string;
  choices?: unknown[];
  multiple?: boolean;
}

/**
 * Option definition
 */
export interface IOptionDefinition {
  name: string;
  alias?: string;
  type: ArgumentType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
  validator?: (value: unknown) => boolean | string;
  choices?: unknown[];
  multiple?: boolean;
}

/**
 * Parsed arguments result
 */
export interface IParsedArguments {
  command?: string;
  subcommand?: string;
  args: Record<string, unknown>;
  options: Record<string, unknown>;
  flags: Set<string>;
  raw: string[];
}

/**
 * Parser configuration
 */
export interface IParserConfig {
  allowUnknownOptions?: boolean;
  allowUnknownArgs?: boolean;
  strictMode?: boolean;
}

/**
 * CommandParser class for parsing CLI arguments
 */
export class CommandParser {
  private argumentDefinitions: IArgumentDefinition[];
  private optionDefinitions: IOptionDefinition[];
  private config: IParserConfig;

  /**
   * Creates a new CommandParser instance
   * @param config - Parser configuration
   */
  constructor(config: IParserConfig = {}) {
    this.argumentDefinitions = [];
    this.optionDefinitions = [];
    this.config = {
      allowUnknownOptions: config.allowUnknownOptions ?? false,
      allowUnknownArgs: config.allowUnknownArgs ?? false,
      strictMode: config.strictMode ?? true,
    };
  }

  /**
   * Define an argument
   * @param definition - Argument definition
   */
  public defineArgument(definition: IArgumentDefinition): void {
    this.argumentDefinitions.push(definition);
  }

  /**
   * Define multiple arguments
   * @param definitions - Array of argument definitions
   */
  public defineArguments(definitions: IArgumentDefinition[]): void {
    this.argumentDefinitions.push(...definitions);
  }

  /**
   * Define an option
   * @param definition - Option definition
   */
  public defineOption(definition: IOptionDefinition): void {
    this.optionDefinitions.push(definition);
  }

  /**
   * Define multiple options
   * @param definitions - Array of option definitions
   */
  public defineOptions(definitions: IOptionDefinition[]): void {
    this.optionDefinitions.push(...definitions);
  }

  /**
   * Parse command-line arguments
   * @param argv - Array of arguments (defaults to process.argv.slice(2))
   * @returns Parsed arguments object
   */
  public parse(argv?: string[]): IParsedArguments {
    const args = argv ?? process.argv.slice(2);
    const result: IParsedArguments = {
      args: {},
      options: {},
      flags: new Set<string>(),
      raw: args,
    };

    let currentIndex = 0;
    let positionalIndex = 0;

    // Extract command and subcommand
    if (args.length > 0 && !this.isOption(args[0])) {
      result.command = args[0];
      currentIndex++;

      if (args.length > 1 && !this.isOption(args[1])) {
        result.subcommand = args[1];
        currentIndex++;
      }
    }

    // Parse options and arguments
    while (currentIndex < args.length) {
      const arg = args[currentIndex];

      if (this.isOption(arg)) {
        // Parse option
        const parseResult = this.parseOption(arg, args, currentIndex);
        if (parseResult.isFlag) {
          result.flags.add(parseResult.name);
        } else {
          result.options[parseResult.name] = parseResult.value;
        }
        currentIndex = parseResult.nextIndex;
      } else {
        // Parse positional argument
        if (positionalIndex < this.argumentDefinitions.length) {
          const argDef = this.argumentDefinitions[positionalIndex];
          const value = this.coerceType(arg, argDef.type);
          result.args[argDef.name] = value;
          positionalIndex++;
        } else if (!this.config.allowUnknownArgs) {
          throw new CLIError(
            `Unknown argument: ${arg}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.LOW,
            'UNKNOWN_ARGUMENT',
            { argument: arg }
          );
        }
        currentIndex++;
      }
    }

    // Apply defaults and validate
    this.applyDefaults(result);
    this.validate(result);

    return result;
  }

  /**
   * Check if a string is an option
   * @param str - String to check
   * @returns True if the string is an option
   */
  private isOption(str: string): boolean {
    return str.startsWith('-');
  }

  /**
   * Parse an option
   * @param arg - Argument string
   * @param args - All arguments
   * @param currentIndex - Current parsing index
   * @returns Parsed option result
   */
  private parseOption(
    arg: string,
    args: string[],
    currentIndex: number
  ): { name: string; value?: unknown; isFlag: boolean; nextIndex: number } {
    // Handle --option=value format
    if (arg.includes('=')) {
      const [optionPart, valuePart] = arg.split('=', 2);
      const name = this.getOptionName(optionPart);
      const optionDef = this.findOptionDefinition(name);

      if (optionDef) {
        const value = this.coerceType(valuePart, optionDef.type);
        return { name, value, isFlag: false, nextIndex: currentIndex + 1 };
      }

      return { name, value: valuePart, isFlag: false, nextIndex: currentIndex + 1 };
    }

    const name = this.getOptionName(arg);
    const optionDef = this.findOptionDefinition(name);

    // Boolean flag
    if (!optionDef || optionDef.type === ArgumentType.BOOLEAN) {
      return { name, isFlag: true, nextIndex: currentIndex + 1 };
    }

    // Option with value
    if (currentIndex + 1 < args.length && !this.isOption(args[currentIndex + 1])) {
      const value = this.coerceType(args[currentIndex + 1], optionDef.type);
      return { name, value, isFlag: false, nextIndex: currentIndex + 2 };
    }

    // Option without value (treat as flag)
    return { name, isFlag: true, nextIndex: currentIndex + 1 };
  }

  /**
   * Get option name from argument string
   * @param arg - Argument string
   * @returns Option name
   */
  private getOptionName(arg: string): string {
    return arg.replace(/^-+/, '');
  }

  /**
   * Find option definition by name or alias
   * @param name - Option name or alias
   * @returns Option definition or undefined
   */
  private findOptionDefinition(name: string): IOptionDefinition | undefined {
    return this.optionDefinitions.find((opt) => opt.name === name || opt.alias === name);
  }

  /**
   * Coerce a value to the specified type
   * @param value - Value to coerce
   * @param type - Target type
   * @returns Coerced value
   */
  private coerceType(value: string, type: ArgumentType): unknown {
    switch (type) {
      case ArgumentType.NUMBER: {
        const num = Number(value);
        if (Number.isNaN(num)) {
          throw new CLIError(
            `Invalid number: ${value}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.LOW,
            'INVALID_NUMBER',
            { value }
          );
        }
        return num;
      }

      case ArgumentType.BOOLEAN:
        return value === 'true' || value === '1' || value === 'yes';

      case ArgumentType.ARRAY:
        return value.split(',').map((item) => item.trim());

      case ArgumentType.JSON:
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new CLIError(
            `Invalid JSON: ${value}`,
            ErrorCategory.VALIDATION,
            ErrorSeverity.LOW,
            'INVALID_JSON',
            { value, error: error instanceof Error ? error.message : String(error) }
          );
        }

      case ArgumentType.FILE:
      case ArgumentType.DIRECTORY:
      case ArgumentType.STRING:
      default:
        return value;
    }
  }

  /**
   * Apply default values to missing arguments and options
   * @param result - Parsed arguments result
   */
  private applyDefaults(result: IParsedArguments): void {
    // Apply argument defaults
    for (const argDef of this.argumentDefinitions) {
      if (!(argDef.name in result.args) && argDef.defaultValue !== undefined) {
        result.args[argDef.name] = argDef.defaultValue;
      }
    }

    // Apply option defaults
    for (const optDef of this.optionDefinitions) {
      if (!(optDef.name in result.options) && optDef.defaultValue !== undefined) {
        result.options[optDef.name] = optDef.defaultValue;
      }
    }
  }

  /**
   * Validate parsed arguments
   * @param result - Parsed arguments result
   */
  private validate(result: IParsedArguments): void {
    // Validate required arguments
    for (const argDef of this.argumentDefinitions) {
      if (argDef.required === true && !(argDef.name in result.args)) {
        throw new CLIError(
          `Missing required argument: ${argDef.name}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          'MISSING_ARGUMENT',
          { argument: argDef.name, description: argDef.description }
        );
      }

      // Validate argument value
      if (argDef.name in result.args) {
        this.validateValue(result.args[argDef.name], argDef);
      }
    }

    // Validate required options
    for (const optDef of this.optionDefinitions) {
      if (
        optDef.required === true &&
        !(optDef.name in result.options) &&
        !result.flags.has(optDef.name)
      ) {
        throw new CLIError(
          `Missing required option: --${optDef.name}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.MEDIUM,
          'MISSING_OPTION',
          { option: optDef.name, description: optDef.description }
        );
      }

      // Validate option value
      if (optDef.name in result.options) {
        this.validateValue(result.options[optDef.name], optDef);
      }
    }
  }

  /**
   * Validate a value against a definition
   * @param value - Value to validate
   * @param definition - Argument or option definition
   */
  private validateValue(value: unknown, definition: IArgumentDefinition | IOptionDefinition): void {
    // Check choices
    if (definition.choices && definition.choices.length > 0) {
      if (!definition.choices.includes(value)) {
        throw new CLIError(
          `Invalid value for ${definition.name}: ${String(value)}. Must be one of: ${definition.choices.join(', ')}`,
          ErrorCategory.VALIDATION,
          ErrorSeverity.LOW,
          'INVALID_CHOICE',
          { value, choices: definition.choices }
        );
      }
    }

    // Run custom validator
    if (definition.validator) {
      const validationResult = definition.validator(value);
      if (validationResult !== true) {
        const errorMessage =
          typeof validationResult === 'string'
            ? validationResult
            : `Validation failed for ${definition.name}`;
        throw new CLIError(
          errorMessage,
          ErrorCategory.VALIDATION,
          ErrorSeverity.LOW,
          'VALIDATION_FAILED',
          { value, field: definition.name }
        );
      }
    }
  }

  /**
   * Get help text for arguments and options
   * @returns Formatted help text
   */
  public getHelpText(): string {
    const lines: string[] = [];

    if (this.argumentDefinitions.length > 0) {
      lines.push('Arguments:');
      for (const argDef of this.argumentDefinitions) {
        const required = argDef.required === true ? '<required>' : '[optional]';
        const description = argDef.description ?? '';
        lines.push(`  ${argDef.name} ${required} - ${description}`);
      }
      lines.push('');
    }

    if (this.optionDefinitions.length > 0) {
      lines.push('Options:');
      for (const optDef of this.optionDefinitions) {
        const alias = optDef.alias ? `, -${optDef.alias}` : '';
        const required = optDef.required === true ? '<required>' : '[optional]';
        const description = optDef.description ?? '';
        const defaultValue =
          optDef.defaultValue !== undefined ? ` (default: ${String(optDef.defaultValue)})` : '';
        lines.push(`  --${optDef.name}${alias} ${required} - ${description}${defaultValue}`);
      }
    }

    return lines.join('\n');
  }
}
