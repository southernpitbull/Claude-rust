/**
 * LoopProcessingEngine.ts
 *
 * Iterative template expansion engine for Linear integration with nested loops,
 * collection iteration, index tracking, and AI-powered loop optimization.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface LoopContext {
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
  loop?: {
    index: number;
    first: boolean;
    last: boolean;
    odd: boolean;
    even: boolean;
    length: number;
    item: any;
    key?: string;
  };
}

export interface LoopDefinition {
  id: string;
  name: string;
  collection: string; // Variable name pointing to collection
  itemVariable: string; // Variable name for current item
  keyVariable?: string; // Variable name for current key (for objects)
  indexVariable?: string; // Variable name for current index
  conditions?: LoopCondition[]; // Conditions to filter items
  sorting?: LoopSorting[]; // Sorting options
  limit?: number; // Maximum number of iterations
  offset?: number; // Starting offset
  reverse?: boolean; // Reverse iteration order
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoopCondition {
  variable: string;
  operator: string;
  value: any;
  negate?: boolean;
}

export interface LoopSorting {
  variable: string;
  direction: 'asc' | 'desc';
}

export interface LoopIteration {
  loopId: string;
  iterationIndex: number;
  item: any;
  context: LoopContext;
  renderedContent: string;
  processingTime: number;
  success: boolean;
  error?: string;
}

export interface LoopProcessingResult {
  loopId: string;
  loopName: string;
  iterations: LoopIteration[];
  totalIterations: number;
  successfulIterations: number;
  failedIterations: number;
  totalProcessingTime: number;
  averageIterationTime: number;
  renderedOutput: string;
  success: boolean;
  error?: string;
}

export interface LoopOptimizationSuggestion {
  loopId: string;
  loopName: string;
  suggestion: string;
  confidence: number; // 0-100 percentage
  potentialPerformanceGain: number; // Estimated ms gain
  implementationDifficulty: 'easy' | 'medium' | 'hard';
}

export class LoopProcessingEngine {
  private linearClient: LinearClient;
  private loops: Map<string, LoopDefinition>;
  private iterations: Map<string, LoopIteration[]>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.loops = new Map();
    this.iterations = new Map();
    this.logger = new Logger('LoopProcessingEngine');
  }

  /**
   * Register a loop definition
   */
  public registerLoop(loop: LoopDefinition): void {
    try {
      this.logger.info(`Registering loop: ${loop.name}`);

      // Validate loop
      this.validateLoop(loop);

      this.loops.set(loop.id, loop);

      this.logger.info(`Loop registered successfully: ${loop.name}`);
    } catch (error) {
      this.logger.error(`Failed to register loop: ${loop.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a loop definition
   */
  private validateLoop(loop: LoopDefinition): void {
    try {
      this.logger.info(`Validating loop: ${loop.name}`);

      // Check for required fields
      if (!loop.id) {
        throw new Error('Loop ID is required');
      }

      if (!loop.name) {
        throw new Error('Loop name is required');
      }

      if (!loop.collection) {
        throw new Error('Loop collection is required');
      }

      if (!loop.itemVariable) {
        throw new Error('Loop item variable is required');
      }

      // Validate conditions if present
      if (loop.conditions) {
        for (const condition of loop.conditions) {
          this.validateLoopCondition(condition);
        }
      }

      // Validate sorting if present
      if (loop.sorting) {
        for (const sorting of loop.sorting) {
          this.validateLoopSorting(sorting);
        }
      }

      // Validate limit and offset
      if (loop.limit !== undefined && loop.limit < 0) {
        throw new Error('Loop limit must be greater than or equal to 0');
      }

      if (loop.offset !== undefined && loop.offset < 0) {
        throw new Error('Loop offset must be greater than or equal to 0');
      }

      this.logger.info(`Loop validated successfully: ${loop.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate loop: ${loop.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a loop condition
   */
  private validateLoopCondition(condition: LoopCondition): void {
    try {
      this.logger.info(`Validating loop condition: ${condition.variable} ${condition.operator}`);

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
        `Loop condition validated successfully: ${condition.variable} ${condition.operator}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to validate loop condition: ${condition.variable} ${condition.operator}`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate a loop sorting instruction
   */
  private validateLoopSorting(sorting: LoopSorting): void {
    try {
      this.logger.info(`Validating loop sorting: ${sorting.variable} ${sorting.direction}`);

      if (!sorting.variable) {
        throw new Error('Sorting variable is required');
      }

      if (!sorting.direction) {
        throw new Error('Sorting direction is required');
      }

      if (sorting.direction !== 'asc' && sorting.direction !== 'desc') {
        throw new Error(`Invalid sorting direction: ${sorting.direction}`);
      }

      this.logger.info(
        `Loop sorting validated successfully: ${sorting.variable} ${sorting.direction}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to validate loop sorting: ${sorting.variable} ${sorting.direction}`,
        error
      );
      throw error;
    }
  }

  /**
   * Remove a loop definition
   */
  public removeLoop(loopId: string): boolean {
    try {
      this.logger.info(`Removing loop: ${loopId}`);

      const loop = this.loops.get(loopId);
      if (!loop) {
        this.logger.warn(`Loop not found: ${loopId}`);
        return false;
      }

      const deleted = this.loops.delete(loopId);
      if (deleted) {
        this.logger.info(`Loop removed successfully: ${loop.name}`);
      } else {
        this.logger.warn(`Failed to remove loop: ${loop.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove loop: ${loopId}`, error);
      throw error;
    }
  }

  /**
   * Update a loop definition
   */
  public updateLoop(
    loopId: string,
    updates: Partial<Omit<LoopDefinition, 'id' | 'createdAt'>>
  ): boolean {
    try {
      this.logger.info(`Updating loop: ${loopId}`);

      const loop = this.loops.get(loopId);
      if (!loop) {
        this.logger.warn(`Loop not found: ${loopId}`);
        return false;
      }

      // Update the loop
      Object.assign(loop, updates, {
        updatedAt: new Date(),
      });

      // Re-validate the updated loop
      this.validateLoop(loop);

      // Update in map
      this.loops.set(loopId, loop);

      this.logger.info(`Loop updated successfully: ${loop.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update loop: ${loopId}`, error);
      throw error;
    }
  }

  /**
   * Get a loop definition by ID
   */
  public getLoop(loopId: string): LoopDefinition | undefined {
    return this.loops.get(loopId);
  }

  /**
   * Get all loop definitions
   */
  public getAllLoops(): LoopDefinition[] {
    return Array.from(this.loops.values());
  }

  /**
   * Process a loop with a template
   */
  public async processLoop(
    loopId: string,
    template: string,
    context: LoopContext
  ): Promise<LoopProcessingResult> {
    try {
      this.logger.info(`Processing loop: ${loopId}`);

      const loop = this.loops.get(loopId);
      if (!loop) {
        throw new Error(`Loop not found: ${loopId}`);
      }

      const startTime = Date.now();

      // Get the collection to iterate over
      const collection = this.resolveCollection(loop.collection, context);
      if (!collection) {
        throw new Error(`Collection not found: ${loop.collection}`);
      }

      // Filter the collection if conditions are specified
      let filteredCollection = this.filterCollection(collection, loop.conditions || [], context);

      // Sort the collection if sorting is specified
      if (loop.sorting) {
        filteredCollection = this.sortCollection(filteredCollection, loop.sorting);
      }

      // Apply offset and limit
      if (loop.offset !== undefined) {
        filteredCollection = filteredCollection.slice(loop.offset);
      }

      if (loop.limit !== undefined) {
        filteredCollection = filteredCollection.slice(0, loop.limit);
      }

      // Reverse if specified
      if (loop.reverse) {
        filteredCollection = filteredCollection.reverse();
      }

      // Process each item in the collection
      const iterations: LoopIteration[] = [];
      let renderedOutput = '';

      const collectionLength = Array.isArray(filteredCollection)
        ? filteredCollection.length
        : Object.keys(filteredCollection).length;

      // Iterate over the collection
      if (Array.isArray(filteredCollection)) {
        for (let index = 0; index < filteredCollection.length; index++) {
          const item = filteredCollection[index];
          const iterationStartTime = Date.now();

          try {
            // Create iteration context
            const iterationContext: LoopContext = {
              ...context,
              loop: {
                index,
                first: index === 0,
                last: index === collectionLength - 1,
                odd: index % 2 === 1,
                even: index % 2 === 0,
                length: collectionLength,
                item,
                key: undefined,
              },
            };

            // Add item to context with the specified variable name
            (iterationContext as any)[loop.itemVariable] = item;

            // Add index to context if specified
            if (loop.indexVariable) {
              (iterationContext as any)[loop.indexVariable] = index;
            }

            // Process the template with the iteration context
            const renderedContent = await this.processTemplate(template, iterationContext);

            const iteration: LoopIteration = {
              loopId: loop.id,
              iterationIndex: index,
              item,
              context: iterationContext,
              renderedContent,
              processingTime: Date.now() - iterationStartTime,
              success: true,
            };

            iterations.push(iteration);
            renderedOutput += renderedContent;
          } catch (error) {
            this.logger.error(`Failed to process iteration ${index}`, error);

            const iteration: LoopIteration = {
              loopId: loop.id,
              iterationIndex: index,
              item,
              context: context,
              renderedContent: '',
              processingTime: Date.now() - iterationStartTime,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };

            iterations.push(iteration);
          }
        }
      } else {
        // Handle object iteration
        const entries = Object.entries(filteredCollection);
        for (let index = 0; index < entries.length; index++) {
          const [key, item] = entries[index];
          const iterationStartTime = Date.now();

          try {
            // Create iteration context
            const iterationContext: LoopContext = {
              ...context,
              loop: {
                index,
                first: index === 0,
                last: index === entries.length - 1,
                odd: index % 2 === 1,
                even: index % 2 === 0,
                length: entries.length,
                item,
                key,
              },
            };

            // Add item to context with the specified variable name
            (iterationContext as any)[loop.itemVariable] = item;

            // Add key to context if specified
            if (loop.keyVariable) {
              (iterationContext as any)[loop.keyVariable] = key;
            }

            // Add index to context if specified
            if (loop.indexVariable) {
              (iterationContext as any)[loop.indexVariable] = index;
            }

            // Process the template with the iteration context
            const renderedContent = await this.processTemplate(template, iterationContext);

            const iteration: LoopIteration = {
              loopId: loop.id,
              iterationIndex: index,
              item,
              context: iterationContext,
              renderedContent,
              processingTime: Date.now() - iterationStartTime,
              success: true,
            };

            iterations.push(iteration);
            renderedOutput += renderedContent;
          } catch (error) {
            this.logger.error(`Failed to process iteration ${index}`, error);

            const iteration: LoopIteration = {
              loopId: loop.id,
              iterationIndex: index,
              item,
              context: context,
              renderedContent: '',
              processingTime: Date.now() - iterationStartTime,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };

            iterations.push(iteration);
          }
        }
      }

      // Calculate statistics
      const totalProcessingTime = Date.now() - startTime;
      const successfulIterations = iterations.filter((i) => i.success).length;
      const failedIterations = iterations.filter((i) => !i.success).length;
      const averageIterationTime =
        iterations.length > 0 ? totalProcessingTime / iterations.length : 0;

      const result: LoopProcessingResult = {
        loopId: loop.id,
        loopName: loop.name,
        iterations,
        totalIterations: iterations.length,
        successfulIterations,
        failedIterations,
        totalProcessingTime,
        averageIterationTime,
        renderedOutput,
        success: failedIterations === 0,
      };

      // Store iterations for later analysis
      this.iterations.set(loop.id, iterations);

      this.logger.info(
        `Loop processed successfully: ${loop.name} (${iterations.length} iterations)`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to process loop: ${loopId}`, error);
      throw error;
    }
  }

  /**
   * Resolve a collection variable
   */
  private resolveCollection(collectionName: string, context: LoopContext): any {
    try {
      this.logger.info(`Resolving collection: ${collectionName}`);

      // Handle dot notation (e.g., issue.labels, user.roles)
      if (collectionName.includes('.')) {
        const parts = collectionName.split('.');
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
      switch (collectionName) {
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
          // Check custom variables
          if (context.custom && context.custom.hasOwnProperty(collectionName)) {
            return context.custom[collectionName];
          }

          // Check issue properties
          if (context.issue && (context.issue as any).hasOwnProperty(collectionName)) {
            return (context.issue as any)[collectionName];
          }

          return undefined;
      }
    } catch (error) {
      this.logger.error(`Failed to resolve collection: ${collectionName}`, error);
      return undefined;
    }
  }

  /**
   * Filter a collection based on conditions
   */
  private filterCollection(
    collection: any,
    conditions: LoopCondition[],
    context: LoopContext
  ): any {
    try {
      this.logger.info(`Filtering collection with ${conditions.length} conditions`);

      // If no conditions, return collection as-is
      if (conditions.length === 0) {
        return collection;
      }

      // Handle arrays
      if (Array.isArray(collection)) {
        return collection.filter((item) => {
          // Create context for current item
          const itemContext: LoopContext = {
            ...context,
            custom: {
              ...context.custom,
              item: item,
            },
          };

          // Check all conditions
          return conditions.every((condition) => {
            return this.evaluateCondition(condition, itemContext);
          });
        });
      }

      // Handle objects
      if (typeof collection === 'object' && collection !== null) {
        const filtered: Record<string, any> = {};

        for (const [key, item] of Object.entries(collection)) {
          // Create context for current item
          const itemContext: LoopContext = {
            ...context,
            custom: {
              ...context.custom,
              item: item,
              key: key,
            },
          };

          // Check all conditions
          const meetsAllConditions = conditions.every((condition) => {
            return this.evaluateCondition(condition, itemContext);
          });

          if (meetsAllConditions) {
            filtered[key] = item;
          }
        }

        return filtered;
      }

      // Unsupported collection type
      return collection;
    } catch (error) {
      this.logger.error(`Failed to filter collection`, error);
      throw error;
    }
  }

  /**
   * Sort a collection based on sorting instructions
   */
  private sortCollection(collection: any, sorting: LoopSorting[]): any {
    try {
      this.logger.info(`Sorting collection with ${sorting.length} sortings`);

      // Handle arrays
      if (Array.isArray(collection)) {
        return [...collection].sort((a, b) => {
          // Apply each sorting instruction
          for (const sort of sorting) {
            const aValue = this.getValueAtPath(a, sort.variable);
            const bValue = this.getValueAtPath(b, sort.variable);

            let comparison = 0;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue);
            } else {
              comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }

            if (comparison !== 0) {
              return sort.direction === 'asc' ? comparison : -comparison;
            }
          }

          return 0;
        });
      }

      // Handle objects
      if (typeof collection === 'object' && collection !== null) {
        const entries = Object.entries(collection);

        entries.sort(([keyA, valueA], [keyB, valueB]) => {
          // Apply each sorting instruction
          for (const sort of sorting) {
            const aValue = this.getValueAtPath(valueA, sort.variable);
            const bValue = this.getValueAtPath(valueB, sort.variable);

            let comparison = 0;

            if (typeof aValue === 'string' && typeof bValue === 'string') {
              comparison = aValue.localeCompare(bValue);
            } else {
              comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            }

            if (comparison !== 0) {
              return sort.direction === 'asc' ? comparison : -comparison;
            }
          }

          return 0;
        });

        // Reconstruct the sorted object
        const sorted: Record<string, any> = {};
        for (const [key, value] of entries) {
          sorted[key] = value;
        }

        return sorted;
      }

      // Unsupported collection type
      return collection;
    } catch (error) {
      this.logger.error(`Failed to sort collection`, error);
      throw error;
    }
  }

  /**
   * Get a value at a nested path
   */
  private getValueAtPath(obj: any, path: string): any {
    try {
      if (!path || typeof obj !== 'object') {
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
   * Evaluate a condition against a context
   */
  private evaluateCondition(condition: LoopCondition, context: LoopContext): boolean {
    try {
      this.logger.info(`Evaluating condition: ${condition.variable} ${condition.operator}`);

      // Get the value to compare
      const value = this.getVariableValue(condition.variable, context);

      // Apply negation if specified
      const negate = condition.negate || false;

      // Evaluate the condition
      let result = false;

      switch (condition.operator) {
        case '=':
          result = value == condition.value; // Allow type coercion
          break;
        case '!=':
          result = value != condition.value; // Allow type coercion
          break;
        case '<':
          result = value < condition.value;
          break;
        case '>':
          result = value > condition.value;
          break;
        case '<=':
          result = value <= condition.value;
          break;
        case '>=':
          result = value >= condition.value;
          break;
        case 'starts_with':
          if (typeof value === 'string' && typeof condition.value === 'string') {
            result = value.startsWith(condition.value);
          }
          break;
        case 'ends_with':
          if (typeof value === 'string' && typeof condition.value === 'string') {
            result = value.endsWith(condition.value);
          }
          break;
        case 'contains':
          if (typeof value === 'string' && typeof condition.value === 'string') {
            result = value.includes(condition.value);
          }
          break;
        case 'matches':
          if (typeof value === 'string' && typeof condition.value === 'string') {
            result = value === condition.value;
          }
          break;
        case 'in':
          if (Array.isArray(condition.value)) {
            result = condition.value.includes(value);
          }
          break;
        case 'not_in':
          if (Array.isArray(condition.value)) {
            result = !condition.value.includes(value);
          }
          break;
        case 'exists':
          result = value !== undefined && value !== null;
          break;
        case 'not_exists':
          result = value === undefined || value === null;
          break;
        default:
          this.logger.warn(`Unknown condition operator: ${condition.operator}`);
          result = false;
      }

      // Apply negation
      if (negate) {
        result = !result;
      }

      this.logger.info(
        `Condition ${result ? 'met' : 'not met'}: ${condition.variable} ${condition.operator}`
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate condition: ${condition.variable} ${condition.operator}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get the value of a variable from the context
   */
  private getVariableValue(variableName: string, context: LoopContext): any {
    try {
      this.logger.info(`Getting variable value: ${variableName}`);

      // Handle dot notation (e.g., item.name, issue.title)
      if (variableName.includes('.')) {
        const parts = variableName.split('.');
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
      switch (variableName) {
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
        case 'item':
          return context.loop?.item;
        case 'index':
          return context.loop?.index;
        case 'first':
          return context.loop?.first;
        case 'last':
          return context.loop?.last;
        case 'odd':
          return context.loop?.odd;
        case 'even':
          return context.loop?.even;
        case 'length':
          return context.loop?.length;
        case 'key':
          return context.loop?.key;
        default:
          // Check custom variables
          if (context.custom && context.custom.hasOwnProperty(variableName)) {
            return context.custom[variableName];
          }

          // Check loop variables
          if (context.loop && (context.loop as any).hasOwnProperty(variableName)) {
            return (context.loop as any)[variableName];
          }

          // Check issue properties
          if (context.issue && (context.issue as any).hasOwnProperty(variableName)) {
            return (context.issue as any)[variableName];
          }

          return undefined;
      }
    } catch (error) {
      this.logger.error(`Failed to get variable value: ${variableName}`, error);
      return undefined;
    }
  }

  /**
   * Process a template with a context
   */
  private async processTemplate(template: string, context: LoopContext): Promise<string> {
    try {
      this.logger.info('Processing template with context');

      // Simple template processing - replace {{variable}} with values
      let result = template;

      // Handle complex replacements with loop context
      if (context.loop) {
        // Replace loop-specific variables
        result = result.replace(/{{\s*index\s*}}/g, String(context.loop.index));
        result = result.replace(/{{\s*first\s*}}/g, String(context.loop.first));
        result = result.replace(/{{\s*last\s*}}/g, String(context.loop.last));
        result = result.replace(/{{\s*odd\s*}}/g, String(context.loop.odd));
        result = result.replace(/{{\s*even\s*}}/g, String(context.loop.even));
        result = result.replace(/{{\s*length\s*}}/g, String(context.loop.length));

        if (context.loop.key) {
          result = result.replace(/{{\s*key\s*}}/g, String(context.loop.key));
        }
      }

      // Replace custom variables
      for (const [key, value] of Object.entries(context.custom)) {
        result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
      }

      this.logger.info('Template processed successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to process template', error);
      throw error;
    }
  }

  /**
   * Process multiple loops in parallel
   */
  public async processLoopsInParallel(
    loopProcesses: Array<{ loopId: string; template: string; context: LoopContext }>
  ): Promise<LoopProcessingResult[]> {
    try {
      this.logger.info(`Processing ${loopProcesses.length} loops in parallel`);

      const results = await Promise.all(
        loopProcesses.map(async (process) => {
          try {
            return await this.processLoop(process.loopId, process.template, process.context);
          } catch (error) {
            this.logger.error(`Failed to process loop: ${process.loopId}`, error);
            return {
              loopId: process.loopId,
              loopName: 'Unknown',
              iterations: [],
              totalIterations: 0,
              successfulIterations: 0,
              failedIterations: 0,
              totalProcessingTime: 0,
              averageIterationTime: 0,
              renderedOutput: '',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            } satisfies LoopProcessingResult;
          }
        })
      );

      this.logger.info(`${loopProcesses.length} loops processed in parallel`);
      return results;
    } catch (error) {
      this.logger.error('Failed to process loops in parallel', error);
      throw error;
    }
  }

  /**
   * Process nested loops
   */
  public async processNestedLoops(
    outerLoopId: string,
    innerLoops: Array<{ loopId: string; template: string }>,
    template: string,
    context: LoopContext
  ): Promise<LoopProcessingResult> {
    try {
      this.logger.info(`Processing nested loops with outer loop: ${outerLoopId}`);

      // Process the outer loop first
      const outerResult = await this.processLoop(outerLoopId, template, context);

      if (!outerResult.success) {
        throw new Error(`Outer loop failed: ${outerResult.error}`);
      }

      // Process inner loops for each iteration of the outer loop
      const nestedResults: LoopProcessingResult[] = [];

      for (const iteration of outerResult.iterations) {
        if (iteration.success) {
          // Update context with current iteration data
          const iterationContext: LoopContext = {
            ...iteration.context,
          };

          // Process each inner loop
          for (const innerLoop of innerLoops) {
            try {
              const innerResult = await this.processLoop(
                innerLoop.loopId,
                innerLoop.template,
                iterationContext
              );

              nestedResults.push(innerResult);

              // Append inner loop output to iteration content
              if (innerResult.success) {
                iteration.renderedContent += innerResult.renderedOutput;
              }
            } catch (error) {
              this.logger.error(`Failed to process inner loop: ${innerLoop.loopId}`, error);
            }
          }
        }
      }

      this.logger.info(`Nested loops processed successfully`);
      return outerResult;
    } catch (error) {
      this.logger.error(`Failed to process nested loops`, error);
      throw error;
    }
  }

  /**
   * Get loop processing statistics
   */
  public getLoopStats(): {
    totalLoops: number;
    totalIterations: number;
    averageIterationsPerLoop: number;
    successRate: number;
    mostUsedLoops: Array<{ loop: LoopDefinition; iterations: number }>;
    performanceStats: {
      fastestLoop: { loopId: string; averageTime: number } | null;
      slowestLoop: { loopId: string; averageTime: number } | null;
      averageProcessingTime: number;
    };
  } {
    try {
      this.logger.info('Generating loop statistics');

      const loops = Array.from(this.loops.values());
      const stats = {
        totalLoops: loops.length,
        totalIterations: 0,
        averageIterationsPerLoop: 0,
        successRate: 0,
        mostUsedLoops: [] as Array<{ loop: LoopDefinition; iterations: number }>,
        performanceStats: {
          fastestLoop: null as { loopId: string; averageTime: number } | null,
          slowestLoop: null as { loopId: string; averageTime: number } | null,
          averageProcessingTime: 0,
        },
      };

      // Calculate statistics from iterations
      const allIterations = Array.from(this.iterations.values()).flat();
      stats.totalIterations = allIterations.length;

      // Calculate average iterations per loop
      stats.averageIterationsPerLoop = loops.length > 0 ? stats.totalIterations / loops.length : 0;

      // Calculate success rate
      const successfulIterations = allIterations.filter((i) => i.success).length;
      stats.successRate =
        allIterations.length > 0 ? (successfulIterations / allIterations.length) * 100 : 0;

      // Find most used loops
      const loopUsage = new Map<string, number>();
      for (const iteration of allIterations) {
        const count = loopUsage.get(iteration.loopId) || 0;
        loopUsage.set(iteration.loopId, count + 1);
      }

      const sortedLoops = Array.from(loopUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      stats.mostUsedLoops = sortedLoops.map(([loopId, count]) => {
        const loop = this.loops.get(loopId);
        if (!loop) {
          throw new Error(`Loop not found: ${loopId}`);
        }
        return { loop, iterations: count };
      });

      // Calculate performance statistics
      const processingTimes = allIterations.map((i) => i.processingTime);
      const totalTime = processingTimes.reduce((sum, time) => sum + time, 0);
      stats.performanceStats.averageProcessingTime =
        processingTimes.length > 0 ? totalTime / processingTimes.length : 0;

      if (processingTimes.length > 0) {
        const minTime = Math.min(...processingTimes);
        const maxTime = Math.max(...processingTimes);

        // Find loops with min and max times
        const minIteration = allIterations.find((i) => i.processingTime === minTime);
        const maxIteration = allIterations.find((i) => i.processingTime === maxTime);

        if (minIteration) {
          stats.performanceStats.fastestLoop = {
            loopId: minIteration.loopId,
            averageTime: minTime,
          };
        }

        if (maxIteration) {
          stats.performanceStats.slowestLoop = {
            loopId: maxIteration.loopId,
            averageTime: maxTime,
          };
        }
      }

      this.logger.info('Loop statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate loop statistics', error);
      throw error;
    }
  }

  /**
   * Find loops that could be optimized
   */
  public findOptimizationOpportunities(): LoopOptimizationSuggestion[] {
    try {
      this.logger.info('Finding loop optimization opportunities');

      const suggestions: LoopOptimizationSuggestion[] = [];
      const loops = Array.from(this.loops.values());

      for (const loop of loops) {
        // Suggestion 1: Loops with too many iterations
        const iterations = this.iterations.get(loop.id) || [];
        if (iterations.length > 100) {
          suggestions.push({
            loopId: loop.id,
            loopName: loop.name,
            suggestion: `Loop iterates ${iterations.length} times. Consider pagination or limiting.`,
            confidence: 90,
            potentialPerformanceGain: iterations.length * 5, // estimated 5ms savings per iteration
            implementationDifficulty: 'easy',
          });
        }

        // Suggestion 2: Loops with high failure rate
        const successCount = iterations.filter((i) => i.success).length;
        const failureRate =
          iterations.length > 0 ? (1 - successCount / iterations.length) * 100 : 0;

        if (failureRate > 10) {
          suggestions.push({
            loopId: loop.id,
            loopName: loop.name,
            suggestion: `Loop has high failure rate (${failureRate.toFixed(1)}%). Check condition logic.`,
            confidence: 85,
            potentialPerformanceGain: 0, // No performance gain, just stability
            implementationDifficulty: 'medium',
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
   * Create a default set of commonly used loops
   */
  public createDefaultLoops(): void {
    try {
      this.logger.info('Creating default loops');

      // Loop for issue comments
      const commentsLoop: LoopDefinition = {
        id: `loop-comments-${Date.now()}`,
        name: 'Issue Comments',
        collection: 'issue.comments',
        itemVariable: 'comment',
        indexVariable: 'commentIndex',
        description: 'Iterate over issue comments',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.registerLoop(commentsLoop);

      // Loop for issue labels
      const labelsLoop: LoopDefinition = {
        id: `loop-labels-${Date.now()}`,
        name: 'Issue Labels',
        collection: 'issue.labels',
        itemVariable: 'label',
        indexVariable: 'labelIndex',
        description: 'Iterate over issue labels',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.registerLoop(labelsLoop);

      // Loop for team members
      const teamMembersLoop: LoopDefinition = {
        id: `loop-team-members-${Date.now()}`,
        name: 'Team Members',
        collection: 'team.members',
        itemVariable: 'member',
        indexVariable: 'memberIndex',
        description: 'Iterate over team members',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.registerLoop(teamMembersLoop);

      this.logger.info('Default loops created successfully');
    } catch (error) {
      this.logger.error('Failed to create default loops', error);
      throw error;
    }
  }

  /**
   * Export loop definitions
   */
  public exportLoops(): LoopDefinition[] {
    try {
      this.logger.info('Exporting loop definitions');

      const loops = Array.from(this.loops.values());

      this.logger.info(`Exported ${loops.length} loop definitions`);
      return loops;
    } catch (error) {
      this.logger.error('Failed to export loop definitions', error);
      throw error;
    }
  }

  /**
   * Import loop definitions
   */
  public importLoops(loops: LoopDefinition[]): void {
    try {
      this.logger.info(`Importing ${loops.length} loop definitions`);

      // Clear existing loops
      this.loops.clear();

      // Import new loops
      for (const loop of loops) {
        try {
          this.validateLoop(loop);
          this.loops.set(loop.id, loop);
        } catch (error) {
          this.logger.error(`Failed to import loop: ${loop.name}`, error);
        }
      }

      this.logger.info(`Imported ${Array.from(this.loops.values()).length} loop definitions`);
    } catch (error) {
      this.logger.error('Failed to import loop definitions', error);
      throw error;
    }
  }

  /**
   * Test a loop with sample data
   */
  public async testLoop(
    loop: LoopDefinition,
    template: string,
    sampleContext: Partial<LoopContext>
  ): Promise<{
    success: boolean;
    result?: LoopProcessingResult;
    errors: string[];
  }> {
    try {
      this.logger.info(`Testing loop: ${loop.name}`);

      // Create a test context
      const context: LoopContext = {
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
          labels: [
            { id: 'label-1', name: 'bug', color: '#e11d21' },
            { id: 'label-2', name: 'feature', color: '#0052cc' },
          ],
          comments: [
            {
              id: 'comment-1',
              body: 'Test comment 1',
              createdAt: new Date().toISOString(),
              user: { id: 'user-1', name: 'Test User' },
            },
            {
              id: 'comment-2',
              body: 'Test comment 2',
              createdAt: new Date().toISOString(),
              user: { id: 'user-2', name: 'Another User' },
            },
          ],
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

      // Register the loop temporarily
      this.registerLoop(loop);

      // Process the loop
      const result = await this.processLoop(loop.id, template, context);

      // Clean up
      this.removeLoop(loop.id);

      return {
        success: true,
        result,
        errors: [],
      };
    } catch (error) {
      this.logger.error(`Failed to test loop: ${loop.name}`, error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create a complex loop with nested iterations
   */
  public createComplexLoop(
    name: string,
    collections: Array<{ collection: string; itemVariable: string; conditions?: LoopCondition[] }>,
    sorting?: LoopSorting[]
  ): LoopDefinition {
    try {
      this.logger.info(`Creating complex loop: ${name}`);

      // For now, we'll create a simple loop with the first collection
      // In a real implementation, we'd create a loop that handles nested iterations

      const loop: LoopDefinition = {
        id: `complex-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        collection: collections[0].collection,
        itemVariable: collections[0].itemVariable,
        conditions: collections[0].conditions,
        sorting,
        description: `Complex loop iterating over ${collections[0].collection}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.validateLoop(loop);
      this.registerLoop(loop);

      this.logger.info(`Complex loop created successfully: ${name}`);
      return loop;
    } catch (error) {
      this.logger.error(`Failed to create complex loop: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a loop with conditional filtering
   */
  public createFilteredLoop(
    name: string,
    collection: string,
    itemVariable: string,
    conditions: LoopCondition[]
  ): LoopDefinition {
    try {
      this.logger.info(`Creating filtered loop: ${name}`);

      const loop: LoopDefinition = {
        id: `filtered-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        collection,
        itemVariable,
        conditions,
        description: `Filtered loop with ${conditions.length} conditions`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.validateLoop(loop);
      this.registerLoop(loop);

      this.logger.info(`Filtered loop created successfully: ${name}`);
      return loop;
    } catch (error) {
      this.logger.error(`Failed to create filtered loop: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a loop with sorting
   */
  public createSortedLoop(
    name: string,
    collection: string,
    itemVariable: string,
    sorting: LoopSorting[]
  ): LoopDefinition {
    try {
      this.logger.info(`Creating sorted loop: ${name}`);

      const loop: LoopDefinition = {
        id: `sorted-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        collection,
        itemVariable,
        sorting,
        description: `Sorted loop with ${sorting.length} sortings`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.validateLoop(loop);
      this.registerLoop(loop);

      this.logger.info(`Sorted loop created successfully: ${name}`);
      return loop;
    } catch (error) {
      this.logger.error(`Failed to create sorted loop: ${name}`, error);
      throw error;
    }
  }

  /**
   * Create a loop with limits and offsets
   */
  public createPaginatedLoop(
    name: string,
    collection: string,
    itemVariable: string,
    limit?: number,
    offset?: number,
    reverse?: boolean
  ): LoopDefinition {
    try {
      this.logger.info(`Creating paginated loop: ${name}`);

      const loop: LoopDefinition = {
        id: `paginated-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        collection,
        itemVariable,
        limit,
        offset,
        reverse,
        description: `Paginated loop with limit=${limit}, offset=${offset}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.validateLoop(loop);
      this.registerLoop(loop);

      this.logger.info(`Paginated loop created successfully: ${name}`);
      return loop;
    } catch (error) {
      this.logger.error(`Failed to create paginated loop: ${name}`, error);
      throw error;
    }
  }

  /**
   * Get all iterations for a specific loop
   */
  public getLoopIterations(loopId: string): LoopIteration[] {
    try {
      this.logger.info(`Getting iterations for loop: ${loopId}`);

      const iterations = this.iterations.get(loopId) || [];

      this.logger.info(`Found ${iterations.length} iterations for loop: ${loopId}`);
      return [...iterations];
    } catch (error) {
      this.logger.error(`Failed to get iterations for loop: ${loopId}`, error);
      throw error;
    }
  }

  /**
   * Clear iterations for a loop
   */
  public clearLoopIterations(loopId: string): boolean {
    try {
      this.logger.info(`Clearing iterations for loop: ${loopId}`);

      const hadIterations = this.iterations.has(loopId);
      this.iterations.delete(loopId);

      if (hadIterations) {
        this.logger.info(`Cleared iterations for loop: ${loopId}`);
      } else {
        this.logger.info(`No iterations found for loop: ${loopId}`);
      }

      return hadIterations;
    } catch (error) {
      this.logger.error(`Failed to clear iterations for loop: ${loopId}`, error);
      throw error;
    }
  }

  /**
   * Clear all iterations
   */
  public clearAllIterations(): void {
    try {
      this.logger.info('Clearing all loop iterations');

      this.iterations.clear();

      this.logger.info('All loop iterations cleared');
    } catch (error) {
      this.logger.error('Failed to clear all loop iterations', error);
      throw error;
    }
  }

  /**
   * Get failed iterations for debugging
   */
  public getFailedIterations(): LoopIteration[] {
    try {
      this.logger.info('Getting failed iterations');

      const allIterations = Array.from(this.iterations.values()).flat();
      const failedIterations = allIterations.filter((i) => !i.success);

      this.logger.info(`Found ${failedIterations.length} failed iterations`);
      return failedIterations;
    } catch (error) {
      this.logger.error('Failed to get failed iterations', error);
      throw error;
    }
  }

  /**
   * Enable or disable a loop
   */
  public setLoopEnabled(loopId: string, enabled: boolean): boolean {
    return this.updateLoop(loopId, { enabled });
  }

  /**
   * Set loop description
   */
  public setLoopDescription(loopId: string, description: string): boolean {
    return this.updateLoop(loopId, { description });
  }

  /**
   * Create a builder for fluent API
   */
  public loopBuilder(name: string): LoopBuilder {
    return new LoopBuilder(this, name);
  }

  /**
   * Validate loop context
   */
  public validateLoopContext(context: LoopContext): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating loop context');

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

      this.logger.info(`Loop context validation completed: ${result.valid ? 'valid' : 'invalid'}`);
      return result;
    } catch (error) {
      this.logger.error('Failed to validate loop context', error);
      throw error;
    }
  }

  /**
   * Create a safe context for loop processing
   */
  public createSafeContext(context: LoopContext): LoopContext {
    try {
      this.logger.info('Creating safe loop context');

      // Deep clone the context to prevent mutations
      const safeContext: LoopContext = JSON.parse(JSON.stringify(context));

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

      this.logger.info('Safe loop context created');
      return safeContext;
    } catch (error) {
      this.logger.error('Failed to create safe loop context', error);
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
   * Create a loop condition
   */
  public createCondition(
    variable: string,
    operator: string,
    value: any,
    negate?: boolean
  ): LoopCondition {
    try {
      this.logger.info(`Creating loop condition: ${variable} ${operator}`);

      const condition: LoopCondition = {
        variable,
        operator,
        value,
        negate,
      };

      this.validateLoopCondition(condition);

      this.logger.info(`Loop condition created successfully: ${variable} ${operator}`);
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create loop condition: ${variable} ${operator}`, error);
      throw error;
    }
  }

  /**
   * Create a loop sorting instruction
   */
  public createSorting(variable: string, direction: 'asc' | 'desc' = 'asc'): LoopSorting {
    try {
      this.logger.info(`Creating loop sorting: ${variable} ${direction}`);

      const sorting: LoopSorting = {
        variable,
        direction,
      };

      this.validateLoopSorting(sorting);

      this.logger.info(`Loop sorting created successfully: ${variable} ${direction}`);
      return sorting;
    } catch (error) {
      this.logger.error(`Failed to create loop sorting: ${variable} ${direction}`, error);
      throw error;
    }
  }

  /**
   * Batch process multiple contexts
   */
  public async batchProcess(
    loopId: string,
    template: string,
    contexts: LoopContext[]
  ): Promise<LoopProcessingResult[]> {
    try {
      this.logger.info(`Batch processing ${contexts.length} contexts for loop: ${loopId}`);

      const results = await Promise.all(
        contexts.map(async (context, index) => {
          try {
            this.logger.info(`Processing context ${index + 1}/${contexts.length}`);
            return await this.processLoop(loopId, template, context);
          } catch (error) {
            this.logger.error(`Failed to process context ${index + 1}`, error);
            return {
              loopId,
              loopName: 'Unknown',
              iterations: [],
              totalIterations: 0,
              successfulIterations: 0,
              failedIterations: 0,
              totalProcessingTime: 0,
              averageIterationTime: 0,
              renderedOutput: '',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            } satisfies LoopProcessingResult;
          }
        })
      );

      this.logger.info(`Batch processing completed for ${contexts.length} contexts`);
      return results;
    } catch (error) {
      this.logger.error('Failed to batch process contexts', error);
      throw error;
    }
  }

  /**
   * Create a simple loop with basic configuration
   */
  public createSimpleLoop(name: string, collection: string, itemVariable: string): LoopDefinition {
    try {
      this.logger.info(`Creating simple loop: ${name}`);

      const loop: LoopDefinition = {
        id: `simple-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        collection,
        itemVariable,
        description: `Simple loop iterating over ${collection}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.validateLoop(loop);
      this.registerLoop(loop);

      this.logger.info(`Simple loop created successfully: ${name}`);
      return loop;
    } catch (error) {
      this.logger.error(`Failed to create simple loop: ${name}`, error);
      throw error;
    }
  }
}

/**
 * Fluent API for building complex loops
 */
export class LoopBuilder {
  private engine: LoopProcessingEngine;
  private loop: Omit<LoopDefinition, 'id' | 'createdAt' | 'updatedAt'>;

  constructor(engine: LoopProcessingEngine, name: string) {
    this.engine = engine;
    this.loop = {
      name,
      collection: '',
      itemVariable: '',
      description: `Loop: ${name}`,
      conditions: [],
      sorting: [],
      enabled: true,
    };
  }

  /**
   * Set the collection to iterate over
   */
  public iterateOver(collection: string): LoopBuilder {
    try {
      this.loop.collection = collection;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set the item variable name
   */
  public as(itemVariable: string): LoopBuilder {
    try {
      this.loop.itemVariable = itemVariable;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set item variable: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set the key variable name (for object iteration)
   */
  public withKey(keyVariable: string): LoopBuilder {
    try {
      this.loop.keyVariable = keyVariable;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set key variable: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set the index variable name
   */
  public withIndex(indexVariable: string): LoopBuilder {
    try {
      this.loop.indexVariable = indexVariable;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set index variable: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a condition to filter items
   */
  public where(variable: string, operator: string, value: any, negate?: boolean): LoopBuilder {
    try {
      if (!this.loop.conditions) {
        this.loop.conditions = [];
      }

      this.loop.conditions.push({
        variable,
        operator,
        value,
        negate,
      });

      return this;
    } catch (error) {
      throw new Error(
        `Failed to add condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add sorting
   */
  public orderBy(variable: string, direction: 'asc' | 'desc' = 'asc'): LoopBuilder {
    try {
      if (!this.loop.sorting) {
        this.loop.sorting = [];
      }

      this.loop.sorting.push({
        variable,
        direction,
      });

      return this;
    } catch (error) {
      throw new Error(
        `Failed to add sorting: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set limit
   */
  public limit(limit: number): LoopBuilder {
    try {
      this.loop.limit = limit;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set limit: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set offset
   */
  public offset(offset: number): LoopBuilder {
    try {
      this.loop.offset = offset;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set offset: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable reverse iteration
   */
  public reverse(): LoopBuilder {
    try {
      this.loop.reverse = true;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to enable reverse: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set description
   */
  public describedAs(description: string): LoopBuilder {
    try {
      this.loop.description = description;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable or disable the loop
   */
  public enabled(enabled: boolean): LoopBuilder {
    try {
      this.loop.enabled = enabled;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build and register the loop
   */
  public build(): LoopDefinition {
    try {
      // Create the loop definition
      const loop: LoopDefinition = {
        id: `builder-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: this.loop.name,
        collection: this.loop.collection,
        itemVariable: this.loop.itemVariable,
        keyVariable: this.loop.keyVariable,
        indexVariable: this.loop.indexVariable,
        conditions: this.loop.conditions,
        sorting: this.loop.sorting,
        limit: this.loop.limit,
        offset: this.loop.offset,
        reverse: this.loop.reverse,
        description: this.loop.description,
        enabled: this.loop.enabled !== false, // Default to true
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate and register the loop
      this.engine.validateLoop(loop);
      this.engine.registerLoop(loop);

      return loop;
    } catch (error) {
      throw new Error(
        `Failed to build loop: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
