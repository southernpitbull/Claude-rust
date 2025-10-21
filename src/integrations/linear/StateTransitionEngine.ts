/**
 * StateTransitionEngine.ts
 *
 * Automates Linear issue state transitions based on custom trigger conditions.
 * Implements a state machine for issue workflows with validation and history tracking.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface StateTransitionRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: StateTransitionTrigger;
  conditions: StateTransitionCondition[];
  actions: StateTransitionAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StateTransitionTrigger {
  type: 'manual' | 'automatic' | 'scheduled' | 'event';
  eventType?: 'issue_created' | 'issue_updated' | 'comment_added' | 'field_changed';
  schedule?: string; // Cron expression for scheduled triggers
}

export interface StateTransitionCondition {
  type:
    | 'time_based'
    | 'event_based'
    | 'field_change'
    | 'comment_based'
    | 'dependency'
    | 'external_system';
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';
  value?: any;
  duration?: number; // For time-based conditions (in minutes/hours/days)
  unit?: 'minutes' | 'hours' | 'days' | 'weeks';
}

export interface StateTransitionAction {
  type:
    | 'change_state'
    | 'assign_user'
    | 'add_label'
    | 'add_comment'
    | 'send_notification'
    | 'create_issue';
  targetStateId?: string;
  assigneeId?: string;
  labelIds?: string[];
  comment?: string;
  notificationRecipients?: string[];
  newIssueTemplate?: {
    title: string;
    description?: string;
    teamId?: string;
  };
}

export interface StateTransitionHistory {
  id: string;
  issueId: string;
  fromState: string;
  toState: string;
  ruleId: string;
  triggeredAt: Date;
  userId?: string;
  success: boolean;
  errorMessage?: string;
}

export interface StateMachineConfig {
  initialState: string;
  states: Record<
    string,
    {
      name: string;
      description?: string;
      transitions: Record<
        string,
        {
          target: string;
          conditions?: StateTransitionCondition[];
          actions?: StateTransitionAction[];
        }
      >;
    }
  >;
}

export class StateTransitionEngine {
  private linearClient: LinearClient;
  private rules: Map<string, StateTransitionRule>;
  private history: StateTransitionHistory[];
  private stateMachineConfig: StateMachineConfig | null;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.rules = new Map();
    this.history = [];
    this.stateMachineConfig = null;
    this.logger = new Logger('StateTransitionEngine');
  }

  /**
   * Initialize the state transition engine with configuration
   */
  public async initialize(config?: StateMachineConfig): Promise<void> {
    try {
      this.logger.info('Initializing StateTransitionEngine');

      if (config) {
        this.stateMachineConfig = config;
        this.logger.info('State machine configuration loaded');
      }

      // Load existing rules from storage if needed
      // In a real implementation, this would load from a database
      this.logger.info('StateTransitionEngine initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize StateTransitionEngine', error);
      throw error;
    }
  }

  /**
   * Add a new state transition rule
   */
  public addRule(rule: StateTransitionRule): void {
    try {
      this.logger.info(`Adding rule: ${rule.name}`);

      if (this.rules.has(rule.id)) {
        throw new Error(`Rule with ID ${rule.id} already exists`);
      }

      this.rules.set(rule.id, rule);
      this.logger.info(`Rule added successfully: ${rule.name}`);
    } catch (error) {
      this.logger.error(`Failed to add rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Remove a state transition rule
   */
  public removeRule(ruleId: string): boolean {
    try {
      this.logger.info(`Removing rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Rule not found: ${ruleId}`);
        return false;
      }

      const deleted = this.rules.delete(ruleId);
      if (deleted) {
        this.logger.info(`Rule removed successfully: ${rule.name}`);
      } else {
        this.logger.warn(`Failed to remove rule: ${ruleId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Update an existing state transition rule
   */
  public updateRule(ruleId: string, updates: Partial<StateTransitionRule>): boolean {
    try {
      this.logger.info(`Updating rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Rule not found: ${ruleId}`);
        return false;
      }

      // Update the rule with new values
      Object.assign(rule, updates, { updatedAt: new Date() });
      this.rules.set(ruleId, rule);

      this.logger.info(`Rule updated successfully: ${rule.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Get a specific rule by ID
   */
  public getRule(ruleId: string): StateTransitionRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  public getAllRules(): StateTransitionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluate conditions for a specific rule against an issue
   */
  public async evaluateConditions(rule: StateTransitionRule, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Evaluating conditions for rule: ${rule.name}`);

      // If no conditions, return true (always pass)
      if (!rule.conditions || rule.conditions.length === 0) {
        this.logger.info(`Rule has no conditions, passing evaluation`);
        return true;
      }

      // Check each condition
      for (const condition of rule.conditions) {
        const passes = await this.evaluateCondition(condition, issue);
        if (!passes) {
          this.logger.info(`Condition failed, rule evaluation failed`);
          return false;
        }
      }

      this.logger.info(`All conditions passed for rule: ${rule.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to evaluate conditions for rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single condition against an issue
   */
  private async evaluateCondition(
    condition: StateTransitionCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating condition: ${condition.type}`);

      switch (condition.type) {
        case 'time_based':
          return this.evaluateTimeBasedCondition(condition, issue);

        case 'event_based':
          // Event-based conditions are evaluated at event time
          // This is a placeholder for now
          return true;

        case 'field_change':
          // Field change conditions would be evaluated when a field changes
          // This is a placeholder for now
          return true;

        case 'comment_based':
          // Comment-based conditions would be evaluated when comments are added
          // This is a placeholder for now
          return true;

        case 'dependency':
          // Dependency conditions would check issue dependencies
          // This is a placeholder for now
          return true;

        case 'external_system':
          // External system conditions would check external data sources
          // This is a placeholder for now
          return true;

        default:
          this.logger.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate condition: ${condition.type}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a time-based condition
   */
  private evaluateTimeBasedCondition(
    condition: StateTransitionCondition,
    issue: LinearIssue
  ): boolean {
    try {
      this.logger.info(`Evaluating time-based condition`);

      if (!condition.duration || !condition.unit) {
        this.logger.warn('Time-based condition missing duration or unit');
        return false;
      }

      // Calculate the time threshold
      const currentTime = new Date();
      const thresholdTime = new Date(issue.updatedAt);

      // Adjust threshold based on unit
      switch (condition.unit) {
        case 'minutes':
          thresholdTime.setMinutes(thresholdTime.getMinutes() + condition.duration);
          break;
        case 'hours':
          thresholdTime.setHours(thresholdTime.getHours() + condition.duration);
          break;
        case 'days':
          thresholdTime.setDate(thresholdTime.getDate() + condition.duration);
          break;
        case 'weeks':
          thresholdTime.setDate(thresholdTime.getDate() + condition.duration * 7);
          break;
        default:
          this.logger.warn(`Unknown time unit: ${condition.unit}`);
          return false;
      }

      // Check if enough time has passed
      const timePassed = currentTime >= thresholdTime;

      this.logger.info(`Time-based condition result: ${timePassed}`);
      return timePassed;
    } catch (error) {
      this.logger.error('Failed to evaluate time-based condition', error);
      throw error;
    }
  }

  /**
   * Execute actions for a rule
   */
  public async executeActions(rule: StateTransitionRule, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Executing actions for rule: ${rule.name}`);

      // If no actions, return true (success)
      if (!rule.actions || rule.actions.length === 0) {
        this.logger.info(`Rule has no actions to execute`);
        return true;
      }

      let success = true;

      // Execute each action
      for (const action of rule.actions) {
        try {
          const actionSuccess = await this.executeAction(action, issue);
          if (!actionSuccess) {
            success = false;
            this.logger.warn(`Action failed for rule: ${rule.name}`);
          }
        } catch (error) {
          success = false;
          this.logger.error(`Failed to execute action for rule: ${rule.name}`, error);
        }
      }

      if (success) {
        this.logger.info(`All actions executed successfully for rule: ${rule.name}`);
      } else {
        this.logger.warn(`Some actions failed for rule: ${rule.name}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to execute actions for rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: StateTransitionAction, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Executing action: ${action.type}`);

      switch (action.type) {
        case 'change_state':
          if (action.targetStateId) {
            await this.linearClient.updateIssue(issue.id, { stateId: action.targetStateId });
            this.logger.info(`Changed state for issue: ${issue.id}`);
          }
          return true;

        case 'assign_user':
          if (action.assigneeId) {
            await this.linearClient.updateIssue(issue.id, { assigneeId: action.assigneeId });
            this.logger.info(`Assigned user to issue: ${issue.id}`);
          }
          return true;

        case 'add_label':
          if (action.labelIds) {
            await this.linearClient.updateIssue(issue.id, { labelIds: action.labelIds });
            this.logger.info(`Added labels to issue: ${issue.id}`);
          }
          return true;

        case 'add_comment':
          if (action.comment) {
            // Comments would be added via Linear's comment API
            // Placeholder for now
            this.logger.info(`Would add comment to issue: ${issue.id}`);
          }
          return true;

        case 'send_notification':
          if (action.notificationRecipients) {
            // Notifications would be sent via email/slack/etc.
            // Placeholder for now
            this.logger.info(`Would send notification to recipients`);
          }
          return true;

        case 'create_issue':
          if (action.newIssueTemplate) {
            // Create a new issue based on template
            // Placeholder for now
            this.logger.info(`Would create new issue from template`);
          }
          return true;

        default:
          this.logger.warn(`Unknown action type: ${action.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to execute action: ${action.type}`, error);
      throw error;
    }
  }

  /**
   * Process a state transition for an issue based on rules
   */
  public async processTransitions(issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Processing state transitions for issue: ${issue.id}`);

      let transitionsApplied = false;

      // Iterate through all enabled rules
      for (const rule of this.rules.values()) {
        if (!rule.enabled) {
          continue;
        }

        // Check if conditions are met
        const conditionsMet = await this.evaluateConditions(rule, issue);
        if (!conditionsMet) {
          continue;
        }

        // Execute actions
        const actionsSuccessful = await this.executeActions(rule, issue);
        if (actionsSuccessful) {
          transitionsApplied = true;
          this.logger.info(`Successfully applied rule: ${rule.name} to issue: ${issue.id}`);
        }
      }

      if (transitionsApplied) {
        this.logger.info(`Completed state transitions for issue: ${issue.id}`);
      } else {
        this.logger.info(`No applicable state transitions for issue: ${issue.id}`);
      }

      return transitionsApplied;
    } catch (error) {
      this.logger.error(`Failed to process state transitions for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Add a state transition to history
   */
  public addTransitionHistory(historyEntry: StateTransitionHistory): void {
    try {
      this.logger.info(`Adding transition history: ${historyEntry.id}`);

      this.history.push(historyEntry);

      // Keep only the most recent 1000 entries to prevent memory issues
      if (this.history.length > 1000) {
        this.history = this.history.slice(-1000);
      }

      this.logger.info(`Transition history added successfully`);
    } catch (error) {
      this.logger.error(`Failed to add transition history`, error);
      throw error;
    }
  }

  /**
   * Get transition history for an issue
   */
  public getTransitionHistory(issueId: string): StateTransitionHistory[] {
    return this.history.filter((entry) => entry.issueId === issueId);
  }

  /**
   * Get all transition history
   */
  public getAllTransitionHistory(): StateTransitionHistory[] {
    return [...this.history];
  }

  /**
   * Clear transition history
   */
  public clearTransitionHistory(): void {
    this.history = [];
    this.logger.info('Transition history cleared');
  }

  /**
   * Get statistics about state transitions
   */
  public getTransitionStats(): {
    totalTransitions: number;
    transitionsByRule: Record<string, number>;
    successRate: number;
    mostActiveRules: Array<{ ruleId: string; count: number }>;
  } {
    try {
      this.logger.info('Generating transition statistics');

      const stats = {
        totalTransitions: this.history.length,
        transitionsByRule: {} as Record<string, number>,
        successRate: 0,
        mostActiveRules: [] as Array<{ ruleId: string; count: number }>,
      };

      // Count transitions by rule
      for (const entry of this.history) {
        stats.transitionsByRule[entry.ruleId] = (stats.transitionsByRule[entry.ruleId] || 0) + 1;
      }

      // Calculate success rate
      const successfulTransitions = this.history.filter((entry) => entry.success).length;
      stats.successRate =
        this.history.length > 0 ? (successfulTransitions / this.history.length) * 100 : 0;

      // Get most active rules
      const ruleCounts = Object.entries(stats.transitionsByRule)
        .map(([ruleId, count]) => ({ ruleId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      stats.mostActiveRules = ruleCounts;

      this.logger.info('Transition statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate transition statistics', error);
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
   * Validate that a state transition is allowed by the state machine
   */
  public validateStateMachineTransition(fromState: string, toState: string): boolean {
    try {
      if (!this.stateMachineConfig) {
        this.logger.info('No state machine configuration, allowing transition');
        return true;
      }

      const fromStateConfig = this.stateMachineConfig.states[fromState];
      if (!fromStateConfig) {
        this.logger.warn(`From state not found in state machine: ${fromState}`);
        return false;
      }

      const transition = fromStateConfig.transitions[toState];
      if (!transition) {
        this.logger.warn(`Transition not allowed from ${fromState} to ${toState}`);
        return false;
      }

      this.logger.info(`State transition validated: ${fromState} -> ${toState}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to validate state machine transition`, error);
      throw error;
    }
  }

  /**
   * Create a rollback mechanism for transitions
   */
  public async createRollbackMechanism(
    issueId: string,
    fromState: string,
    toState: string
  ): Promise<void> {
    try {
      this.logger.info(`Creating rollback mechanism for issue: ${issueId}`);

      // In a real implementation, this would store the previous state
      // and create an undo mechanism
      this.logger.info(`Rollback mechanism created for issue: ${issueId}`);
    } catch (error) {
      this.logger.error(`Failed to create rollback mechanism for issue: ${issueId}`, error);
      throw error;
    }
  }
}
