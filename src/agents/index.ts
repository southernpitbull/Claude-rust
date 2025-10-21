/**
 * IntelligentAgentFramework - Core agent framework implementation
 *
 * This module provides the core agent framework that integrates
 * with LangGraph for intelligent agent workflows.
 */

import { StateGraph, START, END } from 'langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Interface for agent configuration
 */
export interface AgentConfig {
  /**
   * Agent name
   */
  name: string;

  /**
   * Agent description
   */
  description: string;

  /**
   * Agent capabilities
   */
  capabilities: string[];

  /**
   * AI model to use
   */
  model: string;

  /**
   * AI provider to use
   */
  provider: string;

  /**
   * Temperature setting for the model
   */
  temperature?: number;

  /**
   * Maximum tokens for responses
   */
  maxTokens?: number;

  /**
   * System prompt for the agent
   */
  systemPrompt?: string;

  /**
   * Whether the agent is enabled
   */
  enabled?: boolean;
}

/**
 * Interface for agent state
 */
export interface AgentState {
  /**
   * Messages in the conversation
   */
  messages: BaseMessage[];

  /**
   * Next agent to call
   */
  next: string;

  /**
   * Sender of the last message
   */
  sender?: string;

  /**
   * Error message if any
   */
  error?: string;
}

/**
 * Interface for agent result
 */
export interface AgentResult {
  /**
   * Messages to add to the conversation
   */
  messages: BaseMessage[];

  /**
   * Next agent to call
   */
  next: string;

  /**
   * Sender of the result
   */
  sender: string;

  /**
   * Error message if any
   */
  error?: string;
}

/**
 * Base class for all intelligent agents
 */
export abstract class BaseAgent {
  protected name: string;
  protected description: string;
  protected capabilities: string[];
  protected model: string;
  protected provider: string;
  protected temperature: number;
  protected maxTokens: number;
  protected systemPrompt: string;
  protected enabled: boolean;

  constructor(config: AgentConfig) {
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.model = config.model;
    this.provider = config.provider;
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 2048;
    this.systemPrompt =
      config.systemPrompt ||
      `You are ${config.name}, an AI assistant with the following capabilities: ${config.capabilities.join(', ')}.`;
    this.enabled = config.enabled !== undefined ? config.enabled : true;
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
   * Get agent capabilities
   */
  public getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Check if agent has a specific capability
   */
  public hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Get AI model
   */
  public getModel(): string {
    return this.model;
  }

  /**
   * Get AI provider
   */
  public getProvider(): string {
    return this.provider;
  }

  /**
   * Get agent temperature setting
   */
  public getTemperature(): number {
    return this.temperature;
  }

  /**
   * Get maximum tokens setting
   */
  public getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Get system prompt
   */
  public getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Check if agent is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable the agent
   */
  public enable(): void {
    this.enabled = true;
  }

  /**
   * Disable the agent
   */
  public disable(): void {
    this.enabled = false;
  }

  /**
   * Main execution method for the agent
   */
  public abstract execute(state: AgentState): Promise<AgentResult>;

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<boolean> {
    // Override in subclasses if initialization is needed
    return true;
  }

  /**
   * Clean up agent resources
   */
  public async cleanup(): Promise<void> {
    // Override in subclasses if cleanup is needed
  }

  /**
   * Get agent information
   */
  public getInfo(): AgentConfig {
    return {
      name: this.name,
      description: this.description,
      capabilities: [...this.capabilities],
      model: this.model,
      provider: this.provider,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      systemPrompt: this.systemPrompt,
      enabled: this.enabled,
    };
  }
}

/**
 * Agent registry to manage all available agents
 */
export class AgentRegistry {
  private agents: Map<string, BaseAgent>;
  private defaultAgent: string | null;

  constructor() {
    this.agents = new Map();
    this.defaultAgent = null;
  }

  /**
   * Register an agent
   */
  public registerAgent(agent: BaseAgent): boolean {
    if (this.agents.has(agent.getName())) {
      console.warn(`Agent ${agent.getName()} already registered, overwriting`);
    }

    this.agents.set(agent.getName(), agent);

    // Set as default if no default exists
    if (!this.defaultAgent) {
      this.defaultAgent = agent.getName();
    }

    return true;
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(name: string): boolean {
    const removed = this.agents.delete(name);

    // If we removed the default agent, clear the default
    if (removed && this.defaultAgent === name) {
      this.defaultAgent = null;
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
   * Set default agent
   */
  public setDefaultAgent(name: string): boolean {
    if (this.agents.has(name)) {
      this.defaultAgent = name;
      return true;
    }
    return false;
  }

  /**
   * Get default agent
   */
  public getDefaultAgent(): BaseAgent | undefined {
    if (this.defaultAgent) {
      return this.agents.get(this.defaultAgent);
    }
    return undefined;
  }

  /**
   * Find agents by capability
   */
  public findAgentsByCapability(capability: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.hasCapability(capability));
  }

  /**
   * Find best agent for a task
   */
  public findBestAgentForTask(task: string): BaseAgent | undefined {
    // Simple implementation - in a real system, this would be more sophisticated
    const taskLower = task.toLowerCase();

    // Priority order for matching
    if (taskLower.includes('code') || taskLower.includes('implement')) {
      const codeAgents = this.findAgentsByCapability('coding');
      return codeAgents.length > 0 ? codeAgents[0] : this.getDefaultAgent();
    }

    if (taskLower.includes('plan') || taskLower.includes('design')) {
      const planningAgents = this.findAgentsByCapability('planning');
      return planningAgents.length > 0 ? planningAgents[0] : this.getDefaultAgent();
    }

    if (taskLower.includes('test')) {
      const testingAgents = this.findAgentsByCapability('testing');
      return testingAgents.length > 0 ? testingAgents[0] : this.getDefaultAgent();
    }

    if (taskLower.includes('debug')) {
      const debuggingAgents = this.findAgentsByCapability('debugging');
      return debuggingAgents.length > 0 ? debuggingAgents[0] : this.getDefaultAgent();
    }

    // Default to the default agent
    return this.getDefaultAgent();
  }

  /**
   * Get agent registry statistics
   */
  public getStats(): {
    totalAgents: number;
    enabledAgents: number;
    capabilities: string[];
    defaultAgent: string | null;
  } {
    const capabilities = new Set<string>();

    for (const agent of this.agents.values()) {
      for (const capability of agent.getCapabilities()) {
        capabilities.add(capability);
      }
    }

    const enabledAgents = Array.from(this.agents.values()).filter((agent) =>
      agent.isEnabled()
    ).length;

    return {
      totalAgents: this.agents.size,
      enabledAgents,
      capabilities: Array.from(capabilities),
      defaultAgent: this.defaultAgent,
    };
  }
}

/**
 * Agent orchestrator to coordinate agent execution
 */
export class AgentOrchestrator {
  private registry: AgentRegistry;
  private workflow: StateGraph<AgentState> | null = null;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Initialize the orchestrator
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create the workflow graph
      this.workflow = new StateGraph<AgentState>({
        channels: {
          messages: {
            value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
            default: () => [],
          },
          next: null,
          sender: null,
          error: null,
        },
      });

      // Add nodes for each agent
      for (const agent of this.registry.getAllAgents()) {
        this.workflow.addNode(agent.getName(), async (state: AgentState) => {
          if (!agent.isEnabled()) {
            return {
              messages: [],
              next: END,
              sender: agent.getName(),
              error: `Agent ${agent.getName()} is disabled`,
            };
          }

          try {
            return await agent.execute(state);
          } catch (error) {
            return {
              messages: [],
              next: END,
              sender: agent.getName(),
              error: (error as Error).message,
            };
          }
        });
      }

      // Add edges between agents
      // This is a simplified implementation - in a real system, this would be more complex
      const agentNames = this.registry.getAgentNames();
      for (let i = 0; i < agentNames.length - 1; i++) {
        this.workflow.addEdge(agentNames[i], agentNames[i + 1]);
      }

      // Add start and end edges
      if (agentNames.length > 0) {
        this.workflow.addEdge(START, agentNames[0]);
        this.workflow.addEdge(agentNames[agentNames.length - 1], END);
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize agent orchestrator:', error);
      return false;
    }
  }

  /**
   * Execute a workflow
   */
  public async executeWorkflow(initialState: AgentState): Promise<AgentState> {
    if (!this.workflow) {
      throw new Error('Orchestrator not initialized');
    }

    try {
      // Compile the workflow
      const compiledWorkflow = this.workflow.compile();

      // Execute the workflow
      const finalState = await compiledWorkflow.invoke(initialState);

      return finalState;
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      throw error;
    }
  }

  /**
   * Execute a single agent
   */
  public async executeAgent(agentName: string, state: AgentState): Promise<AgentResult> {
    const agent = this.registry.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    if (!agent.isEnabled()) {
      throw new Error(`Agent ${agentName} is disabled`);
    }

    try {
      return await agent.execute(state);
    } catch (error) {
      throw new Error(`Failed to execute agent ${agentName}: ${(error as Error).message}`);
    }
  }

  /**
   * Get orchestrator statistics
   */
  public getStats(): {
    workflowInitialized: boolean;
    agentCount: number;
    defaultAgent: string | undefined;
  } {
    return {
      workflowInitialized: !!this.workflow,
      agentCount: this.registry.getAgentNames().length,
      defaultAgent: this.registry.getDefaultAgent()?.getName(),
    };
  }
}

/**
 * Example agent implementations
 */

/**
 * Planning Agent - Specializes in project planning and architecture design
 */
export class PlanningAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'planning-agent',
      description: config?.description || 'Specializes in project planning and architecture design',
      capabilities: config?.capabilities || ['planning', 'architecture', 'requirements-analysis'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software architect and planning specialist.
Your role is to help plan software projects, design system architectures, and analyze requirements.
Focus on creating detailed, actionable plans that consider scalability, maintainability, and best practices.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Planning agent processed the request: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Coding Agent - Specializes in code generation and implementation
 */
export class CodingAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'coding-agent',
      description: config?.description || 'Specializes in code generation and implementation',
      capabilities: config?.capabilities || ['coding', 'implementation', 'refactoring'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.2, // Lower temperature for more deterministic code
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software developer specializing in code generation.
Your role is to write clean, efficient, and well-documented code.
Always follow best practices, consider security, and write maintainable code.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Coding agent generated code for: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Testing Agent - Specializes in test generation and quality assurance
 */
export class TestingAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'testing-agent',
      description: config?.description || 'Specializes in test generation and quality assurance',
      capabilities: config?.capabilities || ['testing', 'quality-assurance', 'test-generation'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.5,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software tester specializing in test generation and quality assurance.
Your role is to create comprehensive test suites, identify edge cases, and ensure code quality.
Focus on writing effective unit tests, integration tests, and end-to-end tests.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Testing agent created tests for: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Debugging Agent - Specializes in debugging and issue resolution
 */
export class DebuggingAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'debugging-agent',
      description: config?.description || 'Specializes in debugging and issue resolution',
      capabilities: config?.capabilities || ['debugging', 'issue-resolution', 'troubleshooting'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.6,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert software debugger specializing in issue resolution and troubleshooting.
Your role is to analyze error messages, identify root causes, and provide solutions.
Focus on systematic debugging approaches and clear explanations.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Debugging agent analyzed: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Security Agent - Specializes in security analysis and vulnerability detection
 */
export class SecurityAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'security-agent',
      description:
        config?.description || 'Specializes in security analysis and vulnerability detection',
      capabilities: config?.capabilities || ['security', 'vulnerability-detection', 'compliance'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert cybersecurity specialist specializing in security analysis and vulnerability detection.
Your role is to identify security risks, analyze code for vulnerabilities, and ensure compliance.
Focus on OWASP Top 10, secure coding practices, and threat modeling.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Security agent analyzed: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Documentation Agent - Specializes in documentation generation and maintenance
 */
export class DocumentationAgent extends BaseAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'documentation-agent',
      description: config?.description || 'Specializes in documentation generation and maintenance',
      capabilities: config?.capabilities || ['documentation', 'writing', 'knowledge-management'],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.7,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert technical writer specializing in documentation generation and maintenance.
Your role is to create clear, comprehensive, and well-organized documentation.
Focus on user needs, clarity, and maintainability of documentation.`,
    });
  }

  public async execute(state: AgentState): Promise<AgentResult> {
    // In a real implementation, this would call an AI model
    // For now, we'll simulate a response
    const response = `Documentation agent created docs for: ${state.messages[state.messages.length - 1]?.content || 'No input'}`;

    return {
      messages: [{ content: response, role: 'assistant' }],
      next: 'END',
      sender: this.name,
    };
  }
}

/**
 * Main Intelligent Agent Framework
 */
export class IntelligentAgentFramework {
  private registry: AgentRegistry;
  private orchestrator: AgentOrchestrator;

  constructor() {
    this.registry = new AgentRegistry();
    this.orchestrator = new AgentOrchestrator(this.registry);

    // Register default agents
    this.registerDefaultAgents();
  }

  /**
   * Register default agents
   */
  private registerDefaultAgents(): void {
    this.registry.registerAgent(new PlanningAgent());
    this.registry.registerAgent(new CodingAgent());
    this.registry.registerAgent(new TestingAgent());
    this.registry.registerAgent(new DebuggingAgent());
    this.registry.registerAgent(new SecurityAgent());
    this.registry.registerAgent(new DocumentationAgent());

    // Set the first agent as default
    this.registry.setDefaultAgent('planning-agent');
  }

  /**
   * Initialize the framework
   */
  public async initialize(): Promise<boolean> {
    try {
      // Initialize all registered agents
      for (const agent of this.registry.getAllAgents()) {
        await agent.initialize();
      }

      // Initialize the orchestrator
      await this.orchestrator.initialize();

      return true;
    } catch (error) {
      console.error('Failed to initialize intelligent agent framework:', error);
      return false;
    }
  }

  /**
   * Register a new agent
   */
  public registerAgent(agent: BaseAgent): boolean {
    return this.registry.registerAgent(agent);
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(name: string): boolean {
    return this.registry.unregisterAgent(name);
  }

  /**
   * Get an agent by name
   */
  public getAgent(name: string): BaseAgent | undefined {
    return this.registry.getAgent(name);
  }

  /**
   * Get all registered agents
   */
  public getAllAgents(): BaseAgent[] {
    return this.registry.getAllAgents();
  }

  /**
   * Execute a workflow
   */
  public async executeWorkflow(initialState: AgentState): Promise<AgentState> {
    return await this.orchestrator.executeWorkflow(initialState);
  }

  /**
   * Execute a single agent
   */
  public async executeAgent(agentName: string, state: AgentState): Promise<AgentResult> {
    return await this.orchestrator.executeAgent(agentName, state);
  }

  /**
   * Find the best agent for a task
   */
  public findBestAgentForTask(task: string): BaseAgent | undefined {
    return this.registry.findBestAgentForTask(task);
  }

  /**
   * Get framework statistics
   */
  public getStats(): {
    registryStats: ReturnType<AgentRegistry['getStats']>;
    orchestratorStats: ReturnType<AgentOrchestrator['getStats']>;
  } {
    return {
      registryStats: this.registry.getStats(),
      orchestratorStats: this.orchestrator.getStats(),
    };
  }
}
