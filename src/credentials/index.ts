import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Interface for credential information
 */
export interface CredentialInfo {
  provider: string;
  key: string;
  filePath?: string;
  lastAccessed?: Date;
  isValid?: boolean;
}

/**
 * Credential discovery and management system
 */
export class CredentialManager {
  private credentials: Map<string, CredentialInfo>;
  private readonly configPaths: string[];
  private readonly supportedProviders: string[];

  constructor() {
    this.credentials = new Map();
    this.configPaths = this.getDefaultConfigPaths();
    this.supportedProviders = [
      'openai',
      'anthropic',
      'google',
      'qwen',
      'cloudflare',
      'ollama',
      'lmstudio',
      'vllm',
    ];
  }

  /**
   * Get default configuration file paths to search
   */
  private getDefaultConfigPaths(): string[] {
    const homeDir = os.homedir();
    return [
      // Standard config files in home directory
      path.join(homeDir, '.openai'),
      path.join(homeDir, '.anthropic'),
      path.join(homeDir, '.google'),
      path.join(homeDir, '.qwen'),
      path.join(homeDir, '.cloudflare'),
      path.join(homeDir, '.ollama'),
      path.join(homeDir, '.lmstudio'),
      path.join(homeDir, '.aichitect'),

      // Environment-specific files
      path.join(homeDir, '.config', 'aichitect', 'credentials'),
      path.join(homeDir, '.aichitect', 'config'),

      // Current working directory
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), 'config.json'),
      path.join(process.cwd(), '.aichitect'),

      // Additional common locations
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.zshrc'),
      path.join(homeDir, '.bash_profile'),
      path.join(homeDir, '.profile'),
    ];
  }

  /**
   * Discover credentials automatically from common locations
   */
  public async discoverCredentials(): Promise<CredentialInfo[]> {
    const discoveredCredentials: CredentialInfo[] = [];

    // Check environment variables first
    const envCreds = await this.discoverFromEnvironment();
    for (const cred of envCreds) {
      discoveredCredentials.push(cred);
      this.credentials.set(cred.provider, cred);
    }

    // Check config files
    for (const configPath of this.configPaths) {
      try {
        if (await this.fileExists(configPath)) {
          const creds = await this.discoverFromFile(configPath);
          for (const cred of creds) {
            // Only add if not already discovered from environment
            if (!this.credentials.has(cred.provider)) {
              discoveredCredentials.push(cred);
              this.credentials.set(cred.provider, cred);
            }
          }
        }
      } catch (error) {
        // Continue to next file if one fails
        console.debug(`Failed to read config file ${configPath}:`, error);
      }
    }

    return discoveredCredentials;
  }

  /**
   * Discover credentials from environment variables
   */
  private async discoverFromEnvironment(): Promise<CredentialInfo[]> {
    const credentials: CredentialInfo[] = [];

    // Check for common environment variables
    const envVars = {
      OPENAI_API_KEY: 'openai',
      ANTHROPIC_API_KEY: 'anthropic',
      GOOGLE_API_KEY: 'google',
      QWEN_API_KEY: 'qwen',
      CLOUDFLARE_API_TOKEN: 'cloudflare',
      OLLAMA_HOST: 'ollama',
      LMSTUDIO_HOST: 'lmstudio',
    };

    for (const [envVar, provider] of Object.entries(envVars)) {
      const value = process.env[envVar];
      if (value && value.trim() !== '') {
        credentials.push({
          provider,
          key: value.trim(),
          filePath: 'ENVIRONMENT',
          lastAccessed: new Date(),
          isValid: true,
        });
      }
    }

    return credentials;
  }

  /**
   * Discover credentials from a file
   */
  private async discoverFromFile(filePath: string): Promise<CredentialInfo[]> {
    const credentials: CredentialInfo[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Parse different file formats
      if (filePath.endsWith('.json')) {
        const config = JSON.parse(content);
        for (const [provider, key] of Object.entries(config)) {
          if (typeof key === 'string' && key.trim() !== '') {
            credentials.push({
              provider,
              key,
              filePath,
              lastAccessed: new Date(),
              isValid: true,
            });
          }
        }
      } else if (
        filePath.endsWith('.env') ||
        filePath.includes('.bashrc') ||
        filePath.includes('.zshrc')
      ) {
        // Parse .env or shell config files
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, value] = trimmedLine.split('=');
            if (key && value) {
              const provider = this.identifyProviderFromEnvVar(key.trim());
              if (provider) {
                credentials.push({
                  provider,
                  key: value.trim().replace(/^["']|["']$/g, ''), // Remove quotes
                  filePath,
                  lastAccessed: new Date(),
                  isValid: true,
                });
              }
            }
          }
        }
      } else {
        // Try to parse as a simple key-value file
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine && !trimmedLine.startsWith('#')) {
            const [key, value] = trimmedLine.split('=');
            if (key && value) {
              const provider = key.trim().toLowerCase();
              if (this.supportedProviders.includes(provider)) {
                credentials.push({
                  provider,
                  key: value.trim().replace(/^["']|["']$/g, ''), // Remove quotes
                  filePath,
                  lastAccessed: new Date(),
                  isValid: true,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to parse credentials from ${filePath}:`, error);
    }

    return credentials;
  }

  /**
   * Identify provider from environment variable name
   */
  private identifyProviderFromEnvVar(envVar: string): string | null {
    const lowerEnvVar = envVar.toLowerCase();

    if (lowerEnvVar.includes('openai')) {
      return 'openai';
    }
    if (lowerEnvVar.includes('anthropic')) {
      return 'anthropic';
    }
    if (lowerEnvVar.includes('google')) {
      return 'google';
    }
    if (lowerEnvVar.includes('qwen')) {
      return 'qwen';
    }
    if (lowerEnvVar.includes('cloudflare')) {
      return 'cloudflare';
    }
    if (lowerEnvVar.includes('ollama')) {
      return 'ollama';
    }
    if (lowerEnvVar.includes('lmstudio')) {
      return 'lmstudio';
    }

    return null;
  }

  /**
   * Validate a credential
   */
  public async validateCredential(provider: string, key: string): Promise<boolean> {
    // In a real implementation, this would test the credential with the provider
    // For now, we'll just check if the key is not empty
    return key.trim() !== '';
  }

  /**
   * Get a credential
   */
  public getCredential(provider: string): CredentialInfo | undefined {
    return this.credentials.get(provider);
  }

  /**
   * Get all credentials
   */
  public getAllCredentials(): CredentialInfo[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Remove a credential
   */
  public removeCredential(provider: string): boolean {
    return this.credentials.delete(provider);
  }

  /**
   * Clear all credentials
   */
  public clearCredentials(): void {
    this.credentials.clear();
  }

  /**
   * Get credential count
   */
  public getCredentialCount(): number {
    return this.credentials.size;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get credential status for all providers
   */
  public getProviderStatus(): Array<{
    provider: string;
    hasCredential: boolean;
    isValid: boolean;
  }> {
    return this.supportedProviders.map((provider) => {
      const credential = this.credentials.get(provider);
      return {
        provider,
        hasCredential: !!credential,
        isValid: credential ? credential.isValid || false : false,
      };
    });
  }

  /**
   * Store a new credential
   */
  public async storeCredential(provider: string, key: string): Promise<boolean> {
    try {
      const isValid = await this.validateCredential(provider, key);

      const credential: CredentialInfo = {
        provider,
        key,
        filePath: path.join(os.homedir(), `.aichitect/credentials/${provider}`),
        lastAccessed: new Date(),
        isValid,
      };

      this.credentials.set(provider, credential);
      return true;
    } catch (error) {
      console.error(`Failed to store credential for ${provider}:`, error);
      return false;
    }
  }
}
