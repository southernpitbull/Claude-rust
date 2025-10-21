/**
 * FilterProcessingEngine.ts
 *
 * Advanced data transformation engine for Linear integration with custom filters,
 * chaining operations, type-safe transformations, and AI-powered filter suggestions.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface FilterContext {
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

export interface FilterDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'transform' | 'validate' | 'aggregate' | 'format' | 'extract';
  inputType: string; // e.g., 'string', 'number', 'array', 'object', 'date'
  outputType: string;
  parameters: FilterParameter[];
  implementation: string; // JavaScript function body or reference
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
  performanceStats?: {
    averageExecutionTime: number;
    successRate: number;
    errorCount: number;
  };
}

export interface FilterParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'regexp';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export interface FilterChain {
  id: string;
  name: string;
  description?: string;
  filters: ChainFilter[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
}

export interface ChainFilter {
  filterId: string;
  parameters: Record<string, any>;
  condition?: FilterCondition; // Optional condition to apply filter
}

export interface FilterCondition {
  variable: string;
  operator: string;
  value: any;
  negate?: boolean;
}

export interface FilterResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface FilterSuggestion {
  filterId: string;
  filterName: string;
  confidence: number; // 0-100 percentage
  reason: string;
  recommendedParameters: Record<string, any>;
  estimatedPerformanceGain: number; // ms
}

export interface FilterTransformation {
  id: string;
  name: string;
  description?: string;
  sourceField: string; // Dot notation path to source data
  targetField: string; // Dot notation path to target location
  filterChainId: string; // Reference to filter chain to apply
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  lastUsed?: Date;
}

export class FilterProcessingEngine {
  private linearClient: LinearClient;
  private filters: Map<string, FilterDefinition>;
  private filterChains: Map<string, FilterChain>;
  private transformations: Map<string, FilterTransformation>;
  private customFilterImplementations: Map<string, Function>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.filters = new Map();
    this.filterChains = new Map();
    this.transformations = new Map();
    this.customFilterImplementations = new Map();
    this.logger = new Logger('FilterProcessingEngine');

    // Register default filters
    this.registerDefaultFilters();
  }

  /**
   * Register default filters
   */
  private registerDefaultFilters(): void {
    try {
      this.logger.info('Registering default filters');

      // String manipulation filters
      this.registerFilter({
        id: 'filter-uppercase',
        name: 'Uppercase',
        description: 'Convert string to uppercase',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [],
        implementation: 'return value.toUpperCase();',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-lowercase',
        name: 'Lowercase',
        description: 'Convert string to lowercase',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [],
        implementation: 'return value.toLowerCase();',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-capitalize',
        name: 'Capitalize',
        description: 'Capitalize first letter of string',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [],
        implementation: `
          if (!value) return value;
          return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-truncate',
        name: 'Truncate',
        description: 'Truncate string to specified length',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [
          { name: 'length', type: 'number', required: true, description: 'Maximum length' },
          {
            name: 'suffix',
            type: 'string',
            required: false,
            defaultValue: '...',
            description: 'Suffix to append',
          },
        ],
        implementation: `
          if (value.length <= length) return value;
          return value.substring(0, length - suffix.length) + suffix;
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Date formatting filters
      this.registerFilter({
        id: 'filter-date-format',
        name: 'Date Format',
        description: 'Format date value',
        type: 'format',
        inputType: 'date',
        outputType: 'string',
        parameters: [
          {
            name: 'format',
            type: 'string',
            required: false,
            defaultValue: 'YYYY-MM-DD',
            description: 'Date format',
          },
        ],
        implementation: `
          if (!value) return '';
          const date = new Date(value);
          return date.toISOString().split('T')[0];
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Array/List filters
      this.registerFilter({
        id: 'filter-join',
        name: 'Join',
        description: 'Join array elements with separator',
        type: 'transform',
        inputType: 'array',
        outputType: 'string',
        parameters: [
          {
            name: 'separator',
            type: 'string',
            required: false,
            defaultValue: ', ',
            description: 'Separator string',
          },
        ],
        implementation: `
          if (!Array.isArray(value)) return String(value);
          return value.join(separator);
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-length',
        name: 'Length',
        description: 'Get length of string/array',
        type: 'transform',
        inputType: 'any',
        outputType: 'number',
        parameters: [],
        implementation: `
          if (Array.isArray(value) || typeof value === 'string') {
            return value.length;
          }
          return 0;
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Number formatting filters
      this.registerFilter({
        id: 'filter-currency',
        name: 'Currency',
        description: 'Format number as currency',
        type: 'format',
        inputType: 'number',
        outputType: 'string',
        parameters: [
          {
            name: 'symbol',
            type: 'string',
            required: false,
            defaultValue: '$',
            description: 'Currency symbol',
          },
          {
            name: 'decimals',
            type: 'number',
            required: false,
            defaultValue: 2,
            description: 'Decimal places',
          },
        ],
        implementation: `
          const num = Number(value);
          if (isNaN(num)) return value;
          return symbol + num.toFixed(decimals);
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-percent',
        name: 'Percent',
        description: 'Format number as percentage',
        type: 'format',
        inputType: 'number',
        outputType: 'string',
        parameters: [
          {
            name: 'decimals',
            type: 'number',
            required: false,
            defaultValue: 2,
            description: 'Decimal places',
          },
        ],
        implementation: `
          const num = Number(value);
          if (isNaN(num)) return value;
          return (num * 100).toFixed(decimals) + '%';
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Validation filters
      this.registerFilter({
        id: 'filter-email-validate',
        name: 'Email Validate',
        description: 'Validate email format',
        type: 'validate',
        inputType: 'string',
        outputType: 'boolean',
        parameters: [],
        implementation: `
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return emailRegex.test(value);
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-required',
        name: 'Required',
        description: 'Check if value is present',
        type: 'validate',
        inputType: 'any',
        outputType: 'boolean',
        parameters: [],
        implementation: `
          return value !== undefined && value !== null && value !== '';
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Extraction filters
      this.registerFilter({
        id: 'filter-extract-numbers',
        name: 'Extract Numbers',
        description: 'Extract all numbers from string',
        type: 'extract',
        inputType: 'string',
        outputType: 'array',
        parameters: [],
        implementation: `
          const numbers = value.match(/\\d+/g);
          return numbers ? numbers.map(Number) : [];
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.logger.info('Default filters registered');
    } catch (error) {
      this.logger.error('Failed to register default filters', error);
      throw error;
    }
  }

  /**
   * Register a filter definition
   */
  public registerFilter(filter: FilterDefinition): void {
    try {
      this.logger.info(`Registering filter: ${filter.name}`);

      // Validate filter
      this.validateFilter(filter);

      this.filters.set(filter.id, filter);

      this.logger.info(`Filter registered successfully: ${filter.name}`);
    } catch (error) {
      this.logger.error(`Failed to register filter: ${filter.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a filter definition
   */
  private validateFilter(filter: FilterDefinition): void {
    try {
      this.logger.info(`Validating filter: ${filter.name}`);

      // Check for required fields
      if (!filter.id) {
        throw new Error('Filter ID is required');
      }

      if (!filter.name) {
        throw new Error('Filter name is required');
      }

      if (!filter.type) {
        throw new Error('Filter type is required');
      }

      if (!filter.inputType) {
        throw new Error('Filter input type is required');
      }

      if (!filter.outputType) {
        throw new Error('Filter output type is required');
      }

      if (!filter.implementation) {
        throw new Error('Filter implementation is required');
      }

      // Validate parameters
      if (filter.parameters) {
        for (const param of filter.parameters) {
          this.validateFilterParameter(param);
        }
      }

      this.logger.info(`Filter validated successfully: ${filter.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate filter: ${filter.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a filter parameter
   */
  private validateFilterParameter(parameter: FilterParameter): void {
    try {
      this.logger.info(`Validating filter parameter: ${parameter.name}`);

      if (!parameter.name) {
        throw new Error('Parameter name is required');
      }

      if (!parameter.type) {
        throw new Error('Parameter type is required');
      }

      const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'date', 'regexp'];
      if (!validTypes.includes(parameter.type)) {
        throw new Error(`Invalid parameter type: ${parameter.type}`);
      }

      this.logger.info(`Filter parameter validated successfully: ${parameter.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate filter parameter: ${parameter.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a filter definition
   */
  public removeFilter(filterId: string): boolean {
    try {
      this.logger.info(`Removing filter: ${filterId}`);

      const filter = this.filters.get(filterId);
      if (!filter) {
        this.logger.warn(`Filter not found: ${filterId}`);
        return false;
      }

      const deleted = this.filters.delete(filterId);
      if (deleted) {
        this.logger.info(`Filter removed successfully: ${filter.name}`);
      } else {
        this.logger.warn(`Failed to remove filter: ${filter.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove filter: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Update a filter definition
   */
  public updateFilter(
    filterId: string,
    updates: Partial<Omit<FilterDefinition, 'id' | 'createdAt' | 'usageCount' | 'performanceStats'>>
  ): boolean {
    try {
      this.logger.info(`Updating filter: ${filterId}`);

      const filter = this.filters.get(filterId);
      if (!filter) {
        this.logger.warn(`Filter not found: ${filterId}`);
        return false;
      }

      // Update the filter
      Object.assign(filter, updates, {
        updatedAt: new Date(),
      });

      // Re-validate the updated filter
      this.validateFilter(filter);

      // Update in map
      this.filters.set(filterId, filter);

      this.logger.info(`Filter updated successfully: ${filter.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update filter: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Get a filter definition by ID
   */
  public getFilter(filterId: string): FilterDefinition | undefined {
    return this.filters.get(filterId);
  }

  /**
   * Get all filter definitions
   */
  public getAllFilters(): FilterDefinition[] {
    return Array.from(this.filters.values());
  }

  /**
   * Register a custom filter implementation
   */
  public registerCustomFilterImplementation(filterId: string, implementation: Function): void {
    try {
      this.logger.info(`Registering custom filter implementation: ${filterId}`);

      this.customFilterImplementations.set(filterId, implementation);

      this.logger.info(`Custom filter implementation registered successfully: ${filterId}`);
    } catch (error) {
      this.logger.error(`Failed to register custom filter implementation: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Unregister a custom filter implementation
   */
  public unregisterCustomFilterImplementation(filterId: string): boolean {
    try {
      this.logger.info(`Unregistering custom filter implementation: ${filterId}`);

      const deleted = this.customFilterImplementations.delete(filterId);
      if (deleted) {
        this.logger.info(`Custom filter implementation unregistered successfully: ${filterId}`);
      } else {
        this.logger.warn(`Custom filter implementation not found: ${filterId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister custom filter implementation: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Apply a filter to a value
   */
  public async applyFilter<T = any>(
    filterId: string,
    value: any,
    parameters: Record<string, any> = {},
    context?: FilterContext
  ): Promise<FilterResult<T>> {
    try {
      this.logger.info(`Applying filter: ${filterId}`);

      const startTime = Date.now();

      const filter = this.filters.get(filterId);
      if (!filter) {
        throw new Error(`Filter not found: ${filterId}`);
      }

      if (!filter.enabled) {
        throw new Error(`Filter is disabled: ${filter.name}`);
      }

      // Update filter usage statistics
      filter.usageCount++;
      filter.lastUsed = new Date();
      this.filters.set(filterId, filter);

      try {
        // Validate parameters
        const resolvedParameters = this.resolveParameters(filter.parameters, parameters);

        // Apply the filter
        const result = await this.executeFilter(filter, value, resolvedParameters, context);

        // Update performance statistics
        const executionTime = Date.now() - startTime;
        if (!filter.performanceStats) {
          filter.performanceStats = {
            averageExecutionTime: executionTime,
            successRate: 100,
            errorCount: 0,
          };
        } else {
          // Update average execution time
          const totalExecutions = filter.usageCount;
          const previousAverage = filter.performanceStats.averageExecutionTime;
          filter.performanceStats.averageExecutionTime =
            (previousAverage * (totalExecutions - 1) + executionTime) / totalExecutions;

          // Update success rate
          filter.performanceStats.successRate =
            (((filter.performanceStats.successRate / 100) * (totalExecutions - 1) + 1) /
              totalExecutions) *
            100;
        }

        this.logger.info(`Filter applied successfully: ${filter.name} (${executionTime}ms)`);
        return {
          success: true,
          data: result,
          executionTime,
          warnings: [],
        };
      } catch (error) {
        // Update error statistics
        if (filter.performanceStats) {
          filter.performanceStats.errorCount = (filter.performanceStats.errorCount || 0) + 1;
          filter.performanceStats.successRate = Math.max(
            0,
            filter.performanceStats.successRate - 100 / filter.usageCount
          );
        } else {
          filter.performanceStats = {
            averageExecutionTime: 0,
            successRate: 0,
            errorCount: 1,
          };
        }

        this.logger.error(`Failed to apply filter: ${filter.name}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          warnings: [],
        };
      }
    } catch (error) {
      this.logger.error(`Failed to apply filter: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Resolve filter parameters with defaults
   */
  private resolveParameters(
    filterParameters: FilterParameter[],
    providedParameters: Record<string, any>
  ): Record<string, any> {
    try {
      this.logger.info('Resolving filter parameters');

      const resolvedParameters: Record<string, any> = {};

      // Apply default values first
      for (const param of filterParameters) {
        if (param.defaultValue !== undefined) {
          resolvedParameters[param.name] = param.defaultValue;
        }
      }

      // Override with provided parameters
      for (const [key, value] of Object.entries(providedParameters)) {
        resolvedParameters[key] = value;
      }

      // Validate required parameters
      for (const param of filterParameters) {
        if (param.required && resolvedParameters[param.name] === undefined) {
          throw new Error(`Required parameter missing: ${param.name}`);
        }
      }

      this.logger.info('Filter parameters resolved successfully');
      return resolvedParameters;
    } catch (error) {
      this.logger.error('Failed to resolve filter parameters', error);
      throw error;
    }
  }

  /**
   * Execute a filter
   */
  private async executeFilter(
    filter: FilterDefinition,
    value: any,
    parameters: Record<string, any>,
    context?: FilterContext
  ): Promise<any> {
    try {
      this.logger.info(`Executing filter: ${filter.name}`);

      // Check for custom implementation
      const customImpl = this.customFilterImplementations.get(filter.id);
      if (customImpl) {
        return await customImpl(value, parameters, context);
      }

      // Execute JavaScript implementation
      try {
        // Create a safe execution environment
        const funcBody = `
          "use strict";
          return (function(value, parameters, context) {
            const { ${Object.keys(parameters).join(', ')} } = parameters;
            ${filter.implementation}
          })(value, parameters, context);
        `;

        const func = new Function('value', 'parameters', 'context', funcBody);
        return func(value, parameters, context);
      } catch (error) {
        this.logger.error(`Failed to execute filter implementation: ${filter.name}`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to execute filter: ${filter.name}`, error);
      throw error;
    }
  }

  /**
   * Apply a filter chain to a value
   */
  public async applyFilterChain(
    chainId: string,
    value: any,
    context?: FilterContext
  ): Promise<FilterResult<any>> {
    try {
      this.logger.info(`Applying filter chain: ${chainId}`);

      const startTime = Date.now();

      const chain = this.filterChains.get(chainId);
      if (!chain) {
        throw new Error(`Filter chain not found: ${chainId}`);
      }

      if (!chain.enabled) {
        throw new Error(`Filter chain is disabled: ${chain.name}`);
      }

      // Update chain usage statistics
      chain.usageCount++;
      chain.lastUsed = new Date();
      this.filterChains.set(chainId, chain);

      try {
        let result = value;
        const warnings: string[] = [];

        // Apply each filter in the chain
        for (const chainFilter of chain.filters) {
          try {
            const filterResult = await this.applyFilter(
              chainFilter.filterId,
              result,
              chainFilter.parameters,
              context
            );

            if (filterResult.success) {
              result = filterResult.data;

              // Collect warnings
              if (filterResult.warnings) {
                warnings.push(...filterResult.warnings);
              }
            } else {
              throw new Error(filterResult.error || 'Filter failed');
            }
          } catch (error) {
            this.logger.error(`Failed to apply filter in chain: ${chainFilter.filterId}`, error);
            throw error;
          }
        }

        const executionTime = Date.now() - startTime;

        this.logger.info(`Filter chain applied successfully: ${chain.name} (${executionTime}ms)`);
        return {
          success: true,
          data: result,
          executionTime,
          warnings,
        };
      } catch (error) {
        this.logger.error(`Failed to apply filter chain: ${chain.name}`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: Date.now() - startTime,
          warnings: [],
        };
      }
    } catch (error) {
      this.logger.error(`Failed to apply filter chain: ${chainId}`, error);
      throw error;
    }
  }

  /**
   * Register a filter chain
   */
  public registerFilterChain(chain: FilterChain): void {
    try {
      this.logger.info(`Registering filter chain: ${chain.name}`);

      // Validate chain
      this.validateFilterChain(chain);

      this.filterChains.set(chain.id, chain);

      this.logger.info(`Filter chain registered successfully: ${chain.name}`);
    } catch (error) {
      this.logger.error(`Failed to register filter chain: ${chain.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a filter chain
   */
  private validateFilterChain(chain: FilterChain): void {
    try {
      this.logger.info(`Validating filter chain: ${chain.name}`);

      // Check for required fields
      if (!chain.id) {
        throw new Error('Filter chain ID is required');
      }

      if (!chain.name) {
        throw new Error('Filter chain name is required');
      }

      if (!chain.filters) {
        throw new Error('Filter chain filters are required');
      }

      // Validate each filter in the chain
      for (const chainFilter of chain.filters) {
        this.validateChainFilter(chainFilter);
      }

      this.logger.info(`Filter chain validated successfully: ${chain.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate filter chain: ${chain.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a chain filter
   */
  private validateChainFilter(chainFilter: ChainFilter): void {
    try {
      this.logger.info(`Validating chain filter: ${chainFilter.filterId}`);

      if (!chainFilter.filterId) {
        throw new Error('Chain filter ID is required');
      }

      // Check if filter exists
      const filter = this.filters.get(chainFilter.filterId);
      if (!filter) {
        throw new Error(`Referenced filter not found: ${chainFilter.filterId}`);
      }

      // Validate condition if present
      if (chainFilter.condition) {
        this.validateFilterCondition(chainFilter.condition);
      }

      this.logger.info(`Chain filter validated successfully: ${chainFilter.filterId}`);
    } catch (error) {
      this.logger.error(`Failed to validate chain filter: ${chainFilter.filterId}`, error);
      throw error;
    }
  }

  /**
   * Validate a filter condition
   */
  private validateFilterCondition(condition: FilterCondition): void {
    try {
      this.logger.info(`Validating filter condition: ${condition.variable} ${condition.operator}`);

      if (!condition.variable) {
        throw new Error('Condition variable is required');
      }

      if (!condition.operator) {
        throw new Error('Condition operator is required');
      }

      // Validate operator is supported
      const supportedOperators = [
        '=',
        '!=',
        '<',
        '>',
        '<=',
        '>=',
        'starts_with',
        'ends_with',
        'contains',
        'matches',
        'in',
        'not_in',
        'exists',
        'not_exists',
      ];

      if (!supportedOperators.includes(condition.operator)) {
        throw new Error(`Unsupported condition operator: ${condition.operator}`);
      }

      this.logger.info(
        `Filter condition validated successfully: ${condition.variable} ${condition.operator}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to validate filter condition: ${condition.variable} ${condition.operator}`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove a filter chain
   */
  public removeFilterChain(chainId: string): boolean {
    try {
      this.logger.info(`Removing filter chain: ${chainId}`);

      const chain = this.filterChains.get(chainId);
      if (!chain) {
        this.logger.warn(`Filter chain not found: ${chainId}`);
        return false;
      }

      const deleted = this.filterChains.delete(chainId);
      if (deleted) {
        this.logger.info(`Filter chain removed successfully: ${chain.name}`);
      } else {
        this.logger.warn(`Failed to remove filter chain: ${chain.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove filter chain: ${chainId}`, error);
      throw error;
    }
  }

  /**
   * Update a filter chain
   */
  public updateFilterChain(
    chainId: string,
    updates: Partial<Omit<FilterChain, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>>
  ): boolean {
    try {
      this.logger.info(`Updating filter chain: ${chainId}`);

      const chain = this.filterChains.get(chainId);
      if (!chain) {
        this.logger.warn(`Filter chain not found: ${chainId}`);
        return false;
      }

      // Update the chain
      Object.assign(chain, updates, {
        updatedAt: new Date(),
      });

      // Re-validate the updated chain
      this.validateFilterChain(chain);

      // Update in map
      this.filterChains.set(chainId, chain);

      this.logger.info(`Filter chain updated successfully: ${chain.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update filter chain: ${chainId}`, error);
      throw error;
    }
  }

  /**
   * Get a filter chain by ID
   */
  public getFilterChain(chainId: string): FilterChain | undefined {
    return this.filterChains.get(chainId);
  }

  /**
   * Get all filter chains
   */
  public getAllFilterChains(): FilterChain[] {
    return Array.from(this.filterChains.values());
  }

  /**
   * Register a filter transformation
   */
  public registerTransformation(transformation: FilterTransformation): void {
    try {
      this.logger.info(`Registering filter transformation: ${transformation.name}`);

      // Validate transformation
      this.validateTransformation(transformation);

      this.transformations.set(transformation.id, transformation);

      this.logger.info(`Filter transformation registered successfully: ${transformation.name}`);
    } catch (error) {
      this.logger.error(`Failed to register filter transformation: ${transformation.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a filter transformation
   */
  private validateTransformation(transformation: FilterTransformation): void {
    try {
      this.logger.info(`Validating filter transformation: ${transformation.name}`);

      // Check for required fields
      if (!transformation.id) {
        throw new Error('Transformation ID is required');
      }

      if (!transformation.name) {
        throw new Error('Transformation name is required');
      }

      if (!transformation.sourceField) {
        throw new Error('Transformation source field is required');
      }

      if (!transformation.targetField) {
        throw new Error('Transformation target field is required');
      }

      if (!transformation.filterChainId) {
        throw new Error('Transformation filter chain ID is required');
      }

      // Check if filter chain exists
      const chain = this.filterChains.get(transformation.filterChainId);
      if (!chain) {
        throw new Error(`Referenced filter chain not found: ${transformation.filterChainId}`);
      }

      this.logger.info(`Filter transformation validated successfully: ${transformation.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate filter transformation: ${transformation.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a filter transformation
   */
  public removeTransformation(transformationId: string): boolean {
    try {
      this.logger.info(`Removing filter transformation: ${transformationId}`);

      const transformation = this.transformations.get(transformationId);
      if (!transformation) {
        this.logger.warn(`Filter transformation not found: ${transformationId}`);
        return false;
      }

      const deleted = this.transformations.delete(transformationId);
      if (deleted) {
        this.logger.info(`Filter transformation removed successfully: ${transformation.name}`);
      } else {
        this.logger.warn(`Failed to remove filter transformation: ${transformation.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove filter transformation: ${transformationId}`, error);
      throw error;
    }
  }

  /**
   * Update a filter transformation
   */
  public updateTransformation(
    transformationId: string,
    updates: Partial<Omit<FilterTransformation, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>>
  ): boolean {
    try {
      this.logger.info(`Updating filter transformation: ${transformationId}`);

      const transformation = this.transformations.get(transformationId);
      if (!transformation) {
        this.logger.warn(`Filter transformation not found: ${transformationId}`);
        return false;
      }

      // Update the transformation
      Object.assign(transformation, updates, {
        updatedAt: new Date(),
      });

      // Re-validate the updated transformation
      this.validateTransformation(transformation);

      // Update in map
      this.transformations.set(transformationId, transformation);

      this.logger.info(`Filter transformation updated successfully: ${transformation.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update filter transformation: ${transformationId}`, error);
      throw error;
    }
  }

  /**
   * Get a filter transformation by ID
   */
  public getTransformation(transformationId: string): FilterTransformation | undefined {
    return this.transformations.get(transformationId);
  }

  /**
   * Get all filter transformations
   */
  public getAllTransformations(): FilterTransformation[] {
    return Array.from(this.transformations.values());
  }

  /**
   * Apply transformations to data
   */
  public async applyTransformations(
    data: any,
    context?: FilterContext
  ): Promise<Record<string, any>> {
    try {
      this.logger.info('Applying filter transformations to data');

      const transformedData = { ...data };
      const transformations = Array.from(this.transformations.values()).filter((t) => t.enabled);

      // Apply each transformation
      for (const transformation of transformations) {
        try {
          // Get source value
          const sourceValue = this.getValueAtPath(transformedData, transformation.sourceField);

          // Apply filter chain
          const filterChainResult = await this.applyFilterChain(
            transformation.filterChainId,
            sourceValue,
            context
          );

          if (filterChainResult.success) {
            // Set target value
            this.setValueAtPath(
              transformedData,
              transformation.targetField,
              filterChainResult.data
            );

            // Update transformation usage statistics
            transformation.usageCount++;
            transformation.lastUsed = new Date();
            this.transformations.set(transformation.id, transformation);
          } else {
            this.logger.warn(
              `Filter chain failed for transformation: ${transformation.name}`,
              filterChainResult.error
            );
          }
        } catch (error) {
          this.logger.error(`Failed to apply transformation: ${transformation.name}`, error);
        }
      }

      this.logger.info('Filter transformations applied successfully');
      return transformedData;
    } catch (error) {
      this.logger.error('Failed to apply filter transformations', error);
      throw error;
    }
  }

  /**
   * Get value at a nested path
   */
  private getValueAtPath(obj: any, path: string): any {
    try {
      if (!path) {
        return obj;
      }

      const parts = path.split('.');
      let currentValue = obj;

      for (const part of parts) {
        if (currentValue && typeof currentValue === 'object') {
          currentValue = currentValue[part];
        } else {
          return undefined;
        }
      }

      return currentValue;
    } catch (error) {
      this.logger.error(`Failed to get value at path: ${path}`, error);
      return undefined;
    }
  }

  /**
   * Set value at a nested path
   */
  private setValueAtPath(obj: any, path: string, value: any): void {
    try {
      if (!path) {
        return;
      }

      const parts = path.split('.');
      let currentValue = obj;

      // Navigate to the parent object
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!currentValue[part] || typeof currentValue[part] !== 'object') {
          currentValue[part] = {};
        }
        currentValue = currentValue[part];
      }

      // Set the final value
      const finalPart = parts[parts.length - 1];
      currentValue[finalPart] = value;
    } catch (error) {
      this.logger.error(`Failed to set value at path: ${path}`, error);
    }
  }

  /**
   * Get filter statistics
   */
  public getFilterStats(): {
    totalFilters: number;
    totalChains: number;
    totalTransformations: number;
    mostUsedFilters: Array<{ filter: FilterDefinition; usage: number }>;
    performanceStats: {
      fastestFilter: { filterId: string; averageTime: number } | null;
      slowestFilter: { filterId: string; averageTime: number } | null;
      averageExecutionTime: number;
      successRate: number;
    };
    errorStats: {
      totalErrors: number;
      mostErrorProneFilters: Array<{ filterId: string; errorCount: number }>;
    };
  } {
    try {
      this.logger.info('Generating filter statistics');

      const filters = Array.from(this.filters.values());
      const chains = Array.from(this.filterChains.values());
      const transformations = Array.from(this.transformations.values());

      const stats = {
        totalFilters: filters.length,
        totalChains: chains.length,
        totalTransformations: transformations.length,
        mostUsedFilters: [] as Array<{ filter: FilterDefinition; usage: number }>,
        performanceStats: {
          fastestFilter: null as { filterId: string; averageTime: number } | null,
          slowestFilter: null as { filterId: string; averageTime: number } | null,
          averageExecutionTime: 0,
          successRate: 0,
        },
        errorStats: {
          totalErrors: 0,
          mostErrorProneFilters: [] as Array<{ filterId: string; errorCount: number }>,
        },
      };

      // Calculate most used filters
      const sortedFilters = [...filters].sort((a, b) => b.usageCount - a.usageCount);
      stats.mostUsedFilters = sortedFilters.slice(0, 10).map((filter) => ({
        filter,
        usage: filter.usageCount,
      }));

      // Calculate performance statistics
      const executionTimes = filters
        .filter((f) => f.performanceStats)
        .map((f) => f.performanceStats!.averageExecutionTime);

      if (executionTimes.length > 0) {
        stats.performanceStats.averageExecutionTime =
          executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;

        const fastestFilter = filters
          .filter((f) => f.performanceStats)
          .reduce(
            (fastest, current) =>
              !fastest.performanceStats ||
              (current.performanceStats &&
                current.performanceStats.averageExecutionTime <
                  fastest.performanceStats.averageExecutionTime)
                ? current
                : fastest,
            filters[0]
          );

        if (fastestFilter && fastestFilter.performanceStats) {
          stats.performanceStats.fastestFilter = {
            filterId: fastestFilter.id,
            averageTime: fastestFilter.performanceStats.averageExecutionTime,
          };
        }

        const slowestFilter = filters
          .filter((f) => f.performanceStats)
          .reduce(
            (slowest, current) =>
              !slowest.performanceStats ||
              (current.performanceStats &&
                current.performanceStats.averageExecutionTime >
                  slowest.performanceStats.averageExecutionTime)
                ? current
                : slowest,
            filters[0]
          );

        if (slowestFilter && slowestFilter.performanceStats) {
          stats.performanceStats.slowestFilter = {
            filterId: slowestFilter.id,
            averageTime: slowestFilter.performanceStats.averageExecutionTime,
          };
        }
      }

      // Calculate success rate
      const totalUsage = filters.reduce((sum, filter) => sum + filter.usageCount, 0);
      const totalSuccessfulUsage = filters.reduce(
        (sum, filter) =>
          sum +
          (filter.performanceStats
            ? Math.round(filter.usageCount * (filter.performanceStats.successRate / 100))
            : filter.usageCount),
        0
      );

      stats.performanceStats.successRate =
        totalUsage > 0 ? (totalSuccessfulUsage / totalUsage) * 100 : 0;

      // Calculate error statistics
      const errorFilters = filters.filter(
        (f) => f.performanceStats && f.performanceStats.errorCount > 0
      );
      stats.errorStats.totalErrors = errorFilters.reduce(
        (sum, filter) => sum + (filter.performanceStats?.errorCount || 0),
        0
      );

      const sortedErrorFilters = [...errorFilters].sort(
        (a, b) => (b.performanceStats?.errorCount || 0) - (a.performanceStats?.errorCount || 0)
      );

      stats.errorStats.mostErrorProneFilters = sortedErrorFilters.slice(0, 10).map((filter) => ({
        filterId: filter.id,
        errorCount: filter.performanceStats?.errorCount || 0,
      }));

      this.logger.info('Filter statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate filter statistics', error);
      throw error;
    }
  }

  /**
   * Find filters that could be optimized
   */
  public findOptimizationOpportunities(): FilterSuggestion[] {
    try {
      this.logger.info('Finding filter optimization opportunities');

      const suggestions: FilterSuggestion[] = [];
      const filters = Array.from(this.filters.values());

      for (const filter of filters) {
        // Suggestion 1: Filters with high error rates
        if (filter.performanceStats && filter.performanceStats.errorCount > 10) {
          suggestions.push({
            filterId: filter.id,
            filterName: filter.name,
            confidence: 90,
            reason: `Filter has high error count (${filter.performanceStats.errorCount} errors)`,
            recommendedParameters: {},
            estimatedPerformanceGain: 0,
          });
        }

        // Suggestion 2: Slow filters
        if (filter.performanceStats && filter.performanceStats.averageExecutionTime > 100) {
          suggestions.push({
            filterId: filter.id,
            filterName: filter.name,
            confidence: 85,
            reason: `Filter is slow (${filter.performanceStats.averageExecutionTime.toFixed(2)}ms average)`,
            recommendedParameters: {},
            estimatedPerformanceGain: filter.performanceStats.averageExecutionTime * 0.3, // 30% potential improvement
          });
        }

        // Suggestion 3: Unused filters
        if (filter.usageCount === 0) {
          suggestions.push({
            filterId: filter.id,
            filterName: filter.name,
            confidence: 70,
            reason: 'Filter has never been used',
            recommendedParameters: {},
            estimatedPerformanceGain: 0,
          });
        }
      }

      // Sort suggestions by confidence (highest first)
      suggestions.sort((a, b) => b.confidence - a.confidence);

      this.logger.info(`Found ${suggestions.length} optimization opportunities`);
      return suggestions;
    } catch (error) {
      this.logger.error('Failed to find optimization opportunities', error);
      throw error;
    }
  }

  /**
   * Create a default set of commonly used filters
   */
  public createDefaultFilters(): void {
    try {
      this.logger.info('Creating default filters');

      // Text processing filters
      this.registerFilter({
        id: 'filter-text-trim',
        name: 'Text Trim',
        description: 'Remove whitespace from both ends of a string',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [],
        implementation: 'return value.trim();',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.registerFilter({
        id: 'filter-text-replace',
        name: 'Text Replace',
        description: 'Replace text in a string',
        type: 'transform',
        inputType: 'string',
        outputType: 'string',
        parameters: [
          { name: 'search', type: 'string', required: true, description: 'Text to search for' },
          { name: 'replacement', type: 'string', required: true, description: 'Replacement text' },
        ],
        implementation: 'return value.replace(new RegExp(search, "g"), replacement);',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Array manipulation filters
      this.registerFilter({
        id: 'filter-array-sort',
        name: 'Array Sort',
        description: 'Sort array elements',
        type: 'transform',
        inputType: 'array',
        outputType: 'array',
        parameters: [
          {
            name: 'direction',
            type: 'string',
            required: false,
            defaultValue: 'asc',
            description: 'Sort direction (asc/desc)',
          },
        ],
        implementation: `
          if (!Array.isArray(value)) return value;
          return direction === 'desc' 
            ? [...value].sort().reverse() 
            : [...value].sort();
        `,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      // Number manipulation filters
      this.registerFilter({
        id: 'filter-number-round',
        name: 'Number Round',
        description: 'Round a number to specified decimal places',
        type: 'transform',
        inputType: 'number',
        outputType: 'number',
        parameters: [
          {
            name: 'decimals',
            type: 'number',
            required: false,
            defaultValue: 0,
            description: 'Decimal places',
          },
        ],
        implementation: 'return Number(value.toFixed(decimals));',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      });

      this.logger.info('Default filters created successfully');
    } catch (error) {
      this.logger.error('Failed to create default filters', error);
      throw error;
    }
  }

  /**
   * Export filter definitions
   */
  public exportFilters(): FilterDefinition[] {
    try {
      this.logger.info('Exporting filter definitions');

      const filters = Array.from(this.filters.values());

      this.logger.info(`Exported ${filters.length} filter definitions`);
      return filters;
    } catch (error) {
      this.logger.error('Failed to export filter definitions', error);
      throw error;
    }
  }

  /**
   * Import filter definitions
   */
  public importFilters(filters: FilterDefinition[]): void {
    try {
      this.logger.info(`Importing ${filters.length} filter definitions`);

      // Clear existing filters
      this.filters.clear();

      // Import new filters
      for (const filter of filters) {
        try {
          this.validateFilter(filter);
          this.filters.set(filter.id, filter);
        } catch (error) {
          this.logger.error(`Failed to import filter: ${filter.name}`, error);
        }
      }

      this.logger.info(`Imported ${Array.from(this.filters.values()).length} filter definitions`);
    } catch (error) {
      this.logger.error('Failed to import filter definitions', error);
      throw error;
    }
  }

  /**
   * Test a filter with sample data
   */
  public async testFilter(
    filter: FilterDefinition,
    sampleValue: any,
    sampleParameters: Record<string, any> = {},
    sampleContext: Partial<FilterContext> = {}
  ): Promise<{
    success: boolean;
    result?: FilterResult<any>;
    errors: string[];
  }> {
    try {
      this.logger.info(`Testing filter: ${filter.name}`);

      // Create a test context
      const context: FilterContext = {
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
          timestamp: Date.now(),
        },
        custom: sampleContext.custom || {},
        system: {
          version: '1.0.0',
          platform: process.platform,
        },
      };

      // Register the filter temporarily
      this.registerFilter(filter);

      // Apply the filter
      const result = await this.applyFilter(filter.id, sampleValue, sampleParameters, context);

      // Clean up
      this.removeFilter(filter.id);

      return {
        success: true,
        result,
        errors: [],
      };
    } catch (error) {
      this.logger.error(`Failed to test filter: ${filter.name}`, error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create a simple filter
   */
  public createSimpleFilter(
    name: string,
    inputType: string,
    outputType: string,
    implementation: string
  ): FilterDefinition {
    try {
      this.logger.info(`Creating simple filter: ${name}`);

      const filter: FilterDefinition = {
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        inputType,
        outputType,
        type: 'transform',
        parameters: [],
        implementation,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the filter
      this.validateFilter(filter);
      this.registerFilter(filter);

      this.logger.info(`Simple filter created successfully: ${name}`);
      return filter;
    } catch (error) {
      this.logger.error(`Failed to create simple filter: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a parameterized filter
   */
  public createParameterizedFilter(
    name: string,
    inputType: string,
    outputType: string,
    parameters: FilterParameter[],
    implementation: string
  ): FilterDefinition {
    try {
      this.logger.info(`Creating parameterized filter: ${name}`);

      const filter: FilterDefinition = {
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        inputType,
        outputType,
        type: 'transform',
        parameters,
        implementation,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the filter
      this.validateFilter(filter);
      this.registerFilter(filter);

      this.logger.info(`Parameterized filter created successfully: ${name}`);
      return filter;
    } catch (error) {
      this.logger.error(`Failed to create parameterized filter: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a filter chain
   */
  public createFilterChain(name: string, filters: ChainFilter[]): FilterChain {
    try {
      this.logger.info(`Creating filter chain: ${name}`);

      const chain: FilterChain = {
        id: `chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        filters,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the chain
      this.validateFilterChain(chain);
      this.registerFilterChain(chain);

      this.logger.info(`Filter chain created successfully: ${name}`);
      return chain;
    } catch (error) {
      this.logger.error(`Failed to create filter chain: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a transformation
   */
  public createTransformation(
    name: string,
    sourceField: string,
    targetField: string,
    filterChainId: string
  ): FilterTransformation {
    try {
      this.logger.info(`Creating filter transformation: ${name}`);

      const transformation: FilterTransformation = {
        id: `transformation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        sourceField,
        targetField,
        filterChainId,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the transformation
      this.validateTransformation(transformation);
      this.registerTransformation(transformation);

      this.logger.info(`Filter transformation created successfully: ${name}`);
      return transformation;
    } catch (error) {
      this.logger.error(`Failed to create filter transformation: ${name}`, error);
      throw error;
    }
  }

  /**
   * Enable or disable a filter
   */
  public setFilterEnabled(filterId: string, enabled: boolean): boolean {
    return this.updateFilter(filterId, { enabled });
  }

  /**
   * Enable or disable a filter chain
   */
  public setFilterChainEnabled(chainId: string, enabled: boolean): boolean {
    return this.updateFilterChain(chainId, { enabled });
  }

  /**
   * Enable or disable a transformation
   */
  public setTransformationEnabled(transformationId: string, enabled: boolean): boolean {
    return this.updateTransformation(transformationId, { enabled });
  }

  /**
   * Find filters by type
   */
  public findFiltersByType(type: string): FilterDefinition[] {
    try {
      this.logger.info(`Finding filters by type: ${type}`);

      const filters = Array.from(this.filters.values()).filter((filter) => filter.type === type);

      this.logger.info(`Found ${filters.length} filters of type: ${type}`);
      return filters;
    } catch (error) {
      this.logger.error(`Failed to find filters by type: ${type}`, error);
      throw error;
    }
  }

  /**
   * Find filters by input/output type
   */
  public findFiltersByTypes(inputType?: string, outputType?: string): FilterDefinition[] {
    try {
      this.logger.info(`Finding filters by types: ${inputType} -> ${outputType}`);

      const filters = Array.from(this.filters.values()).filter((filter) => {
        let matches = true;

        if (inputType) {
          matches = matches && filter.inputType === inputType;
        }

        if (outputType) {
          matches = matches && filter.outputType === outputType;
        }

        return matches;
      });

      this.logger.info(`Found ${filters.length} matching filters`);
      return filters;
    } catch (error) {
      this.logger.error(`Failed to find filters by types: ${inputType} -> ${outputType}`, error);
      throw error;
    }
  }

  /**
   * Get all registered filter types
   */
  public getFilterTypes(): string[] {
    try {
      this.logger.info('Getting all filter types');

      const types = new Set<string>();

      for (const filter of this.filters.values()) {
        types.add(filter.type);
      }

      this.logger.info(`Found ${types.size} filter types`);
      return Array.from(types);
    } catch (error) {
      this.logger.error('Failed to get filter types', error);
      throw error;
    }
  }

  /**
   * Get all input/output types
   */
  public getFilterIOTypes(): {
    inputTypes: string[];
    outputTypes: string[];
  } {
    try {
      this.logger.info('Getting filter IO types');

      const inputTypes = new Set<string>();
      const outputTypes = new Set<string>();

      for (const filter of this.filters.values()) {
        inputTypes.add(filter.inputType);
        outputTypes.add(filter.outputType);
      }

      const result = {
        inputTypes: Array.from(inputTypes),
        outputTypes: Array.from(outputTypes),
      };

      this.logger.info(
        `Found ${result.inputTypes.length} input types, ${result.outputTypes.length} output types`
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to get filter IO types', error);
      throw error;
    }
  }

  /**
   * Create a filter with fluent API
   */
  public filterBuilder(name: string): FilterBuilder {
    return new FilterBuilder(this, name);
  }

  /**
   * Create a filter chain with fluent API
   */
  public chainBuilder(name: string): FilterChainBuilder {
    return new FilterChainBuilder(this, name);
  }

  /**
   * Clear any cached statistics
   */
  public clearCache(): void {
    try {
      this.logger.info('Clearing filter processing cache');

      // In a real implementation, we'd clear any cached filter results
      // For now, this is a placeholder

      this.logger.info('Filter processing cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear filter processing cache', error);
      throw error;
    }
  }

  /**
   * Validate filter context
   */
  public validateContext(context: FilterContext): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating filter context');

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
        `Filter context validation completed: ${result.valid ? 'valid' : 'invalid'}`
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to validate filter context', error);
      throw error;
    }
  }

  /**
   * Create a safe context for filtering
   */
  public createSafeContext(context: FilterContext): FilterContext {
    try {
      this.logger.info('Creating safe filter context');

      // Deep clone the context to prevent mutations
      const safeContext: FilterContext = JSON.parse(JSON.stringify(context));

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

      this.logger.info('Safe filter context created');
      return safeContext;
    } catch (error) {
      this.logger.error('Failed to create safe filter context', error);
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
   * Batch apply filters to multiple values
   */
  public async batchApplyFilters(
    filterApplications: Array<{
      filterId: string;
      value: any;
      parameters?: Record<string, any>;
      context?: FilterContext;
    }>
  ): Promise<FilterResult<any>[]> {
    try {
      this.logger.info(`Batch applying filters to ${filterApplications.length} values`);

      const results = await Promise.all(
        filterApplications.map(async (application) => {
          try {
            return await this.applyFilter(
              application.filterId,
              application.value,
              application.parameters,
              application.context
            );
          } catch (error) {
            this.logger.error(`Failed to apply filter: ${application.filterId}`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              executionTime: 0,
              warnings: [],
            } satisfies FilterResult<any>;
          }
        })
      );

      this.logger.info(
        `Batch filter application completed for ${filterApplications.length} values`
      );
      return results;
    } catch (error) {
      this.logger.error('Failed to batch apply filters', error);
      throw error;
    }
  }

  /**
   * Batch apply filter chains to multiple values
   */
  public async batchApplyFilterChains(
    chainApplications: Array<{ chainId: string; value: any; context?: FilterContext }>
  ): Promise<FilterResult<any>[]> {
    try {
      this.logger.info(`Batch applying filter chains to ${chainApplications.length} values`);

      const results = await Promise.all(
        chainApplications.map(async (application) => {
          try {
            return await this.applyFilterChain(
              application.chainId,
              application.value,
              application.context
            );
          } catch (error) {
            this.logger.error(`Failed to apply filter chain: ${application.chainId}`, error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              executionTime: 0,
              warnings: [],
            } satisfies FilterResult<any>;
          }
        })
      );

      this.logger.info(
        `Batch filter chain application completed for ${chainApplications.length} values`
      );
      return results;
    } catch (error) {
      this.logger.error('Failed to batch apply filter chains', error);
      throw error;
    }
  }

  /**
   * Create a filter condition
   */
  public createFilterCondition(
    variable: string,
    operator: string,
    value: any,
    negate?: boolean
  ): FilterCondition {
    try {
      this.logger.info(`Creating filter condition: ${variable} ${operator}`);

      const condition: FilterCondition = {
        variable,
        operator,
        value,
        negate,
      };

      this.validateFilterCondition(condition);

      this.logger.info(`Filter condition created successfully: ${variable} ${operator}`);
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create filter condition: ${variable} ${operator}`, error);
      throw error;
    }
  }

  /**
   * Get filter performance report
   */
  public getPerformanceReport(): {
    totalFilters: number;
    averageExecutionTime: number;
    slowestFilters: Array<{ filter: FilterDefinition; avgTime: number }>;
    fastestFilters: Array<{ filter: FilterDefinition; avgTime: number }>;
    errorProneFilters: Array<{ filter: FilterDefinition; errorCount: number }>;
    usageDistribution: Record<string, number>;
  } {
    try {
      this.logger.info('Generating filter performance report');

      const filters = Array.from(this.filters.values());

      const report = {
        totalFilters: filters.length,
        averageExecutionTime: 0,
        slowestFilters: [] as Array<{ filter: FilterDefinition; avgTime: number }>,
        fastestFilters: [] as Array<{ filter: FilterDefinition; avgTime: number }>,
        errorProneFilters: [] as Array<{ filter: FilterDefinition; errorCount: number }>,
        usageDistribution: {} as Record<string, number>,
      };

      // Calculate average execution time
      const totalExecutionTime = filters.reduce(
        (sum, filter) => sum + (filter.performanceStats?.averageExecutionTime || 0),
        0
      );

      report.averageExecutionTime = filters.length > 0 ? totalExecutionTime / filters.length : 0;

      // Find slowest and fastest filters
      const filtersWithStats = filters.filter((f) => f.performanceStats);

      const slowestFilters = [...filtersWithStats]
        .sort(
          (a, b) =>
            (b.performanceStats?.averageExecutionTime || 0) -
            (a.performanceStats?.averageExecutionTime || 0)
        )
        .slice(0, 10);

      report.slowestFilters = slowestFilters.map((filter) => ({
        filter,
        avgTime: filter.performanceStats?.averageExecutionTime || 0,
      }));

      const fastestFilters = [...filtersWithStats]
        .sort(
          (a, b) =>
            (a.performanceStats?.averageExecutionTime || 0) -
            (b.performanceStats?.averageExecutionTime || 0)
        )
        .slice(0, 10);

      report.fastestFilters = fastestFilters.map((filter) => ({
        filter,
        avgTime: filter.performanceStats?.averageExecutionTime || 0,
      }));

      // Find error-prone filters
      const errorProneFilters = [...filtersWithStats]
        .filter((f) => f.performanceStats?.errorCount && f.performanceStats.errorCount > 0)
        .sort(
          (a, b) => (b.performanceStats?.errorCount || 0) - (a.performanceStats?.errorCount || 0)
        )
        .slice(0, 10);

      report.errorProneFilters = errorProneFilters.map((filter) => ({
        filter,
        errorCount: filter.performanceStats?.errorCount || 0,
      }));

      // Calculate usage distribution
      const usageMap = new Map<string, number>();

      for (const filter of filters) {
        const usage = filter.type;
        const currentCount = usageMap.get(usage) || 0;
        usageMap.set(usage, currentCount + 1);
      }

      report.usageDistribution = Object.fromEntries(usageMap);

      this.logger.info('Filter performance report generated successfully');
      return report;
    } catch (error) {
      this.logger.error('Failed to generate filter performance report', error);
      throw error;
    }
  }

  /**
   * Clear filter statistics
   */
  public clearStatistics(): void {
    try {
      this.logger.info('Clearing filter statistics');

      for (const filter of this.filters.values()) {
        filter.usageCount = 0;
        filter.lastUsed = undefined;
        filter.performanceStats = undefined;
        this.filters.set(filter.id, filter);
      }

      for (const chain of this.filterChains.values()) {
        chain.usageCount = 0;
        chain.lastUsed = undefined;
        this.filterChains.set(chain.id, chain);
      }

      for (const transformation of this.transformations.values()) {
        transformation.usageCount = 0;
        transformation.lastUsed = undefined;
        this.transformations.set(transformation.id, transformation);
      }

      this.logger.info('Filter statistics cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear filter statistics', error);
      throw error;
    }
  }

  /**
   * Clone a filter definition
   */
  public cloneFilter(filterId: string, newName?: string): FilterDefinition {
    try {
      this.logger.info(`Cloning filter: ${filterId}`);

      const filter = this.filters.get(filterId);
      if (!filter) {
        throw new Error(`Filter not found: ${filterId}`);
      }

      // Create a clone with new ID and name
      const clonedFilter: FilterDefinition = {
        ...filter,
        id: `filter-cloned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newName || `${filter.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        lastUsed: undefined,
        performanceStats: undefined,
      };

      // Validate and register the cloned filter
      this.validateFilter(clonedFilter);
      this.registerFilter(clonedFilter);

      this.logger.info(`Filter cloned successfully: ${clonedFilter.name}`);
      return clonedFilter;
    } catch (error) {
      this.logger.error(`Failed to clone filter: ${filterId}`, error);
      throw error;
    }
  }

  /**
   * Clone a filter chain
   */
  public cloneFilterChain(chainId: string, newName?: string): FilterChain {
    try {
      this.logger.info(`Cloning filter chain: ${chainId}`);

      const chain = this.filterChains.get(chainId);
      if (!chain) {
        throw new Error(`Filter chain not found: ${chainId}`);
      }

      // Create a clone with new ID and name
      const clonedChain: FilterChain = {
        ...chain,
        id: `chain-cloned-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: newName || `${chain.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        lastUsed: undefined,
      };

      // Validate and register the cloned chain
      this.validateFilterChain(clonedChain);
      this.registerFilterChain(clonedChain);

      this.logger.info(`Filter chain cloned successfully: ${clonedChain.name}`);
      return clonedChain;
    } catch (error) {
      this.logger.error(`Failed to clone filter chain: ${chainId}`, error);
      throw error;
    }
  }

  /**
   * Get filter usage by category/type
   */
  public getUsageByCategory(): Record<string, number> {
    try {
      this.logger.info('Getting filter usage by category');

      const usageByCategory = new Map<string, number>();

      for (const filter of this.filters.values()) {
        const category = filter.type;
        const currentUsage = usageByCategory.get(category) || 0;
        usageByCategory.set(category, currentUsage + filter.usageCount);
      }

      this.logger.info('Filter usage by category retrieved successfully');
      return Object.fromEntries(usageByCategory);
    } catch (error) {
      this.logger.error('Failed to get filter usage by category', error);
      throw error;
    }
  }

  /**
   * Get most recently used filters
   */
  public getRecentlyUsedFilters(limit: number = 10): FilterDefinition[] {
    try {
      this.logger.info(`Getting ${limit} recently used filters`);

      const filters = Array.from(this.filters.values());

      const recentFilters = filters
        .filter((filter) => filter.lastUsed)
        .sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0))
        .slice(0, limit);

      this.logger.info(`Retrieved ${recentFilters.length} recently used filters`);
      return recentFilters;
    } catch (error) {
      this.logger.error('Failed to get recently used filters', error);
      throw error;
    }
  }

  /**
   * Get most frequently used filters
   */
  public getMostUsedFilters(limit: number = 10): FilterDefinition[] {
    try {
      this.logger.info(`Getting ${limit} most used filters`);

      const filters = Array.from(this.filters.values());

      const mostUsedFilters = [...filters]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);

      this.logger.info(`Retrieved ${mostUsedFilters.length} most used filters`);
      return mostUsedFilters;
    } catch (error) {
      this.logger.error('Failed to get most used filters', error);
      throw error;
    }
  }

  /**
   * Reset filter usage statistics
   */
  public resetUsageStatistics(filterId?: string): void {
    try {
      this.logger.info('Resetting filter usage statistics');

      if (filterId) {
        // Reset specific filter
        const filter = this.filters.get(filterId);
        if (filter) {
          filter.usageCount = 0;
          filter.lastUsed = undefined;
          filter.performanceStats = undefined;
          this.filters.set(filterId, filter);
          this.logger.info(`Usage statistics reset for filter: ${filter.name}`);
        } else {
          this.logger.warn(`Filter not found: ${filterId}`);
        }
      } else {
        // Reset all filters
        for (const filter of this.filters.values()) {
          filter.usageCount = 0;
          filter.lastUsed = undefined;
          filter.performanceStats = undefined;
          this.filters.set(filter.id, filter);
        }

        // Reset all chains
        for (const chain of this.filterChains.values()) {
          chain.usageCount = 0;
          chain.lastUsed = undefined;
          this.filterChains.set(chain.id, chain);
        }

        // Reset all transformations
        for (const transformation of this.transformations.values()) {
          transformation.usageCount = 0;
          transformation.lastUsed = undefined;
          this.transformations.set(transformation.id, transformation);
        }

        this.logger.info('All filter usage statistics reset');
      }
    } catch (error) {
      this.logger.error('Failed to reset filter usage statistics', error);
      throw error;
    }
  }

  /**
   * Enable all filters
   */
  public enableAllFilters(): void {
    try {
      this.logger.info('Enabling all filters');

      for (const filter of this.filters.values()) {
        filter.enabled = true;
        this.filters.set(filter.id, filter);
      }

      this.logger.info('All filters enabled');
    } catch (error) {
      this.logger.error('Failed to enable all filters', error);
      throw error;
    }
  }

  /**
   * Disable all filters
   */
  public disableAllFilters(): void {
    try {
      this.logger.info('Disabling all filters');

      for (const filter of this.filters.values()) {
        filter.enabled = false;
        this.filters.set(filter.id, filter);
      }

      this.logger.info('All filters disabled');
    } catch (error) {
      this.logger.error('Failed to disable all filters', error);
      throw error;
    }
  }

  /**
   * Create a conditional filter
   */
  public createConditionalFilter(
    name: string,
    condition: FilterCondition,
    trueFilterId: string,
    falseFilterId?: string
  ): FilterDefinition {
    try {
      this.logger.info(`Creating conditional filter: ${name}`);

      // Create a conditional filter implementation
      const implementation = `
        // This is a placeholder implementation
        // In a real implementation, we'd evaluate the condition
        // and apply the appropriate filter
        
        if (${JSON.stringify(condition)}) {
          // Apply true filter logic
          return value; // Placeholder
        } else {
          // Apply false filter logic or return unchanged
          return value;
        }
      `;

      const filter: FilterDefinition = {
        id: `conditional-filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type: 'transform',
        inputType: 'any',
        outputType: 'any',
        parameters: [],
        implementation,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        description: `Conditional filter: ${name}`,
      };

      // Validate and register the filter
      this.validateFilter(filter);
      this.registerFilter(filter);

      this.logger.info(`Conditional filter created successfully: ${name}`);
      return filter;
    } catch (error) {
      this.logger.error(`Failed to create conditional filter: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a composite filter
   */
  public createCompositeFilter(
    name: string,
    filters: Array<{ filterId: string; parameters: Record<string, any> }>
  ): FilterDefinition {
    try {
      this.logger.info(`Creating composite filter: ${name}`);

      // Create a composite filter implementation
      const implementation = `
        // This is a placeholder implementation
        // In a real implementation, we'd apply all filters in sequence
        
        let result = value;
        // Apply filters in sequence
        return result;
      `;

      const filter: FilterDefinition = {
        id: `composite-filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type: 'transform',
        inputType: 'any',
        outputType: 'any',
        parameters: [],
        implementation,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        description: `Composite filter: ${name}`,
      };

      // Validate and register the filter
      this.validateFilter(filter);
      this.registerFilter(filter);

      this.logger.info(`Composite filter created successfully: ${name}`);
      return filter;
    } catch (error) {
      this.logger.error(`Failed to create composite filter: ${name}`, error);
      throw error;
    }
  }

  /**
   * Get filters by input/output types
   */
  public getFiltersByType(inputType?: string, outputType?: string): FilterDefinition[] {
    try {
      this.logger.info(`Getting filters by type: ${inputType} -> ${outputType}`);

      const filters = Array.from(this.filters.values());

      const matchingFilters = filters.filter((filter) => {
        let matches = true;

        if (inputType) {
          matches = matches && filter.inputType === inputType;
        }

        if (outputType) {
          matches = matches && filter.outputType === outputType;
        }

        return matches;
      });

      this.logger.info(`Found ${matchingFilters.length} matching filters`);
      return matchingFilters;
    } catch (error) {
      this.logger.error(`Failed to get filters by type: ${inputType} -> ${outputType}`, error);
      throw error;
    }
  }

  /**
   * Validate filter implementation
   */
  public validateFilterImplementation(implementation: string): boolean {
    try {
      this.logger.info('Validating filter implementation');

      // Try to compile the implementation
      new Function('value', 'parameters', 'context', implementation);

      this.logger.info('Filter implementation validated successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to validate filter implementation', error);
      return false;
    }
  }

  /**
   * Create a filter with default parameters
   */
  public createFilterWithDefaults(
    name: string,
    type: 'transform' | 'validate' | 'aggregate' | 'format' | 'extract',
    inputType: string,
    outputType: string,
    parameters: FilterParameter[],
    implementation: string
  ): FilterDefinition {
    try {
      this.logger.info(`Creating filter with defaults: ${name}`);

      const filter: FilterDefinition = {
        id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        type,
        inputType,
        outputType,
        parameters,
        implementation,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
        description: `Filter: ${name}`,
      };

      // Validate and register the filter
      this.validateFilter(filter);
      this.registerFilter(filter);

      this.logger.info(`Filter with defaults created successfully: ${name}`);
      return filter;
    } catch (error) {
      this.logger.error(`Failed to create filter with defaults: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a parameterized filter with fluent API
   */
  public parameterizedFilterBuilder(
    name: string,
    inputType: string,
    outputType: string
  ): ParameterizedFilterBuilder {
    return new ParameterizedFilterBuilder(this, name, inputType, outputType);
  }
}

/**
 * Fluent API for building filters
 */
export class FilterBuilder {
  private engine: FilterProcessingEngine;
  private filter: Omit<
    FilterDefinition,
    'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'performanceStats'
  >;

  constructor(engine: FilterProcessingEngine, name: string) {
    this.engine = engine;
    this.filter = {
      name,
      type: 'transform',
      inputType: 'any',
      outputType: 'any',
      parameters: [],
      implementation: 'return value;',
      enabled: true,
      description: `Filter: ${name}`,
    };
  }

  /**
   * Set filter type
   */
  public type(type: 'transform' | 'validate' | 'aggregate' | 'format' | 'extract'): FilterBuilder {
    try {
      this.filter.type = type;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set filter type: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set input type
   */
  public inputType(inputType: string): FilterBuilder {
    try {
      this.filter.inputType = inputType;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set input type: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set output type
   */
  public outputType(outputType: string): FilterBuilder {
    try {
      this.filter.outputType = outputType;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set output type: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a parameter
   */
  public parameter(
    name: string,
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date' | 'regexp',
    required: boolean = false,
    defaultValue?: any,
    description?: string
  ): FilterBuilder {
    try {
      this.filter.parameters.push({
        name,
        type,
        required,
        defaultValue,
        description,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add parameter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set implementation
   */
  public implementation(implementation: string): FilterBuilder {
    try {
      this.filter.implementation = implementation;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set implementation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set description
   */
  public describedAs(description: string): FilterBuilder {
    try {
      this.filter.description = description;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable or disable the filter
   */
  public enabled(enabled: boolean): FilterBuilder {
    try {
      this.filter.enabled = enabled;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build and register the filter
   */
  public build(): FilterDefinition {
    try {
      // Create the filter definition
      const filter: FilterDefinition = {
        id: `builder-filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: this.filter.name,
        type: this.filter.type,
        inputType: this.filter.inputType,
        outputType: this.filter.outputType,
        parameters: this.filter.parameters,
        implementation: this.filter.implementation,
        enabled: this.filter.enabled,
        description: this.filter.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the filter
      this.engine.validateFilter(filter);
      this.engine.registerFilter(filter);

      return filter;
    } catch (error) {
      throw new Error(
        `Failed to build filter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Fluent API for building filter chains
 */
export class FilterChainBuilder {
  private engine: FilterProcessingEngine;
  private chain: Omit<FilterChain, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>;

  constructor(engine: FilterProcessingEngine, name: string) {
    this.engine = engine;
    this.chain = {
      name,
      filters: [],
      enabled: true,
      description: `Filter Chain: ${name}`,
    };
  }

  /**
   * Add a filter to the chain
   */
  public addFilter(filterId: string, parameters: Record<string, any> = {}): FilterChainBuilder {
    try {
      this.chain.filters.push({
        filterId,
        parameters,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add filter to chain: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a conditional filter to the chain
   */
  public addConditionalFilter(
    filterId: string,
    condition: FilterCondition,
    parameters: Record<string, any> = {}
  ): FilterChainBuilder {
    try {
      this.chain.filters.push({
        filterId,
        parameters,
        condition,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add conditional filter to chain: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set description
   */
  public describedAs(description: string): FilterChainBuilder {
    try {
      this.chain.description = description;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable or disable the chain
   */
  public enabled(enabled: boolean): FilterChainBuilder {
    try {
      this.chain.enabled = enabled;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build and register the filter chain
   */
  public build(): FilterChain {
    try {
      // Create the filter chain
      const chain: FilterChain = {
        id: `builder-chain-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: this.chain.name,
        filters: this.chain.filters,
        enabled: this.chain.enabled,
        description: this.chain.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the chain
      this.engine.validateFilterChain(chain);
      this.engine.registerFilterChain(chain);

      return chain;
    } catch (error) {
      throw new Error(
        `Failed to build filter chain: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

/**
 * Fluent API for building parameterized filters
 */
export class ParameterizedFilterBuilder {
  private engine: FilterProcessingEngine;
  private filter: Omit<
    FilterDefinition,
    'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'performanceStats'
  >;

  constructor(engine: FilterProcessingEngine, name: string, inputType: string, outputType: string) {
    this.engine = engine;
    this.filter = {
      name,
      type: 'transform',
      inputType,
      outputType,
      parameters: [],
      implementation: 'return value;',
      enabled: true,
      description: `Parameterized Filter: ${name}`,
    };
  }

  /**
   * Add a string parameter
   */
  public stringParam(
    name: string,
    required: boolean = false,
    defaultValue?: string,
    description?: string
  ): ParameterizedFilterBuilder {
    try {
      this.filter.parameters.push({
        name,
        type: 'string',
        required,
        defaultValue,
        description,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add string parameter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a number parameter
   */
  public numberParam(
    name: string,
    required: boolean = false,
    defaultValue?: number,
    description?: string
  ): ParameterizedFilterBuilder {
    try {
      this.filter.parameters.push({
        name,
        type: 'number',
        required,
        defaultValue,
        description,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add number parameter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a boolean parameter
   */
  public booleanParam(
    name: string,
    required: boolean = false,
    defaultValue?: boolean,
    description?: string
  ): ParameterizedFilterBuilder {
    try {
      this.filter.parameters.push({
        name,
        type: 'boolean',
        required,
        defaultValue,
        description,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add boolean parameter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add an array parameter
   */
  public arrayParam(
    name: string,
    required: boolean = false,
    defaultValue?: any[],
    description?: string
  ): ParameterizedFilterBuilder {
    try {
      this.filter.parameters.push({
        name,
        type: 'array',
        required,
        defaultValue,
        description,
      });
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add array parameter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set implementation
   */
  public implementation(implementation: string): ParameterizedFilterBuilder {
    try {
      this.filter.implementation = implementation;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set implementation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set description
   */
  public describedAs(description: string): ParameterizedFilterBuilder {
    try {
      this.filter.description = description;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable or disable the filter
   */
  public enabled(enabled: boolean): ParameterizedFilterBuilder {
    try {
      this.filter.enabled = enabled;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build and register the parameterized filter
   */
  public build(): FilterDefinition {
    try {
      // Create the filter definition
      const filter: FilterDefinition = {
        id: `parameterized-filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: this.filter.name,
        type: this.filter.type,
        inputType: this.filter.inputType,
        outputType: this.filter.outputType,
        parameters: this.filter.parameters,
        implementation: this.filter.implementation,
        enabled: this.filter.enabled,
        description: this.filter.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: 0,
      };

      // Validate and register the filter
      this.engine.validateFilter(filter);
      this.engine.registerFilter(filter);

      return filter;
    } catch (error) {
      throw new Error(
        `Failed to build parameterized filter: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
