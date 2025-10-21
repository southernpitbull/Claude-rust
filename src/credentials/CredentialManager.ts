import type { AICliConfig } from '../../ai-cli.config';
import { SecureCredentialStorage } from './storage.js';
import { CredentialDiscovery } from './discovery.js';
import { Logger } from '../logging/Logger.js';

export interface CredentialInfo {
  provider: string;
  key: string;
  lastAccessed?: string;
  isValid?: boolean;
  source?: 'env' | 'config' | 'storage' | 'discovered';
}

export class CredentialManager {
  private config: AICliConfig;
  private secureStorage: SecureCredentialStorage;
  private discovery: CredentialDiscovery;
  private logger: Logger;

  constructor(config: AICliConfig) {
    this.config = config;
    this.discovery = new CredentialDiscovery(undefined, this);
    this.secureStorage = new SecureCredentialStorage(this);
    this.logger = new Logger('CredentialManager', 'SYSTEM');
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing credential manager');

    // Initialize secure storage
    await this.secureStorage.initialize();

    // Initialize discovery system
    await this.discovery.initialize();

    this.logger.info('Credential manager initialized successfully');
  }

  async discoverAll(): Promise<void> {
    this.logger.info('Discovering credentials from all sources...');

    try {
      // Discover credentials from various sources
      const discoveredCredentials = await this.discovery.discoverAll();

      // Store discovered credentials securely
      for (const [provider, credential] of Object.entries(discoveredCredentials)) {
        await this.secureStorage.storeCredential(provider, credential.key);
        this.logger.info(`Discovered and stored credential for ${provider}`, {
          source: credential.source,
        });
      }

      this.logger.info(`Discovered ${Object.keys(discoveredCredentials).length} credentials`);
    } catch (error) {
      this.logger.error('Failed to discover credentials', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async loadCredentials(): Promise<void> {
    this.logger.info('Loading credentials from all sources...');

    // Load from secure storage
    const storedProviders = await this.secureStorage.listStoredProviders();
    this.logger.info(`Found ${storedProviders.length} stored credentials`);

    // Load from config as fallback
    const configCredentials = this.loadFromConfig();
    this.logger.info(`Found ${configCredentials.length} config credentials`);

    // Load from environment as highest priority
    const envCredentials = this.loadFromEnvironment();
    this.logger.info(`Found ${envCredentials.length} environment credentials`);
  }

  private loadFromConfig(): string[] {
    const loaded: string[] = [];

    // Load from provider configs
    for (const [providerName, providerConfig] of Object.entries(this.config.providers)) {
      if (providerName === 'default') {
        continue;
      }

      if (typeof providerConfig !== 'string' && providerConfig.apiKey) {
        // Store config-based credentials in secure storage for consistency
        // This ensures they're encrypted if the storage is encrypted
        this.secureStorage.storeCredential(providerName, providerConfig.apiKey);
        loaded.push(providerName);
      }
    }

    return loaded;
  }

  private loadFromEnvironment(): string[] {
    const loaded: string[] = [];

    // Load from environment variables
    const envCredentials: [string, string | undefined][] = [
      ['openai', process.env.OPENAI_API_KEY],
      ['anthropic', process.env.ANTHROPIC_API_KEY],
      ['google', process.env.GOOGLE_AI_API_KEY],
      ['qwen', process.env.QWEN_API_KEY],
      ['cloudflare', process.env.CLOUDFLARE_API_KEY],
      ['ollama', process.env.OLLAMA_API_KEY],
    ];

    for (const [provider, key] of envCredentials) {
      if (key) {
        // Store environment-based credentials in secure storage for consistency
        this.secureStorage.storeCredential(provider, key);
        loaded.push(provider);
      }
    }

    return loaded;
  }

  async getCredential(provider: string): Promise<string | null> {
    this.logger.info(`Retrieving credential for ${provider}`);

    // First try to get from secure storage
    const credential = await this.secureStorage.retrieveCredential(provider);

    if (credential) {
      this.logger.info(`Found credential for ${provider} in secure storage`);
      return credential;
    }

    // Fallback: check config
    if (this.config.providers[provider] && typeof this.config.providers[provider] !== 'string') {
      const configCredential = (this.config.providers[provider] as any).apiKey;
      if (configCredential) {
        this.logger.info(`Found credential for ${provider} in config`);
        return configCredential;
      }
    }

    // Fallback: check environment
    const envCredential = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (envCredential) {
      this.logger.info(`Found credential for ${provider} in environment`);
      return envCredential;
    }

    this.logger.warn(`No credential found for ${provider}`);
    return null;
  }

  async setCredential(provider: string, key: string): Promise<boolean> {
    this.logger.info(`Setting credential for ${provider}`);

    try {
      const success = await this.secureStorage.storeCredential(provider, key);

      if (success) {
        this.logger.info(`Successfully stored credential for ${provider}`);

        // Update provider config to reflect the new credential
        this.config.providers[provider as keyof AICliConfig['providers']] = {
          enabled: true,
          apiKey: key,
          ...((this.config.providers[provider as keyof AICliConfig['providers']] || {}) as any),
        };
      } else {
        this.logger.error(`Failed to store credential for ${provider}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error setting credential for ${provider}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async hasCredential(provider: string): Promise<boolean> {
    const credential = await this.getCredential(provider);
    return credential !== null;
  }

  async deleteCredential(provider: string): Promise<boolean> {
    this.logger.info(`Deleting credential for ${provider}`);

    try {
      const success = await this.secureStorage.deleteCredential(provider);

      if (success) {
        this.logger.info(`Successfully deleted credential for ${provider}`);
      } else {
        this.logger.warn(`No credential found to delete for ${provider}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error deleting credential for ${provider}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async listCredentials(): Promise<string[]> {
    this.logger.info('Listing all available credential providers');

    // Get providers from secure storage
    const storedProviders = await this.secureStorage.listStoredProviders();

    // Get providers from config
    const configProviders = Object.keys(this.config.providers).filter(
      (key) =>
        key !== 'default' &&
        typeof this.config.providers[key as keyof AICliConfig['providers']] !== 'string' &&
        (this.config.providers[key as keyof AICliConfig['providers']] as any).apiKey
    );

    // Get providers with environment variables
    const envProviders = ['openai', 'anthropic', 'google', 'qwen', 'cloudflare', 'ollama'].filter(
      (provider) => process.env[`${provider.toUpperCase()}_API_KEY`]
    );

    // Combine all providers, removing duplicates
    const allProviders = Array.from(
      new Set([...storedProviders, ...configProviders, ...envProviders])
    );

    return allProviders;
  }

  async testCredential(provider: string): Promise<boolean> {
    this.logger.info(`Testing credential for ${provider}`);

    try {
      const credential = await this.getCredential(provider);
      if (!credential) {
        this.logger.warn(`No credential available for ${provider}`);
        return false;
      }

      // In a full implementation, this would make a test API call
      // For now, just validate that the credential isn't obviously invalid
      if (credential.length < 10) {
        this.logger.warn(`Credential for ${provider} appears to be invalid (too short)`);
        return false;
      }

      this.logger.info(`Credential for ${provider} appears valid`);
      return true;
    } catch (error) {
      this.logger.error(`Error testing credential for ${provider}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getStats(): Promise<{
    total: number;
    secureStorage: number;
    fromConfig: number;
    fromEnvironment: number;
  }> {
    const storedProviders = await this.secureStorage.listStoredProviders();
    const configProviders = Object.keys(this.config.providers).filter(
      (key) =>
        key !== 'default' &&
        typeof this.config.providers[key as keyof AICliConfig['providers']] !== 'string' &&
        (this.config.providers[key as keyof AICliConfig['providers']] as any).apiKey
    );
    const envProviders = ['openai', 'anthropic', 'google', 'qwen', 'cloudflare', 'ollama'].filter(
      (provider) => process.env[`${provider.toUpperCase()}_API_KEY`]
    );

    return {
      total: new Set([...storedProviders, ...configProviders, ...envProviders]).size,
      secureStorage: storedProviders.length,
      fromConfig: configProviders.length,
      fromEnvironment: envProviders.length,
    };
  }
}
