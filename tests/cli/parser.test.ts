/**
 * parser.test.ts
 *
 * Comprehensive tests for the CLIParser
 */

import { CLIParser, ArgumentType } from '../../src/cli/parser';
import { CLIError } from '../../src/cli/ErrorHandler';

describe('CLIParser', () => {
  let parser: CLIParser;

  beforeEach(() => {
    parser = new CLIParser();
  });

  describe('parse', () => {
    it('should parse command name', () => {
      const result = parser.parse(['chat']);
      expect(result.command).toBe('chat');
    });

    it('should parse command and subcommand', () => {
      const result = parser.parse(['memory', 'list']);
      expect(result.command).toBe('memory');
      expect(result.subcommand).toBe('list');
    });

    it('should parse options with values', () => {
      parser.defineOption({
        name: 'provider',
        type: ArgumentType.STRING,
      });

      const result = parser.parse(['chat', '--provider', 'openai']);
      expect(result.options.provider).toBe('openai');
    });

    it('should parse options with equals syntax', () => {
      parser.defineOption({
        name: 'provider',
        type: ArgumentType.STRING,
      });

      const result = parser.parse(['chat', '--provider=openai']);
      expect(result.options.provider).toBe('openai');
    });

    it('should parse boolean flags', () => {
      parser.defineOption({
        name: 'verbose',
        type: ArgumentType.BOOLEAN,
      });

      const result = parser.parse(['chat', '--verbose']);
      expect(result.flags.has('verbose')).toBe(true);
    });

    it('should parse shorthand options', () => {
      parser.defineOption({
        name: 'verbose',
        alias: 'v',
        type: ArgumentType.BOOLEAN,
      });

      const result = parser.parse(['chat', '-v']);
      expect(result.flags.has('v')).toBe(true);
    });

    it('should parse positional arguments', () => {
      parser.defineArgument({
        name: 'message',
        type: ArgumentType.STRING,
      });

      const result = parser.parse(['hello']);
      expect(result.args.message).toBe('hello');
    });

    it('should parse multiple arguments', () => {
      parser.defineArguments([
        { name: 'action', type: ArgumentType.STRING },
        { name: 'target', type: ArgumentType.STRING },
      ]);

      const result = parser.parse(['create', 'file.txt']);
      expect(result.args.action).toBe('create');
      expect(result.args.target).toBe('file.txt');
    });

    it('should parse number options', () => {
      parser.defineOption({
        name: 'port',
        type: ArgumentType.NUMBER,
      });

      const result = parser.parse(['serve', '--port', '3000']);
      expect(result.options.port).toBe(3000);
    });

    it('should parse array options', () => {
      parser.defineOption({
        name: 'tags',
        type: ArgumentType.ARRAY,
      });

      const result = parser.parse(['tag', '--tags', 'a,b,c']);
      expect(result.options.tags).toEqual(['a', 'b', 'c']);
    });

    it('should parse JSON options', () => {
      parser.defineOption({
        name: 'config',
        type: ArgumentType.JSON,
      });

      const result = parser.parse(['setup', '--config', '{"key":"value"}']);
      expect(result.options.config).toEqual({ key: 'value' });
    });
  });

  describe('validation', () => {
    it('should validate required arguments', () => {
      parser.defineArgument({
        name: 'required',
        type: ArgumentType.STRING,
        required: true,
      });

      expect(() => parser.parse(['command'])).toThrow(CLIError);
    });

    it('should validate required options', () => {
      parser.defineOption({
        name: 'required',
        type: ArgumentType.STRING,
        required: true,
      });

      expect(() => parser.parse(['command'])).toThrow(CLIError);
    });

    it('should validate option choices', () => {
      parser.defineOption({
        name: 'level',
        type: ArgumentType.STRING,
        choices: ['low', 'medium', 'high'],
      });

      expect(() => parser.parse(['command', '--level', 'invalid'])).toThrow(CLIError);
    });

    it('should accept valid choices', () => {
      parser.defineOption({
        name: 'level',
        type: ArgumentType.STRING,
        choices: ['low', 'medium', 'high'],
      });

      const result = parser.parse(['command', '--level', 'medium']);
      expect(result.options.level).toBe('medium');
    });

    it('should run custom validators', () => {
      parser.defineOption({
        name: 'email',
        type: ArgumentType.STRING,
        validator: (value) => {
          const email = String(value);
          return email.includes('@') || 'Invalid email format';
        },
      });

      expect(() => parser.parse(['command', '--email', 'invalid'])).toThrow(CLIError);
    });

    it('should pass custom validators', () => {
      parser.defineOption({
        name: 'email',
        type: ArgumentType.STRING,
        validator: (value) => {
          const email = String(value);
          return email.includes('@') || 'Invalid email format';
        },
      });

      const result = parser.parse(['command', '--email', 'test@example.com']);
      expect(result.options.email).toBe('test@example.com');
    });

    it('should throw on invalid number', () => {
      parser.defineOption({
        name: 'port',
        type: ArgumentType.NUMBER,
      });

      expect(() => parser.parse(['command', '--port', 'abc'])).toThrow(CLIError);
    });

    it('should throw on invalid JSON', () => {
      parser.defineOption({
        name: 'config',
        type: ArgumentType.JSON,
      });

      expect(() => parser.parse(['command', '--config', '{invalid'])).toThrow(CLIError);
    });
  });

  describe('defaults', () => {
    it('should apply default values to options', () => {
      parser.defineOption({
        name: 'provider',
        type: ArgumentType.STRING,
        defaultValue: 'openai',
      });

      const result = parser.parse(['chat']);
      expect(result.options.provider).toBe('openai');
    });

    it('should apply default values to arguments', () => {
      parser.defineArgument({
        name: 'message',
        type: ArgumentType.STRING,
        defaultValue: 'hello',
      });

      const result = parser.parse(['chat']);
      expect(result.args.message).toBe('hello');
    });

    it('should not override provided values with defaults', () => {
      parser.defineOption({
        name: 'provider',
        type: ArgumentType.STRING,
        defaultValue: 'openai',
      });

      const result = parser.parse(['chat', '--provider', 'anthropic']);
      expect(result.options.provider).toBe('anthropic');
    });
  });

  describe('getHelpText', () => {
    it('should generate help text for arguments', () => {
      parser.defineArgument({
        name: 'file',
        type: ArgumentType.STRING,
        description: 'File to process',
        required: true,
      });

      const help = parser.getHelpText();
      expect(help).toContain('file');
      expect(help).toContain('File to process');
      expect(help).toContain('required');
    });

    it('should generate help text for options', () => {
      parser.defineOption({
        name: 'provider',
        alias: 'p',
        type: ArgumentType.STRING,
        description: 'AI provider',
        defaultValue: 'openai',
      });

      const help = parser.getHelpText();
      expect(help).toContain('provider');
      expect(help).toContain('AI provider');
      expect(help).toContain('default: openai');
    });
  });

  describe('clear', () => {
    it('should clear all definitions', () => {
      parser.defineArgument({ name: 'arg', type: ArgumentType.STRING });
      parser.defineOption({ name: 'opt', type: ArgumentType.STRING });

      parser.clear();

      const help = parser.getHelpText();
      expect(help).toBe('');
    });
  });
});
