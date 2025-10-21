import { BaseAgent, AgentConfig, AgentResult } from './agent';
import { ProjectMemorySystem } from '../memory';

/**
 * Agent evolution system to enable agents to learn and improve over time
 */
export class AgentEvolutionSystem {
  private agents: Map<string, BaseAgent>;
  private projectMemory: ProjectMemorySystem;
  private performanceHistory: Map<
    string,
    Array<{
      taskId: string;
      input: string;
      output: string;
      feedback: number; // 1-10 scale
      timestamp: Date;
      metadata: Record<string, any>;
    }>
  >;

  constructor(projectMemory: ProjectMemorySystem) {
    this.agents = new Map();
    this.projectMemory = projectMemory;
    this.performanceHistory = new Map();
  }

  /**
   * Register an agent for evolution tracking
   */
  public registerAgent(agent: BaseAgent): boolean {
    if (this.agents.has(agent.name)) {
      return false; // Agent already registered
    }

    this.agents.set(agent.name, agent);
    this.performanceHistory.set(agent.name, []);
    return true;
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentName: string): boolean {
    const deleted = this.agents.delete(agentName);
    this.performanceHistory.delete(agentName);
    return deleted;
  }

  /**
   * Execute an agent and track its performance
   */
  public async executeWithTracking(
    agentName: string,
    input: string,
    taskId?: string
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      return {
        output: `Agent ${agentName} not found`,
        metadata: { error: true },
      };
    }

    // Execute the agent
    const result = await agent.execute(input, { tracking: true });

    // Record the performance
    this.recordPerformance(
      agentName,
      taskId || `task_${Date.now()}`,
      input,
      result.output,
      0, // Initial feedback is 0, to be updated later
      result.metadata || {}
    );

    return result;
  }

  /**
   * Record agent performance for evolution
   */
  private recordPerformance(
    agentName: string,
    taskId: string,
    input: string,
    output: string,
    feedback: number,
    metadata: Record<string, any> = {}
  ): void {
    const history = this.performanceHistory.get(agentName) || [];
    history.push({
      taskId,
      input,
      output,
      feedback,
      timestamp: new Date(),
      metadata,
    });

    // Keep only the last 100 performance records per agent
    if (history.length > 100) {
      history.shift(); // Remove the oldest record
    }

    this.performanceHistory.set(agentName, history);
  }

  /**
   * Provide feedback on an agent's performance (for learning)
   */
  public provideFeedback(
    agentName: string,
    taskId: string,
    feedback: number, // 1-10 scale
    additionalNotes?: string
  ): boolean {
    const history = this.performanceHistory.get(agentName);
    if (!history) {
      return false;
    }

    const recordIndex = history.findIndex((record) => record.taskId === taskId);
    if (recordIndex === -1) {
      return false;
    }

    // Update the feedback
    history[recordIndex].feedback = feedback;

    if (additionalNotes) {
      history[recordIndex].metadata.notes = additionalNotes;
    }

    // Trigger evolution if feedback is significantly low
    if (feedback < 5) {
      this.triggerEvolution(agentName);
    }

    return true;
  }

  /**
   * Trigger agent evolution based on performance
   */
  private async triggerEvolution(agentName: string): Promise<void> {
    const history = this.performanceHistory.get(agentName);
    if (!history || history.length === 0) {
      return;
    }

    // Calculate average performance
    const totalFeedback = history.reduce((sum, record) => sum + record.feedback, 0);
    const avgFeedback = totalFeedback / history.length;

    // If performance is below threshold, trigger evolution
    if (avgFeedback < 6) {
      // In a real implementation, this would update the agent's parameters/model
      // For this example, we'll just log the evolution trigger
      console.log(
        `Triggering evolution for agent ${agentName} due to low performance (${avgFeedback})`
      );

      // Store evolution trigger in project memory
      await this.projectMemory.store(
        `evolution_trigger_${agentName}_${Date.now()}`,
        {
          agentName,
          avgFeedback,
          totalRecords: history.length,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'evolution-trigger',
          agentName,
          timestamp: new Date().toISOString(),
        }
      );
    }
  }

  /**
   * Get agent performance metrics
   */
  public getPerformanceMetrics(agentName: string): {
    totalTasks: number;
    averageFeedback: number;
    recentFeedback: number[];
    improvementTrend: 'improving' | 'declining' | 'stable';
  } | null {
    const history = this.performanceHistory.get(agentName);
    if (!history || history.length === 0) {
      return null;
    }

    const totalTasks = history.length;
    const totalFeedback = history.reduce((sum, record) => sum + record.feedback, 0);
    const averageFeedback = totalTasks > 0 ? totalFeedback / totalTasks : 0;

    // Get recent feedback (last 5 tasks)
    const recentRecords = history.slice(-5);
    const recentFeedback = recentRecords.map((record) => record.feedback);

    // Determine trend
    let improvementTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentFeedback.length >= 2) {
      const firstRecent = recentFeedback[0];
      const lastRecent = recentFeedback[recentFeedback.length - 1];

      if (lastRecent > firstRecent + 1) {
        improvementTrend = 'improving';
      } else if (lastRecent < firstRecent - 1) {
        improvementTrend = 'declining';
      }
    }

    return {
      totalTasks,
      averageFeedback,
      recentFeedback,
      improvementTrend,
    };
  }

  /**
   * Evolve an agent based on its performance history
   */
  public async evolveAgent(agentName: string): Promise<boolean> {
    const agent = this.agents.get(agentName);
    const history = this.performanceHistory.get(agentName);

    if (!agent || !history) {
      return false;
    }

    // Analyze performance patterns
    const patterns = this.analyzePerformancePatterns(history);

    // In a real implementation, this would update the agent's model or behavior
    // For this example, we'll just log the evolution
    console.log(`Evolving agent ${agentName} based on patterns:`, patterns);

    // Store evolution in project memory
    await this.projectMemory.store(
      `evolution_record_${agentName}_${Date.now()}`,
      {
        agentName,
        patterns,
        evolutionDate: new Date().toISOString(),
      },
      {
        type: 'evolution-record',
        agentName,
        timestamp: new Date().toISOString(),
      }
    );

    return true;
  }

  /**
   * Analyze performance patterns for evolution
   */
  private analyzePerformancePatterns(
    history: Array<{
      taskId: string;
      input: string;
      output: string;
      feedback: number;
      timestamp: Date;
      metadata: Record<string, any>;
    }>
  ): Array<{ pattern: string; frequency: number; avgFeedback: number }> {
    // This is a simplified pattern analysis
    // In a real implementation, this would use more sophisticated analysis

    // Find patterns based on input keywords and feedback
    const patternMap: { [key: string]: { count: number; totalFeedback: number } } = {};

    for (const record of history) {
      // Look for common keywords in the input that correlate with low/high feedback
      const inputLower = record.input.toLowerCase();
      const words = inputLower.split(/\s+/).filter((word) => word.length > 4); // Only consider words longer than 4 chars

      for (const word of words) {
        if (!patternMap[word]) {
          patternMap[word] = { count: 0, totalFeedback: 0 };
        }

        patternMap[word].count++;
        patternMap[word].totalFeedback += record.feedback;
      }
    }

    // Convert to array and calculate averages
    return Object.entries(patternMap)
      .map(([pattern, data]) => ({
        pattern,
        frequency: data.count,
        avgFeedback: data.totalFeedback / data.count,
      }))
      .sort((a, b) => b.frequency - a.frequency) // Sort by frequency
      .slice(0, 10); // Return top 10 patterns
  }

  /**
   * Get agents that need evolution
   */
  public getAgentsNeedingEvolution(minAvgFeedback: number = 6): string[] {
    const result: string[] = [];

    for (const [agentName, history] of this.performanceHistory.entries()) {
      if (history.length === 0) {
        continue;
      }

      const totalFeedback = history.reduce((sum, record) => sum + record.feedback, 0);
      const avgFeedback = totalFeedback / history.length;

      if (avgFeedback < minAvgFeedback) {
        result.push(agentName);
      }
    }

    return result;
  }

  /**
   * Automatically evolve all agents that need improvement
   */
  public async autoEvolve(): Promise<void> {
    const agentsNeedingEvolution = this.getAgentsNeedingEvolution();

    for (const agentName of agentsNeedingEvolution) {
      await this.evolveAgent(agentName);
    }
  }

  /**
   * Get all registered agents
   */
  public getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}
