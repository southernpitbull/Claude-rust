/**
 * Base Agent Implementation
 *
 * Abstract base class for all agents with:
 * - Lifecycle management
 * - Task execution
 * - Metrics tracking
 * - Error handling
 *
 * @module agents/agent-base
 */

import { EventEmitter } from 'events';
import {
  AgentConfig,
  AgentStatus,
  AgentCapability,
  AgentTask,
  AgentResult,
  AgentContext,
  AgentLifecycleHooks,
  AgentMetrics,
} from './types';
import { BaseProvider } from '../providers/provider-base';
import { Message, MessageRole, CompletionOptions } from '../providers/types';

export abstract class BaseAgent extends EventEmitter {
  protected config: AgentConfig;
  protected provider: BaseProvider;
  protected status: AgentStatus = AgentStatus.IDLE;
  protected context: AgentContext = { conversation_history: [] };
  protected hooks: AgentLifecycleHooks = {};
  protected metrics: AgentMetrics = {
    tasks_completed: 0,
    tasks_failed: 0,
    total_tokens_used: 0,
    total_cost: 0,
    average_task_duration_ms: 0,
    success_rate: 0,
    uptime_ms: 0,
  };
  protected startTime: number | null = null;
  protected taskDurations: number[] = [];

  constructor(config: AgentConfig, provider: BaseProvider, hooks?: AgentLifecycleHooks) {
    super();
    this.config = config;
    this.provider = provider;
    if (hooks) {
      this.hooks = hooks;
    }
  }

  public async initialize(): Promise<void> {
    this.status = AgentStatus.INITIALIZING;
    this.emit('status_changed', { status: this.status });

    try {
      if (this.hooks.onInitialize) {
        await this.hooks.onInitialize();
      }

      await this.onInitialize();

      this.status = AgentStatus.READY;
      this.emit('status_changed', { status: this.status });
      this.emit('initialized');
    } catch (error) {
      this.status = AgentStatus.FAILED;
      this.emit('status_changed', { status: this.status });
      throw error;
    }
  }

  public async start(): Promise<void> {
    if (this.status !== AgentStatus.READY && this.status !== AgentStatus.PAUSED) {
      throw new Error(`Cannot start agent from status: ${this.status}`);
    }

    this.status = AgentStatus.RUNNING;
    this.startTime = Date.now();
    this.emit('status_changed', { status: this.status });

    try {
      if (this.hooks.onStart) {
        await this.hooks.onStart();
      }

      this.emit('started');
    } catch (error) {
      this.status = AgentStatus.FAILED;
      this.emit('status_changed', { status: this.status });
      throw error;
    }
  }

  public async pause(): Promise<void> {
    if (this.status !== AgentStatus.RUNNING) {
      throw new Error(`Cannot pause agent from status: ${this.status}`);
    }

    this.status = AgentStatus.PAUSED;
    this.emit('status_changed', { status: this.status });

    if (this.hooks.onPause) {
      await this.hooks.onPause();
    }

    this.emit('paused');
  }

  public async resume(): Promise<void> {
    if (this.status !== AgentStatus.PAUSED) {
      throw new Error(`Cannot resume agent from status: ${this.status}`);
    }

    this.status = AgentStatus.RUNNING;
    this.emit('status_changed', { status: this.status });

    if (this.hooks.onResume) {
      await this.hooks.onResume();
    }

    this.emit('resumed');
  }

  public async terminate(): Promise<void> {
    const previousStatus = this.status;
    this.status = AgentStatus.TERMINATED;
    this.emit('status_changed', { status: this.status, previous: previousStatus });

    if (this.hooks.onTerminate) {
      await this.hooks.onTerminate();
    }

    this.emit('terminated');
  }

  public async executeTask(task: AgentTask): Promise<AgentResult> {
    if (this.status !== AgentStatus.RUNNING) {
      throw new Error(`Cannot execute task when agent is ${this.status}`);
    }

    const startTime = Date.now();
    this.emit('task_started', { task });

    try {
      const result = await this.processTask(task);

      const duration = Date.now() - startTime;
      this.taskDurations.push(duration);

      result.metrics = {
        ...result.metrics,
        duration_ms: duration,
      };

      this.metrics.tasks_completed += 1;
      if (result.metrics?.tokens_used) {
        this.metrics.total_tokens_used += result.metrics.tokens_used;
      }
      if (result.metrics?.cost) {
        this.metrics.total_cost += result.metrics.cost;
      }

      this.updateMetrics();

      this.emit('task_completed', { task, result });

      return result;
    } catch (error) {
      this.metrics.tasks_failed += 1;
      this.updateMetrics();

      const result: AgentResult = {
        task_id: task.id,
        status: 'failure',
        output: null,
        error: error instanceof Error ? error.message : String(error),
        metrics: {
          duration_ms: Date.now() - startTime,
        },
      };

      this.emit('task_failed', { task, error });

      if (this.hooks.onError) {
        await this.hooks.onError(error instanceof Error ? error : new Error(String(error)));
      }

      return result;
    }
  }

  protected abstract processTask(task: AgentTask): Promise<AgentResult>;

  protected abstract onInitialize(): Promise<void>;

  protected async generateResponse(
    messages: Message[],
    options?: Partial<CompletionOptions>
  ): Promise<string> {
    const completionOptions: CompletionOptions = {
      model: this.config.model,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.max_tokens ?? 2000,
      ...options,
    };

    const response = await this.provider.complete(messages, completionOptions);

    this.context.conversation_history.push(
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'assistant', content: response.content }
    );

    return response.content;
  }

  protected createMessage(role: MessageRole, content: string): Message {
    return { role, content };
  }

  protected createSystemMessage(content: string): Message {
    return this.createMessage(MessageRole.SYSTEM, content);
  }

  protected createUserMessage(content: string): Message {
    return this.createMessage(MessageRole.USER, content);
  }

  private updateMetrics(): void {
    const totalTasks = this.metrics.tasks_completed + this.metrics.tasks_failed;
    this.metrics.success_rate = totalTasks > 0 ? this.metrics.tasks_completed / totalTasks : 0;

    if (this.taskDurations.length > 0) {
      this.metrics.average_task_duration_ms =
        this.taskDurations.reduce((sum, d) => sum + d, 0) / this.taskDurations.length;
    }

    if (this.startTime) {
      this.metrics.uptime_ms = Date.now() - this.startTime;
    }
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public getCapabilities(): AgentCapability[] {
    return [...this.config.capabilities];
  }

  public hasCapability(capability: AgentCapability): boolean {
    return this.config.capabilities.includes(capability);
  }

  public getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  public getContext(): AgentContext {
    return { ...this.context };
  }

  public updateContext(updates: Partial<AgentContext>): void {
    this.context = { ...this.context, ...updates };
    this.emit('context_updated', { context: this.context });
  }

  public clearConversationHistory(): void {
    this.context.conversation_history = [];
    this.emit('history_cleared');
  }

  public getName(): string {
    return this.config.name;
  }

  public getDescription(): string {
    return this.config.description;
  }
}
