import { BaseAgent, AgentConfig, AgentResult } from './agent';
import { ProjectMemorySystem } from '../memory';

/**
 * Agent delegation system to allow agents to delegate tasks to more capable agents
 */
export class AgentDelegationSystem {
  private agents: Map<string, BaseAgent>;
  private projectMemory: ProjectMemorySystem;

  constructor(projectMemory: ProjectMemorySystem) {
    this.agents = new Map();
    this.projectMemory = projectMemory;
  }

  /**
   * Register an agent for potential delegation
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
   * Execute a task with potential delegation
   */
  public async executeWithDelegation(
    initialAgentName: string,
    task: string,
    options: {
      maxDelegations?: number;
      requireImprovement?: boolean;
    } = {}
  ): Promise<AgentResult> {
    const { maxDelegations = 3, requireImprovement = false } = options;
    let currentAgentName = initialAgentName;
    const currentTask = task;
    let currentResult: AgentResult | null = null;
    let delegationCount = 0;

    while (delegationCount <= maxDelegations) {
      // Get the current agent
      const agent = this.agents.get(currentAgentName);
      if (!agent) {
        return {
          output: `Agent ${currentAgentName} not found`,
          metadata: { error: true, delegationFailed: true },
        };
      }

      try {
        // Execute the task with the current agent
        const result = await agent.execute(currentTask);

        // Check if the agent wants to delegate
        if (result.nextAction === 'delegate' && result.delegateTo) {
          // Verify the delegate agent exists
          if (this.agents.has(result.delegateTo)) {
            currentAgentName = result.delegateTo;
            currentResult = result;
            delegationCount++;
            continue; // Continue to the next iteration with the new agent
          } else {
            // If delegate agent doesn't exist, continue with current agent's result
            return result;
          }
        }

        // Check if there's a more suitable agent for the task
        const betterAgent = this.findBetterAgent(currentTask, currentAgentName);
        if (betterAgent && delegationCount < maxDelegations) {
          currentAgentName = betterAgent;
          delegationCount++;
          continue; // Continue with the better agent
        }

        // If no delegation needed, return the result
        return result;
      } catch (error) {
        return {
          output: `Error executing task: ${(error as Error).message}`,
          metadata: { error: true, executionFailed: true },
        };
      }
    }

    // If we've reached max delegations, return the last result
    return (
      currentResult || {
        output: 'Maximum delegation depth reached',
        metadata: { delegationLimitReached: true },
      }
    );
  }

  /**
   * Find a better agent for the given task
   */
  private findBetterAgent(task: string, currentAgentName: string): string | null {
    const currentAgent = this.agents.get(currentAgentName);
    if (!currentAgent) {
      return null;
    }

    // Analyze the task to determine required capabilities
    const requiredCapabilities = this.analyzeTaskRequirements(task);

    // Find agents with the required capabilities
    const capableAgents = Array.from(this.agents.entries()).filter(
      ([name, agent]) =>
        name !== currentAgentName && this.hasRequiredCapabilities(agent, requiredCapabilities)
    );

    if (capableAgents.length === 0) {
      return null; // No better agent found
    }

    // For now, return the first better agent found
    // In a more sophisticated system, we might rank agents by expertise
    return capableAgents[0][0];
  }

  /**
   * Analyze a task to determine required capabilities
   */
  private analyzeTaskRequirements(task: string): string[] {
    const taskLower = task.toLowerCase();
    const capabilities: string[] = [];

    // Identify task type from keywords
    if (
      taskLower.includes('code') ||
      taskLower.includes('implement') ||
      taskLower.includes('function')
    ) {
      capabilities.push('coding');
    }

    if (
      taskLower.includes('plan') ||
      taskLower.includes('design') ||
      taskLower.includes('architecture')
    ) {
      capabilities.push('planning', 'design');
    }

    if (
      taskLower.includes('security') ||
      taskLower.includes('vulnerability') ||
      taskLower.includes('secure')
    ) {
      capabilities.push('security');
    }

    if (
      taskLower.includes('test') ||
      taskLower.includes('verify') ||
      taskLower.includes('validate')
    ) {
      capabilities.push('testing');
    }

    if (
      taskLower.includes('document') ||
      taskLower.includes('write') ||
      taskLower.includes('explain')
    ) {
      capabilities.push('writing', 'documentation');
    }

    if (taskLower.includes('bug') || taskLower.includes('fix') || taskLower.includes('debug')) {
      capabilities.push('debugging');
    }

    if (
      taskLower.includes('data') ||
      taskLower.includes('model') ||
      taskLower.includes('ml') ||
      taskLower.includes('ai')
    ) {
      capabilities.push('data', 'ml');
    }

    return capabilities;
  }

  /**
   * Check if an agent has the required capabilities
   */
  private hasRequiredCapabilities(agent: BaseAgent, requiredCapabilities: string[]): boolean {
    if (requiredCapabilities.length === 0) {
      return true;
    } // If no specific capabilities required, any agent can potentially help

    // Check if the agent has all the required capabilities
    for (const capability of requiredCapabilities) {
      if (
        !agent.capabilities.some(
          (ac) =>
            ac.toLowerCase().includes(capability.toLowerCase()) ||
            capability.toLowerCase().includes(ac.toLowerCase())
        )
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a delegation chain for a complex task
   */
  public async executeDelegationChain(
    initialAgentName: string,
    task: string,
    chain: Array<{ from: string; to: string; condition: (result: AgentResult) => boolean }>
  ): Promise<AgentResult> {
    let currentAgentName = initialAgentName;
    let currentTask = task;
    let result: AgentResult | null = null;

    for (const step of chain) {
      // Check if this step applies
      if (currentAgentName === step.from) {
        // Execute with current agent
        const agent = this.agents.get(currentAgentName);
        if (!agent) {
          return {
            output: `Agent ${currentAgentName} not found`,
            metadata: { error: true, delegationFailed: true },
          };
        }

        result = await agent.execute(currentTask);

        // Check if the condition for delegation is met
        if (step.condition(result)) {
          // Delegation condition is met, move to the next agent
          currentAgentName = step.to;
          currentTask = result.output; // Pass the result as the next task
        }
      }
    }

    // Execute with the final agent in the chain
    const finalAgent = this.agents.get(currentAgentName);
    if (!finalAgent) {
      return (
        result || {
          output: 'No agent to execute final task',
          metadata: { error: true },
        }
      );
    }

    return await finalAgent.execute(currentTask);
  }

  /**
   * Get available agents
   */
  public getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent capabilities mapping
   */
  public getAgentCapabilities(): { [agentName: string]: string[] } {
    const capabilities: { [agentName: string]: string[] } = {};

    for (const [name, agent] of this.agents.entries()) {
      capabilities[name] = agent.capabilities;
    }

    return capabilities;
  }

  /**
   * Recommend an agent for a specific task
   */
  public recommendAgent(task: string): string | null {
    const requiredCapabilities = this.analyzeTaskRequirements(task);

    for (const [name, agent] of this.agents.entries()) {
      if (this.hasRequiredCapabilities(agent, requiredCapabilities)) {
        return name;
      }
    }

    // If no agent has all required capabilities, return the one with the most overlap
    let bestAgent: string | null = null;
    let bestMatchCount = 0;

    for (const [name, agent] of this.agents.entries()) {
      let matchCount = 0;
      for (const capability of requiredCapabilities) {
        if (
          agent.capabilities.some(
            (ac) =>
              ac.toLowerCase().includes(capability.toLowerCase()) ||
              capability.toLowerCase().includes(ac.toLowerCase())
          )
        ) {
          matchCount++;
        }
      }

      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        bestAgent = name;
      }
    }

    return bestAgent;
  }
}
