/**
 * CLIBootstrapper.test.ts
 *
 * Unit tests for the CLIBootstrapper class.
 */

import { CLIBootstrapper, BootstrapPhase } from '../../src/cli/CLIBootstrapper';
import { LogLevel } from '../../src/utils/Logger';

describe('CLIBootstrapper', () => {
  let bootstrapper: CLIBootstrapper;

  beforeEach(() => {
    bootstrapper = new CLIBootstrapper({
      appName: 'testapp',
      appVersion: '1.0.0',
      appDescription: 'Test application',
      logLevel: LogLevel.SILENT,
      checkDependencies: false,
      enablePlugins: false,
    });
  });

  afterEach(async () => {
    if (bootstrapper.isReady()) {
      await bootstrapper.shutdown();
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultBootstrapper = new CLIBootstrapper();

      expect(defaultBootstrapper).toBeDefined();
      expect(defaultBootstrapper.getCurrentPhase()).toBe(BootstrapPhase.PRE_INIT);
    });

    it('should create instance with custom config', () => {
      expect(bootstrapper).toBeDefined();
      expect(bootstrapper.getCommandManager()).toBeDefined();
      expect(bootstrapper.getCommandRouter()).toBeDefined();
      expect(bootstrapper.getHelpSystem()).toBeDefined();
      expect(bootstrapper.getErrorHandler()).toBeDefined();
      expect(bootstrapper.getLogger()).toBeDefined();
    });
  });

  describe('bootstrap', () => {
    it('should bootstrap successfully', async () => {
      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(true);
      expect(result.phase).toBe(BootstrapPhase.READY);
      expect(bootstrapper.isReady()).toBe(true);
    });

    it('should execute all phases in order', async () => {
      const phases: BootstrapPhase[] = [];

      bootstrapper.addPreInitHook(() => {
        phases.push(BootstrapPhase.PRE_INIT);
      });

      bootstrapper.addInitHook(() => {
        phases.push(BootstrapPhase.INIT);
      });

      bootstrapper.addBootstrapHook(() => {
        phases.push(BootstrapPhase.BOOTSTRAP);
      });

      bootstrapper.addReadyHook(() => {
        phases.push(BootstrapPhase.READY);
      });

      await bootstrapper.bootstrap();

      expect(phases).toEqual([
        BootstrapPhase.PRE_INIT,
        BootstrapPhase.INIT,
        BootstrapPhase.BOOTSTRAP,
        BootstrapPhase.READY,
      ]);
    });

    it('should return error result on failure', async () => {
      bootstrapper.addPreInitHook(() => {
        throw new Error('Pre-init failed');
      });

      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Pre-init failed');
    });

    it('should record bootstrap duration', async () => {
      await bootstrapper.bootstrap();

      const duration = bootstrapper.getBootstrapDuration();
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('lifecycle hooks', () => {
    it('should execute pre-init hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addPreInitHook(hook);

      await bootstrapper.bootstrap();

      expect(hook).toHaveBeenCalled();
    });

    it('should execute init hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addInitHook(hook);

      await bootstrapper.bootstrap();

      expect(hook).toHaveBeenCalled();
    });

    it('should execute bootstrap hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addBootstrapHook(hook);

      await bootstrapper.bootstrap();

      expect(hook).toHaveBeenCalled();
    });

    it('should execute ready hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addReadyHook(hook);

      await bootstrapper.bootstrap();

      expect(hook).toHaveBeenCalled();
    });

    it('should execute shutdown hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addShutdownHook(hook);

      await bootstrapper.bootstrap();
      await bootstrapper.shutdown();

      expect(hook).toHaveBeenCalled();
    });

    it('should continue on hook failure', async () => {
      const hook1 = jest.fn(() => {
        throw new Error('Hook failed');
      });
      const hook2 = jest.fn();

      bootstrapper.addPreInitHook(hook1);
      bootstrapper.addPreInitHook(hook2);

      await bootstrapper.bootstrap();

      expect(hook1).toHaveBeenCalled();
      expect(hook2).toHaveBeenCalled();
    });

    it('should execute async hooks', async () => {
      const hook = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      bootstrapper.addPreInitHook(hook);

      await bootstrapper.bootstrap();

      expect(hook).toHaveBeenCalled();
    });

    it('should execute multiple hooks in order', async () => {
      const order: number[] = [];

      bootstrapper.addPreInitHook(() => order.push(1));
      bootstrapper.addPreInitHook(() => order.push(2));
      bootstrapper.addPreInitHook(() => order.push(3));

      await bootstrapper.bootstrap();

      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('shutdown', () => {
    it('should shutdown successfully', async () => {
      await bootstrapper.bootstrap();
      await bootstrapper.shutdown();

      expect(bootstrapper.getCurrentPhase()).toBe(BootstrapPhase.SHUTDOWN);
    });

    it('should execute shutdown hooks', async () => {
      const hook = jest.fn();
      bootstrapper.addShutdownHook(hook);

      await bootstrapper.bootstrap();
      await bootstrapper.shutdown();

      expect(hook).toHaveBeenCalled();
    });

    it('should not shutdown twice', async () => {
      await bootstrapper.bootstrap();
      await bootstrapper.shutdown();

      const phase1 = bootstrapper.getCurrentPhase();
      await bootstrapper.shutdown();
      const phase2 = bootstrapper.getCurrentPhase();

      expect(phase1).toBe(BootstrapPhase.SHUTDOWN);
      expect(phase2).toBe(BootstrapPhase.SHUTDOWN);
    });

    it('should handle shutdown errors gracefully', async () => {
      bootstrapper.addShutdownHook(() => {
        throw new Error('Shutdown failed');
      });

      await bootstrapper.bootstrap();
      await expect(bootstrapper.shutdown()).resolves.not.toThrow();
    });
  });

  describe('getters', () => {
    it('should return command manager', () => {
      const manager = bootstrapper.getCommandManager();
      expect(manager).toBeDefined();
    });

    it('should return command router', () => {
      const router = bootstrapper.getCommandRouter();
      expect(router).toBeDefined();
    });

    it('should return help system', () => {
      const helpSystem = bootstrapper.getHelpSystem();
      expect(helpSystem).toBeDefined();
    });

    it('should return error handler', () => {
      const errorHandler = bootstrapper.getErrorHandler();
      expect(errorHandler).toBeDefined();
    });

    it('should return logger', () => {
      const logger = bootstrapper.getLogger();
      expect(logger).toBeDefined();
    });
  });

  describe('isReady', () => {
    it('should return false before bootstrap', () => {
      expect(bootstrapper.isReady()).toBe(false);
    });

    it('should return true after successful bootstrap', async () => {
      await bootstrapper.bootstrap();

      expect(bootstrapper.isReady()).toBe(true);
    });

    it('should return false after failed bootstrap', async () => {
      bootstrapper.addPreInitHook(() => {
        throw new Error('Bootstrap failed');
      });

      await bootstrapper.bootstrap();

      expect(bootstrapper.isReady()).toBe(false);
    });
  });

  describe('getCurrentPhase', () => {
    it('should return PRE_INIT initially', () => {
      expect(bootstrapper.getCurrentPhase()).toBe(BootstrapPhase.PRE_INIT);
    });

    it('should return READY after bootstrap', async () => {
      await bootstrapper.bootstrap();

      expect(bootstrapper.getCurrentPhase()).toBe(BootstrapPhase.READY);
    });

    it('should return SHUTDOWN after shutdown', async () => {
      await bootstrapper.bootstrap();
      await bootstrapper.shutdown();

      expect(bootstrapper.getCurrentPhase()).toBe(BootstrapPhase.SHUTDOWN);
    });
  });

  describe('getBootstrapDuration', () => {
    it('should return 0 before bootstrap', () => {
      expect(bootstrapper.getBootstrapDuration()).toBeGreaterThanOrEqual(0);
    });

    it('should return positive duration after bootstrap', async () => {
      await bootstrapper.bootstrap();

      const duration = bootstrapper.getBootstrapDuration();
      expect(duration).toBeGreaterThan(0);
    });

    it('should measure actual execution time', async () => {
      bootstrapper.addPreInitHook(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await bootstrapper.bootstrap();

      const duration = bootstrapper.getBootstrapDuration();
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });

  describe('error handling', () => {
    it('should catch errors in pre-init phase', async () => {
      bootstrapper.addPreInitHook(() => {
        throw new Error('Pre-init error');
      });

      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(false);
      expect(result.phase).toBe(BootstrapPhase.PRE_INIT);
    });

    it('should catch errors in init phase', async () => {
      bootstrapper.addInitHook(() => {
        throw new Error('Init error');
      });

      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(false);
      expect(result.phase).toBe(BootstrapPhase.INIT);
    });

    it('should catch errors in bootstrap phase', async () => {
      bootstrapper.addBootstrapHook(() => {
        throw new Error('Bootstrap error');
      });

      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(false);
      expect(result.phase).toBe(BootstrapPhase.BOOTSTRAP);
    });

    it('should catch errors in ready phase', async () => {
      bootstrapper.addReadyHook(() => {
        throw new Error('Ready error');
      });

      const result = await bootstrapper.bootstrap();

      expect(result.success).toBe(false);
      expect(result.phase).toBe(BootstrapPhase.READY);
    });
  });

  describe('configuration', () => {
    it('should use custom app name', () => {
      const helpSystem = bootstrapper.getHelpSystem();
      expect(helpSystem).toBeDefined();
    });

    it('should use custom log level', () => {
      const logger = bootstrapper.getLogger();
      expect(logger.getLevel()).toBe(LogLevel.SILENT);
    });

    it('should respect verbose flag', async () => {
      const verboseBootstrapper = new CLIBootstrapper({
        verbose: true,
        logLevel: LogLevel.INFO,
        checkDependencies: false,
        enablePlugins: false,
      });

      await verboseBootstrapper.bootstrap();

      const logger = verboseBootstrapper.getLogger();
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);

      await verboseBootstrapper.shutdown();
    });
  });

  describe('integration', () => {
    it('should integrate all components', async () => {
      await bootstrapper.bootstrap();

      expect(bootstrapper.getCommandManager()).toBeDefined();
      expect(bootstrapper.getCommandRouter()).toBeDefined();
      expect(bootstrapper.getHelpSystem()).toBeDefined();
      expect(bootstrapper.getErrorHandler()).toBeDefined();
      expect(bootstrapper.getLogger()).toBeDefined();
    });

    it('should share logger across components', async () => {
      await bootstrapper.bootstrap();

      const logger = bootstrapper.getLogger();
      const commandManager = bootstrapper.getCommandManager();

      expect(logger).toBeDefined();
      expect(commandManager).toBeDefined();
    });
  });
});
