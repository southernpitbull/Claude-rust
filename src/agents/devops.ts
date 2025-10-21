/**
 * DevOps-Specific Agents for AIrchitect CLI
 *
 * This module provides specialized agents for DevOps tasks
 * including infrastructure, containerization, CI/CD, monitoring,
 * security, testing, and deployment.
 */

import { BaseAgent, AgentConfig, AgentResult, AgentState } from './langgraph';
import { AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Base class for DevOps agents
 */
export abstract class DevOpsAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super({
      ...config,
      capabilities: [...(config.capabilities || []), 'devops'],
    });
  }

  /**
   * Execute method required by BaseAgent
   */
  public async execute(state: AgentState): Promise<AgentResult> {
    // Extract task from the last message
    const lastMessage = state.messages[state.messages.length - 1];
    const task = lastMessage.content.toString();

    // Create a minimal context from state
    const context: DevOpsContext = {
      project: {
        name: 'unknown',
        version: '0.0.0',
      },
    };

    return this.executeDevOpsTask(task, context);
  }

  /**
   * Execute a DevOps-specific task
   */
  public abstract executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult>;
}

/**
 * Interface for DevOps context
 */
export interface DevOpsContext {
  /**
   * Project information
   */
  project: {
    name: string;
    version: string;
    description?: string;
    language?: string;
    framework?: string;
  };

  /**
   * Infrastructure information
   */
  infrastructure?: {
    provider: string;
    region?: string;
    resources?: string[];
  };

  /**
   * CI/CD information
   */
  cicd?: {
    provider: string;
    pipelineFile?: string;
    stages?: string[];
  };

  /**
   * Container information
   */
  container?: {
    runtime: string;
    registry?: string;
    baseImage?: string;
  };

  /**
   * Monitoring information
   */
  monitoring?: {
    provider: string;
    metrics?: string[];
    alerts?: string[];
  };

  /**
   * Security information
   */
  security?: {
    provider: string;
    scans?: string[];
    policies?: string[];
  };

  /**
   * Testing information
   */
  testing?: {
    frameworks: string[];
    coverageTarget?: number;
    testTypes?: string[];
  };

  /**
   * Deployment information
   */
  deployment?: {
    environments: string[];
    strategy?: string;
    rollbackPlan?: string;
  };
}

/**
 * Infrastructure Agent
 *
 * Specializes in infrastructure as code (IaC) and cloud resource management
 */
export class InfrastructureAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'infrastructure-agent',
      description:
        config?.description ||
        'Specializes in infrastructure as code (IaC) and cloud resource management',
      capabilities: config?.capabilities || [
        'iac',
        'cloud-resources',
        'terraform',
        'cloudformation',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert DevOps engineer specializing in infrastructure as code and cloud resource management.
Your role is to help design, implement, and manage cloud infrastructure using tools like Terraform, CloudFormation, and CDK.
Focus on creating secure, scalable, and cost-effective infrastructure solutions.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute infrastructure task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [
          new AIMessage(`Error executing infrastructure task: ${(error as Error).message}`),
        ],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Container Agent
 *
 * Specializes in containerization, image building, and container orchestration
 */
export class ContainerAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'container-agent',
      description:
        config?.description ||
        'Specializes in containerization, image building, and container orchestration',
      capabilities: config?.capabilities || [
        'containerization',
        'docker',
        'kubernetes',
        'image-building',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert containerization specialist with deep knowledge of Docker, Kubernetes, and container orchestration.
Your role is to help design, build, and deploy containerized applications.
Focus on creating efficient, secure, and optimized container images and deployment configurations.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute container task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing container task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * CI/CD Agent
 *
 * Specializes in continuous integration and continuous deployment
 */
export class CICDAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'cicd-agent',
      description:
        config?.description || 'Specializes in continuous integration and continuous deployment',
      capabilities: config?.capabilities || [
        'ci-cd',
        'pipeline',
        'automation',
        'deployment',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.5,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert CI/CD specialist with deep knowledge of pipeline automation and deployment strategies.
Your role is to help design, implement, and optimize continuous integration and deployment pipelines.
Focus on creating reliable, efficient, and secure deployment workflows.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute CI/CD task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing CI/CD task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Monitoring Agent
 *
 * Specializes in monitoring, alerting, and observability
 */
export class MonitoringAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'monitoring-agent',
      description: config?.description || 'Specializes in monitoring, alerting, and observability',
      capabilities: config?.capabilities || [
        'monitoring',
        'observability',
        'alerting',
        'metrics',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert monitoring and observability specialist with deep knowledge of metrics, logging, and alerting systems.
Your role is to help design, implement, and optimize monitoring solutions for applications and infrastructure.
Focus on creating comprehensive observability with meaningful metrics and actionable alerts.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute monitoring task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing monitoring task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Security Agent
 *
 * Specializes in security scanning, compliance, and vulnerability management
 */
export class SecurityAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'security-agent',
      description:
        config?.description ||
        'Specializes in security scanning, compliance, and vulnerability management',
      capabilities: config?.capabilities || [
        'security',
        'vulnerability-scanning',
        'compliance',
        'penetration-testing',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert security specialist with deep knowledge of vulnerability scanning, compliance, and penetration testing.
Your role is to help identify, analyze, and remediate security vulnerabilities in applications and infrastructure.
Focus on creating secure systems with proper access controls, encryption, and threat modeling.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute security task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing security task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Testing Agent
 *
 * Specializes in automated testing, test generation, and quality assurance
 */
export class TestingAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'testing-agent',
      description:
        config?.description ||
        'Specializes in automated testing, test generation, and quality assurance',
      capabilities: config?.capabilities || [
        'testing',
        'test-generation',
        'quality-assurance',
        'test-automation',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.6,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert testing specialist with deep knowledge of automated testing, test generation, and quality assurance.
Your role is to help design, implement, and execute comprehensive test suites for applications.
Focus on creating reliable, maintainable, and effective tests that ensure code quality.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute testing task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing testing task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Deployment Agent
 *
 * Specializes in deployment strategies, rollback plans, and release management
 */
export class DeploymentAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'deployment-agent',
      description:
        config?.description ||
        'Specializes in deployment strategies, rollback plans, and release management',
      capabilities: config?.capabilities || [
        'deployment',
        'release-management',
        'rollback',
        'strategy',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.5,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert deployment specialist with deep knowledge of deployment strategies, rollback plans, and release management.
Your role is to help design, implement, and execute reliable deployment processes.
Focus on creating safe, efficient, and automated deployment workflows with proper rollback capabilities.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute deployment task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing deployment task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Database Agent
 *
 * Specializes in database management, schema design, and performance optimization
 */
export class DatabaseAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'database-agent',
      description:
        config?.description ||
        'Specializes in database management, schema design, and performance optimization',
      capabilities: config?.capabilities || [
        'database',
        'schema-design',
        'performance',
        'migration',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert database specialist with deep knowledge of database management, schema design, and performance optimization.
Your role is to help design, implement, and optimize database solutions for applications.
Focus on creating efficient, scalable, and secure database architectures with proper indexing and query optimization.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute database task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing database task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * Networking Agent
 *
 * Specializes in networking configuration, load balancing, and CDN management
 */
export class NetworkingAgent extends DevOpsAgent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: config?.name || 'networking-agent',
      description:
        config?.description ||
        'Specializes in networking configuration, load balancing, and CDN management',
      capabilities: config?.capabilities || [
        'networking',
        'load-balancing',
        'cdn',
        'dns',
        'devops',
      ],
      model: config?.model || 'gpt-4',
      provider: config?.provider || 'openai',
      temperature: config?.temperature || 0.4,
      maxTokens: config?.maxTokens || 2048,
      systemPrompt:
        config?.systemPrompt ||
        `You are an expert networking specialist with deep knowledge of network configuration, load balancing, and CDN management.
Your role is to help design, implement, and optimize network solutions for applications.
Focus on creating secure, performant, and scalable network architectures with proper load distribution and caching.`,
    });
  }

  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    try {
      // Generate response using the model
      const messages = [
        new SystemMessage(this.systemPrompt),
        new AIMessage(
          `Execute networking task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}`
        ),
      ];
      const response = await this.callModel(messages);

      return {
        messages: [response],
        next: 'END',
        sender: this.name,
      };
    } catch (error) {
      return {
        messages: [new AIMessage(`Error executing networking task: ${(error as Error).message}`)],
        next: 'END',
        sender: this.name,
        error: (error as Error).message,
      };
    }
  }
}

/**
 * DevOps Agent Registry
 *
 * Manages all DevOps-specific agents
 */
export class DevOpsAgentRegistry {
  private agents: Map<string, DevOpsAgent>;

  constructor() {
    this.agents = new Map();
    this.registerDefaultAgents();
  }

  /**
   * Register default DevOps agents
   */
  private registerDefaultAgents(): void {
    this.registerAgent(new InfrastructureAgent());
    this.registerAgent(new ContainerAgent());
    this.registerAgent(new CICDAgent());
    this.registerAgent(new MonitoringAgent());
    this.registerAgent(new SecurityAgent());
    this.registerAgent(new TestingAgent());
    this.registerAgent(new DeploymentAgent());
    this.registerAgent(new DatabaseAgent());
    this.registerAgent(new NetworkingAgent());
  }

  /**
   * Register a DevOps agent
   */
  public registerAgent(agent: DevOpsAgent): void {
    this.agents.set(agent.getName(), agent);
  }

  /**
   * Get a DevOps agent by name
   */
  public getAgent(name: string): DevOpsAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * List all DevOps agents
   */
  public listAgents(): DevOpsAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find agents by capability
   */
  public findAgentsByCapability(capability: string): DevOpsAgent[] {
    return Array.from(this.agents.values()).filter((agent) => agent.hasCapability(capability));
  }

  /**
   * Execute a DevOps task with the appropriate agent
   */
  public async executeDevOpsTask(task: string, context: DevOpsContext): Promise<AgentResult> {
    // Determine the best agent for the task
    const agent = this.findBestAgentForTask(task);

    if (!agent) {
      return {
        messages: [new AIMessage(`No suitable DevOps agent found for task: ${task}`)],
        next: 'END',
        sender: 'devops-agent-registry',
        error: 'No suitable agent found',
      };
    }

    // Execute the task with the selected agent
    return await agent.executeDevOpsTask(task, context);
  }

  /**
   * Find the best agent for a specific task
   */
  private findBestAgentForTask(task: string): DevOpsAgent | undefined {
    const taskLower = task.toLowerCase();

    // Priority matching based on task keywords
    if (
      taskLower.includes('infrastructure') ||
      taskLower.includes('terraform') ||
      taskLower.includes('cloud')
    ) {
      return this.getAgent('infrastructure-agent');
    }

    if (
      taskLower.includes('container') ||
      taskLower.includes('docker') ||
      taskLower.includes('kubernetes')
    ) {
      return this.getAgent('container-agent');
    }

    if (
      taskLower.includes('pipeline') ||
      taskLower.includes('ci/cd') ||
      taskLower.includes('deployment')
    ) {
      return this.getAgent('cicd-agent');
    }

    if (
      taskLower.includes('monitor') ||
      taskLower.includes('observability') ||
      taskLower.includes('alert')
    ) {
      return this.getAgent('monitoring-agent');
    }

    if (
      taskLower.includes('security') ||
      taskLower.includes('vulnerability') ||
      taskLower.includes('scan')
    ) {
      return this.getAgent('security-agent');
    }

    if (
      taskLower.includes('test') ||
      taskLower.includes('quality') ||
      taskLower.includes('coverage')
    ) {
      return this.getAgent('testing-agent');
    }

    if (
      taskLower.includes('deploy') ||
      taskLower.includes('release') ||
      taskLower.includes('rollback')
    ) {
      return this.getAgent('deployment-agent');
    }

    if (
      taskLower.includes('database') ||
      taskLower.includes('schema') ||
      taskLower.includes('migration')
    ) {
      return this.getAgent('database-agent');
    }

    if (taskLower.includes('network') || taskLower.includes('load') || taskLower.includes('cdn')) {
      return this.getAgent('networking-agent');
    }

    // Default to the first available agent
    const agents = this.listAgents();
    return agents.length > 0 ? agents[0] : undefined;
  }

  /**
   * Get registry statistics
   */
  public getStats(): {
    totalAgents: number;
    capabilities: string[];
  } {
    const capabilities = new Set<string>();

    for (const agent of this.agents.values()) {
      for (const capability of agent.getCapabilities()) {
        capabilities.add(capability);
      }
    }

    return {
      totalAgents: this.agents.size,
      capabilities: Array.from(capabilities),
    };
  }
}
