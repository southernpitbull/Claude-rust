/**
 * Network Error Classes
 *
 * Handles errors related to network operations, HTTP requests, and API calls
 */

import { BaseError, BaseErrorOptions, ErrorCategory, ErrorSeverity } from './BaseError';

/**
 * Network error codes
 */
export enum NetworkErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'NETWORK_CONNECTION_TIMEOUT',
  CONNECTION_REFUSED = 'NETWORK_CONNECTION_REFUSED',
  DNS_LOOKUP_FAILED = 'NETWORK_DNS_LOOKUP_FAILED',
  REQUEST_TIMEOUT = 'NETWORK_REQUEST_TIMEOUT',
  REQUEST_ABORTED = 'NETWORK_REQUEST_ABORTED',
  RESPONSE_ERROR = 'NETWORK_RESPONSE_ERROR',
  HTTP_ERROR = 'NETWORK_HTTP_ERROR',
  SSL_ERROR = 'NETWORK_SSL_ERROR',
  PROXY_ERROR = 'NETWORK_PROXY_ERROR',
  NO_INTERNET_CONNECTION = 'NETWORK_NO_INTERNET',
}

/**
 * HTTP status code categories
 */
export enum HttpStatusCategory {
  INFORMATIONAL = '1xx',
  SUCCESS = '2xx',
  REDIRECTION = '3xx',
  CLIENT_ERROR = '4xx',
  SERVER_ERROR = '5xx',
}

/**
 * Base Network Error
 */
export class NetworkError extends BaseError {
  public readonly url?: string;
  public readonly method?: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    options: BaseErrorOptions & { url?: string; method?: string; statusCode?: number } = {}
  ) {
    super(message, {
      ...options,
      category: ErrorCategory.NETWORK,
      code: options.code ?? NetworkErrorCode.NETWORK_ERROR,
      isRetryable: options.isRetryable ?? true,
      context: {
        ...options.context,
        url: options.url,
        method: options.method,
        statusCode: options.statusCode,
      },
    });

    this.url = options.url;
    this.method = options.method;
    this.statusCode = options.statusCode;
  }

  protected generateUserMessage(): string {
    return `Network error: ${this.message}`;
  }
}

/**
 * Connection Failed Error
 */
export class ConnectionFailedError extends NetworkError {
  constructor(url: string, reason?: string, options: BaseErrorOptions = {}) {
    super(`Connection failed to ${url}${reason ? `: ${reason}` : ''}`, {
      ...options,
      code: NetworkErrorCode.CONNECTION_FAILED,
      severity: ErrorSeverity.HIGH,
      url,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Failed to connect to ${this.url}. Please check your network connection.`;
  }
}

/**
 * Connection Timeout Error
 */
export class ConnectionTimeoutError extends NetworkError {
  constructor(url: string, timeoutMs: number, options: BaseErrorOptions = {}) {
    super(`Connection to ${url} timed out after ${timeoutMs}ms`, {
      ...options,
      code: NetworkErrorCode.CONNECTION_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      url,
      context: {
        ...options.context,
        timeoutMs,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Connection timeout: Could not reach ${this.url}. Please try again.`;
  }
}

/**
 * Connection Refused Error
 */
export class ConnectionRefusedError extends NetworkError {
  constructor(url: string, options: BaseErrorOptions = {}) {
    super(`Connection refused to ${url}`, {
      ...options,
      code: NetworkErrorCode.CONNECTION_REFUSED,
      severity: ErrorSeverity.HIGH,
      url,
    });
  }

  protected generateUserMessage(): string {
    return `Connection refused by ${this.url}. The service may be unavailable.`;
  }
}

/**
 * DNS Lookup Failed Error
 */
export class DNSLookupError extends NetworkError {
  constructor(hostname: string, options: BaseErrorOptions = {}) {
    super(`DNS lookup failed for ${hostname}`, {
      ...options,
      code: NetworkErrorCode.DNS_LOOKUP_FAILED,
      severity: ErrorSeverity.HIGH,
      url: hostname,
      context: {
        ...options.context,
        hostname,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Could not resolve hostname ${this.context.hostname}. Please check the URL.`;
  }
}

/**
 * Request Timeout Error
 */
export class RequestTimeoutError extends NetworkError {
  constructor(url: string, method: string, timeoutMs: number, options: BaseErrorOptions = {}) {
    super(`${method} request to ${url} timed out after ${timeoutMs}ms`, {
      ...options,
      code: NetworkErrorCode.REQUEST_TIMEOUT,
      severity: ErrorSeverity.MEDIUM,
      url,
      method,
      context: {
        ...options.context,
        timeoutMs,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Request timed out. The server took too long to respond.`;
  }
}

/**
 * Request Aborted Error
 */
export class RequestAbortedError extends NetworkError {
  constructor(url: string, method: string, reason?: string, options: BaseErrorOptions = {}) {
    super(`${method} request to ${url} was aborted${reason ? `: ${reason}` : ''}`, {
      ...options,
      code: NetworkErrorCode.REQUEST_ABORTED,
      severity: ErrorSeverity.LOW,
      url,
      method,
      isRetryable: false,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Request was aborted.`;
  }
}

/**
 * HTTP Error
 */
export class HttpError extends NetworkError {
  constructor(
    url: string,
    method: string,
    statusCode: number,
    statusText: string,
    responseBody?: unknown,
    options: BaseErrorOptions = {}
  ) {
    super(`HTTP ${statusCode} ${statusText}`, {
      ...options,
      code: NetworkErrorCode.HTTP_ERROR,
      severity: HttpError.getSeverityForStatus(statusCode),
      isRetryable: HttpError.isRetryableStatus(statusCode),
      url,
      method,
      statusCode,
      context: {
        ...options.context,
        statusText,
        responseBody,
      },
    });
  }

  protected generateUserMessage(): string {
    const statusCode = this.statusCode ?? 0;

    if (statusCode >= 400 && statusCode < 500) {
      return `Client error (${statusCode}): ${this.context.statusText}`;
    }

    if (statusCode >= 500) {
      return `Server error (${statusCode}): The service is experiencing issues. Please try again later.`;
    }

    return `HTTP error (${statusCode}): ${this.context.statusText}`;
  }

  /**
   * Determines severity based on HTTP status code
   */
  private static getSeverityForStatus(statusCode: number): ErrorSeverity {
    if (statusCode >= 500) {
      return ErrorSeverity.HIGH;
    }
    if (statusCode >= 400) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  /**
   * Determines if HTTP status code is retryable
   */
  private static isRetryableStatus(statusCode: number): boolean {
    // Retry on server errors (5xx) and specific client errors
    return (
      statusCode >= 500 ||
      statusCode === 408 || // Request Timeout
      statusCode === 429 || // Too Many Requests
      statusCode === 503 || // Service Unavailable
      statusCode === 504 // Gateway Timeout
    );
  }
}

/**
 * SSL/TLS Error
 */
export class SSLError extends NetworkError {
  constructor(url: string, reason: string, options: BaseErrorOptions = {}) {
    super(`SSL/TLS error for ${url}: ${reason}`, {
      ...options,
      code: NetworkErrorCode.SSL_ERROR,
      severity: ErrorSeverity.HIGH,
      url,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `SSL/TLS error: ${this.context.reason}. The connection may not be secure.`;
  }
}

/**
 * Proxy Error
 */
export class ProxyError extends NetworkError {
  constructor(proxyUrl: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Proxy error for ${proxyUrl}: ${reason}`, {
      ...options,
      code: NetworkErrorCode.PROXY_ERROR,
      severity: ErrorSeverity.HIGH,
      url: proxyUrl,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Proxy error: ${this.context.reason}`;
  }
}

/**
 * No Internet Connection Error
 */
export class NoInternetConnectionError extends NetworkError {
  constructor(options: BaseErrorOptions = {}) {
    super('No internet connection detected', {
      ...options,
      code: NetworkErrorCode.NO_INTERNET_CONNECTION,
      severity: ErrorSeverity.CRITICAL,
    });
  }

  protected generateUserMessage(): string {
    return 'No internet connection. Please check your network connection and try again.';
  }
}

/**
 * Response Error
 */
export class ResponseError extends NetworkError {
  constructor(url: string, method: string, reason: string, options: BaseErrorOptions = {}) {
    super(`Invalid response from ${url}: ${reason}`, {
      ...options,
      code: NetworkErrorCode.RESPONSE_ERROR,
      severity: ErrorSeverity.MEDIUM,
      url,
      method,
      context: {
        ...options.context,
        reason,
      },
    });
  }

  protected generateUserMessage(): string {
    return `Received invalid response: ${this.context.reason}`;
  }
}
