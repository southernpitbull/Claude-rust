/**
 * Agent Orchestrator
 *
 * Multi-agent coordination with:
 * - Task delegation
 * - Workflow execution
 * - Agent collaboration
 * - Result aggregation
 *
 * @module agents/agent-orchestrator
 */

import { EventEmitter } from 'events';
import { BaseAgent } from './agent-base';
import { AgentTask, AgentResult, AgentCapability, AgentStatus } from './types';

export interface WorkflowStep {
  id: string;
  agent_name: string;
  task: AgentTask;
  depends_on?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowResult {
  workflow_id: string;
  status: 'success' | 'failure' | 'partial';
  step_results: Map<string, AgentResult>;
  total_duration_ms: number;
  metadata?: Record<string, unknown>;
}

export class AgentOrchestrator extends EventEmitter {
  private agents = new Map<string, BaseAgent>();
  private workflows = new Map<string, Workflow>();
  private activeWorkflows = new Map<string, Promise<WorkflowResult>>();

  constructor() {
    super();
  }

  public registerAgent(agent: BaseAgent): void {
    const name = agent.getName();
    if (this.agents.has(name)) {
      throw new Error(`Agent ${name} is already registered`);
    }

    this.agents.set(name, agent);
    this.emit('agent_registered', { agent: name });
  }

  public unregisterAgent(agentName: string): boolean {
    const removed = this.agents.delete(agentName);
    if (removed) {
      this.emit('agent_unregistered', { agent: agentName });
    }
    return removed;
  }

  public getAgent(agentName: string): BaseAgent | undefined {
    return this.agents.get(agentName);
  }

  public getAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  public getAgentsByCapability(capability: AgentCapability): BaseAgent[] {
    return this.getAgents().filter((agent) => agent.hasCapability(capability));
  }

  public async delegateTask(task: AgentTask, capability?: AgentCapability): Promise<AgentResult> {
    const suitableAgents =
      capability != null
        ? this.getAgentsByCapability(capability)
        : this.getAgents().filter((agent) => agent.getStatus() === AgentStatus.RUNNING);

    if (suitableAgents.length === 0) {
      throw new Error(`No suitable agents available for task: ${task.id}`);
    }

    const agent = this.selectBestAgent(suitableAgents, task);

    this.emit('task_delegated', { task: task.id, agent: agent.getName() });

    return await agent.executeTask(task);
  }

  public registerWorkflow(workflow: Workflow): void {
    if (this.workflows.has(workflow.id)) {
      throw new Error(`Workflow ${workflow.id} is already registered`);
    }

    this.validateWorkflow(workflow);
    this.workflows.set(workflow.id, workflow);
    this.emit('workflow_registered', { workflow: workflow.id });
  }

  public async executeWorkflow(workflowId: string): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    if (this.activeWorkflows.has(workflowId)) {
      throw new Error(`Workflow ${workflowId} is already running`);
    }

    const execution = this.runWorkflow(workflow);
    this.activeWorkflows.set(workflowId, execution);

    try {
      const result = await execution;
      return result;
    } finally {
      this.activeWorkflows.delete(workflowId);
    }
  }

  private async runWorkflow(workflow: Workflow): Promise<WorkflowResult> {
    const startTime = Date.now();
    const stepResults = new Map<string, AgentResult>();
    const completed = new Set<string>();

    this.emit('workflow_started', { workflow: workflow.id });

    try {
      const sortedSteps = this.topologicalSort(workflow.steps);

      for (const step of sortedSteps) {
        if (step.depends_on && step.depends_on.length > 0) {
          for (const depId of step.depends_on) {
            if (!completed.has(depId)) {
              throw new Error(`Dependency ${depId} not completed for step ${step.id}`);
            }

            const depResult = stepResults.get(depId);
            if (depResult?.status === 'failure') {
              throw new Error(`Dependency ${depId} failed, cannot execute step ${step.id}`);
            }
          }
        }

        const agent = this.agents.get(step.agent_name);
        if (!agent) {
          throw new Error(`Agent ${step.agent_name} not found for step ${step.id}`);
        }

        this.emit('workflow_step_started', { workflow: workflow.id, step: step.id });

        const result = await agent.executeTask(step.task);
        stepResults.set(step.id, result);
        completed.add(step.id);

        this.emit('workflow_step_completed', { workflow: workflow.id, step: step.id, result });

        if (result.status === 'failure') {
          throw new Error(`Step ${step.id} failed: ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      const workflowResult: WorkflowResult = {
        workflow_id: workflow.id,
        status: 'success',
        step_results: stepResults,
        total_duration_ms: duration,
        metadata: workflow.metadata,
      };

      this.emit('workflow_completed', { workflow: workflow.id, result: workflowResult });

      return workflowResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const workflowResult: WorkflowResult = {
        workflow_id: workflow.id,
        status: 'failure',
        step_results: stepResults,
        total_duration_ms: duration,
        metadata: {
          ...workflow.metadata,
          error: error instanceof Error ? error.message : String(error),
        },
      };

      this.emit('workflow_failed', { workflow: workflow.id, error });

      return workflowResult;
    }
  }

  private validateWorkflow(workflow: Workflow): void {
    const stepIds = new Set(workflow.steps.map((s) => s.id));

    for (const step of workflow.steps) {
      if (!this.agents.has(step.agent_name)) {
        throw new Error(`Agent ${step.agent_name} not found for step ${step.id}`);
      }

      if (step.depends_on) {
        for (const depId of step.depends_on) {
          if (!stepIds.has(depId)) {
            throw new Error(`Dependency ${depId} not found for step ${step.id}`);
          }
        }
      }
    }

    this.detectCycles(workflow.steps);
  }

  private topologicalSort(steps: WorkflowStep[]): WorkflowStep[] {
    const sorted: WorkflowStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: WorkflowStep): void => {
      if (visited.has(step.id)) {
        return;
      }

      if (visiting.has(step.id)) {
        throw new Error('Circular dependency detected in workflow');
      }

      visiting.add(step.id);

      if (step.depends_on) {
        for (const depId of step.depends_on) {
          const depStep = steps.find((s) => s.id === depId);
          if (depStep) {
            visit(depStep);
          }
        }
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  private detectCycles(steps: WorkflowStep[]): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      if (!visited.has(stepId)) {
        visited.add(stepId);
        recursionStack.add(stepId);

        const step = steps.find((s) => s.id === stepId);
        if (step?.depends_on) {
          for (const depId of step.depends_on) {
            if (!visited.has(depId) && hasCycle(depId)) {
              return true;
            } else if (recursionStack.has(depId)) {
              return true;
            }
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (hasCycle(step.id)) {
        throw new Error('Circular dependency detected in workflow');
      }
    }
  }

  private selectBestAgent(agents: BaseAgent[], task: AgentTask): BaseAgent {
    let bestAgent = agents[0];
    if (!bestAgent) {
      throw new Error('No agents available');
    }

    let bestScore = -1;

    for (const agent of agents) {
      let score = 0;

      if (agent.getStatus() === AgentStatus.RUNNING) {
        score += 100;
      }

      const metrics = agent.getMetrics();
      score += metrics.success_rate * 50;
      score -= metrics.tasks_failed * 10;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  public async parallelExecute(tasks: AgentTask[]): Promise<AgentResult[]> {
    const taskPromises = tasks.map((task) => this.delegateTask(task));
    return await Promise.all(taskPromises);
  }

  public async sequentialExecute(tasks: AgentTask[]): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const task of tasks) {
      const result = await this.delegateTask(task);
      results.push(result);

      if (result.status === 'failure') {
        break;
      }
    }

    return results;
  }

  public getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  public getWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  public isWorkflowRunning(workflowId: string): boolean {
    return this.activeWorkflows.has(workflowId);
  }

  public getAgentStatus(): Map<string, AgentStatus> {
    const statuses = new Map<string, AgentStatus>();
    for (const [name, agent] of this.agents) {
      statuses.set(name, agent.getStatus());
    }
    return statuses;
  }
}
