/**
 * Log Context
 * Contextual logging with nested contexts and correlation IDs
 */

import { v4 as uuidv4 } from 'uuid';
import type { ILogContext, ILogMetadata, LogCategory } from './types.js';
import { LogMetadata } from './LogMetadata.js';

/**
 * Log context for scoped logging
 */
export class LogContext implements ILogContext {
  public readonly name: string;
  public readonly correlationId: string;
  public readonly parent?: ILogContext;
  public readonly data: Record<string, unknown>;
  public readonly children: ILogContext[];
  private readonly startTime: number;

  constructor(
    name: string,
    data: Record<string, unknown> = {},
    parent?: ILogContext,
    correlationId?: string
  ) {
    this.name = name;
    this.correlationId = correlationId ?? parent?.correlationId ?? uuidv4();
    this.parent = parent;
    this.data = { ...data };
    this.children = [];
    this.startTime = Date.now();

    // Add to parent's children if parent exists
    if (parent && 'children' in parent) {
      (parent as LogContext).children.push(this);
    }
  }

  /**
   * Create a child context
   */
  public createChild(name: string, data: Record<string, unknown> = {}): LogContext {
    return new LogContext(name, data, this);
  }

  /**
   * Add data to context
   */
  public addData(key: string, value: unknown): void {
    this.data[key] = value;
  }

  /**
   * Get data from context
   */
  public getData(key: string): unknown {
    return this.data[key];
  }

  /**
   * Get all data including parent data
   */
  public getAllData(): Record<string, unknown> {
    const allData: Record<string, unknown> = {};

    // Collect parent data first (so child data can override)
    if (this.parent) {
      const parentContext = this.parent as LogContext;
      Object.assign(allData, parentContext.getAllData());
    }

    // Add this context's data
    Object.assign(allData, this.data);

    return allData;
  }

  /**
   * Get elapsed time since context creation
   */
  public getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Convert context to metadata
   */
  public toMetadata(category: LogCategory): ILogMetadata {
    return LogMetadata.builder(category)
      .withCorrelationId(this.correlationId)
      .withContext({
        contextName: this.name,
        contextData: this.getAllData(),
        elapsedTime: this.getElapsedTime(),
      })
      .withTags('context', this.name)
      .build();
  }

  /**
   * Get context path (parent chain)
   */
  public getPath(): string {
    const parts: string[] = [];
    let current: ILogContext | undefined = this;

    while (current) {
      parts.unshift(current.name);
      current = current.parent;
    }

    return parts.join(' > ');
  }

  /**
   * Find child context by name
   */
  public findChild(name: string): LogContext | undefined {
    return this.children.find((child) => child.name === name) as LogContext | undefined;
  }

  /**
   * Remove child context
   */
  public removeChild(name: string): void {
    const index = this.children.findIndex((child) => child.name === name);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
  }

  /**
   * Clear all children
   */
  public clearChildren(): void {
    this.children.length = 0;
  }

  /**
   * Convert to string representation
   */
  public toString(): string {
    return `LogContext(${this.getPath()}, corr=${this.correlationId})`;
  }
}

/**
 * Global context manager
 */
export class ContextManager {
  private static stack: LogContext[] = [];
  private static contexts: Map<string, LogContext> = new Map();

  /**
   * Create a new context
   */
  public static create(name: string, data: Record<string, unknown> = {}): LogContext {
    const parent = this.current();
    const context = new LogContext(name, data, parent);
    this.contexts.set(context.correlationId, context);
    return context;
  }

  /**
   * Push context onto stack
   */
  public static push(context: LogContext): void {
    this.stack.push(context);
  }

  /**
   * Pop context from stack
   */
  public static pop(): LogContext | undefined {
    return this.stack.pop();
  }

  /**
   * Get current context
   */
  public static current(): LogContext | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Get context by correlation ID
   */
  public static get(correlationId: string): LogContext | undefined {
    return this.contexts.get(correlationId);
  }

  /**
   * Clear context stack
   */
  public static clear(): void {
    this.stack = [];
  }

  /**
   * Clear all contexts
   */
  public static clearAll(): void {
    this.stack = [];
    this.contexts.clear();
  }

  /**
   * Execute function with context
   */
  public static async withContext<T>(
    name: string,
    data: Record<string, unknown>,
    fn: (context: LogContext) => Promise<T>
  ): Promise<T> {
    const context = this.create(name, data);
    this.push(context);

    try {
      return await fn(context);
    } finally {
      this.pop();
    }
  }

  /**
   * Execute synchronous function with context
   */
  public static withContextSync<T>(
    name: string,
    data: Record<string, unknown>,
    fn: (context: LogContext) => T
  ): T {
    const context = this.create(name, data);
    this.push(context);

    try {
      return fn(context);
    } finally {
      this.pop();
    }
  }

  /**
   * Get all active contexts
   */
  public static getAll(): LogContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Get context stack depth
   */
  public static getDepth(): number {
    return this.stack.length;
  }

  /**
   * Get root contexts (contexts without parents)
   */
  public static getRootContexts(): LogContext[] {
    return Array.from(this.contexts.values()).filter((context) => !context.parent);
  }
}

/**
 * Context decorator for methods
 */
export function WithContext(name?: string) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const contextName = name ?? propertyKey;
      return ContextManager.withContext(contextName, { method: propertyKey, args }, async () =>
        originalMethod.apply(this, args)
      );
    };

    return descriptor;
  };
}

/**
 * Correlation ID generator
 */
export class CorrelationIdGenerator {
  private static prefix = 'corr';
  private static counter = 0;

  /**
   * Generate a new correlation ID
   */
  public static generate(): string {
    return `${this.prefix}-${uuidv4()}-${this.counter++}`;
  }

  /**
   * Set prefix for correlation IDs
   */
  public static setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  /**
   * Reset counter
   */
  public static resetCounter(): void {
    this.counter = 0;
  }

  /**
   * Parse correlation ID
   */
  public static parse(
    correlationId: string
  ): { prefix: string; uuid: string; sequence: number } | null {
    const match = correlationId.match(/^(.+)-([a-f0-9-]+)-(\d+)$/);
    if (!match) {
      return null;
    }

    return {
      prefix: match[1] ?? '',
      uuid: match[2] ?? '',
      sequence: parseInt(match[3] ?? '0', 10),
    };
  }
}

/**
 * Request context for HTTP/API requests
 */
export class RequestContext extends LogContext {
  public readonly requestId: string;
  public readonly method?: string;
  public readonly path?: string;
  public readonly userId?: string;
  public readonly ipAddress?: string;
  public readonly userAgent?: string;

  constructor(
    requestId: string,
    options: {
      method?: string;
      path?: string;
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      correlationId?: string;
    } = {}
  ) {
    super(
      `request-${requestId}`,
      {
        requestId,
        method: options.method,
        path: options.path,
        userId: options.userId,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
      },
      undefined,
      options.correlationId
    );

    this.requestId = requestId;
    this.method = options.method;
    this.path = options.path;
    this.userId = options.userId;
    this.ipAddress = options.ipAddress;
    this.userAgent = options.userAgent;
  }

  /**
   * Create from HTTP request-like object
   */
  public static fromRequest(request: {
    id?: string;
    method?: string;
    url?: string;
    path?: string;
    headers?: Record<string, string | string[] | undefined>;
  }): RequestContext {
    const requestId = request.id ?? uuidv4();
    const correlationId =
      (typeof request.headers?.['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : undefined) ?? uuidv4();

    return new RequestContext(requestId, {
      method: request.method,
      path: request.path ?? request.url,
      correlationId,
      ipAddress:
        typeof request.headers?.['x-forwarded-for'] === 'string'
          ? request.headers['x-forwarded-for'].split(',')[0]?.trim()
          : undefined,
      userAgent:
        typeof request.headers?.['user-agent'] === 'string'
          ? request.headers['user-agent']
          : undefined,
    });
  }
}

/**
 * Transaction context for database operations
 */
export class TransactionContext extends LogContext {
  public readonly transactionId: string;
  public readonly operation?: string;

  constructor(transactionId: string, operation?: string, parent?: ILogContext) {
    super(`transaction-${transactionId}`, { transactionId, operation }, parent);

    this.transactionId = transactionId;
    this.operation = operation;
  }
}

/**
 * Agent context for AI agent operations
 */
export class AgentContext extends LogContext {
  public readonly agentId: string;
  public readonly agentType: string;

  constructor(
    agentId: string,
    agentType: string,
    data: Record<string, unknown> = {},
    parent?: ILogContext
  ) {
    super(`agent-${agentId}`, { agentId, agentType, ...data }, parent);

    this.agentId = agentId;
    this.agentType = agentType;
  }
}
