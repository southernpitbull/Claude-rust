/**
 * Agent Error Classes
 *
 * Handles errors related to AI agent operations, execution, and coordination
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * Agent error codes
 */
export enum AgentErrorCode {
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_INITIALIZATION_FAILED = 'AGENT_INITIALIZATION_FAILED',
  AGENT_EXECUTION_FAILED = 'AGENT_EXECUTION_FAILED',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_COMMUNICATION_FAILED = 'AGENT_COMMUNICATION_FAILED',
  AGENT_STATE_INVALID = 'AGENT_STATE_INVALID',
  AGENT_RESOURCE_EXHAUSTED = 'AGENT_RESOURCE_EXHAUSTED',
  AGENT_WORKFLOW_FAILED = 'AGENT_WORKFLOW_FAILED',
  AGENT_TOOL_FAILED = 'AGENT_TOOL_FAILED',
  AGENT_MEMORY_FAILED = 'AGENT_MEMORY_FAILED',
  AGENT_COORDINATION_FAILED = 'AGENT_COORDINATION_FAILED',
}

/**
 * Base Agent Error
 */
export class AgentError extends BaseError {
  public readonly agentId?: string;
  public readonly agentType?: string;

  constructor(
    message: string,
    options: BaseErrorOptions & { agentId?: string; agentType?: string } = {}
  ) {
    super(message, {
      ...options,
      category: ErrorCategory.AGENT,
      code: options.code ?? AgentErrorCode.AGENT_EXECUTION_FAILED,
      context: {
        ...options.context,
        agentId: options.agentId,
        agentType: options.agentType,
      },
    });

    this.agentId = options.agentId;
    this.agentType = options.agentType;
  }

  protected generateUserMessage(): string {
    const agentInfo = this.agentId ? ` (${this.agentId})` : '';
    return `Agent error${agentInfo}: ${this.message}`;
  }
}

/**
 * Agent Not Found Error
 */
export class AgentNotFoundError extends AgentError {
  constructor(agentId: string, options: BaseErrorOptions = {}) {
    super(`Agent not found: ${agentId}`, {
      ...options,
      code: AgentErrorCode.AGENT_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      agentId,
    });
  }

  protected generateUserMessage(): string {
    return `Agent '${this.agentId}' not found. Check your agent configuration.`;
  }
}

/**
 * Agent Initialization Failed Error
 */
export class AgentInitializationError extends AgentError {
  constructor(agentId: string, agentType: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Failed to initialize agent '${agentId}' (${agentType}): ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_INITIALIZATION_FAILED,
      severity: ErrorSeverity.HIGH,
      agentId,
      agentType,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to initialize agent '${this.agentId}': ${this.context.reason}`;
  }
}

/**
 * Agent Execution Failed Error
 */
export class AgentExecutionError extends AgentError {
  constructor(agentId: string, task: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Agent '${agentId}' failed to execute task: ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_EXECUTION_FAILED,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      agentId,
      context: {
        ...options.context,
        task,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Agent '${this.agentId}' failed to execute task '${this.context.task}': ${this.context.reason}`;
  }
}

/**
 * Agent Timeout Error
 */
export class AgentTimeoutError extends AgentError {
  constructor(agentId: string, timeoutMs: number, options: BaseErrorOptions = {}) {
    super(`Agent '${agentId}' timed out after ${timeoutMs}ms`, {
      ...options,
      code: AgentErrorCode.AGENT_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      agentId,
      context: {
        ...options.context,
        timeoutMs,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Agent '${this.agentId}' timed out. The operation took too long to complete.`;
  }
}

/**
 * Agent Communication Failed Error
 */
export class AgentCommunicationError extends AgentError {
  constructor(
    fromAgentId: string,
    toAgentId: string,
    reason: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Communication failed from agent '${fromAgentId}' to '${toAgentId}': ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_COMMUNICATION_FAILED,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      agentId: fromAgentId,
      context: {
        ...options.context,
        fromAgentId,
        toAgentId,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Communication failed between agents: ${this.context.reason}`;
  }
}

/**
 * Agent State Invalid Error
 */
export class AgentStateError extends AgentError {
  constructor(
    agentId: string,
    currentState: string,
    expectedState: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Agent '${agentId}' in invalid state: expected ${expectedState}, got ${currentState}`, {
      ...options,
      code: AgentErrorCode.AGENT_STATE_INVALID,
      severity: ErrorSeverity.MEDIUM,
      agentId,
      context: {
        ...options.context,
        currentState,
        expectedState,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Agent '${this.agentId}' is in an invalid state. Please reset or restart the agent.`;
  }
}

/**
 * Agent Resource Exhausted Error
 */
export class AgentResourceExhaustedError extends AgentError {
  constructor(agentId: string, resourceType: string, options: BaseErrorOptions = {}) {
    super(`Agent '${agentId}' exhausted resource: ${resourceType}`, {
      ...options,
      code: AgentErrorCode.AGENT_RESOURCE_EXHAUSTED,
      severity: ErrorSeverity.HIGH,
      agentId,
      context: {
        ...options.context,
        resourceType,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Agent '${this.agentId}' ran out of ${this.context.resourceType}. Please try a smaller task or increase resource limits.`;
  }
}

/**
 * Agent Workflow Failed Error
 */
export class AgentWorkflowError extends AgentError {
  constructor(workflowId: string, step: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Workflow '${workflowId}' failed at step '${step}': ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_WORKFLOW_FAILED,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      context: {
        ...options.context,
        workflowId,
        step,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Workflow '${this.context.workflowId}' failed at step '${this.context.step}': ${this.context.reason}`;
  }
}

/**
 * Agent Tool Failed Error
 */
export class AgentToolError extends AgentError {
  constructor(agentId: string, toolName: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Agent '${agentId}' tool '${toolName}' failed: ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_TOOL_FAILED,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      agentId,
      context: {
        ...options.context,
        toolName,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Tool '${this.context.toolName}' failed: ${this.context.reason}`;
  }
}

/**
 * Agent Memory Failed Error
 */
export class AgentMemoryError extends AgentError {
  constructor(agentId: string, operation: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Agent '${agentId}' memory operation '${operation}' failed: ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_MEMORY_FAILED,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      agentId,
      context: {
        ...options.context,
        operation,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Agent memory operation failed: ${this.context.reason}`;
  }
}

/**
 * Agent Coordination Failed Error
 */
export class AgentCoordinationError extends AgentError {
  constructor(
    coordinatorId: string,
    agentIds: string[],
    reason: string,
    options: BaseErrorOptions = {}
  ) {
    super(`Agent coordination failed: ${reason}`, {
      ...options,
      code: AgentErrorCode.AGENT_COORDINATION_FAILED,
      severity: ErrorSeverity.HIGH,
      isRetryable: true,
      agentId: coordinatorId,
      context: {
        ...options.context,
        coordinatorId,
        agentIds,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to coordinate agents: ${this.context.reason}`;
  }
}
