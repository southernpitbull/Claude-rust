import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Interface for discovered credentials
 */
export interface DiscoveredCredential {
  provider: string;
  key: string;
  source: 'environment' | 'file' | 'command' | 'keychain';
  filePath?: string;
  command?: string;
  isValid: boolean;
  lastChecked: Date;
}

/**
 * Interface for credential discovery configuration
 */
export interface CredentialDiscoveryConfig {
  searchPaths?: string[];
  environmentVariables?: Record<string, string>;
  commands?: Record<string, string>;
  filePatterns?: string[];
  keychainServices?: string[];
}

/**
 * Credential discovery system that automatically finds API keys and credentials
 *
 * Security improvements:
 * - Implements command sanitization and whitelisting
 * - Escapes all user inputs passed to shell commands
 * - Validates command formats before execution
 * - Prevents command injection attacks
 * - Implements secure file path handling
 */
export class CredentialDiscovery {
  private config: CredentialDiscoveryConfig;
  private discoveredCredentials: Map<string, DiscoveredCredential>;
  private readonly defaultConfig: CredentialDiscoveryConfig;
  private credentialManager?: any; // Will be set to CredentialManager reference

  // Security: Whitelist of allowed commands to prevent command injection
  private static readonly ALLOWED_COMMANDS = new Set(['git config --get user.email', 'npm whoami']);

  // Security: Whitelist of allowed keychain services
  private static readonly ALLOWED_KEYCHAIN_SERVICES = new Set([
    'openai',
    'anthropic',
    'google',
    'qwen',
    'cloudflare',
    'ollama',
    'lmstudio',
  ]);

  constructor(config?: CredentialDiscoveryConfig, credentialManager?: any) {
    this.defaultConfig = {
      searchPaths: [
        path.join(os.homedir(), '.openai'),
        path.join(os.homedir(), '.anthropic'),
        path.join(os.homedir(), '.google'),
        path.join(os.homedir(), '.qwen'),
        path.join(os.homedir(), '.cloudflare'),
        path.join(os.homedir(), '.ollama'),
        path.join(os.homedir(), '.lmstudio'),
        path.join(os.homedir(), '.config', 'aichitect'),
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), 'config.json'),
      ],
      environmentVariables: {
        OPENAI_API_KEY: 'openai',
        ANTHROPIC_API_KEY: 'anthropic',
        GOOGLE_API_KEY: 'google',
        QWEN_API_KEY: 'qwen',
        CLOUDFLARE_API_TOKEN: 'cloudflare',
        OLLAMA_HOST: 'ollama',
        LMSTUDIO_HOST: 'lmstudio',
      },
      commands: {
        'git config --get user.email': 'git-email',
        'npm whoami': 'npm-user',
      },
      filePatterns: [
        '.env',
        '.openai',
        '.anthropic',
        'config.json',
        'credentials.json',
        '.aichitect',
      ],
      keychainServices: ['openai', 'anthropic', 'google', 'qwen', 'cloudflare'],
    };

    this.config = { ...this.defaultConfig, ...config };
    this.discoveredCredentials = new Map();
    if (credentialManager) {
      this.credentialManager = credentialManager;
    }
  }

  /**
   * Sanitize a command to prevent command injection
   *
   * Security: Validates command against whitelist and ensures no shell metacharacters
   */
  private sanitizeCommand(command: string): string | null {
    // Trim whitespace
    const trimmedCommand = command.trim();

    // Check if command is in whitelist
    if (!CredentialDiscovery.ALLOWED_COMMANDS.has(trimmedCommand)) {
      console.warn(`Command not in whitelist: ${trimmedCommand}`);
      return null;
    }

    // Additional validation: ensure no shell metacharacters
    const dangerousChars = /[;&|`$(){}[\]<>\\]/;
    if (dangerousChars.test(trimmedCommand)) {
      console.error(`Command contains dangerous characters: ${trimmedCommand}`);
      return null;
    }

    return trimmedCommand;
  }

  /**
   * Sanitize a service name for keychain access
   *
   * Security: Validates service name against whitelist and escapes special characters
   */
  private sanitizeServiceName(service: string): string | null {
    // Trim whitespace
    const trimmedService = service.trim().toLowerCase();

    // Check if service is in whitelist
    if (!CredentialDiscovery.ALLOWED_KEYCHAIN_SERVICES.has(trimmedService)) {
      console.warn(`Service not in whitelist: ${trimmedService}`);
      return null;
    }

    // Additional validation: ensure only alphanumeric and dash characters
    const validPattern = /^[a-z0-9-]+$/;
    if (!validPattern.test(trimmedService)) {
      console.error(`Service name contains invalid characters: ${trimmedService}`);
      return null;
    }

    return trimmedService;
  }

  /**
   * Escape shell arguments to prevent command injection
   *
   * Security: Properly escapes arguments for shell execution
   */
  private escapeShellArg(arg: string): string {
    // Replace single quotes with '\'' to safely escape them
    // This works because: 'abc' + \' + 'def' = abc'def
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Validate file path to prevent directory traversal
   *
   * Security: Ensures path doesn't escape allowed directories
   */
  private isValidFilePath(filePath: string): boolean {
    try {
      // Resolve the path to get absolute path
      const resolvedPath = path.resolve(filePath);

      // Get home directory
      const homeDir = os.homedir();

      // Check if path is within home directory or current working directory
      const isInHome = resolvedPath.startsWith(homeDir);
      const isInCwd = resolvedPath.startsWith(process.cwd());

      if (!isInHome && !isInCwd) {
        console.warn(`Path outside allowed directories: ${resolvedPath}`);
        return false;
      }

      // Additional check: ensure no directory traversal attempts
      if (filePath.includes('..')) {
        console.warn(`Path contains directory traversal: ${filePath}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Failed to validate file path: ${filePath}`, error);
      return false;
    }
  }

  /**
   * Discover all available credentials
   */
  public async discoverAll(): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];

    // Discover from environment variables
    const envCredentials = await this.discoverFromEnvironment();
    credentials.push(...envCredentials);

    // Discover from files
    const fileCredentials = await this.discoverFromFiles();
    credentials.push(...fileCredentials);

    // Discover from commands
    const commandCredentials = await this.discoverFromCommands();
    credentials.push(...commandCredentials);

    // Discover from keychain (if available)
    const keychainCredentials = await this.discoverFromKeychain();
    credentials.push(...keychainCredentials);

    // Update internal store
    for (const cred of credentials) {
      this.discoveredCredentials.set(cred.provider, cred);
    }

    return credentials;
  }

  /**
   * Discover credentials from environment variables
   */
  public async discoverFromEnvironment(): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];
    const envVars = this.config.environmentVariables || {};

    for (const [envVar, provider] of Object.entries(envVars)) {
      // Validate environment variable name
      if (!/^[A-Z_][A-Z0-9_]*$/.test(envVar)) {
        console.warn(`Invalid environment variable name: ${envVar}`);
        continue;
      }

      const value = process.env[envVar];
      if (value && value.trim() !== '') {
        const credential: DiscoveredCredential = {
          provider,
          key: value.trim(),
          source: 'environment',
          isValid: await this.validateCredential(provider, value.trim()),
          lastChecked: new Date(),
        };

        credentials.push(credential);

        // If we have a credential manager reference, save it there too
        if (this.credentialManager && typeof this.credentialManager.setCredential === 'function') {
          try {
            await this.credentialManager.setCredential(provider, value.trim());
          } catch (error) {
            console.warn(`Failed to save discovered credential for ${provider} to manager:`, error);
          }
        }
      }
    }

    return credentials;
  }

  /**
   * Discover credentials from configuration files
   */
  public async discoverFromFiles(): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];
    const searchPaths = this.config.searchPaths || [];
    const filePatterns = this.config.filePatterns || [];

    for (const searchPath of searchPaths) {
      // Validate file path to prevent directory traversal
      if (!this.isValidFilePath(searchPath)) {
        console.warn(`Skipping invalid search path: ${searchPath}`);
        continue;
      }

      try {
        // Check if path exists
        await fs.access(searchPath);

        // Check if it's a file or directory
        const stat = await fs.stat(searchPath);
        if (stat.isFile()) {
          const creds = await this.parseFile(searchPath);
          credentials.push(...creds);
        } else if (stat.isDirectory()) {
          // Search for matching files in directory
          const files = await fs.readdir(searchPath);
          for (const file of files) {
            if (filePatterns.some((pattern) => file.includes(pattern))) {
              const filePath = path.join(searchPath, file);

              // Validate constructed path
              if (!this.isValidFilePath(filePath)) {
                console.warn(`Skipping invalid file path: ${filePath}`);
                continue;
              }

              try {
                await fs.access(filePath);
                const creds = await this.parseFile(filePath);
                credentials.push(...creds);
              } catch (error) {
                // Continue to next file if one fails
                console.debug(`Failed to read file ${filePath}:`, error);
              }
            }
          }
        }
      } catch (error) {
        // Continue to next path if one fails
        console.debug(`Failed to access path ${searchPath}:`, error);
      }
    }

    // Save all discovered credentials to credential manager
    for (const credential of credentials) {
      if (this.credentialManager && typeof this.credentialManager.setCredential === 'function') {
        try {
          await this.credentialManager.setCredential(credential.provider, credential.key);
        } catch (error) {
          console.warn(
            `Failed to save discovered credential for ${credential.provider} to manager:`,
            error
          );
        }
      }
    }

    return credentials;
  }

  /**
   * Parse a configuration file for credentials
   */
  private async parseFile(filePath: string): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];

    // Validate file path
    if (!this.isValidFilePath(filePath)) {
      console.warn(`Skipping invalid file path: ${filePath}`);
      return credentials;
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');

      // Determine file type and parse accordingly
      if (filePath.endsWith('.json')) {
        credentials.push(...(await this.parseJsonFile(content, filePath)));
      } else if (
        filePath.endsWith('.env') ||
        filePath.includes('.bashrc') ||
        filePath.includes('.zshrc')
      ) {
        credentials.push(...(await this.parseEnvFile(content, filePath)));
      } else {
        credentials.push(...(await this.parseGenericFile(content, filePath)));
      }
    } catch (error) {
      console.debug(`Failed to parse file ${filePath}:`, error);
    }

    return credentials;
  }

  /**
   * Parse JSON configuration file
   */
  private async parseJsonFile(content: string, filePath: string): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];

    try {
      const config = JSON.parse(content);

      // Common credential fields in JSON files
      const credentialFields = {
        openai: ['openai_api_key', 'openai_key', 'api_key'],
        anthropic: ['anthropic_api_key', 'claude_key'],
        google: ['google_api_key', 'gemini_key'],
        qwen: ['qwen_api_key'],
        cloudflare: ['cloudflare_api_token', 'cf_token'],
        ollama: ['ollama_host', 'ollama_url'],
        lmstudio: ['lmstudio_host', 'lmstudio_url'],
      };

      for (const [provider, fields] of Object.entries(credentialFields)) {
        for (const field of fields) {
          if (config[field] && config[field].trim() !== '') {
            credentials.push({
              provider,
              key: config[field].trim(),
              source: 'file',
              filePath,
              isValid: await this.validateCredential(provider, config[field].trim()),
              lastChecked: new Date(),
            });
          }
        }
      }
    } catch (error) {
      console.debug(`Failed to parse JSON file ${filePath}:`, error);
    }

    return credentials;
  }

  /**
   * Parse environment file (.env, .bashrc, etc.)
   */
  private async parseEnvFile(content: string, filePath: string): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];
    const lines = content.split('\n');

    // Environment variable patterns
    const envPatterns = {
      openai: [/OPENAI_API_KEY=(.+)/i, /OPENAI_KEY=(.+)/i],
      anthropic: [/ANTHROPIC_API_KEY=(.+)/i, /CLAUDE_KEY=(.+)/i],
      google: [/GOOGLE_API_KEY=(.+)/i, /GEMINI_KEY=(.+)/i],
      qwen: [/QWEN_API_KEY=(.+)/i],
      cloudflare: [/CLOUDFLARE_API_TOKEN=(.+)/i, /CF_TOKEN=(.+)/i],
      ollama: [/OLLAMA_HOST=(.+)/i, /OLLAMA_URL=(.+)/i],
      lmstudio: [/LMSTUDIO_HOST=(.+)/i, /LMSTUDIO_URL=(.+)/i],
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }

      // Check for key=value pairs
      const [key, value] = trimmedLine.split('=', 2);
      if (key && value) {
        const cleanValue = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes

        // Check if this is a known credential
        for (const [provider, patterns] of Object.entries(envPatterns)) {
          for (const pattern of patterns) {
            if (pattern.test(trimmedLine)) {
              const match = trimmedLine.match(pattern);
              if (match && match[1]) {
                const keyValue = match[1].replace(/^["']|["']$/g, ''); // Remove quotes
                if (keyValue.trim() !== '') {
                  credentials.push({
                    provider,
                    key: keyValue.trim(),
                    source: 'file',
                    filePath,
                    isValid: await this.validateCredential(provider, keyValue.trim()),
                    lastChecked: new Date(),
                  });
                }
              }
            }
          }
        }
      }
    }

    return credentials;
  }

  /**
   * Parse generic configuration file
   */
  private async parseGenericFile(
    content: string,
    filePath: string
  ): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];

    // Look for common credential patterns
    const patterns = {
      openai: [/sk-[a-zA-Z0-9]{48}/, /[a-zA-Z0-9]{32}\.[a-zA-Z0-9]{24}\.[a-zA-Z0-9-_]{43}/],
      anthropic: [/sk-ant-[a-zA-Z0-9-_]{94}/],
      google: [/AIza[0-9A-Za-z-_]{35}/],
      qwen: [/sk-[a-zA-Z0-9]{32}/],
      cloudflare: [/^[a-zA-Z0-9-_]{40}$/],
    };

    for (const [provider, regexes] of Object.entries(patterns)) {
      for (const regex of regexes) {
        const matches = content.match(regex);
        if (matches) {
          for (const match of matches) {
            if (match.trim() !== '') {
              credentials.push({
                provider,
                key: match.trim(),
                source: 'file',
                filePath,
                isValid: await this.validateCredential(provider, match.trim()),
                lastChecked: new Date(),
              });
            }
          }
        }
      }
    }

    return credentials;
  }

  /**
   * Discover credentials from system commands
   *
   * Security improvements:
   * - Validates commands against whitelist
   * - Sanitizes all command inputs
   * - Prevents command injection attacks
   */
  public async discoverFromCommands(): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];
    const commands = this.config.commands || {};

    for (const [command, provider] of Object.entries(commands)) {
      // Sanitize command to prevent injection
      const sanitizedCommand = this.sanitizeCommand(command);

      if (!sanitizedCommand) {
        console.warn(`Skipping unsafe command: ${command}`);
        continue;
      }

      try {
        // Execute sanitized command
        const { stdout, stderr } = await execAsync(sanitizedCommand, {
          timeout: 5000, // 5 second timeout
          maxBuffer: 1024 * 1024, // 1MB max buffer
        });

        if (stdout && stdout.trim() !== '') {
          const credential: DiscoveredCredential = {
            provider,
            key: stdout.trim(),
            source: 'command',
            command: sanitizedCommand,
            isValid: await this.validateCredential(provider, stdout.trim()),
            lastChecked: new Date(),
          };

          credentials.push(credential);

          // Save to credential manager if available
          if (
            this.credentialManager &&
            typeof this.credentialManager.setCredential === 'function'
          ) {
            try {
              await this.credentialManager.setCredential(provider, stdout.trim());
            } catch (error) {
              console.warn(
                `Failed to save discovered credential for ${provider} to manager:`,
                error
              );
            }
          }
        }
      } catch (error) {
        // Continue to next command if one fails
        console.debug(`Failed to execute command ${sanitizedCommand}:`, error);
      }
    }

    return credentials;
  }

  /**
   * Discover credentials from system keychain
   *
   * Security improvements:
   * - Validates service names against whitelist
   * - Sanitizes all inputs to keychain commands
   * - Escapes shell arguments properly
   */
  public async discoverFromKeychain(): Promise<DiscoveredCredential[]> {
    const credentials: DiscoveredCredential[] = [];
    const services = this.config.keychainServices || [];

    // Keychain discovery is platform-specific
    if (process.platform === 'darwin') {
      // macOS keychain
      for (const service of services) {
        // Sanitize service name to prevent injection
        const sanitizedService = this.sanitizeServiceName(service);

        if (!sanitizedService) {
          console.warn(`Skipping unsafe service name: ${service}`);
          continue;
        }

        try {
          // Build safe command with escaped argument
          const escapedService = this.escapeShellArg(sanitizedService);
          const command = `security find-generic-password -s ${escapedService} -w`;

          // Execute with timeout and buffer limits
          const { stdout } = await execAsync(command, {
            timeout: 5000, // 5 second timeout
            maxBuffer: 1024 * 1024, // 1MB max buffer
          });

          if (stdout && stdout.trim() !== '') {
            const credential: DiscoveredCredential = {
              provider: sanitizedService,
              key: stdout.trim(),
              source: 'keychain',
              isValid: await this.validateCredential(sanitizedService, stdout.trim()),
              lastChecked: new Date(),
            };

            credentials.push(credential);

            // Save to credential manager if available
            if (
              this.credentialManager &&
              typeof this.credentialManager.setCredential === 'function'
            ) {
              try {
                await this.credentialManager.setCredential(sanitizedService, stdout.trim());
              } catch (error) {
                console.warn(
                  `Failed to save discovered keychain credential for ${sanitizedService} to manager:`,
                  error
                );
              }
            }
          }
        } catch (error) {
          // Continue to next service if one fails
          console.debug(`Failed to get keychain password for ${sanitizedService}:`, error);
        }
      }
    } else if (process.platform === 'win32') {
      // Windows credential manager
      // This would require a more complex implementation
      console.debug('Windows keychain discovery not implemented yet');
    } else {
      // Linux keyring
      // This would require a more complex implementation
      console.debug('Linux keyring discovery not implemented yet');
    }

    return credentials;
  }

  /**
   * Validate a credential with its provider
   */
  private async validateCredential(provider: string, key: string): Promise<boolean> {
    // In a real implementation, this would test the credential with the provider
    // For now, we'll just check if the key looks valid
    if (!key || key.trim() === '') {
      return false;
    }

    // Simple validation patterns
    const validationPatterns: Record<string, RegExp> = {
      openai: /^sk-[a-zA-Z0-9]{48}$|^([a-zA-Z0-9]{32}\.[a-zA-Z0-9]{24}\.[a-zA-Z0-9-_]{43})$/,
      anthropic: /^sk-ant-[a-zA-Z0-9-_]{94}$/,
      google: /^AIza[0-9A-Za-z-_]{35}$/,
      qwen: /^sk-[a-zA-Z0-9]{32}$/,
      cloudflare: /^[a-zA-Z0-9-_]{40}$/,
    };

    const pattern = validationPatterns[provider.toLowerCase()];
    if (pattern) {
      return pattern.test(key);
    }

    // For other providers or if no pattern, assume valid if not empty
    return key.trim() !== '';
  }

  /**
   * Get a specific credential
   */
  public getCredential(provider: string): DiscoveredCredential | undefined {
    return this.discoveredCredentials.get(provider);
  }

  /**
   * Get all discovered credentials
   */
  public getAllCredentials(): DiscoveredCredential[] {
    return Array.from(this.discoveredCredentials.values());
  }

  /**
   * Check if a credential exists for a provider
   */
  public hasCredential(provider: string): boolean {
    return this.discoveredCredentials.has(provider);
  }

  /**
   * Get valid credentials only
   */
  public getValidCredentials(): DiscoveredCredential[] {
    return Array.from(this.discoveredCredentials.values()).filter((cred) => cred.isValid);
  }

  /**
   * Get credentials by source
   */
  public getCredentialsBySource(
    source: 'environment' | 'file' | 'command' | 'keychain'
  ): DiscoveredCredential[] {
    return Array.from(this.discoveredCredentials.values()).filter((cred) => cred.source === source);
  }

  /**
   * Refresh credential validity
   */
  public async refreshCredentials(): Promise<void> {
    for (const [provider, credential] of this.discoveredCredentials.entries()) {
      credential.isValid = await this.validateCredential(provider, credential.key);
      credential.lastChecked = new Date();
    }
  }

  /**
   * Remove a credential
   */
  public removeCredential(provider: string): boolean {
    return this.discoveredCredentials.delete(provider);
  }

  /**
   * Clear all discovered credentials
   */
  public clearCredentials(): void {
    this.discoveredCredentials.clear();
  }

  /**
   * Get credential discovery statistics
   */
  public getStats(): {
    totalCredentials: number;
    validCredentials: number;
    sourceBreakdown: Record<string, number>;
    providerBreakdown: Record<string, number>;
  } {
    const sourceBreakdown: Record<string, number> = {};
    const providerBreakdown: Record<string, number> = {};

    for (const credential of this.discoveredCredentials.values()) {
      // Count by source
      if (!sourceBreakdown[credential.source]) {
        sourceBreakdown[credential.source] = 0;
      }
      sourceBreakdown[credential.source]++;

      // Count by provider
      if (!providerBreakdown[credential.provider]) {
        providerBreakdown[credential.provider] = 0;
      }
      providerBreakdown[credential.provider]++;
    }

    return {
      totalCredentials: this.discoveredCredentials.size,
      validCredentials: Array.from(this.discoveredCredentials.values()).filter(
        (cred) => cred.isValid
      ).length,
      sourceBreakdown,
      providerBreakdown,
    };
  }

  /**
   * Get the configuration
   */
  public getConfig(): CredentialDiscoveryConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration
   */
  public updateConfig(newConfig: Partial<CredentialDiscoveryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * CredentialInfo interface for use in other modules
 */
export interface CredentialInfo {
  provider: string;
  lastAccessed: string;
  isValid: boolean;
}
