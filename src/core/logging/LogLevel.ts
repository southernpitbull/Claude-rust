/**
 * Log level enumeration for structured logging
 *
 * @remarks
 * Log levels follow the standard severity hierarchy from most to least severe.
 * Each level includes all higher-severity levels when filtering.
 *
 * @example
 * ```typescript
 * import { LogLevel } from '@core/logging';
 *
 * // Using log levels
 * const level = LogLevel.INFO;
 * console.log(level); // 'info'
 * ```
 *
 * @packageDocumentation
 */

/**
 * Standard log levels in order of severity (highest to lowest)
 */
export enum LogLevel {
  /**
   * Error - Critical failures requiring immediate attention
   * Use for: Application errors, unhandled exceptions, system failures
   */
  ERROR = 'error',

  /**
   * Warning - Issues that don't prevent operation but need attention
   * Use for: Deprecated API usage, recoverable errors, configuration issues
   */
  WARN = 'warn',

  /**
   * Info - General informational messages about application flow
   * Use for: Startup/shutdown, major state changes, user actions
   */
  INFO = 'info',

  /**
   * Debug - Detailed information for debugging purposes
   * Use for: Variable values, function calls, intermediate states
   */
  DEBUG = 'debug',

  /**
   * Trace - Very detailed diagnostic information
   * Use for: Function entry/exit, loop iterations, low-level operations
   */
  TRACE = 'trace',
}

/**
 * Valid log level string values
 */
export type LogLevelString = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Numeric priority values for log levels (lower = higher priority)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.ERROR]: 0,
  [LogLevel.WARN]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.DEBUG]: 3,
  [LogLevel.TRACE]: 4,
};

/**
 * Default log level for production environments
 */
export const DEFAULT_LOG_LEVEL = LogLevel.INFO;

/**
 * Default log level for development environments
 */
export const DEFAULT_DEV_LOG_LEVEL = LogLevel.DEBUG;

/**
 * Converts a string to a LogLevel enum value
 *
 * @param level - The log level string to convert
 * @returns The corresponding LogLevel enum value
 * @throws {Error} If the level string is invalid
 *
 * @example
 * ```typescript
 * const level = parseLogLevel('info'); // LogLevel.INFO
 * ```
 */
export function parseLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase() as LogLevelString;
  const validLevels: LogLevelString[] = ['error', 'warn', 'info', 'debug', 'trace'];

  if (!validLevels.includes(normalized)) {
    throw new Error(`Invalid log level: ${level}. Valid levels are: ${validLevels.join(', ')}`);
  }

  return normalized as LogLevel;
}

/**
 * Checks if a log level should be logged based on the configured level
 *
 * @param messageLevel - The level of the message to log
 * @param configuredLevel - The configured minimum log level
 * @returns True if the message should be logged
 *
 * @example
 * ```typescript
 * shouldLog(LogLevel.INFO, LogLevel.DEBUG); // true (INFO is higher priority)
 * shouldLog(LogLevel.TRACE, LogLevel.INFO); // false (TRACE is lower priority)
 * ```
 */
export function shouldLog(messageLevel: LogLevel, configuredLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[messageLevel] <= LOG_LEVEL_PRIORITY[configuredLevel];
}

/**
 * Gets all log levels at or above a certain priority
 *
 * @param minLevel - The minimum log level
 * @returns Array of log levels that meet or exceed the minimum level
 *
 * @example
 * ```typescript
 * getEnabledLevels(LogLevel.INFO); // [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO]
 * ```
 */
export function getEnabledLevels(minLevel: LogLevel): LogLevel[] {
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];
  return Object.entries(LOG_LEVEL_PRIORITY)
    .filter(([, priority]) => priority <= minPriority)
    .map(([level]) => level as LogLevel)
    .sort((a, b) => LOG_LEVEL_PRIORITY[a] - LOG_LEVEL_PRIORITY[b]);
}
