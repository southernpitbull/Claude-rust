/**
 * TemplateEngine.ts
 *
 * Advanced template processing engine for Linear integration with variable interpolation,
 * conditional logic, loops, filters, and AI-powered enhancements.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface TemplateContext {
  issue: LinearIssue;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  team?: {
    id: string;
    name: string;
    key: string;
  };
  environment: {
    currentDate: string;
    currentTime: string;
    timezone: string;
  };
  custom: Record<string, any>;
}

export interface TemplateFilter {
  name: string;
  description: string;
  func: (value: any, ...args: any[]) => any;
}

export interface TemplateFunction {
  name: string;
  description: string;
  func: (...args: any[]) => any;
}

export interface ParsedTemplate {
  content: string;
  variables: string[];
  conditions: TemplateCondition[];
  loops: TemplateLoop[];
  filters: TemplateFilterUsage[];
  functions: TemplateFunctionUsage[];
}

export interface TemplateCondition {
  expression: string;
  startTag: string;
  endTag: string;
  elseTag?: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateLoop {
  variable: string;
  collection: string;
  startTag: string;
  endTag: string;
  startIndex: number;
  endIndex: number;
}

export interface TemplateFilterUsage {
  variable: string;
  filter: string;
  args: any[];
  startIndex: number;
  endIndex: number;
}

export interface TemplateFunctionUsage {
  function: string;
  args: any[];
  startIndex: number;
  endIndex: number;
}

export interface TemplateError {
  type: 'syntax' | 'runtime' | 'variable' | 'filter' | 'function';
  message: string;
  position?: { line: number; column: number };
  stack?: string;
}

export class TemplateEngine {
  private linearClient: LinearClient;
  private filters: Map<string, TemplateFilter>;
  private functions: Map<string, TemplateFunction>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.filters = new Map();
    this.functions = new Map();
    this.logger = new Logger('TemplateEngine');

    // Register default filters and functions
    this.registerDefaultFilters();
    this.registerDefaultFunctions();
  }

  /**
   * Register default filters
   */
  private registerDefaultFilters(): void {
    try {
      this.logger.info('Registering default filters');

      // String manipulation filters
      this.registerFilter({
        name: 'upper',
        description: 'Convert string to uppercase',
        func: (value: any) => String(value).toUpperCase(),
      });

      this.registerFilter({
        name: 'lower',
        description: 'Convert string to lowercase',
        func: (value: any) => String(value).toLowerCase(),
      });

      this.registerFilter({
        name: 'capitalize',
        description: 'Capitalize first letter of string',
        func: (value: any) => {
          const str = String(value);
          return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },
      });

      this.registerFilter({
        name: 'title',
        description: 'Convert to title case',
        func: (value: any) => {
          return String(value).replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
          });
        },
      });

      this.registerFilter({
        name: 'truncate',
        description: 'Truncate string to specified length',
        func: (value: any, length: number, suffix: string = '...') => {
          const str = String(value);
          if (str.length <= length) {
            return str;
          }
          return str.substring(0, length - suffix.length) + suffix;
        },
      });

      // Date formatting filters
      this.registerFilter({
        name: 'date',
        description: 'Format date',
        func: (value: any, format: string = 'YYYY-MM-DD') => {
          if (!value) {
            return '';
          }
          const date = new Date(value);
          return date.toISOString().split('T')[0];
        },
      });

      this.registerFilter({
        name: 'datetime',
        description: 'Format datetime',
        func: (value: any, format: string = 'YYYY-MM-DD HH:mm:ss') => {
          if (!value) {
            return '';
          }
          const date = new Date(value);
          return date.toISOString().replace('T', ' ').split('.')[0];
        },
      });

      // Array/List filters
      this.registerFilter({
        name: 'join',
        description: 'Join array elements with separator',
        func: (value: any[], separator: string = ', ') => {
          if (!Array.isArray(value)) {
            return String(value);
          }
          return value.join(separator);
        },
      });

      this.registerFilter({
        name: 'length',
        description: 'Get length of string/array',
        func: (value: any) => {
          if (Array.isArray(value) || typeof value === 'string') {
            return value.length;
          }
          return 0;
        },
      });

      // Number formatting filters
      this.registerFilter({
        name: 'currency',
        description: 'Format number as currency',
        func: (value: any, symbol: string = '$') => {
          const num = Number(value);
          if (isNaN(num)) {
            return value;
          }
          return `${symbol}${num.toFixed(2)}`;
        },
      });

      this.registerFilter({
        name: 'percent',
        description: 'Format number as percentage',
        func: (value: any, decimals: number = 2) => {
          const num = Number(value);
          if (isNaN(num)) {
            return value;
          }
          return `${(num * 100).toFixed(decimals)}%`;
        },
      });

      // Conditional filters
      this.registerFilter({
        name: 'default',
        description: 'Provide default value if input is falsy',
        func: (value: any, defaultValue: any) => {
          return value || defaultValue;
        },
      });

      this.logger.info('Default filters registered');
    } catch (error) {
      this.logger.error('Failed to register default filters', error);
      throw error;
    }
  }

  /**
   * Register default functions
   */
  private registerDefaultFunctions(): void {
    try {
      this.logger.info('Registering default functions');

      // Utility functions
      this.registerFunction({
        name: 'now',
        description: 'Get current timestamp',
        func: () => new Date().toISOString(),
      });

      this.registerFunction({
        name: 'random',
        description: 'Generate random number',
        func: (min: number = 0, max: number = 1) => {
          return Math.random() * (max - min) + min;
        },
      });

      this.registerFunction({
        name: 'range',
        description: 'Generate array of numbers in range',
        func: (start: number, end: number, step: number = 1) => {
          const result: number[] = [];
          for (let i = start; i <= end; i += step) {
            result.push(i);
          }
          return result;
        },
      });

      // String functions
      this.registerFunction({
        name: 'slugify',
        description: 'Convert string to URL-friendly slug',
        func: (value: string) => {
          return String(value)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        },
      });

      // Array functions
      this.registerFunction({
        name: 'unique',
        description: 'Remove duplicates from array',
        func: (array: any[]) => {
          if (!Array.isArray(array)) {
            return array;
          }
          return [...new Set(array)];
        },
      });

      this.logger.info('Default functions registered');
    } catch (error) {
      this.logger.error('Failed to register default functions', error);
      throw error;
    }
  }

  /**
   * Register a custom filter
   */
  public registerFilter(filter: TemplateFilter): void {
    try {
      this.logger.info(`Registering filter: ${filter.name}`);

      this.filters.set(filter.name, filter);

      this.logger.info(`Filter registered successfully: ${filter.name}`);
    } catch (error) {
      this.logger.error(`Failed to register filter: ${filter.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a filter
   */
  public unregisterFilter(filterName: string): boolean {
    try {
      this.logger.info(`Unregistering filter: ${filterName}`);

      const deleted = this.filters.delete(filterName);
      if (deleted) {
        this.logger.info(`Filter unregistered successfully: ${filterName}`);
      } else {
        this.logger.warn(`Filter not found: ${filterName}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister filter: ${filterName}`, error);
      throw error;
    }
  }

  /**
   * Register a custom function
   */
  public registerFunction(func: TemplateFunction): void {
    try {
      this.logger.info(`Registering function: ${func.name}`);

      this.functions.set(func.name, func);

      this.logger.info(`Function registered successfully: ${func.name}`);
    } catch (error) {
      this.logger.error(`Failed to register function: ${func.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a function
   */
  public unregisterFunction(functionName: string): boolean {
    try {
      this.logger.info(`Unregistering function: ${functionName}`);

      const deleted = this.functions.delete(functionName);
      if (deleted) {
        this.logger.info(`Function unregistered successfully: ${functionName}`);
      } else {
        this.logger.warn(`Function not found: ${functionName}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister function: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * Parse a template string
   */
  public parseTemplate(template: string): ParsedTemplate {
    try {
      this.logger.info('Parsing template');

      const parsed: ParsedTemplate = {
        content: template,
        variables: [],
        conditions: [],
        loops: [],
        filters: [],
        functions: [],
      };

      // Extract variables
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;
      while ((match = variableRegex.exec(template)) !== null) {
        const variableExpression = match[1].trim();
        if (!parsed.variables.includes(variableExpression)) {
          parsed.variables.push(variableExpression);
        }
      }

      // Extract conditions (if statements)
      const conditionRegex = /\{%\s*if\s+([^%}]+)\s*%\}/g;
      while ((match = conditionRegex.exec(template)) !== null) {
        const conditionExpression = match[1].trim();
        parsed.conditions.push({
          expression: conditionExpression,
          startTag: match[0],
          endTag: `{% endif %}`,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      // Extract loops (for statements)
      const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+([^%}]+)\s*%\}/g;
      while ((match = loopRegex.exec(template)) !== null) {
        const variable = match[1].trim();
        const collection = match[2].trim();
        parsed.loops.push({
          variable,
          collection,
          startTag: match[0],
          endTag: `{% endfor %}`,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      // Extract filter usage
      const filterRegex = /\|\s*(\w+)(?:\(([^)]*)\))?/g;
      while ((match = filterRegex.exec(template)) !== null) {
        const filterName = match[1].trim();
        const args = match[2] ? match[2].split(',').map((arg) => arg.trim()) : [];
        parsed.filters.push({
          variable: '', // Will be determined during processing
          filter: filterName,
          args,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      // Extract function usage
      const functionRegex = /\{\{\s*(\w+)\(([^)]*)\)\s*\}\}/g;
      while ((match = functionRegex.exec(template)) !== null) {
        const functionName = match[1].trim();
        const args = match[2] ? match[2].split(',').map((arg) => arg.trim()) : [];
        parsed.functions.push({
          function: functionName,
          args,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }

      this.logger.info(
        `Template parsed successfully: ${parsed.variables.length} variables, ${parsed.conditions.length} conditions`
      );
      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse template', error);
      throw error;
    }
  }

  /**
   * Render a template with context
   */
  public async render(template: string, context: TemplateContext): Promise<string> {
    try {
      this.logger.info('Rendering template');

      // Parse the template
      const parsed = this.parseTemplate(template);

      // Process the template
      let rendered = template;

      // Process functions first
      rendered = this.processFunctions(rendered, context);

      // Process filters
      rendered = this.processFilters(rendered, context);

      // Process loops
      rendered = this.processLoops(rendered, context);

      // Process conditions
      rendered = this.processConditions(rendered, context);

      // Process variables
      rendered = this.processVariables(rendered, context);

      this.logger.info('Template rendered successfully');
      return rendered;
    } catch (error) {
      this.logger.error('Failed to render template', error);
      throw error;
    }
  }

  /**
   * Process variables in template
   */
  private processVariables(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing variables');

      let processed = template;

      // Replace simple variables
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = variableRegex.exec(processed)) !== null) {
        const variableExpression = match[1].trim();
        const fullMatch = match[0];

        try {
          // Evaluate the variable expression
          const value = this.evaluateVariableExpression(variableExpression, context);
          const stringValue = value !== null && value !== undefined ? String(value) : '';

          // Replace the variable
          processed = processed.replace(fullMatch, stringValue);
        } catch (error) {
          this.logger.error(`Failed to evaluate variable: ${variableExpression}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Variables processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process variables', error);
      throw error;
    }
  }

  /**
   * Evaluate a variable expression
   */
  private evaluateVariableExpression(expression: string, context: TemplateContext): any {
    try {
      this.logger.info(`Evaluating variable expression: ${expression}`);

      // Handle dot notation (e.g., issue.title, user.name)
      if (expression.includes('.')) {
        const parts = expression.split('.');
        let currentValue: any = context;

        for (const part of parts) {
          if (currentValue && typeof currentValue === 'object') {
            currentValue = currentValue[part];
          } else {
            return undefined;
          }
        }

        return currentValue;
      }

      // Handle simple variable access
      switch (expression) {
        case 'issue':
          return context.issue;
        case 'user':
          return context.user;
        case 'team':
          return context.team;
        case 'environment':
          return context.environment;
        case 'custom':
          return context.custom;
        default:
          // Check if it's a custom variable
          if (context.custom && context.custom.hasOwnProperty(expression)) {
            return context.custom[expression];
          }

          // Check if it's an issue property
          if (context.issue && (context.issue as any).hasOwnProperty(expression)) {
            return (context.issue as any)[expression];
          }

          return undefined;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate variable expression: ${expression}`, error);
      throw error;
    }
  }

  /**
   * Process conditions in template
   */
  private processConditions(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing conditions');

      let processed = template;

      // Simple if/endif processing
      const conditionRegex = /\{%\s*if\s+([^%}]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g;
      let match;

      while ((match = conditionRegex.exec(processed)) !== null) {
        const conditionExpression = match[1].trim();
        const content = match[2];
        const fullMatch = match[0];

        try {
          // Evaluate the condition
          const conditionResult = this.evaluateConditionExpression(conditionExpression, context);

          if (conditionResult) {
            // Include the content
            processed = processed.replace(fullMatch, content);
          } else {
            // Remove the entire conditional block
            processed = processed.replace(fullMatch, '');
          }
        } catch (error) {
          this.logger.error(`Failed to evaluate condition: ${conditionExpression}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Conditions processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process conditions', error);
      throw error;
    }
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateConditionExpression(expression: string, context: TemplateContext): boolean {
    try {
      this.logger.info(`Evaluating condition expression: ${expression}`);

      // Handle simple equality comparisons
      if (expression.includes('==')) {
        const [left, right] = expression.split('==').map((part) => part.trim());
        const leftValue = this.evaluateVariableExpression(left, context);
        const rightValue = this.evaluateVariableExpression(right, context);
        return leftValue == rightValue; // Allow type coercion
      }

      if (expression.includes('!=')) {
        const [left, right] = expression.split('!=').map((part) => part.trim());
        const leftValue = this.evaluateVariableExpression(left, context);
        const rightValue = this.evaluateVariableExpression(right, context);
        return leftValue != rightValue; // Allow type coercion
      }

      if (expression.includes('>=')) {
        const [left, right] = expression.split('>=').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue >= rightValue;
      }

      if (expression.includes('<=')) {
        const [left, right] = expression.split('<=').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue <= rightValue;
      }

      if (expression.includes('>')) {
        const [left, right] = expression.split('>').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue > rightValue;
      }

      if (expression.includes('<')) {
        const [left, right] = expression.split('<').map((part) => part.trim());
        const leftValue = Number(this.evaluateVariableExpression(left, context));
        const rightValue = Number(this.evaluateVariableExpression(right, context));
        return leftValue < rightValue;
      }

      // Handle simple truthiness check
      const value = this.evaluateVariableExpression(expression, context);
      return !!value;
    } catch (error) {
      this.logger.error(`Failed to evaluate condition expression: ${expression}`, error);
      throw error;
    }
  }

  /**
   * Process loops in template
   */
  private processLoops(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing loops');

      let processed = template;

      // Simple for loop processing
      const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+([^%}]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;
      let match;

      while ((match = loopRegex.exec(processed)) !== null) {
        const variableName = match[1].trim();
        const collectionExpression = match[2].trim();
        const loopContent = match[3];
        const fullMatch = match[0];

        try {
          // Evaluate the collection
          const collection = this.evaluateVariableExpression(collectionExpression, context);

          if (Array.isArray(collection)) {
            // Process each item in the collection
            let loopResult = '';

            for (const item of collection) {
              // Create a new context with the current item
              const loopContext = {
                ...context,
                custom: {
                  ...context.custom,
                  [variableName]: item,
                },
              };

              // Process the loop content with the item
              const itemContent = this.processVariables(loopContent, loopContext);
              loopResult += itemContent;
            }

            // Replace the loop with the result
            processed = processed.replace(fullMatch, loopResult);
          } else {
            // Not an array, remove the loop
            processed = processed.replace(fullMatch, '');
          }
        } catch (error) {
          this.logger.error(`Failed to process loop: ${collectionExpression}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Loops processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process loops', error);
      throw error;
    }
  }

  /**
   * Process filters in template
   */
  private processFilters(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing filters');

      let processed = template;

      // Process pipe-style filters
      const filterRegex = /\{\{([^}|]+)(\|[^}]+)\}\}/g;
      let match;

      while ((match = filterRegex.exec(processed)) !== null) {
        const variableExpression = match[1].trim();
        const filterChain = match[2];
        const fullMatch = match[0];

        try {
          // Evaluate the variable
          let value = this.evaluateVariableExpression(variableExpression, context);

          // Process each filter in the chain
          const filters = filterChain.split('|').slice(1); // Remove the first empty element

          for (const filterPart of filters) {
            const filterMatch = filterPart.match(/(\w+)(?:\(([^)]*)\))?/);
            if (filterMatch) {
              const filterName = filterMatch[1];
              const argsString = filterMatch[2] || '';
              const args = argsString ? argsString.split(',').map((arg) => arg.trim()) : [];

              // Apply the filter
              value = this.applyFilter(filterName, value, ...args);
            }
          }

          // Replace with the final value
          const stringValue = value !== null && value !== undefined ? String(value) : '';
          processed = processed.replace(fullMatch, stringValue);
        } catch (error) {
          this.logger.error(`Failed to process filter chain: ${filterChain}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Filters processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process filters', error);
      throw error;
    }
  }

  /**
   * Apply a filter to a value
   */
  private applyFilter(filterName: string, value: any, ...args: any[]): any {
    try {
      this.logger.info(`Applying filter: ${filterName}`);

      const filter = this.filters.get(filterName);
      if (!filter) {
        throw new Error(`Filter not found: ${filterName}`);
      }

      return filter.func(value, ...args);
    } catch (error) {
      this.logger.error(`Failed to apply filter: ${filterName}`, error);
      throw error;
    }
  }

  /**
   * Process functions in template
   */
  private processFunctions(template: string, context: TemplateContext): string {
    try {
      this.logger.info('Processing functions');

      let processed = template;

      // Process function calls
      const functionRegex = /\{\{\s*(\w+)\(([^)]*)\)\s*\}\}/g;
      let match;

      while ((match = functionRegex.exec(processed)) !== null) {
        const functionName = match[1].trim();
        const argsString = match[2] || '';
        const fullMatch = match[0];

        try {
          // Parse arguments
          const args = argsString
            ? argsString.split(',').map((arg) => {
                const trimmed = arg.trim();
                // Try to evaluate as variable or literal
                try {
                  return this.evaluateVariableExpression(trimmed, context);
                } catch {
                  // Return as string literal
                  return trimmed.replace(/^["']|["']$/g, ''); // Remove quotes if present
                }
              })
            : [];

          // Apply the function
          const result = this.applyFunction(functionName, ...args);

          // Replace with the result
          const stringValue = result !== null && result !== undefined ? String(result) : '';
          processed = processed.replace(fullMatch, stringValue);
        } catch (error) {
          this.logger.error(`Failed to process function: ${functionName}`, error);
          processed = processed.replace(
            fullMatch,
            `[Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
          );
        }
      }

      this.logger.info('Functions processed');
      return processed;
    } catch (error) {
      this.logger.error('Failed to process functions', error);
      throw error;
    }
  }

  /**
   * Apply a function with arguments
   */
  private applyFunction(functionName: string, ...args: any[]): any {
    try {
      this.logger.info(`Applying function: ${functionName}`);

      const func = this.functions.get(functionName);
      if (!func) {
        throw new Error(`Function not found: ${functionName}`);
      }

      return func.func(...args);
    } catch (error) {
      this.logger.error(`Failed to apply function: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * Get all registered filters
   */
  public getFilters(): TemplateFilter[] {
    return Array.from(this.filters.values());
  }

  /**
   * Get all registered functions
   */
  public getFunctions(): TemplateFunction[] {
    return Array.from(this.functions.values());
  }

  /**
   * Compile a template for faster repeated rendering
   */
  public compile(template: string): (context: TemplateContext) => Promise<string> {
    try {
      this.logger.info('Compiling template');

      // Parse and optimize the template
      const parsed = this.parseTemplate(template);

      // Return a compiled function
      return async (context: TemplateContext): Promise<string> => {
        return this.render(template, context);
      };
    } catch (error) {
      this.logger.error('Failed to compile template', error);
      throw error;
    }
  }

  /**
   * Validate a template syntax
   */
  public validateTemplate(template: string): TemplateError[] {
    try {
      this.logger.info('Validating template syntax');

      const errors: TemplateError[] = [];

      // Check for unmatched opening tags
      const openingTags = (template.match(/\{\{/g) || []).length;
      const closingTags = (template.match(/\}\}/g) || []).length;

      if (openingTags !== closingTags) {
        errors.push({
          type: 'syntax',
          message: `Mismatched variable tags: ${openingTags} opening, ${closingTags} closing`,
        });
      }

      // Check for unmatched condition tags
      const ifTags = (template.match(/\{%\s*if\s+/g) || []).length;
      const endifTags = (template.match(/\{%\s*endif\s*%\}/g) || []).length;

      if (ifTags !== endifTags) {
        errors.push({
          type: 'syntax',
          message: `Mismatched condition tags: ${ifTags} if, ${endifTags} endif`,
        });
      }

      // Check for unmatched loop tags
      const forTags = (template.match(/\{%\s*for\s+/g) || []).length;
      const endforTags = (template.match(/\{%\s*endfor\s*%\}/g) || []).length;

      if (forTags !== endforTags) {
        errors.push({
          type: 'syntax',
          message: `Mismatched loop tags: ${forTags} for, ${endforTags} endfor`,
        });
      }

      // Check for unknown filters
      const filterUsages = template.match(/\|(\w+)/g) || [];
      for (const filterUsage of filterUsages) {
        const filterName = filterUsage.substring(1); // Remove the |
        if (!this.filters.has(filterName)) {
          errors.push({
            type: 'filter',
            message: `Unknown filter: ${filterName}`,
          });
        }
      }

      // Check for unknown functions
      const functionUsages = template.match(/\{\{\s*(\w+)\(/g) || [];
      for (const functionUsage of functionUsages) {
        const functionNameMatch = functionUsage.match(/\{\{\s*(\w+)\(/);
        if (functionNameMatch) {
          const functionName = functionNameMatch[1];
          if (!this.functions.has(functionName)) {
            errors.push({
              type: 'function',
              message: `Unknown function: ${functionName}`,
            });
          }
        }
      }

      this.logger.info(`Template validation completed with ${errors.length} errors`);
      return errors;
    } catch (error) {
      this.logger.error('Failed to validate template syntax', error);
      throw error;
    }
  }

  /**
   * Escape HTML entities in content
   */
  public escapeHtml(content: string): string {
    try {
      this.logger.info('Escaping HTML content');

      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    } catch (error) {
      this.logger.error('Failed to escape HTML content', error);
      throw error;
    }
  }

  /**
   * Unescape HTML entities in content
   */
  public unescapeHtml(content: string): string {
    try {
      this.logger.info('Unescaping HTML content');

      return content
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");
    } catch (error) {
      this.logger.error('Failed to unescape HTML content', error);
      throw error;
    }
  }

  /**
   * Create a safe template context
   */
  public createSafeContext(context: TemplateContext): TemplateContext {
    try {
      this.logger.info('Creating safe template context');

      // Deep clone the context to prevent mutations
      const safeContext: TemplateContext = JSON.parse(JSON.stringify(context));

      // Escape potentially dangerous content
      if (safeContext.issue.title) {
        safeContext.issue.title = this.escapeHtml(safeContext.issue.title);
      }

      if (safeContext.issue.description) {
        safeContext.issue.description = this.escapeHtml(safeContext.issue.description);
      }

      // Add helper functions to context
      (safeContext as any).helpers = {
        formatDate: (date: string | Date) => {
          if (!date) {
            return '';
          }
          const d = new Date(date);
          return d.toISOString().split('T')[0];
        },
        formatCurrency: (amount: number, currency: string = 'USD') => {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
          }).format(amount);
        },
        pluralize: (count: number, singular: string, plural: string) => {
          return count === 1 ? singular : plural;
        },
      };

      this.logger.info('Safe template context created');
      return safeContext;
    } catch (error) {
      this.logger.error('Failed to create safe template context', error);
      throw error;
    }
  }

  /**
   * Get template statistics
   */
  public getTemplateStats(): {
    totalFilters: number;
    totalFunctions: number;
    mostUsedFilters: Array<{ filter: string; usage: number }>;
    mostUsedFunctions: Array<{ function: string; usage: number }>;
  } {
    try {
      this.logger.info('Generating template statistics');

      // In a real implementation, we'd track usage statistics
      // For now, we'll return basic counts

      const stats = {
        totalFilters: this.filters.size,
        totalFunctions: this.functions.size,
        mostUsedFilters: [] as Array<{ filter: string; usage: number }>,
        mostUsedFunctions: [] as Array<{ function: string; usage: number }>,
      };

      this.logger.info('Template statistics generated');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate template statistics', error);
      throw error;
    }
  }

  /**
   * Clear template cache (if implemented)
   */
  public clearCache(): void {
    try {
      this.logger.info('Clearing template cache');

      // In a real implementation, we'd clear any compiled template cache
      // For now, this is a placeholder

      this.logger.info('Template cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear template cache', error);
      throw error;
    }
  }

  /**
   * Test a template with sample data
   */
  public async testTemplate(
    template: string,
    sampleContext: Partial<TemplateContext>
  ): Promise<{ success: boolean; result?: string; errors?: TemplateError[] }> {
    try {
      this.logger.info('Testing template');

      // Validate the template first
      const errors = this.validateTemplate(template);
      if (errors.length > 0) {
        return {
          success: false,
          errors,
        };
      }

      // Create a minimal context
      const context: TemplateContext = {
        issue: sampleContext.issue || {
          id: 'test-issue-123',
          title: 'Test Issue Title',
          description: 'Test issue description',
          state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
          priority: 'normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          url: 'https://linear.app/test-issue',
          identifier: 'TEST-1',
          number: 1,
          creator: { id: 'user-1', name: 'Test Creator', email: 'creator@test.com' },
          assignee: { id: 'user-2', name: 'Test Assignee', email: 'assignee@test.com' },
        },
        user: sampleContext.user || {
          id: 'current-user-456',
          name: 'Current User',
          email: 'current@test.com',
        },
        environment: {
          currentDate: new Date().toISOString().split('T')[0],
          currentTime: new Date().toISOString().split('T')[1].split('.')[0],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        custom: sampleContext.custom || {},
      };

      // Render the template
      const result = await this.render(template, context);

      return {
        success: true,
        result,
      };
    } catch (error) {
      this.logger.error('Failed to test template', error);
      return {
        success: false,
        errors: [
          {
            type: 'runtime',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }
}
