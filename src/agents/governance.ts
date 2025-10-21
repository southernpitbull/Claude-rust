import { BaseAgent, AgentConfig, AgentResult } from './agent';
import { AgentRegistry } from './registry';

/**
 * Interface for agent governance rules
 */
export interface GovernanceRule {
  id: string;
  name: string;
  description: string;
  condition: (agent: BaseAgent, input: string) => boolean;
  action: (agent: BaseAgent, input: string) => string | null;
  priority: number;
}

/**
 * Interface for agent governance decisions
 */
export interface GovernanceDecision {
  allowed: boolean;
  modifiedInput?: string;
  reason?: string;
  ruleId?: string;
}

/**
 * Agent governance system to enforce rules and policies
 */
export class AgentGovernance {
  private rules: Map<string, GovernanceRule>;
  private registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.rules = new Map();
    this.registry = registry;
  }

  /**
   * Add a governance rule
   */
  public addRule(rule: GovernanceRule): boolean {
    if (this.rules.has(rule.id)) {
      return false; // Rule already exists
    }

    this.rules.set(rule.id, rule);
    return true;
  }

  /**
   * Remove a governance rule
   */
  public removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Check if an agent can execute a task based on governance rules
   */
  public checkExecution(agent: BaseAgent, input: string): GovernanceDecision {
    // Sort rules by priority (highest first)
    const sortedRules = Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (rule.condition(agent, input)) {
        const modifiedInput = rule.action(agent, input);

        if (modifiedInput === null) {
          // Rule blocks execution
          return {
            allowed: false,
            reason: rule.description,
            ruleId: rule.id,
          };
        } else {
          // Rule modifies input
          return {
            allowed: true,
            modifiedInput,
            reason: rule.description,
            ruleId: rule.id,
          };
        }
      }
    }

    // If no rules match, allow execution
    return { allowed: true };
  }

  /**
   * Batch check multiple agents for a task
   */
  public checkExecutionForTask(
    task: string,
    agentNames: string[]
  ): Array<{
    agentName: string;
    allowed: boolean;
    modifiedInput?: string;
    reason?: string;
    ruleId?: string;
  }> {
    return agentNames.map((agentName) => {
      const agent = this.registry.getAgent(agentName);
      if (!agent) {
        return {
          agentName,
          allowed: false,
          reason: 'Agent not found',
          ruleId: 'agent-not-found',
        };
      }

      const decision = this.checkExecution(agent, task);
      return {
        agentName,
        ...decision,
      };
    });
  }

  /**
   * Create a rule to prevent certain agents from accessing sensitive data
   */
  public createSensitiveDataRule(): GovernanceRule {
    return {
      id: 'sensitive-data-protection',
      name: 'Sensitive Data Protection',
      description: 'Prevents agents from accessing or processing sensitive data',
      condition: (agent: BaseAgent, input: string) => {
        const sensitivePatterns = [
          /password/i,
          /secret/i,
          /api.*key/i,
          /token/i,
          /credit.*card/i,
          /ssn/i,
          /social.*security/i,
        ];

        return sensitivePatterns.some((pattern) => pattern.test(input));
      },
      action: (agent: BaseAgent, input: string) => {
        // For sensitive data, we might modify the input to remove/obfuscate it
        // or return null to block execution
        return null; // Block execution for sensitive data
      },
      priority: 10,
    };
  }

  /**
   * Create a rule to limit agent capabilities
   */
  public createCapabilityLimitRule(capability: string): GovernanceRule {
    return {
      id: `capability-limit-${capability}`,
      name: `Capability Limit for ${capability}`,
      description: `Limits agents without ${capability} capability`,
      condition: (agent: BaseAgent, input: string) => {
        // If the task requires a specific capability and the agent doesn't have it
        return (
          input.toLowerCase().includes(capability.toLowerCase()) && !agent.hasCapability(capability)
        );
      },
      action: (agent: BaseAgent, input: string) => {
        return null; // Block execution if agent lacks required capability
      },
      priority: 5,
    };
  }

  /**
   * Create a rule to monitor and log agent activities
   */
  public createActivityLoggingRule(): GovernanceRule {
    return {
      id: 'activity-logging',
      name: 'Activity Logging',
      description: 'Logs all agent activities for audit purposes',
      condition: (agent: BaseAgent, input: string) => {
        // Apply to all agents
        return true;
      },
      action: (agent: BaseAgent, input: string) => {
        console.log(`[AUDIT] Agent ${agent.name} executing: ${input.substring(0, 100)}...`);
        // Return the original input to allow execution
        return input;
      },
      priority: 1,
    };
  }

  /**
   * Create a rule to prevent resource exhaustion
   */
  public createResourceLimitRule(maxExecutionTimeMs: number = 30000): GovernanceRule {
    return {
      id: 'resource-limit',
      name: 'Resource Limit',
      description: `Limits agent execution time to ${maxExecutionTimeMs}ms`,
      condition: (agent: BaseAgent, input: string) => {
        // This would be more complex in a real implementation
        // For now, we'll just return false to not block execution
        return false;
      },
      action: (agent: BaseAgent, input: string) => {
        return input;
      },
      priority: 8,
    };
  }

  /**
   * Apply governance to agent execution
   */
  public async applyGovernance(
    agentName: string,
    input: string
  ): Promise<{ decision: GovernanceDecision; output: AgentResult | null }> {
    const agent = this.registry.getAgent(agentName);
    if (!agent) {
      return {
        decision: {
          allowed: false,
          reason: 'Agent not found',
          ruleId: 'agent-not-found',
        },
        output: null,
      };
    }

    // Check governance rules
    const decision = this.checkExecution(agent, input);

    if (!decision.allowed) {
      return {
        decision,
        output: {
          output: `Execution blocked by governance: ${decision.reason}`,
          metadata: { governanceBlocked: true },
        },
      };
    }

    // Use modified input if provided by governance
    const finalInput = decision.modifiedInput || input;

    try {
      // Execute the agent with the final input
      const result = await agent.execute(finalInput);
      return { decision, output: result };
    } catch (error) {
      return {
        decision,
        output: {
          output: `Error during agent execution: ${(error as Error).message}`,
          metadata: { executionError: true },
        },
      };
    }
  }

  /**
   * Get all governance rules
   */
  public getRules(): GovernanceRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get number of governance rules
   */
  public getRulesCount(): number {
    return this.rules.size;
  }
}
