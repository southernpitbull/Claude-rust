import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  Annotation,
  Send,
  CompiledStateGraph,
} from '@langchain/langgraph';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * Interface for agent state
 */
export interface AgentState {
  messages: BaseMessage[];
  next: string;
  sender?: string;
  error?: string;
}

/**
 * Interface for agent configuration
 */
export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities: string[];
}

/**
 * Interface for agent result
 */
export interface AgentResult {
  messages: BaseMessage[];
  next: string;
  sender: string;
  error?: string;
}

/**
 * Base agent class for LangGraph integration
 */
export abstract class BaseAgent {
  protected name: string;
  protected description: string;
  protected model: BaseChatModel;
  protected systemPrompt: string;
  protected capabilities: string[];

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.systemPrompt =
      config.systemPrompt ||
      `You are ${config.name}, an AI assistant with the following capabilities: ${config.capabilities.join(', ')}.`;
    this.capabilities = config.capabilities;

    // Initialize the model based on provider
    switch (config.provider.toLowerCase()) {
      case 'openai':
        this.model = new ChatOpenAI({
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
        });
        break;
      case 'anthropic':
        this.model = new ChatAnthropic({
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
        });
        break;
      case 'google':
      case 'gemini':
        this.model = new ChatGoogleGenerativeAI({
          modelName: config.model,
          temperature: config.temperature || 0.7,
          maxOutputTokens: config.maxTokens,
        });
        break;
      default:
        // Default to OpenAI
        this.model = new ChatOpenAI({
          modelName: config.model || 'gpt-4',
          temperature: config.temperature || 0.7,
          maxTokens: config.maxTokens,
        });
    }
  }

  /**
   * Get agent name
   */
  public getName(): string {
    return this.name;
  }

  /**
   * Get agent description
   */
  public getDescription(): string {
    return this.description;
  }

  /**
   * Check if agent has a specific capability
   */
  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Get agent capabilities
   */
  public getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Main execution method for the agent
   */
  public abstract execute(state: AgentState): Promise<AgentResult>;

  /**
   * Call the agent with messages
   */
  protected async callModel(messages: BaseMessage[]): Promise<BaseMessage> {
    // Add system message if not present
    const allMessages = [...messages];
    if (!allMessages.some((msg) => msg instanceof SystemMessage)) {
      allMessages.unshift(new SystemMessage(this.systemPrompt));
    }

    try {
      const response = await this.model.invoke(allMessages);
      return response;
    } catch (error) {
      console.error(`Error calling model for agent ${this.name}:`, error);
      return new AIMessage(`Error: ${(error as Error).message}`);
    }
  }
}

/**
 * Planning agent for strategic thinking and architecture design
 */
export class PlanningAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      name: config.name || 'planning-agent',
      description: config.description || 'AI agent for strategic planning and architecture design',
      capabilities: config.capabilities || [
        'planning',
        'architecture',
        'requirements-analysis',
        'risk-assessment',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';
      if (response.content.toString().toLowerCase().includes('continue')) {
        next = 'work-agent'; // Hand off to work agent
      } else if (response.content.toString().toLowerCase().includes('delegate')) {
        next = 'specialized-agent'; // Hand off to specialized agent
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Work agent for implementation and coding tasks
 */
export class WorkAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      name: config.name || 'work-agent',
      description: config.description || 'AI agent for implementation and coding tasks',
      capabilities: config.capabilities || [
        'coding',
        'testing',
        'debugging',
        'refactoring',
        'documentation',
      ],
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';
      if (response.content.toString().toLowerCase().includes('plan')) {
        next = 'planning-agent'; // Hand off to planning agent
      } else if (response.content.toString().toLowerCase().includes('delegate')) {
        next = 'specialized-agent'; // Hand off to specialized agent
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Specialized agent for domain-specific tasks
 */
export class SpecializedAgent extends BaseAgent {
  private domain: string;

  constructor(config: AgentConfig, domain: string) {
    super({
      ...config,
      name: config.name || `${domain}-agent`,
      description: config.description || `AI agent specialized in ${domain}`,
      capabilities: config.capabilities || [domain],
    });
    this.domain = domain;
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      // Determine next action based on response
      let next = 'END';
      if (response.content.toString().toLowerCase().includes('handoff')) {
        next = 'coordinator-agent'; // Hand off to coordinator
      }

      return {
        messages: updatedMessages,
        next,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }

  public getDomain(): string {
    return this.domain;
  }
}

/**
 * Coordinator agent for managing agent interactions
 */
export class CoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: config.name || 'coordinator-agent',
      description: config.description || 'AI agent for coordinating other agents',
      capabilities: config.capabilities || [
        'coordination',
        'orchestration',
        'task-routing',
        'agent-management',
      ],
    });
    this.agents = new Map();
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    try {
      // Analyze the current state to determine next action
      const lastMessage = state.messages[state.messages.length - 1];

      // Determine which agent should handle the task
      let nextAgent = 'END';

      if (lastMessage.content.toString().toLowerCase().includes('plan')) {
        nextAgent = 'planning-agent';
      } else if (lastMessage.content.toString().toLowerCase().includes('code')) {
        nextAgent = 'work-agent';
      } else if (lastMessage.content.toString().toLowerCase().includes('test')) {
        nextAgent = 'testing-agent';
      } else if (lastMessage.content.toString().toLowerCase().includes('debug')) {
        nextAgent = 'debugging-agent';
      } else {
        // Default to planning agent for general tasks
        nextAgent = 'planning-agent';
      }

      // Generate response using the model
      const response = await this.callModel(state.messages);

      // Add the response to messages
      const updatedMessages = [...state.messages, response];

      return {
        messages: updatedMessages,
        next: nextAgent,
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: state.messages,
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  public getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }
}

/**
 * LangGraph workflow manager for agent coordination
 */
export class LangGraphWorkflow {
  private workflow: StateGraph<any>;
  private compiledGraph: CompiledStateGraph<any> | null = null;
  private agents: Map<string, BaseAgent>;

  constructor() {
    // Define the state schema
    const StateAnnotation = Annotation.Root({
      messages: MessagesAnnotation.messages,
      next: Annotation<string>,
      sender: Annotation<string>,
      error: Annotation<string>,
    });

    this.workflow = new StateGraph(StateAnnotation)
      .addNode('planning-agent', this.planningAgentNode.bind(this))
      .addNode('work-agent', this.workAgentNode.bind(this))
      .addNode('specialized-agent', this.specializedAgentNode.bind(this))
      .addNode('coordinator-agent', this.coordinatorAgentNode.bind(this));

    // Add edges
    this.workflow.addEdge(START, 'coordinator-agent');
    this.workflow.addEdge('planning-agent', 'coordinator-agent');
    this.workflow.addEdge('work-agent', 'coordinator-agent');
    this.workflow.addEdge('specialized-agent', 'coordinator-agent');
    this.workflow.addEdge('coordinator-agent', END);

    this.agents = new Map();
  }

  /**
   * Compile the workflow
   */
  public compile(): void {
    this.compiledGraph = this.workflow.compile();
  }

  /**
   * Add an agent to the workflow
   */
  public addAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  /**
   * Get an agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Execute the workflow
   */
  public async execute(input: string): Promise<AgentResult[]> {
    if (!this.compiledGraph) {
      this.compile();
    }

    const initialState: AgentState = {
      messages: [new HumanMessage(input)],
      next: 'coordinator-agent',
    };

    const results: AgentResult[] = [];
    const config = { configurable: { thread_id: '1' } };

    // In a real implementation, we would stream the results
    // For now, we'll simulate the execution
    const stream = await this.compiledGraph!.stream(initialState, config);

    for await (const chunk of stream) {
      if (chunk.messages) {
        results.push({
          messages: chunk.messages,
          next: chunk.next,
          sender: chunk.sender || 'unknown',
          error: chunk.error,
        });
      }
    }

    return results;
  }

  /**
   * Planning agent node function
   */
  private async planningAgentNode(state: AgentState): Promise<Partial<AgentState>> {
    const agent = this.agents.get('planning-agent');
    if (!agent) {
      return { next: 'END', error: 'Planning agent not found' };
    }

    const result = await agent.execute(state);
    return result;
  }

  /**
   * Work agent node function
   */
  private async workAgentNode(state: AgentState): Promise<Partial<AgentState>> {
    const agent = this.agents.get('work-agent');
    if (!agent) {
      return { next: 'END', error: 'Work agent not found' };
    }

    const result = await agent.execute(state);
    return result;
  }

  /**
   * Specialized agent node function
   */
  private async specializedAgentNode(state: AgentState): Promise<Partial<AgentState>> {
    const agent = this.agents.get('specialized-agent');
    if (!agent) {
      return { next: 'END', error: 'Specialized agent not found' };
    }

    const result = await agent.execute(state);
    return result;
  }

  /**
   * Coordinator agent node function
   */
  private async coordinatorAgentNode(state: AgentState): Promise<Partial<AgentState>> {
    const agent = this.agents.get('coordinator-agent');
    if (!agent) {
      return { next: 'END', error: 'Coordinator agent not found' };
    }

    const result = await agent.execute(state);
    return result;
  }
}

/**
 * Agent registry for managing available agents
 */
export class AgentRegistry {
  private agents: Map<string, BaseAgent>;

  constructor() {
    this.agents = new Map();
  }

  /**
   * Register an agent
   */
  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  /**
   * Get an agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent names
   */
  public getAgentNames(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Remove an agent
   */
  public removeAgent(name: string): boolean {
    return this.agents.delete(name);
  }

  /**
   * Check if an agent is registered
   */
  public hasAgent(name: string): boolean {
    return this.agents.has(name);
  }
}
