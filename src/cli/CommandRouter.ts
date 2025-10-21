/**
 * CommandRouter.ts
 *
 * Advanced command routing system with middleware support.
 * Routes parsed commands to appropriate handlers with validation and lifecycle management.
 */

import { BaseCommand } from '../core/cli/Command.interface';
import { IParsedArguments } from './CommandParser';
import { ICommandContext } from './CommandManager';
import { CLIError, ErrorCategory, ErrorSeverity } from './ErrorHandler';
import { Logger, LogLevel } from '../utils/Logger';

/**
 * Command handler function type
 */
export type CommandHandler = (context: CommandContext) => Promise<CommandResult> | CommandResult;

/**
 * Middleware function type
 */
export type Middleware = (
  context: CommandContext,
  next: () => Promise<CommandResult>
) => Promise<CommandResult>;

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Extended command context with routing information
 */
export interface CommandContext extends ICommandContext {
  parsedArgs: IParsedArguments;
  route?: RouteInfo;
  metadata?: Record<string, unknown>;
  startTime: number;
}

/**
 * Route configuration options
 */
export interface RouteOptions {
  priority?: number;
  middleware?: Middleware[];
  requiresAuth?: boolean;
  permissions?: string[];
  aliases?: string[];
  enabled?: boolean;
  deprecated?: boolean;
  deprecationMessage?: string;
}

/**
 * Route information
 */
export interface RouteInfo {
  pattern: string;
  handler: CommandHandler;
  options: RouteOptions;
  regex?: RegExp;
}

/**
 * Router configuration
 */
export interface IRouterConfig {
  logger?: Logger;
  defaultMiddleware?: Middleware[];
  enableMetrics?: boolean;
}

/**
 * CommandRouter class for routing commands to handlers
 */
export class CommandRouter {
  private routes: Map<string, RouteInfo>;
  private middleware: Middleware[];
  private logger: Logger;
  private enableMetrics: boolean;
  private metrics: Map<string, RouteMetrics>;

  /**
   * Creates a new CommandRouter instance
   * @param config - Router configuration
   */
  constructor(config: IRouterConfig = {}) {
    this.routes = new Map();
    this.middleware = config.defaultMiddleware ?? [];
    this.logger = config.logger ?? new Logger({ level: LogLevel.INFO, prefix: 'Router' });
    this.enableMetrics = config.enableMetrics ?? false;
    this.metrics = new Map();
  }

  /**
   * Register a command route
   * @param pattern - Route pattern (command name or regex)
   * @param handler - Command handler function
   * @param options - Route options
   */
  public register(pattern: string, handler: CommandHandler, options: RouteOptions = {}): void {
    const routeInfo: RouteInfo = {
      pattern,
      handler,
      options: {
        priority: options.priority ?? 0,
        middleware: options.middleware ?? [],
        requiresAuth: options.requiresAuth ?? false,
        permissions: options.permissions ?? [],
        aliases: options.aliases ?? [],
        enabled: options.enabled ?? true,
        deprecated: options.deprecated ?? false,
        deprecationMessage: options.deprecationMessage,
      },
      regex: this.patternToRegex(pattern),
    };

    // Register main route
    this.routes.set(pattern, routeInfo);

    // Register aliases
    if (routeInfo.options.aliases) {
      for (const alias of routeInfo.options.aliases) {
        this.routes.set(alias, routeInfo);
      }
    }

    this.logger.debug(`Registered route: ${pattern}`);
  }

  /**
   * Register a command instance
   * @param command - Command to register
   * @param options - Route options
   */
  public registerCommand(command: BaseCommand, options: RouteOptions = {}): void {
    const handler: CommandHandler = async (context: CommandContext) => {
      try {
        await command.execute(context.args, context.options, context.flags);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    };

    this.register(command.name, handler, options);
  }

  /**
   * Unregister a route
   * @param pattern - Route pattern to unregister
   * @returns True if route was unregistered
   */
  public unregister(pattern: string): boolean {
    const route = this.routes.get(pattern);
    if (!route) {
      return false;
    }

    // Remove main route
    this.routes.delete(pattern);

    // Remove aliases
    if (route.options.aliases) {
      for (const alias of route.options.aliases) {
        this.routes.delete(alias);
      }
    }

    this.logger.debug(`Unregistered route: ${pattern}`);
    return true;
  }

  /**
   * Add global middleware
   * @param middleware - Middleware function to add
   */
  public use(middleware: Middleware): void {
    this.middleware.push(middleware);
    this.logger.debug('Added global middleware');
  }

  /**
   * Remove global middleware
   * @param middleware - Middleware function to remove
   */
  public removeMiddleware(middleware: Middleware): void {
    const index = this.middleware.indexOf(middleware);
    if (index > -1) {
      this.middleware.splice(index, 1);
      this.logger.debug('Removed global middleware');
    }
  }

  /**
   * Route a command to its handler
   * @param parsedCommand - Parsed command arguments
   * @param context - Command execution context
   * @returns Command execution result
   */
  public async route(
    parsedCommand: IParsedArguments,
    context: ICommandContext
  ): Promise<CommandResult> {
    const commandName = parsedCommand.command ?? '';

    if (!commandName) {
      throw new CLIError(
        'No command specified',
        ErrorCategory.COMMAND_EXECUTION,
        ErrorSeverity.LOW,
        'NO_COMMAND',
        undefined,
        ['Run "airchitect help" to see available commands']
      );
    }

    // Find matching route
    const route = this.findRoute(commandName);

    if (!route) {
      throw new CLIError(
        `Unknown command: ${commandName}`,
        ErrorCategory.COMMAND_EXECUTION,
        ErrorSeverity.MEDIUM,
        'UNKNOWN_COMMAND',
        { command: commandName },
        [
          'Run "airchitect help" to see available commands',
          'Check for typos in the command name',
          `Try "airchitect help ${commandName}" for command-specific help`,
        ]
      );
    }

    // Check if route is enabled
    if (route.options.enabled === false) {
      throw new CLIError(
        `Command "${commandName}" is currently disabled`,
        ErrorCategory.COMMAND_EXECUTION,
        ErrorSeverity.MEDIUM,
        'COMMAND_DISABLED',
        { command: commandName }
      );
    }

    // Check if route is deprecated
    if (route.options.deprecated === true) {
      const message = route.options.deprecationMessage ?? `Command "${commandName}" is deprecated`;
      this.logger.warn(message);
    }

    // Create enhanced context
    const enhancedContext: CommandContext = {
      ...context,
      parsedArgs: parsedCommand,
      route,
      metadata: {},
      startTime: Date.now(),
    };

    // Build middleware chain
    const allMiddleware = [...this.middleware, ...(route.options.middleware ?? [])];

    // Execute handler with middleware
    try {
      const result = await this.executeWithMiddleware(
        route.handler,
        enhancedContext,
        allMiddleware
      );

      // Record metrics
      if (this.enableMetrics) {
        this.recordMetrics(commandName, Date.now() - enhancedContext.startTime, true);
      }

      return result;
    } catch (error) {
      // Record metrics
      if (this.enableMetrics) {
        this.recordMetrics(commandName, Date.now() - enhancedContext.startTime, false);
      }

      throw error;
    }
  }

  /**
   * Find a matching route for a command
   * @param commandName - Command name to match
   * @returns Matching route info or undefined
   */
  public findRoute(commandName: string): RouteInfo | undefined {
    // Try exact match first
    const exactMatch = this.routes.get(commandName);
    if (exactMatch) {
      return exactMatch;
    }

    // Try regex patterns
    const matchingRoutes: Array<{ route: RouteInfo; priority: number }> = [];

    for (const [pattern, route] of this.routes.entries()) {
      if (route.regex && route.regex.test(commandName)) {
        matchingRoutes.push({
          route,
          priority: route.options.priority ?? 0,
        });
      }
    }

    // Sort by priority (highest first)
    if (matchingRoutes.length > 0) {
      matchingRoutes.sort((a, b) => b.priority - a.priority);
      return matchingRoutes[0]?.route;
    }

    return undefined;
  }

  /**
   * Get route information by pattern
   * @param pattern - Route pattern
   * @returns Route info or undefined
   */
  public getRoute(pattern: string): RouteInfo | undefined {
    return this.routes.get(pattern);
  }

  /**
   * Get all registered routes
   * @returns Array of route patterns
   */
  public getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }

  /**
   * Check if a route exists
   * @param pattern - Route pattern
   * @returns True if route exists
   */
  public hasRoute(pattern: string): boolean {
    return this.routes.has(pattern);
  }

  /**
   * Clear all routes
   */
  public clear(): void {
    this.routes.clear();
    this.logger.debug('Cleared all routes');
  }

  /**
   * Execute handler with middleware chain
   * @param handler - Command handler
   * @param context - Command context
   * @param middleware - Middleware array
   * @returns Command result
   */
  private async executeWithMiddleware(
    handler: CommandHandler,
    context: CommandContext,
    middleware: Middleware[]
  ): Promise<CommandResult> {
    let index = 0;

    const next = async (): Promise<CommandResult> => {
      if (index < middleware.length) {
        const currentMiddleware = middleware[index];
        if (!currentMiddleware) {
          throw new Error('Middleware is undefined');
        }
        index++;
        return await currentMiddleware(context, next);
      }

      // Execute the actual handler
      return await handler(context);
    };

    return await next();
  }

  /**
   * Convert pattern to regex
   * @param pattern - Pattern string
   * @returns RegExp or undefined
   */
  private patternToRegex(pattern: string): RegExp | undefined {
    // Check if pattern contains wildcards or regex characters
    if (pattern.includes('*') || pattern.includes('?') || pattern.startsWith('^')) {
      // Convert wildcards to regex
      let regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.').replace(/\./g, '\\.');

      // Ensure full match
      if (!regexPattern.startsWith('^')) {
        regexPattern = `^${regexPattern}`;
      }
      if (!regexPattern.endsWith('$')) {
        regexPattern = `${regexPattern}$`;
      }

      return new RegExp(regexPattern);
    }

    return undefined;
  }

  /**
   * Record metrics for a command execution
   * @param commandName - Command name
   * @param duration - Execution duration in ms
   * @param success - Whether execution was successful
   */
  private recordMetrics(commandName: string, duration: number, success: boolean): void {
    let metrics = this.metrics.get(commandName);

    if (!metrics) {
      metrics = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
      };
      this.metrics.set(commandName, metrics);
    }

    metrics.count++;
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }

    metrics.totalDuration += duration;
    metrics.avgDuration = metrics.totalDuration / metrics.count;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
  }

  /**
   * Get metrics for a command
   * @param commandName - Command name
   * @returns Route metrics or undefined
   */
  public getMetrics(commandName: string): RouteMetrics | undefined {
    return this.metrics.get(commandName);
  }

  /**
   * Get all metrics
   * @returns Map of command names to metrics
   */
  public getAllMetrics(): Map<string, RouteMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics.clear();
    this.logger.debug('Reset all metrics');
  }
}

/**
 * Route metrics
 */
export interface RouteMetrics {
  count: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

/**
 * Built-in middleware functions
 */

/**
 * Logging middleware
 * @param context - Command context
 * @param next - Next middleware function
 * @returns Command result
 */
export async function loggingMiddleware(
  context: CommandContext,
  next: () => Promise<CommandResult>
): Promise<CommandResult> {
  context.logger.debug(`Executing command: ${context.command}`);
  const result = await next();
  context.logger.debug(
    `Command completed: ${context.command} (${result.success ? 'success' : 'failure'})`
  );
  return result;
}

/**
 * Timing middleware
 * @param context - Command context
 * @param next - Next middleware function
 * @returns Command result
 */
export async function timingMiddleware(
  context: CommandContext,
  next: () => Promise<CommandResult>
): Promise<CommandResult> {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  context.logger.debug(`Command execution time: ${duration}ms`);
  return result;
}

/**
 * Error handling middleware
 * @param context - Command context
 * @param next - Next middleware function
 * @returns Command result
 */
export async function errorHandlingMiddleware(
  context: CommandContext,
  next: () => Promise<CommandResult>
): Promise<CommandResult> {
  try {
    return await next();
  } catch (error) {
    context.errorHandler.handle(error, `Command: ${context.command}`);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Validation middleware
 * @param context - Command context
 * @param next - Next middleware function
 * @returns Command result
 */
export async function validationMiddleware(
  context: CommandContext,
  next: () => Promise<CommandResult>
): Promise<CommandResult> {
  // Validate required arguments
  const route = context.route;
  if (route?.options.requiresAuth === true) {
    // Check authentication (placeholder - integrate with auth system)
    const isAuthenticated = true; // TODO: Implement actual auth check

    if (!isAuthenticated) {
      throw new CLIError(
        'Authentication required',
        ErrorCategory.AUTHENTICATION,
        ErrorSeverity.HIGH,
        'AUTH_REQUIRED',
        { command: context.command },
        ['Run "airchitect login" to authenticate', 'Check your credentials']
      );
    }
  }

  // Check permissions
  if (route?.options.permissions && route.options.permissions.length > 0) {
    // Check permissions (placeholder - integrate with permissions system)
    const hasPermission = true; // TODO: Implement actual permission check

    if (!hasPermission) {
      throw new CLIError(
        'Insufficient permissions',
        ErrorCategory.PERMISSION,
        ErrorSeverity.HIGH,
        'PERMISSION_DENIED',
        { command: context.command, required: route.options.permissions },
        ['Check your user permissions', 'Contact your administrator']
      );
    }
  }

  return await next();
}
