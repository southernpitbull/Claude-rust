/**
 * CommandRouter.test.ts
 *
 * Unit tests for the CommandRouter class.
 */

import { CommandRouter, CommandContext, CommandResult, Middleware } from '../../src/cli/CommandRouter';
import { Logger, LogLevel } from '../../src/utils/Logger';
import { ErrorHandler } from '../../src/cli/ErrorHandler';
import { CLIError, ErrorCategory, ErrorSeverity } from '../../src/cli/ErrorHandler';
import { IParsedArguments } from '../../src/cli/CommandParser';

describe('CommandRouter', () => {
  let router: CommandRouter;
  let logger: Logger;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.SILENT });
    errorHandler = new ErrorHandler({ exitOnError: false });
    router = new CommandRouter({ logger, enableMetrics: true });
  });

  describe('register', () => {
    it('should register a route successfully', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      expect(router.hasRoute('test')).toBe(true);
    });

    it('should register routes with aliases', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, { aliases: ['t', 'tst'] });

      expect(router.hasRoute('test')).toBe(true);
      expect(router.hasRoute('t')).toBe(true);
      expect(router.hasRoute('tst')).toBe(true);
    });

    it('should register routes with options', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, {
        priority: 10,
        requiresAuth: true,
        permissions: ['read', 'write'],
      });

      const route = router.getRoute('test');
      expect(route?.options.priority).toBe(10);
      expect(route?.options.requiresAuth).toBe(true);
      expect(route?.options.permissions).toEqual(['read', 'write']);
    });

    it('should register routes with middleware', () => {
      const middleware: Middleware = jest.fn(async (ctx, next) => next());
      const handler = jest.fn(async () => ({ success: true }));

      router.register('test', handler, { middleware: [middleware] });

      const route = router.getRoute('test');
      expect(route?.options.middleware).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('should unregister a route successfully', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      expect(router.unregister('test')).toBe(true);
      expect(router.hasRoute('test')).toBe(false);
    });

    it('should unregister routes with aliases', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, { aliases: ['t'] });

      router.unregister('test');

      expect(router.hasRoute('test')).toBe(false);
      expect(router.hasRoute('t')).toBe(false);
    });

    it('should return false when unregistering non-existent route', () => {
      expect(router.unregister('nonexistent')).toBe(false);
    });
  });

  describe('use', () => {
    it('should add global middleware', async () => {
      const middleware = jest.fn(async (ctx, next) => next());
      const handler = jest.fn(async () => ({ success: true }));

      router.use(middleware);
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      expect(middleware).toHaveBeenCalled();
    });

    it('should execute multiple global middleware in order', async () => {
      const order: number[] = [];
      const middleware1: Middleware = jest.fn(async (ctx, next) => {
        order.push(1);
        return next();
      });
      const middleware2: Middleware = jest.fn(async (ctx, next) => {
        order.push(2);
        return next();
      });
      const handler = jest.fn(async () => {
        order.push(3);
        return { success: true };
      });

      router.use(middleware1);
      router.use(middleware2);
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('route', () => {
    it('should route to the correct handler', async () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      const result = await router.route(parsedArgs, context);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should throw error for unknown command', async () => {
      const parsedArgs: IParsedArguments = {
        command: 'unknown',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['unknown'],
      };

      const context = {
        command: 'unknown',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await expect(router.route(parsedArgs, context)).rejects.toThrow(CLIError);
    });

    it('should throw error when no command is specified', async () => {
      const parsedArgs: IParsedArguments = {
        args: {},
        options: {},
        flags: new Set(),
        raw: [],
      };

      const context = {
        command: '',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await expect(router.route(parsedArgs, context)).rejects.toThrow('No command specified');
    });

    it('should route to alias', async () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, { aliases: ['t'] });

      const parsedArgs: IParsedArguments = {
        command: 't',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['t'],
      };

      const context = {
        command: 't',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      const result = await router.route(parsedArgs, context);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should execute route-specific middleware', async () => {
      const middleware = jest.fn(async (ctx, next) => next());
      const handler = jest.fn(async () => ({ success: true }));

      router.register('test', handler, { middleware: [middleware] });

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      expect(middleware).toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });

    it('should throw error for disabled route', async () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, { enabled: false });

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await expect(router.route(parsedArgs, context)).rejects.toThrow('currently disabled');
    });
  });

  describe('findRoute', () => {
    it('should find exact match route', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      const route = router.findRoute('test');

      expect(route).toBeDefined();
      expect(route?.pattern).toBe('test');
    });

    it('should find route by alias', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler, { aliases: ['t'] });

      const route = router.findRoute('t');

      expect(route).toBeDefined();
      expect(route?.pattern).toBe('test');
    });

    it('should return undefined for non-existent route', () => {
      const route = router.findRoute('nonexistent');
      expect(route).toBeUndefined();
    });

    it('should match wildcard patterns', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test*', handler);

      const route = router.findRoute('test123');

      expect(route).toBeDefined();
    });

    it('should respect priority in pattern matching', () => {
      const handler1 = jest.fn(async () => ({ success: true, data: 1 }));
      const handler2 = jest.fn(async () => ({ success: true, data: 2 }));

      router.register('test*', handler1, { priority: 5 });
      router.register('test*', handler2, { priority: 10 });

      const route = router.findRoute('test123');

      expect(route?.options.priority).toBe(10);
    });
  });

  describe('metrics', () => {
    it('should record metrics for successful execution', async () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      const metrics = router.getMetrics('test');

      expect(metrics).toBeDefined();
      expect(metrics?.count).toBe(1);
      expect(metrics?.successCount).toBe(1);
      expect(metrics?.failureCount).toBe(0);
    });

    it('should record metrics for failed execution', async () => {
      const handler = jest.fn(async () => {
        throw new Error('Test error');
      });
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await expect(router.route(parsedArgs, context)).rejects.toThrow('Test error');

      const metrics = router.getMetrics('test');

      expect(metrics).toBeDefined();
      expect(metrics?.count).toBe(1);
      expect(metrics?.successCount).toBe(0);
      expect(metrics?.failureCount).toBe(1);
    });

    it('should calculate average duration', async () => {
      const handler = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true };
      });
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      const metrics = router.getMetrics('test');

      expect(metrics).toBeDefined();
      expect(metrics?.avgDuration).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test', handler);

      const parsedArgs: IParsedArguments = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        raw: ['test'],
      };

      const context = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler,
      };

      await router.route(parsedArgs, context);

      router.resetMetrics();

      const metrics = router.getMetrics('test');
      expect(metrics).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all routes', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test1', handler);
      router.register('test2', handler);

      router.clear();

      expect(router.hasRoute('test1')).toBe(false);
      expect(router.hasRoute('test2')).toBe(false);
    });
  });

  describe('getRoutes', () => {
    it('should return all registered routes', () => {
      const handler = jest.fn(async () => ({ success: true }));
      router.register('test1', handler);
      router.register('test2', handler);

      const routes = router.getRoutes();

      expect(routes).toContain('test1');
      expect(routes).toContain('test2');
    });
  });
});
