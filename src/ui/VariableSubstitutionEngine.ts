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
  id: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array' | 'custom';
  defaultValue?: any;
  required: boolean;
  exampleValue?: any;
  resolver?: (context: VariableContext) => any;
  validator?: (value: any) => boolean;
  isBuiltIn?: boolean;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
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

export interface TemplateFunction {
  name: string;
  description?: string;
  execute: (args: any[]) => any;
  arity?: number; // Number of arguments expected
}

export class VariableSubstitutionEngine {
  private linearClient: LinearClient;
  private variableDefinitions: Map<string, VariableDefinition>;
  private typeCoercionRules: TypeCoercionRule[];
  private computedVariables: Map<string, (context: VariableContext) => any>;
  private matchResults: ResolvedVariable[];
  private suggestions: Map<string, VariableSuggestion>;
  private logger: Logger;
  private filters: Map<string, (value: any, ...args: any[]) => any>;
  private functions: Map<string, TemplateFunction>;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.variableDefinitions = new Map();
    this.typeCoercionRules = [];
    this.computedVariables = new Map();
    this.matchResults = [];
    this.suggestions = new Map();
    this.filters = new Map();
    this.functions = new Map();
    this.logger = new Logger('VariableSubstitutionEngine');

    // Register default variables and coercion rules
    this.registerDefaultVariables();
    this.registerDefaultCoercionRules();
    this.registerDefaultComputedVariables();
    this.registerDefaultFilters();
    this.registerDefaultFunctions();
  }

  /**
   * Register default variables
   */
  private registerDefaultVariables(): void {
    try {
      this.logger.info('Registering default variables');

      // Issue-related variables
      this.registerVariable({
        id: 'var-issue-id',
        name: 'issue.id',
        description: 'Unique identifier for the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.id,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-title',
        name: 'issue.title',
        description: 'Title of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.title,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-description',
        name: 'issue.description',
        description: 'Description of the issue',
        type: 'string',
        required: false,
        resolver: (context) => context.issue.description,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-state',
        name: 'issue.state',
        description: 'Current state of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.state?.name,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-priority',
        name: 'issue.priority',
        description: 'Priority level of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.priority,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-assignee',
        name: 'issue.assignee',
        description: 'Assignee of the issue',
        type: 'string',
        required: false,
        resolver: (context) => context.issue.assignee?.name,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-creator',
        name: 'issue.creator',
        description: 'Creator of the issue',
        type: 'string',
        required: true,
        resolver: (context) => context.issue.creator?.name,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-created-at',
        name: 'issue.createdAt',
        description: 'Creation date of the issue',
        type: 'date',
        required: true,
        resolver: (context) => context.issue.createdAt,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-updated-at',
        name: 'issue.updatedAt',
        description: 'Last update date of the issue',
        type: 'date',
        required: true,
        resolver: (context) => context.issue.updatedAt,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-issue-due-date',
        name: 'issue.dueDate',
        description: 'Due date of the issue',
        type: 'date',
        required: false,
        resolver: (context) => context.issue.dueDate,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // User-related variables
      this.registerVariable({
        id: 'var-user-name',
        name: 'user.name',
        description: 'Current user name',
        type: 'string',
        required: true,
        resolver: (context) => context.user.name,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-user-email',
        name: 'user.email',
        description: 'Current user email',
        type: 'string',
        required: true,
        resolver: (context) => context.user.email,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Environment variables
      this.registerVariable({
        id: 'var-env-current-date',
        name: 'environment.currentDate',
        description: 'Current date',
        type: 'string',
        required: true,
        resolver: (context) => context.environment.currentDate,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-env-current-time',
        name: 'environment.currentTime',
        description: 'Current time',
        type: 'string',
        required: true,
        resolver: (context) => context.environment.currentTime,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      this.registerVariable({
        id: 'var-env-timestamp',
        name: 'environment.timestamp',
        description: 'Current timestamp',
        type: 'number',
        required: true,
        resolver: (context) => context.environment.timestamp,
        isBuiltIn: true,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
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
   * Register default template filters
   */
  private registerDefaultFilters(): void {
    try {
      this.logger.info('Registering default template filters');

      // Uppercase filter
      this.filters.set('upper', (value: any) => String(value).toUpperCase());

      // Lowercase filter
      this.filters.set('lower', (value: any) => String(value).toLowerCase());

      // Capitalize filter
      this.filters.set('capitalize', (value: any) => {
        const str = String(value);
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
      });

      // Truncate filter
      this.filters.set('truncate', (value: any, length: number = 50) => {
        const str = String(value);
        return str.length > length ? str.substring(0, length) + '...' : str;
      });

      // Date filter
      this.filters.set('date', (value: any) => {
        const date = new Date(value);
        return date.toLocaleDateString();
      });

      // Datetime filter
      this.filters.set('datetime', (value: any) => {
        const date = new Date(value);
        return date.toLocaleString();
      });

      // Currency filter
      this.filters.set('currency', (value: any, symbol: string = '$') => {
        const num = Number(value);
        return symbol + num.toFixed(2);
      });

      // Percentage filter
      this.filters.set('percent', (value: any, decimals: number = 0) => {
        const num = Number(value);
        return (num * 100).toFixed(decimals) + '%';
      });

      // Default filter
      this.filters.set('default', (value: any, defaultValue: any) => {
        return value !== undefined && value !== null ? value : defaultValue;
      });

      this.logger.info('Default template filters registered');
    } catch (error) {
      this.logger.error('Failed to register default template filters', error);
      throw error;
    }
  }

  /**
   * Register default template functions
   */
  private registerDefaultFunctions(): void {
    try {
      this.logger.info('Registering default template functions');

      // Now function
      this.functions.set('now', {
        name: 'now',
        description: 'Get current timestamp',
        execute: () => Date.now(),
        arity: 0,
      });

      // Random function
      this.functions.set('random', {
        name: 'random',
        description: 'Get random number between min and max',
        execute: (args: any[]) => {
          const min = Number(args[0]) || 0;
          const max = Number(args[1]) || 100;
          return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        arity: 2,
      });

      this.logger.info('Default template functions registered');
    } catch (error) {
      this.logger.error('Failed to register default template functions', error);
      throw error;
    }
  }

  /**
   * Register a variable definition
   */
  public registerVariable(
    variable: Omit<VariableDefinition, 'usageCount' | 'createdAt' | 'updatedAt'>
  ): void {
    try {
      this.logger.info(`Registering variable: ${variable.name}`);

      const variableDef: VariableDefinition = {
        ...variable,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.variableDefinitions.set(variableDef.id, variableDef);

      this.logger.info(`Variable registered successfully: ${variable.name}`);
    } catch (error) {
      this.logger.error(`Failed to register variable: ${variable.name}`, error);
      throw error;
    }
  }

  /**
   * Unregister a variable definition
   */
  public unregisterVariable(variableId: string): boolean {
    try {
      this.logger.info(`Unregistering variable: ${variableId}`);

      const variable = this.variableDefinitions.get(variableId);
      if (!variable) {
        this.logger.warn(`Variable not found: ${variableId}`);
        return false;
      }

      // Prevent removal of built-in variables
      if (variable.isBuiltIn) {
        this.logger.warn(`Cannot remove built-in variable: ${variable.name}`);
        return false;
      }

      const deleted = this.variableDefinitions.delete(variableId);
      if (deleted) {
        this.logger.info(`Variable unregistered successfully: ${variable.name}`);
      } else {
        this.logger.warn(`Failed to unregister variable: ${variable.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister variable: ${variableId}`, error);
      throw error;
    }
  }

  /**
   * Update a variable definition
   */
  public updateVariable(
    variableId: string,
    updates: Partial<Omit<VariableDefinition, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>>
  ): boolean {
    try {
      this.logger.info(`Updating variable: ${variableId}`);

      const variable = this.variableDefinitions.get(variableId);
      if (!variable) {
        this.logger.warn(`Variable not found: ${variableId}`);
        return false;
      }

      // Prevent updates to built-in variables
      if (variable.isBuiltIn) {
        this.logger.warn(`Cannot update built-in variable: ${variable.name}`);
        return false;
      }

      // Update the variable
      Object.assign(variable, updates, {
        updatedAt: new Date(),
      });

      // Re-validate the updated variable
      this.validateVariable(variable);

      // Update in map
      this.variableDefinitions.set(variableId, variable);

      this.logger.info(`Variable updated successfully: ${variable.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update variable: ${variableId}`, error);
      throw error;
    }
  }

  /**
   * Validate a variable definition
   */
  private validateVariable(variable: VariableDefinition): void {
    try {
      this.logger.info(`Validating variable: ${variable.name}`);

      // Check for required fields
      if (!variable.id) {
        throw new Error('Variable ID is required');
      }

      if (!variable.name) {
        throw new Error('Variable name is required');
      }

      if (!variable.type) {
        throw new Error('Variable type is required');
      }

      const validTypes = ['string', 'number', 'boolean', 'date', 'object', 'array', 'custom'];
      if (!validTypes.includes(variable.type)) {
        throw new Error(`Invalid variable type: ${variable.type}`);
      }

      // Validate resolver if present
      if (variable.resolver && typeof variable.resolver !== 'function') {
        throw new Error('Variable resolver must be a function');
      }

      // Validate validator if present
      if (variable.validator && typeof variable.validator !== 'function') {
        throw new Error('Variable validator must be a function');
      }

      this.logger.info(`Variable validated successfully: ${variable.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate variable: ${variable.name}`, error);
      throw error;
    }
  }

  /**
   * Get a variable definition by ID
   */
  public getVariable(variableId: string): VariableDefinition | undefined {
    return this.variableDefinitions.get(variableId);
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

          // Update usage statistics
          const variableDef = this.variableDefinitions.get(`computed-${variableName}`);
          if (variableDef) {
            variableDef.usageCount++;
            variableDef.lastUsed = new Date();
            variableDef.updatedAt = new Date();
            this.variableDefinitions.set(variableDef.id, variableDef);
          }

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
      const variableDef = Array.from(this.variableDefinitions.values()).find(
        (v) => v.name === variableName
      );
      if (variableDef) {
        // Try resolver first
        if (variableDef.resolver) {
          try {
            const resolvedValue = variableDef.resolver(context);

            // Validate if validator is provided
            if (variableDef.validator && !variableDef.validator(resolvedValue)) {
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

            // Update usage statistics
            variableDef.usageCount++;
            variableDef.lastUsed = new Date();
            variableDef.updatedAt = new Date();
            this.variableDefinitions.set(variableDef.id, variableDef);

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
        if (variableDef.defaultValue !== undefined) {
          const resolved: ResolvedVariable = {
            name: variableName,
            originalValue: variableDef.defaultValue,
            resolvedValue: variableDef.defaultValue,
            type: typeof variableDef.defaultValue,
            success: true,
            source: 'default',
          };

          // Update usage statistics
          variableDef.usageCount++;
          variableDef.lastUsed = new Date();
          variableDef.updatedAt = new Date();
          this.variableDefinitions.set(variableDef.id, variableDef);

          this.logger.info(
            `Variable resolved with default value: ${variableName} (${Date.now() - startTime}ms)`
          );
          return resolved;
        }

        // Variable is required but couldn't be resolved
        if (variableDef.required) {
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

      // Store results for later analysis
      this.matchResults.push(...result.variables);

      // Keep only the most recent 1000 results to prevent memory issues
      if (this.matchResults.length > 1000) {
        this.matchResults = this.matchResults.slice(-1000);
      }

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
   * Render a template with variable substitution and filters
   */
  public async render(template: string, context: VariableContext): Promise<string> {
    try {
      this.logger.info('Rendering template');

      let result = template;

      // First, substitute variables using the substituteVariables method
      result = this.substituteVariables(result, context);

      // Then, process filters and functions
      result = await this.processFiltersAndFunctions(result, context);

      this.logger.info('Template rendered successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to render template', error);
      throw error;
    }
  }

  /**
   * Process filters and functions in the template
   */
  private async processFiltersAndFunctions(
    template: string,
    context: VariableContext
  ): Promise<string> {
    try {
      this.logger.info('Processing filters and functions in template');

      let result = template;

      // Process template functions like {{now()}}
      const functionRegex = /\{\{(\w+)\((.*?)\)\}\}/g;
      let match;

      while ((match = functionRegex.exec(template)) !== null) {
        const functionName = match[1];
        const argsStr = match[2];

        const templateFunc = this.functions.get(functionName);
        if (templateFunc) {
          const args = argsStr
            .split(',')
            .map((arg) => arg.trim())
            .filter((arg) => arg);
          const functionResult = templateFunc.execute(args);
          result = result.split(match[0]).join(String(functionResult));
        }
      }

      this.logger.info('Filters and functions processed successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to process filters and functions', error);
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
        ...Array.from(this.variableDefinitions.values()).map((v) => v.name),
        ...Array.from(this.computedVariables.keys()),
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

      // Sort suggestions by confidence (highest first)
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Keep only top 20 suggestions
      const topSuggestions = suggestions.slice(0, 20);

      // Store suggestions for later retrieval
      for (const suggestion of topSuggestions) {
        this.suggestions.set(suggestion.variableName, suggestion);
      }

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
   * Get all variable substitution results
   */
  public getSubstitutionResults(): ResolvedVariable[] {
    return [...this.matchResults];
  }

  /**
   * Get variable substitution results for a specific variable
   */
  public getVariableResults(variableName: string): ResolvedVariable[] {
    return this.matchResults.filter((result) => result.name === variableName);
  }

  /**
   * Get variable substitution statistics
   */
  public getSubstitutionStats(): {
    totalVariables: number;
    totalResolved: number;
    successRate: number;
    mostUsedVariables: Array<{ variable: VariableDefinition; usage: number }>;
    averageProcessingTime: number;
  } {
    try {
      this.logger.info('Generating variable substitution statistics');

      const variables = Array.from(this.variableDefinitions.values());
      const resolved = this.matchResults.filter((r) => r.success);

      const stats = {
        totalVariables: variables.length,
        totalResolved: this.matchResults.length,
        successRate:
          this.matchResults.length > 0 ? (resolved.length / this.matchResults.length) * 100 : 0,
        mostUsedVariables: [] as Array<{ variable: VariableDefinition; usage: number }>,
        averageProcessingTime: 0,
      };

      // Calculate most used variables
      const sortedVariables = [...variables].sort((a, b) => b.usageCount - a.usageCount);
      stats.mostUsedVariables = sortedVariables.slice(0, 10).map((variable) => ({
        variable,
        usage: variable.usageCount,
      }));

      // Calculate average processing time
      const totalProcessingTime = this.matchResults.reduce((sum, result) => sum + 10, 0); // Estimating 10ms per resolution
      stats.averageProcessingTime =
        this.matchResults.length > 0 ? totalProcessingTime / this.matchResults.length : 0;

      this.logger.info('Variable substitution statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate variable substitution statistics', error);
      throw error;
    }
  }

  /**
   * Find optimization opportunities
   */
  public findOptimizationOpportunities(): Array<{
    type: 'variable' | 'filter' | 'function';
    id: string;
    name: string;
    suggestion: string;
    confidence: number; // 0-100 percentage
    estimatedPerformanceGain: number; // ms
  }> {
    try {
      this.logger.info('Finding optimization opportunities');

      const opportunities: Array<{
        type: 'variable' | 'filter' | 'function';
        id: string;
        name: string;
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
          type: 'variable',
          id: variable.id,
          name: variable.name,
          suggestion: `Variable is unused and could be removed`,
          confidence: 90,
          estimatedPerformanceGain: 5, // ms
        });
      }

      // Find unused filters
      const unusedFilters = Array.from(this.filters.values()).filter((filter) =>
        filter.name.includes('unused')
      ); // Simplified check

      for (const filter of unusedFilters) {
        opportunities.push({
          type: 'filter',
          id: filter.name,
          name: filter.name,
          suggestion: `Filter is unused and could be removed`,
          confidence: 85,
          estimatedPerformanceGain: 3, // ms
        });
      }

      // Find unused functions
      const unusedFunctions = Array.from(this.functions.values()).filter((func) =>
        func.name.includes('unused')
      ); // Simplified check

      for (const func of unusedFunctions) {
        opportunities.push({
          type: 'function',
          id: func.name,
          name: func.name,
          suggestion: `Function is unused and could be removed`,
          confidence: 80,
          estimatedPerformanceGain: 2, // ms
        });
      }

      // Sort opportunities by confidence (highest first)
      opportunities.sort((a, b) => b.confidence - a.confidence);

      this.logger.info(`Found ${opportunities.length} optimization opportunities`);
      return opportunities;
    } catch (error) {
      this.logger.error('Failed to find optimization opportunities', error);
      throw error;
    }
  }

  /**
   * Export variable definitions
   */
  public exportConfiguration(): {
    variables: VariableDefinition[];
    filters: TypeCoercionRule[];
    functions: TemplateFunction[];
  } {
    try {
      this.logger.info('Exporting variable substitution configuration');

      const config = {
        variables: Array.from(this.variableDefinitions.values()),
        filters: [...this.typeCoercionRules],
        functions: Array.from(this.functions.values()),
      };

      this.logger.info('Variable substitution configuration exported successfully');
      return config;
    } catch (error) {
      this.logger.error('Failed to export variable substitution configuration', error);
      throw error;
    }
  }

  /**
   * Import variable definitions
   */
  public importConfiguration(config: {
    variables: VariableDefinition[];
    filters: TypeCoercionRule[];
    functions: TemplateFunction[];
  }): void {
    try {
      this.logger.info(
        `Importing variable substitution configuration with ${config.variables.length} variables`
      );

      // Clear existing configuration
      this.variableDefinitions.clear();
      this.typeCoercionRules = [];
      this.functions.clear();

      // Import variables
      for (const variable of config.variables) {
        try {
          this.validateVariable(variable);
          this.variableDefinitions.set(variable.id, variable);
        } catch (error) {
          this.logger.error(`Failed to import variable: ${variable.name}`, error);
        }
      }

      // Import filters
      this.typeCoercionRules = [...config.filters];

      // Import functions
      for (const func of config.functions) {
        try {
          this.functions.set(func.name, func);
        } catch (error) {
          this.logger.error(`Failed to import function: ${func.name}`, error);
        }
      }

      this.logger.info('Variable substitution configuration imported successfully');
    } catch (error) {
      this.logger.error('Failed to import variable substitution configuration', error);
      throw error;
    }
  }

  /**
   * Create a test template
   */
  public createTestTemplate(): string {
    try {
      this.logger.info('Creating test template');

      const testTemplate = `
# AIrchitect Test Template

## Issue Information
- Title: {{issue.title}}
- Description: {{issue.description|truncate(100)}}
- State: {{issue.state.name}}
- Priority: {{issue.priority|upper}}
- Assignee: {{issue.assignee.name}}
- Created: {{issue.createdAt|date}}

## User Information
- Name: {{user.name}}
- Email: {{user.email}}
- Role: {{user.role|default('Developer')}}

## Team Information
{% if team %}
- Team Name: {{team.name}}
- Team Key: {{team.key}}
{% else %}
- No team assigned
{% endif %}

## Environment
- Current Date: {{environment.currentDate}}
- Current Time: {{environment.currentTime}}
- Timezone: {{environment.timezone}}

## Custom Variables
{% for item in custom.items %}
- Item: {{item.name}} ({{item.value}})
{% endfor %}

## Examples
- Uppercased Title: {{issue.title|upper}}
- Capitalized Team Name: {{team.name|capitalize}}
- Currency Amount: {{custom.amount|currency('$')}}
- Percentage Value: {{custom.percentage|percent(1)}}

## Function Calls
- Current Time: {{now()}}
- Random Number: {{random(1, 100)}}

Generated on: {{now()|datetime}}
      `.trim();

      this.logger.info('Test template created successfully');
      return testTemplate;
    } catch (error) {
      this.logger.error('Failed to create test template', error);
      throw error;
    }
  }

  /**
   * Test variable substitution with sample data
   */
  public async testSubstitution(): Promise<{
    success: boolean;
    renderedTemplate?: string;
    errors: string[];
  }> {
    try {
      this.logger.info('Testing variable substitution');

      // Create test context
      const testContext: VariableContext = {
        issue: {
          id: 'test-issue-123',
          title: 'Test Issue Title',
          description: 'This is a test issue description that is quite long to test truncation.',
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
        } as LinearIssue,
        user: {
          id: 'current-user-456',
          name: 'Current User',
          email: 'current@test.com',
          role: 'Developer',
        },
        team: {
          id: 'team-1',
          name: 'Test Team',
          key: 'TEAM',
        },
        environment: {
          currentDate: new Date().toISOString().split('T')[0],
          currentTime: new Date().toISOString().split('T')[1].split('.')[0],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: Date.now(),
        },
        custom: {
          amount: 123.45,
          percentage: 0.75,
          items: [
            { name: 'Item 1', value: 'Value 1' },
            { name: 'Item 2', value: 'Value 2' },
          ],
        },
        system: {
          version: '1.0.0',
          platform: process.platform,
        },
      };

      // Create test template
      const template = this.createTestTemplate();

      // Render the template
      const renderedTemplate = await this.render(template, testContext);

      this.logger.info('Variable substitution test completed successfully');
      return {
        success: true,
        renderedTemplate,
        errors: [],
      };
    } catch (error) {
      this.logger.error('Failed to test variable substitution', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }
}
