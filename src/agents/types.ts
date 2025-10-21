/**
 * Agent Type Definitions
 *
 * Comprehensive type system for agent framework.
 *
 * @module agents/types
 */

export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TERMINATED = 'terminated',
}

export enum AgentCapability {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  TESTING = 'testing',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  DOCUMENTATION = 'documentation',
  INFRASTRUCTURE = 'infrastructure',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY = 'security',
  PLANNING = 'planning',
  ANALYSIS = 'analysis',
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: AgentCapability[];
  provider: string;
  model: string;
  temperature?: number;
  max_tokens?: number;
  max_retries?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentTask {
  id: string;
  type: string;
  description: string;
  input: unknown;
  priority?: number;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  task_id: string;
  status: 'success' | 'failure' | 'partial';
  output: unknown;
  error?: string;
  metrics?: {
    duration_ms: number;
    tokens_used?: number;
    cost?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  conversation_history: Array<{ role: string; content: string }>;
  workspace_path?: string;
  project_context?: Record<string, unknown>;
  user_preferences?: Record<string, unknown>;
  environment_vars?: Record<string, string>;
}

export interface AgentLifecycleHooks {
  onInitialize?: () => Promise<void>;
  onStart?: () => Promise<void>;
  onPause?: () => Promise<void>;
  onResume?: () => Promise<void>;
  onComplete?: () => Promise<void>;
  onError?: (error: Error) => Promise<void>;
  onTerminate?: () => Promise<void>;
}

export interface AgentMetrics {
  tasks_completed: number;
  tasks_failed: number;
  total_tokens_used: number;
  total_cost: number;
  average_task_duration_ms: number;
  success_rate: number;
  uptime_ms: number;
}
