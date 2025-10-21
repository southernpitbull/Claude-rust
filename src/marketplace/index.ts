/**
 * Plugin Marketplace for AIrchitect CLI
 *
 * This module provides a plugin marketplace system that allows users
 * to discover, install, and manage plugins for the AIrchitect CLI.
 */

import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { PluginManager } from '../plugins';

/**
 * Interface for plugin marketplace configuration
 */
export interface MarketplaceConfig {
  /**
   * Marketplace API endpoint
   */
  apiUrl: string;

  /**
   * Plugin registry URL
   */
  registryUrl: string;

  /**
   * Cache directory for plugin metadata
   */
  cacheDir: string;

  /**
   * Plugin installation directory
   */
  pluginDir: string;

  /**
   * Whether to enable plugin verification
   */
  verifyPlugins: boolean;

  /**
   * Whether to enable auto-updates
   */
  autoUpdate: boolean;

  /**
   * Update check interval (in hours)
   */
  updateCheckInterval: number;
}

/**
 * Interface for plugin metadata
 */
export interface PluginMetadata {
  /**
   * Plugin name
   */
  name: string;

  /**
   * Plugin version
   */
  version: string;

  /**
   * Plugin description
   */
  description: string;

  /**
   * Plugin author
   */
  author: string;

  /**
   * Plugin license
   */
  license: string;

  /**
   * Plugin homepage
   */
  homepage?: string;

  /**
   * Plugin repository
   */
  repository?: string;

  /**
   * Plugin keywords
   */
  keywords: string[];

  /**
   * Plugin dependencies
   */
  dependencies: Record<string, string>;

  /**
   * Plugin download URL
   */
  downloadUrl: string;

  /**
   * Plugin size in bytes
   */
  size: number;

  /**
   * Plugin download count
   */
  downloads: number;

  /**
   * Plugin rating (0-5)
   */
  rating: number;

  /**
   * Plugin rating count
   */
  ratingCount: number;

  /**
   * Plugin publication date
   */
  publishedAt: Date;

  /**
   * Plugin last update date
   */
  updatedAt: Date;

  /**
   * Plugin compatibility
   */
  compatibility: {
    /**
     * Minimum AIrchitect CLI version
     */
    minVersion: string;

    /**
     * Maximum AIrchitect CLI version
     */
    maxVersion: string;

    /**
     * Supported operating systems
     */
    os: string[];
  };

  /**
   * Plugin security information
   */
  security: {
    /**
     * Whether the plugin is verified
     */
    verified: boolean;

    /**
     * Security scan results
     */
    scanResults?: {
      /**
       * Scan status
       */
      status: 'passed' | 'failed' | 'pending';

      /**
       * Scan date
       */
      scannedAt: Date;

      /**
       * Scan findings
       */
      findings: string[];
    };

    /**
     * Digital signature
     */
    signature?: string;
  };
}

/**
 * Interface for plugin search results
 */
export interface PluginSearchResult {
  /**
   * Plugin metadata
   */
  plugin: PluginMetadata;

  /**
   * Search relevance score (0-1)
   */
  score: number;

  /**
   * Whether the plugin is installed
   */
  installed: boolean;

  /**
   * Installed version (if installed)
   */
  installedVersion?: string;
}

/**
 * Interface for plugin installation result
 */
export interface PluginInstallationResult {
  /**
   * Whether installation was successful
   */
  success: boolean;

  /**
   * Plugin name
   */
  pluginName: string;

  /**
   * Installed version
   */
  version: string;

  /**
   * Installation path
   */
  installPath: string;

  /**
   * Error message (if installation failed)
   */
  error?: string;

  /**
   * Installation warnings
   */
  warnings?: string[];
}

/**
 * Plugin verification result
 */
export interface PluginVerificationResult {
  /**
   * Whether the plugin is verified
   */
  verified: boolean;

  /**
   * Verification reason
   */
  reason?: string;

  /**
   * Verification warnings
   */
  warnings?: string[];
}

/**
 * Plugin Marketplace System
 */
export class PluginMarketplace {
  private config: MarketplaceConfig;
  private pluginManager: PluginManager;
  private lastUpdateCheck: Date | null = null;
  private cache: Map<string, PluginMetadata> = new Map();

  constructor(pluginManager: PluginManager, config?: Partial<MarketplaceConfig>) {
    this.pluginManager = pluginManager;

    this.config = {
      apiUrl: config?.apiUrl || 'https://marketplace.aichitect.com/api/v1',
      registryUrl: config?.registryUrl || 'https://registry.npmjs.org',
      cacheDir: config?.cacheDir || path.join(os.homedir(), '.aichitect', 'marketplace-cache'),
      pluginDir: config?.pluginDir || path.join(os.homedir(), '.aichitect', 'plugins'),
      verifyPlugins: config?.verifyPlugins !== undefined ? config.verifyPlugins : true,
      autoUpdate: config?.autoUpdate !== undefined ? config.autoUpdate : true,
      updateCheckInterval: config?.updateCheckInterval || 24, // 24 hours
      ...config,
    };
  }

  /**
   * Initialize the plugin marketplace
   */
  public async initialize(): Promise<boolean> {
    try {
      // Create cache directory
      await fs.mkdir(this.config.cacheDir, { recursive: true });

      // Create plugin directory
      await fs.mkdir(this.config.pluginDir, { recursive: true });

      // Load cached plugin metadata
      await this.loadCache();

      // Check for updates if auto-update is enabled
      if (this.config.autoUpdate) {
        await this.checkForUpdates();
      }

      console.log('Plugin marketplace initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize plugin marketplace:', error);
      return false;
    }
  }

  /**
   * Search for plugins in the marketplace
   */
  public async searchPlugins(
    query: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'downloads' | 'rating' | 'updated' | 'name';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<PluginSearchResult[]> {
    const { limit = 20, offset = 0, sortBy = 'downloads', sortOrder = 'desc' } = options;

    try {
      // Search the marketplace API
      const response = await axios.get(`${this.config.apiUrl}/plugins/search`, {
        params: {
          q: query,
          limit,
          offset,
          sort: sortBy,
          order: sortOrder,
        },
      });

      // Process search results
      const results: PluginSearchResult[] = [];

      for (const pluginData of response.data.plugins) {
        const plugin: PluginMetadata = {
          name: pluginData.name,
          version: pluginData.version,
          description: pluginData.description,
          author: pluginData.author,
          license: pluginData.license,
          homepage: pluginData.homepage,
          repository: pluginData.repository,
          keywords: pluginData.keywords || [],
          dependencies: pluginData.dependencies || {},
          downloadUrl: pluginData.downloadUrl,
          size: pluginData.size,
          downloads: pluginData.downloads,
          rating: pluginData.rating,
          ratingCount: pluginData.ratingCount,
          publishedAt: new Date(pluginData.publishedAt),
          updatedAt: new Date(pluginData.updatedAt),
          compatibility: {
            minVersion: pluginData.compatibility?.minVersion || '1.0.0',
            maxVersion: pluginData.compatibility?.maxVersion || '1.99.99',
            os: pluginData.compatibility?.os || ['linux', 'macos', 'windows'],
          },
          security: {
            verified: pluginData.security?.verified || false,
            scanResults: pluginData.security?.scanResults
              ? {
                  status: pluginData.security.scanResults.status,
                  scannedAt: new Date(pluginData.security.scanResults.scannedAt),
                  findings: pluginData.security.scanResults.findings || [],
                }
              : undefined,
            signature: pluginData.security?.signature,
          },
        };

        // Check if plugin is installed
        const isInstalled = await this.pluginManager.isPluginInstalled(plugin.name);
        const installedVersion = isInstalled
          ? await this.pluginManager.getPluginVersion(plugin.name)
          : undefined;

        results.push({
          plugin,
          score: pluginData.score || 0,
          installed: isInstalled,
          installedVersion,
        });

        // Cache the plugin metadata
        this.cache.set(plugin.name, plugin);
      }

      // Save cache
      await this.saveCache();

      return results;
    } catch (error) {
      console.error(`Failed to search plugins for query "${query}":`, error);
      return [];
    }
  }

  /**
   * Get plugin details by name
   */
  public async getPluginDetails(name: string): Promise<PluginMetadata | null> {
    // Check cache first
    if (this.cache.has(name)) {
      return this.cache.get(name) || null;
    }

    try {
      // Fetch plugin details from the marketplace API
      const response = await axios.get(`${this.config.apiUrl}/plugins/${name}`);

      const pluginData = response.data;
      const plugin: PluginMetadata = {
        name: pluginData.name,
        version: pluginData.version,
        description: pluginData.description,
        author: pluginData.author,
        license: pluginData.license,
        homepage: pluginData.homepage,
        repository: pluginData.repository,
        keywords: pluginData.keywords || [],
        dependencies: pluginData.dependencies || {},
        downloadUrl: pluginData.downloadUrl,
        size: pluginData.size,
        downloads: pluginData.downloads,
        rating: pluginData.rating,
        ratingCount: pluginData.ratingCount,
        publishedAt: new Date(pluginData.publishedAt),
        updatedAt: new Date(pluginData.updatedAt),
        compatibility: {
          minVersion: pluginData.compatibility?.minVersion || '1.0.0',
          maxVersion: pluginData.compatibility?.maxVersion || '1.99.99',
          os: pluginData.compatibility?.os || ['linux', 'macos', 'windows'],
        },
        security: {
          verified: pluginData.security?.verified || false,
          scanResults: pluginData.security?.scanResults
            ? {
                status: pluginData.security.scanResults.status,
                scannedAt: new Date(pluginData.security.scanResults.scannedAt),
                findings: pluginData.security.scanResults.findings || [],
              }
            : undefined,
          signature: pluginData.security?.signature,
        },
      };

      // Cache the plugin metadata
      this.cache.set(name, plugin);

      // Save cache
      await this.saveCache();

      return plugin;
    } catch (error) {
      console.error(`Failed to get plugin details for ${name}:`, error);
      return null;
    }
  }

  /**
   * Install a plugin from the marketplace
   */
  public async installPlugin(name: string, version?: string): Promise<PluginInstallationResult> {
    try {
      // Get plugin details
      const plugin = await this.getPluginDetails(name);
      if (!plugin) {
        return {
          success: false,
          pluginName: name,
          version: version || 'latest',
          installPath: '',
          error: `Plugin ${name} not found in marketplace`,
        };
      }

      // Check compatibility
      const compatibilityCheck = this.checkCompatibility(plugin);
      if (!compatibilityCheck.compatible) {
        return {
          success: false,
          pluginName: name,
          version: plugin.version,
          installPath: '',
          error: `Plugin ${name} is not compatible: ${compatibilityCheck.reason}`,
        };
      }

      // Verify plugin if verification is enabled
      if (this.config.verifyPlugins) {
        const verification = await this.verifyPlugin(plugin);
        if (!verification.verified) {
          return {
            success: false,
            pluginName: name,
            version: plugin.version,
            installPath: '',
            error: `Plugin ${name} failed verification: ${verification.reason}`,
            warnings: verification.warnings,
          };
        }
      }

      // Download and install the plugin
      const installResult = await this.downloadAndInstallPlugin(plugin, version);

      if (installResult.success) {
        // Register the plugin with the plugin manager
        await this.pluginManager.registerPlugin(name, installResult.installPath);

        console.log(`Successfully installed plugin ${name} v${installResult.version}`);
      }

      return installResult;
    } catch (error) {
      console.error(`Failed to install plugin ${name}:`, error);
      return {
        success: false,
        pluginName: name,
        version: version || 'latest',
        installPath: '',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  public async uninstallPlugin(name: string): Promise<boolean> {
    try {
      // Unregister the plugin from the plugin manager
      const unregistered = await this.pluginManager.unregisterPlugin(name);

      if (!unregistered) {
        console.warn(`Plugin ${name} was not registered with the plugin manager`);
      }

      // Remove plugin directory
      const pluginPath = path.join(this.config.pluginDir, name);
      await fs.rm(pluginPath, { recursive: true, force: true });

      // Remove from cache
      this.cache.delete(name);

      // Save cache
      await this.saveCache();

      console.log(`Successfully uninstalled plugin ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to uninstall plugin ${name}:`, error);
      return false;
    }
  }

  /**
   * Update an installed plugin
   */
  public async updatePlugin(name: string): Promise<PluginInstallationResult> {
    try {
      // Check if plugin is installed
      const isInstalled = await this.pluginManager.isPluginInstalled(name);
      if (!isInstalled) {
        return {
          success: false,
          pluginName: name,
          version: 'latest',
          installPath: '',
          error: `Plugin ${name} is not installed`,
        };
      }

      // Get current version
      const currentVersion = await this.pluginManager.getPluginVersion(name);

      // Get latest version from marketplace
      const plugin = await this.getPluginDetails(name);
      if (!plugin) {
        return {
          success: false,
          pluginName: name,
          version: currentVersion || 'unknown',
          installPath: '',
          error: `Plugin ${name} not found in marketplace`,
        };
      }

      // Check if update is needed
      if (plugin.version === currentVersion) {
        return {
          success: true,
          pluginName: name,
          version: currentVersion,
          installPath: path.join(this.config.pluginDir, name),
          warnings: [`Plugin ${name} is already up to date`],
        };
      }

      // Perform update
      console.log(`Updating plugin ${name} from ${currentVersion} to ${plugin.version}`);
      return await this.installPlugin(name, plugin.version);
    } catch (error) {
      console.error(`Failed to update plugin ${name}:`, error);
      return {
        success: false,
        pluginName: name,
        version: 'latest',
        installPath: '',
        error: (error as Error).message,
      };
    }
  }

  /**
   * List installed plugins
   */
  public async listInstalledPlugins(): Promise<PluginSearchResult[]> {
    try {
      const installedPlugins = await this.pluginManager.listPlugins();
      const results: PluginSearchResult[] = [];

      for (const pluginName of installedPlugins) {
        // Try to get plugin details from cache or marketplace
        let plugin = this.cache.get(pluginName);

        if (!plugin) {
          plugin = await this.getPluginDetails(pluginName);
        }

        if (plugin) {
          const installedVersion = await this.pluginManager.getPluginVersion(pluginName);

          results.push({
            plugin,
            score: 1.0, // Installed plugins get highest score
            installed: true,
            installedVersion,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to list installed plugins:', error);
      return [];
    }
  }

  /**
   * Check for plugin updates
   */
  public async checkForUpdates(): Promise<PluginSearchResult[]> {
    try {
      // Only check for updates if enough time has passed
      const now = new Date();
      if (this.lastUpdateCheck) {
        const hoursSinceLastCheck =
          (now.getTime() - this.lastUpdateCheck.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastCheck < this.config.updateCheckInterval) {
          return []; // Skip update check
        }
      }

      this.lastUpdateCheck = now;

      // Get installed plugins
      const installedPlugins = await this.listInstalledPlugins();
      const updates: PluginSearchResult[] = [];

      // Check each installed plugin for updates
      for (const pluginResult of installedPlugins) {
        if (pluginResult.installed && pluginResult.installedVersion) {
          const latestPlugin = await this.getPluginDetails(pluginResult.plugin.name);

          if (latestPlugin && latestPlugin.version !== pluginResult.installedVersion) {
            updates.push({
              plugin: latestPlugin,
              score: 1.0,
              installed: true,
              installedVersion: pluginResult.installedVersion,
            });
          }
        }
      }

      if (updates.length > 0) {
        console.log(`Found ${updates.length} plugin updates available`);
      }

      return updates;
    } catch (error) {
      console.error('Failed to check for plugin updates:', error);
      return [];
    }
  }

  /**
   * Load cached plugin metadata
   */
  private async loadCache(): Promise<void> {
    try {
      const cacheFile = path.join(this.config.cacheDir, 'plugins.json');
      const cacheData = await fs.readFile(cacheFile, 'utf8');
      const cachedPlugins = JSON.parse(cacheData);

      for (const [name, pluginData] of Object.entries(cachedPlugins)) {
        const plugin: PluginMetadata = {
          ...(pluginData as any),
          publishedAt: new Date(pluginData.publishedAt),
          updatedAt: new Date(pluginData.updatedAt),
          compatibility: pluginData.compatibility,
          security: pluginData.security,
        };

        this.cache.set(name, plugin);
      }

      console.log(`Loaded ${this.cache.size} plugins from cache`);
    } catch (error) {
      // Cache file doesn't exist or is invalid, which is fine
      console.debug('No plugin cache found or cache is invalid');
    }
  }

  /**
   * Save plugin metadata to cache
   */
  private async saveCache(): Promise<void> {
    try {
      const cacheFile = path.join(this.config.cacheDir, 'plugins.json');
      const cacheData = JSON.stringify(Object.fromEntries(this.cache.entries()), null, 2);
      await fs.writeFile(cacheFile, cacheData, 'utf8');
    } catch (error) {
      console.error('Failed to save plugin cache:', error);
    }
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
   * Download and install a plugin
   */
  private async downloadAndInstallPlugin(
    plugin: PluginMetadata,
    version?: string
  ): Promise<PluginInstallationResult> {
    try {
      // Create plugin directory
      const pluginPath = path.join(this.config.pluginDir, plugin.name);
      await fs.mkdir(pluginPath, { recursive: true });

      // For this example, we'll simulate downloading and extracting
      // In a real implementation, this would:
      // 1. Download the plugin package from plugin.downloadUrl
      // 2. Verify the download (checksum, signature)
      // 3. Extract the package to the plugin directory
      // 4. Install dependencies
      // 5. Run post-install scripts

      // Simulate download
      console.log(`Downloading plugin ${plugin.name} v${version || plugin.version}...`);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay

      // Simulate extraction
      console.log(`Extracting plugin to ${pluginPath}...`);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate extraction

      // Simulate dependency installation
      console.log('Installing plugin dependencies...');
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate dependency installation

      // Create a basic plugin structure
      await this.createPluginStructure(pluginPath, plugin);

      return {
        success: true,
        pluginName: plugin.name,
        version: version || plugin.version,
        installPath: pluginPath,
      };
    } catch (error) {
      console.error(`Failed to download and install plugin ${plugin.name}:`, error);
      return {
        success: false,
        pluginName: plugin.name,
        version: version || plugin.version,
        installPath: '',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Create basic plugin structure
   */
  private async createPluginStructure(pluginPath: string, plugin: PluginMetadata): Promise<void> {
    // Create plugin entry point
    const pluginCode = `
"""
${plugin.name} Plugin
${plugin.description}
"""

from ai_cli_python import PluginAPI, PluginContext

class ${plugin.name.replace(/-/g, '_').replace(/\b\w/g, (l) => l.toUpperCase())}Plugin(PluginAPI):
    def __init__(self, context: PluginContext):
        super().__init__(context)
        self.name = "${plugin.name}"
        self.version = "${plugin.version}"
        self.description = "${plugin.description}"
    
    def get_commands(self) -> list:
        return ["hello", "info"]
    
    def execute_command(self, command: str, args: list) -> any:
        if command == "hello":
            return f"Hello from {self.name} v{self.version}!"
        elif command == "info":
            return {
                "name": self.name,
                "version": self.version,
                "description": self.description,
                "author": "${plugin.author}",
                "license": "${plugin.license}"
            }
        else:
            raise ValueError(f"Unknown command: {command}")

# Create plugin instance
plugin = ${plugin.name.replace(/-/g, '_').replace(/\b\w/g, (l) => l.toUpperCase())}Plugin(PluginContext("${plugin.name}"))

def main():
    print(f"${plugin.name} v${plugin.version} plugin loaded")

if __name__ == "__main__":
    main()
`;

    await fs.writeFile(path.join(pluginPath, 'plugin.py'), pluginCode);

    // Create plugin metadata file
    const metadata = {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      license: plugin.license,
      keywords: plugin.keywords,
      dependencies: plugin.dependencies,
      compatibility: plugin.compatibility,
      security: plugin.security,
    };

    await fs.writeFile(path.join(pluginPath, 'plugin.json'), JSON.stringify(metadata, null, 2));

    // Create requirements file if dependencies exist
    if (Object.keys(plugin.dependencies).length > 0) {
      const requirements = Object.entries(plugin.dependencies)
        .map(([dep, version]) => `${dep}==${version}`)
        .join('\n');

      await fs.writeFile(path.join(pluginPath, 'requirements.txt'), requirements);
    }
  }

  /**
   * Check plugin compatibility
   */
  private checkCompatibility(plugin: PluginMetadata): {
    compatible: boolean;
    reason?: string;
  } {
    // Check operating system compatibility
    const currentOS = os.platform();
    const osMap: Record<string, string> = {
      win32: 'windows',
      darwin: 'macos',
      linux: 'linux',
    };

    const osName = osMap[currentOS] || currentOS;

    if (!plugin.compatibility.os.includes(osName)) {
      return {
        compatible: false,
        reason: `Plugin not compatible with ${osName} (supported: ${plugin.compatibility.os.join(', ')})`,
      };
    }

    // Check AIrchitect CLI version compatibility
    // In a real implementation, this would check semver compatibility
    // For now, we'll just assume compatibility
    return {
      compatible: true,
    };
  }

  /**
   * Verify a plugin's security and integrity
   */
  private async verifyPlugin(plugin: PluginMetadata): Promise<PluginVerificationResult> {
    // In a real implementation, this would verify:
    // 1. Digital signatures
    // 2. Security scan results
    // 3. Reputation scores
    // 4. Virus scanning
    // 5. Static analysis

    // For now, we'll implement a basic verification
    if (plugin.security.verified) {
      return {
        verified: true,
        warnings: plugin.security.scanResults?.findings || [],
      };
    }

    // If not verified, check if it has scan results
    if (plugin.security.scanResults) {
      const scanResults = plugin.security.scanResults;
      if (scanResults.status === 'passed') {
        return {
          verified: true,
          warnings: scanResults.findings || [],
        };
      } else if (scanResults.status === 'failed') {
        return {
          verified: false,
          reason: `Security scan failed with ${scanResults.findings?.length || 0} findings`,
          warnings: scanResults.findings || [],
        };
      }
    }

    // Default: not verified but no explicit issues found
    return {
      verified: false,
      reason: 'Plugin not verified by marketplace',
      warnings: ['Plugin not verified - use with caution'],
    };
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
        const config = JSON.parse(content) as CredentialConfig;
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
   * Get marketplace statistics
   */
  public getStats(): {
    totalCachedPlugins: number;
    lastUpdateCheck: Date | null;
    configPaths: number;
    supportedProviders: number;
  } {
    return {
      totalCachedPlugins: this.cache.size,
      lastUpdateCheck: this.lastUpdateCheck,
      configPaths: this.configPaths.length,
      supportedProviders: this.supportedProviders.length,
    };
  }
}
