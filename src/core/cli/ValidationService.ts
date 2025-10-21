/**
 * ValidationService.ts
 *
 * Provides centralized validation logic for CLI commands in the AIrchitect application.
 * Handles argument validation, option validation, and custom validation rules.
 */

import { BaseCommand } from './Command.interface';

export interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationRule {
  name: string;
  validate: (value: any) => boolean;
  message: string;
}

export class ValidationService {
  private rules: Map<string, ValidationRule>;

  constructor() {
    this.rules = new Map();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // Required field validation
    this.addRule({
      name: 'required',
      validate: (value: any) => value !== undefined && value !== null && value !== '',
      message: 'Field is required',
    });

    // String length validation
    this.addRule({
      name: 'minLength',
      validate: (value: any) => typeof value === 'string' && value.length >= 1,
      message: 'String must have at least 1 character',
    });

    // Numeric validation
    this.addRule({
      name: 'isNumeric',
      validate: (value: any) => !isNaN(Number(value)),
      message: 'Value must be numeric',
    });

    // Boolean validation
    this.addRule({
      name: 'isBoolean',
      validate: (value: any) => ['true', 'false', true, false].includes(value),
      message: 'Value must be boolean',
    });

    // Email validation
    this.addRule({
      name: 'isEmail',
      validate: (value: any) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return typeof value === 'string' && emailRegex.test(value);
      },
      message: 'Value must be a valid email address',
    });

    // URL validation
    this.addRule({
      name: 'isUrl',
      validate: (value: any) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Value must be a valid URL',
    });
  }

  /**
   * Add a validation rule
   * @param rule - The validation rule to add
   */
  public addRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Remove a validation rule
   * @param name - The name of the rule to remove
   */
  public removeRule(name: string): void {
    this.rules.delete(name);
  }

  /**
   * Validate command arguments against predefined rules
   * @param command - The command to validate
   * @param args - The arguments to validate
   * @returns Validation result
   */
  public validateCommandArgs(command: BaseCommand, args: any[]): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
    };

    // Validate required arguments
    if (command.arguments) {
      for (let i = 0; i < command.arguments.length; i++) {
        const arg = command.arguments[i];
        const value = args[i];

        if (arg.required && (value === undefined || value === null)) {
          result.success = false;
          result.errors.push(`Required argument '${arg.name}' is missing`);
        }

        // Additional validation can be added here based on argument type
        if (value !== undefined && value !== null) {
          if (arg.name.toLowerCase().includes('email')) {
            const emailRule = this.rules.get('isEmail');
            if (emailRule && !emailRule.validate(value)) {
              result.success = false;
              result.errors.push(
                `Argument '${arg.name}' must be a valid email: ${emailRule.message}`
              );
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate command options against predefined rules
   * @param command - The command to validate
   * @param options - The options to validate
   * @returns Validation result
   */
  public validateCommandOptions(command: BaseCommand, options: any): ValidationResult {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
    };

    // For now, we'll just validate that required options are present
    if (command.options) {
      for (const option of command.options) {
        const flag = option.flags.replace(/-/g, '').trim();
        const value = options[flag];

        if (option.required && (value === undefined || value === null)) {
          result.success = false;
          result.errors.push(`Required option '${option.flags}' is missing`);
        }
      }
    }

    return result;
  }

  /**
   * Validate using a specific rule
   * @param ruleName - The name of the rule to use
   * @param value - The value to validate
   * @returns Boolean indicating if validation passed
   */
  public validate(ruleName: string, value: any): boolean {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`Validation rule '${ruleName}' does not exist`);
    }
    return rule.validate(value);
  }

  /**
   * Run custom validation function
   * @param value - The value to validate
   * @param validationFn - The validation function to run
   * @param errorMessage - Error message if validation fails
   * @returns Validation result
   */
  public runCustomValidation(
    value: any,
    validationFn: (val: any) => boolean,
    errorMessage: string
  ): ValidationResult {
    const result: ValidationResult = {
      success: validationFn(value),
      errors: [],
    };

    if (!result.success) {
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Validate an entire command (args and options)
   * @param command - The command to validate
   * @param args - The arguments to validate
   * @param options - The options to validate
   * @returns Validation result
   */
  public validateCommand(command: BaseCommand, args: any[], options: any): ValidationResult {
    const argResult = this.validateCommandArgs(command, args);
    const optResult = this.validateCommandOptions(command, options);

    return {
      success: argResult.success && optResult.success,
      errors: [...argResult.errors, ...optResult.errors],
      warnings: [...(argResult.warnings || []), ...(optResult.warnings || [])],
    };
  }

  /**
   * Validate multiple values against a rule
   * @param ruleName - The name of the rule to use
   * @param values - The values to validate
   * @returns Array of boolean results
   */
  public validateMultiple(ruleName: string, values: any[]): boolean[] {
    const results: boolean[] = [];
    for (const value of values) {
      results.push(this.validate(ruleName, value));
    }
    return results;
  }

  /**
   * Get all validation rule names
   * @returns Array of validation rule names
   */
  public getRuleNames(): string[] {
    return Array.from(this.rules.keys());
  }
}
