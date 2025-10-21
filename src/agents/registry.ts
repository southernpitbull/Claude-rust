import { BaseAgent, AgentConfig } from './langgraph';
import {
  CodeGenerationAgent,
  CodeReviewAgent,
  TestingAgent,
  DebuggingAgent,
  RefactoringAgent,
  SecurityAgent,
  DocumentationAgent,
  PlanningAgent,
  ArchitectureAgent,
} from './specialized';

/**
 * Agent registry to manage all available agents
 */
export class AgentRegistry {
  private agents: Map<string, BaseAgent>;
  private defaultAgent: string | null;

  constructor() {
    this.agents = new Map();
    this.defaultAgent = null;
    // Don't initialize default agents in constructor
    // Use initialize() method instead
  }

  /**
   * Initialize the registry with default agents
   */
  public async initialize(): Promise<boolean> {
    try {
      this.initializeDefaultAgents();
      return true;
    } catch (error) {
      console.error('Failed to initialize default agents:', error);
      return false;
    }
  }

  /**
   * Register default agents
   */
  public async registerDefaultAgents(): Promise<boolean> {
    try {
      this.initializeDefaultAgents();
      return true;
    } catch (error) {
      console.error('Failed to register default agents:', error);
      return false;
    }
  }

  /**
   * Initialize default agents
   */
  private initializeDefaultAgents(): void {
    // Code Generation Agent
    this.registerAgent(
      new CodeGenerationAgent({
        name: 'code-generation-agent',
        description: 'Specializes in generating clean, efficient, and well-structured code',
      })
    );

    // Code Review Agent
    this.registerAgent(
      new CodeReviewAgent({
        name: 'code-review-agent',
        description: 'Analyzes and reviews code for quality, security, and best practices',
      })
    );

    // Testing Agent
    this.registerAgent(
      new TestingAgent({
        name: 'testing-agent',
        description: 'Generates and executes tests for code verification',
      })
    );

    // Debugging Agent
    this.registerAgent(
      new DebuggingAgent({
        name: 'debugging-agent',
        description: 'Assists with debugging workflows and identifying issues',
      })
    );

    // Refactoring Agent
    this.registerAgent(
      new RefactoringAgent({
        name: 'refactoring-agent',
        description: 'Specializes in code refactoring and optimization',
      })
    );

    // Security Agent
    this.registerAgent(
      new SecurityAgent({
        name: 'security-agent',
        description: 'Focuses on security analysis and vulnerability detection',
      })
    );

    // Documentation Agent
    this.registerAgent(
      new DocumentationAgent({
        name: 'documentation-agent',
        description: 'Creates and maintains project documentation',
      })
    );

    // Planning Agent
    this.registerAgent(
      new PlanningAgent({
        name: 'planning-agent',
        description: 'Focuses on strategic planning and architectural design',
      })
    );

    // Architecture Agent
    this.registerAgent(
      new ArchitectureAgent({
        name: 'architecture-agent',
        description: 'Specializes in system architecture and design patterns',
      })
    );

    // Set the first agent as default
    this.defaultAgent = 'code-generation-agent';
  }

  /**
   * Register a new agent
   */
  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);

    // If no default agent is set, set this as the default
    if (!this.defaultAgent) {
      this.defaultAgent = agent.getName();
    }
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(name: string): boolean {
    const removed = this.agents.delete(name);

    // If we removed the default agent, set a new default
    if (removed && this.defaultAgent === name) {
      this.defaultAgent = this.agents.size > 0 ? Array.from(this.agents.keys())[0] : null;
    }

    return removed;
  }

  /**
   * Get an agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get the default agent
   */
  public getDefaultAgent(): BaseAgent | undefined {
    if (!this.defaultAgent) {
      return undefined;
    }
    return this.agents.get(this.defaultAgent);
  }

  /**
   * Set the default agent
   */
  public setDefaultAgent(name: string): boolean {
    if (this.agents.has(name)) {
      this.defaultAgent = name;
      return true;
    }
    return false;
  }

  /**
   * List all registered agents
   */
  public listAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent information
   */
  public getAgentInfo(
    name: string
  ): { name: string; description: string; capabilities: string[] } | null {
    const agent = this.agents.get(name);
    if (!agent) {
      return null;
    }

    return {
      name: agent.getName(),
      description: agent.getDescription(),
      capabilities: agent.getCapabilities(),
    };
  }

  /**
   * List agents by capability
   */
  public listAgentsByCapability(capability: string): string[] {
    const matchingAgents: string[] = [];

    for (const [name, agent] of this.agents.entries()) {
      if (agent.hasCapability(capability)) {
        matchingAgents.push(name);
      }
    }

    return matchingAgents;
  }

  /**
   * Find the best agent for a specific task
   */
  public findBestAgentForTask(task: string): BaseAgent | null {
    // Simple keyword matching for now
    // In a real implementation, this would use more sophisticated matching

    const taskLower = task.toLowerCase();

    // Priority order for matching
    if (
      taskLower.includes('code') ||
      taskLower.includes('generate') ||
      taskLower.includes('implement')
    ) {
      const codeGenAgent = this.agents.get('code-generation-agent');
      if (codeGenAgent) {
        return codeGenAgent;
      }
    }

    if (
      taskLower.includes('review') ||
      taskLower.includes('quality') ||
      taskLower.includes('analyze')
    ) {
      const codeReviewAgent = this.agents.get('code-review-agent');
      if (codeReviewAgent) {
        return codeReviewAgent;
      }
    }

    if (taskLower.includes('test') || taskLower.includes('verify') || taskLower.includes('unit')) {
      const testingAgent = this.agents.get('testing-agent');
      if (testingAgent) {
        return testingAgent;
      }
    }

    if (taskLower.includes('debug') || taskLower.includes('fix') || taskLower.includes('error')) {
      const debuggingAgent = this.agents.get('debugging-agent');
      if (debuggingAgent) {
        return debuggingAgent;
      }
    }

    if (
      taskLower.includes('refactor') ||
      taskLower.includes('optimize') ||
      taskLower.includes('improve')
    ) {
      const refactoringAgent = this.agents.get('refactoring-agent');
      if (refactoringAgent) {
        return refactoringAgent;
      }
    }

    if (
      taskLower.includes('security') ||
      taskLower.includes('vulnerability') ||
      taskLower.includes('protect')
    ) {
      const securityAgent = this.agents.get('security-agent');
      if (securityAgent) {
        return securityAgent;
      }
    }

    if (
      taskLower.includes('document') ||
      taskLower.includes('write') ||
      taskLower.includes('explain')
    ) {
      const documentationAgent = this.agents.get('documentation-agent');
      if (documentationAgent) {
        return documentationAgent;
      }
    }

    if (
      taskLower.includes('plan') ||
      taskLower.includes('design') ||
      taskLower.includes('architect')
    ) {
      const planningAgent = this.agents.get('planning-agent');
      if (planningAgent) {
        return planningAgent;
      }

      const architectureAgent = this.agents.get('architecture-agent');
      if (architectureAgent) {
        return architectureAgent;
      }
    }

    // If no specific match, return the default agent
    return this.getDefaultAgent() || null;
  }

  /**
   * Get statistics about registered agents
   */
  public getStats(): { totalAgents: number; capabilities: string[]; defaultAgent: string | null } {
    const allCapabilities = new Set<string>();

    for (const agent of this.agents.values()) {
      for (const capability of agent.getCapabilities()) {
        allCapabilities.add(capability);
      }
    }

    return {
      totalAgents: this.agents.size,
      capabilities: Array.from(allCapabilities),
      defaultAgent: this.defaultAgent,
    };
  }

  /**
   * Check if an agent exists
   */
  public hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Get all agents
   */
  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get the agent count
   */
  public getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Cleanup method
   */
  public cleanup(): void {
    // In a real implementation, this might clean up resources
    // For now, we'll just log
    console.log('Agent registry cleaned up');
  }
}
