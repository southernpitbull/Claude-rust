/**
 * VariableSubstitutionEngine.ts
 *
 * Advanced variable substitution engine for Linear integration with context-aware
 * resolution, type coercion, nested object traversal, and AI-powered suggestions.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface VariableContext {
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
    timestamp: number;
  };
  custom: Record<string, any>;
  system: {
    version: string;
    platform: string;
  };
}

export interface VariableDefinition {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'custom';
  defaultValue?: any;
  required: boolean;
  exampleValue?: any;
  resolver?: (context: VariableContext) => any;
  validator?: (value: any) => boolean;
}

export interface ResolvedVariable {
  name: string;
  originalValue: any;
  resolvedValue: any;
  type: string;
  success: boolean;
  error?: string;
  source: 'context' | 'resolver' | 'default' | 'computed';
}

export interface VariableResolutionResult {
  variables: ResolvedVariable[];
  success: boolean;
  errors: string[];
  warnings: string[];
  processingTime: number;
}

export interface VariableSuggestion {
  variableName: string;
  confidence: number; // 0-100 percentage
  suggestedValue: any;
  reason: string;
  contextRelevance: number; // 0-100 relevance to current context
}

export interface TypeCoercionRule {
  fromType: string;
  toType: string;
  converter: (value: any) => any;
  lossy: boolean; // Whether conversion loses information
}

export class VariableSubstitutionEngine {
  private linearClient: LinearClient;
  private variableDefinitions: Map<string, VariableDefinition>;
  private typeCoercionRules: TypeCoercionRule[];
  private computedVariables: Map<string, (context: VariableContext) => any>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.variableDefinitions = new Map();
    this.typeCoercionRules = [];
    this.computedVariables = new Map();
    this.logger = new Logger('VariableSubstitutionEngine');

    // Register default variables and coercion rules
    this.registerDefaultVariables();
    this.registerDefaultCoercionRules();
    this.registerDefaultComputedVariables();
  }

  /**
   * Register default variables
   */
  private registerDefaultVariables(): void {
    try {
      this.logger.info('Registering default variables');

      // Issue-related variables
      this.registerVariable({
        name: 'issue.id',
        description: 'Unique identifier for the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.id,
      });

      this.registerVariable({
        name: 'issue.title',
        description: 'Title of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.title,
      });

      this.registerVariable({
        name: 'issue.description',
        description: 'Description of the issue',
        type: 'string',
        required: false,
        resolver: (context) => context.issue.description,
      });

      this.registerVariable({
        name: 'issue.state',
        description: 'Current state of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.state?.name,
      });

      this.registerVariable({
        name: 'issue.priority',
        description: 'Priority level of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.priority,
      });

      this.registerVariable({
        name: 'issue.assignee',
        description: 'Assignee of the issue',
        type: 'string',
        required: false,
        resolver: (context) => context.issue.assignee?.name,
      });

      this.registerVariable({
        name: 'issue.creator',
        description: 'Creator of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.creator?.name,
      });

      this.registerVariable({
        name: 'issue.createdAt',
        description: 'Creation date of the issue',
        type: 'date',
        required: true,
        resolver: (context) => context.issue.createdAt,
      });

      this.registerVariable({
        name: 'issue.updatedAt',
        description: 'Last update date of the issue',
        type: 'date',
        required: true,
        resolver: (context) => context.issue.updatedAt,
      });

      this.registerVariable({
        name: 'issue.dueDate',
        description: 'Due date of the issue',
        type: 'date',
        required: false,
        resolver: (context) => context.issue.dueDate,
      });

      // User-related variables
      this.registerVariable({
        name: 'user.name',
        description: 'Current user name',
        type: 'string',
        required: true,
        resolver: (context) => context.user.name,
      });

      this.registerVariable({
        name: 'user.email',
        description: 'Current user email',
        type: 'string',
        required: true,
        resolver: (context) => context.user.email,
      });

      // Environment variables
      this.registerVariable({
        name: 'environment.currentDate',
        description: 'Current date',
        type: 'string',
        required: true,
        resolver: (context) => context.environment.currentDate,
      });

      this.registerVariable({
        name: 'environment.currentTime',
        description: 'Current time',
        type: 'string',
        required: true,
        resolver: (context) => context.environment.currentTime,
      });

      this.registerVariable({
        name: 'environment.timestamp',
        description: 'Current timestamp',
        type: 'number',
        required: true,
        resolver: (context) => context.environment.timestamp,
      });

      this.logger.info('Default variables registered');
    } catch (error) {
      this.logger.error('Failed to register default variables', error);
      throw error;
    }
  }

  /**
   * Register default type coercion rules
   */
  private registerDefaultCoercionRules(): void {
    try {
      this.logger.info('Registering default type coercion rules');

      // String to number
      this.registerTypeCoercionRule({
        fromType: 'string',
        toType: 'number',
        converter: (value: any) => {
          const num = Number(value);
          return isNaN(num) ? 0 : num;
        },
        lossy: false,
      });

      // Number to string
      this.registerTypeCoercionRule({
        fromType: 'number',
        toType: 'string',
        converter: (value: any) => String(value),
        lossy: false,
      });

      // String to boolean
      this.registerTypeCoercionRule({
        fromType: 'string',
        toType: 'boolean',
        converter: (value: any) => {
          const lower = String(value).toLowerCase();
          return ['true', '1', 'yes', 'on'].includes(lower);
        },
        lossy: true,
      });

      // Boolean to string
      this.registerTypeCoercionRule({
        fromType: 'boolean',
        toType: 'string',
        converter: (value: any) => String(value),
        lossy: false,
      });

      // Date to string
      this.registerTypeCoercionRule({
        fromType: 'date',
        toType: 'string',
        converter: (value: any) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return new Date(value).toISOString();
        },
        lossy: false,
      });

      // String to date
      this.registerTypeCoercionRule({
        fromType: 'string',
        toType: 'date',
        converter: (value: any) => new Date(value),
        lossy: false,
      });

      this.logger.info('Default type coercion rules registered');
    } catch (error) {
      this.logger.error('Failed to register default type coercion rules', error);
      throw error;
    }
  }

  /**
   * Register default computed variables
   */
  private registerDefaultComputedVariables(): void {
    try {
      this.logger.info('Registering default computed variables');

      // Days since creation
      this.registerComputedVariable('issue.daysSinceCreation', (context) => {
        if (!context.issue.createdAt) {
          return 0;
        }
        const created = new Date(context.issue.createdAt);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - created.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      });

      // Issue age category
      this.registerComputedVariable('issue.ageCategory', (context) => {
        const days = this.resolveVariable('issue.daysSinceCreation', context)?.resolvedValue || 0;
        if (days <= 1) {
          return 'new';
        }
        if (days <= 7) {
          return 'recent';
        }
        if (days <= 30) {
          return 'established';
        }
        return 'old';
      });

      // Priority weight
      this.registerComputedVariable('issue.priorityWeight', (context) => {
        const priority = context.issue.priority?.toLowerCase();
        switch (priority) {
          case 'urgent':
            return 5;
          case 'high':
            return 4;
          case 'medium':
            return 3;
          case 'low':
            return 2;
          default:
            return 1;
        }
      });

      // Greeting based on time of day
      this.registerComputedVariable('environment.greeting', (context) => {
        const hour = new Date().getHours();
        if (hour < 12) {
          return 'Good morning';
        }
        if (hour < 18) {
          return 'Good afternoon';
        }
        return 'Good evening';
      });

      this.logger.info('Default computed variables registered');
    } catch (error) {
      this.logger.error('Failed to register default computed variables', error);
      throw error;
    }
  }

  /**
   * Register a variable definition
   */
  public registerVariable(variable: VariableDefinition): void {
    try {
      this.logger.info(`Registering variable: ${variable.name}`);

      this.variableDefinitions.set(variable.name, variable);

      this.logger.info(`Variable registered successfully: ${variable.name}`);
    } catch (error) {
      this.logger.error(`Failed to register variable: ${variable.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a variable definition
   */
  public unregisterVariable(variableName: string): boolean {
    try {
      this.logger.info(`Unregistering variable: ${variableName}`);

      const deleted = this.variableDefinitions.delete(variableName);
      if (deleted) {
        this.logger.info(`Variable unregistered successfully: ${variableName}`);
      } else {
        this.logger.warn(`Variable not found: ${variableName}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister variable: ${variableName}`, error);
      throw error;
    }
  }

  /**
   * Get a variable definition
   */
  public getVariable(variableName: string): VariableDefinition | undefined {
    return this.variableDefinitions.get(variableName);
  }

  /**
   * Get all variable definitions
   */
  public getAllVariables(): VariableDefinition[] {
    return Array.from(this.variableDefinitions.values());
  }

  /**
   * Register a type coercion rule
   */
  public registerTypeCoercionRule(rule: TypeCoercionRule): void {
    try {
      this.logger.info(`Registering type coercion rule: ${rule.fromType} -> ${rule.toType}`);

      this.typeCoercionRules.push(rule);

      this.logger.info(`Type coercion rule registered successfully`);
    } catch (error) {
      this.logger.error(`Failed to register type coercion rule`, error);
      throw error;
    }
  }

  /**
   * Register a computed variable
   */
  public registerComputedVariable(name: string, computer: (context: VariableContext) => any): void {
    try {
      this.logger.info(`Registering computed variable: ${name}`);

      this.computedVariables.set(name, computer);

      this.logger.info(`Computed variable registered successfully: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to register computed variable: ${name}`, error);
      throw error;
    }
  }

  /**
   * Resolve a single variable
   */
  public resolveVariable(variableName: string, context: VariableContext): ResolvedVariable | null {
    try {
      this.logger.info(`Resolving variable: ${variableName}`);

      const startTime = Date.now();

      // Check if it's a computed variable
      const computer = this.computedVariables.get(variableName);
      if (computer) {
        try {
          const computedValue = computer(context);
          const resolved: ResolvedVariable = {
            name: variableName,
            originalValue: computedValue,
            resolvedValue: computedValue,
            type: typeof computedValue,
            success: true,
            source: 'computed',
          };

          this.logger.info(
            `Computed variable resolved successfully: ${variableName} (${Date.now() - startTime}ms)`
          );
          return resolved;
        } catch (error) {
          this.logger.error(`Failed to compute variable: ${variableName}`, error);
          return {
            name: variableName,
            originalValue: undefined,
            resolvedValue: undefined,
            type: 'undefined',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            source: 'computed',
          };
        }
      }

      // Check for variable definition
      const definition = this.variableDefinitions.get(variableName);
      if (definition) {
        // Try resolver first
        if (definition.resolver) {
          try {
            const resolvedValue = definition.resolver(context);

            // Validate if validator is provided
            if (definition.validator && !definition.validator(resolvedValue)) {
              return {
                name: variableName,
                originalValue: resolvedValue,
                resolvedValue: resolvedValue,
                type: typeof resolvedValue,
                success: false,
                error: `Validation failed for variable: ${variableName}`,
                source: 'resolver',
              };
            }

            const resolved: ResolvedVariable = {
              name: variableName,
              originalValue: resolvedValue,
              resolvedValue: resolvedValue,
              type: typeof resolvedValue,
              success: true,
              source: 'resolver',
            };

            this.logger.info(
              `Variable resolved successfully: ${variableName} (${Date.now() - startTime}ms)`
            );
            return resolved;
          } catch (error) {
            this.logger.error(`Failed to resolve variable with resolver: ${variableName}`, error);
            // Fall back to default value
          }
        }

        // Use default value if available
        if (definition.defaultValue !== undefined) {
          const resolved: ResolvedVariable = {
            name: variableName,
            originalValue: definition.defaultValue,
            resolvedValue: definition.defaultValue,
            type: typeof definition.defaultValue,
            success: true,
            source: 'default',
          };

          this.logger.info(
            `Variable resolved with default value: ${variableName} (${Date.now() - startTime}ms)`
          );
          return resolved;
        }

        // Variable is required but couldn't be resolved
        if (definition.required) {
          return {
            name: variableName,
            originalValue: undefined,
            resolvedValue: undefined,
            type: 'undefined',
            success: false,
            error: `Required variable could not be resolved: ${variableName}`,
            source: 'resolver',
          };
        }

        // Variable is optional and not resolved
        return {
          name: variableName,
          originalValue: undefined,
          resolvedValue: undefined,
          type: 'undefined',
          success: true,
          source: 'resolver',
        };
      }

      // Check custom variables in context
      if (context.custom && context.custom.hasOwnProperty(variableName)) {
        const customValue = context.custom[variableName];
        const resolved: ResolvedVariable = {
          name: variableName,
          originalValue: customValue,
          resolvedValue: customValue,
          type: typeof customValue,
          success: true,
          source: 'context',
        };

        this.logger.info(
          `Custom variable resolved successfully: ${variableName} (${Date.now() - startTime}ms)`
        );
        return resolved;
      }

      // Try to resolve from context using dot notation
      const dotNotationValue = this.resolveDotNotation(variableName, context);
      if (dotNotationValue !== undefined) {
        const resolved: ResolvedVariable = {
          name: variableName,
          originalValue: dotNotationValue,
          resolvedValue: dotNotationValue,
          type: typeof dotNotationValue,
          success: true,
          source: 'context',
        };

        this.logger.info(
          `Dot notation variable resolved successfully: ${variableName} (${Date.now() - startTime}ms)`
        );
        return resolved;
      }

      // Variable not found
      this.logger.info(`Variable not found: ${variableName} (${Date.now() - startTime}ms)`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to resolve variable: ${variableName}`, error);
      throw error;
    }
  }

  /**
   * Resolve a variable using dot notation (e.g., "issue.title")
   */
  private resolveDotNotation(variableName: string, context: VariableContext): any {
    try {
      this.logger.info(`Resolving dot notation variable: ${variableName}`);

      // Split by dots
      const parts = variableName.split('.');
      if (parts.length < 2) {
        return undefined;
      }

      // Navigate through the context
      let currentValue: any = context;

      for (const part of parts) {
        if (currentValue && typeof currentValue === 'object') {
          currentValue = currentValue[part];
        } else {
          return undefined;
        }
      }

      return currentValue;
    } catch (error) {
      this.logger.error(`Failed to resolve dot notation variable: ${variableName}`, error);
      throw error;
    }
  }

  /**
   * Resolve multiple variables
   */
  public resolveVariables(
    variableNames: string[],
    context: VariableContext
  ): VariableResolutionResult {
    try {
      this.logger.info(`Resolving ${variableNames.length} variables`);

      const startTime = Date.now();

      const result: VariableResolutionResult = {
        variables: [],
        success: true,
        errors: [],
        warnings: [],
        processingTime: 0,
      };

      // Resolve each variable
      for (const variableName of variableNames) {
        try {
          const resolved = this.resolveVariable(variableName, context);
          if (resolved) {
            result.variables.push(resolved);
            if (!resolved.success) {
              result.success = false;
              if (resolved.error) {
                result.errors.push(resolved.error);
              }
            }
          } else {
            result.warnings.push(`Variable not found: ${variableName}`);
          }
        } catch (error) {
          result.success = false;
          result.errors.push(
            `Failed to resolve variable ${variableName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      result.processingTime = Date.now() - startTime;

      this.logger.info(`Resolved ${variableNames.length} variables in ${result.processingTime}ms`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to resolve variables`, error);
      throw error;
    }
  }

  /**
   * Substitute variables in a template string
   */
  public substituteVariables(
    template: string,
    context: VariableContext,
    options?: {
      escapeHtml?: boolean;
      preserveMissing?: boolean;
      missingPlaceholder?: string;
    }
  ): string {
    try {
      this.logger.info('Substituting variables in template');

      const opts = {
        escapeHtml: false,
        preserveMissing: false,
        missingPlaceholder: '[MISSING]',
        ...options,
      };

      let result = template;

      // Find all variable placeholders
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;

      // Collect all unique variable names
      const variableNames = new Set<string>();
      while ((match = variableRegex.exec(template)) !== null) {
        const variableName = match[1].trim();
        variableNames.add(variableName);
      }

      // Resolve all variables
      const resolutionResult = this.resolveVariables(Array.from(variableNames), context);

      // Substitute each variable
      for (const resolved of resolutionResult.variables) {
        if (resolved.success) {
          let value = resolved.resolvedValue;

          // Escape HTML if requested
          if (opts.escapeHtml && typeof value === 'string') {
            value = this.escapeHtml(value);
          }

          // Create the placeholder
          const placeholder = `{{${resolved.name}}}`;

          // Replace all occurrences
          result = result.split(placeholder).join(String(value));
        } else if (opts.preserveMissing) {
          // Preserve the placeholder for missing variables
          const placeholder = `{{${resolved.name}}}`;
          result = result.split(placeholder).join(opts.missingPlaceholder);
        } else {
          // Remove the placeholder entirely
          const placeholder = `{{${resolved.name}}}`;
          result = result.split(placeholder).join('');
        }
      }

      this.logger.info('Variables substituted successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to substitute variables', error);
      throw error;
    }
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(content: string): string {
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
   * Coerce a value to a specific type
   */
  public coerceType(value: any, targetType: string): any {
    try {
      this.logger.info(`Coercing value to type: ${targetType}`);

      const currentType = typeof value;

      // If already the correct type, return as-is
      if (currentType === targetType) {
        return value;
      }

      // Find a coercion rule
      const rule = this.typeCoercionRules.find(
        (r) => r.fromType === currentType && r.toType === targetType
      );

      if (rule) {
        try {
          const coerced = rule.converter(value);
          this.logger.info(`Value coerced from ${currentType} to ${targetType}`);
          return coerced;
        } catch (error) {
          this.logger.error(
            `Failed to coerce value using rule: ${currentType} -> ${targetType}`,
            error
          );
          throw error;
        }
      }

      // No rule found, try basic conversion
      switch (targetType) {
        case 'string':
          return String(value);
        case 'number':
          return Number(value);
        case 'boolean':
          return Boolean(value);
        case 'date':
          return new Date(value);
        default:
          this.logger.warn(`No coercion rule found for ${currentType} -> ${targetType}`);
          return value;
      }
    } catch (error) {
      this.logger.error(`Failed to coerce type: ${typeof value} -> ${targetType}`, error);
      throw error;
    }
  }

  /**
   * Get type coercion rules
   */
  public getTypeCoercionRules(): TypeCoercionRule[] {
    return [...this.typeCoercionRules];
  }

  /**
   * Generate AI-powered variable suggestions
   */
  public async generateVariableSuggestions(
    context: VariableContext,
    userInput?: string
  ): Promise<VariableSuggestion[]> {
    try {
      this.logger.info('Generating variable suggestions');

      const suggestions: VariableSuggestion[] = [];

      // Get all available variables
      const allVariables = [
        ...Array.from(this.variableDefinitions.keys()),
        ...Array.from(this.computedVariables.keys()),
        ...Object.keys(context.custom),
      ];

      // If user input provided, filter and rank suggestions
      if (userInput) {
        const inputLower = userInput.toLowerCase();

        for (const variableName of allVariables) {
          const variableLower = variableName.toLowerCase();

          // Calculate relevance score
          let relevance = 0;

          // Exact match gets highest score
          if (variableLower === inputLower) {
            relevance = 100;
          }
          // Prefix match
          else if (variableLower.startsWith(inputLower)) {
            relevance = 80;
          }
          // Contains match
          else if (variableLower.includes(inputLower)) {
            relevance = 60;
          }
          // Partial match
          else if (this.calculateStringSimilarity(variableLower, inputLower) > 0.5) {
            relevance = 40;
          }

          if (relevance > 0) {
            // Resolve the variable to get its value
            const resolved = this.resolveVariable(variableName, context);

            suggestions.push({
              variableName,
              confidence: relevance,
              suggestedValue: resolved?.resolvedValue,
              reason: `Matched input: ${userInput}`,
              contextRelevance: this.calculateContextRelevance(variableName, context),
            });
          }
        }
      } else {
        // No input, suggest most contextually relevant variables
        for (const variableName of allVariables) {
          const contextRelevance = this.calculateContextRelevance(variableName, context);

          // Only suggest variables with some context relevance
          if (contextRelevance > 30) {
            const resolved = this.resolveVariable(variableName, context);

            suggestions.push({
              variableName,
              confidence: 80,
              suggestedValue: resolved?.resolvedValue,
              reason: 'Contextually relevant variable',
              contextRelevance,
            });
          }
        }
      }

      // Sort by confidence (highest first)
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Keep only top 20 suggestions
      const topSuggestions = suggestions.slice(0, 20);

      this.logger.info(`Generated ${topSuggestions.length} variable suggestions`);
      return topSuggestions;
    } catch (error) {
      this.logger.error('Failed to generate variable suggestions', error);
      throw error;
    }
  }

  /**
   * Calculate string similarity between two strings
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    try {
      // Simple implementation using Levenshtein distance
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      if (longer.length === 0) {
        return 1.0;
      }

      const distance = this.levenshteinDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    } catch (error) {
      this.logger.error('Failed to calculate string similarity', error);
      throw error;
    }
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate context relevance for a variable
   */
  private calculateContextRelevance(variableName: string, context: VariableContext): number {
    try {
      // Simple implementation based on variable name and context
      let relevance = 0;

      // Check if variable relates to current issue
      if (variableName.startsWith('issue.')) {
        relevance += 50;
      }

      // Check if variable relates to current user
      if (variableName.startsWith('user.')) {
        relevance += 40;
      }

      // Check if variable relates to current environment
      if (variableName.startsWith('environment.')) {
        relevance += 30;
      }

      // Boost recently updated issues
      if (context.issue.updatedAt) {
        const updated = new Date(context.issue.updatedAt);
        const now = new Date();
        const hoursSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate < 24) {
          relevance += 20; // Recently updated
        } else if (hoursSinceUpdate < 168) {
          relevance += 10; // Updated within a week
        }
      }

      // Boost high priority issues
      if (context.issue.priority === 'urgent' || context.issue.priority === 'high') {
        relevance += 15;
      }

      // Cap relevance at 100
      return Math.min(relevance, 100);
    } catch (error) {
      this.logger.error(`Failed to calculate context relevance for: ${variableName}`, error);
      return 0;
    }
  }

  /**
   * Validate variable context
   */
  public validateContext(context: VariableContext): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating variable context');

      const result = {
        valid: true,
        errors: [] as string[],
        warnings: [] as string[],
      };

      // Check required context properties
      if (!context.issue) {
        result.errors.push('Missing required context property: issue');
        result.valid = false;
      }

      if (!context.user) {
        result.errors.push('Missing required context property: user');
        result.valid = false;
      }

      if (!context.environment) {
        result.errors.push('Missing required context property: environment');
        result.valid = false;
      }

      // Validate issue properties if present
      if (context.issue) {
        if (!context.issue.id) {
          result.warnings.push('Issue is missing id property');
        }

        if (!context.issue.title) {
          result.warnings.push('Issue is missing title property');
        }
      }

      // Validate user properties if present
      if (context.user) {
        if (!context.user.id) {
          result.warnings.push('User is missing id property');
        }

        if (!context.user.name) {
          result.warnings.push('User is missing name property');
        }

        if (!context.user.email) {
          result.warnings.push('User is missing email property');
        }
      }

      // Validate environment properties if present
      if (context.environment) {
        if (!context.environment.currentDate) {
          result.warnings.push('Environment is missing currentDate property');
        }

        if (!context.environment.currentTime) {
          result.warnings.push('Environment is missing currentTime property');
        }
      }

      this.logger.info(
        `Variable context validation completed: ${result.valid ? 'valid' : 'invalid'}`
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to validate variable context', error);
      throw error;
    }
  }

  /**
   * Create a safe context for variable resolution
   */
  public createSafeContext(context: VariableContext): VariableContext {
    try {
      this.logger.info('Creating safe variable context');

      // Deep clone the context to prevent mutations
      const safeContext: VariableContext = JSON.parse(JSON.stringify(context));

      // Sanitize potentially dangerous content
      if (safeContext.issue.title) {
        safeContext.issue.title = this.sanitizeString(safeContext.issue.title);
      }

      if (safeContext.issue.description) {
        safeContext.issue.description = this.sanitizeString(safeContext.issue.description);
      }

      if (safeContext.user.name) {
        safeContext.user.name = this.sanitizeString(safeContext.user.name);
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

      this.logger.info('Safe variable context created');
      return safeContext;
    } catch (error) {
      this.logger.error('Failed to create safe variable context', error);
      throw error;
    }
  }

  /**
   * Sanitize a string for safe use
   */
  private sanitizeString(str: string): string {
    try {
      // Basic sanitization - remove potentially dangerous characters
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/vbscript:/gi, '') // Remove vbscript: protocol
        .replace(/data:/gi, '') // Remove data: protocol
        .trim();
    } catch (error) {
      this.logger.error('Failed to sanitize string', error);
      return str;
    }
  }

  /**
   * Get variable resolution statistics
   */
  public getResolutionStats(): {
    totalVariables: number;
    totalComputedVariables: number;
    totalCoercionRules: number;
    mostUsedVariables: Array<{ variable: string; usage: number }>;
    averageUsage: number;
    resolutionSuccessRate: number;
  } {
    try {
      this.logger.info('Generating variable resolution statistics');

      // In a real implementation, we'd track usage statistics
      // For now, this is a placeholder

      const stats = {
        totalVariables: this.variableDefinitions.size,
        totalComputedVariables: this.computedVariables.size,
        totalCoercionRules: this.typeCoercionRules.length,
        mostUsedVariables: [] as Array<{ variable: string; usage: number }>,
        averageUsage: 0,
        resolutionSuccessRate: 0, // Would be calculated from actual usage data
      };

      this.logger.info('Variable resolution statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate variable resolution statistics', error);
      throw error;
    }
  }

  /**
   * Find optimization opportunities for variables
   */
  public findOptimizationOpportunities(): Array<{
    type: 'unused_variable' | 'duplicate_variable' | 'inefficient_resolver' | 'missing_validator';
    variableName: string;
    suggestion: string;
    confidence: number; // 0-100 percentage
    estimatedPerformanceGain: number; // ms
  }> {
    try {
      this.logger.info('Finding variable optimization opportunities');

      const opportunities: Array<{
        type:
          | 'unused_variable'
          | 'duplicate_variable'
          | 'inefficient_resolver'
          | 'missing_validator';
        variableName: string;
        suggestion: string;
        confidence: number;
        estimatedPerformanceGain: number;
      }> = [];

      // Find unused variables
      const unusedVariables = Array.from(this.variableDefinitions.values()).filter(
        (variable) => variable.usageCount === 0 && !variable.isBuiltIn
      );

      for (const variable of unusedVariables) {
        opportunities.push({
          type: 'unused_variable',
          variableName: variable.name,
          suggestion: `Variable has never been used. Consider removing it to reduce bundle size.`,
          confidence: 90,
          estimatedPerformanceGain: 50, // ms
        });
      }

      // Find duplicate variables (variables with very similar names)
      const allVariables = Array.from(this.variableDefinitions.values());
      for (let i = 0; i < allVariables.length; i++) {
        for (let j = i + 1; j < allVariables.length; j++) {
          const var1 = allVariables[i];
          const var2 = allVariables[j];

          // Calculate similarity between variable names
          const similarity = this.calculateStringSimilarity(var1.name, var2.name);

          if (similarity > 0.9) {
            // 90% similarity threshold
            opportunities.push({
              type: 'duplicate_variable',
              variableName: var1.name,
              suggestion: `Variable is very similar to ${var2.name} (${Math.round(similarity * 100)}% similar). Consider merging them.`,
              confidence: 85,
              estimatedPerformanceGain: 30, // ms
            });
          }
        }
      }

      // Find variables without validators
      const variablesWithoutValidators = Array.from(this.variableDefinitions.values()).filter(
        (variable) => !variable.validator && variable.required
      );

      for (const variable of variablesWithoutValidators) {
        opportunities.push({
          type: 'missing_validator',
          variableName: variable.name,
          suggestion: `Required variable lacks validation. Add a validator to ensure data integrity.`,
          confidence: 75,
          estimatedPerformanceGain: 0, // No performance gain, just data integrity improvement
        });
      }

      // Sort opportunities by confidence (highest first)
      opportunities.sort((a, b) => b.confidence - a.confidence);

      this.logger.info(`Found ${opportunities.length} variable optimization opportunities`);
      return opportunities;
    } catch (error) {
      this.logger.error('Failed to find variable optimization opportunities', error);
      throw error;
    }
  }

  /**
   * Export variable definitions
   */
  public exportVariables(): VariableDefinition[] {
    try {
      this.logger.info('Exporting variable definitions');

      const variables = Array.from(this.variableDefinitions.values());

      this.logger.info(`Exported ${variables.length} variable definitions`);
      return variables;
    } catch (error) {
      this.logger.error('Failed to export variable definitions', error);
      throw error;
    }
  }

  /**
   * Import variable definitions
   */
  public importVariables(variables: VariableDefinition[]): void {
    try {
      this.logger.info(`Importing ${variables.length} variable definitions`);

      // Clear existing variables (but keep built-in ones)
      const builtInVariables = Array.from(this.variableDefinitions.values()).filter(
        (variable) => variable.isBuiltIn
      );

      this.variableDefinitions.clear();

      // Re-add built-in variables
      for (const variable of builtInVariables) {
        this.variableDefinitions.set(variable.id, variable);
      }

      // Import new variables
      for (const variable of variables) {
        try {
          if (this.validateVariable(variable)) {
            this.variableDefinitions.set(variable.id, variable);
          } else {
            this.logger.warn(`Invalid variable skipped during import: ${variable.name}`);
          }
        } catch (error) {
          this.logger.error(`Failed to import variable: ${variable.name}`, error);
        }
      }

      this.logger.info(`Imported ${variables.length} variable definitions`);
    } catch (error) {
      this.logger.error('Failed to import variable definitions', error);
      throw error;
    }
  }

  /**
   * Validate a variable definition
   */
  private validateVariable(variable: VariableDefinition): boolean {
    try {
      this.logger.info(`Validating variable: ${variable.name}`);

      // Check required fields
      if (!variable.id) {
        this.logger.warn('Variable ID is required');
        return false;
      }

      if (!variable.name) {
        this.logger.warn('Variable name is required');
        return false;
      }

      if (!variable.type) {
        this.logger.warn('Variable type is required');
        return false;
      }

      // Validate type
      const validTypes = ['string', 'number', 'boolean', 'date', 'object', 'array', 'custom'];
      if (!validTypes.includes(variable.type)) {
        this.logger.warn(`Invalid variable type: ${variable.type}`);
        return false;
      }

      // Validate resolver if present
      if (variable.resolver && typeof variable.resolver !== 'function') {
        this.logger.warn('Variable resolver must be a function');
        return false;
      }

      // Validate validator if present
      if (variable.validator && typeof variable.validator !== 'function') {
        this.logger.warn('Variable validator must be a function');
        return false;
      }

      this.logger.info(`Variable validated successfully: ${variable.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to validate variable: ${variable.name}`, error);
      return false;
    }
  }

  /**
   * Test variable resolution with sample data
   */
  public async testVariableResolution(
    variableNames: string[],
    sampleContext: Partial<VariableContext>
  ): Promise<{
    success: boolean;
    results: VariableResolutionResult;
    errors: string[];
  }> {
    try {
      this.logger.info(`Testing variable resolution for ${variableNames.length} variables`);

      // Create a test context
      const context: VariableContext = {
        issue:
          sampleContext.issue ||
          ({
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
            team: { id: 'team-1', name: 'Test Team', key: 'TEAM' },
          } as LinearIssue),
        user: sampleContext.user || {
          id: 'current-user-456',
          name: 'Current User',
          email: 'current@test.com',
        },
        environment: {
          currentDate: new Date().toISOString().split('T')[0],
          currentTime: new Date().toISOString().split('T')[1].split('.')[0],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: Date.now(),
        },
        custom: sampleContext.custom || {},
        system: {
          version: '1.0.0',
          platform: process.platform,
        },
      };

      // Validate the context
      const validationResult = this.validateContext(context);
      if (!validationResult.valid) {
        return {
          success: false,
          results: {
            variables: [],
            success: false,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            processingTime: 0,
          },
          errors: validationResult.errors,
        };
      }

      // Resolve the variables
      const results = this.resolveVariables(variableNames, context);

      return {
        success: results.success,
        results,
        errors: [],
      };
    } catch (error) {
      this.logger.error('Failed to test variable resolution', error);
      return {
        success: false,
        results: {
          variables: [],
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: [],
          processingTime: 0,
        },
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Clear any cached data (if implemented)
   */
  public clearCache(): void {
    try {
      this.logger.info('Clearing variable resolution cache');

      // In a real implementation, we'd clear any cached resolutions
      // For now, this is a placeholder

      this.logger.info('Variable resolution cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear variable resolution cache', error);
      throw error;
    }
  }

  /**
   * Batch resolve variables for performance
   */
  public async batchResolveVariables(
    variableBatches: Array<{ variables: string[]; context: VariableContext }>
  ): Promise<VariableResolutionResult[]> {
    try {
      this.logger.info(`Batch resolving variables for ${variableBatches.length} batches`);

      const results: VariableResolutionResult[] = [];

      for (const batch of variableBatches) {
        try {
          const result = this.resolveVariables(batch.variables, batch.context);
          results.push(result);
        } catch (error) {
          this.logger.error('Failed to resolve batch', error);
          results.push({
            variables: [],
            success: false,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: [],
            processingTime: 0,
          });
        }
      }

      this.logger.info(`Batch resolution completed for ${variableBatches.length} batches`);
      return results;
    } catch (error) {
      this.logger.error('Failed to batch resolve variables', error);
      throw error;
    }
  }

  /**
   * Find variables that match a pattern
   */
  public findVariables(pattern: string | RegExp): VariableDefinition[] {
    try {
      this.logger.info(`Finding variables matching pattern: ${pattern}`);

      const variables = Array.from(this.variableDefinitions.values());
      const matchingVariables: VariableDefinition[] = [];

      // Convert string pattern to RegExp if needed
      const regexPattern = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

      for (const variable of variables) {
        if (
          regexPattern.test(variable.name) ||
          (variable.description && regexPattern.test(variable.description))
        ) {
          matchingVariables.push(variable);
        }
      }

      this.logger.info(`Found ${matchingVariables.length} matching variables`);
      return matchingVariables;
    } catch (error) {
      this.logger.error(`Failed to find variables matching pattern: ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Get computed variables
   */
  public getComputedVariables(): Array<{ name: string; description?: string }> {
    try {
      this.logger.info('Getting computed variables');

      const computedVars = Array.from(this.computedVariables.entries()).map(([name, computer]) => ({
        name,
        description: `Computed variable: ${name}`,
      }));

      this.logger.info(`Found ${computedVars.length} computed variables`);
      return computedVars;
    } catch (error) {
      this.logger.error('Failed to get computed variables', error);
      throw error;
    }
  }

  /**
   * Remove a computed variable
   */
  public removeComputedVariable(name: string): boolean {
    try {
      this.logger.info(`Removing computed variable: ${name}`);

      const deleted = this.computedVariables.delete(name);
      if (deleted) {
        this.logger.info(`Computed variable removed successfully: ${name}`);
      } else {
        this.logger.warn(`Computed variable not found: ${name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove computed variable: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a variable resolver function for repeated use
   */
  public createVariableResolver(
    context: VariableContext
  ): (variableName: string) => ResolvedVariable | null {
    try {
      this.logger.info('Creating variable resolver function');

      return (variableName: string) => {
        return this.resolveVariable(variableName, context);
      };
    } catch (error) {
      this.logger.error('Failed to create variable resolver function', error);
      throw error;
    }
  }
}
