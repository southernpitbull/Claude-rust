/**
 * Errors module index
 *
 * Exports all error-related classes, interfaces, and utilities
 */

// Base error classes
export * from './BaseError';
export * from './CLIError';
export * from './ProviderError';
export * from './AgentError';
export * from './ConfigError';
export * from './ValidationError';
export * from './NetworkError';
export * from './FileSystemError';

// Error utilities
export * from './ErrorCodes';
export * from './RetryStrategy';

// Error handling components
export * from './ErrorLogger';
export * from './ErrorReporter';
export * from './ErrorFormatter';
export * from './ErrorContext';

// Type exports
export type { ErrorSeverity, ErrorCategory } from './BaseError';

export type { IRetryStrategy, RetryOptions, CircuitBreakerOptions } from './RetryStrategy';

export type { ErrorLogEntry } from './ErrorLogger';

export type { ErrorReport, ReportEnvironment, ReportUser, Breadcrumb } from './ErrorReporter';

export type { ErrorFormattingOptions, FormattedError } from './ErrorFormatter';

export type {
  IErrorContext,
  RequestInfo,
  UserInfo,
  SystemInfo,
  AsyncContextInfo,
  PrivacySettings,
} from './ErrorContext';

// Default exports
export { default as ErrorLogger } from './ErrorLogger';
export { default as ErrorReporter } from './ErrorReporter';
export { default as ErrorFormatter } from './ErrorFormatter';
export { default as ErrorContext } from './ErrorContext';

// Singleton instances
export { errorFormatter } from './ErrorFormatter';
export {
  createErrorContext,
  getCurrentErrorContext,
  runWithErrorContext,
  runWithErrorContextAsync,
} from './ErrorContext';
export { createErrorLogger } from './ErrorLogger';
export { createErrorReporter } from './ErrorReporter';
