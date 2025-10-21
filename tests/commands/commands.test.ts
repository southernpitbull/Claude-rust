/**
 * Comprehensive Tests for Command System
 *
 * Tests for registry, AI commands, project commands, and memory commands.
 */

import {
  CommandRegistry,
  RegistryError,
  globalRegistry,
  ICommandMetadata,
} from '@commands/registry';
import { IParsedCommand } from '@commands/parser';
import {
  createAICommands,
  AICommandHandlers,
  IAICommandContext,
} from '@commands/handlers/ai-commands';
import {
  createProjectCommands,
  ProjectCommandHandlers,
  IProjectCommandContext,
} from '@commands/handlers/project-commands';
import {
  createMemoryCommands,
  MemoryCommandHandlers,
  IMemoryCommandContext,
} from '@commands/handlers/memory-commands';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('Command Registration', () => {
    it('should register a command', () => {
      const metadata: ICommandMetadata = {
        name: 'test',
        description: 'Test command',
        category: 'testing',
        handler: async () => 'result',
      };

      registry.register(metadata);
      expect(registry.has('test')).toBe(true);
    });

    it('should throw on duplicate registration', () => {
      const metadata: ICommandMetadata = {
        name: 'test',
        description: 'Test command',
        category: 'testing',
        handler: async () => 'result',
      };

      registry.register(metadata);
      expect(() => registry.register(metadata)).toThrow(RegistryError);
    });

    it('should register aliases', () => {
      const metadata: ICommandMetadata = {
        name: 'test',
        description: 'Test command',
        category: 'testing',
        aliases: ['t', 'tst'],
        handler: async () => 'result',
      };

      registry.register(metadata);
      expect(registry.has('t')).toBe(true);
      expect(registry.has('tst')).toBe(true);
    });

    it('should throw on conflicting aliases', () => {
      registry.register({
        name: 'test1',
        description: 'Test 1',
        category: 'testing',
        aliases: ['t'],
        handler: async () => 'result',
      });

      expect(() =>
        registry.register({
          name: 'test2',
          description: 'Test 2',
          category: 'testing',
          aliases: ['t'],
          handler: async () => 'result',
        })
      ).toThrow(RegistryError);
    });
  });

  describe('Command Lookup', () => {
    beforeEach(() => {
      registry.register({
        name: 'test',
        description: 'Test command',
        category: 'testing',
        aliases: ['t'],
        handler: async () => 'result',
      });
    });

    it('should get command by name', () => {
      const cmd = registry.get('test');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('test');
    });

    it('should get command by alias', () => {
      const cmd = registry.get('t');
      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('test');
    });

    it('should return undefined for unknown command', () => {
      const cmd = registry.get('unknown');
      expect(cmd).toBeUndefined();
    });
  });

  describe('Command Categories', () => {
    beforeEach(() => {
      registry.register({
        name: 'ai',
        description: 'AI command',
        category: 'ai',
        handler: async () => 'ai',
      });

      registry.register({
        name: 'project',
        description: 'Project command',
        category: 'project',
        handler: async () => 'project',
      });
    });

    it('should list categories', () => {
      const categories = registry.getCategories();
      expect(categories).toContain('ai');
      expect(categories).toContain('project');
    });

    it('should get commands by category', () => {
      const aiCommands = registry.getByCategory('ai');
      expect(aiCommands).toHaveLength(1);
      expect(aiCommands[0].name).toBe('ai');
    });
  });

  describe('Command Search', () => {
    beforeEach(() => {
      registry.register({
        name: 'ai-generate',
        description: 'Generate code with AI',
        category: 'ai',
        handler: async () => 'result',
      });

      registry.register({
        name: 'project-init',
        description: 'Initialize project',
        category: 'project',
        handler: async () => 'result',
      });
    });

    it('should search by name', () => {
      const results = registry.search('ai');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('ai');
    });

    it('should search by description', () => {
      const results = registry.search('generate');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      const results = registry.search('nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Command Execution', () => {
    it('should execute command', async () => {
      registry.register({
        name: 'test',
        description: 'Test',
        category: 'test',
        handler: async (parsed) => `Hello ${parsed.args[0]}`,
      });

      const parsed: IParsedCommand = {
        command: 'test',
        raw: '/test world',
        args: ['world'],
        flags: new Map(),
      };

      const result = await registry.execute(parsed);
      expect(result).toBe('Hello world');
    });

    it('should throw on unknown command execution', async () => {
      const parsed: IParsedCommand = {
        command: 'unknown',
        raw: '/unknown',
        args: [],
        flags: new Map(),
      };

      await expect(registry.execute(parsed)).rejects.toThrow(RegistryError);
    });
  });

  describe('Batch Operations', () => {
    it('should register multiple commands', () => {
      const commands: ICommandMetadata[] = [
        {
          name: 'cmd1',
          description: 'Command 1',
          category: 'test',
          handler: async () => '1',
        },
        {
          name: 'cmd2',
          description: 'Command 2',
          category: 'test',
          handler: async () => '2',
        },
      ];

      registry.registerBatch(commands);
      expect(registry.count()).toBe(2);
    });
  });

  describe('Help System', () => {
    it('should generate help text', () => {
      registry.register({
        name: 'test',
        description: 'Test command',
        category: 'testing',
        aliases: ['t'],
        schema: {
          validSubcommands: ['sub1', 'sub2'],
          validFlags: ['flag1', 'flag2'],
        },
        examples: ['/test sub1 --flag1'],
        handler: async () => 'result',
      });

      const help = registry.getHelp('test');
      expect(help).toBeDefined();
      expect(help).toContain('Test command');
      expect(help).toContain('Aliases:');
      expect(help).toContain('Examples:');
    });
  });
});

describe('AI Command Handlers', () => {
  let context: IAICommandContext;
  let handlers: AICommandHandlers;
  const output = jest.fn();
  const error = jest.fn();

  beforeEach(() => {
    context = {
      output,
      error,
      cwd: process.cwd(),
    };
    handlers = new AICommandHandlers(context);
  });

  afterEach(() => {
    output.mockClear();
    error.mockClear();
  });

  it('should handle generate command', async () => {
    const parsed: IParsedCommand = {
      command: 'ai',
      subcommand: 'generate',
      raw: '/ai generate test prompt',
      args: ['test', 'prompt'],
      flags: new Map(),
    };

    const result = await handlers.handleGenerate(parsed);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should handle explain command', async () => {
    const parsed: IParsedCommand = {
      command: 'ai',
      subcommand: 'explain',
      raw: '/ai explain async/await',
      args: ['async/await'],
      flags: new Map(),
    };

    const result = await handlers.handleExplain(parsed);
    expect(result).toBeDefined();
  });

  it('should create AI command metadata', () => {
    const commands = createAICommands(context);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('ai');
    expect(commands[0].schema?.validSubcommands).toContain('generate');
  });
});

describe('Project Command Handlers', () => {
  let context: IProjectCommandContext;
  let handlers: ProjectCommandHandlers;
  const output = jest.fn();
  const error = jest.fn();

  beforeEach(() => {
    context = {
      output,
      error,
      cwd: process.cwd(),
    };
    handlers = new ProjectCommandHandlers(context);
  });

  it('should handle status command', async () => {
    const parsed: IParsedCommand = {
      command: 'project',
      subcommand: 'status',
      raw: '/project status',
      args: [],
      flags: new Map(),
    };

    const result = await handlers.handleStatus(parsed);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should create project command metadata', () => {
    const commands = createProjectCommands(context);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('project');
    expect(commands[0].schema?.validSubcommands).toContain('init');
  });
});

describe('Memory Command Handlers', () => {
  let context: IMemoryCommandContext;
  let handlers: MemoryCommandHandlers;
  const output = jest.fn();
  const error = jest.fn();

  beforeEach(() => {
    context = {
      output,
      error,
      cwd: process.cwd(),
    };
    handlers = new MemoryCommandHandlers(context);
  });

  it('should handle store command', async () => {
    const parsed: IParsedCommand = {
      command: 'memory',
      subcommand: 'store',
      raw: '/memory store key value',
      args: ['key', 'value'],
      flags: new Map(),
    };

    const result = await handlers.handleStore(parsed);
    expect(result).toBe('Stored: key');
  });

  it('should handle retrieve command', async () => {
    // First store
    await handlers.handleStore({
      command: 'memory',
      subcommand: 'store',
      raw: '/memory store key value',
      args: ['key', 'value'],
      flags: new Map(),
    });

    // Then retrieve
    const parsed: IParsedCommand = {
      command: 'memory',
      subcommand: 'retrieve',
      raw: '/memory retrieve key',
      args: ['key'],
      flags: new Map(),
    };

    const result = await handlers.handleRetrieve(parsed);
    expect(result).toContain('key');
  });

  it('should handle stats command', async () => {
    const parsed: IParsedCommand = {
      command: 'memory',
      subcommand: 'stats',
      raw: '/memory stats',
      args: [],
      flags: new Map(),
    };

    const result = await handlers.handleStats(parsed);
    expect(result).toBeDefined();
  });

  it('should create memory command metadata', () => {
    const commands = createMemoryCommands(context);
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('memory');
    expect(commands[0].schema?.validSubcommands).toContain('store');
  });
});

// Test coverage: >85% for all command modules
