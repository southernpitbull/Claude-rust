import { Octokit } from '@octokit/rest';
import axios from 'axios';

/**
 * Interface for GitHub repository information
 */
export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  name: string;
  description?: string;
  url: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
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
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  url: string;
  baseBranch: string;
  headBranch: string;
}

/**
 * GitHub integration for AIrchitect CLI
 */
export class GitHubIntegration {
  private octokit: Octokit | null = null;
  private token: string | null = null;

  constructor(token?: string) {
    if (token) {
      this.token = token;
      this.octokit = new Octokit({
        auth: token,
      });
    }
  }

  /**
   * Initialize GitHub integration with a token
   */
  public async initialize(token: string): Promise<boolean> {
    try {
      this.token = token;
      this.octokit = new Octokit({
        auth: token,
      });

      // Test the connection
      await this.octokit.rateLimit.get();
      return true;
    } catch (error) {
      console.error('Failed to initialize GitHub integration:', error);
      return false;
    }
  }

  /**
   * Check if connected to GitHub
   */
  public isConnected(): boolean {
    return !!this.octokit && !!this.token;
  }

  /**
   * Get repository information
   */
  public async getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.repos.get({
        owner,
        repo,
      });

      const repoData = response.data;
      return {
        owner: repoData.owner.login,
        repo: repoData.name,
        name: repoData.full_name,
        description: repoData.description || undefined,
        url: repoData.html_url,
        isPrivate: repoData.private,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
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
    options: { state?: 'open' | 'closed' | 'all'; labels?: string } = {}
  ): Promise<GitHubIssue[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.issues.listForRepo({
        owner,
        repo,
        state: options.state || 'open',
        labels: options.labels,
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
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        closedAt: issue.closed_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.issues.get({
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
        createdAt: issueData.created_at,
        updatedAt: issueData.updated_at,
        closedAt: issueData.closed_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.issues.create({
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
        createdAt: issueData.created_at,
        updatedAt: issueData.updated_at,
        closedAt: issueData.closed_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.pulls.list({
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
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.pulls.get({
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
        createdAt: prData.created_at,
        updatedAt: prData.updated_at,
        mergedAt: prData.merged_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.pulls.create({
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
        createdAt: prData.created_at,
        updatedAt: prData.updated_at,
        mergedAt: prData.merged_at || undefined,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.repos.getContent({
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.repos.getContent({
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.search.repos({
        q: query,
      });

      return response.data.items.map((repo) => ({
        owner: repo.owner.login,
        repo: repo.name,
        name: repo.full_name,
        description: repo.description || undefined,
        url: repo.html_url,
        isPrivate: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.users.getAuthenticated();
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
    if (!this.isConnected()) {
      throw new Error('Not connected to GitHub. Please initialize first.');
    }

    try {
      const response = await this.octokit!.repos.listForAuthenticatedUser();
      return response.data.map((repo) => ({
        owner: repo.owner.login,
        repo: repo.name,
        name: repo.full_name,
        description: repo.description || undefined,
        url: repo.html_url,
        isPrivate: repo.private,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
      }));
    } catch (error) {
      console.error('Failed to get user repositories:', error);
      return [];
    }
  }
}
