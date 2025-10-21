import defaultConfig, { AICliConfig } from '../../ai-cli.config';
import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

/**
 * Configuration Manager for AIrchitect CLI
 */
export class ConfigManager {
  private config: AICliConfig;
  private readonly configPath: string;
  private readonly configFileNames = [
    'aichitect.config.json',
    'ai-cli.config.ts',
    'ai-cli.config.js',
    '.aichitectrc',
    '.ai-clirc',
  ];

  constructor() {
    this.configPath = this.getConfigPath();
    this.config = { ...defaultConfig };
  }

  /**
   * Initialize configuration by loading from file system
   */
  async initialize(): Promise<void> {
    // First try to load from the default config file
    const loadedConfig = await this.loadConfigFromFile();

    if (loadedConfig) {
      this.config = { ...defaultConfig, ...loadedConfig };
      console.log('Configuration loaded from file system');
    } else {
      console.log('Using default configuration');
    }

    // Override with environment variables
    this.loadFromEnvironment();
  }

  /**
   * Get current configuration
   */
  getConfig(): AICliConfig {
    return this.config;
  }

  /**
   * Update configuration with new values
   */
  updateConfig(newConfig: Partial<AICliConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Update a specific provider configuration
   */
  updateProviderConfig(provider: string, config: any): void {
    if (!this.config.providers[provider]) {
      this.config.providers[provider] = { enabled: false };
    }

    if (typeof this.config.providers[provider] !== 'string') {
      this.config.providers[provider] = {
        ...this.config.providers[provider],
        ...config,
      };
    }
  }

  /**
   * Get a specific provider's configuration
   */
  getProviderConfig(provider: string) {
    return this.config.providers[provider];
  }

  /**
   * Save configuration to file
   */
  async saveConfig(): Promise<void> {
    try {
      // Ensure config directory exists
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      // Write config to file (JSON format)
      const configToSave = { ...this.config };

      // Remove the index signature for JSON serialization
      const providers = { ...configToSave.providers };
      delete (configToSave as any)['provider'];
      configToSave.providers = providers;

      await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
      console.log(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      console.error('Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Get the active configuration path
   */
  getConfigPath(): string {
    // Check for config in current project directory first
    const projectConfig = path.join(process.cwd(), 'aichitect.config.json');

    // Check if it exists
    try {
      fs.accessSync(projectConfig);
      return projectConfig;
    } catch {
      // If not in project, check home directory
      const homeConfig = path.join(homedir(), '.aichitect', 'config.json');
      return homeConfig;
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(): Promise<AICliConfig | null> {
    try {
      // Try to find a config file in the standard locations
      const configFile = await this.findConfigFile();

      if (!configFile) {
        return null;
      }

      const configContent = await fs.readFile(configFile, 'utf8');

      // Try parsing as JSON first, then as JS/TS
      try {
        const config = JSON.parse(configContent) as AICliConfig;
        return config;
      } catch {
        // If JSON parsing fails, this might be a JS/TS file
        // For now, we'll log this and return null
        console.warn(
          `Config file ${configFile} is not valid JSON. JS/TS config loading not implemented yet.`
        );
        return null;
      }
    } catch (error) {
      console.warn('Could not load configuration file:', error);
      return null;
    }
  }

  /**
   * Find a configuration file in standard locations
   */
  private async findConfigFile(): Promise<string | null> {
    // First check the current working directory
    for (const configName of this.configFileNames) {
      const projectConfig = path.join(process.cwd(), configName);
      try {
        await fs.access(projectConfig);
        return projectConfig;
      } catch {
        // File doesn't exist, continue to next
      }
    }

    // Check the home directory
    const homeDir = homedir();
    for (const configName of this.configFileNames) {
      const homeConfig = path.join(homeDir, configName);
      try {
        await fs.access(homeConfig);
        return homeConfig;
      } catch {
        // File doesn't exist, continue to next
      }
    }

    // Check the .aichitect directory in home
    const aichitectDirConfig = path.join(homeDir, '.aichitect', 'config.json');
    try {
      await fs.access(aichitectDirConfig);
      return aichitectDirConfig;
    } catch {
      // File doesn't exist
    }

    return null;
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Load core configuration from environment
    const envLogLevel = process.env.AI_CLI_LOG_LEVEL;
    if (envLogLevel && ['trace', 'debug', 'info', 'warn', 'error'].includes(envLogLevel)) {
      this.config.core.rust.logLevel = envLogLevel as any;
    }

    // Load provider API keys from environment
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      this.updateProviderConfig('openai', { apiKey: openaiApiKey });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      this.updateProviderConfig('anthropic', { apiKey: anthropicApiKey });
    }

    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    if (googleApiKey) {
      this.updateProviderConfig('google', { apiKey: googleApiKey });
    }

    const qwenApiKey = process.env.QWEN_API_KEY;
    if (qwenApiKey) {
      this.updateProviderConfig('qwen', { apiKey: qwenApiKey });
    }

    // Load other environment variables
    const configDebug = process.env.AI_CLI_DEBUG;
    if (configDebug) {
      this.config.core.rust.logLevel = 'debug';
    }
  }

  /**
   * Validate the current configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate provider configurations
    for (const [providerName, providerConfig] of Object.entries(this.config.providers)) {
      if (providerName === 'default') {
        continue;
      } // Skip the default provider property

      if (typeof providerConfig !== 'string' && providerConfig.enabled) {
        // Check if required fields are present for enabled providers
        if (!providerConfig.apiKey && providerConfig.enabled) {
          errors.push(`Provider ${providerName} is enabled but no apiKey is configured`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
