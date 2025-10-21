/**
 * IssueManager.ts
 *
 * Manages Linear issue operations including creation, updates, search, and filtering.
 * Provides high-level methods for issue management with proper error handling.
 */

import { LinearClient, LinearIssue } from './LinearClient';
import { Logger } from '../../utils/Logger';

export interface IssueFilter {
  state?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: string;
}

export interface IssueSearchOptions {
  query?: string;
  teamId?: string;
  filter?: IssueFilter;
  limit?: number;
  offset?: number;
}

export interface IssueUpdateInput {
  title?: string;
  description?: string;
  stateId?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: string;
  dueDate?: string;
  estimate?: number;
}

export interface IssueCreateInput {
  title: string;
  description?: string;
  teamId: string;
  stateId?: string;
  assigneeId?: string;
  labelIds?: string[];
  priority?: string;
  dueDate?: string;
  projectId?: string;
}

export class IssueManager {
  private linearClient: LinearClient;
  private logger: Logger;

  constructor(linearClient: LinearClient) {
    this.linearClient = linearClient;
    this.logger = new Logger('IssueManager');
  }

  /**
   * Create a new issue in Linear
   */
  public async createIssue(input: IssueCreateInput): Promise<LinearIssue> {
    try {
      this.logger.info(`Creating issue: ${input.title}`);

      const result = await this.linearClient.createIssue(input.teamId, {
        title: input.title,
        description: input.description,
        stateId: input.stateId,
        assigneeId: input.assigneeId,
        labelIds: input.labelIds,
        priority: input.priority,
        dueDate: input.dueDate,
        projectId: input.projectId,
      });

      this.logger.info(`Successfully created issue: ${result.id} - ${result.title}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create issue: ${input.title}`, error);
      throw error;
    }
  }

  /**
   * Update an existing issue
   */
  public async updateIssue(issueId: string, input: IssueUpdateInput): Promise<LinearIssue> {
    try {
      this.logger.info(`Updating issue: ${issueId}`);

      const result = await this.linearClient.updateIssue(issueId, input);

      this.logger.info(`Successfully updated issue: ${result.id} - ${result.title}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update issue: ${issueId}`, error);
      throw error;
    }
  }

  /**
   * Get an issue by its ID
   */
  public async getIssueById(id: string): Promise<LinearIssue | null> {
    try {
      this.logger.info(`Fetching issue: ${id}`);

      const issue = await this.linearClient.getIssueById(id);

      if (!issue) {
        this.logger.warn(`Issue not found: ${id}`);
        return null;
      }

      this.logger.info(`Successfully fetched issue: ${issue.id} - ${issue.title}`);
      return issue;
    } catch (error) {
      this.logger.error(`Failed to fetch issue: ${id}`, error);
      throw error;
    }
  }

  /**
   * Search for issues based on various criteria
   */
  public async searchIssues(options: IssueSearchOptions = {}): Promise<LinearIssue[]> {
    try {
      this.logger.info(`Searching issues with options:`, options);

      let issues: LinearIssue[] = [];

      if (options.query) {
        // Use search if query is provided
        issues = await this.linearClient.searchIssues(options.query);
      } else {
        // Otherwise, use filters
        issues = await this.linearClient.getIssues(options.teamId, options.filter);
      }

      // Apply client-side filtering if needed
      if (options.limit) {
        issues = issues.slice(options.offset || 0, (options.offset || 0) + options.limit);
      }

      this.logger.info(`Found ${issues.length} issues matching criteria`);
      return issues;
    } catch (error) {
      this.logger.error(`Failed to search issues`, error);
      throw error;
    }
  }

  /**
   * Get all issues with optional filtering
   */
  public async getAllIssues(filter?: IssueFilter, teamId?: string): Promise<LinearIssue[]> {
    try {
      this.logger.info(`Fetching all issues with filter:`, filter);

      const issues = await this.linearClient.getIssues(teamId, filter);

      this.logger.info(`Retrieved ${issues.length} issues`);
      return issues;
    } catch (error) {
      this.logger.error(`Failed to fetch all issues`, error);
      throw error;
    }
  }

  /**
   * Filter issues by state
   */
  public async getIssuesByState(state: string, teamId?: string): Promise<LinearIssue[]> {
    this.logger.info(`Fetching issues with state: ${state}`);
    return this.getAllIssues({ state }, teamId);
  }

  /**
   * Filter issues by assignee
   */
  public async getIssuesByAssignee(assigneeId: string, teamId?: string): Promise<LinearIssue[]> {
    this.logger.info(`Fetching issues assigned to: ${assigneeId}`);
    return this.getAllIssues({ assigneeId }, teamId);
  }

  /**
   * Filter issues by label
   */
  public async getIssuesByLabel(labelId: string, teamId?: string): Promise<LinearIssue[]> {
    this.logger.info(`Fetching issues with label: ${labelId}`);
    return this.getAllIssues({ labelIds: [labelId] }, teamId);
  }

  /**
   * Filter issues by priority
   */
  public async getIssuesByPriority(priority: string, teamId?: string): Promise<LinearIssue[]> {
    this.logger.info(`Fetching issues with priority: ${priority}`);
    return this.getAllIssues({ priority }, teamId);
  }

  /**
   * Archive an issue
   */
  public async archiveIssue(issueId: string): Promise<boolean> {
    try {
      this.logger.info(`Archiving issue: ${issueId}`);

      const success = await this.linearClient.archiveIssue(issueId);

      if (success) {
        this.logger.info(`Successfully archived issue: ${issueId}`);
      } else {
        this.logger.warn(`Failed to archive issue: ${issueId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to archive issue: ${issueId}`, error);
      throw error;
    }
  }

  /**
   * Bulk create multiple issues
   */
  public async bulkCreateIssues(inputs: IssueCreateInput[]): Promise<LinearIssue[]> {
    try {
      this.logger.info(`Bulk creating ${inputs.length} issues`);

      const results: LinearIssue[] = [];
      const errors: { input: IssueCreateInput; error: any }[] = [];

      for (const input of inputs) {
        try {
          const result = await this.createIssue(input);
          results.push(result);
        } catch (error) {
          errors.push({ input, error });
          this.logger.error(`Failed to create issue: ${input.title}`, error);
        }
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Bulk create completed with ${errors.length} errors out of ${inputs.length} operations`
        );
      }

      this.logger.info(`Successfully created ${results.length} issues in bulk`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to bulk create issues`, error);
      throw error;
    }
  }

  /**
   * Bulk update multiple issues
   */
  public async bulkUpdateIssues(
    updates: Array<{ issueId: string; input: IssueUpdateInput }>
  ): Promise<LinearIssue[]> {
    try {
      this.logger.info(`Bulk updating ${updates.length} issues`);

      const results: LinearIssue[] = [];
      const errors: { issueId: string; input: IssueUpdateInput; error: any }[] = [];

      for (const update of updates) {
        try {
          const result = await this.updateIssue(update.issueId, update.input);
          results.push(result);
        } catch (error) {
          errors.push({ ...update, error });
          this.logger.error(`Failed to update issue: ${update.issueId}`, error);
        }
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Bulk update completed with ${errors.length} errors out of ${updates.length} operations`
        );
      }

      this.logger.info(`Successfully updated ${results.length} issues in bulk`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to bulk update issues`, error);
      throw error;
    }
  }

  /**
   * Bulk archive multiple issues
   */
  public async bulkArchiveIssues(issueIds: string[]): Promise<boolean[]> {
    try {
      this.logger.info(`Bulk archiving ${issueIds.length} issues`);

      const results: boolean[] = [];
      const errors: { issueId: string; error: any }[] = [];

      for (const issueId of issueIds) {
        try {
          const success = await this.archiveIssue(issueId);
          results.push(success);
        } catch (error) {
          errors.push({ issueId, error });
          this.logger.error(`Failed to archive issue: ${issueId}`, error);
        }
      }

      if (errors.length > 0) {
        this.logger.warn(
          `Bulk archive completed with ${errors.length} errors out of ${issueIds.length} operations`
        );
      }

      this.logger.info(
        `Successfully archived ${results.filter((r) => r).length} out of ${issueIds.length} issues`
      );
      return results;
    } catch (error) {
      this.logger.error(`Failed to bulk archive issues`, error);
      throw error;
    }
  }

  /**
   * Get statistics about issues
   */
  public async getIssueStats(
    filter?: IssueFilter,
    teamId?: string
  ): Promise<{
    total: number;
    byState: Record<string, number>;
    byPriority: Record<string, number>;
    byAssignee: Record<string, number>;
  }> {
    try {
      this.logger.info(`Getting issue statistics with filter:`, filter);

      const issues = await this.getAllIssues(filter, teamId);

      const stats = {
        total: issues.length,
        byState: {} as Record<string, number>,
        byPriority: {} as Record<string, number>,
        byAssignee: {} as Record<string, number>,
      };

      for (const issue of issues) {
        // Count by state
        stats.byState[issue.state.name] = (stats.byState[issue.state.name] || 0) + 1;

        // Count by priority
        stats.byPriority[issue.priority] = (stats.byPriority[issue.priority] || 0) + 1;

        // Count by assignee
        if (issue.assignee) {
          stats.byAssignee[issue.assignee.name] = (stats.byAssignee[issue.assignee.name] || 0) + 1;
        }
      }

      this.logger.info(`Generated issue statistics`, stats);
      return stats;
    } catch (error) {
      this.logger.error(`Failed to get issue statistics`, error);
      throw error;
    }
  }

  /**
   * Find duplicate issues based on title
   */
  public async findDuplicateIssues(
    teamId?: string
  ): Promise<Array<{ issue1: LinearIssue; issue2: LinearIssue }>> {
    try {
      this.logger.info(`Finding duplicate issues in team: ${teamId || 'all teams'}`);

      const issues = await this.getAllIssues(undefined, teamId);
      const duplicates: Array<{ issue1: LinearIssue; issue2: LinearIssue }> = [];

      for (let i = 0; i < issues.length; i++) {
        for (let j = i + 1; j < issues.length; j++) {
          if (issues[i].title.toLowerCase() === issues[j].title.toLowerCase()) {
            duplicates.push({ issue1: issues[i], issue2: issues[j] });
          }
        }
      }

      this.logger.info(`Found ${duplicates.length} potential duplicate pairs`);
      return duplicates;
    } catch (error) {
      this.logger.error(`Failed to find duplicate issues`, error);
      throw error;
    }
  }
}
