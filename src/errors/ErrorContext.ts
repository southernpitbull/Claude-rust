/**
 * ErrorContext.ts
 *
 * Error context management for the AIrchitect CLI.
 * Captures and manages execution context, user context, system context, and request context.
 */

import { v4 as uuidv4 } from 'uuid';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Error context interface
 */
export interface IErrorContext {
  /** Unique identifier for this context */
  id: string;

  /** Correlation ID for request tracing */
  correlationId?: string;

  /** Request ID */
  requestId?: string;

  /** User ID */
  userId?: string;

  /** Session ID */
  sessionId?: string;

  /** Timestamp when context was created */
  timestamp: Date;

  /** Additional context fields */
  fields: Record<string, unknown>;

  /** Execution context (e.g., function, module, component) */
  executionContext?: string;

  /** Action that triggered the error */
  action?: string;

  /** Request information */
  request?: RequestInfo;

  /** User information */
  user?: UserInfo;

  /** System information */
  system?: SystemInfo;

  /** Async context */
  asyncContext?: AsyncContextInfo;

  /** Privacy settings for this context */
  privacy?: PrivacySettings;
}

/**
 * Request information interface
 */
export interface RequestInfo {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  body?: unknown;
  ip?: string;
  userAgent?: string;
}

/**
 * User information interface
 */
export interface UserInfo {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
  permissions?: string[];
}

/**
 * System information interface
 */
export interface SystemInfo {
  platform?: string;
  version?: string;
  os?: string;
  nodeVersion?: string;
  memory?: number;
  uptime?: number;
  cpu?: string;
}

/**
 * Async context information interface
 */
export interface AsyncContextInfo {
  executionId?: string;
  parentContextId?: string;
  depth?: number;
  stack?: string[];
}

/**
 * Privacy settings interface
 */
export interface PrivacySettings {
  /** Whether to include user information */
  includeUser?: boolean;

  /** Whether to include system information */
  includeSystem?: boolean;

  /** Whether to include request information */
  includeRequest?: boolean;

  /** Whether to include sensitive fields */
  includeSensitive?: boolean;

  /** Fields to exclude from context */
  excludeFields?: string[];
}

/**
 * ErrorContext class for managing error context
 */
export class ErrorContext implements IErrorContext {
  public id: string;
  public correlationId?: string;
  public requestId?: string;
  public userId?: string;
  public sessionId?: string;
  public timestamp: Date;
  public fields: Record<string, unknown>;
  public executionContext?: string;
  public action?: string;
  public request?: RequestInfo;
  public user?: UserInfo;
  public system?: SystemInfo;
  public asyncContext?: AsyncContextInfo;
  public privacy?: PrivacySettings;

  constructor(options?: Partial<IErrorContext>) {
    this.id = options?.id || uuidv4();
    this.correlationId = options?.correlationId || uuidv4();
    this.requestId = options?.requestId;
    this.userId = options?.userId;
    this.sessionId = options?.sessionId;
    this.timestamp = options?.timestamp || new Date();
    this.fields = options?.fields || {};
    this.executionContext = options?.executionContext;
    this.action = options?.action;
    this.request = options?.request;
    this.user = options?.user;
    this.system = options?.system;
    this.asyncContext = options?.asyncContext;
    this.privacy = options?.privacy || {
      includeUser: true,
      includeSystem: true,
      includeRequest: true,
      includeSensitive: false,
      excludeFields: [],
    };
  }

  /**
   * Add a field to the context
   */
  public addField(key: string, value: unknown): void {
    this.fields[key] = value;
  }

  /**
   * Get a field from the context
   */
  public getField(key: string): unknown {
    return this.fields[key];
  }

  /**
   * Remove a field from the context
   */
  public removeField(key: string): void {
    delete this.fields[key];
  }

  /**
   * Set request information
   */
  public setRequest(request: RequestInfo): void {
    this.request = request;
  }

  /**
   * Set user information
   */
  public setUser(user: UserInfo): void {
    this.user = user;
  }

  /**
   * Set system information
   */
  public setSystem(system: SystemInfo): void {
    this.system = system;
  }

  /**
   * Set privacy settings
   */
  public setPrivacy(privacy: PrivacySettings): void {
    this.privacy = { ...this.privacy, ...privacy };
  }

  /**
   * Get sanitized context for error reporting
   */
  public getSanitized(): IErrorContext {
    const sanitized: IErrorContext = {
      id: this.id,
      correlationId: this.correlationId,
      requestId: this.requestId,
      userId: this.privacy?.includeUser ? this.userId : undefined,
      sessionId: this.privacy?.includeUser ? this.sessionId : undefined,
      timestamp: this.timestamp,
      fields: this.getSanitizedFields(),
      executionContext: this.executionContext,
      action: this.action,
      request: this.privacy?.includeRequest ? this.getSanitizedRequest() : undefined,
      user: this.privacy?.includeUser ? this.getSanitizedUser() : undefined,
      system: this.privacy?.includeSystem ? this.getSanitizedSystem() : undefined,
      asyncContext: this.asyncContext,
      privacy: this.privacy,
    };

    return sanitized;
  }

  /**
   * Get sanitized fields
   */
  private getSanitizedFields(): Record<string, unknown> {
    if (!this.privacy?.includeSensitive) {
      const sanitized: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(this.fields)) {
        // Skip sensitive fields
        if (this.privacy?.excludeFields?.includes(key) || this.isSensitiveField(key)) {
          continue;
        }

        sanitized[key] = value;
      }

      return sanitized;
    }

    return this.fields;
  }

  /**
   * Get sanitized request info
   */
  private getSanitizedRequest(): RequestInfo | undefined {
    if (!this.request || !this.privacy?.includeRequest) {
      return undefined;
    }

    const sanitized: RequestInfo = { ...this.request };

    // Remove sensitive headers
    if (sanitized.headers) {
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
      const sanitizedHeaders: Record<string, string> = {};

      for (const [key, value] of Object.entries(sanitized.headers)) {
        if (!sensitiveHeaders.includes(key.toLowerCase()) || this.privacy?.includeSensitive) {
          sanitizedHeaders[key] = value;
        }
      }

      sanitized.headers = sanitizedHeaders;
    }

    // Remove sensitive body content
    if (sanitized.body && typeof sanitized.body === 'object' && !this.privacy?.includeSensitive) {
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
      const bodyObj = { ...sanitized.body } as Record<string, unknown>;

      for (const field of sensitiveFields) {
        if (field in bodyObj) {
          delete bodyObj[field];
        }
      }

      sanitized.body = bodyObj;
    }

    return sanitized;
  }

  /**
   * Get sanitized user info
   */
  private getSanitizedUser(): UserInfo | undefined {
    if (!this.user || !this.privacy?.includeUser) {
      return undefined;
    }

    const userCopy: UserInfo = { ...this.user };

    if (!this.privacy?.includeSensitive) {
      delete userCopy.email;
    }

    return userCopy;
  }

  /**
   * Get sanitized system info
   */
  private getSanitizedSystem(): SystemInfo | undefined {
    if (!this.system || !this.privacy?.includeSystem) {
      return undefined;
    }

    return this.system;
  }

  /**
   * Check if a field name is considered sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /auth/i,
      /credential/i,
      /credit/i,
      /card/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(fieldName));
  }

  /**
   * Create a child context with additional fields
   */
  public child(
    additionalFields?: Record<string, unknown>,
    options?: Partial<IErrorContext>
  ): ErrorContext {
    const childContext = new ErrorContext({
      correlationId: this.correlationId,
      requestId: this.requestId,
      userId: this.userId,
      sessionId: this.sessionId,
      executionContext: options?.executionContext || this.executionContext,
      action: options?.action || this.action,
      request: options?.request || this.request,
      user: options?.user || this.user,
      system: options?.system || this.system,
      asyncContext: {
        ...this.asyncContext,
        parentContextId: this.id,
        depth: (this.asyncContext?.depth || 0) + 1,
      },
      privacy: options?.privacy || this.privacy,
      ...options,
    });

    // Copy fields from parent
    childContext.fields = { ...this.fields, ...(additionalFields || {}) };

    return childContext;
  }

  /**
   * Serialize context to JSON
   */
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      correlationId: this.correlationId,
      requestId: this.requestId,
      userId: this.privacy?.includeUser ? this.userId : undefined,
      sessionId: this.privacy?.includeUser ? this.sessionId : undefined,
      timestamp: this.timestamp.toISOString(),
      fields: this.getSanitizedFields(),
      executionContext: this.executionContext,
      action: this.action,
      request: this.privacy?.includeRequest ? this.getSanitizedRequest() : undefined,
      user: this.privacy?.includeUser ? this.getSanitizedUser() : undefined,
      system: this.privacy?.includeSystem ? this.getSanitizedSystem() : undefined,
      asyncContext: this.asyncContext,
      privacy: this.privacy,
    };
  }

  /**
   * Create context from JSON
   */
  public static fromJSON(json: Record<string, unknown>): ErrorContext {
    return new ErrorContext({
      id: json.id as string,
      correlationId: json.correlationId as string,
      requestId: json.requestId as string,
      userId: json.userId as string,
      sessionId: json.sessionId as string,
      timestamp: new Date(json.timestamp as string),
      fields: json.fields as Record<string, unknown>,
      executionContext: json.executionContext as string,
      action: json.action as string,
      request: json.request as RequestInfo,
      user: json.user as UserInfo,
      system: json.system as SystemInfo,
      asyncContext: json.asyncContext as AsyncContextInfo,
      privacy: json.privacy as PrivacySettings,
    });
  }
}

/**
 * Global error context manager using AsyncLocalStorage for async context tracking
 */
export class ErrorContextManager {
  private static instance: ErrorContextManager;
  private storage: AsyncLocalStorage<ErrorContext>;
  private currentContext: ErrorContext | null;

  private constructor() {
    this.storage = new AsyncLocalStorage<ErrorContext>();
    this.currentContext = null;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ErrorContextManager {
    if (!ErrorContextManager.instance) {
      ErrorContextManager.instance = new ErrorContextManager();
    }
    return ErrorContextManager.instance;
  }

  /**
   * Set the current error context
   */
  public setCurrentContext(context: ErrorContext): void {
    this.currentContext = context;
  }

  /**
   * Get the current error context
   */
  public getCurrentContext(): ErrorContext | null {
    // Try to get context from async storage first
    const asyncContext = this.storage.getStore();
    if (asyncContext) {
      return asyncContext;
    }

    // Fall back to current context
    return this.currentContext;
  }

  /**
   * Run a function with a specific error context
   */
  public runWithContext<T>(context: ErrorContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Run a function with a specific error context (async)
   */
  public async runWithContextAsync<T>(context: ErrorContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Create a new context and run function with it
   */
  public runWithNewContext<T>(options?: Partial<IErrorContext>, fn?: () => T): T {
    const context = new ErrorContext(options);
    return this.runWithContext(context, fn || (() => undefined as unknown as T));
  }

  /**
   * Create a new context and run function with it (async)
   */
  public async runWithNewContextAsync<T>(
    options?: Partial<IErrorContext>,
    fn?: () => Promise<T>
  ): Promise<T> {
    const context = new ErrorContext(options);
    return this.runWithContextAsync(context, fn || (async () => undefined as unknown as T));
  }

  /**
   * Enter a new context scope
   */
  public enterContext(options?: Partial<IErrorContext>): ErrorContext {
    const parentContext = this.getCurrentContext();
    const newContext = parentContext?.child({}, options) || new ErrorContext(options);
    this.setCurrentContext(newContext);
    return newContext;
  }

  /**
   * Exit current context scope
   */
  public exitContext(): void {
    // In a real implementation, we'd track a context stack
    // For now, we'll just clear the current context
    this.currentContext = null;
  }
}

/**
 * Get the current error context
 */
export function getCurrentErrorContext(): ErrorContext | null {
  return ErrorContextManager.getInstance().getCurrentContext();
}

/**
 * Create a new error context with the provided options
 */
export function createErrorContext(options?: Partial<IErrorContext>): ErrorContext {
  return new ErrorContext(options);
}

/**
 * Run a function with a specific error context
 */
export function runWithErrorContext<T>(context: ErrorContext, fn: () => T): T {
  return ErrorContextManager.getInstance().runWithContext(context, fn);
}

/**
 * Run a function with a specific error context (async)
 */
export async function runWithErrorContextAsync<T>(
  context: ErrorContext,
  fn: () => Promise<T>
): Promise<T> {
  return ErrorContextManager.getInstance().runWithContextAsync(context, fn);
}

export default ErrorContext;
