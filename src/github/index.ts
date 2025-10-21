/**
 * GitHub Integration for AIrchitect CLI
 *
 * This module provides integration with GitHub for repository management,
 * issue tracking, and collaboration features.
 */

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { createTokenAuth } from '@octokit/auth-token';
import { AIrchitectApp } from '../main';

/**
 * Interface for GitHub repository information
 */
export interface GitHubRepoInfo {
  owner: string;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  language?: string;
  topics: string[];
  defaultBranch: string;
}

/**
 * Interface for GitHub issue
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  author: string;
  assignees: string[];
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  url: string;
}

/**
 * Interface for GitHub pull request
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  assignees: string[];
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  url: string;
  baseBranch: string;
  headBranch: string;
}

/**
 * Interface for GitHub authentication configuration
 */
export interface GitHubAuthConfig {
  /**
   * Personal access token
   */
  token?: string;

  /**
   * GitHub App ID
   */
  appId?: number;

  /**
   * GitHub App private key
   */
  privateKey?: string;

  /**
   * Installation ID for GitHub App
   */
  installationId?: number;

  /**
   * OAuth client ID and secret
   */
  clientId?: string;
  clientSecret?: string;
}

/**
 * GitHub integration class
 */
export class GitHubIntegration {
  private octokit: Octokit | null = null;
  private authConfig: GitHubAuthConfig | null = null;
  private app: AIrchitectApp;

  constructor(app: AIrchitectApp, authConfig?: GitHubAuthConfig) {
    this.app = app;
    this.authConfig = authConfig || null;
  }

  /**
   * Initialize GitHub integration
   */
  public async initialize(): Promise<boolean> {
    try {
      if (this.authConfig?.token) {
        // Personal access token authentication
        this.octokit = new Octokit({
          auth: this.authConfig.token,
          userAgent: 'AIrchitect CLI v1.0.0',
        });
      } else if (
        this.authConfig?.appId &&
        this.authConfig?.privateKey &&
        this.authConfig?.installationId
      ) {
        // GitHub App authentication
        this.octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: this.authConfig.appId,
            privateKey: this.authConfig.privateKey,
            installationId: this.authConfig.installationId,
          },
          userAgent: 'AIrchitect CLI v1.0.0',
        });
      } else {
        // Anonymous access (limited functionality)
        this.octokit = new Octokit({
          userAgent: 'AIrchitect CLI v1.0.0',
        });
      }

      // Test authentication
      await this.testConnection();
      return true;
    } catch (error) {
      console.error('Failed to initialize GitHub integration:', error);
      return false;
    }
  }

  /**
   * Test GitHub connection
   */
  public async testConnection(): Promise<boolean> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      await this.octokit.rest.rateLimit.get();
      return true;
    } catch (error) {
      console.error('GitHub connection test failed:', error);
      return false;
    }
  }

  /**
   * Get repository information
   */
  public async getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const repoData = response.data;
      return {
        owner: repoData.owner.login,
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description || undefined,
        url: repoData.html_url,
        isPrivate: repoData.private,
        createdAt: new Date(repoData.created_at),
        updatedAt: new Date(repoData.updated_at),
        language: repoData.language || undefined,
        topics: repoData.topics || [],
        defaultBranch: repoData.default_branch,
      };
    } catch (error) {
      console.error(`Failed to get repository info for ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * List issues in a repository
   */
  public async listIssues(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; labels?: string[]; assignee?: string } = {}
  ): Promise<GitHubIssue[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: options.state || 'open',
        labels: options.labels?.join(',') || undefined,
        assignee: options.assignee,
      });

      return response.data.map((issue) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || undefined,
        state: issue.state as 'open' | 'closed',
        author: issue.user?.login || 'unknown',
        assignees: issue.assignees?.map((a) => a.login) || [],
        labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
        url: issue.html_url,
      }));
    } catch (error) {
      console.error(`Failed to list issues for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Get a specific issue
   */
  public async getIssue(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      const issueData = response.data;
      return {
        id: issueData.id,
        number: issueData.number,
        title: issueData.title,
        body: issueData.body || undefined,
        state: issueData.state as 'open' | 'closed',
        author: issueData.user?.login || 'unknown',
        assignees: issueData.assignees?.map((a) => a.login) || [],
        labels: issueData.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(issueData.created_at),
        updatedAt: new Date(issueData.updated_at),
        closedAt: issueData.closed_at ? new Date(issueData.closed_at) : undefined,
        url: issueData.html_url,
      };
    } catch (error) {
      console.error(`Failed to get issue ${issueNumber} for ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Create a new issue
   */
  public async createIssue(
    owner: string,
    repo: string,
    title: string,
    body?: string,
    assignees?: string[],
    labels?: string[]
  ): Promise<GitHubIssue | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.issues.create({
        owner,
        repo,
        title,
        body,
        assignees,
        labels,
      });

      const issueData = response.data;
      return {
        id: issueData.id,
        number: issueData.number,
        title: issueData.title,
        body: issueData.body || undefined,
        state: issueData.state as 'open' | 'closed',
        author: issueData.user?.login || 'unknown',
        assignees: issueData.assignees?.map((a) => a.login) || [],
        labels: issueData.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(issueData.created_at),
        updatedAt: new Date(issueData.updated_at),
        closedAt: issueData.closed_at ? new Date(issueData.closed_at) : undefined,
        url: issueData.html_url,
      };
    } catch (error) {
      console.error(`Failed to create issue in ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * List pull requests in a repository
   */
  public async listPullRequests(
    owner: string,
    repo: string,
    options: { state?: 'open' | 'closed' | 'all'; base?: string; head?: string } = {}
  ): Promise<GitHubPullRequest[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: options.state || 'open',
        base: options.base,
        head: options.head,
      });

      return response.data.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body || undefined,
        state: pr.state as 'open' | 'closed' | 'merged',
        author: pr.user?.login || 'unknown',
        assignees: pr.assignees?.map((a) => a.login) || [],
        labels: pr.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : undefined,
        url: pr.html_url,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
      }));
    } catch (error) {
      console.error(`Failed to list PRs for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Get a specific pull request
   */
  public async getPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<GitHubPullRequest | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      const prData = response.data;
      return {
        id: prData.id,
        number: prData.number,
        title: prData.title,
        body: prData.body || undefined,
        state: prData.state as 'open' | 'closed' | 'merged',
        author: prData.user?.login || 'unknown',
        assignees: prData.assignees?.map((a) => a.login) || [],
        labels: prData.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(prData.created_at),
        updatedAt: new Date(prData.updated_at),
        mergedAt: prData.merged_at ? new Date(prData.merged_at) : undefined,
        url: prData.html_url,
        baseBranch: prData.base.ref,
        headBranch: prData.head.ref,
      };
    } catch (error) {
      console.error(`Failed to get PR ${prNumber} for ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * Create a new pull request
   */
  public async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string, // branch name
    base: string, // branch name
    body?: string
  ): Promise<GitHubPullRequest | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
      });

      const prData = response.data;
      return {
        id: prData.id,
        number: prData.number,
        title: prData.title,
        body: prData.body || undefined,
        state: prData.state as 'open' | 'closed' | 'merged',
        author: prData.user?.login || 'unknown',
        assignees: prData.assignees?.map((a) => a.login) || [],
        labels: prData.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
        createdAt: new Date(prData.created_at),
        updatedAt: new Date(prData.updated_at),
        mergedAt: prData.merged_at ? new Date(prData.merged_at) : undefined,
        url: prData.html_url,
        baseBranch: prData.base.ref,
        headBranch: prData.head.ref,
      };
    } catch (error) {
      console.error(`Failed to create PR in ${owner}/${repo}:`, error);
      return null;
    }
  }

  /**
   * List files in a repository at a specific path
   */
  public async listFiles(owner: string, repo: string, path: string = ''): Promise<string[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(response.data)) {
        return response.data.filter((item) => item.type === 'file').map((item) => item.path);
      }
      return [];
    } catch (error) {
      console.error(`Failed to list files in ${owner}/${repo}/${path}:`, error);
      return [];
    }
  }

  /**
   * Get file content from a repository
   */
  public async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(response.data)) {
        return null; // We got a directory, not a file
      }

      if (response.data.encoding === 'base64' && response.data.content) {
        return Buffer.from(response.data.content, 'base64').toString('utf-8');
      }

      return response.data.content || null;
    } catch (error) {
      console.error(`Failed to get content of ${owner}/${repo}/${path}:`, error);
      return null;
    }
  }

  /**
   * Search for repositories
   */
  public async searchRepos(query: string): Promise<GitHubRepoInfo[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.search.repos({
        q: query,
      });

      return response.data.items.map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || undefined,
        url: repo.html_url,
        isPrivate: repo.private,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        language: repo.language || undefined,
        topics: repo.topics || [],
        defaultBranch: repo.default_branch,
      }));
    } catch (error) {
      console.error(`Failed to search repositories with query "${query}":`, error);
      return [];
    }
  }

  /**
   * Get the authenticated user's information
   */
  public async getAuthenticatedUser(): Promise<{
    login: string;
    name?: string;
    email?: string;
  } | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.users.getAuthenticated();
      return {
        login: response.data.login,
        name: response.data.name,
        email: response.data.email,
      };
    } catch (error) {
      console.error('Failed to get authenticated user:', error);
      return null;
    }
  }

  /**
   * Get user's repositories
   */
  public async getUserRepos(): Promise<GitHubRepoInfo[]> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.repos.listForAuthenticatedUser();
      return response.data.map((repo) => ({
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || undefined,
        url: repo.html_url,
        isPrivate: repo.private,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        language: repo.language || undefined,
        topics: repo.topics || [],
        defaultBranch: repo.default_branch,
      }));
    } catch (error) {
      console.error('Failed to get user repositories:', error);
      return [];
    }
  }

  /**
   * Check if integration is initialized
   */
  public isInitialized(): boolean {
    return !!this.octokit;
  }

  /**
   * Get authentication configuration
   */
  public getAuthConfig(): GitHubAuthConfig | null {
    return this.authConfig;
  }

  /**
   * Update authentication configuration
   */
  public async updateAuthConfig(newConfig: GitHubAuthConfig): Promise<boolean> {
    try {
      this.authConfig = newConfig;
      await this.initialize();
      return true;
    } catch (error) {
      console.error('Failed to update GitHub authentication config:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  public async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  } | null> {
    if (!this.octokit) {
      throw new Error('GitHub integration not initialized');
    }

    try {
      const response = await this.octokit.rest.rateLimit.get();
      const rate = response.data.rate;

      return {
        limit: rate.limit,
        remaining: rate.remaining,
        reset: new Date(rate.reset * 1000), // GitHub API returns timestamp in seconds
        used: rate.used,
      };
    } catch (error) {
      console.error('Failed to get GitHub rate limit:', error);
      return null;
    }
  }
}
