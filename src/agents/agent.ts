import { BaseMessage } from '@langchain/core/messages';
import { Runnable, RunnableConfig } from '@langchain/core/runnables';
import { AgentAction, AgentFinish } from '@langchain/core/agents';

/**
 * Interface for agent configuration
 */
export interface AgentConfig {
  name: string;
  description: string;
  capabilities: string[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Interface for agent execution result
 */
export interface AgentResult {
  output: string;
  metadata?: Record<string, any>;
  nextAction?: 'continue' | 'finish' | 'delegate';
  delegateTo?: string;
}

/**
 * Base agent class that can be extended by specific agent implementations
 */
export abstract class BaseAgent extends Runnable<any, AgentResult> {
  public name: string;
  public description: string;
  public capabilities: string[];
  lc_namespace: string[] = ['agents', 'custom'];

  constructor(config: AgentConfig) {
    super();
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
  }

  /**
   * The main execution method for the agent
   */
  public abstract execute(input: string, options?: any): Promise<AgentResult>;

  /**
   * LangGraph compatible invoke method
   */
  public override async invoke(input: any, options?: RunnableConfig): Promise<AgentResult> {
    // Convert input to string if needed
    const inputText = typeof input === 'string' ? input : JSON.stringify(input);
    return await this.execute(inputText, options);
  }

  /**
   * Batch invoke method (required by Runnable)
   */
  public override async batch(
    inputs: any[],
    options?: RunnableConfig | RunnableConfig[]
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    for (const input of inputs) {
      results.push(await this.invoke(input, Array.isArray(options) ? options[0] : options));
    }
    return results;
  }

  /**
   * Stream method (required by Runnable)
   */
  public override async *_streamIterator(
    input: any,
    options?: RunnableConfig
  ): AsyncGenerator<AgentResult> {
    yield await this.invoke(input, options);
  }

  /**
   * Check if the agent has a specific capability
   */
  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Get agent information
   */
  public getInfo(): AgentConfig {
    return {
      name: this.name,
      description: this.description,
      capabilities: [...this.capabilities],
    };
  }
}
