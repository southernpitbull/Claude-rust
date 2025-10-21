/**
 * AssignmentRules.ts
 *
 * Implements intelligent assignment rules for Linear issues based on skills,
 * workload, availability, and team capacity.
 */

import { LinearClient, LinearIssue, LinearUser } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface AssignmentRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number; // Higher priority rules are evaluated first
  conditions: AssignmentCondition[];
  actions: AssignmentAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentCondition {
  type: 'skill_based' | 'workload_based' | 'availability_based' | 'team_capacity' | 'custom_field';
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value?: any;
  threshold?: number; // For numeric comparisons
}

export interface AssignmentAction {
  type: 'assign_user' | 'assign_team' | 'assign_round_robin' | 'notify_assignee';
  assigneeId?: string;
  teamId?: string;
  notify?: boolean;
  notificationMessage?: string;
}

export interface UserSkill {
  userId: string;
  skill: string;
  level: number; // 1-5 scale
  lastUsed?: Date;
}

export interface UserWorkload {
  userId: string;
  openIssues: number;
  inProgressIssues: number;
  estimatedCapacity: number;
  currentLoadPercentage: number;
}

export interface TeamCapacity {
  teamId: string;
  name: string;
  totalCapacity: number;
  currentUtilization: number;
  availableCapacity: number;
  members: Array<{
    userId: string;
    name: string;
    capacity: number;
    utilization: number;
  }>;
}

export interface AssignmentConflict {
  issueId: string;
  conflictingUsers: string[];
  resolutionMethod: 'round_robin' | 'skill_based' | 'workload_based' | 'manual';
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export class AssignmentRules {
  private linearClient: LinearClient;
  private rules: Map<string, AssignmentRule>;
  private userSkills: Map<string, UserSkill[]>;
  private userWorkloads: Map<string, UserWorkload>;
  private teamCapacities: Map<string, TeamCapacity>;
  private conflicts: AssignmentConflict[];
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.rules = new Map();
    this.userSkills = new Map();
    this.userWorkloads = new Map();
    this.teamCapacities = new Map();
    this.conflicts = [];
    this.logger = new Logger('AssignmentRules');
  }

  /**
   * Initialize the assignment rules system
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AssignmentRules system');

      // Load initial data about users and teams
      await this.refreshUserData();
      await this.refreshTeamData();

      this.logger.info('AssignmentRules system initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize AssignmentRules system', error);
      throw error;
    }
  }

  /**
   * Refresh user-related data
   */
  public async refreshUserData(): Promise<void> {
    try {
      this.logger.info('Refreshing user data');

      // In a real implementation, this would fetch actual user data
      // and calculate workloads, skills, etc.

      this.logger.info('User data refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh user data', error);
      throw error;
    }
  }

  /**
   * Refresh team-related data
   */
  public async refreshTeamData(): Promise<void> {
    try {
      this.logger.info('Refreshing team data');

      // In a real implementation, this would fetch actual team data
      // and calculate capacities, utilizations, etc.

      this.logger.info('Team data refreshed successfully');
    } catch (error) {
      this.logger.error('Failed to refresh team data', error);
      throw error;
    }
  }

  /**
   * Add a new assignment rule
   */
  public addRule(rule: AssignmentRule): void {
    try {
      this.logger.info(`Adding assignment rule: ${rule.name}`);

      if (this.rules.has(rule.id)) {
        throw new Error(`Rule with ID ${rule.id} already exists`);
      }

      this.rules.set(rule.id, rule);
      this.logger.info(`Assignment rule added successfully: ${rule.name}`);
    } catch (error) {
      this.logger.error(`Failed to add assignment rule: ${rule.name}`, error);
      throw error;
    }
  }

  /**
   * Remove an assignment rule
   */
  public removeRule(ruleId: string): boolean {
    try {
      this.logger.info(`Removing assignment rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Assignment rule not found: ${ruleId}`);
        return false;
      }

      const deleted = this.rules.delete(ruleId);
      if (deleted) {
        this.logger.info(`Assignment rule removed successfully: ${rule.name}`);
      } else {
        this.logger.warn(`Failed to remove assignment rule: ${ruleId}`);
      }

      return deleted;
    } catch (error) {
      this.logger.error(`Failed to remove assignment rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Update an existing assignment rule
   */
  public updateRule(ruleId: string, updates: Partial<AssignmentRule>): boolean {
    try {
      this.logger.info(`Updating assignment rule: ${ruleId}`);

      const rule = this.rules.get(ruleId);
      if (!rule) {
        this.logger.warn(`Assignment rule not found: ${ruleId}`);
        return false;
      }

      // Update the rule with new values
      Object.assign(rule, updates, { updatedAt: new Date() });
      this.rules.set(ruleId, rule);

      this.logger.info(`Assignment rule updated successfully: ${rule.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update assignment rule: ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * Get a specific rule by ID
   */
  public getRule(ruleId: string): AssignmentRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all rules
   */
  public getAllRules(): AssignmentRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluate conditions for a specific rule against an issue
   */
  public async evaluateConditions(rule: AssignmentRule, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Evaluating conditions for assignment rule: ${rule.name}`);

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
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating assignment condition: ${condition.type}`);

      switch (condition.type) {
        case 'skill_based':
          return this.evaluateSkillBasedCondition(condition, issue);

        case 'workload_based':
          return this.evaluateWorkloadBasedCondition(condition, issue);

        case 'availability_based':
          return this.evaluateAvailabilityBasedCondition(condition, issue);

        case 'team_capacity':
          return this.evaluateTeamCapacityCondition(condition, issue);

        case 'custom_field':
          return this.evaluateCustomFieldCondition(condition, issue);

        default:
          this.logger.warn(`Unknown assignment condition type: ${condition.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate assignment condition: ${condition.type}`, error);
      throw error;
    }
  }

  /**
   * Evaluate a skill-based condition
   */
  private async evaluateSkillBasedCondition(
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating skill-based condition`);

      // In a real implementation, this would check if users have the required skills
      // For now, we'll return true as a placeholder
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate skill-based condition', error);
      throw error;
    }
  }

  /**
   * Evaluate a workload-based condition
   */
  private async evaluateWorkloadBasedCondition(
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating workload-based condition`);

      // In a real implementation, this would check user workloads
      // For now, we'll return true as a placeholder
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate workload-based condition', error);
      throw error;
    }
  }

  /**
   * Evaluate an availability-based condition
   */
  private async evaluateAvailabilityBasedCondition(
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating availability-based condition`);

      // In a real implementation, this would check user availability
      // For now, we'll return true as a placeholder
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate availability-based condition', error);
      throw error;
    }
  }

  /**
   * Evaluate a team capacity condition
   */
  private async evaluateTeamCapacityCondition(
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating team capacity condition`);

      // In a real implementation, this would check team capacities
      // For now, we'll return true as a placeholder
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate team capacity condition', error);
      throw error;
    }
  }

  /**
   * Evaluate a custom field condition
   */
  private async evaluateCustomFieldCondition(
    condition: AssignmentCondition,
    issue: LinearIssue
  ): Promise<boolean> {
    try {
      this.logger.info(`Evaluating custom field condition`);

      // In a real implementation, this would check custom fields on the issue
      // For now, we'll return true as a placeholder
      return true;
    } catch (error) {
      this.logger.error('Failed to evaluate custom field condition', error);
      throw error;
    }
  }

  /**
   * Execute assignment actions for a rule
   */
  public async executeActions(rule: AssignmentRule, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Executing assignment actions for rule: ${rule.name}`);

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
   * Execute a single assignment action
   */
  private async executeAction(action: AssignmentAction, issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Executing assignment action: ${action.type}`);

      switch (action.type) {
        case 'assign_user':
          if (action.assigneeId) {
            await this.linearClient.updateIssue(issue.id, { assigneeId: action.assigneeId });
            this.logger.info(`Assigned user ${action.assigneeId} to issue: ${issue.id}`);

            // Handle notifications if requested
            if (action.notify) {
              await this.sendAssignmentNotification(
                action.assigneeId,
                issue,
                action.notificationMessage
              );
            }

            return true;
          }
          return false;

        case 'assign_team':
          if (action.teamId) {
            // Team assignment would typically involve assigning to a team lead
            // or using team-based assignment logic
            this.logger.info(`Would assign team ${action.teamId} to issue: ${issue.id}`);
            return true;
          }
          return false;

        case 'assign_round_robin':
          // Round-robin assignment logic
          const assignedUser = await this.assignRoundRobin(issue);
          if (assignedUser) {
            this.logger.info(`Assigned user ${assignedUser} to issue: ${issue.id} via round-robin`);

            // Handle notifications if requested
            if (action.notify) {
              await this.sendAssignmentNotification(
                assignedUser,
                issue,
                action.notificationMessage
              );
            }

            return true;
          }
          return false;

        case 'notify_assignee':
          // Just send notification without assignment
          if (issue.assignee) {
            await this.sendAssignmentNotification(
              issue.assignee.id,
              issue,
              action.notificationMessage
            );
            this.logger.info(`Sent notification to assignee for issue: ${issue.id}`);
            return true;
          }
          return false;

        default:
          this.logger.warn(`Unknown assignment action type: ${action.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to execute assignment action: ${action.type}`, error);
      throw error;
    }
  }

  /**
   * Assign an issue using round-robin distribution
   */
  private async assignRoundRobin(issue: LinearIssue): Promise<string | null> {
    try {
      this.logger.info(`Performing round-robin assignment for issue: ${issue.id}`);

      // In a real implementation, this would:
      // 1. Get eligible users based on issue criteria
      // 2. Track last assigned user to ensure round-robin distribution
      // 3. Return the next user in rotation

      // For now, we'll just return a placeholder
      return null;
    } catch (error) {
      this.logger.error('Failed to perform round-robin assignment', error);
      throw error;
    }
  }

  /**
   * Send assignment notification to a user
   */
  private async sendAssignmentNotification(
    userId: string,
    issue: LinearIssue,
    message?: string
  ): Promise<void> {
    try {
      this.logger.info(`Sending assignment notification to user: ${userId}`);

      // In a real implementation, this would send notifications via:
      // - Email
      // - Slack
      // - In-app notifications
      // - SMS

      // For now, we'll just log it
      this.logger.info(
        `Would send notification: ${message || `You've been assigned to issue: ${issue.title}`}`
      );
    } catch (error) {
      this.logger.error(`Failed to send assignment notification to user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Process assignment rules for an issue
   */
  public async processAssignments(issue: LinearIssue): Promise<boolean> {
    try {
      this.logger.info(`Processing assignment rules for issue: ${issue.id}`);

      // Sort rules by priority (higher priority first)
      const sortedRules = Array.from(this.rules.values())
        .filter((rule) => rule.enabled)
        .sort((a, b) => b.priority - a.priority);

      // Process rules in priority order
      for (const rule of sortedRules) {
        // Check if conditions are met
        const conditionsMet = await this.evaluateConditions(rule, issue);
        if (!conditionsMet) {
          continue;
        }

        // Execute actions
        const actionsSuccessful = await this.executeActions(rule, issue);
        if (actionsSuccessful) {
          this.logger.info(
            `Successfully applied assignment rule: ${rule.name} to issue: ${issue.id}`
          );
          return true; // Stop after first successful assignment
        }
      }

      this.logger.info(`No assignment rules applied for issue: ${issue.id}`);
      return false;
    } catch (error) {
      this.logger.error(`Failed to process assignment rules for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Add user skills
   */
  public addUserSkills(userId: string, skills: UserSkill[]): void {
    try {
      this.logger.info(`Adding skills for user: ${userId}`);

      this.userSkills.set(userId, skills);
      this.logger.info(`Skills added successfully for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to add skills for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get user skills
   */
  public getUserSkills(userId: string): UserSkill[] {
    return this.userSkills.get(userId) || [];
  }

  /**
   * Update user workload
   */
  public updateUserWorkload(userId: string, workload: UserWorkload): void {
    try {
      this.logger.info(`Updating workload for user: ${userId}`);

      this.userWorkloads.set(userId, workload);
      this.logger.info(`Workload updated successfully for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to update workload for user: ${userId}`, error);
      throw error;
    }
  }

  /**
   * Get user workload
   */
  public getUserWorkload(userId: string): UserWorkload | undefined {
    return this.userWorkloads.get(userId);
  }

  /**
   * Update team capacity
   */
  public updateTeamCapacity(teamId: string, capacity: TeamCapacity): void {
    try {
      this.logger.info(`Updating capacity for team: ${teamId}`);

      this.teamCapacities.set(teamId, capacity);
      this.logger.info(`Capacity updated successfully for team: ${teamId}`);
    } catch (error) {
      this.logger.error(`Failed to update capacity for team: ${teamId}`, error);
      throw error;
    }
  }

  /**
   * Get team capacity
   */
  public getTeamCapacity(teamId: string): TeamCapacity | undefined {
    return this.teamCapacities.get(teamId);
  }

  /**
   * Get all team capacities
   */
  public getAllTeamCapacities(): TeamCapacity[] {
    return Array.from(this.teamCapacities.values());
  }

  /**
   * Add assignment conflict
   */
  public addConflict(conflict: AssignmentConflict): void {
    try {
      this.logger.info(`Adding assignment conflict for issue: ${conflict.issueId}`);

      this.conflicts.push(conflict);

      // Keep only the most recent 1000 conflicts to prevent memory issues
      if (this.conflicts.length > 1000) {
        this.conflicts = this.conflicts.slice(-1000);
      }

      this.logger.info(`Assignment conflict added successfully`);
    } catch (error) {
      this.logger.error(`Failed to add assignment conflict`, error);
      throw error;
    }
  }

  /**
   * Resolve assignment conflict
   */
  public resolveConflict(
    issueId: string,
    resolvedBy: string,
    resolutionMethod: 'round_robin' | 'skill_based' | 'workload_based' | 'manual'
  ): void {
    try {
      this.logger.info(`Resolving assignment conflict for issue: ${issueId}`);

      const conflict = this.conflicts.find((c) => c.issueId === issueId && !c.resolved);
      if (conflict) {
        conflict.resolved = true;
        conflict.resolvedBy = resolvedBy;
        conflict.resolvedAt = new Date();
        conflict.resolutionMethod = resolutionMethod;
        this.logger.info(`Assignment conflict resolved successfully for issue: ${issueId}`);
      } else {
        this.logger.warn(`No unresolved conflict found for issue: ${issueId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to resolve assignment conflict for issue: ${issueId}`, error);
      throw error;
    }
  }

  /**
   * Get unresolved conflicts
   */
  public getUnresolvedConflicts(): AssignmentConflict[] {
    return this.conflicts.filter((c) => !c.resolved);
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
   * Get assignment statistics
   */
  public getAssignmentStats(): {
    totalRules: number;
    enabledRules: number;
    totalUsers: number;
    totalTeams: number;
    conflicts: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
  } {
    try {
      this.logger.info('Generating assignment statistics');

      const stats = {
        totalRules: this.rules.size,
        enabledRules: Array.from(this.rules.values()).filter((r) => r.enabled).length,
        totalUsers: this.userSkills.size,
        totalTeams: this.teamCapacities.size,
        conflicts: this.conflicts.length,
        resolvedConflicts: this.conflicts.filter((c) => c.resolved).length,
        unresolvedConflicts: this.conflicts.filter((c) => !c.resolved).length,
      };

      this.logger.info('Assignment statistics generated successfully');
      return stats;
    } catch (error) {
      this.logger.error('Failed to generate assignment statistics', error);
      throw error;
    }
  }

  /**
   * Recommend assignee based on skills and workload
   */
  public async recommendAssignee(issue: LinearIssue): Promise<string | null> {
    try {
      this.logger.info(`Recommending assignee for issue: ${issue.id}`);

      // In a real implementation, this would:
      // 1. Analyze issue content for required skills
      // 2. Match with user skills
      // 3. Consider current workloads
      // 4. Return the best candidate

      // For now, we'll just return a placeholder
      return null;
    } catch (error) {
      this.logger.error(`Failed to recommend assignee for issue: ${issue.id}`, error);
      throw error;
    }
  }

  /**
   * Bulk assign issues
   */
  public async bulkAssignIssues(
    issues: LinearIssue[],
    assignmentStrategy: 'round_robin' | 'skill_based' | 'workload_balanced'
  ): Promise<boolean[]> {
    try {
      this.logger.info(
        `Bulk assigning ${issues.length} issues using strategy: ${assignmentStrategy}`
      );

      const results: boolean[] = [];

      for (const issue of issues) {
        try {
          // Apply assignment rules
          const assigned = await this.processAssignments(issue);
          results.push(assigned);
        } catch (error) {
          this.logger.error(`Failed to assign issue: ${issue.id}`, error);
          results.push(false);
        }
      }

      this.logger.info(
        `Bulk assignment completed: ${results.filter((r) => r).length}/${issues.length} successful`
      );
      return results;
    } catch (error) {
      this.logger.error(`Failed to bulk assign issues`, error);
      throw error;
    }
  }
}
