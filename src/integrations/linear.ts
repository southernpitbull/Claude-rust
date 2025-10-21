import axios, { AxiosInstance } from 'axios';

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
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
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
  startDate?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
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
 * Linear integration for AIrchitect CLI
 */
export class LinearIntegration {
  private axiosInstance: AxiosInstance | null = null;
  private apiKey: string | null = null;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null;
    this.baseUrl = 'https://api.linear.app/graphql';
  }

  /**
   * Initialize Linear integration with an API key
   */
  public async initialize(apiKey: string): Promise<boolean> {
    try {
      this.apiKey = apiKey;
      this.axiosInstance = axios.create({
        baseURL: this.baseUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Test the connection by fetching the authenticated user
      const testQuery = `
        query {
          viewer {
            id
            name
            email
          }
        }
      `;

      const response = await this.axiosInstance.post('', {
        query: testQuery,
      });

      if (response.data.errors) {
        console.error('Linear connection test failed:', response.data.errors);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize Linear integration:', error);
      return false;
    }
  }

  /**
   * Check if connected to Linear
   */
  public isConnected(): boolean {
    return !!this.axiosInstance && !!this.apiKey;
  }

  /**
   * Execute a GraphQL query
   */
  private async executeQuery(query: string, variables?: any): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Linear. Please initialize first.');
    }

    try {
      const response = await this.axiosInstance!.post('', {
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
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        dueDate: issue.dueDate || undefined,
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
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        dueDate: issue.dueDate || undefined,
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
      const labelIds = await this.getLabelIds(labels || []);
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
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        dueDate: issue.dueDate || undefined,
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
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        dueDate: issue.dueDate || undefined,
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
        startDate: project.startDate || undefined,
        targetDate: project.targetDate || undefined,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
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
        startDate: project.startDate || undefined,
        targetDate: project.targetDate || undefined,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
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
   * Get label IDs by name
   */
  private async getLabelIds(labelNames: string[]): Promise<string[]> {
    if (labelNames.length === 0) {
      return [];
    }

    const query = `
      query Labels {
        issueLabels {
          nodes {
            id
            name
          }
        }
      }
    `;

    try {
      const data = await this.executeQuery(query);

      const labelsByName = new Map(data.issueLabels.nodes.map((l: any) => [l.name, l.id]));
      return labelNames
        .map((name) => labelsByName.get(name))
        .filter((id) => id !== undefined) as string[];
    } catch (error) {
      console.error('Failed to get Linear label IDs:', error);
      return [];
    }
  }

  /**
   * Search issues in Linear
   */
  public async searchIssues(query: string, limit: number = 20): Promise<LinearIssue[]> {
    // Linear doesn't have a direct search API, so we'll get all issues and filter
    // In a real implementation, you'd want to implement proper search functionality
    // This is a simplified version
    const allIssues = await this.listIssues({ limit: 100 });
    return allIssues
      .filter(
        (issue) =>
          issue.title.toLowerCase().includes(query.toLowerCase()) ||
          (issue.description && issue.description.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, limit);
  }
}
