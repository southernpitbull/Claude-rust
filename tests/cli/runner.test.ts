/**
 * runner.test.ts
 *
 * Comprehensive tests for the CommandRunner
 */

import { CommandRunner, CommandContext, CommandResult } from '../../src/cli/runner';
import { Logger, LogLevel } from '../../src/utils/Logger';

describe('CommandRunner', () => {
  let runner: CommandRunner;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.SILENT });
    runner = new CommandRunner({ logger, enableMetrics: true });
  });

  afterEach(async () => {
    await runner.cleanup();
  });

  describe('register', () => {
    it('should register a command', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({
        name: 'test',
        handler,
      });

      expect(runner.hasCommand('test')).toBe(true);
    });

    it('should register command with aliases', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({
        name: 'test',
        handler,
        aliases: ['t', 'tst'],
      });

      expect(runner.hasCommand('test')).toBe(true);
      expect(runner.hasCommand('t')).toBe(true);
      expect(runner.hasCommand('tst')).toBe(true);
    });

    it('should register command with options', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({
        name: 'test',
        handler,
        description: 'Test command',
        retryable: true,
        maxRetries: 5,
        timeout: 10000,
      });

      const command = runner.getCommand('test');
      expect(command).toBeDefined();
      expect(command?.description).toBe('Test command');
      expect(command?.retryable).toBe(true);
      expect(command?.maxRetries).toBe(5);
      expect(command?.timeout).toBe(10000);
    });
  });

  describe('unregister', () => {
    it('should unregister a command', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({ name: 'test', handler });
      expect(runner.hasCommand('test')).toBe(true);

      const result = runner.unregister('test');
      expect(result).toBe(true);
      expect(runner.hasCommand('test')).toBe(false);
    });

    it('should return false when unregistering non-existent command', () => {
      const result = runner.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should unregister command aliases', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({
        name: 'test',
        handler,
        aliases: ['t'],
      });

      runner.unregister('test');
      expect(runner.hasCommand('test')).toBe(false);
      expect(runner.hasCommand('t')).toBe(false);
    });
  });

  describe('execute', () => {
    it('should execute a command successfully', async () => {
      const handler = async (context: CommandContext): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
        message: 'Test executed',
      });

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      const result = await runner.execute(context);
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toBe('Test executed');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle command execution errors', async () => {
      const handler = async (): Promise<CommandResult> => {
        throw new Error('Test error');
      };

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      const result = await runner.execute(context);
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should throw error for unknown command', async () => {
      const context: CommandContext = {
        command: 'nonexistent',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      const result = await runner.execute(context);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should retry command on failure if retryable', async () => {
      let attempts = 0;
      const handler = async (): Promise<CommandResult> => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry test');
        }
        return { success: true, exitCode: 0 };
      };

      runner.register({
        name: 'test',
        handler,
        retryable: true,
        maxRetries: 3,
      });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      const result = await runner.execute(context);
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('should timeout long-running commands', async () => {
      const handler = async (): Promise<CommandResult> => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { success: true, exitCode: 0 };
      };

      runner.register({
        name: 'test',
        handler,
        timeout: 100,
      });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      const result = await runner.execute(context);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    }, 10000);
  });

  describe('metrics', () => {
    it('should record command execution metrics', async () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      await runner.execute(context);

      const metrics = runner.getMetrics('test');
      expect(metrics).toBeDefined();
      expect(metrics?.count).toBe(1);
      expect(metrics?.successCount).toBe(1);
      expect(metrics?.failureCount).toBe(0);
    });

    it('should track success and failure counts', async () => {
      let shouldFail = true;
      const handler = async (): Promise<CommandResult> => {
        if (shouldFail) {
          throw new Error('Test error');
        }
        return { success: true, exitCode: 0 };
      };

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      // First execution fails
      await runner.execute(context);

      // Second execution succeeds
      shouldFail = false;
      await runner.execute(context);

      const metrics = runner.getMetrics('test');
      expect(metrics?.count).toBe(2);
      expect(metrics?.successCount).toBe(1);
      expect(metrics?.failureCount).toBe(1);
    });

    it('should reset metrics', async () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      await runner.execute(context);
      expect(runner.getMetrics('test')).toBeDefined();

      runner.resetMetrics();
      expect(runner.getMetrics('test')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({ name: 'test', handler });

      await runner.cleanup();

      const status = runner.getStatus();
      expect(status.activeExecutions).toBe(0);
    });

    it('should wait for active executions', async () => {
      const handler = async (): Promise<CommandResult> => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { success: true, exitCode: 0 };
      };

      runner.register({ name: 'test', handler });

      const context: CommandContext = {
        command: 'test',
        args: {},
        options: {},
        flags: new Set(),
        logger,
        errorHandler: undefined,
      };

      // Start execution without waiting
      const execution = runner.execute(context);

      // Cleanup should wait
      await runner.cleanup();

      // Execution should complete
      const result = await execution;
      expect(result.success).toBe(true);
    }, 10000);
  });

  describe('getStatus', () => {
    it('should return runner status', () => {
      const handler = async (): Promise<CommandResult> => ({
        success: true,
        exitCode: 0,
      });

      runner.register({ name: 'test1', handler });
      runner.register({ name: 'test2', handler });

      const status = runner.getStatus();
      expect(status.totalCommands).toBeGreaterThanOrEqual(2);
      expect(status.metricsEnabled).toBe(true);
    });
  });
});
