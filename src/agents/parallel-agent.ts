import { BaseAgent, AgentConfig, AgentResult } from './agent';
import { ProjectMemorySystem } from '../memory';

/**
 * Parallel agent executor to run multiple agents simultaneously
 */
export class ParallelAgentExecutor {
  private agents: BaseAgent[];
  private projectMemory: ProjectMemorySystem;

  constructor(agents: BaseAgent[], projectMemory: ProjectMemorySystem) {
    this.agents = agents;
    this.projectMemory = projectMemory;
  }

  /**
   * Execute multiple agents in parallel on the same input
   */
  public async executeInParallel(
    input: string,
    timeoutMs: number = 30000
  ): Promise<
    Array<{
      agentName: string;
      result: AgentResult;
      error?: Error;
      executionTime: number;
    }>
  > {
    // Create promises for each agent execution
    const promises = this.agents.map((agent) => {
      return this.executeAgentWithTimeout(agent, input, timeoutMs);
    });

    // Wait for all promises to resolve
    const results = await Promise.all(promises);
    return results;
  }

  /**
   * Execute a single agent with timeout
   */
  private async executeAgentWithTimeout(
    agent: BaseAgent,
    input: string,
    timeoutMs: number
  ): Promise<{
    agentName: string;
    result: AgentResult;
    error?: Error;
    executionTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Create a promise that resolves when the agent finishes
      const agentPromise = agent.execute(input);

      // Create a timeout promise
      const timeoutPromise = new Promise<AgentResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Agent ${agent.name} execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between agent execution and timeout
      const result = await Promise.race([agentPromise, timeoutPromise]);

      return {
        agentName: agent.name,
        result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        agentName: agent.name,
        result: { output: `Error: ${(error as Error).message}`, metadata: { error: true } },
        error: error as Error,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute agents in parallel and aggregate results
   */
  public async executeWithAggregation(
    input: string,
    aggregatorFn?: (
      results: Array<{
        agentName: string;
        result: AgentResult;
        error?: Error;
        executionTime: number;
      }>
    ) => AgentResult
  ): Promise<AgentResult> {
    const results = await this.executeInParallel(input);

    // Filter out failed executions
    const successfulResults = results.filter((result) => !result.error);

    if (successfulResults.length === 0) {
      return {
        output: 'All agents failed to execute',
        metadata: { allFailed: true },
      };
    }

    // If no custom aggregator is provided, use a default one
    if (!aggregatorFn) {
      // Default aggregator: combine outputs and add metadata
      const combinedOutput = successfulResults
        .map((r) => `[${r.agentName}]: ${r.result.output}`)
        .join('\n\n');

      const metadata = {
        executionSummary: successfulResults.map((r) => ({
          agent: r.agentName,
          executionTime: r.executionTime,
          success: !r.error,
        })),
      };

      return {
        output: combinedOutput,
        metadata,
      };
    }

    return aggregatorFn(results);
  }

  /**
   * Execute agents in parallel with delegation based on expertise
   */
  public async executeWithDelegation(
    input: string,
    timeoutMs: number = 30000
  ): Promise<AgentResult> {
    // Determine which agents are most capable for this task
    const capableAgents = this.getCapableAgents(input);

    if (capableAgents.length === 0) {
      return {
        output: 'No agents are capable of handling this request',
        metadata: { noCapableAgents: true },
      };
    }

    // Execute only the capable agents in parallel
    const executor = new ParallelAgentExecutor(capableAgents, this.projectMemory);
    const results = await executor.executeInParallel(input, timeoutMs);

    // Combine results (simple concatenation for now)
    const combinedOutput = results
      .filter((r) => !r.error)
      .map((r) => `[${r.agentName}]: ${r.result.output}`)
      .join('\n\n');

    return {
      output: combinedOutput,
      metadata: {
        executionSummary: results.map((r) => ({
          agent: r.agentName,
          executionTime: r.executionTime,
          success: !r.error,
        })),
      },
    };
  }

  /**
   * Get agents that are capable for a specific input
   */
  private getCapableAgents(input: string): BaseAgent[] {
    // Simple keyword matching to determine capability
    // In a real implementation, this would be more sophisticated
    const inputLower = input.toLowerCase();

    return this.agents.filter((agent) => {
      // Check if any of the agent's capabilities match the input
      for (const capability of agent.capabilities) {
        if (inputLower.includes(capability.toLowerCase())) {
          return true;
        }
      }

      // Also check agent name and description
      if (
        agent.name.toLowerCase().includes(inputLower) ||
        agent.description.toLowerCase().includes(inputLower)
      ) {
        return true;
      }

      return false;
    });
  }

  /**
   * Execute agents in parallel and compare results
   */
  public async executeWithComparison(input: string): Promise<{
    input: string;
    results: Array<{
      agentName: string;
      result: AgentResult;
      executionTime: number;
      error?: Error;
    }>;
    comparison: {
      fastest: string;
      bestOutput: string;
      consensus: string | null;
      differences: string[];
    };
  }> {
    const results = await this.executeInParallel(input);

    // Find the fastest agent
    const fastestResult = results.reduce((fastest, current) => {
      if (!current.error && current.executionTime < fastest.executionTime) {
        return current;
      }
      return fastest;
    }, results[0]);

    // Find the agent with the best output (longest for now)
    const bestResult = results.reduce((best, current) => {
      if (!current.error && current.result.output.length > best.result.output.length) {
        return current;
      }
      return best;
    }, results[0]);

    // Look for consensus (simplified approach)
    const outputGroups: { [key: string]: string[] } = {};
    for (const result of results) {
      if (!result.error) {
        // Group similar outputs (simplified: using first 20 chars as key)
        const key = result.result.output.substring(0, 20).toLowerCase().replace(/\s+/g, '');
        if (!outputGroups[key]) {
          outputGroups[key] = [];
        }
        outputGroups[key].push(result.result.output);
      }
    }

    // Find the most common output pattern
    let consensus = null;
    let maxCount = 0;
    for (const [key, outputs] of Object.entries(outputGroups)) {
      if (outputs.length > maxCount && outputs.length > 1) {
        maxCount = outputs.length;
        consensus = outputs[0]; // Take the first output of the most common pattern
      }
    }

    // Find differences
    const allOutputs = results.filter((r) => !r.error).map((r) => r.result.output);
    const differences = this.findDifferences(allOutputs);

    return {
      input,
      results,
      comparison: {
        fastest: fastestResult.agentName,
        bestOutput: bestResult.result.output,
        consensus,
        differences,
      },
    };
  }

  /**
   * Find differences between outputs
   */
  private findDifferences(outputs: string[]): string[] {
    if (outputs.length < 2) {
      return [];
    }

    // This is a simplified approach - a real implementation would use
    // sophisticated text comparison algorithms
    const differences: string[] = [];

    for (let i = 1; i < outputs.length; i++) {
      if (outputs[i] !== outputs[0]) {
        differences.push(
          `Difference between outputs 1 and ${i + 1}: ${outputs[i].substring(0, 100)}...`
        );
      }
    }

    return differences;
  }
}
