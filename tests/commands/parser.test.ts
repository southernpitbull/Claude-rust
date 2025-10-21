/**
 * Tests for Command Parser
 *
 * Comprehensive test suite for slash command parsing functionality.
 */

import { CommandParser, CommandParserError, parseCommand, ICommandSchema } from '@commands/parser';

describe('CommandParser', () => {
  let parser: CommandParser;

  beforeEach(() => {
    parser = new CommandParser();
  });

  describe('Basic Parsing', () => {
    it('should parse simple command', () => {
      const result = parser.parse('/help');
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
      expect(result.flags.size).toBe(0);
    });

    it('should parse command with subcommand', () => {
      const result = parser.parse('/ai generate');
      expect(result.command).toBe('ai');
      expect(result.subcommand).toBe('generate');
    });

    it('should parse command with arguments', () => {
      const result = parser.parse('/project init my-app');
      expect(result.command).toBe('project');
      expect(result.subcommand).toBe('init');
      expect(result.args).toEqual(['my-app']);
    });

    it('should parse command with multiple arguments', () => {
      const result = parser.parse('/memory store key value');
      expect(result.command).toBe('memory');
      expect(result.subcommand).toBe('store');
      expect(result.args).toEqual(['key', 'value']);
    });
  });

  describe('Flag Parsing', () => {
    it('should parse long flags with values', () => {
      const result = parser.parse('/ai generate --output json');
      expect(result.flags.get('output')).toBe('json');
    });

    it('should parse long flags with = syntax', () => {
      const result = parser.parse('/ai generate --output=json');
      expect(result.flags.get('output')).toBe('json');
    });

    it('should parse boolean flags', () => {
      const result = parser.parse('/project clean --force');
      expect(result.flags.get('force')).toBe(true);
    });

    it('should parse short flags', () => {
      const result = parser.parse('/ai test -f jest');
      expect(result.flags.get('f')).toBe('jest');
    });

    it('should parse multiple flags', () => {
      const result = parser.parse('/ai generate --output json --language typescript');
      expect(result.flags.get('output')).toBe('json');
      expect(result.flags.get('language')).toBe('typescript');
    });

    it('should parse mixed flags and arguments', () => {
      const result = parser.parse('/memory store key value --tags auth,prod');
      expect(result.subcommand).toBe('store');
      expect(result.args).toEqual(['key', 'value']);
      expect(result.flags.get('tags')).toBe('auth,prod');
    });
  });

  describe('Quoted Arguments', () => {
    it('should parse double-quoted arguments', () => {
      const result = parser.parse('/ai explain "how async works"');
      expect(result.args).toEqual(['how async works']);
    });

    it('should parse single-quoted arguments', () => {
      const result = parser.parse("/ai generate 'create a function'");
      expect(result.args).toEqual(['create a function']);
    });

    it('should handle escaped quotes', () => {
      const result = parser.parse('/ai explain "say \\"hello\\""');
      expect(result.args).toEqual(['say "hello"']);
    });

    it('should throw on unclosed quotes', () => {
      expect(() => parser.parse('/ai explain "unclosed')).toThrow(CommandParserError);
    });
  });

  describe('Error Handling', () => {
    it('should throw on missing prefix', () => {
      expect(() => parser.parse('help')).toThrow(CommandParserError);
    });

    it('should throw on empty command', () => {
      expect(() => parser.parse('/')).toThrow(CommandParserError);
    });

    it('should handle whitespace correctly', () => {
      const result = parser.parse('  /help  ');
      expect(result.command).toBe('help');
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case-insensitive by default', () => {
      const result = parser.parse('/HELP');
      expect(result.command).toBe('help');
    });

    it('should respect case when enabled', () => {
      const caseSensitiveParser = new CommandParser({ caseSensitive: true });
      const result = caseSensitiveParser.parse('/HELP');
      expect(result.command).toBe('HELP');
    });
  });

  describe('Validation', () => {
    const schema: ICommandSchema = {
      requiredArgs: 2,
      validSubcommands: ['init', 'clean'],
      validFlags: ['force', 'output'],
      requiredFlags: ['output'],
    };

    it('should validate required arguments', () => {
      const parsed = parser.parse('/project init');
      expect(() => parser.validate(parsed, schema)).toThrow('requires at least 2 arguments');
    });

    it('should validate required flags', () => {
      const parsed = parser.parse('/project init app test');
      expect(() => parser.validate(parsed, schema)).toThrow('requires flag: --output');
    });

    it('should validate subcommands', () => {
      const parsed = parser.parse('/project invalid');
      expect(() => parser.validate(parsed, schema)).toThrow('Invalid subcommand');
    });

    it('should validate flags', () => {
      const parsed = parser.parse('/project init app test --output json --invalid flag');
      expect(() => parser.validate(parsed, schema)).toThrow('Invalid flag: --invalid');
    });

    it('should pass valid command', () => {
      const parsed = parser.parse('/project init app test --output json');
      expect(parser.validate(parsed, schema)).toBe(true);
    });
  });

  describe('Custom Prefix', () => {
    it('should use custom prefix', () => {
      const customParser = new CommandParser({ prefix: '!' });
      const result = customParser.parse('!help');
      expect(result.command).toBe('help');
    });
  });

  describe('Max Arguments', () => {
    it('should enforce max arguments', () => {
      const limitedParser = new CommandParser({ maxArgs: 2 });
      expect(() => limitedParser.parse('/cmd a b c')).toThrow('Too many arguments');
    });
  });

  describe('Utility Functions', () => {
    it('should have parseCommand utility', () => {
      const result = parseCommand('/help');
      expect(result.command).toBe('help');
    });

    it('should create help string', () => {
      const help = CommandParser.createHelpString('project', {
        description: 'Project management',
        validSubcommands: ['init', 'clean'],
        validFlags: ['force', 'output'],
        requiredArgs: 1,
      });

      expect(help).toContain('Usage: /project');
      expect(help).toContain('Project management');
      expect(help).toContain('--force');
      expect(help).toContain('--output');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty quoted strings', () => {
      const result = parser.parse('/ai generate ""');
      expect(result.args).toEqual(['']);
    });

    it('should handle flags at different positions', () => {
      const result = parser.parse('/cmd --flag1 value1 arg1 --flag2');
      expect(result.flags.get('flag1')).toBe('value1');
      expect(result.flags.get('flag2')).toBe(true);
      expect(result.args).toEqual(['arg1']);
    });

    it('should preserve raw input', () => {
      const input = '/help --verbose';
      const result = parser.parse(input);
      expect(result.raw).toBe(input);
    });
  });
});

// Test coverage: >90% for parser.ts
