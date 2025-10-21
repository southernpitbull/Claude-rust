import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Interface for AIrchitect configuration
 */
export interface AIrchitectConfig {
  defaultMode: 'planning' | 'work';
  defaultProvider: string;
  theme: string;
  autoCheckpoint: boolean;
  checkpointInterval: number; // in minutes
  maxCheckpoints: number;
  aiProviders: {
    [key: string]: {
      enabled: boolean;
      defaultModel?: string;
      apiKey?: string;
    };
  };
  tui: {
    showStatusBar: boolean;
    showTabBar: boolean;
    enableSyntaxHighlighting: boolean;
    maxHistory: number;
  };
  agent: {
    enableEvolution: boolean;
    enableCollaboration: boolean;
    maxParallelAgents: number;
  };
  security: {
    requireAuthForFileOps: boolean;
    enableGovernance: boolean;
    maxTokensPerRequest: number;
  };
  paths: {
    projectMemory: string;
    checkpoints: string;
    cache: string;
    logs: string;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AIrchitectConfig = {
  defaultMode: 'planning',
  defaultProvider: 'openai',
  theme: 'default',
  autoCheckpoint: true,
  checkpointInterval: 30,
  maxCheckpoints: 50,
  aiProviders: {
    openai: { enabled: true },
    anthropic: { enabled: true },
    google: { enabled: true },
    qwen: { enabled: true },
    cloudflare: { enabled: true },
    ollama: { enabled: true },
    lmstudio: { enabled: true },
    vllm: { enabled: true },
  },
  tui: {
    showStatusBar: true,
    showTabBar: false,
    enableSyntaxHighlighting: true,
    maxHistory: 100,
  },
  agent: {
    enableEvolution: true,
    enableCollaboration: true,
    maxParallelAgents: 5,
  },
  security: {
    requireAuthForFileOps: true,
    enableGovernance: true,
    maxTokensPerRequest: 4000,
  },
  paths: {
    projectMemory: './.aichitect/memory',
    checkpoints: './.aichitect/checkpoints',
    cache: './.aichitect/cache',
    logs: './.aichitect/logs',
  },
};

/**
 * Configuration manager for AIrchitect CLI
 */
export class ConfigManager {
  private config: AIrchitectConfig;
  private configPath: string;
  private configDir: string;

  constructor(configPath?: string) {
    this.configDir = configPath ? path.dirname(configPath) : this.getDefaultConfigDir();
    this.configPath = configPath || path.join(this.configDir, 'config.json');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize the config manager, loading existing config if available
   */
  public async initialize(): Promise<void> {
    await this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  public async loadConfig(): Promise<void> {
    try {
      // Create config directory if it doesn't exist
      await fs.mkdir(this.configDir, { recursive: true });

      // Check if config file exists
      try {
        await fs.access(this.configPath);
      } catch {
        // If config doesn't exist, create it with defaults
        await this.saveConfig();
        this.config = { ...DEFAULT_CONFIG };
        return;
      }

      // Read config file
      const configContent = await fs.readFile(this.configPath, 'utf8');
      const loadedConfig = JSON.parse(configContent) as AIrchitectConfig;

      // Merge with defaults to ensure all properties exist
      this.config = this.mergeConfigWithDefaults(loadedConfig);
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults:`, error);
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save current configuration to file
   */
  public async saveConfig(): Promise<void> {
    try {
      // Create config directory if it doesn't exist
      await fs.mkdir(this.configDir, { recursive: true });

      // Write config to file
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save config to ${this.configPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Merge loaded config with defaults to ensure all properties exist
   */
  private mergeConfigWithDefaults(loadedConfig: Partial<AIrchitectConfig>): AIrchitectConfig {
    const mergedConfig = { ...DEFAULT_CONFIG } as AIrchitectConfig;

    // Merge top-level properties
    for (const [key, value] of Object.entries(loadedConfig)) {
      if (value !== undefined) {
        (mergedConfig as any)[key] = value;
      }
    }

    // Merge nested objects
    if (loadedConfig.aiProviders) {
      mergedConfig.aiProviders = { ...DEFAULT_CONFIG.aiProviders, ...loadedConfig.aiProviders };
    }

    if (loadedConfig.tui) {
      mergedConfig.tui = { ...DEFAULT_CONFIG.tui, ...loadedConfig.tui };
    }

    if (loadedConfig.agent) {
      mergedConfig.agent = { ...DEFAULT_CONFIG.agent, ...loadedConfig.agent };
    }

    if (loadedConfig.security) {
      mergedConfig.security = { ...DEFAULT_CONFIG.security, ...loadedConfig.security };
    }

    if (loadedConfig.paths) {
      mergedConfig.paths = { ...DEFAULT_CONFIG.paths, ...loadedConfig.paths };
    }

    return mergedConfig;
  }

  /**
   * Get a configuration value by path (e.g. 'tui.showStatusBar')
   */
  public get<T = any>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined as T;
      }
      value = value[key];
    }

    return value as T;
  }

  /**
   * Set a configuration value by path (e.g. 'tui.showStatusBar')
   */
  public set(path: string, value: any): void {
    const keys = path.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get the entire configuration object
   */
  public getConfig(): AIrchitectConfig {
    return { ...this.config };
  }

  /**
   * Update configuration with new values
   */
  public async updateConfig(newConfig: Partial<AIrchitectConfig>): Promise<void> {
    // Merge new config with existing config
    for (const [key, value] of Object.entries(newConfig)) {
      if (value !== undefined) {
        (this.config as any)[key] = value;
      }
    }

    // Save the updated config
    await this.saveConfig();
  }

  /**
   * Reset configuration to defaults
   */
  public async resetConfig(): Promise<void> {
    this.config = { ...DEFAULT_CONFIG };
    await this.saveConfig();
  }

  /**
   * Get default configuration directory
   */
  private getDefaultConfigDir(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.aichitect');
  }

  /**
   * Get the current configuration path
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if auto-checkpointing is enabled
   */
  public isAutoCheckpointEnabled(): boolean {
    return this.config.autoCheckpoint;
  }

  /**
   * Get checkpoint interval in minutes
   */
  public getCheckpointInterval(): number {
    return this.config.checkpointInterval;
  }

  /**
   * Get maximum number of checkpoints to keep
   */
  public getMaxCheckpoints(): number {
    return this.config.maxCheckpoints;
  }

  /**
   * Get default mode
   */
  public getDefaultMode(): 'planning' | 'work' {
    return this.config.defaultMode;
  }

  /**
   * Get default AI provider
   */
  public getDefaultProvider(): string {
    return this.config.defaultProvider;
  }

  /**
   * Get current theme
   */
  public getTheme(): string {
    return this.config.theme;
  }

  /**
   * Check if a provider is enabled
   */
  public isProviderEnabled(provider: string): boolean {
    const providerConfig = this.config.aiProviders[provider];
    return providerConfig ? providerConfig.enabled : false;
  }

  /**
   * Enable or disable a provider
   */
  public async setProviderEnabled(provider: string, enabled: boolean): Promise<void> {
    if (!this.config.aiProviders[provider]) {
      this.config.aiProviders[provider] = { enabled: false };
    }
    this.config.aiProviders[provider].enabled = enabled;
    await this.saveConfig();
  }

  /**
   * Get default model for a provider
   */
  public getDefaultModel(provider: string): string | undefined {
    return this.config.aiProviders[provider]?.defaultModel;
  }

  /**
   * Set default model for a provider
   */
  public async setDefaultModel(provider: string, model: string): Promise<void> {
    if (!this.config.aiProviders[provider]) {
      this.config.aiProviders[provider] = { enabled: true };
    }
    this.config.aiProviders[provider].defaultModel = model;
    await this.saveConfig();
  }

  /**
   * Get TUI configuration
   */
  public getTUIConfig(): AIrchitectConfig['tui'] {
    return { ...this.config.tui };
  }

  /**
   * Get agent configuration
   */
  public getAgentConfig(): AIrchitectConfig['agent'] {
    return { ...this.config.agent };
  }

  /**
   * Get security configuration
   */
  public getSecurityConfig(): AIrchitectConfig['security'] {
    return { ...this.config.security };
  }

  /**
   * Get path configuration
   */
  public getPathConfig(): AIrchitectConfig['paths'] {
    return { ...this.config.paths };
  }

  /**
   * Validate the current configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate modes
    if (!['planning', 'work'].includes(this.config.defaultMode)) {
      errors.push(`Invalid default mode: ${this.config.defaultMode}`);
    }

    // Validate checkpoint interval
    if (this.config.checkpointInterval <= 0) {
      errors.push('Checkpoint interval must be greater than 0');
    }

    // Validate paths
    const requiredPaths = [
      this.config.paths.projectMemory,
      this.config.paths.checkpoints,
      this.config.paths.cache,
      this.config.paths.logs,
    ];

    for (const path of requiredPaths) {
      if (!path || path.trim() === '') {
        errors.push(`Invalid path configuration: ${path}`);
      }
    }

    // Validate max tokens
    if (this.config.security.maxTokensPerRequest <= 0) {
      errors.push('maxTokensPerRequest must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export configuration for backup purposes
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from a string
   */
  public async importConfig(configString: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configString) as AIrchitectConfig;
      this.config = this.mergeConfigWithDefaults(importedConfig);
      await this.saveConfig();
    } catch (error) {
      throw new Error(`Invalid configuration format: ${(error as Error).message}`);
    }
  }
}
