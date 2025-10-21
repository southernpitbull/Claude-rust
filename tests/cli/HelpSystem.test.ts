/**
 * HelpSystem.test.ts
 *
 * Unit tests for the HelpSystem class.
 */

import { HelpSystem, HelpContent } from '../../src/cli/HelpSystem';
import { BaseCommand } from '../../src/core/cli/Command.interface';
import { Logger, LogLevel } from '../../src/utils/Logger';

describe('HelpSystem', () => {
  let helpSystem: HelpSystem;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: LogLevel.SILENT });
    helpSystem = new HelpSystem({
      logger,
      appName: 'testapp',
      appVersion: '1.0.0',
      appDescription: 'Test application',
    });
  });

  describe('register', () => {
    it('should register help content successfully', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
      };

      helpSystem.register('test', content);

      const registered = helpSystem.getHelp('test');
      expect(registered).toBeDefined();
      expect(registered?.title).toBe('test');
      expect(registered?.description).toBe('Test command');
    });

    it('should register help with category', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
        category: 'development',
      };

      helpSystem.register('test', content);

      const registered = helpSystem.getHelp('test');
      expect(registered?.category).toBe('development');
    });

    it('should register help with examples', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
        examples: [
          {
            description: 'Basic usage',
            command: 'testapp test arg1',
            output: 'Success',
          },
        ],
      };

      helpSystem.register('test', content);

      const registered = helpSystem.getHelp('test');
      expect(registered?.examples).toHaveLength(1);
      expect(registered?.examples?.[0]?.command).toBe('testapp test arg1');
    });

    it('should register help with options and arguments', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
        options: [
          {
            flags: '--verbose, -v',
            description: 'Enable verbose output',
            required: false,
          },
        ],
        arguments: [
          {
            name: 'input',
            description: 'Input file',
            required: true,
          },
        ],
      };

      helpSystem.register('test', content);

      const registered = helpSystem.getHelp('test');
      expect(registered?.options).toHaveLength(1);
      expect(registered?.arguments).toHaveLength(1);
    });
  });

  describe('registerFromCommand', () => {
    it('should register help from command instance', () => {
      const command: BaseCommand = {
        name: 'test',
        description: 'Test command',
        execute: jest.fn(async () => {}),
      };

      helpSystem.registerFromCommand(command);

      const registered = helpSystem.getHelp('test');
      expect(registered).toBeDefined();
      expect(registered?.title).toBe('test');
      expect(registered?.description).toBe('Test command');
    });

    it('should register help with command options', () => {
      const command: BaseCommand = {
        name: 'test',
        description: 'Test command',
        options: [
          {
            flags: '--verbose, -v',
            description: 'Enable verbose output',
          },
        ],
        execute: jest.fn(async () => {}),
      };

      helpSystem.registerFromCommand(command);

      const registered = helpSystem.getHelp('test');
      expect(registered?.options).toHaveLength(1);
      expect(registered?.options?.[0]?.flags).toBe('--verbose, -v');
    });

    it('should register help with command arguments', () => {
      const command: BaseCommand = {
        name: 'test',
        description: 'Test command',
        arguments: [
          {
            name: 'input',
            description: 'Input file',
            required: true,
          },
        ],
        execute: jest.fn(async () => {}),
      };

      helpSystem.registerFromCommand(command);

      const registered = helpSystem.getHelp('test');
      expect(registered?.arguments).toHaveLength(1);
      expect(registered?.arguments?.[0]?.name).toBe('input');
    });

    it('should register help with custom help text', () => {
      const command: BaseCommand = {
        name: 'test',
        description: 'Test command',
        execute: jest.fn(async () => {}),
        getHelp: () => 'Custom help text',
      };

      helpSystem.registerFromCommand(command);

      const registered = helpSystem.getHelp('test');
      expect(registered?.notes).toContain('Custom help text');
    });
  });

  describe('getHelp', () => {
    it('should return help content for registered command', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
      };

      helpSystem.register('test', content);

      const help = helpSystem.getHelp('test');
      expect(help).toBeDefined();
      expect(help?.title).toBe('test');
    });

    it('should return undefined for non-existent command', () => {
      const help = helpSystem.getHelp('nonexistent');
      expect(help).toBeUndefined();
    });
  });

  describe('showHelp', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should display help for specific command', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
      };

      helpSystem.register('test', content);
      helpSystem.showHelp('test');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should display general help when no command specified', () => {
      helpSystem.showHelp();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('testapp');
      expect(output).toContain('1.0.0');
    });

    it('should show suggestions for non-existent command', () => {
      const content: HelpContent = {
        title: 'test',
        description: 'Test command',
      };

      helpSystem.register('test', content);
      helpSystem.showHelp('tst');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      helpSystem.register('test', {
        title: 'test',
        description: 'Test command for testing',
      });
      helpSystem.register('deploy', {
        title: 'deploy',
        description: 'Deploy application',
      });
      helpSystem.register('build', {
        title: 'build',
        description: 'Build the project',
      });
    });

    it('should find exact match', () => {
      const results = helpSystem.search('test');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.command).toBe('test');
      expect(results[0]?.relevance).toBe(100);
    });

    it('should find prefix match', () => {
      const results = helpSystem.search('dep');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.command).toBe('deploy');
    });

    it('should find match in description', () => {
      const results = helpSystem.search('project');

      expect(results.length).toBeGreaterThan(0);
      const buildResult = results.find((r) => r.command === 'build');
      expect(buildResult).toBeDefined();
    });

    it('should return empty array for no matches', () => {
      const results = helpSystem.search('xyz123');

      expect(results).toHaveLength(0);
    });

    it('should sort results by relevance', () => {
      const results = helpSystem.search('test');

      for (let i = 0; i < results.length - 1; i++) {
        const current = results[i];
        const next = results[i + 1];
        if (current && next) {
          expect(current.relevance).toBeGreaterThanOrEqual(next.relevance);
        }
      }
    });
  });

  describe('getCompletions', () => {
    beforeEach(() => {
      helpSystem.register('test', {
        title: 'test',
        description: 'Test command',
      });
      helpSystem.register('testing', {
        title: 'testing',
        description: 'Testing command',
      });
      helpSystem.register('deploy', {
        title: 'deploy',
        description: 'Deploy command',
      });
    });

    it('should return completions for partial input', () => {
      const completions = helpSystem.getCompletions('tes');

      expect(completions).toContain('test');
      expect(completions).toContain('testing');
      expect(completions).not.toContain('deploy');
    });

    it('should return empty array for no matches', () => {
      const completions = helpSystem.getCompletions('xyz');

      expect(completions).toHaveLength(0);
    });

    it('should return sorted completions', () => {
      const completions = helpSystem.getCompletions('t');

      expect(completions).toEqual(['test', 'testing']);
    });
  });

  describe('generateCompletionScript', () => {
    beforeEach(() => {
      helpSystem.register('test', {
        title: 'test',
        description: 'Test command',
      });
      helpSystem.register('deploy', {
        title: 'deploy',
        description: 'Deploy command',
      });
    });

    it('should generate bash completion script', () => {
      const script = helpSystem.generateCompletionScript('bash');

      expect(script).toContain('_testapp_completions');
      expect(script).toContain('test');
      expect(script).toContain('deploy');
    });

    it('should generate zsh completion script', () => {
      const script = helpSystem.generateCompletionScript('zsh');

      expect(script).toContain('#compdef testapp');
      expect(script).toContain('test');
      expect(script).toContain('deploy');
    });

    it('should generate fish completion script', () => {
      const script = helpSystem.generateCompletionScript('fish');

      expect(script).toContain('complete -c testapp');
      expect(script).toContain('test');
      expect(script).toContain('deploy');
    });

    it('should generate powershell completion script', () => {
      const script = helpSystem.generateCompletionScript('powershell');

      expect(script).toContain('Register-ArgumentCompleter');
      expect(script).toContain('testapp');
    });

    it('should throw error for unsupported shell', () => {
      expect(() => {
        helpSystem.generateCompletionScript('unsupported' as 'bash');
      }).toThrow('Unsupported shell');
    });
  });

  describe('addCategory', () => {
    it('should add category successfully', () => {
      helpSystem.addCategory('development', 'Development commands');

      // Register a command in this category
      helpSystem.register('test', {
        title: 'test',
        description: 'Test command',
        category: 'development',
      });

      const help = helpSystem.getHelp('test');
      expect(help?.category).toBe('development');
    });
  });

  describe('getCommandNames', () => {
    it('should return all command names', () => {
      helpSystem.register('test1', {
        title: 'test1',
        description: 'Test command 1',
      });
      helpSystem.register('test2', {
        title: 'test2',
        description: 'Test command 2',
      });

      const names = helpSystem.getCommandNames();

      expect(names).toContain('test1');
      expect(names).toContain('test2');
      expect(names).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear all help content', () => {
      helpSystem.register('test1', {
        title: 'test1',
        description: 'Test command 1',
      });
      helpSystem.register('test2', {
        title: 'test2',
        description: 'Test command 2',
      });

      helpSystem.clear();

      const names = helpSystem.getCommandNames();
      expect(names).toHaveLength(0);
    });
  });

  describe('showCommandSuggestions', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      helpSystem.register('test', {
        title: 'test',
        description: 'Test command',
      });
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should show suggestions for similar commands', () => {
      helpSystem.showCommandSuggestions('tst');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('test');
    });

    it('should show message when no suggestions found', () => {
      helpSystem.showCommandSuggestions('xyz123');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.join('\n');
      expect(output).toContain('No matching commands found');
    });
  });
});
