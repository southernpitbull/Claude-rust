/**
 * ConfigCommand.ts
 *
 * Implements the 'config' command for managing AIrchitect configuration.
 * Handles getting, setting, and listing configuration values.
 */

import { Command } from '../core/cli/Command';
import { ValidationService } from '../core/cli/ValidationService';
import { ConfigManager } from '../config/ConfigManager';
import { Logger } from '../utils/Logger';

export class ConfigCommand extends Command {
  public name = 'config';
  public description = 'Manage AIrchitect configuration';

  public arguments = [
    {
      name: 'action',
      description: 'Configuration action (get, set, list)',
      required: true,
    },
    {
      name: 'key',
      description: 'Configuration key (for get/set actions)',
      required: false,
    },
    {
      name: 'value',
      description: 'Configuration value (for set action)',
      required: false,
    },
  ];

  public options = [
    {
      flags: '-g, --global',
      description: 'Use global configuration',
      required: false,
    },
    {
      flags: '-l, --local',
      description: 'Use local configuration (default)',
      required: false,
    },
    {
      flags: '-j, --json',
      description: 'Output in JSON format',
      required: false,
    },
  ];

  private validationService: ValidationService;
  private configManager: ConfigManager;
  private logger: Logger;

  constructor() {
    super();
    this.validationService = new ValidationService();
    this.configManager = new ConfigManager();
    this.logger = new Logger('info');
  }

  public async execute(...args: any[]): Promise<void> {
    // Extract arguments and options
    const options: any = args[args.length - 1] || {};
    const action = this.getArg(args, 0) || 'list';
    const key = this.getArg(args, 1);
    const value = this.getArg(args, 2);

    const isGlobal = options.global || false;
    const isJson = options.json || false;

    // Pre-execute validation
    if (this.preExecute) {
      await this.preExecute();
    }

    try {
      switch (action.toLowerCase()) {
        case 'get':
          await this.getConfig(key, isGlobal, isJson);
          break;
        case 'set':
          if (!key || !value) {
            throw new Error('Key and value are required for set action');
          }
          await this.setConfig(key, value, isGlobal);
          break;
        case 'list':
          await this.listConfig(isGlobal, isJson);
          break;
        default:
          throw new Error(`Unknown config action: ${action}. Use get, set, or list.`);
      }

      // Post-execute actions
      if (this.postExecute) {
        await this.postExecute();
      }
    } catch (error) {
      this.logger.error('Config command failed:', error);
      throw error;
    }
  }

  public getHelp(): string {
    return `
The config command manages AIrchitect configuration settings.

Actions:
  get <key>     - Get a configuration value
  set <key> <value> - Set a configuration value
  list          - List all configuration values

Examples:
  airchitect config list                    # List all configuration
  airchitect config get ai.defaultProvider # Get a specific value
  airchitect config set ai.defaultProvider anthropic # Set a value
  airchitect config list --json            # Output as JSON
  airchitect config get ai --global        # Get from global config
    `;
  }

  /**
   * Validate command arguments
   * @param args - Arguments passed to the command
   * @returns Boolean indicating if arguments are valid
   */
  public validate(...args: any[]): boolean {
    const action = this.getArg(args, 0);

    if (!action) {
      console.error('Config action is required (get, set, list)');
      return false;
    }

    const validActions = ['get', 'set', 'list'];
    if (!validActions.includes(action.toLowerCase())) {
      console.error(`Invalid config action: ${action}. Use get, set, or list.`);
      return false;
    }

    if (action.toLowerCase() === 'set') {
      const key = this.getArg(args, 1);
      const value = this.getArg(args, 2);

      if (!key) {
        console.error('Key is required for set action');
        return false;
      }

      if (!value && value !== '') {
        console.error('Value is required for set action');
        return false;
      }
    }

    return true;
  }

  private async getConfig(
    key: string | undefined,
    isGlobal: boolean,
    isJson: boolean
  ): Promise<void> {
    if (!key) {
      console.error('Key is required for get action');
      return;
    }

    try {
      const config = await this.configManager.load(isGlobal);
      const keys = key.split('.');
      let value: any = config;

      for (const k of keys) {
        if (value && typeof value === 'object') {
          value = value[k];
        } else {
          value = undefined;
          break;
        }
      }

      if (value === undefined) {
        console.log(`Configuration key "${key}" not found`);
        return;
      }

      if (isJson) {
        console.log(JSON.stringify({ [key]: value }, null, 2));
      } else {
        console.log(`${key}=${value}`);
      }
    } catch (error) {
      this.logger.error(`Failed to get config value for key "${key}":`, error);
      throw error;
    }
  }

  private async setConfig(key: string, value: string, isGlobal: boolean): Promise<void> {
    try {
      // Parse the value based on its content
      let parsedValue: any = value;

      // Try to parse as JSON if it looks like it might be
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          parsedValue = JSON.parse(value);
        } catch (e) {
          // If parsing fails, keep it as a string
          parsedValue = value;
        }
      } else if (value.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (value.toLowerCase() === 'false') {
        parsedValue = false;
      } else if (/^-?\d+$/.test(value)) {
        parsedValue = parseInt(value, 10);
      } else if (/^-?\d*\.\d+$/.test(value)) {
        parsedValue = parseFloat(value);
      }

      await this.configManager.update(key, parsedValue, isGlobal);
      console.log(`Configuration updated: ${key}=${parsedValue}`);
    } catch (error) {
      this.logger.error(`Failed to set config value for key "${key}":`, error);
      throw error;
    }
  }

  private async listConfig(isGlobal: boolean, isJson: boolean): Promise<void> {
    try {
      const config = await this.configManager.load(isGlobal);

      if (isJson) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        // Format as key=value pairs
        this.printConfig(config, '');
      }
    } catch (error) {
      this.logger.error('Failed to list configuration:', error);
      throw error;
    }
  }

  private printConfig(config: any, prefix: string = ''): void {
    for (const [key, value] of Object.entries(config)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.printConfig(value, fullKey);
      } else {
        console.log(`${fullKey}=${value}`);
      }
    }
  }
}
