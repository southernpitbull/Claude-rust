/**
 * Error Codes Registry for AIrchitect CLI
 *
 * Centralized error code definitions with documentation and recovery suggestions.
 * Error codes are organized by category for easy identification and handling.
 */

/**
 * Error code enumeration
 * Organized by category ranges for easy identification
 */
export enum ErrorCode {
  // CLI Errors (1000-1999)
  CLI_INVALID_COMMAND = 1000,
  CLI_MISSING_ARGUMENT = 1001,
  CLI_INVALID_ARGUMENT = 1002,
  CLI_COMMAND_NOT_FOUND = 1003,
  CLI_EXECUTION_FAILED = 1004,
  CLI_INITIALIZATION_FAILED = 1005,
  CLI_PARSING_ERROR = 1006,
  CLI_VALIDATION_FAILED = 1007,
  CLI_HOOK_FAILED = 1008,
  CLI_BOOTSTRAP_FAILED = 1009,

  // Provider Errors (2000-2999)
  PROVIDER_AUTH_FAILED = 2000,
  PROVIDER_RATE_LIMIT = 2001,
  PROVIDER_API_ERROR = 2002,
  PROVIDER_TIMEOUT = 2003,
  PROVIDER_UNAVAILABLE = 2004,
  PROVIDER_INVALID_RESPONSE = 2005,
  PROVIDER_CONFIG_INVALID = 2006,
  PROVIDER_NOT_FOUND = 2007,
  PROVIDER_INITIALIZATION_FAILED = 2008,
  PROVIDER_CONNECTION_FAILED = 2009,

  // Agent Errors (3000-3999)
  AGENT_EXECUTION_FAILED = 3000,
  AGENT_TIMEOUT = 3001,
  AGENT_COMMUNICATION_FAILED = 3002,
  AGENT_STATE_INVALID = 3003,
  AGENT_NOT_FOUND = 3004,
  AGENT_INITIALIZATION_FAILED = 3005,
  AGENT_REGISTRATION_FAILED = 3006,
  AGENT_ORCHESTRATION_FAILED = 3007,
  AGENT_MEMORY_ERROR = 3008,
  AGENT_WORKFLOW_FAILED = 3009,

  // Config Errors (4000-4999)
  CONFIG_INVALID_SCHEMA = 4000,
  CONFIG_MISSING_REQUIRED = 4001,
  CONFIG_LOAD_FAILED = 4002,
  CONFIG_SAVE_FAILED = 4003,
  CONFIG_VALIDATION_FAILED = 4004,
  CONFIG_MERGE_FAILED = 4005,
  CONFIG_ENCRYPTION_FAILED = 4006,
  CONFIG_DECRYPTION_FAILED = 4007,
  CONFIG_MIGRATION_FAILED = 4008,
  CONFIG_WATCH_FAILED = 4009,

  // Network Errors (5000-5999)
  NETWORK_TIMEOUT = 5000,
  NETWORK_CONNECTION_REFUSED = 5001,
  NETWORK_DNS_FAILED = 5002,
  NETWORK_TLS_FAILED = 5003,
  NETWORK_PROXY_ERROR = 5004,
  NETWORK_UNREACHABLE = 5005,
  NETWORK_PROTOCOL_ERROR = 5006,
  NETWORK_CERTIFICATE_ERROR = 5007,
  NETWORK_RATE_LIMIT = 5008,
  NETWORK_RESPONSE_ERROR = 5009,

  // FileSystem Errors (6000-6999)
  FS_PERMISSION_DENIED = 6000,
  FS_FILE_NOT_FOUND = 6001,
  FS_DIRECTORY_NOT_FOUND = 6002,
  FS_DISK_FULL = 6003,
  FS_READ_FAILED = 6004,
  FS_WRITE_FAILED = 6005,
  FS_DELETE_FAILED = 6006,
  FS_COPY_FAILED = 6007,
  FS_MOVE_FAILED = 6008,
  FS_INVALID_PATH = 6009,

  // Validation Errors (7000-7999)
  VALIDATION_TYPE_MISMATCH = 7000,
  VALIDATION_RANGE_ERROR = 7001,
  VALIDATION_FORMAT_ERROR = 7002,
  VALIDATION_REQUIRED_MISSING = 7003,
  VALIDATION_PATTERN_MISMATCH = 7004,
  VALIDATION_LENGTH_ERROR = 7005,
  VALIDATION_CUSTOM_FAILED = 7006,
  VALIDATION_SCHEMA_ERROR = 7007,
  VALIDATION_CONSTRAINT_VIOLATED = 7008,
  VALIDATION_ASYNC_FAILED = 7009,

  // Security Errors (8000-8999)
  SECURITY_AUTH_FAILED = 8000,
  SECURITY_AUTH_EXPIRED = 8001,
  SECURITY_PERMISSION_DENIED = 8002,
  SECURITY_INVALID_TOKEN = 8003,
  SECURITY_ENCRYPTION_FAILED = 8004,
  SECURITY_DECRYPTION_FAILED = 8005,
  SECURITY_KEY_NOT_FOUND = 8006,
  SECURITY_SIGNATURE_INVALID = 8007,
  SECURITY_RATE_LIMIT_EXCEEDED = 8008,
  SECURITY_ACCESS_DENIED = 8009,

  // Memory Errors (9000-9999)
  MEMORY_STORAGE_FAILED = 9000,
  MEMORY_RETRIEVAL_FAILED = 9001,
  MEMORY_VECTOR_STORE_ERROR = 9002,
  MEMORY_INDEX_ERROR = 9003,
  MEMORY_QUERY_FAILED = 9004,
  MEMORY_DISTILLATION_FAILED = 9005,
  MEMORY_CONTEXT_ERROR = 9006,
  MEMORY_GRAPH_ERROR = 9007,
  MEMORY_LIMIT_EXCEEDED = 9008,
  MEMORY_CORRUPTION = 9009,

  // TUI Errors (10000-10999)
  TUI_RENDER_FAILED = 10000,
  TUI_INPUT_ERROR = 10001,
  TUI_LAYOUT_ERROR = 10002,
  TUI_THEME_ERROR = 10003,
  TUI_COMPONENT_ERROR = 10004,
  TUI_NAVIGATION_ERROR = 10005,
  TUI_SYNTAX_HIGHLIGHT_ERROR = 10006,
  TUI_SCREEN_ERROR = 10007,
  TUI_TERMINAL_ERROR = 10008,
  TUI_UNSUPPORTED = 10009,

  // Plugin Errors (11000-11999)
  PLUGIN_LOAD_FAILED = 11000,
  PLUGIN_INVALID_MANIFEST = 11001,
  PLUGIN_DEPENDENCY_ERROR = 11002,
  PLUGIN_EXECUTION_ERROR = 11003,
  PLUGIN_NOT_FOUND = 11004,
  PLUGIN_VERSION_MISMATCH = 11005,
  PLUGIN_SECURITY_ERROR = 11006,
  PLUGIN_API_ERROR = 11007,
  PLUGIN_INITIALIZATION_ERROR = 11008,
  PLUGIN_LIFECYCLE_ERROR = 11009,

  // Internal Errors (99000-99999)
  INTERNAL_ERROR = 99000,
  INTERNAL_UNEXPECTED = 99001,
  INTERNAL_NOT_IMPLEMENTED = 99002,
  INTERNAL_ASSERTION_FAILED = 99003,
  INTERNAL_STATE_CORRUPTION = 99004,
  INTERNAL_RESOURCE_EXHAUSTED = 99005,
  INTERNAL_DEADLOCK = 99006,
  INTERNAL_PANIC = 99007,
  INTERNAL_UNKNOWN = 99999,
}

/**
 * Error metadata containing detailed information about each error code
 */
export interface ErrorCodeMetadata {
  code: ErrorCode;
  name: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  userMessage: string;
  recoverySuggestions: string[];
  documentationUrl?: string;
  isRetryable: boolean;
  relatedCodes?: ErrorCode[];
}

/**
 * Error code registry containing all error metadata
 */
export class ErrorCodeRegistry {
  private static readonly metadata = new Map<ErrorCode, ErrorCodeMetadata>([
    // CLI Errors
    [
      ErrorCode.CLI_INVALID_COMMAND,
      {
        code: ErrorCode.CLI_INVALID_COMMAND,
        name: 'CLI_INVALID_COMMAND',
        category: 'CLI',
        severity: 'medium',
        description: 'The specified command is invalid or malformed',
        userMessage: 'Invalid command. Please check the command syntax.',
        recoverySuggestions: [
          'Run "ai help" to see available commands',
          'Check for typos in the command name',
          'Ensure you are using the correct command format',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.CLI_MISSING_ARGUMENT,
      {
        code: ErrorCode.CLI_MISSING_ARGUMENT,
        name: 'CLI_MISSING_ARGUMENT',
        category: 'CLI',
        severity: 'medium',
        description: 'A required command argument is missing',
        userMessage: 'Required argument missing. Please provide all required arguments.',
        recoverySuggestions: [
          'Run "ai help <command>" to see required arguments',
          'Check the command documentation',
          'Ensure all required parameters are provided',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.CLI_COMMAND_NOT_FOUND,
      {
        code: ErrorCode.CLI_COMMAND_NOT_FOUND,
        name: 'CLI_COMMAND_NOT_FOUND',
        category: 'CLI',
        severity: 'low',
        description: 'The specified command was not found',
        userMessage: 'Command not found. Did you mean something else?',
        recoverySuggestions: [
          'Run "ai help" to see all available commands',
          'Check for typos in the command name',
          'Ensure the command is installed',
        ],
        isRetryable: false,
      },
    ],

    // Provider Errors
    [
      ErrorCode.PROVIDER_AUTH_FAILED,
      {
        code: ErrorCode.PROVIDER_AUTH_FAILED,
        name: 'PROVIDER_AUTH_FAILED',
        category: 'Provider',
        severity: 'high',
        description: 'Authentication with the AI provider failed',
        userMessage: 'Authentication failed. Please check your API credentials.',
        recoverySuggestions: [
          'Verify your API key is correct',
          'Check if your API key has expired',
          'Ensure your account is active',
          'Run "ai config set <provider>.apiKey <your-key>"',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.PROVIDER_RATE_LIMIT,
      {
        code: ErrorCode.PROVIDER_RATE_LIMIT,
        name: 'PROVIDER_RATE_LIMIT',
        category: 'Provider',
        severity: 'medium',
        description: 'Rate limit exceeded for the AI provider',
        userMessage: 'Rate limit exceeded. Please wait before retrying.',
        recoverySuggestions: [
          'Wait a few moments before retrying',
          'Upgrade your provider plan for higher limits',
          'Use a different provider',
          'Implement request throttling',
        ],
        isRetryable: true,
      },
    ],

    [
      ErrorCode.PROVIDER_TIMEOUT,
      {
        code: ErrorCode.PROVIDER_TIMEOUT,
        name: 'PROVIDER_TIMEOUT',
        category: 'Provider',
        severity: 'medium',
        description: 'Request to AI provider timed out',
        userMessage: 'Request timed out. The provider took too long to respond.',
        recoverySuggestions: [
          'Retry the request',
          'Check your network connection',
          'Try a different provider',
          'Increase timeout settings',
        ],
        isRetryable: true,
      },
    ],

    // Agent Errors
    [
      ErrorCode.AGENT_EXECUTION_FAILED,
      {
        code: ErrorCode.AGENT_EXECUTION_FAILED,
        name: 'AGENT_EXECUTION_FAILED',
        category: 'Agent',
        severity: 'high',
        description: 'Agent execution failed',
        userMessage: 'The agent encountered an error during execution.',
        recoverySuggestions: [
          'Check agent logs for details',
          'Verify agent configuration',
          'Retry the operation',
          'Contact support if issue persists',
        ],
        isRetryable: true,
      },
    ],

    [
      ErrorCode.AGENT_TIMEOUT,
      {
        code: ErrorCode.AGENT_TIMEOUT,
        name: 'AGENT_TIMEOUT',
        category: 'Agent',
        severity: 'medium',
        description: 'Agent operation timed out',
        userMessage: 'Agent operation timed out.',
        recoverySuggestions: [
          'Increase agent timeout setting',
          'Break down the task into smaller operations',
          'Check if agent is overloaded',
          'Retry the operation',
        ],
        isRetryable: true,
      },
    ],

    // Config Errors
    [
      ErrorCode.CONFIG_INVALID_SCHEMA,
      {
        code: ErrorCode.CONFIG_INVALID_SCHEMA,
        name: 'CONFIG_INVALID_SCHEMA',
        category: 'Configuration',
        severity: 'high',
        description: 'Configuration file has invalid schema',
        userMessage: 'Configuration file is invalid. Please check the format.',
        recoverySuggestions: [
          'Validate configuration against schema',
          'Check for syntax errors in config file',
          'Refer to configuration documentation',
          'Reset to default configuration',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.CONFIG_LOAD_FAILED,
      {
        code: ErrorCode.CONFIG_LOAD_FAILED,
        name: 'CONFIG_LOAD_FAILED',
        category: 'Configuration',
        severity: 'high',
        description: 'Failed to load configuration',
        userMessage: 'Could not load configuration file.',
        recoverySuggestions: [
          'Check if configuration file exists',
          'Verify file permissions',
          'Check file format (JSON, YAML, TOML)',
          'Use default configuration',
        ],
        isRetryable: true,
      },
    ],

    // Network Errors
    [
      ErrorCode.NETWORK_TIMEOUT,
      {
        code: ErrorCode.NETWORK_TIMEOUT,
        name: 'NETWORK_TIMEOUT',
        category: 'Network',
        severity: 'medium',
        description: 'Network request timed out',
        userMessage: 'Network request timed out.',
        recoverySuggestions: [
          'Check your internet connection',
          'Retry the request',
          'Check if the service is available',
          'Increase timeout settings',
        ],
        isRetryable: true,
      },
    ],

    [
      ErrorCode.NETWORK_CONNECTION_REFUSED,
      {
        code: ErrorCode.NETWORK_CONNECTION_REFUSED,
        name: 'NETWORK_CONNECTION_REFUSED',
        category: 'Network',
        severity: 'high',
        description: 'Connection was refused by the server',
        userMessage: 'Could not connect to server.',
        recoverySuggestions: [
          'Check if the service is running',
          'Verify the server address',
          'Check firewall settings',
          'Verify network connectivity',
        ],
        isRetryable: true,
      },
    ],

    // FileSystem Errors
    [
      ErrorCode.FS_PERMISSION_DENIED,
      {
        code: ErrorCode.FS_PERMISSION_DENIED,
        name: 'FS_PERMISSION_DENIED',
        category: 'FileSystem',
        severity: 'high',
        description: 'Permission denied for file operation',
        userMessage: 'Permission denied. Cannot access the file or directory.',
        recoverySuggestions: [
          'Check file permissions',
          'Run with appropriate privileges',
          'Verify file ownership',
          'Use a different location',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.FS_FILE_NOT_FOUND,
      {
        code: ErrorCode.FS_FILE_NOT_FOUND,
        name: 'FS_FILE_NOT_FOUND',
        category: 'FileSystem',
        severity: 'medium',
        description: 'File not found',
        userMessage: 'The specified file could not be found.',
        recoverySuggestions: [
          'Check if the file path is correct',
          'Verify the file exists',
          'Check file spelling',
          'Use absolute path',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.FS_DISK_FULL,
      {
        code: ErrorCode.FS_DISK_FULL,
        name: 'FS_DISK_FULL',
        category: 'FileSystem',
        severity: 'critical',
        description: 'Disk is full, cannot write',
        userMessage: 'Disk is full. Cannot complete the operation.',
        recoverySuggestions: [
          'Free up disk space',
          'Delete unnecessary files',
          'Use a different disk',
          'Increase storage capacity',
        ],
        isRetryable: false,
      },
    ],

    // Validation Errors
    [
      ErrorCode.VALIDATION_TYPE_MISMATCH,
      {
        code: ErrorCode.VALIDATION_TYPE_MISMATCH,
        name: 'VALIDATION_TYPE_MISMATCH',
        category: 'Validation',
        severity: 'medium',
        description: 'Value type does not match expected type',
        userMessage: 'Invalid value type. Expected a different type.',
        recoverySuggestions: [
          'Check the expected type for this value',
          'Convert value to correct type',
          'Refer to API documentation',
        ],
        isRetryable: false,
      },
    ],

    [
      ErrorCode.VALIDATION_REQUIRED_MISSING,
      {
        code: ErrorCode.VALIDATION_REQUIRED_MISSING,
        name: 'VALIDATION_REQUIRED_MISSING',
        category: 'Validation',
        severity: 'medium',
        description: 'Required field is missing',
        userMessage: 'Required field is missing.',
        recoverySuggestions: [
          'Provide the required field',
          'Check which fields are required',
          'Refer to API documentation',
        ],
        isRetryable: false,
      },
    ],

    // Internal Errors
    [
      ErrorCode.INTERNAL_ERROR,
      {
        code: ErrorCode.INTERNAL_ERROR,
        name: 'INTERNAL_ERROR',
        category: 'Internal',
        severity: 'critical',
        description: 'An internal error occurred',
        userMessage: 'An unexpected error occurred. Please try again.',
        recoverySuggestions: [
          'Retry the operation',
          'Check logs for details',
          'Report this issue if it persists',
          'Restart the application',
        ],
        isRetryable: true,
      },
    ],

    [
      ErrorCode.INTERNAL_NOT_IMPLEMENTED,
      {
        code: ErrorCode.INTERNAL_NOT_IMPLEMENTED,
        name: 'INTERNAL_NOT_IMPLEMENTED',
        category: 'Internal',
        severity: 'high',
        description: 'Feature not yet implemented',
        userMessage: 'This feature is not yet implemented.',
        recoverySuggestions: [
          'Use an alternative approach',
          'Check for updates',
          'Refer to roadmap',
        ],
        isRetryable: false,
      },
    ],
  ]);

  /**
   * Get error metadata by error code
   */
  public static getMetadata(code: ErrorCode): ErrorCodeMetadata | undefined {
    return this.metadata.get(code);
  }

  /**
   * Get error metadata by error code number
   */
  public static getMetadataByNumber(codeNumber: number): ErrorCodeMetadata | undefined {
    return this.metadata.get(codeNumber as ErrorCode);
  }

  /**
   * Get all error codes in a category
   */
  public static getCodesByCategory(category: string): ErrorCodeMetadata[] {
    const codes: ErrorCodeMetadata[] = [];
    for (const metadata of this.metadata.values()) {
      if (metadata.category === category) {
        codes.push(metadata);
      }
    }
    return codes;
  }

  /**
   * Get all error codes by severity
   */
  public static getCodesBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): ErrorCodeMetadata[] {
    const codes: ErrorCodeMetadata[] = [];
    for (const metadata of this.metadata.values()) {
      if (metadata.severity === severity) {
        codes.push(metadata);
      }
    }
    return codes;
  }

  /**
   * Check if an error code is retryable
   */
  public static isRetryable(code: ErrorCode): boolean {
    const metadata = this.getMetadata(code);
    return metadata?.isRetryable ?? false;
  }

  /**
   * Get user message for error code
   */
  public static getUserMessage(code: ErrorCode): string {
    const metadata = this.getMetadata(code);
    return metadata?.userMessage ?? 'An error occurred.';
  }

  /**
   * Get recovery suggestions for error code
   */
  public static getRecoverySuggestions(code: ErrorCode): string[] {
    const metadata = this.getMetadata(code);
    return metadata?.recoverySuggestions ?? [];
  }

  /**
   * Get all error codes
   */
  public static getAllCodes(): ErrorCodeMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Register custom error code
   */
  public static registerCode(metadata: ErrorCodeMetadata): void {
    this.metadata.set(metadata.code, metadata);
  }

  /**
   * Search error codes by keyword
   */
  public static search(keyword: string): ErrorCodeMetadata[] {
    const lowerKeyword = keyword.toLowerCase();
    const results: ErrorCodeMetadata[] = [];

    for (const metadata of this.metadata.values()) {
      if (
        metadata.name.toLowerCase().includes(lowerKeyword) ||
        metadata.description.toLowerCase().includes(lowerKeyword) ||
        metadata.category.toLowerCase().includes(lowerKeyword)
      ) {
        results.push(metadata);
      }
    }

    return results;
  }
}

/**
 * Helper function to get error code name
 */
export function getErrorCodeName(code: ErrorCode): string {
  const metadata = ErrorCodeRegistry.getMetadata(code);
  return metadata?.name ?? `UNKNOWN_ERROR_${code}`;
}

/**
 * Helper function to check if error code exists
 */
export function isValidErrorCode(code: number): code is ErrorCode {
  return ErrorCodeRegistry.getMetadataByNumber(code) !== undefined;
}
