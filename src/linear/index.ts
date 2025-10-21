/**
 * Linear Integration for AIrchitect CLI
 *
 * This module provides integration with Linear for project management,
 * issue tracking, and team collaboration features.
 */

import axios, { AxiosInstance } from 'axios';
import { AIrchitectApp } from '../main';

/**
 * Interface for Linear issue
 */
export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  state: string;
  priority: string;
  assignee?: string;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  project?: string;
  url: string;
}

/**
 * Interface for Linear project
 */
export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  state: string;
  startDate?: Date;
  targetDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  url: string;
}

/**
 * Interface for Linear user
 */
export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isMe: boolean;
}

/**
 * Interface for Linear authentication configuration
 */
export interface LinearAuthConfig {
  /**
   * Linear API token
   */
  token: string;

  /**
   * Base URL for Linear API
   */
  baseUrl?: string;
}

/**
 * Linear integration class
 */
export class LinearIntegration {
  private axiosInstance: AxiosInstance | null = null;
  private authConfig: LinearAuthConfig | null = null;
  private app: AIrchitectApp;
  private initialized: boolean = false;

  constructor(app: AIrchitectApp, authConfig?: LinearAuthConfig) {
    this.app = app;
    this.authConfig = authConfig || null;
  }

  /**
   * Initialize Linear integration
   */
  public async initialize(): Promise<boolean> {
    try {
      if (!this.authConfig?.token) {
        console.warn('Linear API token not provided');
        return false;
      }

      // Create Axios instance with Linear API configuration
      this.axiosInstance = axios.create({
        baseURL: this.authConfig.baseUrl || 'https://api.linear.app/graphql',
        headers: {
          Authorization: `Bearer ${this.authConfig.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      });

      // Test the connection
      const testResult = await this.testConnection();

      if (testResult) {
        this.initialized = true;
        console.log('Linear integration initialized successfully');
        return true;
      } else {
        console.error('Linear connection test failed');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize Linear integration:', error);
      return false;
    }
  }

  /**
   * Test Linear connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.axiosInstance) {
      throw new Error('Linear integration not initialized');
    }

    try {
      // Test query to get the authenticated user
      const query = `
        query {
          viewer {
            id
            name
            email
          }
        }
      `;

      const response = await this.axiosInstance.post('', {
        query,
      });

      if (response.data.errors) {
        console.error('Linear connection test failed:', response.data.errors);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Linear connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a GraphQL query
   */
  private async executeQuery(query: string, variables?: any): Promise<any> {
    if (!this.axiosInstance) {
      throw new Error('Linear integration not initialized');
    }

    try {
      const response = await this.axiosInstance.post('', {
        query,
        variables,
      });

      if (response.data.errors) {
        throw new Error(
          `Linear API error: ${response.data.errors.map((e: any) => e.message).join(', ')}`
        );
      }

      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to execute Linear query: ${(error as Error).message}`);
    }
  }

  /**
   * List issues in Linear
   */
  public async listIssues(
    options: {
      assignee?: string;
      state?: string;
      project?: string;
      limit?: number;
      archived?: boolean;
    } = {}
  ): Promise<LinearIssue[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { assignee, state, project, limit = 50, archived = false } = options;

    let filterString = '';
    if (assignee) {
      filterString += `assignee: { email: "${assignee}" }`;
    }
    if (state) {
      filterString += ` ${filterString ? 'and ' : ''}state: { name: "${state}" }`;
    }
    if (project) {
      filterString += ` ${filterString ? 'and ' : ''}project: { name: "${project}" }`;
    }
    if (archived !== undefined) {
      filterString += ` ${filterString ? 'and ' : ''}archived: ${archived}`;
    }

    const query = `
      query Issues($first: Int!) {
        issues(first: $first, filter: { ${filterString} }) {
          nodes {
            id
            title
            description
            state { name }
            priority
            assignee { name }
            labels { nodes { name } }
            createdAt
            updatedAt
            dueDate
            project { name }
            url
          }
          pageInfo { hasNextPage, endCursor }
        }
      }
    `;

    try {
      const data = await this.executeQuery(query, { first: limit });

      return data.issues.nodes.map((issue: any) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        state: issue.state?.name || 'Unscheduled',
        priority: issue.priority || 'unprioritized',
        assignee: issue.assignee?.name,
        labels: issue.labels?.nodes.map((l: any) => l.name) || [],
        createdAt: new Date(issue.createdAt),
        updatedAt: new Date(issue.updatedAt),
        dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
        project: issue.project?.name,
        url: issue.url,
      }));
    } catch (error) {
      console.error('Failed to list Linear issues:', error);
      return [];
    }
  }

  /**
   * Get a specific issue by ID
   */
  public async getIssue(issueId: string): Promise<LinearIssue | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          title
          description
          state { name }
          priority
          assignee { name }
          labels { nodes { name } }
          createdAt
          updatedAt
          dueDate
          project { name }
          url
        }
      }
    `;

    try {
      const data = await this.executeQuery(query, { id: issueId });

      if (!data.issue) {
        return null;
      }

      const issue = data.issue;
      return {
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        state: issue.state?.name || 'Unscheduled',
        priority: issue.priority || 'unprioritized',
        assignee: issue.assignee?.name,
        labels: issue.labels?.nodes.map((l: any) => l.name) || [],
        createdAt: new Date(issue.createdAt),
        updatedAt: new Date(issue.updatedAt),
        dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
        project: issue.project?.name,
        url: issue.url,
      };
    } catch (error) {
      console.error(`Failed to get Linear issue ${issueId}:`, error);
      return null;
    }
  }

  /**
   * Create a new issue in Linear
   */
  public async createIssue(
    title: string,
    description?: string,
    assigneeId?: string,
    projectId?: string,
    priority?: string,
    labels?: string[]
  ): Promise<LinearIssue | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      mutation CreateIssue(
        $title: String!,
        $description: String,
        $assigneeId: String,
        $projectId: String,
        $priority: String,
        $labelIds: [String!]
      ) {
        issueCreate(
          input: {
            title: $title,
            description: $description,
            assigneeId: $assigneeId,
            projectId: $projectId,
            priority: $priority,
            labelIds: $labelIds
          }
        ) {
          success
          issue {
            id
            title
            description
            state { name }
            priority
            assignee { name }
            labels { nodes { name } }
            createdAt
            updatedAt
            dueDate
            project { name }
            url
          }
        }
      }
    `;

    try {
      // Convert label names to IDs (simplified - in real implementation, we'd get actual IDs)
      const labelIds = labels?.map((label) => `label_${label}`) || [];

      const data = await this.executeQuery(query, {
        title,
        description,
        assigneeId,
        projectId,
        priority,
        labelIds,
      });

      if (!data.issueCreate.success || !data.issueCreate.issue) {
        console.error('Failed to create Linear issue:', data?.issueCreate?.error);
        return null;
      }

      const issue = data.issueCreate.issue;
      return {
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        state: issue.state?.name || 'Unscheduled',
        priority: issue.priority || 'unprioritized',
        assignee: issue.assignee?.name,
        labels: issue.labels?.nodes.map((l: any) => l.name) || [],
        createdAt: new Date(issue.createdAt),
        updatedAt: new Date(issue.updatedAt),
        dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
        project: issue.project?.name,
        url: issue.url,
      };
    } catch (error) {
      console.error('Failed to create Linear issue:', error);
      return null;
    }
  }

  /**
   * Update an existing Linear issue
   */
  public async updateIssue(
    issueId: string,
    updates: {
      title?: string;
      description?: string;
      assigneeId?: string;
      priority?: string;
      stateId?: string;
    }
  ): Promise<LinearIssue | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      mutation UpdateIssue(
        $id: String!,
        $title: String,
        $description: String,
        $assigneeId: String,
        $priority: String,
        $stateId: String
      ) {
        issueUpdate(
          id: $id,
          input: {
            title: $title,
            description: $description,
            assigneeId: $assigneeId,
            priority: $priority,
            stateId: $stateId
          }
        ) {
          success
          issue {
            id
            title
            description
            state { name }
            priority
            assignee { name }
            labels { nodes { name } }
            createdAt
            updatedAt
            dueDate
            project { name }
            url
          }
        }
      }
    `;

    try {
      const data = await this.executeQuery(query, {
        id: issueId,
        ...updates,
      });

      if (!data.issueUpdate.success || !data.issueUpdate.issue) {
        console.error('Failed to update Linear issue:', data?.issueUpdate?.error);
        return null;
      }

      const issue = data.issueUpdate.issue;
      return {
        id: issue.id,
        title: issue.title,
        description: issue.description || undefined,
        state: issue.state?.name || 'Unscheduled',
        priority: issue.priority || 'unprioritized',
        assignee: issue.assignee?.name,
        labels: issue.labels?.nodes.map((l: any) => l.name) || [],
        createdAt: new Date(issue.createdAt),
        updatedAt: new Date(issue.updatedAt),
        dueDate: issue.dueDate ? new Date(issue.dueDate) : undefined,
        project: issue.project?.name,
        url: issue.url,
      };
    } catch (error) {
      console.error(`Failed to update Linear issue ${issueId}:`, error);
      return null;
    }
  }

  /**
   * List projects in Linear
   */
  public async listProjects(
    options: { teamId?: string; limit?: number } = {}
  ): Promise<LinearProject[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { teamId, limit = 50 } = options;

    let filterString = '';
    if (teamId) {
      filterString = `team: { id: "${teamId}" }`;
    }

    const query = `
      query Projects($first: Int!) {
        projects(first: $first, filter: { ${filterString} }) {
          nodes {
            id
            name
            description
            state { name }
            startDate
            targetDate
            createdAt
            updatedAt
            url
          }
        }
      }
    `;

    try {
      const data = await this.executeQuery(query, { first: limit });

      return data.projects.nodes.map((project: any) => ({
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        state: project.state?.name || 'Unscheduled',
        startDate: project.startDate ? new Date(project.startDate) : undefined,
        targetDate: project.targetDate ? new Date(project.targetDate) : undefined,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        url: project.url,
      }));
    } catch (error) {
      console.error('Failed to list Linear projects:', error);
      return [];
    }
  }

  /**
   * Get a specific project by ID
   */
  public async getProject(projectId: string): Promise<LinearProject | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      query Project($id: String!) {
        project(id: $id) {
          id
          name
          description
          state { name }
          startDate
          targetDate
          createdAt
          updatedAt
          url
        }
      }
    `;

    try {
      const data = await this.executeQuery(query, { id: projectId });

      if (!data.project) {
        return null;
      }

      const project = data.project;
      return {
        id: project.id,
        name: project.name,
        description: project.description || undefined,
        state: project.state?.name || 'Unscheduled',
        startDate: project.startDate ? new Date(project.startDate) : undefined,
        targetDate: project.targetDate ? new Date(project.targetDate) : undefined,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
        url: project.url,
      };
    } catch (error) {
      console.error(`Failed to get Linear project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * List users in Linear
   */
  public async listUsers(): Promise<LinearUser[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      query Users {
        users {
          nodes {
            id
            name
            email
            avatarUrl
            isMe
          }
        }
      }
    `;

    try {
      const data = await this.executeQuery(query);

      return data.users.nodes.map((user: any) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isMe: user.isMe,
      }));
    } catch (error) {
      console.error('Failed to list Linear users:', error);
      return [];
    }
  }

  /**
   * Get the authenticated user
   */
  public async getAuthenticatedUser(): Promise<LinearUser | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = `
      query Viewer {
        viewer {
          id
          name
          email
          avatarUrl
          isMe
        }
      }
    `;

    try {
      const data = await this.executeQuery(query);

      if (!data.viewer) {
        return null;
      }

      return {
        id: data.viewer.id,
        name: data.viewer.name,
        email: data.viewer.email,
        avatarUrl: data.viewer.avatarUrl,
        isMe: data.viewer.isMe,
      };
    } catch (error) {
      console.error('Failed to get authenticated Linear user:', error);
      return null;
    }
  }

  /**
   * Search issues in Linear
   */
  public async searchIssues(query: string, limit: number = 20): Promise<LinearIssue[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Linear doesn't have a direct search API, so we'll get all issues and filter
    // In a real implementation, you'd want to implement proper search functionality
    const allIssues = await this.listIssues({ limit: 100 });
    return allIssues
      .filter(
        (issue) =>
          issue.title.toLowerCase().includes(query.toLowerCase()) ||
          (issue.description && issue.description.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, limit);
  }

  /**
   * Check if integration is initialized
   */
  public isInitialized(): boolean {
    return this.initialized && !!this.axiosInstance;
  }

  /**
   * Get authentication configuration
   */
  public getAuthConfig(): LinearAuthConfig | null {
    return this.authConfig;
  }

  /**
   * Update authentication configuration
   */
  public async updateAuthConfig(newConfig: LinearAuthConfig): Promise<boolean> {
    try {
      this.authConfig = newConfig;
      return await this.initialize();
    } catch (error) {
      console.error('Failed to update Linear authentication config:', error);
      return false;
    }
  }

  /**
   * Get Linear API rate limit information
   */
  public async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  } | null> {
    if (!this.axiosInstance) {
      throw new Error('Linear integration not initialized');
    }

    try {
      // Make a request to get rate limit headers
      const response = await this.axiosInstance.post('', {
        query: 'query { viewer { id } }',
      });

      // Extract rate limit information from headers
      const headers = response.headers;
      const limit = parseInt(headers['x-ratelimit-limit'] || '0');
      const remaining = parseInt(headers['x-ratelimit-remaining'] || '0');
      const reset = parseInt(headers['x-ratelimit-reset'] || '0');
      const used = parseInt(headers['x-ratelimit-used'] || '0');

      return {
        limit,
        remaining,
        reset: new Date(reset * 1000), // Convert seconds to milliseconds
        used,
      };
    } catch (error) {
      console.error('Failed to get Linear rate limit:', error);
      return null;
    }
  }
}
