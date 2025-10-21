import {
  START,
  END,
  StateGraph,
  Message,
  Annotation,
  Send,
  BaseChannel,
  LastValue,
} from 'langgraph';
import { BaseMessage } from '@langchain/core/messages';
import { CredentialSystem } from '../credentials';
import { LangChainIntegration } from '../langchain';

/**
 * Interface for LangGraph workflow state
 */
export interface LangGraphState {
  messages: BaseMessage[];
  currentAgent: string;
  nextAgent?: string;
  error?: string;
  finished: boolean;
  metadata: Record<string, any>;
}

/**
 * Interface for LangGraph workflow configuration
 */
export interface LangGraphWorkflowConfig {
  name: string;
  description?: string;
  initialState: LangGraphState;
  allowedTransitions: Array<{
    from: string;
    to: string;
    condition?: (state: LangGraphState) => boolean;
  }>;
}

/**
 * LangGraph integration for AIrchitect CLI
 */
export class LangGraphIntegration {
  private credentialSystem: CredentialSystem;
  private langchainIntegration: LangChainIntegration;
  private workflows: Map<string, StateGraph<any>>;

  constructor(credentialSystem: CredentialSystem, langchainIntegration: LangChainIntegration) {
    this.credentialSystem = credentialSystem;
    this.langchainIntegration = langchainIntegration;
    this.workflows = new Map();
  }

  /**
   * Create a simple workflow graph
   */
  public async createSimpleWorkflow(
    name: string,
    nodes: Array<{
      name: string;
      action: (state: LangGraphState) => Promise<Partial<LangGraphState>>;
    }>
  ): Promise<boolean> {
    try {
      // Define the state annotation
      const LangGraphStateAnnotation = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
          reducer: (a, b) => a.concat(b),
          default: () => [],
        }),
        currentAgent: Annotation<string>,
        nextAgent: Annotation<string>,
        error: Annotation<string>,
        finished: Annotation<boolean>,
        metadata: Annotation<Record<string, any>>,
      });

      // Create the workflow
      const workflow = new StateGraph(LangGraphStateAnnotation);

      // Add nodes to the workflow
      for (const node of nodes) {
        workflow.addNode(node.name, node.action);
      }

      // Add entry point
      workflow.addEdge(START, nodes[0].name);

      // For simplicity, connect all nodes in sequence
      // In a real implementation, you'd define specific transitions
      for (let i = 0; i < nodes.length - 1; i++) {
        workflow.addEdge(nodes[i].name, nodes[i + 1].name);
      }

      // Connect the last node to END
      workflow.addEdge(nodes[nodes.length - 1].name, END);

      // Compile and store the workflow
      const compiledGraph = workflow.compile();
      this.workflows.set(name, compiledGraph);

      return true;
    } catch (error) {
      console.error(`Failed to create workflow ${name}:`, error);
      return false;
    }
  }

  /**
   * Create a conditional workflow
   */
  public async createConditionalWorkflow(config: LangGraphWorkflowConfig): Promise<boolean> {
    try {
      // Define the state annotation
      const LangGraphStateAnnotation = Annotation.Root({
        messages: Annotation<BaseMessage[]>({
          reducer: (a, b) => a.concat(b),
          default: () => [],
        }),
        currentAgent: Annotation<string>,
        nextAgent: Annotation<string>,
        error: Annotation<string>,
        finished: Annotation<boolean>,
        metadata: Annotation<Record<string, any>>,
      });

      // Create the workflow
      const workflow = new StateGraph(LangGraphStateAnnotation);

      // Add a router node to determine next step based on conditions
      const routerNode = async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
        // Default to the initial state
        let nextState: Partial<LangGraphState> = state;

        // Apply allowed transitions based on conditions
        for (const transition of config.allowedTransitions) {
          if (state.currentAgent === transition.from) {
            if (!transition.condition || transition.condition(state)) {
              nextState = { ...nextState, nextAgent: transition.to };
              break;
            }
          }
        }

        // If no transition condition was met, use default behavior
        if (nextState.nextAgent === state.currentAgent) {
          // Set finished if no more transitions are possible
          nextState = { ...nextState, finished: true };
        }

        return nextState;
      };

      // Add the router node
      workflow.addNode('router', routerNode);

      // Add edges based on allowed transitions
      for (const transition of config.allowedTransitions) {
        workflow.addConditionalEdges(
          transition.from,
          (state: LangGraphState) => {
            if (transition.condition && transition.condition(state)) {
              return transition.to;
            }
            return state.currentAgent; // Stay at current if condition not met
          },
          [transition.to, transition.from] // If condition met go to 'to', otherwise stay at 'from'
        );
      }

      // Connect start to initial agent
      workflow.addEdge(START, config.initialState.currentAgent);

      // Compile and store the workflow
      const compiledGraph = workflow.compile();
      this.workflows.set(config.name, compiledGraph);

      return true;
    } catch (error) {
      console.error(`Failed to create conditional workflow ${config.name}:`, error);
      return false;
    }
  }

  /**
   * Execute a workflow by name
   */
  public async executeWorkflow(
    name: string,
    initialState: LangGraphState
  ): Promise<LangGraphState | null> {
    const workflow = this.workflows.get(name);
    if (!workflow) {
      console.error(`Workflow ${name} not found`);
      return null;
    }

    try {
      // Execute the workflow
      const result = await workflow.invoke(initialState);
      return result as LangGraphState;
    } catch (error) {
      console.error(`Failed to execute workflow ${name}:`, error);
      return {
        ...initialState,
        error: (error as Error).message,
        finished: true,
      };
    }
  }

  /**
   * Create a workflow for planning tasks
   */
  public async createPlanningWorkflow(): Promise<boolean> {
    // Define nodes for planning workflow
    const nodes = [
      {
        name: 'analyze_requirements',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would analyze requirements
          // For now, we'll just pass through
          return { currentAgent: 'generate_design' };
        },
      },
      {
        name: 'generate_design',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would generate a system design
          return { currentAgent: 'create_plan' };
        },
      },
      {
        name: 'create_plan',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would create a detailed plan
          return { currentAgent: 'review_plan', finished: true };
        },
      },
      {
        name: 'review_plan',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would review the plan
          return { finished: true };
        },
      },
    ];

    return await this.createSimpleWorkflow('planning', nodes);
  }

  /**
   * Create a workflow for development tasks
   */
  public async createDevelopmentWorkflow(): Promise<boolean> {
    // Define nodes for development workflow
    const nodes = [
      {
        name: 'analyze_task',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would analyze the development task
          return { currentAgent: 'implement_solution' };
        },
      },
      {
        name: 'implement_solution',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would implement the solution
          return { currentAgent: 'write_tests' };
        },
      },
      {
        name: 'write_tests',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would write tests
          return { currentAgent: 'review_code' };
        },
      },
      {
        name: 'review_code',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would review the code
          return { currentAgent: 'merge_changes', finished: true };
        },
      },
      {
        name: 'merge_changes',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would merge changes
          return { finished: true };
        },
      },
    ];

    return await this.createSimpleWorkflow('development', nodes);
  }

  /**
   * Create a workflow for code review tasks
   */
  public async createCodeReviewWorkflow(): Promise<boolean> {
    const nodes = [
      {
        name: 'fetch_code',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would fetch code to review
          return { currentAgent: 'analyze_code' };
        },
      },
      {
        name: 'analyze_code',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would analyze the code
          return { currentAgent: 'generate_feedback' };
        },
      },
      {
        name: 'generate_feedback',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would generate feedback
          return { currentAgent: 'summarize_review' };
        },
      },
      {
        name: 'summarize_review',
        action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
          // In a real implementation, this would summarize the review
          return { finished: true };
        },
      },
    ];

    return await this.createSimpleWorkflow('code_review', nodes);
  }

  /**
   * Get a list of available workflows
   */
  public getAvailableWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Check if a workflow exists
   */
  public hasWorkflow(name: string): boolean {
    return this.workflows.has(name);
  }

  /**
   * Create a dynamic workflow based on input
   */
  public async createDynamicWorkflow(
    name: string,
    taskType: 'planning' | 'development' | 'review' | 'custom'
  ): Promise<boolean> {
    switch (taskType) {
      case 'planning':
        return await this.createPlanningWorkflow();
      case 'development':
        return await this.createDevelopmentWorkflow();
      case 'review':
        return await this.createCodeReviewWorkflow();
      case 'custom':
        // For custom workflows, we'd need more information
        // For now, we'll create a simple placeholder workflow
        return await this.createSimpleWorkflow(name, [
          {
            name: 'initial_step',
            action: async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
              return { finished: true };
            },
          },
        ]);
      default:
        return false;
    }
  }

  /**
   * Execute a workflow with a specific input
   */
  public async runWorkflowWithInput(
    name: string,
    input: string
  ): Promise<{ output: string; finished: boolean; error?: string }> {
    const workflow = this.workflows.get(name);
    if (!workflow) {
      return { output: '', finished: false, error: `Workflow ${name} not found` };
    }

    // Create initial state with the input
    const initialState: LangGraphState = {
      messages: [{ role: 'user', content: input } as BaseMessage],
      currentAgent: 'start',
      finished: false,
      metadata: {},
    };

    try {
      const result = await this.executeWorkflow(name, initialState);
      if (result) {
        return {
          output: result.messages[result.messages.length - 1]?.content || 'No output',
          finished: result.finished,
          error: result.error,
        };
      } else {
        return { output: '', finished: false, error: 'Failed to execute workflow' };
      }
    } catch (error) {
      return { output: '', finished: false, error: (error as Error).message };
    }
  }
}
