import { BaseAgent, AgentConfig, AgentResult } from './agent';
import { ProjectMemorySystem } from '../memory';

/**
 * Collaboration manager to enable agents to work together
 */
export class AgentCollaborationManager {
  private agents: Map<string, BaseAgent>;
  private projectMemory: ProjectMemorySystem;
  private collaborationHistory: Array<{
    id: string;
    agents: string[];
    task: string;
    status: 'running' | 'completed' | 'failed';
    timestamp: Date;
    results?: AgentResult[];
  }>;

  constructor(projectMemory: ProjectMemorySystem) {
    this.agents = new Map();
    this.projectMemory = projectMemory;
    this.collaborationHistory = [];
  }

  /**
   * Register an agent for collaboration
   */
  public registerAgent(agent: BaseAgent): boolean {
    if (this.agents.has(agent.name)) {
      return false; // Agent already registered
    }

    this.agents.set(agent.name, agent);
    return true;
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentName: string): boolean {
    return this.agents.delete(agentName);
  }

  /**
   * Initiate a collaborative task between multiple agents
   */
  public async initiateCollaboration(
    agentNames: string[],
    task: string,
    maxRounds: number = 5
  ): Promise<AgentResult[]> {
    // Validate agents exist
    const validAgents = agentNames.filter((name) => this.agents.has(name));
    if (validAgents.length !== agentNames.length) {
      throw new Error(
        `Some agents not found: ${agentNames.filter((name) => !validAgents.includes(name)).join(', ')}`
      );
    }

    // Create a collaboration session
    const sessionId = `collab_${Date.now()}`;

    // Add to history
    this.collaborationHistory.push({
      id: sessionId,
      agents: agentNames,
      task,
      status: 'running',
      timestamp: new Date(),
    });

    try {
      const results: AgentResult[] = [];
      let currentInput = task;

      // Run multiple rounds of collaboration
      for (let round = 0; round < maxRounds; round++) {
        const roundResults: AgentResult[] = [];

        // Each agent processes the current input
        for (const agentName of agentNames) {
          const agent = this.agents.get(agentName)!;
          const result = await agent.execute(currentInput, { round, sessionId });

          roundResults.push(result);

          // Update the input for the next agent in the round
          // This simulates agents building on each other's work
          if (result.output.trim() !== '') {
            currentInput += `\n\n${agentName} added: ${result.output}`;
          }
        }

        results.push(...roundResults);

        // Check if task is completed based on results
        if (this.isTaskCompleted(roundResults, task)) {
          break;
        }
      }

      // Update history with results
      const historyIndex = this.collaborationHistory.findIndex((h) => h.id === sessionId);
      if (historyIndex !== -1) {
        this.collaborationHistory[historyIndex].status = 'completed';
        this.collaborationHistory[historyIndex].results = results;
      }

      return results;
    } catch (error) {
      // Update history with failure status
      const historyIndex = this.collaborationHistory.findIndex((h) => h.id === sessionId);
      if (historyIndex !== -1) {
        this.collaborationHistory[historyIndex].status = 'failed';
      }

      throw error;
    }
  }

  /**
   * Check if a task is completed by examining results
   */
  private isTaskCompleted(results: AgentResult[], originalTask: string): boolean {
    // Simple check: if any result contains keywords indicating completion
    for (const result of results) {
      if (
        result.output.toLowerCase().includes('completed') ||
        result.output.toLowerCase().includes('done') ||
        result.output.toLowerCase().includes('finished')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Enable agents to share information through memory
   */
  public async enableInformationSharing(agentNames: string[], topic: string): Promise<void> {
    // Retrieve relevant information from project memory
    const relevantInfo = await this.projectMemory.query(topic);

    // Create a shared context for the agents
    const sharedContext = relevantInfo.map((r) => r.content).join('\n\n');

    // Store the shared context in memory for agents to access
    await this.projectMemory.store(`shared_context_${Date.now()}`, sharedContext, {
      type: 'shared-context',
      topic,
      agentNames,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get available agents
   */
  public getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Find agents by capability
   */
  public findAgentsByCapability(capability: string): string[] {
    return Array.from(this.agents.values())
      .filter((agent) => agent.hasCapability(capability))
      .map((agent) => agent.name);
  }

  /**
   * Get collaboration history
   */
  public getCollaborationHistory(): Array<{
    id: string;
    agents: string[];
    task: string;
    status: 'running' | 'completed' | 'failed';
    timestamp: Date;
    results?: AgentResult[];
  }> {
    return [...this.collaborationHistory];
  }

  /**
   * Get results from the latest collaboration
   */
  public getLatestCollaborationResults(): AgentResult[] | undefined {
    if (this.collaborationHistory.length === 0) {
      return undefined;
    }

    const latest = this.collaborationHistory[this.collaborationHistory.length - 1];
    return latest.results;
  }

  /**
   * Create a specialized collaboration - e.g., for code review
   */
  public async conductCodeReview(
    code: string,
    reviewerAgents: string[] = []
  ): Promise<AgentResult[]> {
    // If no specific reviewer agents provided, use all available agents with coding capabilities
    if (reviewerAgents.length === 0) {
      reviewerAgents = this.findAgentsByCapability('coding').concat(
        this.findAgentsByCapability('review'),
        this.findAgentsByCapability('security')
      );

      // Remove duplicates
      reviewerAgents = [...new Set(reviewerAgents)];
    }

    if (reviewerAgents.length === 0) {
      return [
        {
          output: 'No agents available for code review',
          metadata: { error: true },
        },
      ];
    }

    // Store the code in memory for agents to access
    await this.projectMemory.store(`code_for_review_${Date.now()}`, code, {
      type: 'code',
      purpose: 'review',
      timestamp: new Date().toISOString(),
    });

    // Initiate collaboration with code review task
    return await this.initiateCollaboration(
      reviewerAgents,
      `Review the following code:\n\n${code}\n\nProvide feedback on quality, security, performance, and best practices.`
    );
  }

  /**
   * Create a specialized collaboration - e.g., for planning
   */
  public async createPlan(
    requirements: string,
    planningAgents: string[] = []
  ): Promise<AgentResult[]> {
    if (planningAgents.length === 0) {
      planningAgents = this.findAgentsByCapability('planning').concat(
        this.findAgentsByCapability('architecture'),
        this.findAgentsByCapability('project')
      );

      // Remove duplicates
      planningAgents = [...new Set(planningAgents)];
    }

    if (planningAgents.length === 0) {
      return [
        {
          output: 'No agents available for planning',
          metadata: { error: true },
        },
      ];
    }

    // Store the requirements in memory
    await this.projectMemory.store(`planning_requirements_${Date.now()}`, requirements, {
      type: 'requirements',
      purpose: 'planning',
      timestamp: new Date().toISOString(),
    });

    // Initiate collaboration with planning task
    return await this.initiateCollaboration(
      planningAgents,
      `Create a detailed plan based on these requirements:\n\n${requirements}\n\nConsider architecture, implementation steps, risks, and timeline.`
    );
  }
}
