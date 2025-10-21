/**
 * Types and interfaces for the credential management system
 */

/**
 * Interface for credential configuration
 */
export interface CredentialConfig {
  /**
   * Storage path for encrypted credentials
   */
  storagePath?: string;

  /**
   * Encryption key for credential storage
   */
  encryptionKey?: string;

  /**
   * Number of iterations for key derivation
   */
  keyDerivationIterations?: number;

  /**
   * Whether to automatically encrypt credentials
   */
  autoEncrypt?: boolean;

  /**
   * Whether to enable backup of credentials
   */
  backupEnabled?: boolean;

  /**
   * Backup path for credential storage
   */
  backupPath?: string;

  /**
   * Default providers to use
   */
  defaultProviders?: string[];

  /**
   * Provider-specific configurations
   */
  providers?: {
    [provider: string]: {
      /**
       * API key for the provider
       */
      apiKey?: string;

      /**
       * Base URL for the provider (for local/self-hosted instances)
       */
      baseURL?: string;

      /**
       * Default model to use with this provider
       */
      defaultModel?: string;

      /**
       * Whether this provider is enabled
       */
      enabled?: boolean;

      /**
       * Rate limiting configuration
       */
      rateLimit?: {
        /**
         * Requests per minute limit
         */
        rpm?: number;

        /**
         * Tokens per minute limit
         */
        tpm?: number;
      };

      /**
       * Retry configuration
       */
      retry?: {
        /**
         * Maximum number of retries
         */
        maxAttempts?: number;

        /**
         * Delay between retries in milliseconds
         */
        delay?: number;

        /**
         * Exponential backoff factor
         */
        backoffFactor?: number;
      };
    };
  };
}

/**
 * Interface for discovered credentials
 */
export interface DiscoveredCredential {
  /**
   * Provider name (e.g., 'openai', 'anthropic', 'google')
   */
  provider: string;

  /**
   * API key or token
   */
  key: string;

  /**
   * Source of the credential (environment, file, command, keychain)
   */
  source: 'environment' | 'file' | 'command' | 'keychain';

  /**
   * File path where credential was found (if from file)
   */
  filePath?: string;

  /**
   * Command that produced the credential (if from command)
   */
  command?: string;

  /**
   * Whether the credential is valid
   */
  isValid: boolean;

  /**
   * Timestamp when credential was last checked
   */
  lastChecked: Date;

  /**
   * Expiration date for the credential (if applicable)
   */
  expiresAt?: Date;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for encrypted credential storage
 */
export interface EncryptedCredential {
  /**
   * Provider name
   */
  provider: string;

  /**
   * Encrypted API key or token
   */
  encryptedKey: string;

  /**
   * Initialization vector for encryption
   */
  iv: string;

  /**
   * Authentication tag for encryption
   */
  authTag: string;

  /**
   * Timestamp when credential was created
   */
  createdAt: string;

  /**
   * Timestamp when credential was last updated
   */
  updatedAt: string;

  /**
   * Expiration date for the credential (if applicable)
   */
  expiresAt?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for credential validation results
 */
export interface CredentialValidationResult {
  /**
   * Whether the credential is valid
   */
  isValid: boolean;

  /**
   * Provider name
   */
  provider: string;

  /**
   * Error message if validation failed
   */
  error?: string;

  /**
   * Validation timestamp
   */
  validatedAt: Date;

  /**
   * Additional validation details
   */
  details?: Record<string, any>;
}

/**
 * Interface for credential discovery configuration
 */
export interface CredentialDiscoveryConfig {
  /**
   * Paths to search for credential files
   */
  searchPaths?: string[];

  /**
   * Environment variables to check for credentials
   */
  environmentVariables?: Record<string, string>;

  /**
   * Commands to execute for credential discovery
   */
  commands?: Record<string, string>;

  /**
   * File patterns to match credential files
   */
  filePatterns?: string[];

  /**
   * Keychain services to check for credentials
   */
  keychainServices?: string[];

  /**
   * Maximum time to wait for command execution (ms)
   */
  commandTimeout?: number;

  /**
   * Whether to follow symlinks when searching
   */
  followSymlinks?: boolean;

  /**
   * Whether to skip hidden files and directories
   */
  skipHidden?: boolean;
}

/**
 * Interface for credential store statistics
 */
export interface CredentialStoreStats {
  /**
   * Total number of credentials stored
   */
  totalCredentials: number;

  /**
   * Number of encrypted credentials
   */
  encryptedCredentials: number;

  /**
   * Number of expired credentials
   */
  expiredCredentials: number;

  /**
   * List of provider names
   */
  providers: string[];

  /**
   * Storage path
   */
  storagePath?: string;

  /**
   * Last backup timestamp
   */
  lastBackup?: Date;

  /**
   * Backup path
   */
  backupPath?: string;
}

/**
 * Interface for credential rotation configuration
 */
export interface CredentialRotationConfig {
  /**
   * Whether automatic rotation is enabled
   */
  enabled: boolean;

  /**
   * Rotation interval in days
   */
  intervalDays?: number;

  /**
   * Rotation time (cron expression)
   */
  schedule?: string;

  /**
   * Notification settings
   */
  notifications?: {
    /**
     * Whether to notify before rotation
     */
    notifyBefore?: boolean;

    /**
     * Days before rotation to notify
     */
    notifyDaysBefore?: number;

    /**
     * Notification channels
     */
    channels?: ('email' | 'slack' | 'discord')[];
  };

  /**
   * Backup settings
   */
  backup?: {
    /**
     * Whether to backup before rotation
     */
    backupBefore?: boolean;

    /**
     * Number of backups to keep
     */
    keepBackups?: number;
  };
}

/**
 * Interface for credential security policies
 */
export interface CredentialSecurityPolicy {
  /**
   * Minimum key length requirements
   */
  minLength?: number;

  /**
   * Required character types
   */
  requiredChars?: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
  };

  /**
   * Key complexity requirements
   */
  complexity?: {
    /**
     * Minimum entropy in bits
     */
    minEntropy?: number;

    /**
     * Forbidden patterns
     */
    forbiddenPatterns?: RegExp[];
  };

  /**
   * Expiration policies
   */
  expiration?: {
    /**
     * Default expiration in days
     */
    defaultDays?: number;

    /**
     * Maximum expiration in days
     */
    maxDays?: number;

    /**
     * Warning period in days
     */
    warningDays?: number;
  };

  /**
   * Access control policies
   */
  accessControl?: {
    /**
     * Required permissions for credential access
     */
    requiredPermissions?: string[];

    /**
     * Audit logging settings
     */
    auditLogging?: {
      /**
       * Whether to log credential access
       */
      enabled?: boolean;

      /**
       * Log level
       */
      level?: 'info' | 'warn' | 'error';

      /**
       * Log retention in days
       */
      retentionDays?: number;
    };
  };
}

/**
 * Interface for credential audit log entry
 */
export interface CredentialAuditLogEntry {
  /**
   * Timestamp of the event
   */
  timestamp: Date;

  /**
   * Type of event
   */
  eventType: 'access' | 'modification' | 'creation' | 'deletion' | 'rotation' | 'validation';

  /**
   * Provider name
   */
  provider: string;

  /**
   * User or service that performed the action
   */
  actor: string;

  /**
   * Action details
   */
  action: string;

  /**
   * IP address of the actor (if applicable)
   */
  ipAddress?: string;

  /**
   * User agent of the actor (if applicable)
   */
  userAgent?: string;

  /**
   * Success status of the action
   */
  success: boolean;

  /**
   * Error message if action failed
   */
  error?: string;

  /**
   * Additional metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Interface for credential backup configuration
 */
export interface CredentialBackupConfig {
  /**
   * Whether backups are enabled
   */
  enabled: boolean;

  /**
   * Backup destination
   */
  destination: 'local' | 'remote' | 'cloud';

  /**
   * Backup frequency
   */
  frequency: 'daily' | 'weekly' | 'monthly' | 'on-change';

  /**
   * Number of backups to keep
   */
  retentionCount?: number;

  /**
   * Encryption settings for backups
   */
  encryption?: {
    /**
     * Whether to encrypt backups
     */
    enabled?: boolean;

    /**
     * Backup encryption key
     */
    key?: string;
  };

  /**
   * Remote backup settings
   */
  remote?: {
    /**
     * Remote storage type
     */
    type: 's3' | 'gcs' | 'azure' | 'ftp' | 'custom';

    /**
     * Remote storage configuration
     */
    config: Record<string, any>;
  };
}
