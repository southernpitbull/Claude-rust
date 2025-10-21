/**
 * Comprehensive error code enumeration for AIrchitect CLI
 *
 * Error Code Ranges:
 * - 1000-1999: Validation Errors
 * - 2000-2999: Authentication Errors
 * - 3000-3999: Authorization Errors
 * - 4000-4999: Network Errors
 * - 5000-5999: File System Errors
 * - 6000-6999: Configuration Errors
 * - 7000-7999: Plugin Errors
 * - 8000-8999: AI Provider Errors
 * - 9000-9999: General/System Errors
 */

/**
 * Error code enumeration for all error types in AIrchitect
 */
export enum ErrorCode {
  // ==================== Validation Errors (1000-1999) ====================

  /** Required field is missing */
  VALIDATION_REQUIRED_FIELD = 'ERR_VALIDATION_1001',

  /** Invalid format provided */
  VALIDATION_INVALID_FORMAT = 'ERR_VALIDATION_1002',

  /** Value out of acceptable range */
  VALIDATION_OUT_OF_RANGE = 'ERR_VALIDATION_1003',

  /** Invalid type provided */
  VALIDATION_INVALID_TYPE = 'ERR_VALIDATION_1004',

  /** Value too long */
  VALIDATION_MAX_LENGTH_EXCEEDED = 'ERR_VALIDATION_1005',

  /** Value too short */
  VALIDATION_MIN_LENGTH_NOT_MET = 'ERR_VALIDATION_1006',

  /** Invalid email format */
  VALIDATION_INVALID_EMAIL = 'ERR_VALIDATION_1007',

  /** Invalid URL format */
  VALIDATION_INVALID_URL = 'ERR_VALIDATION_1008',

  /** Invalid JSON structure */
  VALIDATION_INVALID_JSON = 'ERR_VALIDATION_1009',

  /** Schema validation failed */
  VALIDATION_SCHEMA_MISMATCH = 'ERR_VALIDATION_1010',

  /** Duplicate value detected */
  VALIDATION_DUPLICATE_VALUE = 'ERR_VALIDATION_1011',

  /** Invalid enum value */
  VALIDATION_INVALID_ENUM = 'ERR_VALIDATION_1012',

  // ==================== Authentication Errors (2000-2999) ====================

  /** Invalid credentials provided */
  AUTH_INVALID_CREDENTIALS = 'ERR_AUTH_2001',

  /** Authentication token expired */
  AUTH_TOKEN_EXPIRED = 'ERR_AUTH_2002',

  /** Invalid authentication token */
  AUTH_INVALID_TOKEN = 'ERR_AUTH_2003',

  /** Authentication token not found */
  AUTH_TOKEN_NOT_FOUND = 'ERR_AUTH_2004',

  /** Authentication token revoked */
  AUTH_TOKEN_REVOKED = 'ERR_AUTH_2005',

  /** API key invalid */
  AUTH_INVALID_API_KEY = 'ERR_AUTH_2006',

  /** API key missing */
  AUTH_API_KEY_MISSING = 'ERR_AUTH_2007',

  /** Authentication failed */
  AUTH_FAILED = 'ERR_AUTH_2008',

  /** Two-factor authentication required */
  AUTH_2FA_REQUIRED = 'ERR_AUTH_2009',

  /** Invalid two-factor authentication code */
  AUTH_INVALID_2FA_CODE = 'ERR_AUTH_2010',

  /** Session expired */
  AUTH_SESSION_EXPIRED = 'ERR_AUTH_2011',

  /** Invalid session */
  AUTH_INVALID_SESSION = 'ERR_AUTH_2012',

  // ==================== Authorization Errors (3000-3999) ====================

  /** Insufficient permissions */
  AUTHZ_INSUFFICIENT_PERMISSIONS = 'ERR_AUTHZ_3001',

  /** Access denied */
  AUTHZ_ACCESS_DENIED = 'ERR_AUTHZ_3002',

  /** Resource forbidden */
  AUTHZ_FORBIDDEN = 'ERR_AUTHZ_3003',

  /** Role required */
  AUTHZ_ROLE_REQUIRED = 'ERR_AUTHZ_3004',

  /** Scope missing */
  AUTHZ_SCOPE_MISSING = 'ERR_AUTHZ_3005',

  /** Operation not allowed */
  AUTHZ_OPERATION_NOT_ALLOWED = 'ERR_AUTHZ_3006',

  /** Resource owner mismatch */
  AUTHZ_OWNER_MISMATCH = 'ERR_AUTHZ_3007',

  // ==================== Network Errors (4000-4999) ====================

  /** Network connection failed */
  NETWORK_CONNECTION_FAILED = 'ERR_NETWORK_4001',

  /** Network timeout */
  NETWORK_TIMEOUT = 'ERR_NETWORK_4002',

  /** DNS resolution failed */
  NETWORK_DNS_FAILED = 'ERR_NETWORK_4003',

  /** SSL/TLS error */
  NETWORK_SSL_ERROR = 'ERR_NETWORK_4004',

  /** HTTP request failed */
  NETWORK_HTTP_REQUEST_FAILED = 'ERR_NETWORK_4005',

  /** HTTP 4xx error */
  NETWORK_HTTP_CLIENT_ERROR = 'ERR_NETWORK_4006',

  /** HTTP 5xx error */
  NETWORK_HTTP_SERVER_ERROR = 'ERR_NETWORK_4007',

  /** Network unreachable */
  NETWORK_UNREACHABLE = 'ERR_NETWORK_4008',

  /** Connection refused */
  NETWORK_CONNECTION_REFUSED = 'ERR_NETWORK_4009',

  /** Connection reset */
  NETWORK_CONNECTION_RESET = 'ERR_NETWORK_4010',

  /** Rate limit exceeded */
  NETWORK_RATE_LIMIT_EXCEEDED = 'ERR_NETWORK_4011',

  /** Proxy error */
  NETWORK_PROXY_ERROR = 'ERR_NETWORK_4012',

  // ==================== File System Errors (5000-5999) ====================

  /** File not found */
  FS_FILE_NOT_FOUND = 'ERR_FS_5001',

  /** Directory not found */
  FS_DIRECTORY_NOT_FOUND = 'ERR_FS_5002',

  /** Permission denied */
  FS_PERMISSION_DENIED = 'ERR_FS_5003',

  /** File already exists */
  FS_FILE_ALREADY_EXISTS = 'ERR_FS_5004',

  /** Directory not empty */
  FS_DIRECTORY_NOT_EMPTY = 'ERR_FS_5005',

  /** Disk full */
  FS_DISK_FULL = 'ERR_FS_5006',

  /** Read error */
  FS_READ_ERROR = 'ERR_FS_5007',

  /** Write error */
  FS_WRITE_ERROR = 'ERR_FS_5008',

  /** Invalid path */
  FS_INVALID_PATH = 'ERR_FS_5009',

  /** Path too long */
  FS_PATH_TOO_LONG = 'ERR_FS_5010',

  /** Symlink error */
  FS_SYMLINK_ERROR = 'ERR_FS_5011',

  /** File locked */
  FS_FILE_LOCKED = 'ERR_FS_5012',

  // ==================== Configuration Errors (6000-6999) ====================

  /** Configuration file not found */
  CONFIG_FILE_NOT_FOUND = 'ERR_CONFIG_6001',

  /** Invalid configuration format */
  CONFIG_INVALID_FORMAT = 'ERR_CONFIG_6002',

  /** Configuration parse error */
  CONFIG_PARSE_ERROR = 'ERR_CONFIG_6003',

  /** Missing required configuration */
  CONFIG_MISSING_REQUIRED = 'ERR_CONFIG_6004',

  /** Invalid configuration value */
  CONFIG_INVALID_VALUE = 'ERR_CONFIG_6005',

  /** Configuration validation failed */
  CONFIG_VALIDATION_FAILED = 'ERR_CONFIG_6006',

  /** Incompatible configuration version */
  CONFIG_INCOMPATIBLE_VERSION = 'ERR_CONFIG_6007',

  /** Configuration migration failed */
  CONFIG_MIGRATION_FAILED = 'ERR_CONFIG_6008',

  /** Environment variable missing */
  CONFIG_ENV_VAR_MISSING = 'ERR_CONFIG_6009',

  /** Invalid environment value */
  CONFIG_INVALID_ENV_VALUE = 'ERR_CONFIG_6010',

  // ==================== Plugin Errors (7000-7999) ====================

  /** Plugin not found */
  PLUGIN_NOT_FOUND = 'ERR_PLUGIN_7001',

  /** Plugin load failed */
  PLUGIN_LOAD_FAILED = 'ERR_PLUGIN_7002',

  /** Plugin initialization failed */
  PLUGIN_INIT_FAILED = 'ERR_PLUGIN_7003',

  /** Plugin execution failed */
  PLUGIN_EXECUTION_FAILED = 'ERR_PLUGIN_7004',

  /** Plugin dependency missing */
  PLUGIN_DEPENDENCY_MISSING = 'ERR_PLUGIN_7005',

  /** Plugin version incompatible */
  PLUGIN_VERSION_INCOMPATIBLE = 'ERR_PLUGIN_7006',

  /** Plugin already registered */
  PLUGIN_ALREADY_REGISTERED = 'ERR_PLUGIN_7007',

  /** Plugin timeout */
  PLUGIN_TIMEOUT = 'ERR_PLUGIN_7008',

  /** Plugin crashed */
  PLUGIN_CRASHED = 'ERR_PLUGIN_7009',

  /** Invalid plugin manifest */
  PLUGIN_INVALID_MANIFEST = 'ERR_PLUGIN_7010',

  /** Plugin API version mismatch */
  PLUGIN_API_VERSION_MISMATCH = 'ERR_PLUGIN_7011',

  /** Plugin security violation */
  PLUGIN_SECURITY_VIOLATION = 'ERR_PLUGIN_7012',

  // ==================== AI Provider Errors (8000-8999) ====================

  /** AI provider not found */
  AI_PROVIDER_NOT_FOUND = 'ERR_AI_8001',

  /** AI provider unavailable */
  AI_PROVIDER_UNAVAILABLE = 'ERR_AI_8002',

  /** AI provider API error */
  AI_PROVIDER_API_ERROR = 'ERR_AI_8003',

  /** AI provider authentication failed */
  AI_PROVIDER_AUTH_FAILED = 'ERR_AI_8004',

  /** AI provider quota exceeded */
  AI_PROVIDER_QUOTA_EXCEEDED = 'ERR_AI_8005',

  /** AI provider rate limited */
  AI_PROVIDER_RATE_LIMITED = 'ERR_AI_8006',

  /** AI provider timeout */
  AI_PROVIDER_TIMEOUT = 'ERR_AI_8007',

  /** Invalid AI provider response */
  AI_PROVIDER_INVALID_RESPONSE = 'ERR_AI_8008',

  /** AI model not found */
  AI_MODEL_NOT_FOUND = 'ERR_AI_8009',

  /** AI model not supported */
  AI_MODEL_NOT_SUPPORTED = 'ERR_AI_8010',

  /** AI prompt too long */
  AI_PROMPT_TOO_LONG = 'ERR_AI_8011',

  /** AI response parsing failed */
  AI_RESPONSE_PARSE_FAILED = 'ERR_AI_8012',

  /** AI content filter triggered */
  AI_CONTENT_FILTERED = 'ERR_AI_8013',

  /** AI provider configuration invalid */
  AI_PROVIDER_CONFIG_INVALID = 'ERR_AI_8014',

  // ==================== General/System Errors (9000-9999) ====================

  /** Unknown error */
  UNKNOWN_ERROR = 'ERR_UNKNOWN_9000',

  /** Internal error */
  INTERNAL_ERROR = 'ERR_INTERNAL_9001',

  /** Not implemented */
  NOT_IMPLEMENTED = 'ERR_NOT_IMPLEMENTED_9002',

  /** Operation aborted */
  OPERATION_ABORTED = 'ERR_OPERATION_ABORTED_9003',

  /** Operation timeout */
  OPERATION_TIMEOUT = 'ERR_OPERATION_TIMEOUT_9004',

  /** Resource not found */
  RESOURCE_NOT_FOUND = 'ERR_RESOURCE_NOT_FOUND_9005',

  /** Resource already exists */
  RESOURCE_ALREADY_EXISTS = 'ERR_RESOURCE_ALREADY_EXISTS_9006',

  /** Invalid argument */
  INVALID_ARGUMENT = 'ERR_INVALID_ARGUMENT_9007',

  /** Invalid state */
  INVALID_STATE = 'ERR_INVALID_STATE_9008',

  /** Dependency error */
  DEPENDENCY_ERROR = 'ERR_DEPENDENCY_9009',

  /** System error */
  SYSTEM_ERROR = 'ERR_SYSTEM_9010',

  /** Memory allocation failed */
  MEMORY_ALLOCATION_FAILED = 'ERR_MEMORY_9011',

  /** Process spawn failed */
  PROCESS_SPAWN_FAILED = 'ERR_PROCESS_9012',
}

/**
 * Get HTTP status code for error code
 * @param code - Error code
 * @returns HTTP status code
 */
export function getHttpStatusCode(code: ErrorCode): number {
  // Validation errors -> 400 Bad Request
  if (code.startsWith('ERR_VALIDATION_')) {
    return 400;
  }

  // Authentication errors -> 401 Unauthorized
  if (code.startsWith('ERR_AUTH_')) {
    return 401;
  }

  // Authorization errors -> 403 Forbidden
  if (code.startsWith('ERR_AUTHZ_')) {
    return 403;
  }

  // Network errors
  if (code.startsWith('ERR_NETWORK_')) {
    if (code === ErrorCode.NETWORK_RATE_LIMIT_EXCEEDED) {
      return 429; // Too Many Requests
    }
    if (code === ErrorCode.NETWORK_HTTP_CLIENT_ERROR) {
      return 400;
    }
    if (code === ErrorCode.NETWORK_HTTP_SERVER_ERROR) {
      return 502; // Bad Gateway
    }
    return 503; // Service Unavailable
  }

  // File system errors -> 404 or 500
  if (code.startsWith('ERR_FS_')) {
    if (code === ErrorCode.FS_FILE_NOT_FOUND || code === ErrorCode.FS_DIRECTORY_NOT_FOUND) {
      return 404;
    }
    if (code === ErrorCode.FS_PERMISSION_DENIED) {
      return 403;
    }
    if (code === ErrorCode.FS_FILE_ALREADY_EXISTS) {
      return 409; // Conflict
    }
    return 500;
  }

  // Configuration errors -> 500 Internal Server Error
  if (code.startsWith('ERR_CONFIG_')) {
    return 500;
  }

  // Plugin errors -> 500 Internal Server Error
  if (code.startsWith('ERR_PLUGIN_')) {
    return 500;
  }

  // AI Provider errors
  if (code.startsWith('ERR_AI_')) {
    if (
      code === ErrorCode.AI_PROVIDER_QUOTA_EXCEEDED ||
      code === ErrorCode.AI_PROVIDER_RATE_LIMITED
    ) {
      return 429;
    }
    if (code === ErrorCode.AI_PROVIDER_AUTH_FAILED) {
      return 401;
    }
    if (code === ErrorCode.AI_PROVIDER_TIMEOUT) {
      return 504; // Gateway Timeout
    }
    return 502; // Bad Gateway
  }

  // General errors
  if (code === ErrorCode.RESOURCE_NOT_FOUND) {
    return 404;
  }
  if (code === ErrorCode.RESOURCE_ALREADY_EXISTS) {
    return 409;
  }
  if (code === ErrorCode.INVALID_ARGUMENT) {
    return 400;
  }
  if (code === ErrorCode.NOT_IMPLEMENTED) {
    return 501;
  }

  // Default to 500 Internal Server Error
  return 500;
}

/**
 * Check if error code represents a retryable error
 * @param code - Error code
 * @returns True if error is retryable
 */
export function isRetryableError(code: ErrorCode): boolean {
  // Network errors are generally retryable
  if (
    code === ErrorCode.NETWORK_TIMEOUT ||
    code === ErrorCode.NETWORK_CONNECTION_FAILED ||
    code === ErrorCode.NETWORK_CONNECTION_RESET ||
    code === ErrorCode.NETWORK_HTTP_SERVER_ERROR ||
    code === ErrorCode.NETWORK_UNREACHABLE
  ) {
    return true;
  }

  // Rate limits are retryable after waiting
  if (
    code === ErrorCode.NETWORK_RATE_LIMIT_EXCEEDED ||
    code === ErrorCode.AI_PROVIDER_RATE_LIMITED
  ) {
    return true;
  }

  // AI provider timeouts and temporary unavailability
  if (code === ErrorCode.AI_PROVIDER_TIMEOUT || code === ErrorCode.AI_PROVIDER_UNAVAILABLE) {
    return true;
  }

  // Operation timeouts
  if (code === ErrorCode.OPERATION_TIMEOUT) {
    return true;
  }

  // Most other errors are not retryable
  return false;
}

/**
 * Get user-friendly error category name
 * @param code - Error code
 * @returns Category name
 */
export function getErrorCategory(code: ErrorCode): string {
  if (code.startsWith('ERR_VALIDATION_')) {
    return 'Validation';
  }
  if (code.startsWith('ERR_AUTH_')) {
    return 'Authentication';
  }
  if (code.startsWith('ERR_AUTHZ_')) {
    return 'Authorization';
  }
  if (code.startsWith('ERR_NETWORK_')) {
    return 'Network';
  }
  if (code.startsWith('ERR_FS_')) {
    return 'File System';
  }
  if (code.startsWith('ERR_CONFIG_')) {
    return 'Configuration';
  }
  if (code.startsWith('ERR_PLUGIN_')) {
    return 'Plugin';
  }
  if (code.startsWith('ERR_AI_')) {
    return 'AI Provider';
  }
  return 'General';
}
