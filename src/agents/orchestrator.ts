import { GraphState, StateGraph, START, END } from 'langgraph';
import { BaseAgent } from './agent';
import { AgentRegistry } from './registry';
import { ProjectMemorySystem } from '../memory';

/**
 * Interface for agent orchestration state
 */
interface AgentOrchestrationState {
  input: string;
  currentAgent: string | null;
  output: string;
  metadata: Record<string, any>;
  nextAgent: string | null;
  completed: boolean;
  error?: string;
}

/**
 * Agent orchestrator to manage execution of multiple agents in a workflow
 */
export class AgentOrchestrator {
  private registry: AgentRegistry;
  private projectMemory: ProjectMemorySystem;
  private workflow: StateGraph<any> | null = null;
  private activeWorkflows: Map<string, any> = new Map();

  constructor(registry: AgentRegistry, projectMemory: ProjectMemorySystem) {
    this.registry = registry;
    this.projectMemory = projectMemory;
  }

  /**
   * Initialize the orchestration system
   */
  public async initialize(): Promise<void> {
    // Create the workflow graph
    this.workflow = new StateGraph<AgentOrchestrationState>({
      channels: {
        input: null,
        currentAgent: null,
        output: null,
        metadata: null,
        nextAgent: null,
        completed: null,
        error: null,
      },
    });

    // Add nodes to the workflow
    this.workflow
      .addNode('route', this.routeAgent.bind(this))
      .addNode('execute', this.executeAgent.bind(this))
      .addNode('memoryUpdate', this.updateMemory.bind(this))
      .addNode('errorHandler', this.handleError.bind(this))
      .addNode('finish', this.finish.bind(this));

    // Define edges
    this.workflow
      .addEdge(START, 'route')
      .addConditionalEdges('route', this.routeNext.bind(this))
      .addEdge('execute', 'memoryUpdate')
      .addConditionalEdges('memoryUpdate', this.routeNext.bind(this))
      .addEdge('errorHandler', END)
      .addEdge('finish', END);

    // Compile the workflow
    // Note: In a real implementation, you would compile the workflow here
  }

  /**
   * Route to appropriate agent based on input
   */
  private async routeAgent(
    state: AgentOrchestrationState
  ): Promise<Partial<AgentOrchestrationState>> {
    try {
      // Find the best agent for the task
      const bestAgent = this.registry.findBestAgentForTask(state.input);

      if (!bestAgent) {
        return {
          currentAgent: null,
          output: 'No suitable agent found for this task',
          completed: true,
          error: 'No agent available',
        };
      }

      return {
        currentAgent: bestAgent.name,
        nextAgent: null,
      };
    } catch (error) {
      return {
        error: `Routing error: ${(error as Error).message}`,
        output: `Error routing task: ${(error as Error).message}`,
        completed: true,
      };
    }
  }

  /**
   * Execute the selected agent
   */
  private async executeAgent(
    state: AgentOrchestrationState
  ): Promise<Partial<AgentOrchestrationState>> {
    if (!state.currentAgent) {
      return {
        output: 'No agent selected for execution',
        completed: true,
        error: 'No agent to execute',
      };
    }

    try {
      const agent = this.registry.getAgent(state.currentAgent);
      if (!agent) {
        return {
          output: `Agent ${state.currentAgent} not found`,
          completed: true,
          error: `Agent ${state.currentAgent} not found`,
        };
      }

      // Execute the agent
      const result = await agent.execute(state.input);

      // Determine next step based on result
      let nextAgentName: string | null = null;

      if (result.nextAction === 'delegate' && result.delegateTo) {
        nextAgentName = result.delegateTo;
      } else if (result.nextAction !== 'continue') {
        return {
          output: result.output,
          metadata: result.metadata || {},
          completed: true,
        };
      }

      return {
        output: result.output,
        metadata: result.metadata || {},
        nextAgent: nextAgentName,
        completed: result.nextAction !== 'continue',
      };
    } catch (error) {
      return {
        error: `Execution error: ${(error as Error).message}`,
        output: `Error executing agent: ${(error as Error).message}`,
        completed: true,
      };
    }
  }

  /**
   * Update project memory with execution results
   */
  private async updateMemory(
    state: AgentOrchestrationState
  ): Promise<Partial<AgentOrchestrationState>> {
    try {
      // Store the output in project memory
      await this.projectMemory.addConversation('assistant', state.output);

      // If there's metadata, store it too
      if (state.metadata && Object.keys(state.metadata).length > 0) {
        await this.projectMemory.store(`metadata_${Date.now()}`, state.metadata, {
          type: 'execution-metadata',
          timestamp: new Date().toISOString(),
        });
      }

      return {
        output: state.output,
        metadata: state.metadata,
      };
    } catch (error) {
      console.error('Memory update error:', error);
      // Continue execution even if memory update fails
      return {
        output: state.output,
        metadata: state.metadata,
      };
    }
  }

  /**
   * Handle errors in the workflow
   */
  private async handleError(
    state: AgentOrchestrationState
  ): Promise<Partial<AgentOrchestrationState>> {
    console.error('Agent orchestration error:', state.error);
    return state;
  }

  /**
   * Finish the workflow
   */
  private async finish(state: AgentOrchestrationState): Promise<Partial<AgentOrchestrationState>> {
    return {
      completed: true,
      ...state,
    };
  }

  /**
   * Determine next step in workflow
   */
  private routeNext(state: AgentOrchestrationState): string {
    if (state.error) {
      return 'errorHandler';
    }

    if (state.completed) {
      return 'finish';
    }

    if (state.nextAgent) {
      // If there's a next agent, we'd need to update the state to execute it
      // For simplicity in this implementation, we'll just finish
      // A full implementation would have a loop mechanism
      return 'finish';
    }

    return 'finish';
  }

  /**
   * Execute a workflow with input
   */
  public async executeWorkflow(input: string): Promise<AgentOrchestrationState> {
    // In a real implementation with LangGraph, this would run the actual workflow
    // For this implementation, we'll simulate the workflow execution

    const initialState: AgentOrchestrationState = {
      input,
      currentAgent: null,
      output: '',
      metadata: {},
      nextAgent: null,
      completed: false,
    };

    // Simulate the workflow execution
    let currentState = { ...initialState };

    // Route to agent
    const routedState = await this.routeAgent(currentState);
    currentState = { ...currentState, ...routedState };

    // Execute agent
    const executedState = await this.executeAgent(currentState);
    currentState = { ...currentState, ...executedState };

    // Update memory if not completed with error
    if (!currentState.error && !currentState.completed) {
      const memoryState = await this.updateMemory(currentState);
      currentState = { ...currentState, ...memoryState };
    }

    // Finish if completed
    if (currentState.completed) {
      const finishedState = await this.finish(currentState);
      currentState = { ...currentState, ...finishedState };
    }

    return currentState;
  }

  /**
   * Create a custom workflow with specific agents
   */
  public async createCustomWorkflow(name: string, agentSequence: string[]): Promise<boolean> {
    try {
      // Validate that all agents in sequence exist
      for (const agentName of agentSequence) {
        if (!this.registry.getAgent(agentName)) {
          throw new Error(`Agent ${agentName} does not exist in registry`);
        }
      }

      // Store the workflow configuration
      // In a real implementation, this would create and register a complex workflow
      this.activeWorkflows.set(name, agentSequence);
      return true;
    } catch (error) {
      console.error(`Error creating custom workflow ${name}:`, error);
      return false;
    }
  }

  /**
   * Execute a custom workflow
   */
  public async executeCustomWorkflow(workflowName: string, input: string): Promise<string> {
    const agentSequence = this.activeWorkflows.get(workflowName);
    if (!agentSequence || !Array.isArray(agentSequence)) {
      throw new Error(`Custom workflow ${workflowName} does not exist`);
    }

    let currentInput = input;

    for (const agentName of agentSequence) {
      const result = await this.registry.executeWithAgent(agentName, currentInput);
      currentInput = result.output;

      // Update memory with each step
      await this.projectMemory.addConversation('assistant', result.output);
    }

    return currentInput;
  }

  /**
   * Get available workflows
   */
  public getAvailableWorkflows(): string[] {
    return Array.from(this.activeWorkflows.keys());
  }
}
