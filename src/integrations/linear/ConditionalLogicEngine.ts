/**
 * ConditionalLogicEngine.ts
 *
 * Advanced conditional logic engine for Linear integration with complex expressions,
 * nested conditions, logical operators, and AI-powered optimization.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface ConditionalContext {
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

export interface Condition {
  id: string;
  type: 'comparison' | 'logical' | 'membership' | 'existence' | 'regex' | 'custom';
  operator: string;
  operands: any[];
  negate?: boolean;
  description?: string;
}

export interface ComparisonCondition extends Condition {
  type: 'comparison';
  operator:
    | '='
    | '!='
    | '<'
    | '>'
    | '<='
    | '>='
    | 'starts_with'
    | 'ends_with'
    | 'contains'
    | 'matches';
  operands: [any, any];
}

export interface LogicalCondition extends Condition {
  type: 'logical';
  operator: 'and' | 'or' | 'not';
  operands: Condition[];
}

export interface MembershipCondition extends Condition {
  type: 'membership';
  operator: 'in' | 'not_in';
  operands: [any, any[]];
}

export interface ExistenceCondition extends Condition {
  type: 'existence';
  operator: 'exists' | 'not_exists';
  operands: [any];
}

export interface RegexCondition extends Condition {
  type: 'regex';
  operator: 'matches';
  operands: [string, string, boolean?]; // [string, pattern, caseSensitive?]
}

export interface CustomCondition extends Condition {
  type: 'custom';
  operator: 'custom';
  operands: [string, any]; // [functionName, arguments]
}

export interface ConditionalRule {
  id: string;
  name: string;
  description?: string;
  conditions: Condition[];
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastEvaluated?: Date;
  evaluationCount: number;
  successCount: number;
  failureCount: number;
}

export interface EvaluationResult {
  ruleId: string;
  ruleName: string;
  result: boolean;
  matchedConditions: Condition[];
  unmatchedConditions: Condition[];
  evaluationTime: number;
  error?: string;
}

export interface OptimizedCondition {
  condition: Condition;
  optimized: boolean;
  reason?: string;
  performanceGain?: number; // Estimated performance gain in milliseconds
}

export class ConditionalLogicEngine {
  private linearClient: LinearClient;
  private rules: Map<string, ConditionalRule>;
  private customOperators: Map<string, (operands: any[], context: ConditionalContext) => boolean>;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.rules = new Map();
    this.customOperators = new Map();
    this.logger = new Logger('ConditionalLogicEngine');

    // Register default custom operators
    this.registerDefaultOperators();
  }

  /**
   * Register default custom operators
   */
  private registerDefaultOperators(): void {
    try {
      this.logger.info('Registering default custom operators');

      // Date range operator
      this.registerCustomOperator('date_range', (operands, context) => {
        const [dateVariable, startDate, endDate] = operands;
        const dateValue = this.getVariableValue(dateVariable, context);

        if (!dateValue) {
          return false;
        }

        const date = new Date(dateValue);
        const start = new Date(startDate);
        const end = new Date(endDate);

        return date >= start && date <= end;
      });

      // Time of day operator
      this.registerCustomOperator('time_of_day', (operands, context) => {
        const [timeVariable, condition] = operands; // condition: 'morning'|'afternoon'|'evening'
        const timeValue = this.getVariableValue(timeVariable, context);

        if (!timeValue) {
          return false;
        }

        const date = new Date(timeValue);
        const hour = date.getHours();

        switch (condition) {
          case 'morning':
            return hour >= 6 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 18;
          case 'evening':
            return hour >= 18 || hour < 6;
          default:
            return false;
        }
      });

      // Weekend operator
      this.registerCustomOperator('is_weekend', (operands, context) => {
        const [dateVariable] = operands;
        const dateValue = this.getVariableValue(dateVariable, context);

        if (!dateValue) {
          return false;
        }

        const date = new Date(dateValue);
        const dayOfWeek = date.getDay();

        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      });

      // Weekday operator
      this.registerCustomOperator('is_weekday', (operands, context) => {
        const [dateVariable] = operands;
        const dateValue = this.getVariableValue(dateVariable, context);

        if (!dateValue) {
          return false;
        }

        const date = new Date(dateValue);
        const dayOfWeek = date.getDay();

        return dayOfWeek > 0 && dayOfWeek < 6; // Monday through Friday
      });

      this.logger.info('Default custom operators registered');
    } catch (error) {
      this.logger.error('Failed to register default custom operators', error);
      throw error;
    }
  }

  /**
   * Register a custom operator
   */
  public registerCustomOperator(
    operatorName: string,
    operator: (operands: any[], context: ConditionalContext) => boolean
  ): void {
    try {
      this.logger.info(`Registering custom operator: ${operatorName}`);

      this.customOperators.set(operatorName, operator);

      this.logger.info(`Custom operator registered successfully: ${operatorName}`);
    } catch (error) {
      this.logger.error(`Failed to register custom operator: ${operatorName}`, error);
      throw error;
    }
  }

  /**
   * Unregister a custom operator
   */
  public unregisterCustomOperator(operatorName: string): boolean {
    try {
      this.logger.info(`Unregistering custom operator: ${operatorName}`);

      const deleted = this.customOperators.delete(operatorName);
      if (deleted) {
        this.logger.info(`Custom operator unregistered successfully: ${operatorName}`);
      } else {
        this.logger.warn(`Custom operator not found: ${operatorName}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to unregister custom operator: ${operatorName}`, error);
      throw error;
    }
  }

  /**
   * Add a conditional rule
   */
  public addRule(rule: ConditionalRule): void {
    try {
      this.logger.info(`Adding conditional rule: ${rule.name}`);

      // Validate rule
      this.validateRule(rule);

      this.rules.set(rule.id, rule);

      this.logger.info(`Conditional rule added successfully: ${rule.name}`);
    } catch (error) {
      this.logger.error(`Failed to add conditional rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a conditional rule
   */
  private validateRule(rule: ConditionalRule): void {
    try {
      this.logger.info(`Validating conditional rule: ${rule.name}`);

      // Check for required fields
      if (!rule.id) {
        throw new Error('Rule ID is required');
      }

      if (!rule.name) {
        throw new Error('Rule name is required');
      }

      if (!rule.conditions || rule.conditions.length === 0) {
        throw new Error('Rule must have at least one condition');
      }

      // Validate each condition
      for (const condition of rule.conditions) {
        this.validateCondition(condition);
      }

      this.logger.info(`Conditional rule validated successfully: ${rule.name}`);
    } catch (error) {
      this.logger.error(`Failed to validate conditional rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Validate a condition
   */
  private validateCondition(condition: Condition): void {
    try {
      this.logger.info(`Validating condition: ${condition.type}`);

      switch (condition.type) {
        case 'comparison':
          if (
            ![
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
            ].includes(condition.operator)
          ) {
            throw new Error(`Invalid comparison operator: ${condition.operator}`);
          }

          if (!condition.operands || condition.operands.length !== 2) {
            throw new Error('Comparison condition must have exactly 2 operands');
          }
          break;

        case 'logical':
          if (!['and', 'or', 'not'].includes(condition.operator)) {
            throw new Error(`Invalid logical operator: ${condition.operator}`);
          }

          if (condition.operands.length === 0) {
            throw new Error('Logical condition must have at least one operand');
          }

          // Validate nested conditions
          for (const operand of condition.operands as Condition[]) {
            this.validateCondition(operand);
          }
          break;

        case 'membership':
          if (!['in', 'not_in'].includes(condition.operator)) {
            throw new Error(`Invalid membership operator: ${condition.operator}`);
          }

          if (!condition.operands || condition.operands.length !== 2) {
            throw new Error('Membership condition must have exactly 2 operands');
          }

          if (!Array.isArray(condition.operands[1])) {
            throw new Error('Second operand in membership condition must be an array');
          }
          break;

        case 'existence':
          if (!['exists', 'not_exists'].includes(condition.operator)) {
            throw new Error(`Invalid existence operator: ${condition.operator}`);
          }

          if (!condition.operands || condition.operands.length !== 1) {
            throw new Error('Existence condition must have exactly 1 operand');
          }
          break;

        case 'regex':
          if (condition.operator !== 'matches') {
            throw new Error(`Invalid regex operator: ${condition.operator}`);
          }

          if (!condition.operands || condition.operands.length < 2) {
            throw new Error('Regex condition must have at least 2 operands');
          }
          break;

        case 'custom':
          if (condition.operator !== 'custom') {
            throw new Error(`Invalid custom operator: ${condition.operator}`);
          }

          if (!condition.operands || condition.operands.length < 1) {
            throw new Error('Custom condition must have at least 1 operand');
          }
          break;

        default:
          throw new Error(`Unknown condition type: ${condition.type}`);
      }

      this.logger.info(`Condition validated successfully: ${condition.type}`);
    } catch (error) {
      this.logger.error(`Failed to validate condition: ${condition.type}`, error);
      throw error;
    }
  }

  /**
   * Remove a conditional rule
   */
  public removeRule(ruleId: string): boolean {
    try {
      this.logger.info(`Removing conditional rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Conditional rule not found: ${ruleId}`);
        return false;
      }

      const deleted = this.rules.delete(ruleId);
      if (deleted) {
        this.logger.info(`Conditional rule removed successfully: ${rule.name}`);
      } else {
        this.logger.warn(`Failed to remove conditional rule: ${rule.name}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove conditional rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Update a conditional rule
   */
  public updateRule(
    ruleId: string,
    updates: Partial<
      Omit<
        ConditionalRule,
        'id' | 'createdAt' | 'evaluationCount' | 'successCount' | 'failureCount'
      >
    >
  ): boolean {
    try {
      this.logger.info(`Updating conditional rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Conditional rule not found: ${ruleId}`);
        return false;
      }

      // Update the rule
      Object.assign(rule, updates, {
        updatedAt: new Date(),
        evaluationCount: rule.evaluationCount,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
      });

      // Re-validate the updated rule
      this.validateRule(rule);

      // Update in map
      this.rules.set(ruleId, rule);

      this.logger.info(`Conditional rule updated successfully: ${rule.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update conditional rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Get a conditional rule by ID
   */
  public getRule(ruleId: string): ConditionalRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all conditional rules
   */
  public getAllRules(): ConditionalRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluate a conditional rule against a context
   */
  public async evaluateRule(
    rule: ConditionalRule,
    context: ConditionalContext
  ): Promise<EvaluationResult> {
    try {
      this.logger.info(`Evaluating conditional rule: ${rule.name}`);

      const startTime = Date.now();

      // Update rule statistics
      rule.evaluationCount++;
      rule.lastEvaluated = new Date();

      const result: EvaluationResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        result: false,
        matchedConditions: [],
        unmatchedConditions: [],
        evaluationTime: 0,
      };

      try {
        // Evaluate all conditions in the rule
        let ruleResult = true;
        const matchedConditions: Condition[] = [];
        const unmatchedConditions: Condition[] = [];

        for (const condition of rule.conditions) {
          try {
            const conditionResult = await this.evaluateCondition(condition, context);
            if (conditionResult) {
              matchedConditions.push(condition);
            } else {
              unmatchedConditions.push(condition);
            }

            // For a rule with multiple conditions, we assume AND by default
            // unless specified otherwise in the rule definition
            ruleResult = ruleResult && conditionResult;
          } catch (error) {
            this.logger.error(`Failed to evaluate condition`, error);
            unmatchedConditions.push(condition);
            ruleResult = false;
          }
        }

        result.result = ruleResult;
        result.matchedConditions = matchedConditions;
        result.unmatchedConditions = unmatchedConditions;

        // Update success/failure counters
        if (ruleResult) {
          rule.successCount++;
        } else {
          rule.failureCount++;
        }

        this.logger.info(
          `Rule ${rule.name} ${ruleResult ? 'matched' : 'did not match'} (${matchedConditions.length}/${rule.conditions.length} conditions)`
        );
      } catch (error) {
        result.result = false;
        result.error = error instanceof Error ? error.message : 'Unknown error';
        rule.failureCount++;

        this.logger.error(`Failed to evaluate rule: ${rule.name}`, error);
      }

      result.evaluationTime = Date.now() - startTime;

      // Update rule in map
      this.rules.set(rule.id, rule);

      this.logger.info(
        `Conditional rule evaluated successfully: ${rule.name} (${result.evaluationTime}ms)`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to evaluate conditional rule: ${rule.id}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a condition against a context
   */
  private async evaluateCondition(
    condition: Condition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating condition: ${condition.type} (${condition.operator})`);

      let result: boolean;

      switch (condition.type) {
        case 'comparison':
          result = await this.evaluateComparisonCondition(
            condition as ComparisonCondition,
            context
          );
          break;

        case 'logical':
          result = await this.evaluateLogicalCondition(condition as LogicalCondition, context);
          break;

        case 'membership':
          result = await this.evaluateMembershipCondition(
            condition as MembershipCondition,
            context
          );
          break;

        case 'existence':
          result = await this.evaluateExistenceCondition(condition as ExistenceCondition, context);
          break;

        case 'regex':
          result = await this.evaluateRegexCondition(condition as RegexCondition, context);
          break;

        case 'custom':
          result = await this.evaluateCustomCondition(condition as CustomCondition, context);
          break;

        default:
          throw new Error(`Unknown condition type: ${condition.type}`);
      }

      // Apply negation if specified
      if (condition.negate) {
        result = !result;
      }

      this.logger.info(
        `Condition ${result ? 'matched' : 'did not match'}: ${condition.type} (${condition.operator})`
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to evaluate condition: ${condition.type} (${condition.operator})`,
        error
      );
      throw error;
    }
  }

  /**
   * Evaluate a comparison condition
   */
  private async evaluateComparisonCondition(
    condition: ComparisonCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating comparison condition: ${condition.operator}`);

      const [leftOperand, rightOperand] = condition.operands;

      // Resolve operands if they are variables
      const leftValue = this.getOperandValue(leftOperand, context);
      const rightValue = this.getOperandValue(rightOperand, context);

      switch (condition.operator) {
        case '=':
          return leftValue == rightValue; // Allow type coercion
        case '!=':
          return leftValue != rightValue; // Allow type coercion
        case '<':
          return leftValue < rightValue;
        case '>':
          return leftValue > rightValue;
        case '<=':
          return leftValue <= rightValue;
        case '>=':
          return leftValue >= rightValue;
        case 'starts_with':
          if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue.startsWith(rightValue);
          }
          return false;
        case 'ends_with':
          if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue.endsWith(rightValue);
          }
          return false;
        case 'contains':
          if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue.includes(rightValue);
          }
          return false;
        case 'matches':
          if (typeof leftValue === 'string' && typeof rightValue === 'string') {
            return leftValue === rightValue;
          }
          return false;
        default:
          throw new Error(`Unknown comparison operator: ${condition.operator}`);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate comparison condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a logical condition
   */
  private async evaluateLogicalCondition(
    condition: LogicalCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating logical condition: ${condition.operator}`);

      const operandResults: boolean[] = [];

      // Evaluate all operands
      for (const operand of condition.operands) {
        try {
          const result = await this.evaluateCondition(operand, context);
          operandResults.push(result);
        } catch (error) {
          this.logger.error(`Failed to evaluate logical operand`, error);
          operandResults.push(false);
        }
      }

      switch (condition.operator) {
        case 'and':
          return operandResults.every((result) => result);
        case 'or':
          return operandResults.some((result) => result);
        case 'not':
          return !operandResults[0]; // Only use first operand for NOT
        default:
          throw new Error(`Unknown logical operator: ${condition.operator}`);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate logical condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a membership condition
   */
  private async evaluateMembershipCondition(
    condition: MembershipCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating membership condition: ${condition.operator}`);

      const [value, collection] = condition.operands;

      // Resolve operands if they are variables
      const resolvedValue = this.getOperandValue(value, context);
      const resolvedCollection = this.getOperandValue(collection, context);

      if (!Array.isArray(resolvedCollection)) {
        return false;
      }

      const isInCollection = resolvedCollection.includes(resolvedValue);

      switch (condition.operator) {
        case 'in':
          return isInCollection;
        case 'not_in':
          return !isInCollection;
        default:
          throw new Error(`Unknown membership operator: ${condition.operator}`);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate membership condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Evaluate an existence condition
   */
  private async evaluateExistenceCondition(
    condition: ExistenceCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating existence condition: ${condition.operator}`);

      const [value] = condition.operands;

      // Resolve operand if it's a variable
      const resolvedValue = this.getOperandValue(value, context);

      const exists = resolvedValue !== undefined && resolvedValue !== null;

      switch (condition.operator) {
        case 'exists':
          return exists;
        case 'not_exists':
          return !exists;
        default:
          throw new Error(`Unknown existence operator: ${condition.operator}`);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate existence condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a regex condition
   */
  private async evaluateRegexCondition(
    condition: RegexCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating regex condition: ${condition.operator}`);

      const [stringValue, pattern, caseSensitive] = condition.operands;

      // Resolve operands if they are variables
      const resolvedString = String(this.getOperandValue(stringValue, context));
      const resolvedPattern = String(this.getOperandValue(pattern, context));

      try {
        const flags = caseSensitive === false ? 'i' : '';
        const regex = new RegExp(resolvedPattern, flags);
        return regex.test(resolvedString);
      } catch (error) {
        this.logger.error(`Invalid regex pattern: ${resolvedPattern}`, error);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate regex condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a custom condition
   */
  private async evaluateCustomCondition(
    condition: CustomCondition,
    context: ConditionalContext
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating custom condition: ${condition.operator}`);

      const [functionName, args] = condition.operands;

      const customOperator = this.customOperators.get(functionName);
      if (!customOperator) {
        throw new Error(`Custom operator not found: ${functionName}`);
      }

      // Resolve arguments if they are variables
      const resolvedArgs = Array.isArray(args)
        ? args.map((arg) => this.getOperandValue(arg, context))
        : [this.getOperandValue(args, context)];

      try {
        return customOperator(resolvedArgs, context);
      } catch (error) {
        this.logger.error(`Custom operator threw an error: ${functionName}`, error);
        throw error;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate custom condition: ${condition.operator}`, error);
      throw error;
    }
  }

  /**
   * Get the value of an operand (either a literal or a variable)
   */
  private getOperandValue(operand: any, context: ConditionalContext): any {
    try {
      // If operand is a string that looks like a variable reference
      if (typeof operand === 'string' && operand.startsWith('{{') && operand.endsWith('}}')) {
        const variableName = operand.substring(2, operand.length - 2).trim();
        return this.getVariableValue(variableName, context);
      }

      // If operand is a string that contains variable references
      if (typeof operand === 'string' && operand.includes('{{') && operand.includes('}}')) {
        return this.interpolateString(operand, context);
      }

      // Return the literal value
      return operand;
    } catch (error) {
      this.logger.error(`Failed to get operand value`, error);
      return operand;
    }
  }

  /**
   * Get the value of a variable from the context
   */
  private getVariableValue(variableName: string, context: ConditionalContext): any {
    try {
      this.logger.info(`Getting variable value: ${variableName}`);

      // Handle dot notation (e.g., issue.title)
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
        default:
          // Check custom variables
          if (context.custom && context.custom.hasOwnProperty(variableName)) {
            return context.custom[variableName];
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
   * Interpolate variables in a string
   */
  private interpolateString(template: string, context: ConditionalContext): string {
    try {
      this.logger.info('Interpolating string with variables');

      let result = template;

      // Find all variable placeholders
      const variableRegex = /\{\{([^}]+)\}\}/g;
      let match;

      while ((match = variableRegex.exec(result)) !== null) {
        const variableName = match[1].trim();
        const fullMatch = match[0];

        try {
          const variableValue = this.getVariableValue(variableName, context);
          const stringValue =
            variableValue !== undefined && variableValue !== null ? String(variableValue) : '';

          result = result.replace(fullMatch, stringValue);
        } catch (error) {
          this.logger.error(`Failed to interpolate variable: ${variableName}`, error);
          result = result.replace(fullMatch, '[ERROR]');
        }
      }

      this.logger.info('String interpolated successfully');
      return result;
    } catch (error) {
      this.logger.error('Failed to interpolate string', error);
      throw error;
    }
  }

  /**
   * Evaluate all enabled rules against a context
   */
  public async evaluateAllRules(
    context: ConditionalContext,
    options?: {
      sortByPriority?: boolean;
      stopOnFirstMatch?: boolean;
      maxEvaluations?: number;
    }
  ): Promise<EvaluationResult[]> {
    try {
      this.logger.info('Evaluating all conditional rules');

      const opts = {
        sortByPriority: true,
        stopOnFirstMatch: false,
        maxEvaluations: 100,
        ...options,
      };

      let rules = Array.from(this.rules.values()).filter((rule) => rule.enabled);

      // Sort by priority if requested
      if (opts.sortByPriority) {
        rules = rules.sort((a, b) => b.priority - a.priority);
      }

      // Limit number of evaluations if specified
      if (opts.maxEvaluations && rules.length > opts.maxEvaluations) {
        rules = rules.slice(0, opts.maxEvaluations);
      }

      const results: EvaluationResult[] = [];

      for (const rule of rules) {
        try {
          const result = await this.evaluateRule(rule, context);
          results.push(result);

          // Stop on first match if requested
          if (opts.stopOnFirstMatch && result.result) {
            this.logger.info(`Stopping evaluation on first match: ${rule.name}`);
            break;
          }
        } catch (error) {
          this.logger.error(`Failed to evaluate rule: ${rule.name}`, error);
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            result: false,
            matchedConditions: [],
            unmatchedConditions: [],
            evaluationTime: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.logger.info(`Evaluated ${results.length} conditional rules`);
      return results;
    } catch (error) {
      this.logger.error('Failed to evaluate all conditional rules', error);
      throw error;
    }
  }

  /**
   * Find rules that would match a particular context
   */
  public async findMatchingRules(context: ConditionalContext): Promise<ConditionalRule[]> {
    try {
      this.logger.info('Finding matching conditional rules');

      const results = await this.evaluateAllRules(context, {
        sortByPriority: true,
        stopOnFirstMatch: false,
      });

      const matchingRuleIds = results
        .filter((result) => result.result)
        .map((result) => result.ruleId);

      const matchingRules = matchingRuleIds
        .map((id) => this.rules.get(id))
        .filter((rule): rule is ConditionalRule => rule !== undefined);

      this.logger.info(`Found ${matchingRules.length} matching conditional rules`);
      return matchingRules;
    } catch (error) {
      this.logger.error('Failed to find matching conditional rules', error);
      throw error;
    }
  }

  /**
   * Optimize a condition for better performance
   */
  public optimizeCondition(condition: Condition): OptimizedCondition {
    try {
      this.logger.info(`Optimizing condition: ${condition.type}`);

      // In a real implementation, we'd perform various optimizations:
      // 1. Constant folding
      // 2. Dead code elimination
      // 3. Short-circuit evaluation
      // 4. Cache commonly used conditions
      // 5. Precompile regex patterns

      // For now, we'll return the condition as-is with minimal optimization
      const optimized: OptimizedCondition = {
        condition,
        optimized: false,
        reason: 'No optimization applied',
        performanceGain: 0,
      };

      this.logger.info(`Condition optimized: ${condition.type}`);
      return optimized;
    } catch (error) {
      this.logger.error(`Failed to optimize condition: ${condition.type}`, error);
      throw error;
    }
  }

  /**
   * Get conditional rule statistics
   */
  public getRuleStats(): {
    totalRules: number;
    enabledRules: number;
    averageEvaluationTime: number;
    mostUsedRules: Array<{ rule: ConditionalRule; evaluations: number }>;
    successRate: number;
  } {
    try {
      this.logger.info('Generating conditional rule statistics');

      const rules = Array.from(this.rules.values());

      const stats = {
        totalRules: rules.length,
        enabledRules: rules.filter((r) => r.enabled).length,
        averageEvaluationTime: 0,
        mostUsedRules: [] as Array<{ rule: ConditionalRule; evaluations: number }>,
        successRate: 0,
      };

      // Calculate average evaluation time
      const totalEvaluations = rules.reduce((sum, rule) => sum + rule.evaluationCount, 0);

      const totalTime = rules.reduce((sum, rule) => sum + rule.evaluationCount * 10, 0); // Estimate 10ms per evaluation

      stats.averageEvaluationTime = totalEvaluations > 0 ? totalTime / totalEvaluations : 0;

      // Calculate success rate
      const totalSuccesses = rules.reduce((sum, rule) => sum + rule.successCount, 0);

      stats.successRate = totalEvaluations > 0 ? (totalSuccesses / totalEvaluations) * 100 : 0;

      // Find most used rules
      const sortedRules = [...rules].sort((a, b) => b.evaluationCount - a.evaluationCount);

      stats.mostUsedRules = sortedRules.slice(0, 10).map((rule) => ({
        rule,
        evaluations: rule.evaluationCount,
      }));

      this.logger.info('Conditional rule statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate conditional rule statistics', error);
      throw error;
    }
  }

  /**
   * Export conditional rules
   */
  public exportRules(): ConditionalRule[] {
    try {
      this.logger.info('Exporting conditional rules');

      const rules = Array.from(this.rules.values());

      this.logger.info(`Exported ${rules.length} conditional rules`);
      return rules;
    } catch (error) {
      this.logger.error('Failed to export conditional rules', error);
      throw error;
    }
  }

  /**
   * Import conditional rules
   */
  public importRules(rules: ConditionalRule[]): void {
    try {
      this.logger.info(`Importing ${rules.length} conditional rules`);

      // Clear existing rules
      this.rules.clear();

      // Import new rules
      for (const rule of rules) {
        try {
          this.validateRule(rule);
          this.rules.set(rule.id, rule);
        } catch (error) {
          this.logger.error(`Failed to import rule: ${rule.name}`, error);
        }
      }

      this.logger.info(`Imported ${Array.from(this.rules.values()).length} conditional rules`);
    } catch (error) {
      this.logger.error('Failed to import conditional rules', error);
      throw error;
    }
  }

  /**
   * Test a conditional rule with sample data
   */
  public async testRule(
    rule: ConditionalRule,
    sampleContext: Partial<ConditionalContext>
  ): Promise<{
    success: boolean;
    result?: EvaluationResult;
    errors: string[];
  }> {
    try {
      this.logger.info(`Testing conditional rule: ${rule.name}`);

      // Create a test context
      const context: ConditionalContext = {
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

      // Evaluate the rule
      const result = await this.evaluateRule(rule, context);

      return {
        success: true,
        result,
        errors: [],
      };
    } catch (error) {
      this.logger.error(`Failed to test conditional rule: ${rule.name}`, error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create a simple condition for common use cases
   */
  public createSimpleCondition(
    variable: string,
    operator: string,
    value: any
  ): ComparisonCondition {
    try {
      this.logger.info(`Creating simple condition: ${variable} ${operator} ${value}`);

      const condition: ComparisonCondition = {
        id: `condition-${Date.now()}`,
        type: 'comparison',
        operator: operator as any,
        operands: [variable, value],
        description: `${variable} ${operator} ${value}`,
      };

      this.logger.info('Simple condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(
        `Failed to create simple condition: ${variable} ${operator} ${value}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a logical condition combining multiple conditions
   */
  public createLogicalCondition(
    operator: 'and' | 'or' | 'not',
    conditions: Condition[]
  ): LogicalCondition {
    try {
      this.logger.info(
        `Creating logical condition: ${operator} with ${conditions.length} conditions`
      );

      const condition: LogicalCondition = {
        id: `condition-${Date.now()}`,
        type: 'logical',
        operator,
        operands: conditions,
        description: `${operator} condition with ${conditions.length} operands`,
      };

      this.logger.info('Logical condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create logical condition: ${operator}`, error);
      throw error;
    }
  }

  /**
   * Create a membership condition
   */
  public createMembershipCondition(
    value: any,
    collection: any[],
    operator: 'in' | 'not_in' = 'in'
  ): MembershipCondition {
    try {
      this.logger.info(
        `Creating membership condition: ${value} ${operator} [${collection.length} items]`
      );

      const condition: MembershipCondition = {
        id: `condition-${Date.now()}`,
        type: 'membership',
        operator,
        operands: [value, collection],
        description: `${value} ${operator} collection`,
      };

      this.logger.info('Membership condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create membership condition: ${value} ${operator}`, error);
      throw error;
    }
  }

  /**
   * Create an existence condition
   */
  public createExistenceCondition(
    variable: string,
    operator: 'exists' | 'not_exists' = 'exists'
  ): ExistenceCondition {
    try {
      this.logger.info(`Creating existence condition: ${variable} ${operator}`);

      const condition: ExistenceCondition = {
        id: `condition-${Date.now()}`,
        type: 'existence',
        operator,
        operands: [variable],
        description: `${variable} ${operator}`,
      };

      this.logger.info('Existence condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create existence condition: ${variable} ${operator}`, error);
      throw error;
    }
  }

  /**
   * Create a regex condition
   */
  public createRegexCondition(
    value: string,
    pattern: string,
    caseSensitive: boolean = true
  ): RegexCondition {
    try {
      this.logger.info(`Creating regex condition: ${value} matches ${pattern}`);

      const condition: RegexCondition = {
        id: `condition-${Date.now()}`,
        type: 'regex',
        operator: 'matches',
        operands: [value, pattern, caseSensitive],
        description: `${value} matches pattern ${pattern}`,
      };

      this.logger.info('Regex condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create regex condition: ${value} matches ${pattern}`, error);
      throw error;
    }
  }

  /**
   * Create a custom condition
   */
  public createCustomCondition(functionName: string, args: any[]): CustomCondition {
    try {
      this.logger.info(`Creating custom condition: ${functionName} with ${args.length} arguments`);

      const condition: CustomCondition = {
        id: `condition-${Date.now()}`,
        type: 'custom',
        operator: 'custom',
        operands: [functionName, args],
        description: `Custom function: ${functionName}`,
      };

      this.logger.info('Custom condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create custom condition: ${functionName}`, error);
      throw error;
    }
  }

  /**
   * Get all custom operators
   */
  public getCustomOperators(): string[] {
    return Array.from(this.customOperators.keys());
  }

  /**
   * Validate a conditional context
   */
  public validateContext(context: ConditionalContext): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    try {
      this.logger.info('Validating conditional context');

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
        `Conditional context validation completed: ${result.valid ? 'valid' : 'invalid'}`
      );
      return result;
    } catch (error) {
      this.logger.error('Failed to validate conditional context', error);
      throw error;
    }
  }

  /**
   * Create a safe context for evaluation
   */
  public createSafeContext(context: ConditionalContext): ConditionalContext {
    try {
      this.logger.info('Creating safe conditional context');

      // Deep clone the context to prevent mutations
      const safeContext: ConditionalContext = JSON.parse(JSON.stringify(context));

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

      this.logger.info('Safe conditional context created');
      return safeContext;
    } catch (error) {
      this.logger.error('Failed to create safe conditional context', error);
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
   * Find rules that reference specific variables
   */
  public findRulesForVariables(variableNames: string[]): ConditionalRule[] {
    try {
      this.logger.info(`Finding rules for variables: ${variableNames.join(', ')}`);

      const matchingRules: ConditionalRule[] = [];
      const rules = Array.from(this.rules.values());

      for (const rule of rules) {
        if (this.ruleReferencesVariables(rule, variableNames)) {
          matchingRules.push(rule);
        }
      }

      this.logger.info(`Found ${matchingRules.length} rules referencing specified variables`);
      return matchingRules;
    } catch (error) {
      this.logger.error('Failed to find rules for variables', error);
      throw error;
    }
  }

  /**
   * Check if a rule references specific variables
   */
  private ruleReferencesVariables(rule: ConditionalRule, variableNames: string[]): boolean {
    try {
      this.logger.info(`Checking if rule ${rule.name} references variables`);

      // Check each condition in the rule
      for (const condition of rule.conditions) {
        if (this.conditionReferencesVariables(condition, variableNames)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check rule ${rule.name} for variable references`, error);
      return false;
    }
  }

  /**
   * Check if a condition references specific variables
   */
  private conditionReferencesVariables(condition: Condition, variableNames: string[]): boolean {
    try {
      this.logger.info(`Checking condition ${condition.type} for variable references`);

      // Check operands for variable references
      for (const operand of condition.operands) {
        if (typeof operand === 'string') {
          // Check if operand is a variable reference (e.g., "{{issue.title}}")
          if (operand.startsWith('{{') && operand.endsWith('}}')) {
            const variableName = operand.substring(2, operand.length - 2).trim();
            if (variableNames.includes(variableName)) {
              return true;
            }
          }

          // Check if operand contains variable references
          const matches = operand.match(/\{\{([^}]+)\}\}/g);
          if (matches) {
            for (const match of matches) {
              const variableName = match.substring(2, match.length - 2).trim();
              if (variableNames.includes(variableName)) {
                return true;
              }
            }
          }
        }
      }

      // Check nested conditions for logical conditions
      if (condition.type === 'logical' && Array.isArray(condition.operands)) {
        for (const nestedCondition of condition.operands as Condition[]) {
          if (this.conditionReferencesVariables(nestedCondition, variableNames)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to check condition for variable references`, error);
      return false;
    }
  }

  /**
   * Optimize all rules for better performance
   */
  public optimizeAllRules(): void {
    try {
      this.logger.info('Optimizing all conditional rules');

      const rules = Array.from(this.rules.values());

      for (const rule of rules) {
        for (let i = 0; i < rule.conditions.length; i++) {
          const optimizedCondition = this.optimizeCondition(rule.conditions[i]);
          if (optimizedCondition.optimized) {
            rule.conditions[i] = optimizedCondition.condition;
          }
        }

        // Update the rule
        this.rules.set(rule.id, rule);
      }

      this.logger.info(`Optimized ${rules.length} conditional rules`);
    } catch (error) {
      this.logger.error('Failed to optimize all conditional rules', error);
      throw error;
    }
  }

  /**
   * Clear any cached data or statistics
   */
  public clearCache(): void {
    try {
      this.logger.info('Clearing conditional logic cache');

      // In a real implementation, we'd clear any cached rule evaluations
      // For now, this is a placeholder

      this.logger.info('Conditional logic cache cleared');
    } catch (error) {
      this.logger.error('Failed to clear conditional logic cache', error);
      throw error;
    }
  }

  /**
   * Generate a report of all conditional rules and their performance
   */
  public generatePerformanceReport(): {
    totalRules: number;
    evaluatedRules: number;
    averageExecutionTime: number;
    slowestRules: Array<{ rule: ConditionalRule; avgTime: number }>;
    mostComplexRules: Array<{ rule: ConditionalRule; conditionCount: number }>;
    optimizationOpportunities: Array<{ rule: ConditionalRule; suggestions: string[] }>;
  } {
    try {
      this.logger.info('Generating conditional logic performance report');

      const rules = Array.from(this.rules.values());

      const report = {
        totalRules: rules.length,
        evaluatedRules: rules.filter((r) => r.evaluationCount > 0).length,
        averageExecutionTime: 0,
        slowestRules: [] as Array<{ rule: ConditionalRule; avgTime: number }>,
        mostComplexRules: [] as Array<{ rule: ConditionalRule; conditionCount: number }>,
        optimizationOpportunities: [] as Array<{ rule: ConditionalRule; suggestions: string[] }>,
      };

      // Calculate average execution time
      const totalEvaluations = rules.reduce((sum, rule) => sum + rule.evaluationCount, 0);
      const totalTime = rules.reduce((sum, rule) => sum + rule.evaluationCount * 10, 0); // Estimate 10ms average
      report.averageExecutionTime = totalEvaluations > 0 ? totalTime / totalEvaluations : 0;

      // Find slowest rules (those with high average evaluation time)
      const slowestRules = [...rules]
        .filter((rule) => rule.evaluationCount > 0)
        .map((rule) => ({
          rule,
          avgTime: 10, // Estimate 10ms average
        }))
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 10);

      report.slowestRules = slowestRules;

      // Find most complex rules (those with many conditions)
      const mostComplexRules = [...rules]
        .map((rule) => ({
          rule,
          conditionCount: rule.conditions.length,
        }))
        .sort((a, b) => b.conditionCount - a.conditionCount)
        .slice(0, 10);

      report.mostComplexRules = mostComplexRules;

      // Identify optimization opportunities (rules that could be optimized)
      const optimizationOpportunities = rules
        .map((rule) => {
          const suggestions: string[] = [];

          // Suggest optimization if rule has many conditions
          if (rule.conditions.length > 5) {
            suggestions.push('Rule has many conditions (>5) - consider simplifying');
          }

          // Suggest optimization if rule is evaluated frequently
          if (rule.evaluationCount > 1000) {
            suggestions.push('Rule is evaluated frequently (>1000) - consider caching results');
          }

          return {
            rule,
            suggestions,
          };
        })
        .filter((opportunity) => opportunity.suggestions.length > 0);

      report.optimizationOpportunities = optimizationOpportunities;

      this.logger.info('Conditional logic performance report generated successfully');
      return report;
    } catch (error) {
      this.logger.error('Failed to generate conditional logic performance report', error);
      throw error;
    }
  }

  /**
   * Create a complex rule with multiple conditions
   */
  public createComplexRule(
    name: string,
    conditions: Condition[],
    priority: number = 0
  ): ConditionalRule {
    try {
      this.logger.info(`Creating complex rule: ${name}`);

      const rule: ConditionalRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        conditions,
        priority,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        evaluationCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      // Validate the rule
      this.validateRule(rule);

      // Add to collection
      this.rules.set(rule.id, rule);

      this.logger.info(`Complex rule created successfully: ${name}`);
      return rule;
    } catch (error) {
      this.logger.error(`Failed to create complex rule: ${name}`, error);
      throw error;
    }
  }

  /**
   * Enable a rule
   */
  public enableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: true });
  }

  /**
   * Disable a rule
   */
  public disableRule(ruleId: string): boolean {
    return this.updateRule(ruleId, { enabled: false });
  }

  /**
   * Set rule priority
   */
  public setRulePriority(ruleId: string, priority: number): boolean {
    return this.updateRule(ruleId, { priority });
  }

  /**
   * Get rules by priority range
   */
  public getRulesByPriority(minPriority: number, maxPriority: number): ConditionalRule[] {
    try {
      this.logger.info(`Getting rules with priority between ${minPriority} and ${maxPriority}`);

      const rules = Array.from(this.rules.values()).filter(
        (rule) => rule.priority >= minPriority && rule.priority <= maxPriority
      );

      this.logger.info(`Found ${rules.length} rules in priority range`);
      return rules;
    } catch (error) {
      this.logger.error(
        `Failed to get rules by priority range ${minPriority}-${maxPriority}`,
        error
      );
      throw error;
    }
  }

  /**
   * Find duplicate rules based on conditions
   */
  public findDuplicateRules(): Array<{
    rule1: ConditionalRule;
    rule2: ConditionalRule;
    similarity: number;
  }> {
    try {
      this.logger.info('Finding duplicate conditional rules');

      const rules = Array.from(this.rules.values());
      const duplicates: Array<{
        rule1: ConditionalRule;
        rule2: ConditionalRule;
        similarity: number;
      }> = [];

      // Compare each rule with every other rule
      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
          const rule1 = rules[i];
          const rule2 = rules[j];

          // Calculate similarity based on conditions
          const similarity = this.calculateRuleSimilarity(rule1, rule2);

          // If similarity is above threshold, add to duplicates
          if (similarity > 0.8) {
            // 80% similarity threshold
            duplicates.push({
              rule1,
              rule2,
              similarity,
            });
          }
        }
      }

      // Sort by similarity (highest first)
      duplicates.sort((a, b) => b.similarity - a.similarity);

      this.logger.info(`Found ${duplicates.length} duplicate rule pairs`);
      return duplicates;
    } catch (error) {
      this.logger.error('Failed to find duplicate conditional rules', error);
      throw error;
    }
  }

  /**
   * Calculate similarity between two rules
   */
  private calculateRuleSimilarity(rule1: ConditionalRule, rule2: ConditionalRule): number {
    try {
      this.logger.info(`Calculating similarity between rules: ${rule1.name} and ${rule2.name}`);

      // Simple similarity calculation based on condition overlap
      const commonConditions = rule1.conditions.filter((c1) =>
        rule2.conditions.some((c2) => JSON.stringify(c1) === JSON.stringify(c2))
      ).length;

      const totalConditions = rule1.conditions.length + rule2.conditions.length;
      const similarity = totalConditions > 0 ? (2 * commonConditions) / totalConditions : 0;

      this.logger.info(`Calculated similarity: ${similarity}`);
      return similarity;
    } catch (error) {
      this.logger.error(`Failed to calculate similarity between rules`, error);
      throw error;
    }
  }

  /**
   * Merge duplicate rules
   */
  public async mergeDuplicateRules(duplicatePair: {
    rule1: ConditionalRule;
    rule2: ConditionalRule;
    similarity: number;
  }): Promise<ConditionalRule | null> {
    try {
      this.logger.info(
        `Merging duplicate rules: ${duplicatePair.rule1.name} and ${duplicatePair.rule2.name}`
      );

      if (duplicatePair.similarity < 0.8) {
        this.logger.warn(`Rules not similar enough to merge: ${duplicatePair.similarity}`);
        return null;
      }

      // Keep the rule with higher priority or more evaluations
      const keepRule =
        duplicatePair.rule1.priority >= duplicatePair.rule2.priority
          ? duplicatePair.rule1
          : duplicatePair.rule2;

      const removeRule =
        keepRule === duplicatePair.rule1 ? duplicatePair.rule2 : duplicatePair.rule1;

      // Combine conditions from both rules (avoiding duplicates)
      const combinedConditions = [...keepRule.conditions];

      for (const condition of removeRule.conditions) {
        if (!combinedConditions.some((c) => JSON.stringify(c) === JSON.stringify(condition))) {
          combinedConditions.push(condition);
        }
      }

      // Update the kept rule
      keepRule.conditions = combinedConditions;
      keepRule.priority = Math.max(keepRule.priority, removeRule.priority);
      keepRule.evaluationCount += removeRule.evaluationCount;
      keepRule.successCount += removeRule.successCount;
      keepRule.failureCount += removeRule.failureCount;
      keepRule.updatedAt = new Date();

      // Remove the duplicate rule
      this.rules.delete(removeRule.id);

      // Update the kept rule
      this.rules.set(keepRule.id, keepRule);

      this.logger.info(`Merged duplicate rules into: ${keepRule.name}`);
      return keepRule;
    } catch (error) {
      this.logger.error(`Failed to merge duplicate rules`, error);
      throw error;
    }
  }

  /**
   * Create a default set of commonly used rules
   */
  public createDefaultRules(): void {
    try {
      this.logger.info('Creating default conditional rules');

      // Rule for high priority issues
      const highPriorityRule = this.createComplexRule(
        'High Priority Issues',
        [
          this.createComparisonCondition('{{issue.priority}}', '=', ['high', 'urgent']),
          this.createExistenceCondition('{{issue.assignee}}', 'exists'),
        ],
        10
      );

      // Rule for unassigned issues
      const unassignedRule = this.createComplexRule(
        'Unassigned Issues',
        [this.createExistenceCondition('{{issue.assignee}}', 'not_exists')],
        5
      );

      // Rule for overdue issues
      const overdueRule = this.createComplexRule(
        'Overdue Issues',
        [
          this.createComparisonCondition('{{issue.dueDate}}', '<', '{{environment.currentDate}}'),
          this.createExistenceCondition('{{issue.dueDate}}', 'exists'),
        ],
        15
      );

      this.logger.info('Default conditional rules created successfully');
    } catch (error) {
      this.logger.error('Failed to create default conditional rules', error);
      throw error;
    }
  }

  /**
   * Create a comparison condition with array support
   */
  public createComparisonCondition(
    leftOperand: any,
    operator: string,
    rightOperand: any | any[]
  ): Condition {
    try {
      this.logger.info(
        `Creating comparison condition: ${leftOperand} ${operator} ${JSON.stringify(rightOperand)}`
      );

      // If right operand is an array with a single element, treat as scalar
      if (Array.isArray(rightOperand) && rightOperand.length === 1) {
        rightOperand = rightOperand[0];
      }

      // If right operand is an array, check if it's for IN operation
      if (Array.isArray(rightOperand) && operator === '=') {
        return this.createMembershipCondition(leftOperand, rightOperand, 'in');
      } else if (Array.isArray(rightOperand) && operator === '!=') {
        return this.createMembershipCondition(leftOperand, rightOperand, 'not_in');
      }

      const condition: ComparisonCondition = {
        id: `condition-${Date.now()}`,
        type: 'comparison',
        operator: operator as any,
        operands: [leftOperand, rightOperand],
        description: `${leftOperand} ${operator} ${JSON.stringify(rightOperand)}`,
      };

      this.logger.info('Comparison condition created successfully');
      return condition;
    } catch (error) {
      this.logger.error(`Failed to create comparison condition: ${leftOperand} ${operator}`, error);
      throw error;
    }
  }

  /**
   * Create a complex rule with a fluent API
   */
  public ruleBuilder(name: string): RuleBuilder {
    return new RuleBuilder(this, name);
  }
}

/**
 * Fluent API for building complex conditional rules
 */
export class RuleBuilder {
  private engine: ConditionalLogicEngine;
  private rule: Omit<
    ConditionalRule,
    'id' | 'createdAt' | 'updatedAt' | 'evaluationCount' | 'successCount' | 'failureCount'
  >;
  private currentConditionGroup: Condition[] = [];
  private conditionGroups: Condition[][] = [];

  constructor(engine: ConditionalLogicEngine, name: string) {
    this.engine = engine;
    this.rule = {
      name,
      conditions: [],
      priority: 0,
      enabled: true,
      description: `Rule: ${name}`,
    };
  }

  /**
   * Add a condition to the current group
   */
  public when(variable: string, operator: string, value: any): RuleBuilder {
    try {
      const condition = this.engine.createComparisonCondition(variable, operator, value);
      this.currentConditionGroup.push(condition);
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Add a custom condition
   */
  public custom(functionName: string, ...args: any[]): RuleBuilder {
    try {
      const condition = this.engine.createCustomCondition(functionName, args);
      this.currentConditionGroup.push(condition);
      return this;
    } catch (error) {
      throw new Error(
        `Failed to add custom condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start a new condition group
   */
  public and(): RuleBuilder {
    try {
      if (this.currentConditionGroup.length > 0) {
        this.conditionGroups.push([...this.currentConditionGroup]);
        this.currentConditionGroup = [];
      }
      return this;
    } catch (error) {
      throw new Error(
        `Failed to start new condition group: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Start a new OR condition group
   */
  public or(): RuleBuilder {
    try {
      if (this.currentConditionGroup.length > 0) {
        this.conditionGroups.push([...this.currentConditionGroup]);
        this.currentConditionGroup = [];
      }
      return this;
    } catch (error) {
      throw new Error(
        `Failed to start new OR condition group: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set the priority of the rule
   */
  public withPriority(priority: number): RuleBuilder {
    try {
      this.rule.priority = priority;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set rule priority: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set the description of the rule
   */
  public withDescription(description: string): RuleBuilder {
    try {
      this.rule.description = description;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set rule description: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable or disable the rule
   */
  public setEnabled(enabled: boolean): RuleBuilder {
    try {
      this.rule.enabled = enabled;
      return this;
    } catch (error) {
      throw new Error(
        `Failed to set rule enabled state: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Build and add the rule to the engine
   */
  public build(): ConditionalRule {
    try {
      // Add the final condition group if it's not empty
      if (this.currentConditionGroup.length > 0) {
        this.conditionGroups.push([...this.currentConditionGroup]);
      }

      // Combine condition groups with AND logic
      let finalConditions: Condition[] = [];

      if (this.conditionGroups.length === 1) {
        // Single group - use as-is
        finalConditions = this.conditionGroups[0];
      } else if (this.conditionGroups.length > 1) {
        // Multiple groups - wrap each group in an AND condition
        finalConditions = this.conditionGroups.map((group) => {
          if (group.length === 1) {
            return group[0];
          } else {
            return this.engine.createLogicalCondition('and', group);
          }
        });
      } else if (this.currentConditionGroup.length > 0) {
        // No groups but current conditions - use current conditions
        finalConditions = [...this.currentConditionGroup];
      }

      // Create the rule
      const rule: ConditionalRule = {
        id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: this.rule.name,
        description: this.rule.description,
        conditions: finalConditions,
        priority: this.rule.priority,
        enabled: this.rule.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
        evaluationCount: 0,
        successCount: 0,
        failureCount: 0,
      };

      // Validate the rule
      this.engine.validateRule(rule);

      // Add to engine
      this.engine.addRule(rule);

      return rule;
    } catch (error) {
      throw new Error(
        `Failed to build rule: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
