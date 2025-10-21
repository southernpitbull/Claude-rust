/**
 * Agent Orchestrator Tests
 *
 * Comprehensive test suite for multi-agent orchestration.
 */

import { AgentOrchestrator, Workflow, WorkflowStep } from '../../src/agents/agent-orchestrator';
import { BaseAgent } from '../../src/agents/agent-base';
import {
  AgentConfig,
  AgentCapability,
  AgentTask,
  AgentResult,
  AgentStatus,
} from '../../src/agents/types';
import { BaseProvider } from '../../src/providers/provider-base';
import {
  ProviderConfig,
  ProviderType,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  ModelInfo,
} from '../../src/providers/types';

class MockProvider extends BaseProvider {
  constructor() {
    super({
      name: 'mock-provider',
      type: ProviderType.OPENAI,
      api_key: 'test',
      default_model: 'gpt-4',
    });
  }

  public async testConnection(): Promise<boolean> {
    return true;
  }

  public async complete(): Promise<CompletionResponse> {
    return {
      id: 'test',
      model: 'gpt-4',
      content: 'Test response',
      finish_reason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      created_at: Date.now(),
    };
  }

  public async *streamComplete(): AsyncGenerator<StreamChunk, void, undefined> {
    yield {
      id: 'test',
      model: 'gpt-4',
      delta: { content: 'test' },
      finish_reason: null,
    };
  }

  public async getModels(): Promise<ModelInfo[]> {
    return [];
  }
}

class MockAgent extends BaseAgent {
  constructor(name: string, capabilities: AgentCapability[]) {
    const config: AgentConfig = {
      name,
      description: 'Mock agent for testing',
      capabilities,
      provider: 'mock-provider',
      model: 'gpt-4',
    };

    super(config, new MockProvider());
  }

  protected async onInitialize(): Promise<void> {
    // Mock initialization
  }

  protected async processTask(task: AgentTask): Promise<AgentResult> {
    return {
      task_id: task.id,
      status: 'success',
      output: `Processed by ${this.getName()}: ${task.description}`,
    };
  }
}

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let agent1: MockAgent;
  let agent2: MockAgent;

  beforeEach(async () => {
    orchestrator = new AgentOrchestrator();

    agent1 = new MockAgent('agent1', [AgentCapability.CODE_GENERATION]);
    agent2 = new MockAgent('agent2', [AgentCapability.CODE_REVIEW]);

    await agent1.initialize();
    await agent1.start();

    await agent2.initialize();
    await agent2.start();

    orchestrator.registerAgent(agent1);
    orchestrator.registerAgent(agent2);
  });

  describe('Agent Registration', () => {
    it('should register agents successfully', () => {
      const agents = orchestrator.getAgents();
      expect(agents.length).toBe(2);
      expect(agents.map((a) => a.getName())).toContain('agent1');
      expect(agents.map((a) => a.getName())).toContain('agent2');
    });

    it('should throw error when registering duplicate agent', () => {
      expect(() => {
        orchestrator.registerAgent(agent1);
      }).toThrow('already registered');
    });

    it('should unregister agents', () => {
      const result = orchestrator.unregisterAgent('agent1');
      expect(result).toBe(true);
      expect(orchestrator.getAgents().length).toBe(1);
    });

    it('should return false when unregistering non-existent agent', () => {
      const result = orchestrator.unregisterAgent('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Agent Retrieval', () => {
    it('should get agent by name', () => {
      const agent = orchestrator.getAgent('agent1');
      expect(agent).toBeDefined();
      expect(agent?.getName()).toBe('agent1');
    });

    it('should get agents by capability', () => {
      const agents = orchestrator.getAgentsByCapability(AgentCapability.CODE_GENERATION);
      expect(agents.length).toBe(1);
      expect(agents[0]?.getName()).toBe('agent1');
    });

    it('should return empty array for non-existent capability', () => {
      const agents = orchestrator.getAgentsByCapability(AgentCapability.SECURITY);
      expect(agents.length).toBe(0);
    });
  });

  describe('Task Delegation', () => {
    it('should delegate task to appropriate agent', async () => {
      const task: AgentTask = {
        id: 'task-1',
        type: 'code_generation',
        description: 'Generate code',
        input: {},
      };

      const result = await orchestrator.delegateTask(task, AgentCapability.CODE_GENERATION);

      expect(result.status).toBe('success');
      expect(result.task_id).toBe('task-1');
    });

    it('should throw error when no suitable agent exists', async () => {
      const task: AgentTask = {
        id: 'task-1',
        type: 'security',
        description: 'Security check',
        input: {},
      };

      await expect(orchestrator.delegateTask(task, AgentCapability.SECURITY)).rejects.toThrow(
        'No suitable agents available'
      );
    });
  });

  describe('Workflow Execution', () => {
    it('should execute simple workflow successfully', async () => {
      const workflow: Workflow = {
        id: 'workflow-1',
        name: 'Test Workflow',
        steps: [
          {
            id: 'step-1',
            agent_name: 'agent1',
            task: {
              id: 'task-1',
              type: 'generation',
              description: 'Generate code',
              input: {},
            },
          },
          {
            id: 'step-2',
            agent_name: 'agent2',
            task: {
              id: 'task-2',
              type: 'review',
              description: 'Review code',
              input: {},
            },
            depends_on: ['step-1'],
          },
        ],
      };

      orchestrator.registerWorkflow(workflow);
      const result = await orchestrator.executeWorkflow('workflow-1');

      expect(result.status).toBe('success');
      expect(result.step_results.size).toBe(2);
      expect(result.total_duration_ms).toBeGreaterThan(0);
    });

    it('should execute workflow steps in correct order', async () => {
      const executionOrder: string[] = [];

      class OrderTrackingAgent extends MockAgent {
        protected async processTask(task: AgentTask): Promise<AgentResult> {
          executionOrder.push(this.getName());
          return await super.processTask(task);
        }
      }

      const orderedOrchestrator = new AgentOrchestrator();
      const a1 = new OrderTrackingAgent('a1', [AgentCapability.CODE_GENERATION]);
      const a2 = new OrderTrackingAgent('a2', [AgentCapability.CODE_REVIEW]);
      const a3 = new OrderTrackingAgent('a3', [AgentCapability.TESTING]);

      await Promise.all([a1.initialize(), a2.initialize(), a3.initialize()]);
      await Promise.all([a1.start(), a2.start(), a3.start()]);

      orderedOrchestrator.registerAgent(a1);
      orderedOrchestrator.registerAgent(a2);
      orderedOrchestrator.registerAgent(a3);

      const workflow: Workflow = {
        id: 'ordered-workflow',
        name: 'Ordered Workflow',
        steps: [
          {
            id: 'step-1',
            agent_name: 'a1',
            task: { id: 'task-1', type: 'gen', description: 'Generate', input: {} },
          },
          {
            id: 'step-2',
            agent_name: 'a2',
            task: { id: 'task-2', type: 'review', description: 'Review', input: {} },
            depends_on: ['step-1'],
          },
          {
            id: 'step-3',
            agent_name: 'a3',
            task: { id: 'task-3', type: 'test', description: 'Test', input: {} },
            depends_on: ['step-2'],
          },
        ],
      };

      orderedOrchestrator.registerWorkflow(workflow);
      await orderedOrchestrator.executeWorkflow('ordered-workflow');

      expect(executionOrder).toEqual(['a1', 'a2', 'a3']);
    });

    it('should detect circular dependencies', () => {
      const workflow: Workflow = {
        id: 'circular-workflow',
        name: 'Circular Workflow',
        steps: [
          {
            id: 'step-1',
            agent_name: 'agent1',
            task: { id: 'task-1', type: 'gen', description: 'Generate', input: {} },
            depends_on: ['step-2'],
          },
          {
            id: 'step-2',
            agent_name: 'agent2',
            task: { id: 'task-2', type: 'review', description: 'Review', input: {} },
            depends_on: ['step-1'],
          },
        ],
      };

      expect(() => {
        orchestrator.registerWorkflow(workflow);
      }).toThrow('Circular dependency');
    });

    it('should throw error for workflow with non-existent agent', () => {
      const workflow: Workflow = {
        id: 'invalid-workflow',
        name: 'Invalid Workflow',
        steps: [
          {
            id: 'step-1',
            agent_name: 'non-existent',
            task: { id: 'task-1', type: 'gen', description: 'Generate', input: {} },
          },
        ],
      };

      expect(() => {
        orchestrator.registerWorkflow(workflow);
      }).toThrow('Agent non-existent not found');
    });
  });

  describe('Parallel Execution', () => {
    it('should execute tasks in parallel', async () => {
      const tasks: AgentTask[] = [
        { id: 'task-1', type: 'gen', description: 'Task 1', input: {} },
        { id: 'task-2', type: 'gen', description: 'Task 2', input: {} },
        { id: 'task-3', type: 'gen', description: 'Task 3', input: {} },
      ];

      const results = await orchestrator.parallelExecute(tasks);

      expect(results.length).toBe(3);
      expect(results.every((r) => r.status === 'success')).toBe(true);
    });
  });

  describe('Sequential Execution', () => {
    it('should execute tasks sequentially', async () => {
      const tasks: AgentTask[] = [
        { id: 'task-1', type: 'gen', description: 'Task 1', input: {} },
        { id: 'task-2', type: 'gen', description: 'Task 2', input: {} },
        { id: 'task-3', type: 'gen', description: 'Task 3', input: {} },
      ];

      const results = await orchestrator.sequentialExecute(tasks);

      expect(results.length).toBe(3);
      expect(results.every((r) => r.status === 'success')).toBe(true);
    });

    it('should stop on first failure in sequential execution', async () => {
      class FailingAgent extends MockAgent {
        protected async processTask(task: AgentTask): Promise<AgentResult> {
          if (task.id === 'task-2') {
            throw new Error('Task failed');
          }
          return await super.processTask(task);
        }
      }

      const failingOrchestrator = new AgentOrchestrator();
      const failingAgent = new FailingAgent('failing-agent', [AgentCapability.CODE_GENERATION]);

      await failingAgent.initialize();
      await failingAgent.start();
      failingOrchestrator.registerAgent(failingAgent);

      const tasks: AgentTask[] = [
        { id: 'task-1', type: 'gen', description: 'Task 1', input: {} },
        { id: 'task-2', type: 'gen', description: 'Task 2', input: {} },
        { id: 'task-3', type: 'gen', description: 'Task 3', input: {} },
      ];

      const results = await failingOrchestrator.sequentialExecute(tasks);

      expect(results.length).toBe(2);
      expect(results[1]?.status).toBe('failure');
    });
  });

  describe('Status Monitoring', () => {
    it('should get agent statuses', () => {
      const statuses = orchestrator.getAgentStatus();

      expect(statuses.size).toBe(2);
      expect(statuses.get('agent1')).toBe(AgentStatus.RUNNING);
      expect(statuses.get('agent2')).toBe(AgentStatus.RUNNING);
    });

    it('should check if workflow is running', async () => {
      const workflow: Workflow = {
        id: 'status-workflow',
        name: 'Status Workflow',
        steps: [
          {
            id: 'step-1',
            agent_name: 'agent1',
            task: { id: 'task-1', type: 'gen', description: 'Generate', input: {} },
          },
        ],
      };

      orchestrator.registerWorkflow(workflow);

      expect(orchestrator.isWorkflowRunning('status-workflow')).toBe(false);

      const executionPromise = orchestrator.executeWorkflow('status-workflow');

      expect(orchestrator.isWorkflowRunning('status-workflow')).toBe(true);

      await executionPromise;

      expect(orchestrator.isWorkflowRunning('status-workflow')).toBe(false);
    });
  });
});
