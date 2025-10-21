import { CredentialDiscovery, DiscoveredCredential } from './discovery';
import { CredentialStore } from './store';
import { CredentialConfig } from './types';

/**
 * Credential Manager - Main interface for credential management
 */
export class CredentialManager {
  private discovery: CredentialDiscovery;
  private store: CredentialStore;
  private config: CredentialConfig;

  constructor(config?: CredentialConfig) {
    this.config = config || {};
    this.discovery = new CredentialDiscovery();
    this.store = new CredentialStore();
  }

  /**
   * Initialize the credential manager
   */
  public async initialize(): Promise<boolean> {
    try {
      // Initialize the store
      await this.store.initialize();

      // Load configuration
      await this.loadConfiguration();

      return true;
    } catch (error) {
      console.error('Failed to initialize credential manager:', error);
      return false;
    }
  }

  /**
   * Load configuration from file or environment
   */
  private async loadConfiguration(): Promise<void> {
    // In a real implementation, this would load from config files
    // For now, we'll use the provided config or defaults
    console.log('Loading credential configuration...');
  }

  /**
   * Discover all available credentials
   */
  public async discoverAll(): Promise<boolean> {
    try {
      // Discover credentials
      const discovered = await this.discovery.discoverAll();

      // Store valid credentials
      let storedCount = 0;
      for (const cred of discovered) {
        if (cred.isValid) {
          const success = await this.store.storeCredential(cred.provider, cred.key);
          if (success) {
            storedCount++;
          }
        }
      }

      console.log(`Discovered and stored ${storedCount} valid credentials`);
      return true;
    } catch (error) {
      console.error('Failed to discover and store credentials:', error);
      return false;
    }
  }

  /**
   * Discover and store credentials automatically
   */
  public async discoverAndStoreCredentials(): Promise<boolean> {
    return await this.discoverAll();
  }

  /**
   * Get a credential for a specific provider
   */
  public async getCredential(provider: string): Promise<string | null> {
    // First, check the store
    let credential = await this.store.retrieveCredential(provider);

    // If not found in store, try to discover it
    if (!credential) {
      const discovered = await this.discovery.discoverAll();
      const found = discovered.find((cred) => cred.provider === provider && cred.isValid);
      if (found) {
        credential = found.key;
        // Store it for future use
        await this.store.storeCredential(provider, credential);
      }
    }

    return credential;
  }

  /**
   * Set a credential for a specific provider
   */
  public async setCredential(provider: string, key: string): Promise<boolean> {
    return await this.store.storeCredential(provider, key);
  }

  /**
   * Remove a credential for a specific provider
   */
  public async removeCredential(provider: string): Promise<boolean> {
    return await this.store.removeCredential(provider);
  }

  /**
   * List all available providers with credential status
   */
  public async getProviderStatus(): Promise<
    Array<{
      provider: string;
      hasCredential: boolean;
      isValid: boolean;
      lastChecked?: Date;
    }>
  > {
    // Get stored credentials
    const storedProviders = this.store.listProviders();

    // Get discovered credentials
    const discovered = await this.discovery.discoverAll();

    // Combine information
    const allProviders = new Set([
      ...storedProviders,
      ...discovered.map((d) => d.provider),
      ...Object.keys(this.config),
    ]);

    const status: Array<{
      provider: string;
      hasCredential: boolean;
      isValid: boolean;
      lastChecked?: Date;
    }> = [];

    for (const provider of allProviders) {
      const stored = storedProviders.includes(provider);
      const discoveredCred = discovered.find((d) => d.provider === provider);

      status.push({
        provider,
        hasCredential: stored || !!discoveredCred,
        isValid: stored || (discoveredCred ? discoveredCred.isValid : false),
        lastChecked: discoveredCred ? discoveredCred.lastChecked : undefined,
      });
    }

    return status;
  }

  /**
   * Validate all stored credentials
   */
  public async validateAllCredentials(): Promise<{
    valid: number;
    invalid: number;
    expired: number;
  }> {
    return await this.store.validateAllCredentials();
  }

  /**
   * Rotate a credential (update with new key)
   */
  public async rotateCredential(provider: string, newKey: string): Promise<boolean> {
    return await this.store.rotateCredential(provider, newKey);
  }

  /**
   * Get credential store statistics
   */
  public getStoreStats(): {
    totalCredentials: number;
    encryptedCredentials: number;
    expiredCredentials: number;
    providers: string[];
  } {
    return this.store.getStats();
  }

  /**
   * Export credentials to a file
   */
  public async exportCredentials(filePath: string): Promise<boolean> {
    return await this.store.exportCredentials(filePath);
  }

  /**
   * Import credentials from a file
   */
  public async importCredentials(filePath: string): Promise<boolean> {
    return await this.store.importCredentials(filePath);
  }

  /**
   * Clear all stored credentials
   */
  public async clearAllCredentials(): Promise<boolean> {
    return await this.store.clearAllCredentials();
  }

  /**
   * Change the encryption key for stored credentials
   */
  public async changeEncryptionKey(newPassphrase: string): Promise<boolean> {
    return await this.store.changeEncryptionKey(newPassphrase);
  }

  /**
   * Get credential discovery statistics
   */
  public getDiscoveryStats(): {
    totalCredentials: number;
    validCredentials: number;
    sourceBreakdown: Record<string, number>;
    providerBreakdown: Record<string, number>;
  } {
    return this.discovery.getStats();
  }

  /**
   * Get overall credential management statistics
   */
  public async getOverallStats(): Promise<{
    store: ReturnType<CredentialStore['getStats']>;
    discovery: ReturnType<CredentialDiscovery['getStats']>;
    validation: {
      valid: number;
      invalid: number;
      expired: number;
    };
  }> {
    const validation = await this.validateAllCredentials();

    return {
      store: this.store.getStats(),
      discovery: this.discovery.getStats(),
      validation,
    };
  }
}
